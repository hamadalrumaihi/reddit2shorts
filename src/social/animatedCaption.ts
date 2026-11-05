import { RedditPost } from "../reddit/types";

/**
 * Caption for the animated shorts: hook + "Follow for part 2" + exactly five
 * niche hashtags, plus an AI-disclosure line (Instagram has no API flag for
 * the AI label, so the disclosure lives in the caption; TikTok direct posts
 * also set `is_aigc`).
 */

const NICHE_HASHTAGS: Record<string, string[]> = {
  amitheasshole: ["aita", "amitheasshole", "redditdrama", "familydrama", "cartoonstory"],
  aitah: ["aitah", "aita", "redditdrama", "storytime", "cartoonstory"],
  tifu: ["tifu", "redditstories", "funnystory", "fail", "cartoonstory"],
  askreddit: ["askreddit", "redditstories", "storytime", "redditreadings", "cartoonstory"],
  maliciouscompliance: ["maliciouscompliance", "workstories", "pettyrevenge", "redditstories", "cartoonstory"],
  prorevenge: ["prorevenge", "revengestory", "redditstories", "karma", "cartoonstory"],
  pettyrevenge: ["pettyrevenge", "revengestory", "redditstories", "satisfying", "cartoonstory"],
  nosleep: ["nosleep", "creepystories", "redditstories", "horrorstory", "cartoonstory"],
  relationship_advice: ["relationshipadvice", "redflags", "redditstories", "dating", "cartoonstory"],
  entitledparents: ["entitledparents", "karenstories", "redditstories", "drama", "cartoonstory"],
  trueoffmychest: ["trueoffmychest", "confession", "redditstories", "storytime", "cartoonstory"],
  confession: ["confession", "redditconfessions", "storytime", "redditstories", "cartoonstory"],
};

const DEFAULT_HASHTAGS = ["redditstories", "storytime", "animatedstory", "cartoon", "reddit"];

export interface AnimatedCaption {
  caption: string;
  hashtags: string[];
  hook: string;
  cta: string;
  aiDisclosure: string;
}

export function nicheHashtags(subreddit: string): string[] {
  const key = subreddit.toLowerCase().replace(/^r\//, "");
  return (NICHE_HASHTAGS[key] || DEFAULT_HASHTAGS).slice(0, 5);
}

export function buildAnimatedCaption(post: RedditPost, hook: string): AnimatedCaption {
  const hashtags = nicheHashtags(post.subreddit.display_name);
  const cta = "Follow for part 2";
  const aiDisclosure = "AI-assisted animation. Story from r/" + post.subreddit.display_name + ".";
  const caption = [hook, cta, aiDisclosure, hashtags.map((h) => `#${h}`).join(" ")].join("\n\n");
  return { caption, hashtags, hook, cta, aiDisclosure };
}
