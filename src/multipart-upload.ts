import { readFile, stat } from "fs/promises";
import path from "path";

const ELEVENLABS_API = "https://api.elevenlabs.io";

export interface MultipartField {
  name: string;
  value: string;
}

export interface MultipartFileInput {
  name: string;
  filename: string;
  contentType: string;
  data: Uint8Array;
}

export class ElevenLabsHttpError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(statusCode: number, body: unknown) {
    super(`ElevenLabs API error (HTTP ${statusCode})`);
    this.name = "ElevenLabsHttpError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export function audioMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".flac":
      return "audio/flac";
    case ".m4a":
    case ".aac":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

export function buildMultipartBody(
  fields: MultipartField[],
  files: MultipartFileInput[],
): { body: Buffer; contentType: string } {
  const boundary = `----EL${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];

  for (const field of fields) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${field.name}"\r\n\r\n` +
        `${field.value}\r\n`,
    ));
  }

  for (const file of files) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n`,
    ));
    parts.push(Buffer.from(file.data));
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function readAudioUpload(
  audioPath: string,
): Promise<{ data: Uint8Array; filename: string; contentType: string }> {
  const info = await stat(audioPath);
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Audio file is missing or empty: ${audioPath}`);
  }

  const data = await readFile(audioPath);
  return {
    data,
    filename: path.basename(audioPath) || "audio.wav",
    contentType: audioMimeType(audioPath),
  };
}

function buildUrl(pathname: string, query?: Record<string, string | undefined>): string {
  const pathPart = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const base = `${ELEVENLABS_API}${pathPart}`;
  if (!query) return base;

  const params = Object.entries(query)
    .filter((entry): entry is [string, string] => entry[1] != null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return params ? `${base}?${params}` : base;
}

async function parseErrorBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Multipart POST that works when FormData polyfills cannot attach files to fetch. */
export async function postMultipart(
  apiKey: string,
  pathname: string,
  options: {
    query?: Record<string, string | undefined>;
    fields?: MultipartField[];
    files?: MultipartFileInput[];
  },
): Promise<Uint8Array> {
  const { body, contentType } = buildMultipartBody(
    options.fields ?? [],
    options.files ?? [],
  );

  const res = await fetch(buildUrl(pathname, options.query), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": contentType,
      "Content-Length": String(body.length),
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    throw new ElevenLabsHttpError(res.status, await parseErrorBody(res));
  }

  return new Uint8Array(await res.arrayBuffer());
}

export async function postMultipartJson<T>(
  apiKey: string,
  pathname: string,
  options: {
    query?: Record<string, string | undefined>;
    fields?: MultipartField[];
    files?: MultipartFileInput[];
  },
): Promise<T> {
  const { body, contentType } = buildMultipartBody(
    options.fields ?? [],
    options.files ?? [],
  );

  const res = await fetch(buildUrl(pathname, options.query), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": contentType,
      "Content-Length": String(body.length),
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    throw new ElevenLabsHttpError(res.status, await parseErrorBody(res));
  }

  return (await res.json()) as T;
}
