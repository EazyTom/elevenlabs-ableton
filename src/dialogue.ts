import type { DialogueLine } from "./elevenlabs-client.js";

const SPEAKER_VOICE: Record<string, (voices: DialogueVoices) => string> = {
  "1": (v) => v.voiceA,
  "2": (v) => v.voiceB,
  "3": (v) => v.voiceC,
};

export interface DialogueVoices {
  voiceA: string;
  voiceB: string;
  voiceC: string;
}

/**
 * Parse a script with `1:` / `2:` / `3:` speaker prefixes into dialogue inputs.
 */
export function parseDialogueScript(script: string, voices: DialogueVoices): DialogueLine[] {
  const lines: DialogueLine[] = [];

  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(/^([123]):\s*(.+)$/);
    if (!match) continue;

    const speaker = match[1]!;
    const resolveVoice = SPEAKER_VOICE[speaker];
    if (!resolveVoice) continue;

    lines.push({
      text: match[2]!,
      voiceId: resolveVoice(voices),
    });
  }

  return lines;
}
