import hooks from "./hooks";
import { config } from "../package.json";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
  };

  public hooks: typeof hooks;
  public api: Record<string, never>;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
