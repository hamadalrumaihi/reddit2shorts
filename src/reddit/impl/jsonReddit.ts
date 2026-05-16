import axios, { AxiosError } from "axios";
import { RedditInterface } from "../RedditInterface";
import {
  RedditCategory,
  RedditComment,
  RedditPost,
  Timespan,
} from "../types";

/**
 * A {@link RedditInterface} implementation backed by Reddit's public `.json`
 * endpoints. No OAuth, no credentials, no snoowrap.
 *
 * Reddit blocks requests with an empty or default user agent, so every call
 * sends an explicit one.
 */

const USER_AGENT = "reddit2shorts/1.0 (json-mode)";
const BASE_URL = "https://www.reddit.com";
const RATE_LIMIT_WAIT_MS = 60_000;

// Minimal shapes of the parts of Reddit's JSON responses we read.
interface RawPostData {
  title: string;
  selftext: string;
  permalink: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  author: string;
  created_utc: number;
  ups: number;
  num_comments: number;
  is_self: boolean;
  is_video: boolean;
  media: unknown;
  url: string;
}

interface RawCommentData {
  body: string;
  body_html: string;
  author: string;
  created_utc: number;
  ups: number;
  score: number;
}

interface Listing<T> {
  data: { children: { kind: string; data: T }[] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapPost(data: RawPostData): RedditPost {
  return {
    title: data.title,
    selftext: data.selftext,
    permalink: data.permalink,
    subreddit: { display_name: data.subreddit },
    subreddit_name_prefixed: data.subreddit_name_prefixed,
    author: { name: data.author },
    created_utc: data.created_utc,
    ups: data.ups,
    num_comments: data.num_comments,
    is_self: data.is_self,
    is_video: data.is_video,
    media: data.media ?? null,
    url: data.url,
  };
}

function mapComment(data: RawCommentData): RedditComment {
  return {
    body: data.body,
    body_html: data.body_html,
    author: { name: data.author },
    created_utc: data.created_utc,
    ups: data.ups,
    score: data.score,
  };
}

export class JsonReddit implements RedditInterface {
  private async fetchJson<T>(url: string): Promise<T> {
    try {
      const response = await axios.get<T>(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      return response.data;
    } catch (error) {
      if (
        error instanceof AxiosError &&
        error.response?.status === 429
      ) {
        // Rate limited: wait a minute and retry exactly once.
        await sleep(RATE_LIMIT_WAIT_MS);
        const retry = await axios.get<T>(url, {
          headers: { "User-Agent": USER_AGENT },
        });
        return retry.data;
      }
      throw error;
    }
  }

  async getPost(id: string): Promise<RedditPost> {
    const data = await this.fetchJson<[Listing<RawPostData>, unknown]>(
      `${BASE_URL}/comments/${id}.json?limit=100`
    );
    const child = data[0]?.data?.children?.[0]?.data;
    if (!child) {
      throw new Error(`No post found for id: ${id}`);
    }
    return mapPost(child);
  }

  async getTextOnlyPostFromList(
    subreddits: string[],
    category: RedditCategory = "hot",
    topTime: Timespan = "day",
    postLimit = 30
  ): Promise<RedditPost | null> {
    for (const subName of subreddits) {
      try {
        const listing = await this.fetchJson<Listing<RawPostData>>(
          `${BASE_URL}/r/${subName}/${category}.json?limit=${postLimit}&t=${topTime}`
        );

        const posts = listing.data.children.map((c) => c.data);

        const textOnlyPosts = posts.filter(
          (post) =>
            post.is_self &&
            !post.is_video &&
            !post.media &&
            !post.url.match(/\.(jpg|jpeg|png|gif|mp4|webm)$/i) &&
            !post.url.includes("i.redd.it") &&
            !post.url.includes("imgur.com")
        );

        if (textOnlyPosts.length > 0) {
          const post =
            textOnlyPosts[Math.floor(Math.random() * textOnlyPosts.length)];
          return mapPost(post);
        }
      } catch (error) {
        let message = "Unknown error";
        if (error instanceof Error) message = error.message;
        console.warn(`⚠️ Error fetching from r/${subName}: ${message}`);
      }
    }

    console.log("❌ No text-only post found in the given list.");
    return null;
  }

  async getTopComments(
    post: RedditPost,
    count: number = 5
  ): Promise<RedditComment[]> {
    const data = await this.fetchJson<[unknown, Listing<RawCommentData>]>(
      `${BASE_URL}${post.permalink}.json?limit=100`
    );

    const comments = data[1].data.children
      .filter((c) => c.kind === "t1")
      .map((c) => c.data);

    const sorted = [...comments].sort((a, b) => b.score - a.score);

    const filtered = sorted.filter((comment) => {
      if (comment.body == "[deleted]" || comment.body == "[removed]") {
        return false;
      }
      if (comment.body.length > 500) return false;
      if (comment.ups < 10) return false;
      return true;
    });

    return filtered.slice(0, count).map(mapComment);
  }

  async getUserAvatarIfExists(username: string): Promise<string | null> {
    if (username === "[deleted]") {
      return null;
    }
    try {
      const data = await this.fetchJson<{ data: { icon_img?: string } }>(
        `${BASE_URL}/user/${username}/about.json`
      );
      return data.data.icon_img || null;
    } catch {
      return null;
    }
  }
}
