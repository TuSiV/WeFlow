# Windows x64 原生组件与导出验证

已修复固定数据库库的到期初始化失败。Windows 实际 Electron 初始化、模拟加密会话和消息读取、模拟图片解密、实际 exportWorker 的源码 HTML 导出、类型检查、生产构建和 NSIS 打包全部通过；真实微信账号导出未验证。

验证提交：`1bc76139fa03c9fdadf397dfd3fdc010fb39d036`。[完整 Windows 检查](https://github.com/TuSiV/WeFlow/actions/runs/37912313615)与发布任务均成功。[预发布安装包](https://github.com/TuSiV/WeFlow/releases/tag/windows-wcdb-compat-37912313615)：`WeFlow-5.0.0-wcdb-compat.11-Setup.exe`，191379461 字节，SHA-256 `baa6235ddc55d9118a54e63607f11a8869491b92aba7338f47c328d9db3e213e`，同时提供 `SHA256SUMS.txt`。

## 默认组件与导出路径

- 固定组件来源为 Panther114/Weport 提交 `3b9e2afd341f0eef56d4be9dafca25c8fe8be533`。清单记录原始与派生文件的大小、Git blob SHA。
- 默认安装五个 Windows x64 文件：`wx_key.dll`、WCDB.dll、SDL2.dll、wcdb_api.dll 和图片解密 `.node`。
- 设置留空时使用已校验的随包数据库与媒体组件；密钥工具留空使用随包源码适配器。显式外部路径优先。
- 没有显式 WeLive 路径时，exportWorker 使用项目现有源码的数据库游标及格式化器。支持原有 HTML、JSON、TXT 等格式。游标打开、批次读取失败或无有效行数组时抛错，原子写入不会将部分文件当成成功导出。
- WeLive EXE 及其内置通信 DLL 报告固定日期到期。自动路径通过 runtimeBlocks 禁用，安装清单和打包过滤排除其文件；不修改、执行或发布该通信 DLL。外部可选引擎仍保留原协议与清单验证。
- 更新源指向 TuSiV/WeFlow，避免更新覆盖本分支配置。

## 数据库到期修复

2026-10-09 Windows 的完整 Electron 测试返回 `wcdb_init = -1000`，诊断为 `expired: self-destruct triggered`。修复参考 Dinnerb0ne2/WeFlow-WCDB-Patch 提交 `cbcfcf4d344d4e9c477ba9c12063594af68a5025` 的 DETAILS.md，两个指令位置经独立反汇编核对。

只接受原文件 SHA-256 `6397760da70de8062829fbe6a2ec01cf0616d6f2b334e6fe54873898f38f7ad7`。文件偏移 `0x80dc5` 将 `7e0a` 改为 `eb0a`；`0xe85d7` 将 `0f8e30010000` 改为 `e93101000090`。保持指令长度和跳转目标，不修改系统时间或账户数据库。输出 SHA-256 必须为 `1536606b1b1b2a0dc9de631a7f45504f5d466de0979e50b3f94548ae124993d0`。

安装前验证原始文件大小和 Git blob；转换后验证派生文件大小、Git blob 和 SHA-256。运行时只接受派生文件，并验证同目录依赖。此修复不是重新构建原生库，也不是对其余行为的全面审计。

## WeLive 状态

实际测试中，WeLive EXE 返回 `error: this build has expired`；随后其内部通信库返回 `native transport challenge failed with status -101`。自动审批拒绝了改写通信 DLL 的持久变更，理由为安全或授权检查弱化。该项变更未写入分支；本版本改用已有源码的直接导出流程，不加载或分发这些二进制。

## 命令

```sh
npm ci --legacy-peer-deps
npm run components:install -- win32-x64
npm run components:check -- win32-x64
npm run components:test
npm run typecheck
npx vite build
# 以下检查需要 Windows x64，且先完成上面的 build
npm run components:test:windows
npx electron-builder --win nsis --x64 --publish never
```

Windows 工作流仅在原生读取、源码 HTML 导出、类型检查、生产构建和打包全部通过后发布预发布 EXE，附 SHA-256 校验文件。

## 验证范围

模拟数据含一位假联系人和一条假文本消息，无用户记录。组件测试涵盖原始/派生哈希、幂等转换、拒绝篡改、开发/打包路径及缺少依赖。真实密钥获取、多年记录及附件的完整性仍需真实账户副本验证。

来源及第三方许可证见 resources/native-licenses/。密钥源码适配器改编自固定 Weport 提交的 keyService.ts；派生代码遵循 CC BY-NC-SA 4.0，第三方组件保留其许可证。Windows ARM64、macOS、Linux 本次仍为外部组件模式。
