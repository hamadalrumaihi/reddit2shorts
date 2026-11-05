import { execFile } from "child_process";
import { promisify } from "util";
import { resolveFfmpegPath } from "../config/ffmpeg";

const execFileAsync = promisify(execFile);

export interface VoiceSegment {
  file: string;
  atSec: number;
}

export interface SfxPlacement {
  file: string;
  atSec: number;
  gainDb?: number;
}

export interface MixOptions {
  voice: VoiceSegment[];
  music?: string;
  /** Music level relative to the voice's mean loudness, in dB (default -18). */
  musicUnderVoiceDb?: number;
  sfx: SfxPlacement[];
  sfxGainDb?: number;
  durationSec: number;
  outFile: string;
  /** Also write the voice-only track here (used for lip-sync analysis). */
  voiceOnlyFile?: string;
}

async function ffmpeg(args: string[]): Promise<string> {
  const { stderr } = await execFileAsync(resolveFfmpegPath(), ["-hide_banner", "-y", ...args], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return stderr;
}

export async function meanVolumeDb(file: string): Promise<number> {
  const stderr = await ffmpeg(["-i", file, "-af", "volumedetect", "-f", "null", "-"]);
  const m = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/);
  return m ? Number(m[1]) : -20;
}

const ms = (sec: number) => Math.max(0, Math.round(sec * 1000));

/** Lay voice segments on a silent bed of `durationSec`. */
export async function renderVoiceTrack(voice: VoiceSegment[], durationSec: number, outFile: string): Promise<void> {
  const inputs: string[] = [];
  const chains: string[] = [];
  voice.forEach((v, i) => {
    inputs.push("-i", v.file);
    chains.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms(v.atSec)}|${ms(v.atSec)}[v${i}]`);
  });
  const labels = voice.map((_, i) => `[v${i}]`).join("");
  const graph = `${chains.join(";")};${labels}amix=inputs=${voice.length}:normalize=0:dropout_transition=0,apad=whole_dur=${durationSec}[out]`;
  await ffmpeg([...inputs, "-filter_complex", graph, "-map", "[out]", "-t", String(durationSec), "-ar", "48000", "-ac", "1", outFile]);
}

/**
 * Final mix: voice + background music (looped, sat at `musicUnderVoiceDb`
 * below the voice's mean level, and side-chain ducked while the voice is
 * active) + cartoon SFX at their timestamps. Output: AAC 192 kbps in an .m4a.
 */
export async function mixAudio(opts: MixOptions): Promise<void> {
  const voiceFile = opts.voiceOnlyFile || opts.outFile.replace(/\.[^.]+$/, "") + ".voice.wav";
  await renderVoiceTrack(opts.voice, opts.durationSec, voiceFile);

  const inputs: string[] = ["-i", voiceFile];
  const chains: string[] = [];
  let idx = 1;
  const mixLabels: string[] = ["[voiceOut]"];

  chains.push("[0:a]asplit=2[voiceOut][voiceSc]");

  if (opts.music) {
    const under = opts.musicUnderVoiceDb ?? -18;
    const [voiceDb, musicDb] = await Promise.all([meanVolumeDb(voiceFile), meanVolumeDb(opts.music)]);
    const gainDb = voiceDb + under - musicDb;
    inputs.push("-stream_loop", "-1", "-i", opts.music);
    chains.push(
      `[${idx}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${opts.durationSec},volume=${gainDb.toFixed(2)}dB,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, opts.durationSec - 1.8).toFixed(2)}:d=1.8[musicRaw]`,
      // Duck a further ~6 dB whenever the voice is present.
      `[musicRaw][voiceSc]sidechaincompress=threshold=0.02:ratio=6:attack=25:release=350:makeup=1[music]`
    );
    mixLabels.push("[music]");
    idx++;
  } else {
    chains.push("[voiceSc]anullsink");
  }

  const sfxGain = opts.sfxGainDb ?? -8;
  opts.sfx.forEach((s) => {
    inputs.push("-i", s.file);
    const g = sfxGain + (s.gainDb ?? 0);
    chains.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=mono,volume=${g.toFixed(2)}dB,adelay=${ms(s.atSec)}|${ms(s.atSec)}[sfx${idx}]`);
    mixLabels.push(`[sfx${idx}]`);
    idx++;
  });

  chains.push(
    `${mixLabels.join("")}amix=inputs=${mixLabels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=false,apad=whole_dur=${opts.durationSec}[out]`
  );

  await ffmpeg([
    ...inputs,
    "-filter_complex",
    chains.join(";"),
    "-map",
    "[out]",
    "-t",
    String(opts.durationSec),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    opts.outFile,
  ]);
}
