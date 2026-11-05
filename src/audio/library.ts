import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { encodeWav, SfxName, synthMusic, synthSfx } from "./synth";

/**
 * On-disk cache for generated audio (cache/audio/). Files are deterministic,
 * so they are written once and reused by every later run.
 */
export const AUDIO_CACHE_DIR = path.resolve("cache", "audio");

const ALL_SFX: SfxName[] = [
  "boing",
  "whoosh",
  "slide_up",
  "slide_down",
  "clang",
  "door_slam",
  "pop",
  "sparkle",
  "gasp",
  "tiptoe",
  "drip",
];

export async function ensureSfxLibrary(): Promise<Record<SfxName, string>> {
  await mkdir(path.join(AUDIO_CACHE_DIR, "sfx"), { recursive: true });
  const out = {} as Record<SfxName, string>;
  for (const name of ALL_SFX) {
    const file = path.join(AUDIO_CACHE_DIR, "sfx", `${name}.wav`);
    if (!existsSync(file)) await writeFile(file, encodeWav(synthSfx(name)));
    out[name] = file;
  }
  return out;
}

/**
 * Background music: a user-supplied royalty-free file (`--music`), or the
 * generated swing loop (60 s, looped by the mixer as needed).
 */
export async function ensureMusic(custom?: string, seed = 1940): Promise<string> {
  if (custom) {
    if (!existsSync(custom)) throw new Error(`--music file not found: ${custom}`);
    return custom;
  }
  await mkdir(AUDIO_CACHE_DIR, { recursive: true });
  const file = path.join(AUDIO_CACHE_DIR, `cartoon-swing-${seed}.wav`);
  if (!existsSync(file)) await writeFile(file, encodeWav(synthMusic(60, seed)));
  return file;
}
