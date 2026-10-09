# 原生组件安装与当前阻碍

本次增加固定版本的组件清单、下载脚本及文件完整性检查。**尚未补齐可验证、兼容的完整导出链路，安装成功不等于可导出。** 不修改已有的组件配置，不自动加载下载的库，也不执行下载的可执行文件。

## 来源

- 来源：Panther114/Weport，固定提交 `3b9e2afd341f0eef56d4be9dafca25c8fe8be533`。
- 清单：`shared/native-components.json`，记录路径、文件大小和 Git blob SHA-1。
- 来源许可证及第三方声明：该提交下的 `LICENSE`、`NOTICE.md`、`THIRD-PARTY-NOTICES.md`、`LICENSES/`。
- 下载的原生文件不提交、不重新分发到本仓库。Git blob 校验确认文件与固定提交一致，不能证明其行为安全。

## 下载及校验（Node.js 22+）

```sh
npm run components:install -- win32-x64
npm run components:check -- win32-x64
```

也支持 `win32-arm64`、`darwin-arm64`、`linux-x64`。仅 Windows x64 的下载和校验在本次环境完成验证；其余平台未实测。

脚本只下载、检查文件，不自动运行、不填入应用设置，也不获取微信密钥。应用仍需按原有文档配置组件。

## 未解决的问题

1. **WCDB 实现**：Windows x64 的 `wcdb_api.dll` 包含 `api.weflow.top` 地址、`expired: self-destruct triggered`、`??DATA_CORRUPTED_BY_PIRACY_PROTECTION??` 字符串。字符串仅为静态发现，不能证明上报内容或破坏行为；也不能证明到期时间。未运行或审计该库，不能据此认定可以用于原始证据库。
2. **WeLive 协议**：当前 WeFlow 使用 `weflow-export` 子命令及 NDJSON 请求/响应。下载的历史引擎未完成协议兼容验证，不能保证适配。
3. **密钥获取**：当前 `keyProviderService.ts` 要求一个接受 JSON 请求的外部可执行程序。历史 `wx_key.dll` 并不是该协议的可执行程序，不能直接填入该配置。本次未提供密钥获取适配器。已知数据库密钥可按原界面手动输入。
4. **媒体插件**：已取得 `.node` 文件，但未在 Windows/Electron 环境验证加载与图片解密。

需要取得可审计、适配当前接口的 WCDB 实现和导出引擎（或从源码重新实现），再进行真实账号的只读副本导出验证。当前改动不宣称已具备完整导出能力。
