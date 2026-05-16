import { EdgeTTS } from "node-edge-tts";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { TtsInterface } from "../tts";

/**
 * TTS using Microsoft Edge's free online neural voices via node-edge-tts.
 * No API key, no account, no region lock — the credential-free option.
 *
 * node-edge-tts writes audio to a file, so getAudioAsBuffer renders to a
 * temp file and reads it back.
 */
export class EdgeTts implements TtsInterface {
  private tts: EdgeTTS;

  constructor(voice = "en-US-AriaNeural", lang = "en-US") {
    this.tts = new EdgeTTS({
      voice,
      lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    });
  }

  async getAudioAsBuffer(text: string): Promise<Buffer> {
    const tmpFile = path.join(os.tmpdir(), `edge-tts-${randomUUID()}.mp3`);
    try {
      await this.tts.ttsPromise(text, tmpFile);
      return await fs.readFile(tmpFile);
    } finally {
      await fs.rm(tmpFile, { force: true });
    }
  }

  async saveAudioBufferToFile(audio: Buffer, fileName: string) {
    await fs.writeFile(fileName, audio);
  }

  async getVoices() {
    return [
      "en-US-AriaNeural",
      "en-US-JennyNeural",
      "en-US-GuyNeural",
      "en-US-AnaNeural",
      "en-US-ChristopherNeural",
      "en-US-EricNeural",
      "en-US-MichelleNeural",
      "en-US-RogerNeural",
      "en-US-SteffanNeural",
      "en-GB-SoniaNeural",
      "en-GB-RyanNeural",
      "en-AU-NatashaNeural",
    ];
  }
}
