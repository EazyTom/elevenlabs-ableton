/**
 * Dev launcher: runs extensions-cli with storage-directory and temp-directory
 * resolved from .env or common monorepo layout (api-key.txt in parent folder).
 */
import { existsSync, mkdirSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // no .env — use env vars from shell
}

function resolveStorageDirectory(): string | undefined {
  const fromEnv = process.env.ELEVENLABS_STORAGE_DIRECTORY?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  const parentDir = path.resolve(ROOT, "..");
  if (existsSync(path.join(parentDir, "api-key.txt"))) {
    return parentDir;
  }

  if (existsSync(path.join(ROOT, "api-key.txt"))) {
    return ROOT;
  }

  return undefined;
}

function resolveTempDirectory(storageDirectory: string | undefined): string {
  const fromEnv = process.env.ELEVENLABS_TEMP_DIRECTORY?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  const base = storageDirectory ?? ROOT;
  return path.join(base, ".elevenlabs-temp");
}

const storageDirectory = resolveStorageDirectory();
const tempDirectory = resolveTempDirectory(storageDirectory);
mkdirSync(tempDirectory, { recursive: true });

const args = ["run", "--temp-directory", tempDirectory];

if (storageDirectory) {
  args.push("--storage-directory", storageDirectory);
  console.log(`  Storage: ${storageDirectory}`);
} else {
  console.warn(
    "  Storage: (none) — set ELEVENLABS_STORAGE_DIRECTORY in .env or place api-key.txt in parent folder",
  );
}

console.log(`  Temp: ${tempDirectory}`);

const cliEntry = path.join(ROOT, "node_modules", "@ableton-extensions", "cli", "dist", "cli.mjs");

// Spawn node + cli.mjs directly (no shell: true) to avoid Node DEP0190 on Windows.
const child = spawn(process.execPath, [cliEntry, ...args], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
