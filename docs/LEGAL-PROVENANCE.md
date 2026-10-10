# 本分支来源与修改清单

这是一份来源索引，不替代各组件许可证，也不是对所有依赖授权情况的完整审计。原项目作者、项目名称及历史归属保留，不因本分支打包或文档整理而改写。

## 代码与固定组件来源

| 项目／文件 | 本分支用途与记录 |
| --- | --- |
| [WeFlow 原项目](https://github.com/hicccc77/WeFlow) | 桌面应用主体；README 原作者信息、贡献者及项目标识保留 |
| [Weport 固定提交](https://github.com/Panther114/Weport/tree/3b9e2afd341f0eef56d4be9dafca25c8fe8be533) | Windows/Mac 原生组件、密钥适配逻辑的固定来源；文件大小和 Git blob SHA 见 [清单](../shared/native-components.json) |
| [Windows 密钥适配器](../electron/services/bundledWindowsKeyService.ts) | 按文件头记录改编固定 Weport 来源；数据库／图片取钥及账号范围处理 |
| [Mac 密钥适配器](../electron/services/bundledMacKeyService.ts)、[缓存逻辑](../electron/services/macKeySupport.ts) | 辅助程序协议、缓存目录和推导规则来源及修改见 [Mac 密钥说明](../resources/native-licenses/MACOS-KEY-NOTICE.md) |
| WCDB 包装库日期兼容转换 | 已知输入哈希、限定指令位置、完整输出验证；分别见 [Windows 修改说明](../resources/native-licenses/WCDB-DATE-COMPAT-NOTICE.md) 和 [Mac 修改说明](../resources/native-licenses/WCDB-MACOS-DATE-COMPAT-NOTICE.md) |
| Noto Serif SC 字体 | 随包 PDF 字体；[OFL 许可证](../resources/native-licenses/NotoSerifSC-OFL.txt)；未因打包变更字体文件 |

## 许可证文件与历史说明

- [固定来源许可证](../resources/native-licenses/LICENSE)、[上游归属声明](../resources/native-licenses/NOTICE.md)、[上游第三方清单](../resources/native-licenses/THIRD-PARTY-NOTICES.md) 保留上游历史说明。
- 本分支已有组件许可证副本：[WCDB](../resources/native-licenses/WCDB.txt)、[SDL](../resources/native-licenses/SDL-zlib.txt)、[Koffi](../resources/native-licenses/koffi-MIT.txt)。
- 上游声明中 `LICENSES/...`、`resources/host/...` 及 Weport 功能描述属于其原始布局，不能据此推定本分支存在相同文件或分发所有组件。npm 依赖的原始许可证位于各自安装模块；依赖锁定见 [package-lock.json](../package-lock.json)。
- 本分支默认不安装或分发 WeLive 通信引擎；不能把保留的上游清单理解为本分支安装包实际包含 WeLive。

## 本轮功能与发布修改

本分支新增固定组件下载／校验及运行时解析、日期兼容转换、账号扫描选择、完整静态 PDF、选定消息精确导出、Mac 密钥工具接入和双平台统一发布。来源归属不因这些修改而变为本分支原创。

实现与验证范围见 [组件状态](native-components-status.md) 和 [测试说明](TESTING.md)。已发布代码快照为 `48707a28fa5dce6925ecbffca15114ac53825337`；真实账号取钥与多年记录完整性未被模拟测试证明。
