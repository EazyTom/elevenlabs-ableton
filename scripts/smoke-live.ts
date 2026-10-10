/**
 * Connect the built extension to a running Live beta and require selftest PASS.
 * Usage: npx tsx scripts/smoke-live.ts [--live 12|13] [--launch]
 */
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { discoverLiveInstalls, resolveLiveInstall, type LiveInstall } from "./live-installs.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const launch = process.argv.includes("--launch");
const selector = process.argv.find((arg, index) => process.argv[index - 1] === "--live");

function targets(): LiveInstall[] {
  if (selector) {
    const install = resolveLiveInstall(selector);
    return install ? [install] : [];
  }
  return discoverLiveInstalls().filter((install) => install.label.includes("Beta"));
}

async function smokeOne(install: LiveInstall): Promise<"pass" | "skip" | "fail"> {
  if (launch && install.exePath) {
    spawn(install.exePath, [], { detached: true, stdio: "ignore" }).unref();
  }
  const tempDirectory = path.join(ROOT, ".elevenlabs-temp");
  mkdirSync(tempDirectory, { recursive: true });
  const cli = path.join(ROOT, "node_modules", "@ableton-extensions", "cli", "dist", "cli.mjs");
  const child = spawn(process.execPath, [
    cli,
    "run",
    "--live",
    install.hostModulePath,
    "--temp-directory",
    tempDirectory,
  ], {
    cwd: ROOT,
    env: { ...process.env, ELEVENLABS_SELFTEST: "1" },
  });

  let output = "";
  child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr?.on("data", (chunk) => { output += chunk.toString(); });

  const waitMs = launch ? 120_000 : 45_000;
  const connected = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), waitMs);
    const poll = setInterval(() => {
      if (output.includes("selftest PASS") || output.includes("Failed to connect") || output.includes("selftest FAIL")) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve(output.includes("selftest PASS"));
      }
    }, 250);
  });

  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill();
  }
  if (output.includes("selftest PASS") && !/Unhandled|Incompatible API version/.test(output)) {
    console.log(`smoke:live PASS ${install.label} ${install.version}`);
    return "pass";
  }
  if (!connected && (output.includes("Failed to connect") || output.includes("no connection"))) {
    console.log(`smoke:live SKIP ${install.label} (Live is not running)`);
    return "skip";
  }
  if (output.includes("selftest FAIL") || /Unhandled|Incompatible API version/.test(output)) {
    console.error(`smoke:live FAIL ${install.label}\n${output.slice(-2000)}`);
    return "fail";
  }
  if (output.includes("Connected to Live")) {
    console.error(`smoke:live FAIL ${install.label} (connected, selftest did not pass)\n${output.slice(-1500)}`);
    return "fail";
  }
  console.log(`smoke:live SKIP ${install.label} (no connection)\n${output.slice(-500)}`);
  return "skip";
}

const installs = targets();
if (!installs.length) {
  console.log("smoke:live SKIP (no Extension Host installs found)");
  process.exit(0);
}
let failed = false;
for (const install of installs) {
  const result = await smokeOne(install);
  if (result === "fail") failed = true;
}
process.exit(failed ? 1 : 0);
