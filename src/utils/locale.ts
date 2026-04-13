import { config } from "../../package.json";

export function initLocale() {
  const L10n = (
    typeof Localization === "undefined" ? ztoolkit.getGlobal("Localization") : Localization
  ) as any;
  addon.data.locale = {
    current: new L10n([`${config.addonRef}-addon.ftl`], true),
  };
}

export function getString(localString: string): string;
export function getString(localString: string, branch: string): string;
export function getString(
  localeString: string,
  options: { branch?: string; args?: Record<string, unknown> },
): string;
export function getString(...inputs: any[]) {
  if (inputs.length === 1) {
    return _getString(inputs[0]);
  }
  if (inputs.length === 2) {
    if (typeof inputs[1] === "string") {
      return _getString(inputs[0], { branch: inputs[1] });
    }
    return _getString(inputs[0], inputs[1]);
  }
  throw new Error("Invalid arguments");
}

function _getString(
  localeString: string,
  options: { branch?: string; args?: Record<string, unknown> } = {},
) {
  const key = `${config.addonRef}-${localeString}`;
  const { branch, args } = options;
  const pattern = addon.data.locale?.current.formatMessagesSync([{ id: key, args }])[0];

  if (!pattern) {
    return key;
  }

  if (branch && pattern.attributes) {
    return pattern.attributes[branch] || key;
  }

  return pattern.value || key;
}
