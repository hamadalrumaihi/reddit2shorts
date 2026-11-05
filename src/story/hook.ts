import { RedditPost } from "../reddit/types";
import { sanitizeStory } from "./sanitize";

/**
 * Rewrites a post title into a ~2 second spoken hook (6-9 words). Deterministic
 * rules per subreddit; Gemini is used when a key is configured and the rules
 * produce something awkward.
 */

const MAX_HOOK_WORDS = 9;

function trimWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return words.slice(0, max).join(" ").replace(/[,;:\-–—]$/, "") + "...";
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stripTrailingPunct(s: string): string {
  return s.replace(/[\s.?!]+$/, "");
}

export function writeHookRuleBased(post: RedditPost): string {
  const sub = post.subreddit.display_name.toLowerCase();
  let title = sanitizeStory(post.title).replace(/\s+/g, " ").trim();

  // Strip common prefixes / tags.
  title = title.replace(/^\[?(serious|update|final update|meta)\]?\s*[:-]?\s*/i, "");

  const aita = title.match(/^(aita|wibta|am i the a\S*|would i be the a\S*)\s+(for|if|because)?\s*(.*)$/i);
  if (aita || sub === "amitheasshole" || sub === "aitah") {
    const rest = aita ? aita[3] : title;
    const trimmed = trimWords(stripTrailingPunct(rest), 7);
    const lead = aita && /^if$/i.test(aita[2] || "") ? "Would I be wrong if " : "Am I wrong for ";
    return capitalise(`${lead}${trimmed.replace(/\.\.\.$/, "")}?`);
  }

  const tifu = title.match(/^tifu\s+(by|because|when)?\s*(.*)$/i);
  if (tifu || sub === "tifu") {
    const rest = tifu ? tifu[2] : title;
    return capitalise(`I messed up ${trimWords(stripTrailingPunct(rest), 7)}`);
  }

  if (title.includes("?")) {
    // AskReddit-style question: keep it, tighten it.
    return capitalise(trimWords(stripTrailingPunct(title), MAX_HOOK_WORDS) + "?").replace(/\?\?$/, "?");
  }

  // Generic: first sentence of the title, tightened.
  const firstSentence = title.split(/(?<=[.!?])\s+/)[0];
  const hook = trimWords(stripTrailingPunct(firstSentence), MAX_HOOK_WORDS);
  return capitalise(hook.endsWith("...") ? hook : `${hook}.`);
}

/**
 * Optionally polish the hook with Gemini (only when GEMINI_API_KEY is set).
 * Falls back to the rule-based hook on any failure.
 */
export async function writeHook(post: RedditPost): Promise<string> {
  const ruleBased = writeHookRuleBased(post);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || process.env.HOOK_WRITER === "rules") return ruleBased;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      `Rewrite this Reddit post title as a spoken hook for a short video. ` +
      `Max 8 words, first person, punchy, no hashtags, no emojis, no names, no quotes. ` +
      `Return only the hook.\nTitle: ${post.title}\nDraft: ${ruleBased}`;
    const res = await Promise.race([
      ai.models.generateContent({ model: "gemini-2.0-flash-lite", contents: prompt }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 12_000)),
    ]);
    const text = (res.text || "").trim().split("\n")[0].replace(/^["']|["']$/g, "");
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 3 && words.length <= 10) return sanitizeStory(text);
  } catch {
    /* fall back */
  }
  return ruleBased;
}
