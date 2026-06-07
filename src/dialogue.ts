import type { DialogueLine } from "./elevenlabs-client.js";

/**
 * Parse a script with `1:` / `2:` speaker prefixes into dialogue inputs.
 */
export function parseDialogueScript(
  script: string,
  voiceA: string,
  voiceB: string,
): DialogueLine[] {
  const lines: DialogueLine[] = [];

  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(/^([12]):\s*(.+)$/);
    if (!match) continue;

    lines.push({
      text: match[2]!,
      voiceId: match[1] === "1" ? voiceA : voiceB,
    });
  }

  return lines;
}
