/**
 * Utility script to pre-download Reddit posts for offline use.
 * Run this while connected to wifi to cache posts for later offline generation.
 *
 * Usage: bun src/utils/cachePosts.ts [--count 25] [--subreddits AskReddit,TIFU]
 */
import axios from "axios";
import { mkdir, writeFile, readdir } from "fs/promises";
import path from "path";
import { subreddits as defaultSubreddits } from "../constants/subreddits";
import type { RawPostData, RawCommentData } from "../reddit/impl/jsonReddit";

const USER_AGENT = "reddit2shorts/1.0 (offline-cacher)";
const BASE_URL = "https://www.reddit.com";
const CACHE_DIR = path.resolve("cache", "posts");

interface CachedPost {
  post: RawPostData;
  comments: RawCommentData[];
  cachedAt: string;
}

interface Listing<T> {
  data: { children: { kind: string; data: T }[] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await axios.get<T>(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  return response.data;
}

async function fetchPostsFromSubreddit(
  subreddit: string,
  limit: number = 10,
  category: string = "hot"
): Promise<RawPostData[]> {
  try {
    const listing = await fetchJson<Listing<RawPostData>>(
      `${BASE_URL}/r/${subreddit}/${category}.json?limit=${limit}&t=week`
    );
    return listing.data.children
      .map((c) => c.data)
      .filter(
        (p) =>
          p.is_self &&
          !p.is_video &&
          !p.media &&
          p.selftext.length > 100 &&
          p.ups >= 500
      );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠️ Failed to fetch from r/${subreddit}: ${msg}`);
    return [];
  }
}

async function fetchComments(
  permalink: string
): Promise<RawCommentData[]> {
  try {
    const data = await fetchJson<[unknown, Listing<RawCommentData>]>(
      `${BASE_URL}${permalink}.json?limit=50`
    );
    return data[1].data.children
      .filter((c) => c.kind === "t1")
      .map((c) => c.data)
      .filter((c) => c.body !== "[deleted]" && c.body !== "[removed]");
  } catch {
    return [];
  }
}

function postIdFromPermalink(permalink: string): string {
  const parts = permalink.split("/").filter(Boolean);
  const idx = parts.indexOf("comments");
  return idx >= 0 ? parts[idx + 1] : permalink;
}

export async function cachePosts(options: {
  count?: number;
  subreddits?: string[];
  category?: string;
}) {
  const targetCount = options.count ?? 25;
  const subs = options.subreddits ?? defaultSubreddits.slice(0, 15);
  const category = options.category ?? "hot";

  await mkdir(CACHE_DIR, { recursive: true });

  // Check existing cache
  let existingFiles: string[] = [];
  try {
    existingFiles = (await readdir(CACHE_DIR)).filter((f) =>
      f.endsWith(".json")
    );
  } catch {}

  console.log(`📦 Offline Post Cacher`);
  console.log(`   Target: ${targetCount} posts`);
  console.log(`   Subreddits: ${subs.length}`);
  console.log(`   Existing cache: ${existingFiles.length} posts`);
  console.log("");

  let cached = 0;
  const perSub = Math.ceil(targetCount / subs.length) + 2;

  for (const sub of subs) {
    if (cached >= targetCount) break;

    console.log(`🔍 Fetching from r/${sub}...`);
    const posts = await fetchPostsFromSubreddit(sub, perSub, category);

    for (const post of posts) {
      if (cached >= targetCount) break;

      const id = postIdFromPermalink(post.permalink);
      const filename = `${post.subreddit}_${id}.json`;

      // Skip if already cached
      if (existingFiles.includes(filename)) {
        console.log(`   ⏭️ Already cached: ${post.title.slice(0, 50)}...`);
        continue;
      }

      // Fetch comments
      console.log(`   📥 Caching: ${post.title.slice(0, 50)}...`);
      const comments = await fetchComments(post.permalink);

      const cachedPost: CachedPost = {
        post,
        comments,
        cachedAt: new Date().toISOString(),
      };

      await writeFile(
        path.join(CACHE_DIR, filename),
        JSON.stringify(cachedPost, null, 2)
      );

      cached++;

      // Be nice to Reddit's rate limits
      await sleep(2000);
    }

    // Delay between subreddits
    await sleep(1500);
  }

  console.log(`\n✅ Done! Cached ${cached} new posts (total: ${existingFiles.length + cached})`);
  console.log(`   Location: ${CACHE_DIR}`);
}

// Run directly
if (import.meta.main || process.argv[1]?.includes("cachePosts")) {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf("--count");
  const subsIdx = args.indexOf("--subreddits");

  const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 25;
  const subredditList =
    subsIdx >= 0 ? args[subsIdx + 1]?.split(",") : undefined;

  cachePosts({ count, subreddits: subredditList }).catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
