import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import fs from "fs/promises";
import { TtsInterface } from "../tts";
import { requireEnv } from "../../config/env";

export class GoogleCloudTts implements TtsInterface {
  private client;
  private languageCode;
  private voiceName;
  private gender;
  constructor(
    languageCode = "en-US",
    voiceName = "en-US-Wavenet-F", // Try different voices like en-US-Wavenet-D, etc.
    gender = "FEMALE"
  ) {
    this.languageCode = languageCode;
    this.voiceName = voiceName;
    this.gender = gender;
    this.client = new TextToSpeechClient({
      credentials: JSON.parse(
        requireEnv("GOOGLE_CREDENTIALS", "--tts google (Google Cloud TTS)")
      ),
    });
  }
  async getAudioAsBuffer(text: string) {
    const [response] = await this.client.synthesizeSpeech({
      input: {
        text,
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
      voice: {
        languageCode: this.languageCode,
        name: this.voiceName,
        ssmlGender:
          protos.google.cloud.texttospeech.v1.SsmlVoiceGender[
          this
            .gender as keyof typeof protos.google.cloud.texttospeech.v1.SsmlVoiceGender
          ],
      },
    });
    if (!response.audioContent) {
      throw new Error("No audio content returned from Google TTS.");
    }
    return Buffer.isBuffer(response.audioContent)
      ? response.audioContent
      : Buffer.from(response.audioContent);
  }
  async saveAudioBufferToFile(sound: Buffer, fileName: string) {
    await fs.writeFile(fileName, sound);
  }

  async getVoices() {
    return (await this.client.listVoices())[0].voices;
  }
}
