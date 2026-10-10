# 双平台原生组件与导出验证

## 当前已验证发布（2026-10-10）

[5.0.1-preview.3](https://github.com/TuSiV/WeFlow/releases/tag/v5.0.1-preview.3) 使用代码提交 `48707a28fa5dce6925ecbffca15114ac53825337`。[双平台检查与统一发布](https://github.com/TuSiV/WeFlow/actions/runs/38035598988)全部成功：Windows EXE、Mac DMG/ZIP 与 SHA-256 校验文件在同一个 Release。后续文档更新不等于重新验证二进制。

| 平台 | 固定随包组件 | 已验证范围 |
| --- | --- | --- |
| Windows x64 | 密钥 DLL、WCDB.dll、SDL2.dll、API DLL、图片 `.node`（5 个文件） | Windows 10+；实际 Electron、加密测试库、图片、HTML/PDF、React 及 NSIS |
| Mac arm64 | WCDB 与 API dylib、图片 `.node`、密钥 dylib、数据库／图片辅助程序（6 个文件） | macOS 15+、M 系列；原生运行、辅助程序无效 PID 拒绝、模拟取钥验证、导出、包内资源／签名检查；未公证 |

Intel Mac、Windows ARM64、Linux 不在当前已验证随包发布范围。真实微信取钥、多年记录及附件完整性未验证；模拟授权流程不等于真实系统弹窗操作已验证。

操作见 [使用指南](USER-GUIDE.md)，排错见 [故障排查](TROUBLESHOOTING.md)，命令、流程及验证层次见 [TESTING.md](TESTING.md)。

## 历史 Windows 验证基线

以下 `5.0.0-wcdb-compat.18` 及其提交／校验值保留历史记录，不是当前推荐下载版本。

已修复固定数据库库的到期初始化失败。Windows 实际 Electron 初始化、模拟加密会话和消息读取、模拟图片解密、实际 exportWorker 的源码 HTML/PDF 导出、精确消息选择、完整分页、实际 React 导出配置与账号选择、类型检查、生产构建和 NSIS 打包全部通过；真实微信账号导出未验证。

验证提交：`9f539b8f229c6ab0c8fea42d7524776f603feb7b`。[完整 Windows 检查](https://github.com/TuSiV/WeFlow/actions/runs/38018935630)已通过。[预发布安装包](https://github.com/TuSiV/WeFlow/releases/tag/windows-wcdb-compat-38018935630)：`WeFlow-5.0.0-wcdb-compat.18-Setup.exe`，191380506 字节，SHA-256 `e492a1c87e8f00287064bdcfb4b92885719749fb611664622274c6b594e34d0c`，同时提供 `SHA256SUMS.txt`。

## PDF 与选定消息导出

导出配置新增 PDF，直接生成 A4 分页文档，使用完整静态内容而非虚拟滚动。保留消息时间、正文与图片；语音/视频提供文字标识、可用封面及现有附件导出设置，PDF 不播放音视频。

聊天页右键“多选”后勾选消息，底部“导出选定消息”打开配置，默认 PDF，也可切换已有格式。只导出所选标识，忽略全局时间范围，同名保留副本。标识缺失、来源不符、消息已删除或歧义时失败，不扩大导出范围。数据库来源缺失时必须有完整服务器消息 ID 匹配。

Windows 实测：620 条消息跨 52 页逐条提取核验，中文文本保留；仅选首尾两条的 PDF 排除中间消息；实际加密数据库经 exportWorker 和 Electron 主进程生成 PDF；缺失消息拒绝及临时文件清理；实际 React 的 PDF 默认选择、HTML 切换与提交。测试主机在隐藏窗口关闭后保持运行，并由父进程要求全套断言完成标记，避免提前退出被误判为通过。

## 账号自动扫描与选择

引导页在数据库目录和密钥步骤扫描已选目录，未填写目录时扫描系统文档下常见微信数据根目录；可从客户端可读配置发现自定义存储路径，或通过“浏览”显式指定目录。只遍历账号层级及已知容器，不全盘递归；按非空 session.db 判断新版账号，不依赖 wxid/accountId 前缀。支持直接选账号目录，保留完整目录名及后缀，优先精确解析所选目录。旧版 Msg/MicroMsg.db 单独标记不可连接。

选择后填写根目录和账号 ID；切换账号清除数据库/图片密钥。自动获取密钥后使用所选账号进行连接校验，未通过不保存密钥，也不接受外部服务返回其他 ID 覆盖选择。账号目录列表不代表当前微信登录状态，昵称和头像不作未解密猜测。手动输入仍保留。

文件系统扫描测试及 Windows 实际 React 页面交互测试均通过，后者以假账号和模拟密钥接口验证回填、切换清空、错误密钥拒绝与空结果提示；真实账号获取仍未验证。新版已完成 NSIS 打包并发布，下载链接和校验值见上方。

## 默认组件与导出路径

- 固定组件来源为 Panther114/Weport 提交 `3b9e2afd341f0eef56d4be9dafca25c8fe8be533`。清单记录原始与派生文件的大小、Git blob SHA。
- 默认安装五个 Windows x64 文件：`wx_key.dll`、WCDB.dll、SDL2.dll、wcdb_api.dll 和图片解密 `.node`。
- 设置留空时使用已校验的随包数据库与媒体组件；密钥工具留空使用随包源码适配器。显式外部路径优先。
- 没有显式 WeLive 路径时，exportWorker 使用项目现有源码的数据库游标及格式化器。支持 PDF、HTML、JSON、TXT 等格式及按消息标识精确导出。游标打开、批次读取失败或无有效行数组时抛错，原子写入不会将部分文件当成成功导出。
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

上述为 Windows 本机检查命令。当前 `desktop-release.yml` 等待双平台全部成功，校验三个安装包后一次性公开预发布版本；单平台工作流仅保留手动检查。Mac 命令和双平台门槛见 [TESTING.md](TESTING.md)。

## 验证范围

模拟数据含一位假联系人和一条假文本消息，无用户记录。组件测试涵盖原始/派生哈希、幂等转换、拒绝篡改、开发/打包路径及缺少依赖。真实密钥获取、多年记录及附件的完整性仍需真实账户副本验证。

来源及第三方许可证见 resources/native-licenses/。密钥源码适配器改编自固定 Weport 提交的 keyService.ts；派生代码遵循 CC BY-NC-SA 4.0，第三方组件保留其许可证。Windows ARM64、Linux 仍为外部组件模式。Mac Apple Silicon 的数据库/图片解密和密钥辅助程序已加入固定组件安装与完整性校验。

## Mac 内置密钥获取

新增 `bundledMacKeyService.ts`：外部工具显式配置仍优先，否则使用随包 `xkey_helper`；仅针对唯一微信主进程，候选密钥必须通过所选账号数据库验证。权限拒绝可取消或选择系统授权重试一次；不改 SIP、微信签名或系统调试设置。图片优先从所选账号 kvcomm 缓存推导并用 V2 图片模板验证，不返回无模板猜测结果。原生工具和许可证来源固定，具体微信版本取钥成功不能由 CI 模拟数据推断。

最新 Mac CI 实际加载密钥库符号、执行两个辅助程序拒绝无效 PID；模拟捕获结果通过实际加密库验证，并拒绝错误密钥／账号，覆盖授权取消及一次重试。打包后重跑同类检查；没有附加真实微信进程。

## Mac 日期兼容及 PDF 字体

固定 Mac API 库在 CI 中返回到期初始化失败；仅转换已知输入的两条日期分支、保持跳转目标，更新相关代码页的既有 ad-hoc 签名哈希。宿主与数据库密钥检查保留，错误密钥拒绝测试通过。哈希和范围见 [Mac 修改说明](../resources/native-licenses/WCDB-MACOS-DATE-COMPAT-NOTICE.md)。

PDF 使用随包 Noto 字体，避开本次 Mac 系统字体导致正文不可提取的结果。CJK 兼容字符的核对范围见 [TESTING.md](TESTING.md)，不保证所有阅读器精确搜索行为一致。
