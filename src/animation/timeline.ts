import { StoryBeat } from "../story/types";
import type { SfxName } from "../audio/synth";

/** Word with absolute timestamps (ms from the start of the video). */
export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TimedBeat extends StoryBeat {
  startSec: number;
  endSec: number;
  durationSec: number;
  words: TimedWord[];
  /** Path to the beat's voice file (mp3). */
  audioFile: string;
}

export interface SfxEvent {
  atSec: number;
  name: SfxName;
  gainDb?: number;
}

export interface Timeline {
  fps: number;
  width: number;
  height: number;
  durationSec: number;
  hook: string;
  title: string;
  subreddit: string;
  sourceId: string;
  beats: TimedBeat[];
  /** Per-frame voice level 0..1 (whole track), used for mouth flaps. */
  mouth: number[];
  sfx: SfxEvent[];
  seed: number;
}
