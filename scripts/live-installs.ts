import { execFileSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import path from "path";

export interface LiveInstall {
  label: string;
  major: number;
  version: string;
  hostModulePath: string;
  bundledNode: string;
  exePath?: string;
}

function hostModuleIn(installDir: string): string | undefined {
  const win = path.join(installDir, "Program", "ExtensionHost", "ExtensionHostNodeModule.node");
  if (existsSync(win)) return win;
  const mac = path.join(installDir, "Contents", "Helpers", "ExtensionHost", "ExtensionHostNodeModule.node");
  if (existsSync(mac)) return mac;
  return undefined;
}

function exeVersion(exePath: string): string {
  try {
    const output = execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `(Get-Item -LiteralPath '${exePath.replace(/'/g, "''")}').VersionInfo.ProductVersion`],
      { encoding: "utf8" },
    ).trim();
    return output || "unknown";
  } catch {
    return "unknown";
  }
}

function fromInstallDir(installDir: string, label: string): LiveInstall | undefined {
  const hostModulePath = hostModuleIn(installDir);
  if (!hostModulePath) return undefined;
  const exeName = path.basename(installDir).includes("Beta")
    ? `Ableton ${path.basename(installDir)}.exe`
    : "";
  const exePath = exeName ? path.join(installDir, "Program", exeName) : undefined;
  const version = exePath && existsSync(exePath) ? exeVersion(exePath) : "unknown";
  const majorMatch = version.match(/^(\d+)/) ?? label.match(/(\d+)/);
  return {
    label,
    major: Number(majorMatch?.[1] ?? 0),
    version,
    hostModulePath,
    bundledNode: path.join(path.dirname(hostModulePath), process.platform === "win32" ? "node.exe" : "node"),
    exePath: exePath && existsSync(exePath) ? exePath : undefined,
  };
}

export function discoverLiveInstalls(): LiveInstall[] {
  const found: LiveInstall[] = [];
  if (process.platform === "win32") {
    const root = "C:\\ProgramData\\Ableton";
    if (existsSync(root)) {
      for (const name of readdirSync(root)) {
        if (!/^Live (?:\d+|.*Beta)/.test(name)) continue;
        const install = fromInstallDir(path.join(root, name), name);
        if (install) found.push(install);
      }
    }
  } else if (process.platform === "darwin" && existsSync("/Applications")) {
    for (const name of readdirSync("/Applications")) {
      if (!name.startsWith("Ableton Live") || !name.endsWith(".app")) continue;
      const install = fromInstallDir(path.join("/Applications", name), name);
      if (install) found.push(install);
    }
  }
  return found.sort((a, b) => a.major - b.major || a.version.localeCompare(b.version));
}

export function resolveLiveInstall(selector: string | undefined): LiveInstall | undefined {
  const installs = discoverLiveInstalls();
  if (!selector) return installs.filter((install) => install.label.includes("Beta")).at(-1) ?? installs.at(-1);
  if (selector === "12" || selector === "13") {
    return installs.find((install) => install.major === Number(selector) && install.label.includes("Beta"))
      ?? installs.find((install) => install.major === Number(selector));
  }
  const direct = installs.find((install) => install.hostModulePath === selector || install.exePath === selector);
  if (direct) return direct;
  const byPath = fromInstallDir(selector, path.basename(selector));
  return byPath;
}
