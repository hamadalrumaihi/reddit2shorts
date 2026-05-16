import { test, expect } from "bun:test";
import {
  mapPost,
  mapComment,
  type RawPostData,
  type RawCommentData,
} from "../src/reddit/impl/jsonReddit";

const rawPost: RawPostData = {
  title: "Test title",
  selftext: "Body text",
  permalink: "/r/test/comments/abc123/test_title/",
  subreddit: "test",
  subreddit_name_prefixed: "r/test",
  author: "alice",
  created_utc: 1_700_000_000,
  ups: 4321,
  num_comments: 99,
  is_self: true,
  is_video: false,
  media: null,
  url: "https://www.reddit.com/r/test/comments/abc123/test_title/",
  over_18: false,
};

test("mapPost maps Reddit JSON to RedditPost shape", () => {
  const p = mapPost(rawPost);
  expect(p.title).toBe("Test title");
  expect(p.subreddit.display_name).toBe("test");
  expect(p.subreddit_name_prefixed).toBe("r/test");
  expect(p.author.name).toBe("alice");
  expect(p.ups).toBe(4321);
  expect(p.num_comments).toBe(99);
  expect(p.is_self).toBe(true);
});

test("mapPost normalizes missing media to null", () => {
  const p = mapPost({ ...rawPost, media: undefined as unknown as null });
  expect(p.media).toBeNull();
});

test("mapComment maps Reddit JSON to RedditComment shape", () => {
  const rawComment: RawCommentData = {
    body: "nice",
    body_html: "<p>nice</p>",
    author: "bob",
    created_utc: 1_700_000_500,
    ups: 12,
    score: 12,
  };
  const c = mapComment(rawComment);
  expect(c.body).toBe("nice");
  expect(c.body_html).toBe("<p>nice</p>");
  expect(c.author.name).toBe("bob");
  expect(c.score).toBe(12);
});
