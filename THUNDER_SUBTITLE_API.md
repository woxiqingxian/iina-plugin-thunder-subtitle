# 迅雷字幕接口复用文档

本文档记录当前仍可用的迅雷字幕搜索接口、字幕文件下载地址格式，以及在 IINA 1.5.0 插件中的调用方式。

测试日期：2026-10-07

## 1. 接口概览

接口不需要登录、令牌或 Cookie，当前包含两个环节：

1. 调用字幕搜索接口，取得候选字幕列表。
2. 使用候选项中的 `url` 下载 `.srt` 或 `.ass` 字幕文件。

| 用途 | 方法 | 地址 | 测试结果 |
| --- | --- | --- | --- |
| 字幕搜索 | `GET` | `https://api-shoulei-ssl.xunlei.com/oracle/subtitle` | HTTP 200，正常返回 JSON |
| 字幕下载 | `GET` | `https://subtitle.v.geilijiasu.com/...` | HTTP 200，正常返回字幕内容 |

测试中使用 `bban-428` 查询，接口返回 20 条结果；其中多条字幕与目标字幕时间轴和文本完全一致。

## 2. 字幕搜索接口

### 2.1 请求

```http
GET https://api-shoulei-ssl.xunlei.com/oracle/subtitle
User-Agent: xunlei
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | 字符串 | 是 | 视频名称或搜索关键词 |
| `duration` | 字符串 | 否 | 旧插件固定传 `0` |
| `gcid` | 字符串 | 否 | 文件指纹；旧插件固定传空字符串 |

建议始终使用 URL 查询参数编码，不要直接拼接未编码的文件名。

等价的命令行请求：

```bash
curl -G 'https://api-shoulei-ssl.xunlei.com/oracle/subtitle' \
  -A 'xunlei' \
  --data-urlencode 'duration=0' \
  --data-urlencode 'gcid=' \
  --data-urlencode 'name=bban-428'
```

### 2.2 成功响应

```json
{
  "code": 0,
  "result": "ok",
  "data": [
    {
      "gcid": "...",
      "cid": "...",
      "url": "https://subtitle.v.geilijiasu.com/C6/97/....srt",
      "ext": "srt",
      "name": "BBAN-428-zh-CN.srt",
      "duration": 10855000,
      "languages": [""],
      "source": 0,
      "score": 0,
      "fingerprintf_score": 0,
      "extra_name": "（网友上传）"
    }
  ]
}
```

顶层字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | 数字 | `0` 表示接口请求成功；仍需结合 `data` 判断是否有结果 |
| `result` | 字符串 | 成功测试值为 `ok` |
| `data` | 数组 | 字幕候选项；无结果时通常为空数组 |

候选项字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `gcid` | 字符串 | 迅雷文件指纹或关联指纹 |
| `cid` | 字符串 | 字幕资源标识 |
| `url` | 字符串 | 字幕下载地址 |
| `ext` | 字符串 | 字幕格式，当前见到 `srt`、`ass` |
| `name` | 字符串 | 字幕文件名 |
| `duration` | 数字 | 时长，单位为毫秒；部分资源可能为 `0` |
| `languages` | 字符串数组 | 语言标记，部分资源返回空字符串 |
| `source` | 数字 | 资源来源标记，具体枚举未公开 |
| `score` | 数字 | 搜索相关分数 |
| `fingerprintf_score` | 数字 | 文件指纹匹配分数 |
| `extra_name` | 字符串或缺省 | 附加说明，例如 `（网友上传）` |
| `simple_name` | 字符串或缺省 | 部分响应中出现的简化名称 |
| `mt` | 数字或缺省 | 部分响应中出现的额外类型标记，未公开含义 |

### 2.3 无结果与错误

不能只根据 HTTP 状态判断搜索成功。建议同时检查：

```js
if (response.statusCode !== 200) {
  throw new Error(`HTTP ${response.statusCode}: ${response.reason}`)
}

const body = response.data
if (!body || body.code !== 0) {
  throw new Error(`Thunder API error: ${JSON.stringify(body)}`)
}

const items = Array.isArray(body.data) ? body.data : []
```

已测试的无结果示例：查询 `01` 时返回 HTTP 200、`code=0`，但 `data` 为空数组。因此，空结果不代表接口失效。

## 3. 字幕下载接口

搜索结果中的 `data[].url` 可以直接使用。

示例：

```text
https://subtitle.v.geilijiasu.com/C6/97/C69728F920C6E5A47DE409723334F9025F87B572.srt
```

测试结果：

```http
HTTP/2 200
Content-Type: application/octet-stream
```

下载地址可能返回 UTF-8、UTF-16LE 或其他中文编码。播放器通常可以直接识别，但自行读取或转换字幕时应先检查 BOM，并准备编码回退策略。

字幕下载不需要额外令牌。地址通常具有缓存响应头，具体缓存时间由服务端控制。

## 4. IINA 1.5.0 调用方式

IINA 1.5.0 的插件仍使用 `Info.json` 加 JavaScript 入口文件。官方插件接口提供 `iina.http.get()` 和 `iina.http.download()`。

### 4.1 最小清单

```json
{
  "name": "Thunder Subtitle",
  "identifier": "com.example.thunder-subtitle",
  "version": "1.0.0",
  "description": "Search subtitles from Thunder subtitle service",
  "author": {
    "name": "作者名称"
  },
  "entry": "src/index.js",
  "permissions": ["network-request"],
  "allowedDomains": [
    "api-shoulei-ssl.xunlei.com",
    "subtitle.v.geilijiasu.com"
  ]
}
```

`network-request` 是调用 `iina.http` 必须声明的权限。`allowedDomains` 可以填写精确域名；IINA 也支持 `*.example.com` 和 `*`，但本插件不需要开放全部域名。

入口文件必须真实存在。`Info.json` 中声明的 `entry` 或 `globalEntry` 缺失时，IINA 1.5.0 会拒绝加载插件。

### 4.2 搜索示例

```js
const SEARCH_URL = "https://api-shoulei-ssl.xunlei.com/oracle/subtitle";

async function searchSubtitles(name, options = {}) {
  const response = await iina.http.get(SEARCH_URL, {
    headers: {
      "User-Agent": "xunlei",
    },
    params: {
      duration: String(options.duration ?? 0),
      gcid: options.gcid ?? "",
      name,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Thunder API HTTP ${response.statusCode}: ${response.reason}`);
  }

  const body = response.data;
  if (!body || body.code !== 0) {
    throw new Error(`Thunder API returned an error: ${JSON.stringify(body)}`);
  }

  return Array.isArray(body.data) ? body.data : [];
}

const items = await searchSubtitles("bban-428");
console.log(`found ${items.length} subtitles`);
```

IINA 的 `params` 会负责拼接和编码查询参数。不要手动把文件名直接拼接到 URL 中，尤其要避免空格、`&`、`?`、`#` 和中文字符破坏查询字符串。

### 4.3 下载到插件私有目录

```js
async function downloadSubtitle(item) {
  if (!item || typeof item.url !== "string") {
    throw new Error("Subtitle item has no download URL");
  }

  const ext = item.ext === "ass" ? "ass" : "srt";
  const path = `@data/subtitles/${item.cid}.${ext}`;
  await iina.http.download(item.url, path);
  return path;
}
```

`@data/` 是插件私有数据目录，不需要把字幕写入视频所在目录。若要写入用户选择的目录，才需要额外声明 `file-system` 权限，并使用 IINA 文件接口处理路径。

### 4.4 直接交给 mpv 加载

```js
async function loadSubtitle(item) {
  if (!item || typeof item.url !== "string") {
    throw new Error("Subtitle item has no download URL");
  }

  iina.mpv.command("sub-add", [item.url, "select", item.name || "Thunder subtitle"]);
}
```

旧插件使用的 `sub-add` 方式不需要先保存到本地。若远程字幕地址在某些网络环境下不稳定，再改为下载到 `@data/` 后加载本地文件。

### 4.5 推荐使用 IINA 字幕提供器

IINA 1.5.0 官方插件接口提供 `iina.subtitle.registerProvider()`。后续插件应优先接入 IINA 的“在线字幕”界面，而不是自行创建搜索窗口。

在 `Info.json` 中声明提供器：

```json
{
  "subtitleProviders": [
    {
      "id": "thunder-subtitle",
      "name": "Thunder Subtitle"
    }
  ]
}
```

在主入口文件中注册：

```js
const { core, http, subtitle, utils } = iina;

const SEARCH_URL = "https://api-shoulei-ssl.xunlei.com/oracle/subtitle";

function currentSearchName() {
  const source = core.status.title || core.status.url || "";
  const name = source.split(/[\\/]/).pop() || source;
  return name.replace(/\.[^./\\]+$/, "");
}

subtitle.registerProvider("thunder-subtitle", {
  search: async () => {
    const response = await http.get(SEARCH_URL, {
      headers: { "User-Agent": "xunlei" },
      params: {
        duration: "0",
        gcid: "",
        name: currentSearchName(),
      },
    });

    if (response.statusCode !== 200 || !response.data || response.data.code !== 0) {
      throw new Error(`Thunder API request failed: ${response.statusCode}`);
    }

    return (response.data.data || []).map((data) => subtitle.item(data));
  },

  description: (item) => {
    const data = item.data;
    return {
      name: data.name || "Thunder subtitle",
      left: `${data.ext || ""} ${data.languages?.join(", ") || ""}`.trim(),
      right: data.duration ? `${data.duration} ms` : "",
    };
  },

  download: async (item) => {
    const data = item.data;
    const ext = data.ext === "ass" ? "ass" : "srt";
    const dest = `@tmp/${data.cid}.${ext}`;
    await http.download(data.url, dest);
    return [utils.resolvePath(dest)];
  },
});
```

`search()` 不接收参数，当前视频信息应通过 `core.status` 获取。`subtitle.item(data)` 返回的对象会传给后续的 `description()` 和 `download()`，原始接口数据位于 `item.data`。`download()` 应返回字幕文件路径数组；使用 `@tmp/` 可以让 IINA 在用户确认后处理字幕文件。

IINA 1.5.0 官方文档还支持 `subtitle.CUSTOM_IMPLEMENTATION`，但只有需要完全自定义搜索界面时才使用。当前接口适合标准提供器模式，不需要自定义窗口。

## 5. 文件名与搜索策略

当前接口对关键词搜索有效，但搜索词质量直接影响结果排序。

推荐处理顺序：

1. 移除视频扩展名。
2. 保留剧名、季数、集数，例如 `BBAN-428`、`S01E01`。
3. 移除分辨率、编码、音频格式和发布组等噪声。
4. 先使用完整清理后的名称搜索。
5. 结果为空时，再按剧名和集数分别进行备用搜索。
6. 使用 `duration` 与视频时长比较，对候选结果排序。

对于 `bban-428.mp4`，查询 `bban-428`、`bban-428.mp4` 和 `BBAN-428` 都能返回 20 条结果。对于 `01.mp4`，查询 `01` 返回空数组，因此不能只把数字文件名直接提交给接口。

## 6. 结果筛选建议

接口没有公开完整的排序规则，插件侧可以使用以下信息进行二次排序：

- `duration` 与当前视频时长的差值；
- `languages` 是否包含目标语言；
- `ext` 是否符合播放器需求；
- `name` 是否包含 `zh-CN`、`简体`、`中文`、`en` 等标记；
- `fingerprintf_score` 是否大于其他候选项；
- `score` 是否更高。

同一视频可能返回重复字幕。处理顺序如下：

1. 按 `cid` 或下载地址去除完全相同的资源。
2. 文件名本身是内容哈希时，相同哈希名可以视为相同内容。
3. 普通文件名相同也必须保留，因为同名资源可能对应不同翻译或不同时间轴。
4. 文件名末尾的 `(1)`、`[1]` 等副本编号不能作为重复依据。

## 7. 已知限制

- 接口没有公开正式文档，字段含义和服务端行为可能变化。
- `code=0` 只表示请求处理成功，不代表一定有字幕。
- `data` 中部分字段并不稳定，例如 `simple_name`、`mt` 和 `extra_name` 可能缺省。
- 字幕文件编码不统一，读取或转换时需要处理 BOM 和中文编码。
- 旧插件直接拼接 `name` 查询参数，二次开发时应改用 `params` 或 `encodeURIComponent`。
- 当前测试验证了公网请求和字幕内容，没有验证服务端的调用频率限制。插件应避免在每次界面输入变化时立即发送请求，并增加短时缓存和失败重试上限。

## 8. 复现测试

### 搜索

```bash
curl -G 'https://api-shoulei-ssl.xunlei.com/oracle/subtitle' \
  -A 'xunlei' \
  --data-urlencode 'duration=0' \
  --data-urlencode 'gcid=' \
  --data-urlencode 'name=bban-428'
```

### 下载

```bash
curl -L -A 'xunlei' \
  'https://subtitle.v.geilijiasu.com/C6/97/C69728F920C6E5A47DE409723334F9025F87B572.srt' \
  -o BBAN-428-zh-CN.srt
```

## 9. IINA 1.5.0 官方资料

独立封装文件：[thunder-subtitle-api.mjs](./thunder-subtitle-api.mjs)

- [IINA Plugin API](https://docs.iina.io/)
- [Getting Started](https://docs.iina.io/pages/getting-started.html)
- [Creating Plugins](https://docs.iina.io/pages/creating-plugins.html)
- [Development Guide](https://docs.iina.io/pages/dev-guide.html)
- [HTTP API](https://docs.iina.io/interfaces/IINA.API.HTTP.html)
- [IINA 1.5.0 源码](https://github.com/iina/iina/tree/v1.5.0)
