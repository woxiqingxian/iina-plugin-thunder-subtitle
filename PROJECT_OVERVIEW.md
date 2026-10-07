# 项目说明

## 目标

本项目将已经验证可用的迅雷字幕接口封装成 IINA 1.5.0 插件，用于从正在播放的视频名称搜索字幕，并在 IINA 的在线字幕流程中下载和加载字幕。

## 运行流程

```text
当前视频路径或标题
        |
        v
提取文件名、父目录名和候选搜索词
        |
        v
GET api-shoulei-ssl.xunlei.com/oracle/subtitle
        |
        v
返回字幕候选项（cid、url、ext、name 等）
        |
        v
用户在 IINA 在线字幕窗口中选择候选项
        |
        v
GET subtitle.v.geilijiasu.com/...srt 或 ...ass
        |
        v
下载到 IINA @tmp/，交给 IINA 加载
```

## 目录说明

### `iina-plugin-thunder-subtitle/Info.json`

插件元数据和权限声明：

- `entry` 指向 JavaScript 入口。
- `permissions` 声明网络请求权限。
- `allowedDomains` 限制可以访问的域名。
- `sidebarTab` 让插件出现在 IINA 插件侧栏。
- `subtitleProviders` 将提供器注册到 IINA 在线字幕来源列表。

### `iina-plugin-thunder-subtitle/src/index.js`

插件运行代码，负责：

- 从 `iina.core.status` 读取当前文件信息。
- 生成完整文件名和去除发布信息后的候选搜索词。
- 调用迅雷搜索接口并检查 HTTP 状态和业务 `code`。
- 按 `cid`、URL 或完全相同的内容哈希文件名去重；保留普通同名字幕。
- 从文件名和接口字段识别简体中文、繁体中文、英文、日文和韩文，用于列表展示和排序。
- 对名称完全相同但内容标识不同的字幕显示“版本 1/2”等编号，不删除候选项。
- 校验字幕下载地址只来自允许的字幕域名。
- 将字幕下载到 `@tmp/thunder-subtitle-<cid>.<ext>`。

### `thunder-subtitle-api.mjs`

独立 Node.js 封装，用于在不启动 IINA 的情况下验证接口。它不是插件运行时依赖，修改接口逻辑时应先在这里验证，再同步到插件入口。

### `THUNDER_SUBTITLE_API.md`

接口复用文档，记录请求参数、响应结构、下载地址、错误处理和已经完成的测试。接口行为变化时应同步更新测试日期和示例。

## 已验证行为

- 查询 `bban-428` 可以返回字幕候选项。
- 返回的 `.srt` 字幕地址可以正常下载。
- `01.mp4` 这类无意义文件名会回退到父目录名称搜索。
- 插件通过 IINA 1.5.0 的 `iina.subtitle.registerProvider()` 注册在线字幕提供器。

## 已知限制

- 迅雷接口没有公开稳定的版本承诺，不能假设字段永久不变。
- 部分字幕的 `languages` 为空，界面展示时需要允许缺省语言。
- 下载地址由服务端返回，插件必须继续执行域名校验，不能为了兼容性直接放开到任意域名。
- 插件侧栏用于确认加载状态和显示使用入口；实际搜索仍然从 IINA 的在线字幕窗口执行。
