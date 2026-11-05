import { test, expect } from "bun:test";
import { collectNames, sanitizeStory } from "../src/story/sanitize";
import { writeHookRuleBased } from "../src/story/hook";
import { buildStoryboard, detectAction, detectScene, groupIntoBeats, htmlToText, splitSentences } from "../src/story/beats";
import { buildAnimatedCaption, nicheHashtags } from "../src/social/animatedCaption";
import { parseUploadPlatforms } from "../src/upload/animatedUpload";
import type { RedditPost, RedditComment } from "../src/reddit/types";

const post: RedditPost = {
  title: "AITA for not letting my friend use the photographer she refused to hire with me?",
  selftext:
    "I (28F) asked my friend Elena, u/elena_x, to split a photographer. Elena said no. Later Elena stormed off and slammed the door. Visit https://example.com or email me@example.com.\n\nEdit: thanks everyone!",
  permalink: "/r/AmItheAsshole/comments/abc123/aita_for_x/",
  subreddit: { display_name: "AmItheAsshole" },
  subreddit_name_prefixed: "r/AmItheAsshole",
  author: { name: "someone" },
  created_utc: 1_700_000_000,
  ups: 5000,
  num_comments: 300,
  is_self: true,
  is_video: false,
  media: null,
  url: "https://www.reddit.com/r/AmItheAsshole/comments/abc123/aita_for_x/",
};

const comment = (body: string, ups = 100): RedditComment => ({
  body,
  body_html: `&lt;div class="md"&gt;&lt;p&gt;${body}&lt;/p&gt;&lt;/div&gt;`,
  author: { name: "x" },
  created_utc: 1_700_000_100,
  ups,
  score: ups,
});

test("sanitizeStory strips handles, links, emails, age tags and edit blocks", () => {
  const out = sanitizeStory(post.selftext);
  expect(out).not.toContain("u/elena_x");
  expect(out).not.toContain("https://");
  expect(out).not.toContain("@example.com");
  expect(out).not.toContain("28F");
  expect(out).not.toMatch(/edit:/i);
});

test("sanitizeStory swaps repeated first names for stand-ins consistently", () => {
  const out = sanitizeStory(post.selftext);
  expect(out).not.toContain("Elena");
  const standIns = out.match(/\b(Sam|Alex|Jo|Max|Robin|Kit|Lee|Remy|Quinn|Ash)\b/g) || [];
  expect(standIns.length).toBeGreaterThanOrEqual(3);
  expect(new Set(standIns).size).toBe(1);
});

test("collectNames finds a name introduced in the body and reused in a comment", () => {
  const names = collectNames(["My coworker Priya is great.", "Priya is right."]);
  expect(names.has("Priya")).toBe(true);
});

test("writeHookRuleBased turns AITA/TIFU titles into short hooks", () => {
  expect(writeHookRuleBased(post)).toBe("Am I wrong for not letting my friend use the photographer?");
  const tifu = { ...post, title: "TIFU by locking myself out of my own apartment on moving day", subreddit: { display_name: "tifu" } };
  const hook = writeHookRuleBased(tifu);
  expect(hook.startsWith("I messed up")).toBe(true);
  expect(hook.split(/\s+/).length).toBeLessThanOrEqual(11);
});

test("beats: sentences group under the word budget and get scenes/actions", () => {
  const sentences = splitSentences("I ran to the kitchen. The dinner was burning! My boss called me into the office.");
  expect(sentences).toHaveLength(3);
  const beats = groupIntoBeats(sentences, 8);
  expect(beats.length).toBeGreaterThanOrEqual(2);
  expect(detectScene("we cooked dinner in the kitchen", "house")).toBe("kitchen");
  expect(detectScene("my boss and the meeting", "house")).toBe("office");
  expect(detectAction("she stormed off and slammed the door", 0)).toBe("door_slam");
  expect(detectAction("I ran after the bus", 0)).toBe("chase");
});

test("htmlToText decodes entity-escaped Reddit HTML", () => {
  expect(htmlToText(comment("NTA she is not your friend").body_html)).toBe("NTA she is not your friend");
});

test("buildStoryboard produces hook, story, verdict and outro beats with speakers", () => {
  const sb = buildStoryboard(post, [comment("NTA Elena is not your friend."), comment("ESH honestly")], "Am I wrong?");
  const kinds = sb.beats.map((b) => b.kind);
  expect(kinds[0]).toBe("hook");
  expect(kinds).toContain("story");
  expect(kinds).toContain("verdict");
  expect(kinds[kinds.length - 1]).toBe("outro");
  expect(sb.beats.find((b) => b.kind === "verdict")?.speaker).toBe("hedgehog");
  expect(sb.beats.find((b) => b.kind === "verdict")?.text).toContain("Not the jerk");
  expect(sb.beats.some((b) => b.text.includes("Elena"))).toBe(false);
  expect(sb.sourceId).toBe("abc123");
});

test("animated caption = hook + follow CTA + exactly five niche hashtags", () => {
  const c = buildAnimatedCaption(post, "Am I wrong?");
  expect(c.hashtags).toHaveLength(5);
  expect(c.caption.startsWith("Am I wrong?")).toBe(true);
  expect(c.caption).toContain("Follow for part 2");
  expect(c.caption.match(/#\w+/g)).toHaveLength(5);
  expect(nicheHashtags("tifu")[0]).toBe("tifu");
});

test("parseUploadPlatforms accepts comma lists and 'all'", () => {
  expect(parseUploadPlatforms("tiktok-api,instagram")).toEqual(["tiktok-api", "instagram"]);
  expect(parseUploadPlatforms("all")).toEqual(["tiktok-api", "instagram", "youtube"]);
  expect(parseUploadPlatforms(undefined)).toEqual([]);
  expect(() => parseUploadPlatforms("myspace")).toThrow();
});
