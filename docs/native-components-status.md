# Windows x64 原生组件配置与验证状态

**已加入仅匹配固定 DLL 的到期日期兼容修复。Windows 实际运行验证待完成；真实账号导出未验证。**

## 已配置

- 固定组件来源为 Panther114/Weport 提交 `3b9e2afd341f0eef56d4be9dafca25c8fe8be533`，大小及 Git blob SHA-1 记录于 `shared/native-components.json`。
- Windows x64 清单包含 WCDB、媒体解密插件、WeLive 引擎及 `wx_key.dll`，共 8 个文件。
- 数据库库、媒体插件、导出引擎在设置留空时解析随包路径；加载前检查组件及同目录依赖的完整性。显式填写的外部路径优先，不静默替换。
- 密钥工具留空时使用移植的 Windows 密钥源码适配器。仅在用户发起密钥获取时调用；指定外部工具时仍使用原协议。适配器不自动关闭或重启微信。
- 构建后的更新源指向 TuSiV/WeFlow，避免更新覆盖本分支配置。
- 下载文件不提交到 Git；Windows 构建时下载固定组件并放入安装包。
- 旧引擎未返回清单时，适配器读取实际 JSONL，验证每行 JSON、统计行数和字节数及已报告的媒体错误；拒绝导出目录外路径和读取中变化的文件。文件清单不能证明原始聊天没有漏导。

## 来源与修改

`electron/services/bundledWindowsKeyService.ts` 改编自固定来源提交的 `electron/services/keyService.ts`。修改包括：仅通过校验后的随包路径加载密钥 DLL；内联同提交的账号目录后缀处理函数；接入当前 KeyProviderService 的回退入口。历史验证注释属于上游记录，不代表本分支已验证真实账号。

原作者为 cc / hicccc77 和 WeFlow contributors；Weport 修改作者为 Panther114 和 Weport contributors。随包保存来源的 LICENSE、NOTICE、THIRD-PARTY-NOTICES，以及 WCDB、SDL2、Koffi 许可证，见 `resources/native-licenses/`。派生源码遵循 CC BY-NC-SA 4.0；第三方组件保留各自许可证。

## 命令

```sh
npm ci --legacy-peer-deps
npm run components:install -- win32-x64
npm run components:check -- win32-x64
npm run components:test
npm run typecheck
# 以下命令需要 Windows x64
npm run components:test:windows
npx vite build
npx electron-builder --win nsis --x64 --publish never
```

使用已有锁文件。`--legacy-peer-deps` 解决 ansi-to-react 等依赖与 React 19 的 peer 范围冲突，不代表这些依赖的运行行为已验证。

## 验证层级

- 文件完整性：已验证 8 个 Windows x64 组件。
- 路径与加载前校验：开发路径、打包路径、不支持的平台、依赖被修改、文件缺失场景检查通过。
- 类型检查和 Vite 构建：本地通过。
- Windows 原生运行：由 Windows native configuration check 工作流测试 WCDB 初始化、密钥 DLL 符号、模拟图片解密及 WeLive 缺失数据库的 NDJSON 失败响应；通过后构建测试 EXE，保存为 Actions artifact。
- 真实聊天导出：尚未验证。模拟测试不证明密钥正确、消息和附件完整或多年记录导出可用。

通过 Windows 组件测试和打包后可提供预发布安装包。真实聊天应先在数据库副本上导出，核对消息数量、发送人、时间及图片附件。

## 到期日期修复及验证限制

2026-10-09 的 Windows x64 完整 Electron 应用测试实际返回 `wcdb_init = -1000`，诊断日志为 `wcdb_init [SecurityStatus:0]` 和 `expired: self-destruct triggered`。测试在创建或打开任何聊天数据库之前停止，没有证明或观察到数据库被修改。日志证明该测试环境下初始化失败并报告过期；不能据此推断对所有用户的行为。

修复参考 Dinnerb0ne2/WeFlow-WCDB-Patch 的 DETAILS.md，两个分支经本分支反汇编独立核对。只接受原文件 SHA-256 `6397760da70de8062829fbe6a2ec01cf0616d6f2b334e6fe54873898f38f7ad7`，在文件偏移 `0x80dc5` 将 `7e0a` 改为 `eb0a`，在 `0xe85d7` 将 `0f8e30010000` 改为 `e93101000090`。保持长度及跳转目标不变，不调整系统时间。输出 SHA-256 必须为 `1536606b1b1b2a0dc9de631a7f45504f5d466de0979e50b3f94548ae124993d0`。

安装脚本先验证固定来源原始文件的大小及 Git blob，再应用转换，最后验证派生文件的大小、Git blob 和 SHA-256。运行时只接受派生文件；过期原文件不能通过运行时校验。不修改用户提供的外部 DLL 或聊天数据库。此修复没有重建原生库，也不代表对库内其余行为完成审计。
WCDB 二进制仍包含 `api.weflow.top`、`expired: self-destruct triggered`、`??DATA_CORRUPTED_BY_PIRACY_PROTECTION??` 字符串。配置适配未消除或审计这些行为，文件哈希不证明行为安全。当前没有该包装库和引擎的可重建源码，不能宣称已得到可审计、只读的证据提取实现。

Windows ARM64、macOS、Linux 仍为外部组件模式，本次没有补齐其自动密钥获取链路。
