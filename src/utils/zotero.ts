import { config } from "../../package.json";
import { getPref } from "./prefs";

export function debug(...messages: unknown[]) {
  const text = messages.map((message) => stringifyMessage(message)).join(" ");
  Zotero.debug(`[${config.addonName}] ${text}`);
}

export function showAlert(message: string, win = getMainWindow()) {
  Zotero.alert(win, config.addonName, message);
}

export function getMainWindow(): Window {
  const zoteroAny = Zotero as any;
  const win = zoteroAny.getMainWindow?.() ?? Array.from(zoteroAny.getMainWindows?.() ?? [])[0];
  return win as Window;
}

export function hasActiveView() {
  return Boolean((Zotero.getActiveZoteroPane() as any).getCollectionTreeRow?.());
}

export function currentViewFilesEditable() {
  const row = (Zotero.getActiveZoteroPane() as any).getCollectionTreeRow?.();
  return row ? Boolean(row.filesEditable) : false;
}

export async function getVisibleRegularItems() {
  const pane = Zotero.getActiveZoteroPane() as any;
  const itemsView = pane.itemsView;
  if (!itemsView) {
    return [] as Zotero.Item[];
  }

  if (typeof itemsView.waitForLoad === "function") {
    await itemsView.waitForLoad();
  }

  const items: Zotero.Item[] = [];
  const seen = new Set<number>();
  const rowCount = itemsView.rowCount ?? 0;

  for (let index = 0; index < rowCount; index++) {
    if (index > 0 && index % 100 === 0) {
      await Zotero.Promise.delay(0);
    }

    const row = itemsView.getRow(index);
    const item = row?.ref as Zotero.Item | undefined;
    if (!item || seen.has(item.id) || item.deleted || !item.isRegularItem()) {
      continue;
    }
    if (typeof (item as any).isTopLevelItem === "function" && !(item as any).isTopLevelItem()) {
      continue;
    }
    seen.add(item.id);
    items.push(item);
  }

  return items;
}

export function getBestSourceURL(item: Zotero.Item) {
  const url = String(item.getField("url") ?? "").trim();
  if (url) {
    return url;
  }

  const doi = String(item.getField("DOI") ?? "").trim();
  if (!doi) {
    return "";
  }

  return /^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi}`;
}

export function countPdfAttachments(item: Zotero.Item) {
  return item
    .getAttachments()
    .map((attachmentID) => Zotero.Items.get(attachmentID))
    .filter((attachment) => attachment && !attachment.deleted && isPdfAttachment(attachment))
    .length;
}

export function getDownloadDir() {
  const configured = String(getPref("download.dir") ?? "").trim();
  return configured || getDefaultDownloadDir();
}

export function directoryExists(path: string) {
  try {
    const file = pathToFile(path);
    return Boolean(file && file.exists() && file.isDirectory());
  } catch {
    return false;
  }
}

export async function attachPdfToItem(item: Zotero.Item, filePath: string) {
  const attachment = await (Zotero.Attachments as any).importFromFile({
    file: filePath,
    libraryID: item.libraryID,
    parentItemID: item.id,
    title: "",
  });

  if (typeof (attachment as any).setAutoAttachmentTitle === "function") {
    (attachment as any).setAutoAttachmentTitle();
  }
  if (typeof (attachment as any).saveTx === "function") {
    await (attachment as any).saveTx();
  }

  return attachment as Zotero.Item;
}

// --------------- Isolated Edge browser ---------------

const EDGE_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function findEdgePath(): string | null {
  for (const candidate of EDGE_CANDIDATES) {
    try {
      const file = pathToFile(candidate);
      if (file.exists() && file.isFile()) {
        return candidate;
      }
    } catch {}
  }
  return null;
}

export function launchProcess(exePath: string, args: string[]): any {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile) as any;
  file.initWithPath(exePath);
  const process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess) as any;
  process.init(file);
  process.run(false, args, args.length);
  return process;
}

export function killProcess(process: any) {
  try {
    if (process && typeof process.isRunning === "boolean" ? process.isRunning : true) {
      process.kill();
    }
  } catch {}
}

export function ensureDir(path: string) {
  const file = pathToFile(path);
  if (!file.exists()) {
    file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
  }
}

export function getTempDir() {
  return String(Services.dirsvc.get("TmpD", Components.interfaces.nsIFile).path);
}

export function copyFile(srcPath: string, dstPath: string) {
  const src = pathToFile(srcPath);
  if (!src.exists() || !src.isFile()) {
    return false;
  }
  const dst = pathToFile(dstPath);
  const dstParent = dst.parent;
  if (dstParent && !dstParent.exists()) {
    dstParent.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
  }
  if (dst.exists()) {
    dst.remove(false);
  }
  src.copyTo(dstParent, dst.leafName);
  return true;
}

export function getLocalAppDataPath() {
  return String(Services.dirsvc.get("LocalAppData", Components.interfaces.nsIFile).path);
}

// --------------- Internal ---------------

function isPdfAttachment(item: Zotero.Item) {
  const attachmentAny = item as any;
  if (typeof attachmentAny.isPDFAttachment === "function") {
    return attachmentAny.isPDFAttachment();
  }
  return String(item.getField("contentType") ?? "").toLowerCase() === "application/pdf";
}

function getDefaultDownloadDir() {
  try {
    return String((Services as any).dirsvc.get("DfltDwnld", Components.interfaces.nsIFile).path ?? "");
  } catch {
    try {
      const home = (Services as any).dirsvc.get("Home", Components.interfaces.nsIFile);
      home.append("Downloads");
      return String(home.path ?? "");
    } catch {
      return "";
    }
  }
}

function pathToFile(path: string) {
  return (Zotero as any).File.pathToFile(path);
}

function stringifyMessage(message: unknown) {
  if (typeof message === "string") {
    return message;
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}
