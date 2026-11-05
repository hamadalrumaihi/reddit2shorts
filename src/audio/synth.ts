/**
 * Tiny procedural audio synthesiser. Everything the animated pipeline needs
 * for sound (cartoon SFX and the background swing loop) is generated here from
 * code, so every output is royalty-free by construction: no downloads, no
 * attribution, no licence to track. Users can still drop in their own
 * royalty-free music with `--music <file>`.
 *
 * Output: 16-bit PCM WAV, mono, 44.1 kHz.
 */

export const SAMPLE_RATE = 44_100;

type Signal = Float32Array;

function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

function silence(seconds: number): Signal {
  return new Float32Array(Math.max(1, Math.round(seconds * SAMPLE_RATE)));
}

/** Add `src` into `dst` starting at `atSec`, scaled by `gain`. */
function mixInto(dst: Signal, src: Signal, atSec: number, gain = 1): void {
  const offset = Math.round(atSec * SAMPLE_RATE);
  const end = Math.min(dst.length, offset + src.length);
  for (let i = Math.max(0, offset); i < end; i++) dst[i] += src[i - offset] * gain;
}

/** Exponential decay envelope. */
function decayEnv(i: number, decaySec: number): number {
  return Math.exp(-i / (decaySec * SAMPLE_RATE));
}

/** Attack/decay/sustain/release envelope value at sample i of n. */
function adsr(i: number, n: number, a: number, d: number, s: number, r: number): number {
  const t = i / SAMPLE_RATE;
  const total = n / SAMPLE_RATE;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t > total - r) return s * Math.max(0, (total - t) / r);
  return s;
}

/** Sine with a frequency function (Hz at time t). Phase-continuous. */
function sweep(seconds: number, freqAt: (t: number) => number, amp: (t: number, i: number) => number): Signal {
  const out = silence(seconds);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += (2 * Math.PI * freqAt(t)) / SAMPLE_RATE;
    out[i] = Math.sin(phase) * amp(t, i);
  }
  return out;
}

function softClip(x: number): number {
  return Math.tanh(x);
}

/** Simple resonant band-pass (biquad, recomputed per sample for sweeps). */
function bandpassSweep(input: Signal, centreAt: (t: number) => number, q = 2): Signal {
  const out = new Float32Array(input.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const f = Math.min(centreAt(i / SAMPLE_RATE), SAMPLE_RATE * 0.45);
    const w0 = (2 * Math.PI * f) / SAMPLE_RATE;
    const alpha = Math.sin(w0) / (2 * q);
    const b0 = alpha,
      b1 = 0,
      b2 = -alpha;
    const a0 = 1 + alpha,
      a1 = -2 * Math.cos(w0),
      a2 = 1 - alpha;
    const x0 = input[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

function onePoleLowpass(input: Signal, cutoffHz: number): Signal {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const a = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    y += a * (input[i] - y);
    out[i] = y;
  }
  return out;
}

function noise(seconds: number, rand: () => number): Signal {
  const out = silence(seconds);
  for (let i = 0; i < out.length; i++) out[i] = rand() * 2 - 1;
  return out;
}

function normalize(sig: Signal, peak = 0.9): Signal {
  let max = 0;
  for (let i = 0; i < sig.length; i++) max = Math.max(max, Math.abs(sig[i]));
  if (max === 0) return sig;
  const g = peak / max;
  for (let i = 0; i < sig.length; i++) sig[i] *= g;
  return sig;
}

/** Encode a mono float signal as a 16-bit PCM WAV buffer. */
export function encodeWav(sig: Signal, sampleRate = SAMPLE_RATE): Buffer {
  const bytesPerSample = 2;
  const dataSize = sig.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buf.writeUInt16LE(bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < sig.length; i++) {
    const v = Math.max(-1, Math.min(1, sig[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Cartoon sound effects
// ---------------------------------------------------------------------------

export type SfxName =
  | "boing"
  | "whoosh"
  | "slide_up"
  | "slide_down"
  | "clang"
  | "door_slam"
  | "pop"
  | "sparkle"
  | "gasp"
  | "tiptoe"
  | "drip";

export function synthSfx(name: SfxName): Signal {
  const rand = seededRandom(name.length * 7919 + 17);
  switch (name) {
    case "boing": {
      // Spring: pitch drops fast while a wobble grows, classic rubber-hose boing.
      const sig = sweep(
        0.75,
        (t) => 420 * Math.exp(-t * 3.2) + 95 + Math.sin(t * 2 * Math.PI * 17) * (28 + t * 60),
        (t, i) => decayEnv(i, 0.28) * (1 - Math.min(1, t / 0.75)) * 0.9
      );
      for (let i = 0; i < sig.length; i++) sig[i] = softClip(sig[i] * 1.8) * 0.8;
      return sig;
    }
    case "whoosh": {
      const n = noise(0.45, rand);
      const bp = bandpassSweep(n, (t) => 300 + 3500 * Math.sin((Math.PI * t) / 0.45), 1.2);
      for (let i = 0; i < bp.length; i++) bp[i] *= adsr(i, bp.length, 0.08, 0.1, 0.8, 0.2);
      return normalize(bp, 0.7);
    }
    case "slide_up":
      return sweep(0.6, (t) => 520 + 1100 * (t / 0.6), (t, i) => adsr(i, 0.6 * SAMPLE_RATE, 0.02, 0.05, 0.9, 0.12) * 0.6);
    case "slide_down":
      return sweep(0.7, (t) => 1500 - 1050 * (t / 0.7), (t, i) => adsr(i, 0.7 * SAMPLE_RATE, 0.02, 0.05, 0.9, 0.15) * 0.6);
    case "clang": {
      // Anvil: sub thump + metallic partials ringing out.
      const out = silence(1.1);
      mixInto(out, sweep(0.35, (t) => 90 - 50 * t, (_, i) => decayEnv(i, 0.12)), 0, 0.9);
      const partials = [1830, 2745, 3610, 4420];
      partials.forEach((f, k) =>
        mixInto(out, sweep(1.0, () => f, (_, i) => decayEnv(i, 0.35 - k * 0.06)), 0.004, 0.22 / (k + 1))
      );
      const burst = onePoleLowpass(noise(0.05, rand), 3000);
      mixInto(out, burst, 0, 0.6);
      for (let i = 0; i < out.length; i++) out[i] = softClip(out[i] * 1.4) * 0.85;
      return out;
    }
    case "door_slam": {
      const out = silence(0.55);
      const burst = onePoleLowpass(noise(0.06, rand), 1800);
      for (let i = 0; i < burst.length; i++) burst[i] *= decayEnv(i, 0.02);
      mixInto(out, burst, 0, 1.2);
      mixInto(out, sweep(0.3, (t) => 120 - 60 * t, (_, i) => decayEnv(i, 0.09)), 0.002, 0.9);
      // rattle
      for (let k = 0; k < 4; k++) {
        const r = onePoleLowpass(noise(0.02, rand), 2500);
        mixInto(out, r, 0.08 + k * 0.045, 0.25 / (k + 1));
      }
      for (let i = 0; i < out.length; i++) out[i] = softClip(out[i] * 1.3) * 0.85;
      return out;
    }
    case "pop":
      return sweep(0.09, (t) => 900 - 5000 * t, (_, i) => decayEnv(i, 0.03) * 0.7);
    case "drip":
      return sweep(0.18, (t) => 600 + 900 * t, (_, i) => decayEnv(i, 0.07) * 0.5);
    case "sparkle": {
      const out = silence(0.5);
      [1320, 1760, 2640].forEach((f, k) => mixInto(out, sweep(0.45, () => f, (_, i) => decayEnv(i, 0.18)), k * 0.04, 0.3));
      return out;
    }
    case "gasp": {
      const n = noise(0.32, rand);
      const bp = bandpassSweep(n, (t) => 500 + 2200 * (t / 0.32), 1.5);
      for (let i = 0; i < bp.length; i++) bp[i] *= adsr(i, bp.length, 0.05, 0.05, 0.9, 0.1);
      return normalize(bp, 0.35);
    }
    case "tiptoe": {
      const out = silence(0.5);
      for (let k = 0; k < 4; k++) {
        mixInto(out, sweep(0.05, () => 1000 + k * 150, (_, i) => decayEnv(i, 0.012)), k * 0.11, 0.5);
      }
      return out;
    }
  }
}

/** SFX used by each storyboard action (first fires at action onset). */
export const ACTION_SFX: Record<string, SfxName[]> = {
  chase: ["whoosh", "tiptoe"],
  gasp: ["gasp", "slide_up"],
  facepalm: ["slide_down", "pop"],
  door_slam: ["door_slam"],
  sweat: ["drip"],
  anvil: ["slide_down", "clang"],
  reaction: ["boing", "sparkle"],
  talk: [],
};

// ---------------------------------------------------------------------------
// Background music: a jaunty 1940s-style swing loop
// ---------------------------------------------------------------------------

const NOTE = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Karplus-Strong plucked string (banjo/ukulele comp). */
function pluck(freq: number, seconds: number, rand: () => number, brightness = 0.5): Signal {
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);
  const period = Math.max(2, Math.round(SAMPLE_RATE / freq));
  const buf = new Float32Array(period);
  for (let i = 0; i < period; i++) buf[i] = rand() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx];
    const next = buf[(idx + 1) % period];
    out[i] = cur;
    buf[idx] = (cur * brightness + next * (1 - brightness)) * 0.996;
    idx = (idx + 1) % period;
  }
  return out;
}

/** Xylophone-ish mallet: fundamental + stretched partial, quick decay. */
function mallet(freq: number, seconds: number): Signal {
  const out = silence(seconds);
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] =
      (Math.sin(2 * Math.PI * freq * t) * 0.8 + Math.sin(2 * Math.PI * freq * 3.02 * t) * 0.25 * decayEnv(i, 0.08)) *
      decayEnv(i, 0.22) *
      Math.min(1, t / 0.003);
  }
  return out;
}

/** Upright bass: filtered pluck with a round attack. */
function bass(freq: number, seconds: number, rand: () => number): Signal {
  const raw = pluck(freq, seconds, rand, 0.3);
  const lp = onePoleLowpass(raw, 420);
  for (let i = 0; i < lp.length; i++) lp[i] *= Math.min(1, i / (0.006 * SAMPLE_RATE)) * decayEnv(i, 0.45);
  return lp;
}

interface Chord {
  root: number; // midi
  type: "maj" | "min" | "dom7";
}

const PROGRESSION: Chord[] = [
  { root: 60, type: "maj" }, // C
  { root: 60, type: "maj" },
  { root: 65, type: "maj" }, // F
  { root: 67, type: "dom7" }, // G7
  { root: 60, type: "maj" },
  { root: 57, type: "min" }, // Am
  { root: 62, type: "min" }, // Dm
  { root: 67, type: "dom7" }, // G7
];

function chordTones(c: Chord): number[] {
  const third = c.type === "min" ? 3 : 4;
  const tones = [c.root, c.root + third, c.root + 7];
  if (c.type === "dom7") tones.push(c.root + 10);
  return tones;
}

const PENTATONIC = [0, 2, 4, 7, 9]; // relative to C

/**
 * Generate `seconds` of swing music at `bpm`. Deterministic for a seed, so the
 * same track is produced on every machine.
 */
export function synthMusic(seconds: number, seed = 1940, bpm = 168): Signal {
  const rand = seededRandom(seed);
  const out = silence(seconds + 1.5);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const bars = Math.ceil(seconds / bar);
  const swing = 0.66; // offbeat lands at 2/3 of the beat

  // Melody motif: two bars, regenerated every 8 bars, repeated with variation.
  let motif: (number | null)[] = [];
  const newMotif = () =>
    Array.from({ length: 16 }, (_, k) =>
      rand() < 0.28 && k % 2 === 1 ? null : PENTATONIC[Math.floor(rand() * 5)] + 12 * (rand() < 0.3 ? 1 : 0)
    );

  for (let b = 0; b < bars; b++) {
    const chord = PROGRESSION[b % PROGRESSION.length];
    const tones = chordTones(chord);
    const t0 = b * bar;
    if (b % 8 === 0) motif = newMotif();

    // Walking bass: root, 5th, 3rd/6th, approach note.
    const walk = [tones[0] - 12, tones[2] - 12, tones[1] - 12, tones[0] - 12 + (rand() < 0.5 ? 2 : -1)];
    walk.forEach((m, k) => mixInto(out, bass(NOTE(m), beat * 0.95, rand), t0 + k * beat, 0.55));

    // Banjo comp on the swung offbeats, chord stab on 2 and 4.
    for (let k = 0; k < 4; k++) {
      const at = t0 + k * beat + beat * swing;
      tones.forEach((m, j) => mixInto(out, pluck(NOTE(m + 12), beat * 0.6, rand, 0.55), at + j * 0.004, 0.16));
      if (k === 1 || k === 3) {
        // brushed snare
        const snare = onePoleLowpass(noise(0.07, rand), 5000);
        for (let i = 0; i < snare.length; i++) snare[i] *= decayEnv(i, 0.025);
        mixInto(out, snare, t0 + k * beat, 0.16);
      }
    }

    // Melody: swung eighths from the motif, transposed to the chord's root octave.
    const motifBar = motif.slice((b % 2) * 8, (b % 2) * 8 + 8);
    motifBar.forEach((deg, k) => {
      if (deg === null) return;
      const beatIndex = Math.floor(k / 2);
      const at = t0 + beatIndex * beat + (k % 2 === 1 ? beat * swing : 0);
      const midi = 72 + deg + (chord.type === "min" && deg === 4 ? -1 : 0);
      const accent = k % 2 === 0 ? 0.42 : 0.3;
      mixInto(out, mallet(NOTE(midi), 0.35), at, accent);
    });

    // Woodblock pickup every other bar for bounce.
    if (b % 2 === 1) mixInto(out, sweep(0.04, () => 1250, (_, i) => decayEnv(i, 0.01)), t0 + 3 * beat + beat * swing, 0.25);
  }

  const trimmed = out.slice(0, Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < trimmed.length; i++) trimmed[i] = softClip(trimmed[i] * 1.2);
  return normalize(trimmed, 0.8);
}
