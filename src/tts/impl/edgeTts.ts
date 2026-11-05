import { execFile } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { TtsInterface, TtsResult, WordTiming } from "../tts";

const execFileAsync = promisify(execFile);

/**
 * TTS using Microsoft Edge's free online neural voices. No API key.
 *
 * Two transports, tried in order:
 *  1. The `edge-tts` Python package via scripts/edge_tts_words.py. Microsoft
 *     rotates the handshake/DRM scheme a few times a year and the Python
 *     project tracks it within days, while Node ports lag (node-edge-tts
 *     currently gets HTTP 403). It also gives word boundaries, used for
 *     karaoke captions and lip-sync, and honours HTTPS_PROXY.
 *  2. node-edge-tts (bundled) as a fallback when Python is unavailable.
 *
 * Voice/rate/pitch are configurable: `--voice`, or EDGE_TTS_VOICE /
 * EDGE_TTS_RATE / EDGE_TTS_PITCH in .env.
 */
export interface EdgeTtsOptions {
  voice?: string;
  lang?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

export const DEFAULT_EDGE_VOICE = "en-US-AriaNeural";

/** Expressive English voices that read stories well. */
export const EXPRESSIVE_VOICES = [
  "en-US-AriaNeural", // expressive, default
  "en-US-AnaNeural", // young, bright (good for the crow)
  "en-US-GuyNeural", // warm male
  "en-US-ChristopherNeural", // deep male
  "en-US-JennyNeural",
  "en-US-EricNeural",
  "en-US-MichelleNeural",
  "en-US-RogerNeural",
  "en-US-SteffanNeural",
  "en-GB-SoniaNeural",
  "en-GB-RyanNeural",
  "en-AU-NatashaNeural",
  "en-US-AvaMultilingualNeural",
  "en-US-AndrewMultilingualNeural",
  "en-US-EmmaMultilingualNeural",
  "en-US-BrianMultilingualNeural",
];

const BRIDGE_SCRIPT = path.resolve(__dirname, "../../../scripts/edge_tts_words.py");

let pythonCandidate: string | null | undefined; // undefined = not probed yet

/** Find a python interpreter that has the edge_tts package installed. */
export async function findEdgeTtsPython(): Promise<string | null> {
  if (pythonCandidate !== undefined) return pythonCandidate;
  const candidates = [
    process.env.EDGE_TTS_PYTHON,
    "python3",
    "python",
    "py",
  ].filter((c): c is string => !!c);
  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, ["-c", "import edge_tts"], { timeout: 15_000 });
      pythonCandidate = cmd;
      return cmd;
    } catch {
      /* try next */
    }
  }
  pythonCandidate = null;
  return null;
}

export class EdgeTts implements TtsInterface {
  private readonly voice: string;
  private readonly lang: string;
  private readonly rate: string;
  private readonly pitch: string;
  private readonly volume: string;

  constructor(voiceOrOptions: string | EdgeTtsOptions = {}, lang = "en-US") {
    const opts: EdgeTtsOptions =
      typeof voiceOrOptions === "string" ? { voice: voiceOrOptions, lang } : voiceOrOptions;
    this.voice = opts.voice || process.env.EDGE_TTS_VOICE || DEFAULT_EDGE_VOICE;
    this.lang = opts.lang || lang;
    this.rate = opts.rate || process.env.EDGE_TTS_RATE || "+0%";
    this.pitch = opts.pitch || process.env.EDGE_TTS_PITCH || "+0Hz";
    this.volume = opts.volume || "+0%";
  }

  get voiceName(): string {
    return this.voice;
  }

  async getAudioAsBuffer(text: string): Promise<Buffer> {
    return (await this.getAudioWithTimings(text)).audio;
  }

  async getAudioWithTimings(text: string): Promise<TtsResult> {
    const python = await findEdgeTtsPython();
    const errors: string[] = [];
    if (python) {
      try {
        return await this.viaPython(python, text);
      } catch (err) {
        errors.push(`python edge-tts: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      errors.push("python edge-tts: not installed (pip install edge-tts)");
    }
    try {
      return await this.viaNode(text);
    } catch (err) {
      errors.push(`node-edge-tts: ${err instanceof Error ? err.message : String(err)}`);
    }
    throw new Error(
      `Edge TTS failed on every transport:\n  - ${errors.join("\n  - ")}\n` +
        `Fix: 'pip install edge-tts' (recommended) and make sure the network allows speech.platform.bing.com.`
    );
  }

  private async viaPython(python: string, text: string): Promise<TtsResult> {
    const id = randomUUID();
    const textFile = path.join(os.tmpdir(), `edge-tts-${id}.txt`);
    const outFile = path.join(os.tmpdir(), `edge-tts-${id}.mp3`);
    try {
      await fs.writeFile(textFile, text, "utf8");
      const args = [
        "-I",
        BRIDGE_SCRIPT,
        "--text-file",
        textFile,
        "--out",
        outFile,
        "--voice",
        this.voice,
        "--rate",
        this.rate,
        "--pitch",
        this.pitch,
        "--volume",
        this.volume,
      ];
      const { stdout } = await execFileAsync(python, args, {
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        env: process.env,
      });
      const words = JSON.parse(stdout.trim() || "[]") as WordTiming[];
      const audio = await fs.readFile(outFile);
      return { audio, words };
    } finally {
      await fs.rm(textFile, { force: true });
      await fs.rm(outFile, { force: true });
    }
  }

  private async viaNode(text: string): Promise<TtsResult> {
    const { EdgeTTS } = await import("node-edge-tts");
    const tts = new EdgeTTS({
      voice: this.voice,
      lang: this.lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      saveSubtitles: true,
      rate: this.rate,
      pitch: this.pitch,
      proxy: process.env.HTTPS_PROXY || process.env.https_proxy,
      timeout: 30_000,
    });
    const tmpFile = path.join(os.tmpdir(), `edge-tts-${randomUUID()}.mp3`);
    try {
      await tts.ttsPromise(text, tmpFile);
      const audio = await fs.readFile(tmpFile);
      let words: WordTiming[] = [];
      try {
        const raw = JSON.parse(await fs.readFile(`${tmpFile}.json`, "utf8")) as {
          part: string;
          start: number;
          end: number;
        }[];
        words = raw.map((w) => ({ word: w.part, startMs: w.start, endMs: w.end }));
      } catch {
        /* subtitles are best-effort */
      }
      return { audio, words };
    } finally {
      await fs.rm(tmpFile, { force: true });
      await fs.rm(`${tmpFile}.json`, { force: true });
    }
  }

  async saveAudioBufferToFile(audio: Buffer, fileName: string) {
    await fs.writeFile(fileName, audio);
  }

  async getVoices() {
    return EXPRESSIVE_VOICES;
  }
}
