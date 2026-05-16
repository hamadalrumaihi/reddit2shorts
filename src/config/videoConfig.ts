export type AspectRatio = "9:16" | "1:1" | "16:9";
export type Resolution = "720p" | "1080p" | "1440p";

export interface VideoConfig {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  // Caption settings
  captionsEnabled: boolean;
  captionStyle: CaptionStyle;
  // Animations
  titleAnimation: AnimationType;
  commentAnimation: AnimationType;
  commentStaggerMs: number;
  // Overlays
  showSubredditLogo: boolean;
  usernameDisplay: "show" | "hide" | "anonymize";
  // Effects
  bgEffect: BgEffect;
  // Intro/outro
  introTemplatePath?: string;
  outroTemplatePath?: string;
  introDurationSec: number;
  outroDurationSec: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  strokeWidth: number;
  strokeColor: string;
  position: "top" | "middle" | "bottom";
  bgOpacity: number;
  highlightColor: string; // for karaoke word highlighting
}

export type AnimationType = "none" | "fade" | "slide" | "zoom" | "typewriter";
export type BgEffect = "none" | "blur" | "zoom" | "grayscale" | "warm" | "cool";

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Arial",
  fontSize: 48,
  fontColor: "#FFFFFF",
  strokeWidth: 3,
  strokeColor: "#000000",
  position: "bottom",
  bgOpacity: 0.6,
  highlightColor: "#FFDD00",
};

export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  aspectRatio: "9:16",
  resolution: "1080p",
  captionsEnabled: true,
  captionStyle: DEFAULT_CAPTION_STYLE,
  titleAnimation: "fade",
  commentAnimation: "slide",
  commentStaggerMs: 200,
  showSubredditLogo: true,
  usernameDisplay: "show",
  bgEffect: "blur",
  introDurationSec: 3,
  outroDurationSec: 4,
};

/**
 * Returns pixel dimensions for a given aspect ratio and resolution.
 */
export function getResolutionDimensions(
  ratio: AspectRatio,
  res: Resolution
): { width: number; height: number } {
  const map: Record<AspectRatio, Record<Resolution, { width: number; height: number }>> = {
    "9:16": {
      "720p": { width: 720, height: 1280 },
      "1080p": { width: 1080, height: 1920 },
      "1440p": { width: 1440, height: 2560 },
    },
    "1:1": {
      "720p": { width: 720, height: 720 },
      "1080p": { width: 1080, height: 1080 },
      "1440p": { width: 1440, height: 1440 },
    },
    "16:9": {
      "720p": { width: 1280, height: 720 },
      "1080p": { width: 1920, height: 1080 },
      "1440p": { width: 2560, height: 1440 },
    },
  };

  return map[ratio][res];
}
