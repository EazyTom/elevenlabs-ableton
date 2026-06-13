import type { DialogueLine } from "./elevenlabs-client.js";

export type DialogueSpeaker = "A" | "B" | "C";

const SPEAKER_VOICE: Record<DialogueSpeaker, (voices: DialogueVoices) => string | undefined> = {
  A: (v) => v.voiceA,
  B: (v) => v.voiceB,
  C: (v) => v.voiceC,
};

export interface DialogueVoices {
  voiceA: string;
  voiceB: string;
  voiceC?: string;
}

/** Accept `A:` / `B:` / `C:` (also legacy `1:` / `2:` / `3:`). */
export function normalizeSpeakerPrefix(token: string): DialogueSpeaker | null {
  const upper = token.toUpperCase();
  if (upper === "A" || token === "1") return "A";
  if (upper === "B" || token === "2") return "B";
  if (upper === "C" || token === "3") return "C";
  return null;
}

const LINE_PREFIX_RE = /^([ABCabc123]):\s*(.+)$/;

function speakersInScript(script: string): Set<DialogueSpeaker> {
  const speakers = new Set<DialogueSpeaker>();
  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(LINE_PREFIX_RE);
    if (!match) continue;
    const speaker = normalizeSpeakerPrefix(match[1]!);
    if (speaker) speakers.add(speaker);
  }
  return speakers;
}

/** Returns a user-facing error message, or null when the script and voices are valid. */
export function validateDialogueInput(script: string, voices: DialogueVoices): string | null {
  const speakers = speakersInScript(script);

  if (speakers.size === 0) {
    return (
      "No dialogue lines found. Prefix each line with A:, B:, or C:\n\n" +
      "Example:\nA: Hello there\nB: Hi, how are you?\nC: [excited] Count me in!"
    );
  }

  if (!voices.voiceA?.trim()) {
    return "Select a voice for Speaker A.";
  }
  if (!voices.voiceB?.trim()) {
    return "Select a voice for Speaker B.";
  }
  if (speakers.has("C") && !voices.voiceC?.trim()) {
    return "Select a voice for Speaker C — your script includes C: lines.";
  }

  return null;
}

/**
 * Parse a script with `A:` / `B:` / `C:` speaker prefixes into dialogue inputs.
 * Legacy `1:` / `2:` / `3:` prefixes are still accepted.
 */
export function parseDialogueScript(script: string, voices: DialogueVoices): DialogueLine[] {
  const lines: DialogueLine[] = [];

  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(LINE_PREFIX_RE);
    if (!match) continue;

    const speaker = normalizeSpeakerPrefix(match[1]!);
    if (!speaker) continue;

    const voiceId = SPEAKER_VOICE[speaker](voices);
    if (!voiceId) continue;

    lines.push({
      text: match[2]!,
      voiceId,
    });
  }

  return lines;
}
