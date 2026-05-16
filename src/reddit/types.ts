/**
 * Local, minimal Reddit shapes.
 *
 * These replace snoowrap's `Submission`/`Comment` types across the pipeline so
 * that implementations (snoowrap-based, public-JSON-based, Gemini-generated)
 * only have to provide the handful of fields the pipeline actually reads.
 */

export type RedditCategory = "hot" | "new" | "top" | "controversial";
export type Timespan = "hour" | "day" | "week" | "month" | "year" | "all";

/** Content-quality gates applied during random post selection. */
export interface PostFilters {
  minScore?: number;
  minComments?: number;
  maxAgeDays?: number;
  allowNsfw?: boolean;
  minBodyChars?: number;
  maxBodyChars?: number;
}

/** Fields a post must expose to be filterable. */
export interface FilterablePost {
  ups: number;
  numComments: number;
  createdUtc: number;
  over18: boolean;
  bodyLength: number;
}

export function passesPostFilters(
  p: FilterablePost,
  f: PostFilters
): boolean {
  if (f.minScore && p.ups < f.minScore) return false;
  if (f.minComments && p.numComments < f.minComments) return false;
  if (f.maxAgeDays && f.maxAgeDays > 0) {
    const ageDays = (Date.now() / 1000 - p.createdUtc) / 86400;
    if (ageDays > f.maxAgeDays) return false;
  }
  if (!f.allowNsfw && p.over18) return false;
  if (f.minBodyChars && p.bodyLength < f.minBodyChars) return false;
  if (f.maxBodyChars && f.maxBodyChars > 0 && p.bodyLength > f.maxBodyChars)
    return false;
  return true;
}

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
