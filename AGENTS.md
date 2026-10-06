# AGENTS.md

本文档供后续维护这个项目的开发者和代码代理使用。

## 项目边界

这是一个 IINA 1.5.0 JavaScript 插件项目，同时包含一份独立的迅雷字幕接口封装。修改插件时，优先保持 IINA 官方插件 API 的调用方式，不要把 Node.js 专用 API 引入 `iina-plugin-thunder-subtitle/src/index.js`。

## 关键文件

- `iina-plugin-thunder-subtitle/Info.json`：插件清单、权限、侧栏和字幕来源声明。
- `iina-plugin-thunder-subtitle/src/index.js`：IINA 运行时代码。
- `iina-plugin-thunder-subtitle/sidebar.html`：插件侧栏页面。
- `thunder-subtitle-api.mjs`：Node.js 接口封装。
- `THUNDER_SUBTITLE_API.md`：接口文档。
- `PROJECT_OVERVIEW.md`：项目结构和运行流程。
- `iina-plugin-thunder-subtitle-*.iinaplgz`：可发布的安装包。

## 修改规则

1. 修改搜索参数、响应解析或下载逻辑时，同时更新 `thunder-subtitle-api.mjs`、插件入口和 `THUNDER_SUBTITLE_API.md`。
2. 只向 `api-shoulei-ssl.xunlei.com` 发起搜索请求，只从 `subtitle.v.geilijiasu.com` 下载字幕，除非同时更新清单权限和安全校验。
3. 保留 `response.statusCode`、响应体 `code` 和 `data` 的分层检查。HTTP 200 但 `data` 为空是正常的无结果状态，不应当当成接口异常。
4. 保留 `cid` 或 URL 去重，避免 IINA 字幕选择窗口显示重复条目。
5. 修改 `Info.json` 的 `identifier` 时，必须同步考虑 IINA 已安装目录中的旧插件和用户偏好键 `PluginEnabled.<identifier>`。
6. 不要提交真实账号、Cookie、令牌、个人路径下的临时文件或下载得到的字幕内容。
7. 生成的 `.iinaplgz` 必须来自当前源码，不能继续发布包含旧 `Info.json` 或旧入口脚本的安装包。

## 本地验证

在具备 Node.js 的环境中执行：

```bash
node --check iina-plugin-thunder-subtitle/src/index.js
node --check thunder-subtitle-api.mjs
```

验证清单和安装包：

```bash
python3 -m json.tool iina-plugin-thunder-subtitle/Info.json >/dev/null
unzip -t iina-plugin-thunder-subtitle-*.iinaplgz
```

接口联调需要网络访问；不要把一次网络失败直接判断为代码错误，应记录 HTTP 状态、响应体和测试时间。

## IINA 调试要点

- 安装新包后，需要在 IINA 中重新加载插件或重启 IINA。
- “插件”侧栏是否显示由 `Info.json` 的 `sidebarTab` 决定。
- 在线字幕来源是否显示由 `subtitleProviders` 和插件启用状态决定。
- 插件入口执行于 IINA JavaScriptCore 环境，使用 `iina.*` API，不要假设存在 `process`、`require`、文件系统模块或 Node.js 全局变量。

## Git 工作流

- 默认分支以远程仓库实际配置为准，不要凭空创建分支名。
- 提交前检查 `git status`、`git diff` 和安装包内容。
- 提交信息应说明实际变更，例如 `docs: document plugin architecture` 或 `fix: expose subtitle plugin sidebar`。
- 推送前确认远程地址为 `git@github.com:woxiqingxian/iina-plugin-thunder-subtitle.git`，避免推送到其他仓库。
- 不要使用 `git reset --hard`、`git clean -fd` 等会丢失用户修改的命令。
