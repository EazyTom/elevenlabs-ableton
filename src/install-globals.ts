/**
 * Minimal Web API globals for Live's Extension Host (Node 24 without browser globals).
 * Uses node built-ins + formdata-polyfill fallback — does NOT bundle undici.
 *
 * Note: formdata-polyfill cannot attach files to fetch bodies. File-upload APIs
 * (stem separation, STT, etc.) use manual multipart in multipart-upload.ts instead.
 */
import { Blob, File } from "node:buffer";
import {
  ReadableStream,
  WritableStream,
  TransformStream,
} from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";
import { FormData as FormDataImpl } from "formdata-polyfill/esm.min.js";

function setGlobal<K extends keyof typeof globalThis>(
  key: K,
  value: (typeof globalThis)[K],
): void {
  if (typeof globalThis[key] === "undefined") {
    globalThis[key] = value;
  }
}

export function installExtensionGlobals(): void {
  setGlobal("TextDecoder", TextDecoder as unknown as typeof globalThis.TextDecoder);
  setGlobal("TextEncoder", TextEncoder as unknown as typeof globalThis.TextEncoder);
  setGlobal("ReadableStream", ReadableStream as unknown as typeof globalThis.ReadableStream);
  setGlobal("WritableStream", WritableStream as unknown as typeof globalThis.WritableStream);
  setGlobal("TransformStream", TransformStream as unknown as typeof globalThis.TransformStream);
  setGlobal("Blob", Blob as unknown as typeof globalThis.Blob);
  if (typeof File !== "undefined") {
    setGlobal("File", File as unknown as typeof globalThis.File);
  }
  setGlobal("FormData", FormDataImpl as unknown as typeof globalThis.FormData);
}

installExtensionGlobals();
