/**
 * Load dist/extension.js against a fake Extension Host and open/cancel every command.
 * The parent (tsx or node) re-runs this file under each Live bundled node.exe.
 */
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(ROOT, "package.json"));

if (!process.env.SMOKE_HOST_CHILD) {
  let nodes = [process.execPath];
  let menus = [];
  try {
    const installs = await import("./live-installs.ts");
    const registry = await import("../src/menu-registry.ts");
    const discovered = [...new Set(installs.discoverLiveInstalls().map((install) => install.bundledNode))];
    if (discovered.length) nodes = discovered;
    menus = registry.MENU_ENTRIES;
  } catch (err) {
    console.error("smoke:host could not load helpers:", err);
    process.exit(1);
  }
  const menusPath = path.join(mkdtempSync(path.join(tmpdir(), "el-smoke-")), "menus.json");
  writeFileSync(menusPath, JSON.stringify(menus));
  for (const nodePath of nodes) {
    console.log(`smoke:host — ${nodePath}`);
    const result = spawnSync(process.execPath === nodePath ? process.execPath : nodePath, [fileURLToPath(import.meta.url)], {
      cwd: ROOT,
      env: {
      ...process.env,
      SMOKE_HOST_CHILD: "1",
      SMOKE_MENUS_JSON: menusPath,
      ELEVENLABS_API_KEY: "",
      ELEVENLABS_STORAGE_DIRECTORY: "",
    },
      encoding: "utf8",
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log("smoke:host PASS");
  process.exit(0);
}

const { readFileSync: readText } = await import("fs");
const expected = JSON.parse(readText(process.env.SMOKE_MENUS_JSON, "utf8"));
const cjsPath = path.join(mkdtempSync(path.join(tmpdir(), "el-bundle-")), "extension.cjs");
copyFileSync(path.join(ROOT, "dist", "extension.js"), cjsPath);
const extension = require(cjsPath);

const commands = new Map();
const menus = [];
const classes = {
  root: "Application",
  song: "Song",
  track: "AudioTrack",
  slot: "ClipSlot",
  clip: "AudioClip",
  drum: "DrumRackDevice",
  simpler: "Simpler",
  midi: "MidiTrack",
  midislot: "ClipSlot",
  chain: "DrumChain",
  cue: "CuePoint",
};
const parents = { slot: "track", clip: "track", drum: "midi", midislot: "midi" };

const dataModel = new Proxy(
  {
    getRoot: () => ({ id: "root" }),
    getObjectIsOfClass: (handle, name) => classes[handle?.id] === name,
    getObjectCanonicalParent: (handle) => (parents[handle?.id] ? { id: parents[handle.id] } : null),
    withinTransaction: (fn) => fn(),
    rootGetSong: () => ({ id: "song" }),
    songGetTempo: () => 120,
    songGetTracks: () => [],
    songGetRootNote: () => 0,
    songGetScaleName: () => "Major",
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => {
        const onResult = args.at(-2);
        const onError = args.at(-1);
        if (typeof onResult === "function" && typeof onError === "function") {
          onResult({ id: idForMutation(prop) });
          return;
        }
        if (String(prop).includes("Get") && String(prop).match(/Tracks|Slots|Clips|Devices|Scenes|Cue|Chains|Lanes|Samples/)) return [];
        return 0;
      };
    },
  },
);

function silentWav(filePath) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(88200, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(0, 40);
  writeFileSync(filePath, header);
  return filePath;
}

const activation = {
  initializeExtensionHost({ apiVersion }) {
    if (apiVersion !== "1.0.0") throw new Error(`Unexpected API version ${apiVersion}`);
    return {
      commands: {
        registerCommand: (id, handler) => commands.set(id, handler),
        executeCommand: () => {},
      },
      dataModel,
      environment: {
        storageDirectory: mkdtempSync(path.join(tmpdir(), "el-store-")),
        tempDirectory: mkdtempSync(path.join(tmpdir(), "el-temp-")),
        language: "en",
      },
      resources: {
        importIntoProject: (_file, onResult) => onResult?.(_file),
        renderPreFxAudio: (_track, _range, onResult) => {
          const filePath = path.join(tmpdir(), "el-smoke-render.wav");
          onResult(silentWav(filePath));
        },
      },
      ui: {
        registerContextMenuAction: (scope, title, commandId, done) => {
          menus.push({ scope, title, commandId });
          done?.(() => {});
        },
        showModalDialog: (_url, _w, _h, onResult) => onResult('{"cancelled":true}'),
        showProgressDialog: (_opts, callback) => {
          callback?.({ update: (_o, done) => done?.(), close: (done) => done?.() });
        },
      },
    };
  },
};

const errors = [];
const origError = console.error;
console.error = (...args) => {
  errors.push(args.map(String).join(" "));
  origError(...args);
};
process.on("unhandledRejection", (reason) => {
  errors.push(`unhandledRejection ${reason}`);
});

const logs = [];
const origLog = console.log;
console.log = (...args) => {
  logs.push(args.map(String).join(" "));
  origLog(...args);
};

extension.activate(activation);

if (!logs.some((line) => line.includes("[elevenlabs-ableton] v") && line.includes("active"))) {
  console.error("smoke:host FAIL: version log missing");
  process.exit(1);
}

const key = (entry) => `${entry.scope}|${entry.title}|${entry.commandId}`;
const actual = new Set(menus.map(key));
const wanted = new Set(expected.map(key));
for (const entry of wanted) {
  if (!actual.has(entry)) {
    console.error(`smoke:host FAIL: missing menu ${entry}`);
    process.exit(1);
  }
}
if (actual.size !== wanted.size) {
  console.error(`smoke:host FAIL: menu count ${actual.size} != ${wanted.size}`);
  process.exit(1);
}
for (const entry of expected) {
  if (!commands.has(entry.commandId)) {
    console.error(`smoke:host FAIL: no handler for ${entry.commandId}`);
    process.exit(1);
  }
}

function idForMutation(prop) {
  const name = String(prop).toLowerCase();
  if (name.includes("insertchain")) return "chain";
  if (name.includes("device") || name.includes("drum")) return "drum";
  if (name.includes("simpler") || name.includes("sample")) return "simpler";
  if (name.includes("cue")) return "cue";
  if (name.includes("clip")) return "clip";
  if (name.includes("miditrack")) return "midi";
  if (name.includes("track")) return "track";
  return "track";
}

function argFor(commandId) {
  if (commandId.includes("batchTts")) {
    return { selected_clip_slots: [{ id: "slot" }] };
  }
  if (
    commandId.includes("Arrangement")
    || commandId.includes("voiceChanger")
    || (commandId.includes("vocalIsolation") && !commandId.includes("Clip"))
  ) {
    return {
      selected_lanes: [{ id: "track" }],
      time_selection_start: 0,
      time_selection_end: 4,
    };
  }
  if (commandId.includes("drumRackSfxClipSlot")) return { id: "midislot" };
  if (commandId.toLowerCase().includes("drum")) return { id: "drum" };
  if (commandId.toLowerCase().includes("simpler")) return { id: "simpler" };
  if (commandId.includes("ClipSlot")) return { id: "slot" };
  if (commandId.includes("Clip")) return { id: "clip" };
  if (/tts|sfx|music|dialogue/i.test(commandId)) return { id: "slot" };
  return { id: "track" };
}

for (const [commandId, handler] of commands) {
  errors.length = 0;
  handler(argFor(commandId));
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (errors.length) {
    console.error(`smoke:host FAIL: ${commandId}: ${errors.join(" | ")}`);
    process.exit(1);
  }
}

console.log(`smoke:host child PASS (${commands.size} commands, ${menus.length} menus)`);
