const { core, event, http, sidebar, subtitle, console } = iina;

const SEARCH_URL = "https://api-shoulei-ssl.xunlei.com/oracle/subtitle";
const SUBTITLE_HOST = "subtitle.v.geilijiasu.com";
const PROVIDER_ID = "thunder-subtitle";

event.on("iina.window-loaded", () => {
  sidebar.loadFile("sidebar.html");
});

function basename(value) {
  const source = String(value || "").split(/[\\/]/).pop() || "";
  return source.replace(/\.[^./\\]+$/, "");
}

function decodeFileURL(value) {
  let source = String(value || "");
  if (source.startsWith("file://")) source = source.slice("file://".length);

  try {
    return decodeURIComponent(source);
  } catch (_) {
    return source;
  }
}

function currentSearchNames() {
  const status = core.status || {};
  const source = decodeFileURL(status.url || status.title || "");
  const parts = source.split(/[\\/]/).filter(Boolean);
  const fileName = basename(parts[parts.length - 1] || status.title);
  const parentName = basename(parts[parts.length - 2]);
  const grandParentName = basename(parts[parts.length - 3]);
  const names = [fileName];

  // Files named 01.mp4 or 02.mkv are common in TV folders. The parent folder
  // is a better search term in that case.
  if (/^(?:\d{1,3}|e\d{1,3})$/i.test(fileName)) {
    names.push(parentName, grandParentName);
  }

  if (status.title && basename(status.title) !== fileName) {
    names.push(basename(status.title));
  }

  return names.filter(Boolean);
}

function searchCandidates(name) {
  const result = [];
  const add = (value) => {
    const normalized = String(value || "").trim();
    if (normalized && !result.includes(normalized)) result.push(normalized);
  };

  add(name);

  // Remove release metadata while preserving the title, season and episode.
  add(
    name
      .replace(/[\[\(（【].*?[\]\)）】]/g, " ")
      .replace(/\b(?:2160p|1080p|720p|480p|WEB[- .]?DL|BluRay|HDTV|x264|x265|H264|H265|AAC|DDP?5?\.1|REMUX)\b/gi, " ")
      .replace(/[._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  return result;
}

async function requestSubtitles(name) {
  const response = await http.get(SEARCH_URL, {
    headers: {
      "User-Agent": "xunlei",
    },
    params: {
      duration: "0",
      gcid: "",
      name,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Thunder subtitle API HTTP ${response.statusCode}: ${response.reason || ""}`);
  }

  const body = response.data;
  if (!body || body.code !== 0) {
    throw new Error(`Thunder subtitle API returned an error: ${JSON.stringify(body)}`);
  }

  return Array.isArray(body.data) ? body.data : [];
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item && (item.cid || item.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDuration(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value <= 0) return "";

  const totalSeconds = Math.round(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function subtitleDescription(item) {
  const data = item.data || {};
  const languages = Array.isArray(data.languages)
    ? data.languages.filter(Boolean).join(", ")
    : "";
  const left = [data.ext && data.ext.toUpperCase(), languages].filter(Boolean).join(" · ");
  const duration = formatDuration(data.duration);

  return {
    name: data.name || "Thunder subtitle",
    left,
    right: duration ? `时长 ${duration}` : "",
  };
}

function validateSubtitleURL(value) {
  if (typeof value !== "string") {
    throw new Error("字幕地址格式无效");
  }

  const allowedPrefix = `https://${SUBTITLE_HOST}/`;
  if (!value.startsWith(allowedPrefix)) {
    throw new Error("字幕地址不在允许的服务域名内");
  }
  return value;
}

async function downloadSubtitle(item) {
  const data = item.data || {};
  const url = validateSubtitleURL(data.url);
  const extension = data.ext === "ass" ? "ass" : "srt";
  const cid = String(data.cid || "subtitle").replace(/[^a-zA-Z0-9_-]/g, "_");
  const destination = `@tmp/thunder-subtitle-${cid}.${extension}`;

  await http.download(url, destination);
  return [destination];
}

subtitle.registerProvider(PROVIDER_ID, {
  search: async () => {
    const names = currentSearchNames();
    if (names.length === 0) throw new Error("无法从当前视频提取文件名");

    const candidates = names.flatMap(searchCandidates).filter(
      (candidate, index, all) => all.indexOf(candidate) === index
    );
    let items = [];
    for (const candidate of candidates) {
      items = await requestSubtitles(candidate);
      if (items.length > 0) break;
    }

    console.log(`Thunder subtitle search: ${candidates[0]}, ${items.length} result(s)`);
    return uniqueItems(items).map((item) => subtitle.item(item));
  },

  description: subtitleDescription,
  download: downloadSubtitle,
});

console.log("Thunder Subtitle provider registered");
