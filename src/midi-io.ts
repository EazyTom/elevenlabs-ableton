import type { NoteDescription } from "@ableton-extensions/sdk";
import type { AlignedWord, TranscribedWord } from "./elevenlabs-client.js";

/** MIDI pitch used for lyric marker notes (C4). */
export const LYRIC_MARKER_PITCH = 60;

export function secondsToBeats(seconds: number, tempo: number): number {
  return (seconds * tempo) / 60;
}

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

/**
 * Map timed words to short MIDI notes for lyric alignment markers.
 */
export function timedWordsToLyricNotes(
  words: TimedWord[],
  tempo: number,
  clipStartBeat: number,
  clipOffsetSeconds = 0,
): NoteDescription[] {
  const notes: NoteDescription[] = [];

  for (const word of words) {
    if (!word.text.trim()) continue;

    const startBeat = clipStartBeat + secondsToBeats(word.start - clipOffsetSeconds, tempo);
    const endBeat = clipStartBeat + secondsToBeats(word.end - clipOffsetSeconds, tempo);
    const duration = Math.max(endBeat - startBeat, 0.05);

    notes.push({
      pitch: LYRIC_MARKER_PITCH,
      startTime: startBeat,
      duration,
      velocity: 100,
    });
  }

  return notes;
}

/**
 * Map Scribe word timestamps to MIDI lyric markers.
 * Skips non-word tokens (laughter, footsteps, etc.).
 */
export function wordsToLyricNotes(
  words: TranscribedWord[],
  tempo: number,
  clipStartBeat: number,
  clipOffsetSeconds = 0,
): NoteDescription[] {
  const timed = words
    .filter((w) => w.type === "word" && w.text.trim() && w.start !== undefined && w.end !== undefined)
    .map((w) => ({ text: w.text, start: w.start!, end: w.end! }));

  return timedWordsToLyricNotes(timed, tempo, clipStartBeat, clipOffsetSeconds);
}

/** Map forced-alignment words (always timed) to MIDI lyric markers. */
export function alignedWordsToLyricNotes(
  words: AlignedWord[],
  tempo: number,
  clipStartBeat: number,
  clipOffsetSeconds = 0,
): NoteDescription[] {
  return timedWordsToLyricNotes(words, tempo, clipStartBeat, clipOffsetSeconds);
}
