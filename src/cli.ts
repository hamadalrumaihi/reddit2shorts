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
import env, { requireEnv } from "./config/env";
import { resolveOptions } from "./config/loadOptions";
import { subreddits } from "./constants/subreddits";
import { RedditInterface } from "./reddit/RedditInterface";
import {
  PostFilters,
  RedditCategory,
  RedditPost,
  Timespan,
} from "./reddit/types";
import { JsonReddit } from "./reddit/impl/jsonReddit";
import { SnoowrapReddit } from "./reddit/impl/snoowrapReddit";
import { createShortFromPost } from "./shortsCreation";
import { GeminiStory } from "./storySource/geminiStory";
import { EdgeTts } from "./tts/impl/edgeTts";
import { GoogleCloudTts } from "./tts/impl/googleCloudTts";
import { TiktokTts } from "./tts/impl/tiktokTts";
import { TtsInterface } from "./tts/tts";
import { uploadToYoutube } from "./upload";
import { uploadToTiktok } from "./upload/tiktok";
import { uploadToTiktokWithSession } from "./upload/tiktokSession";
import { downloadBackgroundAssets } from "./utils/getBackgroundAudioVideo";
import { cleanGeneratedVideos } from "./utils/cleanup";
import { doctorPassed, formatDoctor, runDoctor } from "./utils/doctor";
import { logEvent, setJsonLogging } from "./utils/logger";
import { getShortTitle } from "./utils/getShortTitle";
import { markSeen, postIdFromPermalink } from "./utils/seenPosts";

const program = new Command();

program
  .name("reddit2shorts")
  .description("Make youtube shorts from reddit posts")
  .version("1.0.0")
  .option(
    "--preset <name>",
    "Apply a built-in preset: askreddit-story | tifu-narrative | aita-judgment | shower-thought"
  )
  .option(
    "--config <path>",
    "Path to a JSON config file (default: reddit2shorts.config.json)"
  )
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
  .option("--doctor", "Check environment (yt-dlp, ffmpeg, disk) and exit")
  .option(
    "--dry-run",
    "Validate environment + do a sample post fetch, but produce no video"
  )
  .option(
    "--clean",
    "Delete generated videos under shorts/ (keeps bg cache) and exit"
  )
  .option("--cleanDays <n>", "With --clean, only remove folders older than n days", "0")
  .option("--json", "Emit structured JSON event logs to stdout")
  .option("-r, --random", "Make short from a random post")
  .option("-p, --postId <postId>", "Make short from the post with id")
  .option(
    "-c, --commentsCount <commentsCount>",
    "Number of comments to include",
    "10"
  )
  .option(
    "--maxDuration <seconds>",
    "Hard cap on final short length (YouTube Shorts must be <= 60s)",
    "59"
  )
  .option("--minScore <n>", "Min post score for --random", "1000")
  .option("--minComments <n>", "Min comment count for --random", "50")
  .option("--maxAgeDays <n>", "Max post age in days for --random (0=off)", "7")
  .option("--allowNsfw", "Allow NSFW posts (default: off)")
  .option("--minBodyChars <n>", "Min post body length", "0")
  .option("--maxBodyChars <n>", "Max post body length (0=off)", "0")
  .option(
    "-t, --tts <tts>",
    "Which tts to use: 'edge' (no creds — default), 'google' or 'tiktok'",
    "edge"
  )
  .option(
    "-u, --upload <platform>",
    "Upload after render: 'youtube', 'tiktok' (session cookie), or 'tiktok-api' (official API draft)"
  )
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
  preset?: string;
  config?: string;
  clean?: boolean;
  cleanDays: string;
  json?: boolean;
  source: string;
  subreddits: string[];
  random?: boolean;
  postId?: string;
  commentsCount: string;
  maxDuration: string;
  minScore: string;
  minComments: string;
  maxAgeDays: string;
  allowNsfw?: boolean;
  minBodyChars: string;
  maxBodyChars: string;
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
  doctor?: boolean;
  dryRun?: boolean;
}

program.parse(process.argv);

const options = resolveOptions<CliOptions>(program);

async function main() {
  try {
    setJsonLogging(!!options.json);

    if (options.clean) {
      const removed = await cleanGeneratedVideos(
        Number.parseInt(options.cleanDays, 10) || 0
      );
      console.log(`Removed ${removed} generated video folder(s) from shorts/.`);
      logEvent("clean", { removed });
      process.exit(0);
    }

    if (options.doctor) {
      const results = await runDoctor();
      console.log(formatDoctor(results));
      logEvent("doctor", { passed: doctorPassed(results) });
      process.exit(doctorPassed(results) ? 0 : 1);
    }

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
      reddit = new GeminiStory(
        requireEnv("GEMINI_API_KEY", "--source gemini"),
        options.subreddits
      );
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
        const filters: PostFilters = {
          minScore: Number.parseInt(options.minScore, 10) || 0,
          minComments: Number.parseInt(options.minComments, 10) || 0,
          maxAgeDays: Number.parseInt(options.maxAgeDays, 10) || 0,
          allowNsfw: !!options.allowNsfw,
          minBodyChars: Number.parseInt(options.minBodyChars, 10) || 0,
          maxBodyChars: Number.parseInt(options.maxBodyChars, 10) || 0,
        };
        post = await reddit.getTextOnlyPostFromList(
          options.subreddits,
          options.category,
          options.timeSpan,
          undefined,
          filters
        );
      } else if (options.postId) {
        post = await reddit.getPost(options.postId);
      }
    }

    if (!post) {
      console.error("Error: Could not fetch the Reddit post.");
      logEvent("error", { stage: "fetch", message: "no post" });
      process.exit(1);
    }

    logEvent("post_selected", {
      source: options.source,
      title: post.title,
      subreddit: post.subreddit_name_prefixed,
    });

    if (options.dryRun) {
      const results = await runDoctor();
      console.log(formatDoctor(results));
      console.log(
        `\n✅ Sample fetch OK (--source ${options.source}):\n` +
          `   "${post.title}" — ${post.subreddit_name_prefixed}\n` +
          `\nDry run complete. No video produced.`
      );
      process.exit(doctorPassed(results) ? 0 : 1);
    }

    // normalize comments count to number
    const commentsCount = Number.parseInt(options.commentsCount, 10) || 10;
    const maxDuration = Number.parseInt(options.maxDuration, 10) || 59;

    switch (options.tts) {
      case "edge":
        tts = new EdgeTts();
        break;
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
        console.error(
          "Error: Invalid TTS option. Supported: edge, google, tiktok"
        );
        process.exit(1);
    }

    const bgVideo = Array.isArray(options.bgVideo)
      ? options.bgVideo
      : [options.bgVideo];
    const bgAudio = Array.isArray(options.bgAudio)
      ? options.bgAudio
      : [options.bgAudio];

    const spinnerBg = ora("Getting background assets ready").start();
    // Pass the full pools so a failed source falls back to the next.
    await downloadBackgroundAssets(bgVideo, bgAudio);
    spinnerBg.succeed("Background assets ready");

    const output = await createShortFromPost({
      post,
      reddit,
      tts,
      commentsCount,
      maxDuration,
    });

    logEvent("render_complete", { output });

    // Record the post so an automated/repeated run won't re-use it.
    // (Gemini stories are fictional one-offs — nothing to dedupe.)
    if (options.source !== "gemini") {
      const seenId = postIdFromPermalink(post.permalink);
      if (seenId) markSeen(seenId);
    }

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
    if (options.upload === "tiktok") {
      const uploadSpinner = ora("Uploading to TikTok (session cookie)").start();
      try {
        await uploadToTiktokWithSession(output);
        uploadSpinner.succeed("Uploaded to TikTok via session cookie");
      } catch (err) {
        uploadSpinner.fail("Error uploading to TikTok (session cookie)");
        console.error(err);
      }
    }

    if (options.upload === "tiktok-api") {
      const uploadSpinner = ora("Uploading to TikTok (official API)").start();
      try {
        const publishId = await uploadToTiktok(output);
        uploadSpinner.succeed(
          `Sent to TikTok inbox as a draft (publish_id: ${publishId}). Open the TikTok app to finish posting.`
        );
      } catch (err) {
        uploadSpinner.fail("Error uploading to TikTok (official API)");
        console.error(err);
      }
    }
    logEvent("done", { output });
  } catch (err) {
    console.error("Unexpected error:", err);
    logEvent("error", {
      stage: "pipeline",
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

main();
