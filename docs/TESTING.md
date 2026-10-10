# 测试与统一发布

## 已验证快照

代码提交：`48707a28fa5dce6925ecbffca15114ac53825337`。

- [完整双平台运行记录](https://github.com/TuSiV/WeFlow/actions/runs/38035598988)：Windows x64、Mac arm64 和统一发布任务均成功。
- [已发布版本 5.0.1-preview.3](https://github.com/TuSiV/WeFlow/releases/tag/v5.0.1-preview.3)：EXE、DMG、ZIP、`SHA256SUMS.txt`。

后续文档提交不改变此已测试代码快照；文档提交本身不能被标为又一次原生测试。后续代码版本以各自 Actions 和 Release 为准。

## 验证层次

| 范围 | 运行方式与证据 | 不证明什么 |
| --- | --- | --- |
| 文件及源码逻辑 | 哈希、篡改／缺失拒绝、目录发现、游标失败、精确消息选择、缓存推导测试 | 真实微信进程兼容性 |
| 原生数据库与图片 | 实际 Electron ABI、固定原生库、模拟加密库和图片文件 | 真实多年数据及所有媒体覆盖 |
| PDF 与界面 | 620 条消息跨 52 页核对、仅选首尾两条、真实 worker→主进程渲染、缺失消息失败清理、实际 React 组件 | 真实账号全部记录准确、全部界面功能验收 |
| Mac 密钥工具 | 实际库符号加载、两个真实辅助程序拒绝无效 PID；模拟捕获结果在真实加密测试库验证，模拟授权取消／重试 | 从真实微信进程取得密钥、真实管理员弹窗操作成功 |
| Mac 安装包 | 包内原生文件／字体／代码一致性、针对包内资源重跑、深度严格签名检查 | Apple 公证或所有用户系统都允许启动 |

PDF 的消息标记逐条核对，中文采用 NFKC 兼容规范化比较；详见 [故障排查](TROUBLESHOOTING.md)。

## 本机命令

使用 Node.js 24（与 CI 一致），在相应系统及架构执行。`components:install` 下载固定来源文件；源仓库未提交这些二进制，离线首次安装无法完成下载。

Windows x64：

```powershell
npm ci --legacy-peer-deps
npm run components:install -- win32-x64
npm run components:check -- win32-x64
npm run typecheck
node scripts/clean-dist-electron.cjs
npx vite build
python -m pip install pypdf
npm run components:test
npm run components:test:windows
npx electron-builder --win nsis --x64 --publish never
```

Mac arm64（macOS 15+）：

```sh
npm ci --legacy-peer-deps
npm run components:install -- darwin-arm64
npm run components:check -- darwin-arm64
npm run typecheck
node scripts/clean-dist-electron.cjs
npx vite build
python3 -m pip install --break-system-packages pypdf
npm run components:test:shared
npm run components:test:macos
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dmg zip --arm64 --publish never
node scripts/check-packaged-macos.cjs
codesign --verify --deep --strict release/mac-arm64/WeFlow.app
```

上述 Python 安装参数复现 CI；本地管理的 Python 环境可先创建虚拟环境并在其中安装 `pypdf`，不必使用 `--break-system-packages`。原生检查要求对应平台，不能在 Linux 上把文件哈希通过当成 Windows/Mac 运行通过。Mac 检查会准备临时 WeFlow Electron 宿主、保留断言完成标记和正常退出检查，结束后由父进程清理模拟数据。

## 发布门槛

`.github/workflows/desktop-release.yml` 在本分支 push 或手动触发后运行两个平台任务；两个任务全部成功才能进入发布任务。共同版本为 `5.0.1-preview.<运行序号>`，三个安装包必须齐全。

发布任务计算并复核 SHA-256，创建草稿、上传三个安装包与校验文件，确认四个附件后公开同一个预发布 Release。平台文件名包含 Windows x64 或 macOS arm64。手动单平台检查工作流不再独立发布；旧的标签构建工作流属于另一路径，不是本分支此次已验证的发布流程。

纯文档修改使用提交信息 `[skip ci]`，避免生成只有文档差异的新安装包；需要新二进制时，按上述完整发布流程执行。
