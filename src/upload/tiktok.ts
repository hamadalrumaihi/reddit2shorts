import axios from "axios";
import { readFile, stat } from "fs/promises";
import { requireEnv } from "../config/env";

/**
 * Uploads a rendered video to TikTok via the official Content Posting API.
 *
 * Honest scope: this uses the **inbox/draft** endpoint, which works for
 * unaudited developer apps. The video is delivered to the account's TikTok
 * app as a draft — you tap "Post" in the app to publish (you can set
 * caption/privacy there). Fully automated public publishing requires
 * TikTok's app audit + the direct-post endpoint; see README.
 *
 * Tokens are refreshed on every call (access tokens last ~24h), mirroring
 * the YouTube uploader. Requires a registered TikTok app (see README):
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
 */

const MAX_SINGLE_CHUNK = 64 * 1024 * 1024; // TikTok single-chunk limit

async function refreshAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    client_key: requireEnv("TIKTOK_CLIENT_KEY", "--upload tiktok"),
    client_secret: requireEnv("TIKTOK_CLIENT_SECRET", "--upload tiktok"),
    grant_type: "refresh_token",
    refresh_token: requireEnv("TIKTOK_REFRESH_TOKEN", "--upload tiktok"),
  });

  const res = await axios.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const token = res.data?.access_token;
  if (!token) {
    throw new Error(
      `TikTok token refresh failed: ${JSON.stringify(res.data)}`
    );
  }
  return token;
}

export async function uploadToTiktok(videoPath: string): Promise<string> {
  const { size } = await stat(videoPath);
  if (size > MAX_SINGLE_CHUNK) {
    throw new Error(
      `Video is ${(size / 1024 / 1024).toFixed(
        1
      )}MB; TikTok single-chunk upload caps at 64MB. Lower --maxDuration or comment count.`
    );
  }

  const accessToken = await refreshAccessToken();
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
  };

  // 1) Initialize an inbox (draft) upload.
  const initRes = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
    {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    },
    { headers: authHeaders }
  );

  const publishId: string | undefined = initRes.data?.data?.publish_id;
  const uploadUrl: string | undefined = initRes.data?.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error(
      `TikTok upload init failed: ${JSON.stringify(initRes.data)}`
    );
  }

  // 2) Upload the bytes (single chunk).
  const file = await readFile(videoPath);
  await axios.put(uploadUrl, file, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return publishId;
}
