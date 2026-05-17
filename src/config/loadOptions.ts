import { readFileSync, existsSync } from "fs";
import type { Command } from "commander";

/**
 * Resolves effective CLI options with precedence:
 *   explicit CLI flag  >  --preset  >  config file  >  commander default
 *
 * Config file (default ./reddit2shorts.config.json) and presets use the same
 * keys as the camelCase option names (e.g. "minScore", "maxDuration",
 * "subreddits", "source").
 */

type OptionBag = Record<string, unknown>;

export const PRESETS: Record<string, OptionBag> = {
  "askreddit-story": {
    subreddits: ["AskReddit"],
    category: "top",
    timeSpan: "week",
    commentsCount: "15",
  },
  "tifu-narrative": {
    subreddits: ["tifu"],
    category: "top",
    timeSpan: "month",
    commentsCount: "0",
  },
  "aita-judgment": {
    subreddits: ["AmItheAsshole"],
    category: "top",
    timeSpan: "week",
    commentsCount: "8",
  },
  "shower-thought": {
    subreddits: ["Showerthoughts"],
    category: "top",
    timeSpan: "day",
    commentsCount: "5",
    maxDuration: "30",
  },
  // --- Viral / Influencer presets ---
  "brainrot": {
    subreddits: ["AskReddit", "AmItheAsshole", "tifu", "confession"],
    category: "top",
    timeSpan: "day",
    commentsCount: "5",
    maxDuration: "30",
    voiceStyle: "brainrot",
    generateMetadata: true,
    metadataStyle: "brainrot",
    trending: true,
  },
  "genz-viral": {
    subreddits: ["AskReddit", "TrueOffMyChest", "confession"],
    category: "hot",
    timeSpan: "day",
    commentsCount: "8",
    maxDuration: "45",
    voiceStyle: "genz",
    generateMetadata: true,
    metadataStyle: "viral",
  },
  "ultra-short": {
    subreddits: ["Showerthoughts", "AskReddit"],
    category: "top",
    timeSpan: "day",
    commentsCount: "3",
    maxDuration: "15",
    voiceStyle: "genz",
    generateMetadata: true,
  },
  "tiktok-viral": {
    subreddits: ["AskReddit", "AmItheAsshole", "tifu", "ProRevenge"],
    category: "top",
    timeSpan: "week",
    commentsCount: "6",
    maxDuration: "59",
    voiceStyle: "normal",
    generateMetadata: true,
    metadataStyle: "viral",
    platform: "tiktok",
    trending: true,
  },
  "reels-storytelling": {
    subreddits: ["tifu", "LetsNotMeet", "NuclearRevenge", "ProRevenge"],
    category: "top",
    timeSpan: "month",
    commentsCount: "4",
    maxDuration: "59",
    voiceStyle: "normal",
    generateMetadata: true,
    metadataStyle: "storytelling",
    platform: "reels",
  },
  "controversial-bait": {
    subreddits: ["AmItheAsshole", "unpopularopinion", "TrueOffMyChest"],
    category: "controversial",
    timeSpan: "week",
    commentsCount: "10",
    maxDuration: "59",
    voiceStyle: "genz",
    generateMetadata: true,
    metadataStyle: "controversial",
  },
};

function loadConfigFile(path: string): OptionBag | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    console.warn(`⚠️ Ignoring invalid config file: ${path}`);
    return null;
  }
}

export function resolveOptions<T>(program: Command): T {
  const opts = program.opts() as OptionBag;

  const presetName = opts.preset as string | undefined;
  let preset: OptionBag | undefined;
  if (presetName) {
    preset = PRESETS[presetName];
    if (!preset) {
      console.error(
        `Error: unknown --preset "${presetName}". Available: ${Object.keys(
          PRESETS
        ).join(", ")}`
      );
      process.exit(1);
    }
  }

  const configPath =
    (opts.config as string) || "reddit2shorts.config.json";
  const fileCfg = loadConfigFile(configPath) ?? {};

  const merged: OptionBag = { ...opts };
  const candidates = new Set([
    ...Object.keys(fileCfg),
    ...Object.keys(preset ?? {}),
  ]);

  for (const key of candidates) {
    // Explicit CLI flags always win.
    if (program.getOptionValueSource(key) === "cli") continue;
    if (preset && key in preset) merged[key] = preset[key];
    else if (key in fileCfg) merged[key] = fileCfg[key];
  }

  return merged as T;
}
