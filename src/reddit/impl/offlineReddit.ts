import { readdir, readFile } from "fs/promises";
import path from "path";
import { RedditInterface } from "../RedditInterface";
import {
  passesPostFilters,
  PostFilters,
  RedditCategory,
  RedditComment,
  RedditPost,
  Timespan,
} from "../types";
import { mapPost, mapComment, RawPostData, RawCommentData } from "./jsonReddit";
import { getSeenIds, isPermalinkSeen } from "../../utils/seenPosts";

/**
 * Offline implementation of {@link RedditInterface}.
 * Reads from cached JSON files in `cache/posts/` instead of hitting the network.
 *
 * Each cached file is a JSON object with shape:
 * {
 *   post: RawPostData,
 *   comments: RawCommentData[]
 * }
 */

const CACHE_DIR = path.resolve("cache", "posts");

interface CachedPost {
  post: RawPostData;
  comments: RawCommentData[];
  cachedAt: string; // ISO timestamp
}

export class OfflineReddit implements RedditInterface {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? CACHE_DIR;
  }

  private async loadAllCached(): Promise<CachedPost[]> {
    try {
      const files = await readdir(this.cacheDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      const posts: CachedPost[] = [];

      for (const file of jsonFiles) {
        try {
          const content = await readFile(
            path.join(this.cacheDir, file),
            "utf-8"
          );
          posts.push(JSON.parse(content));
        } catch {
          // Skip malformed files
        }
      }

      return posts;
    } catch {
      throw new Error(
        `Offline cache not found at ${this.cacheDir}. ` +
          `Run 'cache-posts.bat' while connected to wifi first.`
      );
    }
  }

  async getPost(id: string): Promise<RedditPost> {
    const all = await this.loadAllCached();
    const match = all.find((cached) => {
      const parts = cached.post.permalink.split("/").filter(Boolean);
      const commentsIdx = parts.indexOf("comments");
      return commentsIdx >= 0 && parts[commentsIdx + 1] === id;
    });

    if (!match) {
      throw new Error(
        `Post ${id} not found in offline cache. Available posts: ${all.length}`
      );
    }

    return mapPost(match.post);
  }

  async getTextOnlyPostFromList(
    subreddits: string[],
    _category: RedditCategory = "hot",
    _topTime: Timespan = "day",
    _postLimit = 30,
    filters: PostFilters = {}
  ): Promise<RedditPost | null> {
    const all = await this.loadAllCached();
    const seen = getSeenIds();

    // Filter to posts from the requested subreddits
    const subLower = new Set(subreddits.map((s) => s.toLowerCase()));

    const eligible = all.filter((cached) => {
      const post = cached.post;
      if (!subLower.has(post.subreddit.toLowerCase())) return false;
      if (!post.is_self) return false;
      if (post.is_video) return false;
      if (post.media) return false;
      if (isPermalinkSeen(post.permalink, seen)) return false;

      return passesPostFilters(
        {
          ups: post.ups,
          numComments: post.num_comments,
          createdUtc: post.created_utc,
          over18: post.over_18,
          bodyLength: post.selftext.length,
        },
        filters
      );
    });

    if (eligible.length === 0) {
      console.log(
        `❌ No eligible offline posts found. Cache has ${all.length} total posts.`
      );
      return null;
    }

    // Pick a random eligible post
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    return mapPost(pick.post);
  }

  async getTopComments(
    post: RedditPost,
    count: number = 5
  ): Promise<RedditComment[]> {
    const all = await this.loadAllCached();
    const match = all.find(
      (cached) => cached.post.permalink === post.permalink
    );

    if (!match || !match.comments) {
      return [];
    }

    const sorted = [...match.comments].sort((a, b) => b.score - a.score);

    const filtered = sorted.filter((comment) => {
      if (comment.body === "[deleted]" || comment.body === "[removed]")
        return false;
      if (comment.body.length > 500) return false;
      if (comment.ups < 10) return false;
      return true;
    });

    return filtered.slice(0, count).map(mapComment);
  }

  async getUserAvatarIfExists(_username: string): Promise<string | null> {
    // Avatars are not cached in offline mode
    return null;
  }
}
