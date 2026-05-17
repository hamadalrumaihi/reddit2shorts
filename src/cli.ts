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
import { OfflineReddit } from "./reddit/impl/offlineReddit";
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
import { generateVideoMetadata } from "./metadata";
import { detectTrendingTopics } from "./metadata/trending";
import type { VoiceStyle } from "./shortsCreation/utils/replaceAbbrevations";
import { getAccount, listAccounts } from "./config/accounts";
import { RunTracker } from "./analytics/tracker";
import { uploadToAllPlatforms } from "./upload/multiPlatform";
import { generateTitleVariations, saveABTestRecord } from "./social/abTesting";

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
    "Story source: 'json' (Reddit public JSON, no creds â€” default), 'snoowrap' (Reddit API, needs creds), 'gemini' (AI-generated), or 'offline' (cached posts, no network)",
    "json"
  )
  .option("--offline", "Shorthand for --source offline (use cached posts, skip network)")
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
    "Which tts to use: 'edge' (no creds â€” default), 'google' or 'tiktok'",
    "edge"
  )
  .option(
    "-u, --upload <platform>",
    "Upload after render: 'youtube', 'tiktok' (session cookie), 'tiktok-api' (official API draft), or 'all' (simultaneous multi-platform)"
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
  .option(
    "--cookies-from-browser <browser>",
    "Pass cookies to yt-dlp from a browser (e.g. chrome, firefox, edge)"
  )
  .option(
    "--cookies <file>",
    "Path to a Netscape-format cookies.txt file for yt-dlp"
  )
  .option("-a, --bgAudio <bgAudio...>", "Background audio", [
    "https://www.youtube.com/watch?v=xy_NKN75Jhw",
  ])
  .option("-v, --bgVideo <bgVideo...>", "Background video", [
    "https://www.youtube.com/watch?v=XBIaqOm0RKQ",
  ])
  .option(
    "--voice-style <style>",
    "TTS reading style: 'normal', 'genz' (reads like a zoomer), or 'brainrot' (maximum chaos energy)",
    "normal"
  )
  .option(
    "--duration-preset <preset>",
    "Quick duration presets: '15s' (ultra-short), '30s' (short), '45s' (medium), '60s' (full)",
  )
  .option("--trending", "Auto-pick the most viral trending post from your subreddits")
  .option("--generate-metadata", "Generate optimized titles/descriptions/hashtags after rendering")
  .option(
    "--metadata-style <style>",
    "Metadata style: 'viral', 'storytelling', 'controversial', 'wholesome', 'brainrot'",
    "viral"
  )
  .option(
    "--platform <platform>",
    "Target platform for metadata: 'tiktok', 'youtube_shorts', 'reels', 'all'",
    "all"
  )
  .option(
    "--account <name>",
    "Use a named account from accounts.json (overrides subreddits, style, credentials)"
  )
  .option("--list-accounts", "List available accounts and exit");

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
  cookiesFromBrowser?: string;
  cookies?: string;
  offline?: boolean;
  doctor?: boolean;
  dryRun?: boolean;
  voiceStyle: VoiceStyle;
  durationPreset?: string;
  trending?: boolean;
  generateMetadata?: boolean;
  metadataStyle: string;
  platform: string;
  account?: string;
  listAccounts?: boolean;
}

program.parse(process.argv);

const options = resolveOptions<CliOptions>(program);

async function main() {
  try {
    setJsonLogging(!!options.json);

    // List accounts mode
    if (options.listAccounts) {
      console.log("Available accounts:", listAccounts().join(", "));
      process.exit(0);
    }

    // Multi-account support: override options from account config
    if (options.account) {
      const acct = getAccount(options.account);
      options.subreddits = acct.subreddits;
      if (acct.voiceStyle) options.voiceStyle = acct.voiceStyle as VoiceStyle;
      if (acct.metadataStyle) options.metadataStyle = acct.metadataStyle;
      console.log(`Using account: ${acct.name} (${acct.platform})`);
    }

    // Initialize analytics tracker
    const tracker = new RunTracker();
    if (options.account) tracker.setAccount(options.account);

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

    // --offline flag is shorthand for --source offline
    if (options.offline) {
      options.source = "offline";
    }

    if (!["snoowrap", "json", "gemini", "offline"].includes(options.source)) {
      console.error(
        "Error: --source must be one of 'snoowrap', 'json', 'gemini' or 'offline'"
      );
      process.exit(1);
    }

    let reddit: RedditInterface;
    let post: RedditPost | null | undefined;
    let tts: TtsInterface | undefined;

    // Trending mode: find the most viral post automatically
    if (options.trending && !options.postId) {
      const trendingSpinner = ora("Detecting trending topics").start();
      const trending = await detectTrendingTopics(options.subreddits, 5);
      if (trending.length > 0) {
        trendingSpinner.succeed(
          `Found trending: "${trending[0].title}" (velocity: ${trending[0].velocityScore.toFixed(0)})`
        );
        // Extract post ID from permalink
        const parts = trending[0].permalink.split("/").filter(Boolean);
        const commentsIdx = parts.indexOf("comments");
        if (commentsIdx >= 0 && parts[commentsIdx + 1]) {
          options.postId = parts[commentsIdx + 1];
          options.random = false;
        }
      } else {
        trendingSpinner.warn("No trending posts found, falling back to --random");
        options.random = true;
      }
    }

    if (options.source === "gemini") {
      reddit = new GeminiStory(
        requireEnv("GEMINI_API_KEY", "--source gemini"),
        options.subreddits
      );
      post = await reddit.getPost(options.postId ?? "");
    } else if (options.source === "offline") {
      if (!options.postId && !options.random) {
        // Default to random in offline mode
        options.random = true;
      }
      reddit = new OfflineReddit();
      if (options.random) {
        const filters: PostFilters = {
          minScore: Number.parseInt(options.minScore, 10) || 0,
          minComments: Number.parseInt(options.minComments, 10) || 0,
          maxAgeDays: 0, // Don't filter by age for cached posts
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

    // Track post info in analytics
    tracker.setPostInfo(
      post.subreddit_name_prefixed,
      (post as any).id || options.postId || "random",
      post.title,
      (post as any).score ?? 0
    );

    if (options.dryRun) {
      const results = await runDoctor();
      console.log(formatDoctor(results));
      console.log(
        `\nâœ… Sample fetch OK (--source ${options.source}):\n` +
          `   "${post.title}" â€” ${post.subreddit_name_prefixed}\n` +
          `\nDry run complete. No video produced.`
      );
      process.exit(doctorPassed(results) ? 0 : 1);
    }

    // normalize comments count to number
    const commentsCount = Number.parseInt(options.commentsCount, 10) || 10;

    // Duration presets: quick shorthand for common lengths
    let maxDuration = Number.parseInt(options.maxDuration, 10) || 59;
    if (options.durationPreset) {
      const durationMap: Record<string, number> = {
        "15s": 15,
        "30s": 30,
        "45s": 45,
        "60s": 59,
      };
      const preset = durationMap[options.durationPreset];
      if (preset) {
        maxDuration = preset;
        console.log(`â±ï¸ Duration preset: ${options.durationPreset} (max ${maxDuration}s)`);
      } else {
        console.warn(`âš ï¸ Unknown duration preset "${options.durationPreset}", using ${maxDuration}s`);
      }
    }

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
    if (options.source === "offline") {
      // In offline mode, skip downloading â€” just verify cached bg assets exist
      const fs = await import("fs/promises");
      const bgVideoExists = await fs.access("shorts/bgVideo.mp4").then(() => true).catch(() => false);
      const bgAudioExists = await fs.access("shorts/bgAudio.mp3").then(() => true).catch(() => false);
      if (!bgVideoExists || !bgAudioExists) {
        spinnerBg.fail("Background assets not cached! Run the tool once online first.");
        process.exit(1);
      }
      spinnerBg.succeed("Background assets ready (from cache)");
    } else {
      // Pass the full pools so a failed source falls back to the next.
      await downloadBackgroundAssets(bgVideo, bgAudio, {
        cookiesFromBrowser: options.cookiesFromBrowser,
        cookiesFile: options.cookies,
      });
      spinnerBg.succeed("Background assets ready");
    }

    const output = await createShortFromPost({
      post,
      reddit,
      tts,
      commentsCount,
      maxDuration,
      voiceStyle: (options.voiceStyle as VoiceStyle) || "normal",
    });

    logEvent("render_complete", { output });

    // Generate social media metadata if requested
    if (options.generateMetadata) {
      const metadata = generateVideoMetadata(post, {
        platform: options.platform as "tiktok" | "youtube_shorts" | "reels" | "all",
        style: options.metadataStyle as "viral" | "storytelling" | "controversial" | "wholesome" | "brainrot",
        includeCallToAction: true,
      });
      console.log("\nðŸ“± Generated Social Media Metadata:");
      console.log(`   ðŸŽ¬ Title: ${metadata.title}`);
      console.log(`   ðŸª Hook: ${metadata.hook}`);
      console.log(`   #ï¸âƒ£ Hashtags: ${metadata.hashtags.map(h => `#${h}`).join(" ")}`);
      console.log(`   ðŸ“ Description:\n${metadata.description.split("\n").map(l => `      ${l}`).join("\n")}`);
      logEvent("metadata_generated", metadata);
    }

    // Record the post so an automated/repeated run won't re-use it.
    // (Gemini stories are fictional one-offs â€” nothing to dedupe.)
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

    // Multi-platform simultaneous upload
    if (options.upload === "all") {
      const uploadSpinner = ora("Uploading to all platforms simultaneously").start();
      tracker.startStage();
      try {
        const results = await uploadToAllPlatforms(output, post, options.tags);
        const successes = results.filter(r => r.success);
        const failures = results.filter(r => !r.success);

        if (successes.length > 0) {
          uploadSpinner.succeed(
            `Uploaded to ${successes.map(r => r.platform).join(", ")} (${failures.length} failed)`
          );
        } else if (results.length > 0) {
          uploadSpinner.fail("All uploads failed");
        } else {
          uploadSpinner.warn("No platforms configured for upload");
        }

        for (const r of results) {
          if (r.success) {
            console.log(`  ✓ ${r.platform}${r.url ? `: ${r.url}` : ""}${r.publishId ? ` (publish_id: ${r.publishId})` : ""}`);
          } else {
            console.log(`  ✗ ${r.platform}: ${r.error}`);
          }
        }

        tracker.endStage("upload");
        tracker.setUploadResult(
          results.map(r => r.platform),
          successes.length > 0 ? "success" : "failed",
          failures.map(r => `${r.platform}: ${r.error}`)
        );
      } catch (err: any) {
        uploadSpinner.fail("Error in multi-platform upload");
        console.error(err);
        tracker.endStage("upload");
        tracker.setUploadResult([], "failed", [err.message]);
      }
    }

    // A/B title testing: generate variations and save alongside output
    if (options.generateMetadata) {
      try {
        const variations = generateTitleVariations(post, options.platform as any);
        const videoId = `vid_${Date.now()}`;
        saveABTestRecord(videoId, (post as any).id || "unknown", post.subreddit_name_prefixed, variations, 0, options.platform);
        console.log(`\n🎨 A/B Title Variations saved to metadata/ab-tests.json`);
        for (let i = 0; i < variations.length; i++) {
          console.log(`   ${i + 1}. [${variations[i].style}] ${variations[i].title}`);
        }
        tracker.setMetadata(variations[0]?.title || "", variations[0]?.hashtags || []);
      } catch { /* non-critical */ }
    }

    // Finalize analytics
    try {
      const stats = tracker.finalize();
      logEvent("analytics_recorded", { runId: stats.id, totalMs: stats.timing.total });
    } catch { /* non-critical */ }

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

