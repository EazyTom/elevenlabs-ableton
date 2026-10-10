import type { ExtensionContext } from "./live-selection.js";
import { secondsToBeats } from "./midi-io.js";
import type { TranscribedWord } from "./elevenlabs-client.js";

export interface LocatorSegment {
  timeSeconds: number;
  label: string;
}

const PAUSE_SPLIT_SECONDS = 0.8;

/** Section or chunk boundaries from a composeDetailed composition plan. */
export function musicLocatorSegments(plan: unknown): LocatorSegment[] {
  if (!plan || typeof plan !== "object") return [];
  const obj = plan as {
    sections?: Array<{ sectionName?: string; durationMs?: number }>;
    chunks?: Array<{
      text?: string;
      durationMs?: number;
      range?: { startMs?: number; endMs?: number };
    }>;
  };
  const segments: LocatorSegment[] = [];
  let ms = 0;

  if (obj.sections?.length) {
    for (const section of obj.sections) {
      segments.push({ timeSeconds: ms / 1000, label: section.sectionName?.trim() || "Section" });
      ms += section.durationMs ?? 0;
    }
    return segments;
  }

  for (const chunk of obj.chunks ?? []) {
    const header = chunk.text?.match(/^\[([^\]]+)\]/)?.[1];
    segments.push({ timeSeconds: ms / 1000, label: header?.trim() || "Section" });
    if (chunk.durationMs) ms += chunk.durationMs;
    else if (chunk.range) ms += (chunk.range.endMs ?? 0) - (chunk.range.startMs ?? 0);
  }
  return segments;
}

/** Group timed words into sentences on punctuation or a pause longer than 0.8s. */
export function sentencesFromWords(words: TranscribedWord[]): LocatorSegment[] {
  const timed = words.filter(
    (word) => word.type === "word" && word.text.trim() && word.start !== undefined,
  );
  const segments: LocatorSegment[] = [];
  let current: TranscribedWord[] = [];

  const flush = () => {
    if (!current.length) return;
    const text = current.map((word) => word.text.trim()).join(" ");
    segments.push({
      timeSeconds: current[0]!.start ?? 0,
      label: text.length > 48 ? `${text.slice(0, 45)}...` : text,
    });
    current = [];
  };

  for (const word of timed) {
    const previous = current[current.length - 1];
    if (previous?.end !== undefined && word.start !== undefined && word.start - previous.end > PAUSE_SPLIT_SECONDS) {
      flush();
    }
    current.push(word);
    if (/[.!?]$/.test(word.text.trim())) flush();
  }
  flush();
  return segments;
}

export interface DialogueVoiceSegment {
  startTimeSeconds: number;
  dialogueInputIndex: number;
}

const SPEAKER_LABELS = ["Speaker A", "Speaker B", "Speaker C"];

export function dialogueLocatorSegments(segments: DialogueVoiceSegment[]): LocatorSegment[] {
  return segments.map((segment) => ({
    timeSeconds: segment.startTimeSeconds,
    label: SPEAKER_LABELS[segment.dialogueInputIndex] ?? `Speaker ${segment.dialogueInputIndex + 1}`,
  }));
}

/** Create arrangement locators. Every createCuePoint starts inside one transaction. */
export async function addCuePoints(
  context: ExtensionContext,
  clipStartBeat: number,
  segments: LocatorSegment[],
): Promise<void> {
  if (!segments.length) return;
  const tempo = context.application.song.tempo;
  const song = context.application.song;
  const placements = segments.map((segment) => ({
    beat: clipStartBeat + secondsToBeats(segment.timeSeconds, tempo),
    label: segment.label.slice(0, 80),
  }));

  await context.withinTransaction(() =>
    Promise.all(
      placements.map((placement) =>
        song.createCuePoint(placement.beat).then((cue) => {
          cue.name = placement.label;
        }),
      ),
    ),
  );
}
