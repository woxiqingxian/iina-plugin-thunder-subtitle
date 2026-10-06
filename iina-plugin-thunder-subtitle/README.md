# Thunder Subtitle for IINA

这是一个适配 IINA 1.5.0 的字幕提供器插件，调用迅雷字幕接口搜索并下载 `.srt`、`.ass` 字幕。

## 功能

- 集成 IINA 的“在线字幕”功能；
- 从当前视频路径或标题提取搜索词；
- 首次使用完整文件名搜索；
- 无结果时移除常见分辨率、编码和发布信息后重试；
- 按 `cid` 或下载地址去重；
- 将字幕下载到 IINA 的临时目录，由 IINA 继续处理。

## 目录结构

```text
iina-plugin-thunder-subtitle/
├── Info.json
├── README.md
├── sidebar.html
└── src/
    └── index.js
```

## 安装

直接使用 IINA 的插件安装功能打开本目录打包生成的 `.iinaplgz` 文件，或者将目录链接到 IINA 插件目录进行开发。

IINA 1.5.0 的命令行工具位于：

```text
/Applications/IINA.app/Contents/MacOS/iina-plugin
```

打包：

```bash
/Applications/IINA.app/Contents/MacOS/iina-plugin pack iina-plugin-thunder-subtitle
```

开发链接：

```bash
/Applications/IINA.app/Contents/MacOS/iina-plugin link iina-plugin-thunder-subtitle
```

重新加载插件后，插件会出现在 IINA 的“插件”侧栏中。字幕搜索入口位于“字幕 > 查找在线字幕…”，在来源列表中选择 `Thunder Subtitle`。

## 项目文档

仓库根目录包含以下文档：

- [项目说明](../PROJECT_OVERVIEW.md)：目录职责、运行流程和已知限制；
- [接口文档](../THUNDER_SUBTITLE_API.md)：迅雷字幕接口定义和复用示例；
- [维护规则](../AGENTS.md)：后续开发、验证和 Git 操作约束。

## 接口文档

接口定义、返回字段和复用示例见上级目录的 [THUNDER_SUBTITLE_API.md](../THUNDER_SUBTITLE_API.md)。
