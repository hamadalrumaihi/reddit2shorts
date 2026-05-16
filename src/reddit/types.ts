/**
 * Local, minimal Reddit shapes.
 *
 * These replace snoowrap's `Submission`/`Comment` types across the pipeline so
 * that implementations (snoowrap-based, public-JSON-based, Gemini-generated)
 * only have to provide the handful of fields the pipeline actually reads.
 */

export type RedditCategory = "hot" | "new" | "top" | "controversial";
export type Timespan = "hour" | "day" | "week" | "month" | "year" | "all";

export interface RedditAuthor {
  name: string;
}

export interface RedditSubreddit {
  display_name: string;
}

export interface RedditPost {
  title: string;
  selftext: string;
  permalink: string;
  subreddit: RedditSubreddit;
  subreddit_name_prefixed: string;
  author: RedditAuthor;
  created_utc: number;
  ups: number;
  num_comments: number;
  is_self: boolean;
  is_video: boolean;
  media: unknown | null;
  url: string;
}

export interface RedditComment {
  body: string;
  body_html: string;
  author: RedditAuthor;
  created_utc: number;
  ups: number;
  score: number;
}
