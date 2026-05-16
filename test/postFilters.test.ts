import { test, expect } from "bun:test";
import { passesPostFilters } from "../src/reddit/types";
import { postIdFromPermalink } from "../src/utils/seenPosts";

const base = {
  ups: 5000,
  numComments: 200,
  createdUtc: Math.floor(Date.now() / 1000) - 3600, // 1h old
  over18: false,
  bodyLength: 800,
};

test("passes when all gates satisfied", () => {
  expect(
    passesPostFilters(base, { minScore: 1000, minComments: 50 })
  ).toBe(true);
});

test("fails on low score / low comments", () => {
  expect(passesPostFilters(base, { minScore: 9000 })).toBe(false);
  expect(passesPostFilters(base, { minComments: 9999 })).toBe(false);
});

test("NSFW excluded by default, allowed when opted in", () => {
  const nsfw = { ...base, over18: true };
  expect(passesPostFilters(nsfw, {})).toBe(false);
  expect(passesPostFilters(nsfw, { allowNsfw: true })).toBe(true);
});

test("age and body-length gates", () => {
  const old = { ...base, createdUtc: Math.floor(Date.now() / 1000) - 30 * 86400 };
  expect(passesPostFilters(old, { maxAgeDays: 7 })).toBe(false);
  expect(passesPostFilters(base, { minBodyChars: 2000 })).toBe(false);
  expect(passesPostFilters(base, { maxBodyChars: 500 })).toBe(false);
  expect(passesPostFilters(base, { maxBodyChars: 0 })).toBe(true); // 0 = off
});

test("postIdFromPermalink extracts the base36 id", () => {
  expect(
    postIdFromPermalink("/r/test/comments/abc123/some_slug/")
  ).toBe("abc123");
  expect(postIdFromPermalink("/r/test/")).toBeNull();
});
