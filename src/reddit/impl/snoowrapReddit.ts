import Snoowrap from "snoowrap";
import { RedditInterface } from "../RedditInterface";
import {
  RedditCategory,
  RedditComment,
  RedditPost,
  Timespan,
} from "../types";

/**
 * snoowrap's published types are recursively thenable (every model is also a
 * Promise of itself), which trips TypeScript's TS1062 and makes them unusable
 * as return types. We only need a small subset of fields, so we treat the
 * snoowrap client as untyped at this boundary and map straight into the local
 * `RedditPost`/`RedditComment` shapes.
 */

interface RawSubmission {
  title: string;
  selftext: string;
  permalink: string;
  subreddit: { display_name: string };
  subreddit_name_prefixed: string;
  author: { name: string };
  created_utc: number;
  ups: number;
  num_comments: number;
  is_self: boolean;
  is_video: boolean;
  media: unknown;
  url: string;
}

interface RawComment {
  body: string;
  body_html: string;
  author: { name: string };
  created_utc: number;
  ups: number;
  score: number;
}

function mapSubmission(post: RawSubmission): RedditPost {
  return {
    title: post.title,
    selftext: post.selftext,
    permalink: post.permalink,
    subreddit: { display_name: post.subreddit.display_name },
    subreddit_name_prefixed: post.subreddit_name_prefixed,
    author: { name: post.author.name },
    created_utc: post.created_utc,
    ups: post.ups,
    num_comments: post.num_comments,
    is_self: post.is_self,
    is_video: post.is_video,
    media: post.media ?? null,
    url: post.url,
  };
}

function mapComment(comment: RawComment): RedditComment {
  return {
    body: comment.body,
    body_html: comment.body_html,
    author: { name: comment.author.name },
    created_utc: comment.created_utc,
    ups: comment.ups,
    score: comment.score,
  };
}

function extractPostId(permalink: string): string {
  const parts = permalink.split("/").filter(Boolean);
  const i = parts.indexOf("comments");
  if (i === -1 || !parts[i + 1]) {
    throw new Error(`Could not extract post id from permalink: ${permalink}`);
  }
  return parts[i + 1];
}

export class SnoowrapReddit implements RedditInterface {
  private client;

  constructor(
    clientId: string,
    clientSecret: string,
    username: string,
    password: string,
    userAgent: string = "reddit-maker"
  ) {
    this.client = new Snoowrap({
      clientId: clientId,
      clientSecret: clientSecret,
      username: username,
      password: password,
      userAgent: userAgent,
    });
  }

  // snoowrap's recursive thenable types are unusable; see file header.
  private get api(): any {
    return this.client;
  }

  async getPost(id: string): Promise<RedditPost> {
    const submission: RawSubmission = await this.api.getSubmission(id).fetch();
    return mapSubmission(submission);
  }

  async getTextOnlyPostFromList(
    subreddits: string[],
    category: RedditCategory = "hot",
    topTime: Timespan = "day",
    postLimit = 30
  ): Promise<RedditPost | null> {
    for (const subName of subreddits) {
      try {
        const subreddit = this.api.getSubreddit(subName);
        let posts: RawSubmission[];

        // Choose which method to call based on category
        if (category === "hot") {
          posts = await subreddit.getHot({ limit: postLimit });
        } else if (category === "new") {
          posts = await subreddit.getNew({ limit: postLimit });
        } else if (category === "top") {
          posts = await subreddit.getTop({ time: topTime, limit: postLimit });
        } else if (category === "controversial") {
          posts = await subreddit.getControversial({
            time: topTime,
            limit: postLimit,
          });
        } else {
          throw new Error(`Invalid category: ${category}`);
        }

        // Filter for text-only posts
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
          return mapSubmission(post);
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
    count: number = 5,
    _textOnly: boolean = true,
    _excludeMods: boolean = true
  ): Promise<RedditComment[]> {
    // The interface hands us a plain RedditPost, not a live snoowrap
    // Submission, so fetch the comment tree via the post id.
    const id = extractPostId(post.permalink);
    const refreshedPost = await this.api.getSubmission(id).fetch();
    const comments: RawComment[] = await refreshedPost.comments.fetchMore({
      amount: 100,
      skipReplies: true,
    });

    // Filter and sort manually (Reddit's API default sort is unreliable via snoowrap)
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
    if (username != "[deleted]") {
      return (await this.api.getUser(username).fetch()).icon_img;
    } else {
      return null;
    }
  }
}
