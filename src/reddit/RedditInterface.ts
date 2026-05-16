import {
  RedditCategory,
  RedditComment,
  RedditPost,
  Timespan,
} from "./types";

export interface RedditInterface {
  getPost(id: string): Promise<RedditPost>;
  getTextOnlyPostFromList(
    subreddits: string[],
    category: RedditCategory,
    topTime: Timespan,
    postLimit?: number
  ): Promise<RedditPost | null>;
  getTopComments(
    post: RedditPost,
    count: number,
    textOnly: boolean,
    excludeMods: boolean
  ): Promise<RedditComment[]>;
  getUserAvatarIfExists(username: string): Promise<string | null>;
}
