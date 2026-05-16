import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { RedditInterface } from "../reddit/RedditInterface";
import { RedditComment, RedditPost } from "../reddit/types";

/**
 * A {@link RedditInterface} implementation that generates a fictional Reddit
 * story (post + comments) with Gemini instead of fetching real content.
 *
 * It returns the same local `RedditPost`/`RedditComment` shapes as the other
 * implementations, so it is a drop-in source and nothing downstream changes.
 */

const storySchema = z.object({
  title: z.string().min(1),
  subreddit: z.string().min(1),
  body: z.string().min(1),
  comments: z
    .array(
      z.object({
        author: z.string().min(1),
        body: z.string().min(1),
        ups: z.number().int().nonnegative().optional(),
      })
    )
    .min(5)
    .max(10),
});

type GeneratedStory = z.infer<typeof storySchema>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export class GeminiStory implements RedditInterface {
  private ai: GoogleGenAI;
  private subreddits: string[];
  private cached?: GeneratedStory;
  private createdUtc = Math.floor(Date.now() / 1000) - 60 * 60 * 3;

  constructor(apiKey: string, subreddits: string[] = []) {
    this.ai = new GoogleGenAI({ apiKey });
    this.subreddits = subreddits;
  }

  private async generate(): Promise<GeneratedStory> {
    if (this.cached) return this.cached;

    const subredditHint =
      this.subreddits.length > 0
        ? `Pick a fitting subreddit name from or similar to: ${this.subreddits.join(
            ", "
          )}.`
        : `Pick a fitting subreddit name (e.g. AskReddit, TIFU, relationships).`;

    const prompt = `Write an original, engaging first-person Reddit-style story suitable for a short video. ${subredditHint}
Respond ONLY with raw JSON (no markdown, no code fences) matching exactly this shape:
{
  "title": "a catchy post title",
  "subreddit": "SubredditName without the r/ prefix",
  "body": "the full story body, 120-220 words, plain text",
  "comments": [
    { "author": "a_reddit_username", "body": "a plausible reply", "ups": 1234 }
  ]
}
Include between 5 and 10 comments. Vary their tone and length. Keep everything family-friendly.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
    });

    const raw = response.text;
    if (!raw) {
      throw new Error("Gemini returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch {
      throw new Error(
        `Gemini did not return valid JSON. Response was:\n${raw}`
      );
    }

    this.cached = storySchema.parse(parsed);
    return this.cached;
  }

  private buildSubmission(story: GeneratedStory): RedditPost {
    const slug = story.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50);
    const id = Math.random().toString(36).slice(2, 9);

    return {
      title: story.title,
      selftext: story.body,
      subreddit_name_prefixed: `r/${story.subreddit}`,
      subreddit: { display_name: story.subreddit },
      permalink: `/r/${story.subreddit}/comments/${id}/${slug}/`,
      author: { name: "anonymous" },
      created_utc: this.createdUtc,
      ups: 1000 + Math.floor(Math.random() * 50000),
      num_comments: story.comments.length,
      is_self: true,
      is_video: false,
      media: null,
      url: `https://www.reddit.com/r/${story.subreddit}/comments/${id}/${slug}/`,
    };
  }

  private buildComments(story: GeneratedStory, count: number): RedditComment[] {
    return story.comments.slice(0, count).map((comment, index) => {
      const ups = comment.ups ?? 50 + Math.floor(Math.random() * 5000);
      return {
        body: comment.body,
        body_html: `<div class="md"><p>${escapeHtml(comment.body)}</p></div>`,
        author: { name: comment.author },
        created_utc: this.createdUtc + 60 * (index + 1),
        ups,
        score: ups,
      };
    });
  }

  // Signatures intentionally take fewer params than RedditInterface: the
  // generated story ignores ids/subreddits/category, so the unused trailing
  // params are dropped (a narrower method is still interface-assignable).
  async getPost(): Promise<RedditPost> {
    return this.buildSubmission(await this.generate());
  }

  async getTextOnlyPostFromList(): Promise<RedditPost> {
    return this.buildSubmission(await this.generate());
  }

  async getTopComments(_post: RedditPost, count = 5): Promise<RedditComment[]> {
    return this.buildComments(await this.generate(), count);
  }

  async getUserAvatarIfExists(): Promise<string | null> {
    return null;
  }
}
