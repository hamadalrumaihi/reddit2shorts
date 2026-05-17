/**
 * Social media metadata generator.
 *
 * Auto-generates optimized titles, descriptions, hashtags, and hooks
 * for TikTok, YouTube Shorts, and Instagram Reels.
 */

import { RedditPost } from "../reddit/types";

export type Platform = "tiktok" | "youtube_shorts" | "reels" | "all";

export interface VideoMetadata {
  title: string;
  description: string;
  hashtags: string[];
  hook: string; // First 3 seconds text overlay / spoken hook
  thumbnailText: string;
  scheduleSuggestion?: string;
}

export interface MetadataOptions {
  platform: Platform;
  style: "viral" | "storytelling" | "controversial" | "wholesome" | "brainrot";
  includeCallToAction: boolean;
  maxTitleLength?: number;
  maxDescriptionLength?: number;
}

const DEFAULT_OPTIONS: MetadataOptions = {
  platform: "all",
  style: "viral",
  includeCallToAction: true,
  maxTitleLength: 100,
  maxDescriptionLength: 2200,
};

// Platform-specific hashtag sets
const PLATFORM_HASHTAGS: Record<Platform, string[]> = {
  tiktok: [
    "fyp",
    "foryou",
    "foryoupage",
    "viral",
    "xyzbca",
    "trending",
    "storytime",
  ],
  youtube_shorts: [
    "shorts",
    "youtubeshorts",
    "viral",
    "subscribe",
    "trending",
  ],
  reels: [
    "reels",
    "instareels",
    "reelsinstagram",
    "viral",
    "explore",
    "trending",
  ],
  all: ["fyp", "viral", "shorts", "storytime", "reddit", "trending"],
};

// Topic-based hashtags by subreddit category
const TOPIC_HASHTAGS: Record<string, string[]> = {
  askreddit: ["askreddit", "redditstories", "redditreadings", "askredditq"],
  tifu: ["tifu", "storytime", "embarrassing", "fails", "cringe"],
  amitheasshole: ["aita", "redditjudgment", "drama", "amithebadguy"],
  relationship_advice: [
    "relationship",
    "dating",
    "love",
    "toxic",
    "redflags",
  ],
  prorevenge: ["revenge", "pettyrevenge", "karma", "justice", "satisfying"],
  maliciouscompliance: [
    "maliciouscompliance",
    "karma",
    "boss",
    "work",
    "satisfying",
  ],
  confession: ["confession", "secret", "storytime", "deepconfession"],
  nosleep: ["creepy", "scary", "horror", "nosleep", "paranormal"],
  entitledparents: ["entitled", "karen", "entitledparents", "drama"],
  showerthoughts: ["showerthoughts", "deepthoughts", "mindblown", "facts"],
};

// Hook templates by style
const HOOK_TEMPLATES: Record<string, string[]> = {
  viral: [
    "Wait for it... this is INSANE",
    "I literally can't believe this happened",
    "This story broke the internet",
    "You won't believe what happened next",
    "This is the craziest thing I've ever read",
    "Stop scrolling. You NEED to hear this",
    "POV: you read the most unhinged Reddit post ever",
  ],
  storytelling: [
    "So this person posted on Reddit and...",
    "Okay so hear me out on this one",
    "This story had me HOOKED from the start",
    "Let me tell you about this wild Reddit post",
    "Gather around because this story is WILD",
  ],
  controversial: [
    "This post made everyone lose their minds",
    "The comments section was a WARZONE",
    "People are SO divided on this one",
    "Hot take incoming... hear me out",
    "This opinion got them absolutely COOKED",
  ],
  wholesome: [
    "Okay this actually made me cry",
    "Faith in humanity: restored",
    "This is the most wholesome thing ever",
    "I needed this today honestly",
    "This story hits different at 2am",
  ],
  brainrot: [
    "Bro this post has me DECEASED no cap",
    "Skibidi level unhinged behavior right here",
    "Chat is this real? I'm literally cooked",
    "Ohio level Reddit post just dropped",
    "The sigma grindset of this poster tho",
    "Nah fam this can't be real 💀",
    "Bro thought he was the main character",
  ],
};

// CTA templates
const CTA_TEMPLATES: Record<Platform, string[]> = {
  tiktok: [
    "Follow for more Reddit stories! 📖",
    "Like if this was wild 🔥 Part 2?",
    "Comment what you would've done 👇",
    "Follow for daily Reddit content!",
    "Stitch this with your reaction!",
  ],
  youtube_shorts: [
    "Subscribe for daily Reddit stories!",
    "Like and subscribe for more! 🔔",
    "Comment your opinion below 👇",
    "Hit subscribe — new stories every day!",
    "Drop a like if you want Part 2!",
  ],
  reels: [
    "Save this for later! 🔖",
    "Share this with someone who needs to see it!",
    "Follow for more stories from Reddit!",
    "Tag someone who would do this 😂",
    "Send this to your bestie 💀",
  ],
  all: [
    "Follow for more! New stories daily 🔥",
    "Like + Follow for Part 2!",
    "Comment what you think 👇",
  ],
};

/**
 * Generate an attention-grabbing hook for the first 3 seconds.
 */
function generateHook(post: RedditPost, style: string): string {
  const templates = HOOK_TEMPLATES[style] || HOOK_TEMPLATES.viral;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate topic-relevant hashtags based on the subreddit.
 */
function getTopicHashtags(subreddit: string): string[] {
  const key = subreddit.toLowerCase();
  return TOPIC_HASHTAGS[key] || ["reddit", "redditstories", "storytime"];
}

/**
 * Generate a viral-optimized title from the post.
 */
function generateTitle(
  post: RedditPost,
  style: string,
  maxLength: number
): string {
  const base = post.title.replace(/\?$/, "").trim();

  const prefixes: Record<string, string[]> = {
    viral: ["😱", "🔥", "💀", "⚠️", "🚨"],
    storytelling: ["📖", "✨", "🎬", "📚"],
    controversial: ["⚠️", "🔥", "😤", "💢"],
    wholesome: ["🥺", "❤️", "✨", "🥹"],
    brainrot: ["💀", "🗿", "😭", "☠️", "🤡"],
  };

  const suffixes: Record<string, string[]> = {
    viral: [" #shorts", " 😱", " (INSANE)", " (WILD)"],
    storytelling: [" #storytime", " (full story)", " pt.1"],
    controversial: [" (controversial)", " 🔥", " (debate this)"],
    wholesome: [" ❤️", " (wholesome)", " 🥹"],
    brainrot: [" 💀💀💀", " (im cooked)", " no cap", " (real)"],
  };

  const prefix =
    (prefixes[style] || prefixes.viral)[
      Math.floor(Math.random() * (prefixes[style] || prefixes.viral).length)
    ];
  const suffix =
    (suffixes[style] || suffixes.viral)[
      Math.floor(Math.random() * (suffixes[style] || suffixes.viral).length)
    ];

  let title = `${prefix} ${base}${suffix}`;
  if (title.length > maxLength) {
    title = `${prefix} ${base}`.slice(0, maxLength - 3) + "...";
  }

  return title;
}

/**
 * Generate a full description with hashtags and CTA.
 */
function generateDescription(
  post: RedditPost,
  options: MetadataOptions,
  hashtags: string[]
): string {
  const parts: string[] = [];

  // Main description
  const subredditTag = `From r/${post.subreddit.display_name}`;
  parts.push(subredditTag);

  // Add CTA
  if (options.includeCallToAction) {
    const ctas = CTA_TEMPLATES[options.platform] || CTA_TEMPLATES.all;
    parts.push("");
    parts.push(ctas[Math.floor(Math.random() * ctas.length)]);
  }

  // Add hashtags
  parts.push("");
  parts.push(hashtags.map((h) => `#${h}`).join(" "));

  const desc = parts.join("\n");
  return options.maxDescriptionLength
    ? desc.slice(0, options.maxDescriptionLength)
    : desc;
}

/**
 * Generate optimized metadata for a video from a Reddit post.
 */
export function generateVideoMetadata(
  post: RedditPost,
  options: Partial<MetadataOptions> = {}
): VideoMetadata {
  const opts: MetadataOptions = { ...DEFAULT_OPTIONS, ...options };

  // Build hashtags
  const platformTags = PLATFORM_HASHTAGS[opts.platform] || PLATFORM_HASHTAGS.all;
  const topicTags = getTopicHashtags(post.subreddit.display_name);
  const hashtags = [...new Set([...platformTags, ...topicTags])].slice(0, 15);

  // Generate each field
  const title = generateTitle(post, opts.style, opts.maxTitleLength || 100);
  const hook = generateHook(post, opts.style);
  const description = generateDescription(post, opts, hashtags);

  // Thumbnail text (short punchy text for thumbnail)
  const thumbnailText = post.title.length > 50
    ? post.title.slice(0, 47) + "..."
    : post.title;

  return {
    title,
    description,
    hashtags,
    hook,
    thumbnailText,
  };
}

/**
 * Generate metadata for multiple platforms at once.
 */
export function generateMultiPlatformMetadata(
  post: RedditPost,
  style: MetadataOptions["style"] = "viral"
): Record<Platform, VideoMetadata> {
  const platforms: Platform[] = ["tiktok", "youtube_shorts", "reels"];
  const result: Partial<Record<Platform, VideoMetadata>> = {};

  for (const platform of platforms) {
    result[platform] = generateVideoMetadata(post, { platform, style });
  }

  // "all" is a combined best-of
  result.all = generateVideoMetadata(post, { platform: "all", style });

  return result as Record<Platform, VideoMetadata>;
}
