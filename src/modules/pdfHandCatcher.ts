import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  attachPdfToItem,
  countPdfAttachments,
  currentViewFilesEditable,
  debug,
  directoryExists,
  ensureDir,
  findEdgePath,
  getBestSourceURL,
  getDownloadDir,
  getTempDir,
  getVisibleRegularItems,
  hasActiveView,
  killProcess,
  launchProcess,
  showAlert,
} from "../utils/zotero";

const TOOLBAR_BUTTON_ID = `${config.addonRef}-tb-scan-current-view`;
const WORKFLOW_WINDOW_URL = `chrome://${config.addonRef}/content/pdfHandCatcherWorkflow.xhtml`;
const WORKFLOW_WINDOW_NAME = `${config.addonRef}-workflow-window`;
const DOWNLOAD_POLL_MS = 1200;
const BING_SEARCH_URL = "https://cn.bing.com/search";

type WorkflowWindow = Window & {
  sizeToContent?: () => void;
};

type ObservedDownload = {
  size: number;
  mtime: number;
  stableRounds: number;
};

// ─── Toolbar button ──────────────────────────────────────────────

export function registerToolbarButton(win: Window) {
  win.document.getElementById(TOOLBAR_BUTTON_ID)?.remove();

  const toolbar = win.document.getElementById("zotero-items-toolbar");
  if (!toolbar) {
    return;
  }

  const button = win.document.createXULElement("toolbarbutton");
  button.id = TOOLBAR_BUTTON_ID;
  button.className = "zotero-tb-button";
  button.setAttribute("tabindex", "-1");
  button.setAttribute("tooltiptext", getString("scan-current-view"));
  button.setAttribute("image", `chrome://${config.addonRef}/content/icons/favicon.svg`);
  button.addEventListener("command", () => {
    void PDFHandCatcherWorkflow.instance.start(win);
  });

  const anchor = win.document.getElementById("zotero-tb-search-spinner");
  toolbar.insertBefore(button, anchor ?? null);
}

export function unregisterToolbarButton(win?: Window) {
  if (!win) {
    for (const mainWindow of Array.from(((Zotero as any).getMainWindows?.() ?? []) as Iterable<Window>)) {
      unregisterToolbarButton(mainWindow);
    }
    return;
  }
  win.document.getElementById(TOOLBAR_BUTTON_ID)?.remove();
}

export function shutdownPDFHandCatcherWorkflow() {
  PDFHandCatcherWorkflow.instance.closeDialog();
}

// ─── Workflow controller ─────────────────────────────────────────

class PDFHandCatcherWorkflow {
  private static _instance: PDFHandCatcherWorkflow;
  private workflowWindow?: WorkflowWindow;
  private ownerWindow?: Window;

  // Item tracking
  private itemIDs: number[] = [];
  private currentIndex = 0;
  private displayedItemID?: number;

  // Download detection
  private currentObservationStartedAt = 0;
  private observedDownloads = new Map<string, ObservedDownload>();
  private handledDownloads = new Set<string>();
  private downloadPollTimer?: number;
  private downloadPollHostWindow?: Window;
  private autoAttachInFlight = false;

  // Isolated Edge browser
  private edgeProcess: any = null;
  private edgeLaunched = false;
  private isolatedProfileDir = "";
  private edgeDebugPort = 19222;

  static get instance() {
    if (!this._instance) {
      this._instance = new PDFHandCatcherWorkflow();
    }
    return this._instance;
  }

  // ─── Lifecycle ───

  async start(win: Window) {
    if (!hasActiveView()) {
      showAlert(getString("scan-no-view"), win);
      return;
    }
    if (!currentViewFilesEditable()) {
      showAlert(getString("scan-no-edit"), win);
      return;
    }

    this.ownerWindow = win;
    this.stopDownloadWatcher();
    this.clearSessionData();

    const missingItems = await this.scanCurrentView();
    if (!missingItems.length) {
      return;
    }

    this.itemIDs = missingItems.map((item) => item.id);
    this.currentIndex = 0;

    await this.ensureWorkflowWindow(win);
    this.startDownloadWatcher();
    await this.refreshWindowContent();
  }

  closeDialog() {
    this.stopDownloadWatcher();
    this.closeEdge();
    this.clearSessionData();

    const workflowWindow = this.workflowWindow;
    this.workflowWindow = undefined;
    if (workflowWindow && !workflowWindow.closed) {
      workflowWindow.close();
    }
  }

  onWorkflowWindowLoad(win: WorkflowWindow) {
    this.workflowWindow = win;

    setText(win.document, `${config.addonRef}-skip`, getString("skip"));
    setText(win.document, `${config.addonRef}-close`, getString("close"));

    bindWindowButton(win, `${config.addonRef}-skip`, async () => {
      await this.advance();
    });

    bindWindowButton(win, `${config.addonRef}-close`, async () => {
      this.closeDialog();
    });
  }

  onWorkflowWindowUnload(win: WorkflowWindow) {
    if (this.workflowWindow !== win) {
      return;
    }
    this.stopDownloadWatcher();
    this.closeEdge();
    this.clearSessionData();
    this.workflowWindow = undefined;
  }

  // ─── Session data ───

  private clearSessionData() {
    this.itemIDs = [];
    this.currentIndex = 0;
    this.displayedItemID = undefined;
    this.currentObservationStartedAt = 0;
    this.observedDownloads.clear();
    this.handledDownloads.clear();
    this.autoAttachInFlight = false;
    this.downloadPollHostWindow = undefined;
  }

  private get currentItem() {
    const itemID = this.itemIDs[this.currentIndex];
    return itemID ? Zotero.Items.get(itemID) : undefined;
  }

  // ─── Workflow window ───

  private async ensureWorkflowWindow(ownerWin: Window) {
    if (this.workflowWindow && !this.workflowWindow.closed) {
      this.workflowWindow.focus();
      return;
    }

    const io = { wrappedJSObject: { controller: this } };
    this.workflowWindow = ownerWin.openDialog(
      WORKFLOW_WINDOW_URL,
      WORKFLOW_WINDOW_NAME,
      "chrome,dialog=no,resizable,centerscreen,width=300,height=118",
      io,
    ) as WorkflowWindow;

    for (let i = 0; i < 60; i++) {
      if (this.workflowWindow && !this.workflowWindow.closed) {
        // Window loaded when onWorkflowWindowLoad sets this.workflowWindow
        const doc = this.workflowWindow.document;
        if (doc && doc.getElementById(`${config.addonRef}-close`)) {
          return;
        }
      }
      await Zotero.Promise.delay(50);
    }
    throw new Error("Workflow window did not initialize");
  }

  // ─── UI refresh ───

  private async refreshWindowContent(navigate = true) {
    const win = this.workflowWindow;
    const doc = win?.document;
    const item = this.currentItem;
    if (!win || !doc || win.closed) {
      return;
    }
    if (!item) {
      this.finish();
      return;
    }

    const total = this.itemIDs.length;
    const current = this.currentIndex + 1;
    const done = this.currentIndex;
    setText(doc, `${config.addonRef}-progress-title`, `${current}/${total}`);
    const progressBar = doc.getElementById(`${config.addonRef}-progress-bar`) as HTMLProgressElement | null;
    if (progressBar) {
      progressBar.max = Math.max(total, 1);
      progressBar.value = done;
    }

    setText(doc, `${config.addonRef}-item-title-value`, item.getDisplayTitle() || getString("empty-value"));

    if (navigate && this.displayedItemID !== item.id) {
      this.displayedItemID = item.id;
      this.resetCurrentObservation();
      await this.openItemInEdge(item);
    }

    this.updateWorkflowHint(getString("workflow-hint"));
  }

  private updateWorkflowHint(text: string) {
    const doc = this.workflowWindow?.document;
    if (!doc) {
      return;
    }
    setText(doc, `${config.addonRef}-workflow-hint`, text);
  }

  // ─── Isolated Edge browser ───

  private async openItemInEdge(item: Zotero.Item) {
    const sourceURL = getBestSourceURL(item);
    const url = sourceURL || buildBingSearchURL(item.getDisplayTitle());

    if (!sourceURL) {
      this.updateWorkflowHint(getString("search-by-title"));
    }

    const edgePath = findEdgePath();
    if (!edgePath) {
      debug("Edge not found, falling back to Zotero.launchURL");
      this.updateWorkflowHint(getString("no-edge"));
      Zotero.launchURL(url);
      return;
    }

    if (!this.isolatedProfileDir) {
      this.isolatedProfileDir = `${getTempDir()}\\${config.addonRef}-edge`;
    }

    if (this.edgeLaunched) {
      // Edge already running — snapshot old tabs, open new, then close old
      void this.reuseEdge(edgePath, url);
      return;
    }

    // First launch
    await this.launchEdge(edgePath, url);
  }

  private async launchEdge(edgePath: string, url: string) {
    ensureDir(this.isolatedProfileDir);

    const args = [
      `--user-data-dir=${this.isolatedProfileDir}`,
      `--remote-debugging-port=${this.edgeDebugPort}`,
      "--inprivate",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--enable-features=ParallelDownloading",
      "--disable-features=msEdgeDefaultBrowserInterstitial,msEdgeSidebarV2,Translate,TranslateUI,msTranslate",
      "--new-window",
      url,
    ];

    try {
      this.edgeProcess = launchProcess(edgePath, args);
      this.edgeLaunched = true;
      debug("launched isolated Edge", url);
    } catch (error) {
      debug("Edge launch failed", error instanceof Error ? error.message : String(error));
      Zotero.launchURL(url);
    }
  }

  /** Snapshot old tab IDs → open new tab → close old tabs by their IDs. */
  private async reuseEdge(edgePath: string, url: string) {
    const base = `http://127.0.0.1:${this.edgeDebugPort}`;

    // 1. Snapshot current tab IDs (these are the OLD tabs to close later)
    const oldTabIds = new Set<string>();
    try {
      const resp = await fetch(`${base}/json`);
      if (resp.ok) {
        const tabs = (await resp.json()) as unknown as Array<{ id: string; type: string }>;
        for (const tab of tabs) {
          if (tab.type === "page") {
            oldTabIds.add(tab.id);
          }
        }
      }
    } catch {}

    // 2. Open new tab in existing Edge instance
    try {
      launchProcess(edgePath, [`--user-data-dir=${this.isolatedProfileDir}`, "--inprivate", url]);
      debug("opened tab in existing Edge", url);
    } catch (error) {
      debug("reuseEdge failed", error instanceof Error ? error.message : String(error));
      Zotero.launchURL(url);
      return;
    }

    // 3. After delay, close only the OLD tabs (by saved IDs)
    if (oldTabIds.size > 0) {
      const win = this.workflowWindow;
      if (win && !win.closed) {
        win.setTimeout(() => {
          for (const id of oldTabIds) {
            fetch(`${base}/json/close/${id}`).catch(() => {});
          }
          debug("CDP: closed old tabs", oldTabIds.size);
        }, 2000);
      }
    }

  }

  private closeEdge() {
    killProcess(this.edgeProcess);
    this.edgeProcess = null;
    this.edgeLaunched = false;
  }


  // ─── Item progression ───

  private async attachPathAndAdvance(filePath: string) {
    if (this.autoAttachInFlight) {
      return;
    }

    const item = this.currentItem;
    if (!item) {
      return;
    }

    this.autoAttachInFlight = true;
    try {
      await attachPdfToItem(item, filePath);
      this.deleteDownloadedSourceFile(filePath);
      await this.advance();
    } finally {
      this.autoAttachInFlight = false;
    }
  }

  private deleteDownloadedSourceFile(filePath: string) {
    const downloadDir = getDownloadDir();
    if (!downloadDir || !isPathInsideDirectory(filePath, downloadDir)) {
      return;
    }

    try {
      const file = Zotero.File.pathToFile(filePath);
      if (file.exists() && file.isFile()) {
        file.remove(false);
        debug("deleted downloaded PDF after attach", filePath);
      }
    } catch (error) {
      debug("deleteDownloadedSourceFile failed", error instanceof Error ? error.message : String(error));
    }
  }

  private async advance() {
    this.currentIndex += 1;
    await this.refreshWindowContent(true);
  }

  private finish() {
    const done = this.itemIDs.length;
    showProgress(
      getString("workflow-finished"),
      getString("workflow-finished-detail", { args: { done } }),
      "success",
      3000,
    );
    this.closeDialog();
  }

  // ─── Scan ───

  private async scanCurrentView() {
    const items = await getVisibleRegularItems();
    if (!items.length) {
      showProgress(getString("scan-title"), getString("scan-no-items"), "success", 2200);
      return [];
    }

    const progress = new ztoolkit.ProgressWindow(getString("scan-title"), {
      closeOnClick: false,
      closeTime: -1,
    })
      .createLine({
        text: getString("scan-progress", { args: { current: 0, total: items.length } }),
        type: "default",
        progress: 0,
      })
      .show();

    const missingItems: Zotero.Item[] = [];
    for (let index = 0; index < items.length; index++) {
      if (index > 0 && index % 25 === 0) {
        await Zotero.Promise.delay(0);
      }

      const item = items[index];
      if (countPdfAttachments(item) === 0) {
        missingItems.push(item);
      }

      progress.changeLine({
        text: getString("scan-progress", { args: { current: index + 1, total: items.length } }),
        type: "default",
        progress: Math.round(((index + 1) / items.length) * 100),
      });
    }

    progress.changeLine({
      text: missingItems.length
        ? getString("scan-found", { args: { count: missingItems.length } })
        : getString("scan-empty"),
      type: missingItems.length ? "default" : "success",
      progress: 100,
    });
    progress.startCloseTimer(1600);
    return missingItems;
  }

  // ─── Download watcher ───

  private resetCurrentObservation() {
    this.currentObservationStartedAt = Date.now();
    this.observedDownloads.clear();
    this.handledDownloads.clear();
  }

  private startDownloadWatcher() {
    this.stopDownloadWatcher();
    this.downloadPollHostWindow = this.workflowWindow ?? this.ownerWindow ?? Zotero.getMainWindow();
    this.downloadPollTimer = this.downloadPollHostWindow.setInterval(() => {
      void this.pollDownloads();
    }, DOWNLOAD_POLL_MS);
  }

  private stopDownloadWatcher() {
    if (this.downloadPollTimer !== undefined && this.downloadPollHostWindow) {
      this.downloadPollHostWindow.clearInterval(this.downloadPollTimer);
      this.downloadPollTimer = undefined;
    }
    this.downloadPollHostWindow = undefined;
  }

  private async pollDownloads() {
    if (this.autoAttachInFlight) {
      return;
    }

    const item = this.currentItem;
    if (!item) {
      return;
    }

    const candidate = await this.findNewestFinishedDownload(false);
    if (!candidate) {
      return;
    }

    await this.attachPathAndAdvance(candidate);
  }

  private async findNewestFinishedDownload(ignoreHandled: boolean) {
    const downloadDir = getDownloadDir();
    if (!downloadDir || !directoryExists(downloadDir)) {
      return null;
    }

    const candidates = listFinishedDownloadCandidates(downloadDir, this.currentObservationStartedAt);
    candidates.sort((left, right) => right.mtime - left.mtime);

    for (const candidate of candidates) {
      if (!ignoreHandled && this.handledDownloads.has(candidate.path)) {
        continue;
      }

      const previous = this.observedDownloads.get(candidate.path);
      const stableRounds =
        previous && previous.size === candidate.size && previous.mtime === candidate.mtime
          ? previous.stableRounds + 1
          : 0;

      this.observedDownloads.set(candidate.path, {
        size: candidate.size,
        mtime: candidate.mtime,
        stableRounds,
      });

      if (!ignoreHandled && stableRounds < 1) {
        continue;
      }
      if (!isPDFFile(candidate.path)) {
        continue;
      }

      this.handledDownloads.add(candidate.path);
      return candidate.path;
    }

    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function bindWindowButton(win: WorkflowWindow, id: string, action: () => Promise<void>) {
  const button = win.document.getElementById(id) as HTMLButtonElement | null;
  if (!button || button.dataset.bound === "true") {
    return;
  }

  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await action();
    } catch (error) {
      showAlert(normalizeError(error), win);
    } finally {
      if (!win.closed) {
        button.disabled = false;
      }
    }
  });
}

function showProgress(title: string, text: string, type: "default" | "success", closeTime: number) {
  new ztoolkit.ProgressWindow(title, {
    closeOnClick: true,
    closeTime,
  })
    .createLine({
      text,
      type,
      progress: 100,
    })
    .show();
}

function setText(doc: Document, id: string, text: string) {
  const element = doc.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildBingSearchURL(title: string) {
  const query = (title || "").trim();
  if (!query) {
    return BING_SEARCH_URL;
  }
  return `${BING_SEARCH_URL}?q=${encodeURIComponent(query)}`;
}

function listFinishedDownloadCandidates(downloadDir: string, since: number) {
  const directory = Zotero.File.pathToFile(downloadDir);
  const results: Array<{ path: string; size: number; mtime: number }> = [];
  const entries = directory.directoryEntries as any;

  while (entries.hasMoreElements()) {
    const entry = (entries.getNext() as any).QueryInterface(Components.interfaces.nsIFile) as any;
    if (!entry.isFile()) {
      continue;
    }

    const name = String(entry.leafName).toLowerCase();
    if (name.endsWith(".part") || name.endsWith(".tmp") || name.endsWith(".download") || name.endsWith(".crdownload")) {
      continue;
    }
    if (entry.lastModifiedTime + 1000 < since) {
      continue;
    }

    results.push({
      path: String(entry.path),
      size: Number(entry.fileSize),
      mtime: Number(entry.lastModifiedTime),
    });
  }

  return results;
}

function isPDFFile(path: string) {
  const file = Zotero.File.pathToFile(path);
  if (!file.exists() || !file.isFile()) {
    return false;
  }

  const FileInputStream = Components.Constructor(
    "@mozilla.org/network/file-input-stream;1",
    "nsIFileInputStream",
    "init",
  );
  const BinaryInputStream = Components.Constructor(
    "@mozilla.org/binaryinputstream;1",
    "nsIBinaryInputStream",
    "setInputStream",
  );

  let inputStream: any;
  let binaryStream: any;
  try {
    inputStream = new FileInputStream(file, 0x01, 0, 0);
    binaryStream = new BinaryInputStream(inputStream);
    const header = binaryStream.readBytes(Math.min(5, Math.max(0, file.fileSize)));
    return header === "%PDF-";
  } catch {
    return false;
  } finally {
    try {
      binaryStream?.close();
    } catch {}
    try {
      inputStream?.close();
    } catch {}
  }
}

function isPathInsideDirectory(filePath: string, directoryPath: string) {
  const normalizedFilePath = normalizeWindowsPath(filePath);
  const normalizedDirectoryPath = normalizeWindowsPath(directoryPath);

  if (!normalizedFilePath || !normalizedDirectoryPath) {
    return false;
  }

  return normalizedFilePath.startsWith(`${normalizedDirectoryPath}\\`);
}

function normalizeWindowsPath(path: string) {
  return String(path ?? "")
    .trim()
    .replace(/\//g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}
