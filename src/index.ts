import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();
const zotero = basicTool.getGlobal("Zotero");

// @ts-ignore
if (zotero[config.addonInstance]?.data) {
  // @ts-ignore
  zotero[config.addonInstance].data.alive = false;
}

_globalThis.addon = new Addon();
defineGlobal("ztoolkit", () => _globalThis.addon.data.ztoolkit);
// @ts-ignore
zotero[config.addonInstance] = addon;

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => unknown): void;
function defineGlobal(name: string, getter?: () => unknown) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
