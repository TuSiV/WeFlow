<p align="center">
  <img src="app.jpg" alt="WeFlow 应用预览" width="90%">
</p>

<h1 align="center">WeFlow</h1>

<p align="center">
  WeFlow 是一个<strong>完全本地</strong>的<strong>实时</strong>聊天记录查看、分析与导出工具。<br>
  它可以获取你的聊天记录并将其导出，还可以根据你的聊天记录为你生成独一无二的数据与年度报告。
</p>

<p align="center">
  <a href="https://github.com/hicccc77/WeFlow/stargazers"><img src="https://img.shields.io/github/stars/hicccc77/WeFlow?style=flat&label=Stars&labelColor=2A3B4C&color=60A5FA" alt="Stargazers"></a>
  <a href="https://github.com/hicccc77/WeFlow/network/members"><img src="https://img.shields.io/github/forks/hicccc77/WeFlow?style=flat&label=Forks&labelColor=2A3B4C&color=60A5FA" alt="Forks"></a>
  <a href="https://github.com/hicccc77/WeFlow/releases"><img src="https://img.shields.io/github/downloads/hicccc77/WeFlow/total?style=flat&label=Downloads&labelColor=2A3B4C&color=60A5FA" alt="Downloads"></a>
  <br><br>
  <a href="https://t.me/weflow_cc"><img src="https://img.shields.io/badge/Telegram-频道-60A5FA?style=flat&logo=telegram&logoColor=white&labelColor=2A3B4C&color=60A5FA" alt="Telegram Channel" style="height: 24px; vertical-align: middle;"></a>
  <a href="https://star-history.com/#hicccc77/WeFlow"><img src="https://api.star-history.com/badge?repo=hicccc77/WeFlow&theme=dark" alt="Star History Rank" style="height: 30px; vertical-align: middle;"></a>
</p>

> [!TIP]
> 本分支 `components/pinned-installer` 提供已配置原生组件的 Windows x64 / Mac Apple Silicon 桌面安装包，不需要另行设计解密组件。上方徽章、贡献者及联系方式保留原项目信息；本分支安装包请从 [TuSiV/WeFlow Releases](https://github.com/TuSiV/WeFlow/releases) 下载。

## 本分支快速入口

- 已验证发布：[5.0.1-preview.3](https://github.com/TuSiV/WeFlow/releases/tag/v5.0.1-preview.3)，同一 Release 提供 Windows EXE、Mac DMG/ZIP 与 SHA-256 校验文件。
- [使用指南](docs/USER-GUIDE.md)：安装、选择账号、密钥配置、完整聊天 PDF 与选定消息导出。
- [故障排查](docs/TROUBLESHOOTING.md)：权限拒绝、密钥不匹配、图片模板及旧数据布局。
- [组件与验证状态](docs/native-components-status.md) · [测试与发布](docs/TESTING.md) · [外部组件接口](docs/third-party-components.md) · [来源与修改说明](docs/LEGAL-PROVENANCE.md)。

本分支验证了原生组件、模拟加密数据库、HTML/PDF 导出及界面流程；未验证真实微信进程取钥成功、多年真实记录及附件的完整性。Mac 内置取钥工具不代表所有微信版本允许进程访问。


## 主要功能

- 本地实时查看聊天记录
- 朋友圈图片、视频、**实况**的预览和解密
- 统计分析与群聊画像
- 年度报告与可视化概览
- 导出聊天记录为 A4 分页 PDF、HTML 等格式，支持只导出勾选消息
- 自动扫描本机账号目录并选择，自动获取的密钥需通过所选账号验证
- HTTP API 接口（面向开发者）
- 查看完整能力清单：[详细功能](#详细功能清单)

## 支持平台与设备

| 平台 | 设备/架构 | 安装包 |
|------|----------|--------|
| Windows | Windows10+、x64 | `.exe` |
| macOS | macOS 15+、Apple Silicon（M 系列，arm64） | `.dmg`、`.zip`；ad-hoc 签名，未公证 |
| Linux | 上游有相关代码；本分支未验证随包运行 | 当前统一 Release 不提供安装包 |

Intel Mac、Windows ARM64 不在本分支已验证发布范围。支持新版 `db_storage/session` 数据布局，旧版 `Msg/MicroMsg.db` 布局会标为不支持。原有功能清单不等于本分支对所有功能做过实机验证。


## 详细功能清单

| 功能模块 | 说明 |
|---------|------|
| **聊天** | 解密聊天中的图片、视频、实况；支持**修改**本地消息 |
| **消息防撤回** | 防止其他人发送的消息被撤回 |
| **实时弹窗通知** | 新消息到达时提供桌面弹窗提醒，便于及时查看重要会话，提供黑白名单功能 |
| **私聊分析** | 统计好友间消息数量；分析消息类型与发送比例；查看消息时段分布等 |
| **群聊分析** | 查看群成员详细信息；分析群内发言排行、活跃时段和媒体内容 |
| **年度报告** | 生成按年统计的年度报告，或跨年度的长期历史报告 |
| **双人报告** | 选择指定好友，基于双方聊天记录生成专属分析报告 |
| **消息导出** | PDF、JSON、HTML、Markdown、TXT、Excel、CSV、PGSQL、ChatLab 等；可导出完整会话或仅勾选消息，缺失或歧义消息不会扩大为整段导出 |
| **朋友圈** | 解密朋友圈图片、视频、实况；导出朋友圈内容；拦截朋友圈的删除与隐藏操作； |
| **联系人** | 导出好友、群聊、公众号信息；找回部分曾经的好友 |
| **HTTP API 映射** | 将本地消息能力映射为 HTTP API，便于对接外部系统、自动化脚本与二次开发 |

## HTTP API

WeFlow 提供本地 HTTP API 服务，支持通过接口查询消息数据，可用于与其他工具集成或二次开发。

- **启用方式**：设置 → API 服务 → 启动服务
- **默认端口**：5031
- **访问地址**：`http://127.0.0.1:5031`
- **支持格式**：原始 JSON 或 [ChatLab](https://chatlab.fun/) 标准格式

完整接口文档：[点击查看](docs/HTTP-API.md)

## 面向开发者

如果你想从源码构建或为项目贡献代码，请遵循以下步骤：

```bash
# 1. 克隆项目到本地
git clone --branch components/pinned-installer https://github.com/TuSiV/WeFlow.git
cd WeFlow

# 2. 安装项目依赖
npm ci --legacy-peer-deps

# 3. 下载并校验本机对应组件（二选一，在相应系统运行）
npm run components:install -- win32-x64
# npm run components:install -- darwin-arm64

# 4. 运行应用（开发模式）
npm run dev
```

构建、原生测试、Python PDF 校验及双平台发布步骤见 [TESTING.md](docs/TESTING.md)。显式配置外部组件时，以用户配置为准；正常使用随包组件时保持路径留空。

## 推广与合作

如果您对 **WeFlow** 有兴趣，或者希望与我们展开深度合作或投放你的广告，欢迎随时通过邮件取得联系。我们非常期待与各位创作者、开发者及合作伙伴共同探索。

### 联系方式

欢迎发送邮件至：

<a href="mailto:yccccccy@proton.me"><img src="https://img.shields.io/badge/Email-yccccccy%40proton.me-60A5FA?style=flat-square&logo=proton&logoColor=white&labelColor=2A3B4C" alt="Protonmail" height="24px"></a>

## 合作伙伴

我们非常欢迎优秀的开源社区项目团队或其他团队与我们建立长期合作关系。期待与 WeFlow 携手并进，共同建设更开放的生态！

<p align="center">
  <!-- 是的你没看错这里还是占位！
  <a href="https://your-partner-website.com" target="_blank">
    <img src="https://via.placeholder.com/150x50?text=Partner+1+Logo" alt="Partner Name" width="150" style="margin: 10px; vertical-align: middle;" />
  </a> -->
</p>

---

## 贡献者

感谢所有做出贡献的开发者！

<p align="center">
  <a href="https://github.com/hicccc77/WeFlow/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=hicccc77/WeFlow" alt="Contributors" />
  </a>
</p>

## Star History

<a href="https://www.star-history.com/#hicccc77/WeFlow&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=hicccc77/WeFlow&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=hicccc77/WeFlow&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=hicccc77/WeFlow&type=date&legend=top-left" />
  </picture>
</a>

<div align="center">

---

**请负责任地使用本工具，遵守相关法律法规**

</div>
