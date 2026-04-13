[中文](#中文) | [English](#english)

---

# 中文

## Zotero PDF Hand Catcher

一个 Zotero 插件——自动从当前选中的分类中查找没有 PDF 的文献条目，按顺序在隔离的 Edge 浏览器中逐条打开，并自动捕获下载结果附加回 Zotero。无权限时可跳过，全程无需在 Zotero 和浏览器之间来回切换。

### 为什么需要它？

Zotero 内置的 PDF 抓取器并非总能成功。当自动抓取失败时，用户不得不手动操作：在 Zotero 找到条目 → 右键在线查看 → 打开浏览器 → 下载 PDF → 切回 Zotero → 重新找到刚刚的文献条目并附加文件——每条文献都要重复一遍。文献量大时极其痛苦。

本插件将这个循环自动化：**你只需要专注在浏览器里点击下载按钮，其余一切由插件完成，无需来回切换页面。**

### 工作流程

1. **扫描** — 点击 Zotero 工具栏上的插件按钮，插件自动扫描当前选中分类中的所有条目，筛选出缺少 PDF 附件的文献
2. **逐条打开** — 按顺序在隔离的 Edge 浏览器中打开每条文献的 URL 或 DOI 页面（无 URL/DOI 时自动通过必应搜索标题）
3. **自动捕获** — 插件持续监控下载目录（每 1.2 秒轮询），一旦检测到新的已完成 PDF 文件（通过文件稳定性检查 + `%PDF-` 魔数验证），自动将其导入到当前 Zotero 条目中
4. **清理并跳转** — 附加成功后自动删除下载目录中的源文件，然后切换到下一条文献
5. **跳过** — 遇到无权限或无法下载的条目，点击「跳过」按钮即可继续下一条
6. **完成** — 所有条目处理完毕后，显示完成通知并自动关闭

### 核心特性

- **隔离的 Edge 浏览器环境** — 使用独立用户数据目录启动 Edge，不污染主浏览器配置；禁用扩展、同步、翻译等干扰功能；启用并行下载
- **自动复用机构认证** — 将真实 Edge 的 Cookie 数据库和加密密钥复制到隔离环境，保留校园网/机构登录状态，可直接访问订阅资源
- **智能标签页管理** — 通过 Chrome DevTools Protocol (CDP) 管理 Edge 标签页：每次打开新条目时自动关闭上一个标签页，保持浏览器整洁
- **可靠的下载检测** — 不依赖文件扩展名，而是读取文件头 5 字节验证 `%PDF-` 魔数；忽略 `.crdownload`、`.part` 等临时文件；通过连续两次轮询确认文件大小和修改时间不变来判断下载完成
- **双语界面** — 支持中文和英文

### 工作流窗口

点击工具栏中的图标即可运行；插件运行时会弹出一个小窗口，显示：

- 当前进度（如 `3/15`）和进度条
- 当前文献标题
- 操作提示
- 「跳过」和「关闭」按钮

### 系统要求

- Windows
- Zotero 7 / 8 / 9
- Microsoft Edge

### 安装

下载 [最新 Release](https://github.com/qifu04/zotero-pdf-hand-catcher/releases) 中的 `.xpi` 文件，在 Zotero 中通过 `工具 → 附加组件 → 从文件安装附加组件` 安装。

### 配置

插件提供一个可选设置项：

- **下载目录**（`extensions.zotero.pdfhandcatcher.download.dir`）— 自定义监控的下载目录。留空则使用系统默认下载目录。

### 开发

```bash
npm install
npm run build          # 类型检查 + 构建 XPI
npm run start          # 启动开发服务器
npm run typecheck      # 仅类型检查
npm run lint           # Prettier + ESLint
npm run test           # Jest 测试
```

构建产物：`build/zotero-pdf-hand-catcher.xpi`

### 许可证

`AGPL-3.0-or-later`，详见 `LICENSE`。

---

# English

## Zotero PDF Hand Catcher

A Zotero plugin that automatically finds items without PDFs in the currently selected collection, opens each one in an isolated Edge browser in order, and captures downloaded PDFs back into Zotero. Items you can't access can be skipped — no need to switch between Zotero and the browser.

### Why?

Zotero's built-in PDF fetcher doesn't always succeed. When it fails, you're stuck with a manual loop: find the item in Zotero → copy the link → open the browser → download the PDF → switch back to Zotero → attach the file — repeated for every single item. With a large library this is painful.

This plugin automates that loop: **you only need to click download in the browser; the plugin handles everything else.**

### Workflow

1. **Scan** — Click the plugin's toolbar button. It scans all items in the currently selected collection and filters out those missing PDF attachments.
2. **Open one by one** — Each item's URL or DOI page is opened in an isolated Edge browser in order (falls back to a Bing title search when no URL/DOI is available).
3. **Auto-capture** — The plugin continuously monitors the download directory (polling every 1.2s). Once a new completed PDF is detected (via file stability check + `%PDF-` magic byte verification), it is automatically imported into the current Zotero item.
4. **Clean up & advance** — After successful attachment, the source file is deleted from the download directory and the plugin moves to the next item.
5. **Skip** — For items you can't access, click the "Skip" button to move on.
6. **Done** — When all items are processed, a completion notification is shown and the window closes.

### Key Features

- **Isolated Edge browser** — Launches Edge with a separate user data directory; disables extensions, sync, translation, and other distractions; enables parallel downloading.
- **Institutional auth reuse** — Copies the real Edge cookie database and encryption key into the isolated profile, preserving campus/institutional login sessions for accessing subscription resources.
- **Smart tab management** — Uses Chrome DevTools Protocol (CDP) to manage Edge tabs: automatically closes the previous tab when navigating to a new item.
- **Reliable download detection** — Doesn't rely on file extensions; reads the first 5 bytes to verify the `%PDF-` magic number. Ignores `.crdownload`, `.part`, and other temp files. Confirms download completion by checking that file size and mtime remain stable across two consecutive polls.
- **Bilingual UI** — English and Simplified Chinese.

### Workflow Window

While running, the plugin displays a small dialog showing:

- Current progress (e.g., `3/15`) with a progress bar
- Current item title
- Status hint
- "Skip" and "Close" buttons

### Requirements

- Windows
- Zotero 7 / 8 / 9
- Microsoft Edge

### Installation

Download the `.xpi` file from the [latest Release](https://github.com/qifu04/zotero-pdf-hand-catcher/releases) and install it in Zotero via `Tools → Add-ons → Install Add-on From File`.

### Configuration

One optional setting:

- **Download directory** (`extensions.zotero.pdfhandcatcher.download.dir`) — Custom download directory to monitor. Leave empty to use the system default.

### Development

```bash
npm install
npm run build          # Type check + build XPI
npm run start          # Dev server
npm run typecheck      # Type check only
npm run lint           # Prettier + ESLint
npm run test           # Jest tests
```

Build output: `build/zotero-pdf-hand-catcher.xpi`

### License

`AGPL-3.0-or-later`. See `LICENSE`.
