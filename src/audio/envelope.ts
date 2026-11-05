import { execFile } from "child_process";
import { promisify } from "util";
import { resolveFfmpegPath } from "../config/ffmpeg";

const execFileAsync = promisify(execFile);

/**
 * Per-frame voice level (0..1) from an audio file, for lip-sync. Decodes to
 * 8 kHz mono PCM with ffmpeg, takes the RMS of each frame window, normalises
 * to the 95th percentile and lightly smooths so mouth shapes don't chatter.
 */
export async function voiceEnvelope(audioFile: string, fps: number, durationSec: number): Promise<number[]> {
  const rate = 8000;
  const { stdout } = await execFileAsync(
    resolveFfmpegPath(),
    ["-hide_banner", "-loglevel", "error", "-i", audioFile, "-ac", "1", "-ar", String(rate), "-f", "s16le", "pipe:1"],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  );
  const pcm = stdout as unknown as Buffer;
  const samples = pcm.length / 2;
  const frames = Math.ceil(durationSec * fps);
  const window = rate / fps;
  const rms = new Array<number>(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    const start = Math.floor(f * window);
    const end = Math.min(samples, Math.floor((f + 1) * window));
    let acc = 0;
    let n = 0;
    for (let i = start; i < end; i++) {
      const v = pcm.readInt16LE(i * 2) / 32768;
      acc += v * v;
      n++;
    }
    rms[f] = n ? Math.sqrt(acc / n) : 0;
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const out = rms.map((v) => Math.min(1, v / (ref || 1)));
  // Attack fast, release slower: hold the mouth open a touch after a peak.
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] * 0.55);
  return out.map((v) => Math.round(v * 1000) / 1000);
}
