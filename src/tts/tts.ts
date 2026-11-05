/** A single spoken word with its position in the synthesised audio. */
export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TtsResult {
  audio: Buffer;
  /** Word boundaries, when the provider can report them (may be empty). */
  words: WordTiming[];
}

export interface TtsInterface {
  getAudioAsBuffer(text: string): Promise<Buffer<ArrayBufferLike>>;
  saveAudioBufferToFile(audio: Buffer, fileName: string): void;
  getVoices(): Promise<unknown>;
  /**
   * Optional: synthesise and also return word-level timings. Used for
   * karaoke captions and lip-sync in the animated pipeline.
   */
  getAudioWithTimings?(text: string): Promise<TtsResult>;
}
