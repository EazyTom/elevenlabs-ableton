interface ElevenLabsErrorDetail {
  message?: string;
  msg?: string;
  code?: string;
  type?: string;
  loc?: (string | number)[];
}

interface ElevenLabsErrorBody {
  detail?: ElevenLabsErrorDetail | ElevenLabsErrorDetail[] | string;
  message?: string;
}

function detailMessage(
  detail: ElevenLabsErrorDetail | ElevenLabsErrorDetail[] | string | undefined,
): string | undefined {
  if (!detail) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => item.msg ?? item.message)
      .filter((msg): msg is string => Boolean(msg));
    return messages.length ? messages.join("; ") : undefined;
  }
  return detail.message ?? detail.msg;
}

/** Turn ElevenLabs SDK / fetch errors into a short user-facing message. */
export function formatApiError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }

  const apiErr = err as Error & { statusCode?: number; body?: ElevenLabsErrorBody };
  const fromBody =
    detailMessage(apiErr.body?.detail) ??
    apiErr.body?.message;

  if (fromBody) {
    if (apiErr.statusCode) {
      return `${fromBody} (HTTP ${apiErr.statusCode})`;
    }
    return fromBody;
  }

  const msg = err.message;
  const statusMatch = msg.match(/Status code:\s*(\d+)/i);
  const bodyMatch = msg.match(/Body:\s*(\{[\s\S]*\})/);
  if (bodyMatch) {
    try {
      const parsed = JSON.parse(bodyMatch[1]!) as ElevenLabsErrorBody;
      const parsedMsg = detailMessage(parsed.detail) ?? parsed.message;
      if (parsedMsg) {
        const code = statusMatch?.[1] ?? (apiErr.statusCode ? String(apiErr.statusCode) : undefined);
        return code ? `${parsedMsg} (HTTP ${code})` : parsedMsg;
      }
    } catch {
      // use raw message below
    }
  }

  if (apiErr.statusCode && err.name === "UnprocessableEntityError") {
    return `Request validation failed (HTTP ${apiErr.statusCode})`;
  }

  const firstLine = msg.split("\n")[0]?.trim();
  return firstLine || "Unknown error";
}
