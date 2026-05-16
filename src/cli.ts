/**
 * CLI entrypoint for reddit2shorts.
 *
 * This script fetches a Reddit text post, generates audio using a TTS
 * implementation, screenshots the post/comments, composes a short video
 * and optionally uploads it (e.g. to YouTube).
 */
import { Command } from "commander";
import "dotenv/config";
import ora from "ora";
import env from "./config/env";
import { subreddits } from "./constants/subreddits";
import { RedditInterface } from "./reddit/RedditInterface";
import { RedditCategory, RedditPost, Timespan } from "./reddit/types";
import { JsonReddit } from "./reddit/impl/jsonReddit";
import { SnoowrapReddit } from "./reddit/impl/snoowrapReddit";
import { createShortFromPost } from "./shortsCreation";
import { GeminiStory } from "./storySource/geminiStory";
import { GoogleCloudTts } from "./tts/impl/googleCloudTts";
import { TiktokTts } from "./tts/impl/tiktokTts";
import { TtsInterface } from "./tts/tts";
import { uploadToYoutube } from "./upload";
import { downloadBackgroundAssets } from "./utils/getBackgroundAudioVideo";
import { getShortTitle } from "./utils/getShortTitle";

const program = new Command();

program
  .name("reddit2shorts")
  .description("Make youtube shorts from reddit posts")
  .version("1.0.0")
  .option(
    "-s, --subreddits <subreddit...>",
    "List of subreddits to choose text post from",
    subreddits
  )
  .option(
    "--source <source>",
    "Story source: 'json' (Reddit public JSON, no creds — default), 'snoowrap' (Reddit API, needs creds), or 'gemini' (AI-generated)",
    "json"
  )
  .option("-r, --random", "Make short from a random post")
  .option("-p, --postId <postId>", "Make short from the post with id")
  .option(
    "-c, --commentsCount <commentsCount>",
    "Number of comments to include",
    "10"
  )
  .option("-t, --tts <tts>", "Which tts to use", "google")
  .option("-u, --upload <platform>", "Upload to platform")
  .option("--gTtsVoice <gTtsVoice>", "Voice of google tts", "en-US-Wavenet-F")
  .option("--gTtsLang <gTtsLang>", "Language of google tts", "en-US")
  .option("--gTtsGender <gTtsGender>", "Gender of google tts", "FEMALE")
  .option("-x, --category <category>", "Category to choose random from", "hot")
  .option(
    "-y, --timeSpan <timeSpan>",
    "Timespan to choose random from (only for categories top and controversial)",
    "day"
  )
  .option("-g, --tags <tags...>", "Tags for video title", [
    "shorts",
    "reddit",
    "redditstories",
  ])
  .option("-a, --bgAudio <bgAudio...>", "Background audio", [
    "https://www.youtube.com/watch?v=xy_NKN75Jhw",
  ])
  .option("-v, --bgVideo <bgVideo...>", "Background video", [
    "https://www.youtube.com/watch?v=XBIaqOm0RKQ",
  ]);

interface CliOptions {
  source: string;
  subreddits: string[];
  random?: boolean;
  postId?: string;
  commentsCount: string;
  tts: string;
  upload?: string;
  gTtsVoice: string;
  gTtsLang: string;
  gTtsGender: string;
  category: RedditCategory;
  timeSpan: Timespan;
  tags: string[];
  bgAudio: string[] | string;
  bgVideo: string[] | string;
}

program.parse(process.argv);

const options = program.opts<CliOptions>();

async function main() {
  try {
    if (!["snoowrap", "json", "gemini"].includes(options.source)) {
      console.error(
        "Error: --source must be one of 'snoowrap', 'json' or 'gemini'"
      );
      process.exit(1);
    }

    let reddit: RedditInterface;
    let post: RedditPost | null | undefined;
    let tts: TtsInterface | undefined;

    if (options.source === "gemini") {
      reddit = new GeminiStory(env.GEMINI_API_KEY, options.subreddits);
      post = await reddit.getPost(options.postId ?? "");
    } else {
      if (!options.postId && !options.random) {
        console.error(
          `Error: with --source ${options.source} you must provide either --postId <postId> or --random`
        );
        process.exit(1);
      }

      if (options.source === "snoowrap") {
        if (
          !env.REDDIT_CLIENT_ID ||
          !env.REDDIT_CLIENT_SECRET ||
          !env.REDDIT_USERNAME ||
          !env.REDDIT_PASSWORD
        ) {
          console.error(
            "Error: --source snoowrap requires REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME and REDDIT_PASSWORD in .env"
          );
          process.exit(1);
        }

        reddit = new SnoowrapReddit(
          env.REDDIT_CLIENT_ID,
          env.REDDIT_CLIENT_SECRET,
          env.REDDIT_USERNAME,
          env.REDDIT_PASSWORD
        );
      } else {
        reddit = new JsonReddit();
      }

      if (options.random) {
        post = await reddit.getTextOnlyPostFromList(
          options.subreddits,
          options.category,
          options.timeSpan
        );
      } else if (options.postId) {
        post = await reddit.getPost(options.postId);
      }
    }

    if (!post) {
      console.error("Error: Could not fetch the Reddit post.");
      process.exit(1);
    }

    // normalize comments count to number
    const commentsCount = Number.parseInt(options.commentsCount, 10) || 10;

    switch (options.tts) {
      case "google":
        tts = new GoogleCloudTts(
          options.gTtsLang,
          options.gTtsVoice,
          options.gTtsGender
        );
        break;
      case "tiktok":
        tts = new TiktokTts();
        break;
      default:
        console.error("Error: Invalid TTS option. Supported: google, tiktok");
        process.exit(1);
    }

    const bgVideo = Array.isArray(options.bgVideo)
      ? options.bgVideo
      : [options.bgVideo];
    const bgAudio = Array.isArray(options.bgAudio)
      ? options.bgAudio
      : [options.bgAudio];

    const spinnerBg = ora("Getting background assets ready").start();
    await downloadBackgroundAssets(
      bgVideo[Math.floor(Math.random() * bgVideo.length)],
      bgAudio[Math.floor(Math.random() * bgAudio.length)]
    );
    spinnerBg.succeed("Background assets ready");

    const output = await createShortFromPost({
      post,
      reddit,
      tts,
      commentsCount,
    });

    if (options.upload === "youtube") {
      const shortTitle = await getShortTitle(
        post.title,
        post.subreddit_name_prefixed
      );

      if (!shortTitle) {
        console.error("Couldn't get short title");
        process.exit(1);
      }

      const uploadSpinner = ora("Uploading to youtube").start();
      try {
        const url = await uploadToYoutube(output, `${shortTitle}`, "", [
          post.subreddit_name_prefixed.split("/")[1],
          ...options.tags,
        ]);
        uploadSpinner.succeed(`Uploaded to youtube: ${url}`);
      } catch (err) {
        uploadSpinner.fail("Error uploading to youtube");
        console.error(err);
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

main();
