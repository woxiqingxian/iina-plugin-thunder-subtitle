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

function normalizeLanguage(value) {
  const language = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  const labels = {
    "zh-cn": "简体中文",
    "zh-hans": "简体中文",
    chs: "简体中文",
    sc: "简体中文",
    "zh-tw": "繁体中文",
    "zh-hk": "繁体中文",
    "zh-hant": "繁体中文",
    cht: "繁体中文",
    tc: "繁体中文",
    zh: "中文",
    chi: "中文",
    zho: "中文",
    en: "英文",
    eng: "英文",
    ja: "日文",
    jpn: "日文",
    ko: "韩文",
    kor: "韩文",
  };
  return labels[language] || "";
}

function subtitleLanguages(data) {
  const result = [];
  const add = (label) => {
    if (label && !result.includes(label)) result.push(label);
  };

  if (Array.isArray(data.languages)) {
    data.languages.forEach((language) => add(normalizeLanguage(language)));
  }

  const name = String(data.name || "").toLowerCase().replace(/_/g, "-");
  const hasToken = (pattern) => pattern.test(name);
  if (hasToken(/(?:^|[-.\s])(?:zh-?(?:cn|hans)|chs|sc)(?=$|[-.\s])/)) add("简体中文");
  if (hasToken(/(?:^|[-.\s])(?:zh-?(?:tw|hk|hant)|cht|tc)(?=$|[-.\s])/)) add("繁体中文");
  if (hasToken(/(?:^|[-.\s])(?:en|eng)(?=$|[-.\s])/)) add("英文");
  if (hasToken(/(?:^|[-.\s])(?:ja|jpn)(?=$|[-.\s])/)) add("日文");
  if (hasToken(/(?:^|[-.\s])(?:ko|kor)(?=$|[-.\s])/)) add("韩文");

  return result;
}

function subtitleHashName(item) {
  const name = String((item && item.name) || "")
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase();
  return /^[a-f0-9]{32,64}$/.test(name) ? name : "";
}

function subtitleQuality(item) {
  const score = Number(item && item.score) || 0;
  const fingerprint = Number(item && (item.fingerprintf_score || item.fingerprint_score)) || 0;
  return score + fingerprint;
}

function languagePriority(item) {
  const languages = subtitleLanguages(item || {});
  const hasSimplified = languages.includes("简体中文");
  const hasTraditional = languages.includes("繁体中文");
  const hasEnglish = languages.includes("英文");
  if (hasSimplified && !hasEnglish) return 0;
  if (hasTraditional && !hasEnglish) return 1;
  if ((hasSimplified || hasTraditional) && hasEnglish) return 2;
  if (languages.includes("中文")) return 3;
  if (hasEnglish) return 4;
  return languages.length > 0 ? 5 : 6;
}

function uniqueItems(items) {
  const exactSeen = new Set();
  const hashNames = new Set();
  const result = [];

  items.forEach((item) => {
    if (!item) return;
    const exactKey = item.cid || item.url;
    if (!exactKey || exactSeen.has(exactKey)) return;
    exactSeen.add(exactKey);

    const hashName = subtitleHashName(item);
    if (hashName && hashNames.has(hashName)) return;
    if (hashName) hashNames.add(hashName);
    result.push(item);
  });

  return result.sort((left, right) => {
    const languageDifference = languagePriority(left) - languagePriority(right);
    if (languageDifference !== 0) return languageDifference;

    const qualityDifference = subtitleQuality(right) - subtitleQuality(left);
    if (qualityDifference !== 0) return qualityDifference;

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function annotateSameNameItems(items) {
  const counts = new Map();
  const indexes = new Map();
  const itemName = (item) => String((item && item.name) || "").trim().toLowerCase();

  items.forEach((item) => {
    const name = itemName(item);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });

  items.forEach((item) => {
    const name = itemName(item);
    const count = counts.get(name) || 0;
    if (count <= 1) return;
    const index = (indexes.get(name) || 0) + 1;
    indexes.set(name, index);
    item._iinaDisplayVariant = `版本 ${index}/${count}`;
  });

  return items;
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
  const languages = subtitleLanguages(data);
  const language = languages.length > 0 ? languages.join(" / ") : "语言未知";
  const extension = String(data.ext || "字幕").toUpperCase();
  const source = String(data.extra_name || "").replace(/[（）()]/g, "").trim();
  const variant = String(data._iinaDisplayVariant || "");
  const rawName = String(data.name || "迅雷字幕").split(/[\\/]/).pop();
  const nameWithoutExtension = rawName.replace(/\.[^.]+$/, "");
  const displayName = /^[a-f0-9]{32,64}$/i.test(nameWithoutExtension)
    ? `迅雷字幕 · ${nameWithoutExtension.slice(0, 8).toUpperCase()}`
    : nameWithoutExtension;
  const duration = formatDuration(data.duration);

  return {
    name: displayName,
    left: [language, extension, variant, source].filter(Boolean).join(" · "),
    right: duration,
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

    const visibleItems = annotateSameNameItems(uniqueItems(items));
    console.log(
      `Thunder subtitle search: ${candidates[0]}, ${items.length} raw result(s), ${visibleItems.length} visible result(s)`
    );
    return visibleItems.map((item) => subtitle.item(item));
  },

  description: subtitleDescription,
  download: downloadSubtitle,
});

console.log("Thunder Subtitle provider registered");
