import * as esbuild from "esbuild";
import * as fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");

// Node built-ins only — must run before fetch-blob / formdata-polyfill init (no undici).
const nodeGlobalsBanner = `const { TextDecoder: __TD, TextEncoder: __TE } = require("util");
const { ReadableStream: __RS, WritableStream: __WS, TransformStream: __TS } = require("stream/web");
const { Blob: __B, File: __F } = require("buffer");
const __g = globalThis;
if (!__g.TextDecoder) __g.TextDecoder = __TD;
if (!__g.TextEncoder) __g.TextEncoder = __TE;
if (!__g.ReadableStream) __g.ReadableStream = __RS;
if (!__g.WritableStream) __g.WritableStream = __WS;
if (!__g.TransformStream) __g.TransformStream = __TS;
if (!__g.Blob) __g.Blob = __B;
if (__F && !__g.File) __g.File = __F;
`;

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  outfile: manifest.entry,
  bundle: true,
  format: "cjs",
  platform: "node",
  sourcesContent: false,
  logLevel: "info",
  minify: production,
  sourcemap: !production,
  loader: { ".html": "text", ".png": "dataurl" },
  banner: { js: nodeGlobalsBanner },
});
