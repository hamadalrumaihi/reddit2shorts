/**
 * Multi-platform simultaneous upload support.
 * Handles uploading to TikTok + YouTube Shorts in parallel,
 * with platform-specific metadata adjustments.
 */

import { uploadToYoutube } from "./index";
import { uploadToTiktok } from "./tiktok";
import { uploadToTiktokWithSession } from "./tiktokSession";
import { generateMultiPlatformMetadata, type Platform } from "../metadata";
import { RedditPost } from "../reddit/types";
import { getShortTitle } from "../utils/getShortTitle";
import env from "../config/env";

export interface UploadResult {
  platform: string;
  success: boolean;
  url?: string;
  publishId?: string;
  error?: string;
}

/**
 * Check which platforms have credentials configured.
 */
export function getAvailablePlatforms(): string[] {
  const platforms: string[] = [];

  // TikTok session cookie
  if (process.env.TIKTOK_SESSION_ID) {
    platforms.push("tiktok");
  }

  // TikTok API
  if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REFRESH_TOKEN) {
    platforms.push("tiktok-api");
  }

  // YouTube
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    platforms.push("youtube");
  }

  return platforms;
}

/**
 * Generate platform-specific metadata (adjusts hashtags, description format).
 */
function getPlatformMetadata(post: RedditPost, platform: string) {
  const platformMap: Record<string, Platform> = {
    tiktok: "tiktok",
    "tiktok-api": "tiktok",
    youtube: "youtube_shorts",
  };

  const target = platformMap[platform] || "all";
  const allMeta = generateMultiPlatformMetadata(post, "viral");
  return allMeta[target] || allMeta.all;
}

/**
 * Upload to all available platforms simultaneously.
 * Returns results for each platform attempted.
 */
export async function uploadToAllPlatforms(
  videoPath: string,
  post: RedditPost,
  tags: string[] = []
): Promise<UploadResult[]> {
  const available = getAvailablePlatforms();

  if (available.length === 0) {
    console.warn("No upload platforms configured. Set credentials in .env.");
    return [];
  }

  const results: UploadResult[] = [];
  const uploads: Promise<void>[] = [];

  // TikTok (prefer session cookie over API for direct publish)
  if (available.includes("tiktok")) {
    uploads.push(
      (async () => {
        try {
          const meta = getPlatformMetadata(post, "tiktok");
          const caption = `${meta.title}\n\n${meta.hashtags.map(h => `#${h}`).join(" ")}`;
          await uploadToTiktokWithSession(videoPath, caption);
          results.push({ platform: "tiktok", success: true });
        } catch (e: any) {
          results.push({ platform: "tiktok", success: false, error: e.message });
        }
      })()
    );
  } else if (available.includes("tiktok-api")) {
    uploads.push(
      (async () => {
        try {
          const publishId = await uploadToTiktok(videoPath);
          results.push({ platform: "tiktok-api", success: true, publishId });
        } catch (e: any) {
          results.push({ platform: "tiktok-api", success: false, error: e.message });
        }
      })()
    );
  }

  // YouTube
  if (available.includes("youtube")) {
    uploads.push(
      (async () => {
        try {
          const meta = getPlatformMetadata(post, "youtube");
          const shortTitle = await getShortTitle(post.title, post.subreddit_name_prefixed);
          const title = shortTitle || meta.title;
          const description = meta.description;
          const ytTags = [
            post.subreddit_name_prefixed.split("/")[1],
            ...tags,
            ...meta.hashtags.slice(0, 5),
          ];
          const url = await uploadToYoutube(videoPath, title, description, ytTags);
          results.push({ platform: "youtube", success: true, url });
        } catch (e: any) {
          results.push({ platform: "youtube", success: false, error: e.message });
        }
      })()
    );
  }

  // Run all uploads in parallel
  await Promise.allSettled(uploads);

  return results;
}
