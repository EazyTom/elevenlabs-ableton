/**
 * Manual pre-release smoke: build, fake host, API, optional music.
 * Does not start or connect to Live. Use npm run smoke:live when you want that yourself.
 *   npm run smoke
 *   npm run smoke -- --music
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const withMusic = args.includes("--music");

function run(label: string, command: string, commandArgs: string[]): boolean {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32" && command === "npm",
  });
  if (result.error) console.error(result.error.message);
  const ok = result.status === 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  return ok;
}

const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const steps: Array<[string, string, string[]]> = [
  ["build", "npm", ["run", "build"]],
  ["smoke:host", process.execPath, [tsx, "scripts/smoke-host.mjs"]],
  ["check:api", "npm", ["run", "check:api"]],
];
if (withMusic) steps.push(["test:music", process.execPath, [tsx, "scripts/test-compose-detailed.ts"]]);

const summary: string[] = [];
for (const [label, command, commandArgs] of steps) {
  const ok = run(label, command, commandArgs);
  summary.push(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) break;
}
console.log("\nSmoke summary:");
for (const line of summary) console.log(`  ${line}`);
process.exit(summary.some((line) => line.startsWith("FAIL")) ? 1 : 0);
