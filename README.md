[中文](#中文) | [English](#english)

---

# 中文

## Zotero PDF Hand Catcher

一个 Zotero 插件——自动从当前选中的分类中查找没有 PDF 的文献条目，按顺序在隔离的 Edge 浏览器中逐条打开对应页面。**你只需在浏览器中找到 PDF 下载按钮并点击下载**，插件会自动捕获下载结果、附加回 Zotero、清理源文件，然后跳转到下一条。无权限时可跳过。

### 为什么需要它？

Zotero 内置的 PDF 抓取器并非总能成功。当自动抓取失败时，用户不得不手动操作：在 Zotero 找到条目 → 右键在线查看 → 打开浏览器 → 下载 PDF → 切回 Zotero → 重新找到刚刚的文献条目并附加文件——每条文献都要重复一遍。文献量大时极其痛苦。

本插件将这个循环自动化：**除了在浏览器页面上找到下载按钮并点击下载，其余一切由插件完成。**

### 工作流程

> **你需要做的** 用 `👤` 标出，**插件自动完成的** 用 `🤖` 标出。

1. 👤 在 Zotero 中选中一个分类（collection），点击工具栏上的插件按钮
2. 🤖 插件自动扫描该分类下所有条目，筛选出缺少 PDF 附件的文献
3. 🤖 在隔离的 Edge 浏览器中自动打开第一条文献的来源页面（URL / DOI，无则必应搜索标题）
4. **👤 你在浏览器中找到这篇文献的 PDF 下载按钮，点击下载到下载目录**
5. 🤖 插件持续监控下载目录（每 1.2 秒轮询）；一旦检测到新的已完成 PDF（文件大小稳定 + `%PDF-` 魔数验证），自动将其导入当前 Zotero 条目
6. 🤖 附加成功后，自动删除下载目录中的源文件，并在浏览器中打开下一条文献的页面
7. 👤 如果当前文献无权限访问或找不到下载入口，点击工作流窗口中的「跳过」按钮
8. 🤖 重复步骤 4-7，直到所有缺失条目处理完毕，显示完成通知并自动关闭

**简单来说：你只负责"找到下载按钮 → 点击下载"，插件负责剩下的一切。**

### 核心特性

- **干净隔离的 Edge 环境** — 使用独立的用户数据目录启动 Edge，与系统主浏览器完全隔离，不复制任何已有 Cookie 或登录状态；会话期间 Cookie 正常保存，登录一次机构账号后续条目保持登录；禁用扩展、同步、翻译等干扰功能；启用并行下载
- **智能标签页管理** — 通过 Chrome DevTools Protocol (CDP) 管理 Edge 标签页：每次打开新条目时自动关闭上一个标签页，保持浏览器整洁
- **可靠的下载检测** — 不依赖文件扩展名，而是读取文件头 5 字节验证 `%PDF-` 魔数；忽略 `.crdownload`、`.part` 等临时文件；通过连续两次轮询确认文件大小和修改时间不变来判断下载完成
- **双语界面** — 支持中文和英文

### 工作流窗口

插件运行时会弹出一个小窗口，始终显示当前状态：

- 当前进度（如 `3/15`）和进度条
- 当前文献标题
- 操作提示
- 「跳过」— 跳过当前条目，打开下一条
- 「关闭」— 终止整个流程

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

A Zotero plugin that automatically finds items without PDFs in the currently selected collection and opens each one in an isolated Edge browser. **You just find the PDF download button on the page and click download** — the plugin captures the result, attaches it to Zotero, cleans up, and moves to the next item. Inaccessible items can be skipped.

### Why?

Zotero's built-in PDF fetcher doesn't always succeed. When it fails, you're stuck with a manual loop: find the item in Zotero → copy the link → open the browser → download the PDF → switch back to Zotero → attach the file — repeated for every single item. With a large library this is painful.

This plugin automates that loop: **apart from finding the download button and clicking it, the plugin handles everything else.**

### Workflow

> Steps **you** perform are marked with `👤`, steps the **plugin** handles automatically are marked with `🤖`.

1. 👤 Select a collection in Zotero and click the plugin's toolbar button
2. 🤖 The plugin scans all items in the collection and filters out those missing PDF attachments
3. 🤖 Opens the first item's source page in an isolated Edge browser (URL / DOI, or Bing title search as fallback)
4. **👤 You find the PDF download button on the page and download the PDF to your downloads folder**
5. 🤖 The plugin monitors the download directory (polling every 1.2s); once a new completed PDF is detected (file size stable + `%PDF-` magic byte verification), it is automatically imported into the current Zotero item
6. 🤖 After successful attachment, the source file is deleted from the download directory and the next item's page is opened in the browser
7. 👤 If you can't access the current paper or can't find a download link, click the "Skip" button in the workflow window
8. 🤖 Repeats steps 4-7 until all missing items are processed, then shows a completion notification and closes

**In short: you only do "find the download button → click download". The plugin does everything else.**

### Key Features

- **Clean isolated Edge** — Launches Edge with a separate user data directory, fully isolated from your main browser — no existing cookies or login state are copied. Cookies are saved normally during the session, so once you log in to an institutional account it stays active for subsequent items. Disables extensions, sync, translation, and other distractions; enables parallel downloading
- **Smart tab management** — Uses Chrome DevTools Protocol (CDP) to manage Edge tabs: automatically closes the previous tab when navigating to a new item
- **Reliable download detection** — Doesn't rely on file extensions; reads the first 5 bytes to verify the `%PDF-` magic number. Ignores `.crdownload`, `.part`, and other temp files. Confirms download completion by checking that file size and mtime remain stable across two consecutive polls
- **Bilingual UI** — English and Simplified Chinese

### Workflow Window

While running, the plugin displays a small dialog showing current status:

- Current progress (e.g., `3/15`) with a progress bar
- Current item title
- Status hint
- "Skip" — skip the current item, open the next one
- "Close" — terminate the entire workflow

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
