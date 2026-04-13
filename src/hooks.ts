import { registerToolbarButton, shutdownPDFHandCatcherWorkflow, unregisterToolbarButton } from "./modules/pdfHandCatcher";
import { initLocale } from "./utils/locale";
import { registerStyleSheets } from "./utils/window";
import { debug } from "./utils/zotero";

async function onStartup() {
  await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise]);
  initLocale();

  const mainWindows = Array.from(((Zotero as any).getMainWindows?.() ?? []) as Iterable<Window>);
  await Promise.all(mainWindows.map((win) => onMainWindowLoad(win)));
  debug("addon onStartup");
}

async function onMainWindowLoad(win: Window): Promise<void> {
  registerStyleSheets(win);
  registerToolbarButton(win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  unregisterToolbarButton(win);
}

async function onShutdown() {
  debug("addon onShutdown");
  shutdownPDFHandCatcherWorkflow();
  unregisterToolbarButton();
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-ignore
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  _event: string,
  _type: string,
  _ids: number[] | string[],
  _extraData: { [key: string]: unknown },
) {}

async function onPrefsEvent(_type: string, _data: { [key: string]: unknown }) {}

function onShortcuts(_type: string) {}

async function onDialogEvents(_type: string) {}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
