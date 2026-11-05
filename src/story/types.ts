/** Shared story/storyboard shapes for the animated pipeline. */

export type SceneName = "house" | "office" | "street" | "kitchen";

export type ActionName =
  | "talk" // idle gesturing while narrating
  | "chase" // both characters run across the frame
  | "gasp" // jump back, eyes wide, arms up
  | "facepalm" // palm to face, eyes closed, slump
  | "door_slam" // door prop swings shut, screen shake
  | "sweat" // nervous shiver + sweat drops
  | "anvil" // anvil drops on the other character
  | "reaction"; // punchline pop: jaw drop + bounce

export type Speaker = "crow" | "hedgehog";

export type BeatKind = "hook" | "story" | "verdict" | "outro";

export interface StoryBeat {
  id: number;
  kind: BeatKind;
  /** Text spoken by TTS and shown as captions. */
  text: string;
  speaker: Speaker;
  scene: SceneName;
  action: ActionName;
  /** Punchline beats trigger a reaction pose. */
  punchline: boolean;
}

export interface Storyboard {
  sourceId: string;
  subreddit: string;
  title: string;
  hook: string;
  beats: StoryBeat[];
}
