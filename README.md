# iina-plugin-thunder-subtitle

这是一个面向 IINA 1.5.0 的迅雷字幕插件。插件调用迅雷字幕服务搜索候选字幕，用户选择字幕后，插件将 `.srt` 或 `.ass` 文件下载到 IINA 临时目录，再交给 IINA 加载。

## 项目内容

- `iina-plugin-thunder-subtitle/`：IINA 插件源代码和插件清单。
- `thunder-subtitle-api.mjs`：独立的 Node.js 接口封装，可脱离 IINA 测试搜索和下载流程。
- `THUNDER_SUBTITLE_API.md`：迅雷字幕接口的请求格式、响应字段和复用示例。
- `iina-plugin-thunder-subtitle-*.iinaplgz`：可导入 IINA 的插件安装包。
- `PROJECT_OVERVIEW.md`：项目结构、运行流程和已知限制。

## 使用插件

1. 在 IINA 的插件管理页面导入仓库中的 `.iinaplgz` 文件。
2. 启用 `Thunder Subtitle`，然后重新加载插件或重启 IINA。
3. 播放视频后，进入“字幕 > 查找在线字幕…”。
4. 在字幕来源中选择 `Thunder Subtitle`。

插件同时声明了一个侧栏页面。打开 IINA 主窗口的插件侧栏，可以查看插件是否已经加载。

## 开发和打包

插件入口是 `iina-plugin-thunder-subtitle/src/index.js`，清单是 `iina-plugin-thunder-subtitle/Info.json`。IINA 1.5.0 的命令行工具通常位于：

```bash
/Applications/IINA.app/Contents/MacOS/iina-plugin
```

在仓库根目录执行：

```bash
# 创建安装包
/Applications/IINA.app/Contents/MacOS/iina-plugin pack iina-plugin-thunder-subtitle

# 将源码链接到 IINA 插件目录，便于本地调试
/Applications/IINA.app/Contents/MacOS/iina-plugin link iina-plugin-thunder-subtitle
```

接口模块可以直接使用 Node.js 调用：

```js
import { searchSubtitles, downloadSubtitle } from "./thunder-subtitle-api.mjs";

const results = await searchSubtitles("bban-428");
await downloadSubtitle(results[0], "./subtitle.srt");
```

## 兼容性说明

- 当前插件按照 IINA 1.5.0 的 JavaScript 插件 API 编写。
- 迅雷字幕接口不需要登录、令牌或 Cookie，但服务端返回结果和字幕地址可能随时变化。
- 文件名为 `01.mp4`、`02.mkv` 等时，插件会尝试使用父目录名称搜索。
- 搜索成功不等于一定存在字幕；HTTP 200 且 `data` 为空表示接口可用但没有匹配结果。

接口字段和错误处理以 [THUNDER_SUBTITLE_API.md](THUNDER_SUBTITLE_API.md) 为准，维护约束以 [AGENTS.md](AGENTS.md) 为准。
