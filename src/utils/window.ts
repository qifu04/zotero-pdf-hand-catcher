import { config } from "../../package.json";

export function registerStyleSheets(win?: Window) {
  const targetWindow = win ?? ((Zotero as any).getMainWindow?.() as Window | undefined);
  if (!targetWindow) {
    return;
  }

  for (const hrefName of [config.addonRef]) {
    const href = `chrome://${config.addonRef}/content/${hrefName}.css`;
    if (targetWindow.document.querySelector(`link[href="${href}"]`)) {
      continue;
    }

    const stylesheet = targetWindow.document.createElement("link");
    stylesheet.setAttribute("rel", "stylesheet");
    stylesheet.setAttribute("type", "text/css");
    stylesheet.setAttribute("href", href);
    targetWindow.document.documentElement.appendChild(stylesheet);
  }
}
