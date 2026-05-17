import ffmpeg from "fluent-ffmpeg";
import { writeFile } from "fs/promises";
import type { CaptionStyle } from "../../config/videoConfig";

export interface CaptionSegment {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Convert a hex color string (#RRGGBB) to ASS color format (&HBBGGRR&).
 */
function hexToAss(hex: string): string {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `&H00${b}${g}${r}&`.toUpperCase();
}

/**
 * Convert a hex color with opacity to ASS alpha+color format (&HAABBGGRR).
 */
function hexToAssWithAlpha(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  const alpha = Math.round((1 - opacity) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `&H${alpha}${b}${g}${r}&`.toUpperCase();
}

/**
 * Convert milliseconds to ASS timestamp format (H:MM:SS.cc).
 */
function msToAssTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.round((totalSeconds % 1) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

/**
 * Get the ASS alignment value based on position.
 * ASS uses numpad-style alignment: 1-3 bottom, 4-6 middle, 7-9 top.
 */
function getAlignment(position: "top" | "middle" | "bottom"): number {
  switch (position) {
    case "top":
      return 8; // top-center
    case "middle":
      return 5; // middle-center
    case "bottom":
      return 2; // bottom-center
  }
}

/**
 * Get vertical margin based on position to avoid edges.
 */
function getMarginV(position: "top" | "middle" | "bottom"): number {
  switch (position) {
    case "top":
      return 80;
    case "middle":
      return 0;
    case "bottom":
      return 120;
  }
}

/**
 * Generate an ASS (Advanced SubStation Alpha) subtitle file with karaoke-style
 * word-by-word highlighting from TTS word timestamps.
 */
export async function generateKaraokeCaptions(
  segments: CaptionSegment[],
  style: CaptionStyle,
  outputPath: string
): Promise<void> {
  const alignment = getAlignment(style.position);
  const marginV = getMarginV(style.position);
  const primaryColor = hexToAss(style.fontColor);
  const outlineColor = hexToAss(style.strokeColor);
  const highlightColor = hexToAss(style.highlightColor);
  const backColor = hexToAssWithAlpha("#000000", style.bgOpacity);

  // Glow effect: use ASS shadow with blur for glow appearance
  const glowShadow = (style as any).glowEnabled ? 3 : 0;

  const header = `[Script Info]
Title: Reddit2Shorts Karaoke Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${primaryColor},${highlightColor},${outlineColor},${backColor},-1,0,0,0,100,100,0,0,1,${style.strokeWidth},${glowShadow},${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Group segments into lines (max ~5 words per line for readability)
  const maxWordsPerLine = 5;
  const lines: CaptionSegment[][] = [];
  let currentLine: CaptionSegment[] = [];

  for (const segment of segments) {
    currentLine.push(segment);
    if (currentLine.length >= maxWordsPerLine) {
      lines.push(currentLine);
      currentLine = [];
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Generate dialogue events with \kf karaoke tags
  const events: string[] = [];

  for (const line of lines) {
    const lineStart = line[0].startMs;
    const lineEnd = line[line.length - 1].endMs;

    const startTime = msToAssTime(lineStart);
    const endTime = msToAssTime(lineEnd);

    // Build karaoke text with \kf tags
    // \kf = karaoke fill (smooth highlight sweep)
    let karaokeText = "";
    for (const segment of line) {
      // Duration in centiseconds for this word
      const durationCs = Math.round((segment.endMs - segment.startMs) / 10);
      karaokeText += `{\\kf${durationCs}}${segment.word} `;
    }

    events.push(
      `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${karaokeText.trim()}`
    );
  }

  const assContent = header + events.join("\n") + "\n";
  await writeFile(outputPath, assContent, "utf-8");
}

/**
 * Burn ASS subtitles into a video using the ffmpeg subtitles filter.
 */
export async function burnCaptions(
  videoPath: string,
  assPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Escape backslashes and colons for the subtitles filter on Windows
    const escapedAssPath = assPath
      .replace(/\\/g, "/")
      .replace(/:/g, "\\:");

    ffmpeg()
      .input(videoPath)
      .videoFilters(`subtitles='${escapedAssPath}'`)
      .outputOptions([
        "-c:v libx264",
        "-crf 23",
        "-preset veryfast",
        "-c:a copy",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

