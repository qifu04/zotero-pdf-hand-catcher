import {
  BasicTool,
  DialogHelper,
  PatchHelper,
  ProgressWindowHelper,
  UITool,
  makeHelperTool,
  unregister,
} from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { debug } from "./zotero";

export function createZToolkit() {
  const toolkit = new MyToolkit();
  initZToolkit(toolkit);
  return toolkit;
}

function initZToolkit(toolkit: ReturnType<typeof createZToolkit>) {
  toolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  toolkit.basicOptions.log.disableConsole = __env__ === "production";
  toolkit.UI.basicOptions.ui.enableElementJSONLog = false;
  toolkit.UI.basicOptions.ui.enableElementDOMLog = false;
  toolkit.basicOptions.api.pluginID = config.addonID;
  toolkit.ProgressWindow.setIconURI("default", `chrome://${config.addonRef}/content/icons/preficon.svg`);
}

class MyToolkit extends BasicTool {
  UI: UITool;
  Dialog: typeof DialogHelper;
  ProgressWindow: typeof ProgressWindowHelper;
  Patch: typeof PatchHelper;

  constructor() {
    super();
    this.UI = new UITool(this);
    this.ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
    this.Dialog = makeHelperTool(DialogHelper, this);
    this.Patch = makeHelperTool(PatchHelper, this);
  }

  unregisterAll() {
    unregister(this);
    debug("toolkit unregistered");
  }
}
