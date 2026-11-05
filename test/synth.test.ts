import { test, expect } from "bun:test";
import { encodeWav, synthMusic, synthSfx, SAMPLE_RATE } from "../src/audio/synth";

test("sfx are short, non-silent and bounded", () => {
  for (const name of ["boing", "whoosh", "clang", "door_slam", "slide_up"] as const) {
    const s = synthSfx(name);
    expect(s.length).toBeGreaterThan(SAMPLE_RATE * 0.05);
    expect(s.length).toBeLessThan(SAMPLE_RATE * 1.5);
    let peak = 0;
    for (let i = 0; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(1);
  }
});

test("music is deterministic for a seed and encodes to a valid WAV header", () => {
  const a = synthMusic(2, 1940);
  const b = synthMusic(2, 1940);
  expect(a.length).toBe(2 * SAMPLE_RATE);
  expect(Array.from(a.slice(1000, 1010))).toEqual(Array.from(b.slice(1000, 1010)));
  const wav = encodeWav(a);
  expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
  expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
  expect(wav.readUInt32LE(24)).toBe(SAMPLE_RATE);
  expect(wav.length).toBe(44 + a.length * 2);
});
