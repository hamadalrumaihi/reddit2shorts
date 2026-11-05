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

// ---------------------------------------------------------------------------
// Direct post (official API): publishes straight to the profile with a title
// and the AI-generated-content label. Unaudited apps may only post with
// privacy_level SELF_ONLY until TikTok approves the app; audited apps can use
// PUBLIC_TO_EVERYONE. The inbox/draft route above has no AI-label field.
// ---------------------------------------------------------------------------

export type TiktokPrivacy = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

export interface TiktokDirectOptions {
  /** Caption/title (TikTok limit 2200 chars; hashtags are parsed from it). */
  title: string;
  privacyLevel?: TiktokPrivacy;
  /** Mark as AI-generated content (default true for the animated pipeline). */
  isAigc?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  disableComment?: boolean;
  /** Frame used as the cover, in ms. */
  coverTimestampMs?: number;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface TiktokDirectResult {
  publishId: string;
  status: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function uploadToTiktokDirect(videoPath: string, opts: TiktokDirectOptions): Promise<TiktokDirectResult> {
  const log = opts.log || (() => undefined);
  const privacy = opts.privacyLevel || (process.env.TIKTOK_PRIVACY_LEVEL as TiktokPrivacy) || "SELF_ONLY";
  const postInfo = {
    title: opts.title.slice(0, 2200),
    privacy_level: privacy,
    disable_duet: !!opts.disableDuet,
    disable_comment: !!opts.disableComment,
    disable_stitch: !!opts.disableStitch,
    video_cover_timestamp_ms: opts.coverTimestampMs ?? 500,
    is_aigc: opts.isAigc !== false,
  };

  if (opts.dryRun) {
    log(`[dry-run] would direct-post ${videoPath} to TikTok with post_info ${JSON.stringify(postInfo)}`);
    return { publishId: "dry-run", status: "DRY_RUN" };
  }

  const { size } = await stat(videoPath);
  if (size > MAX_SINGLE_CHUNK) {
    throw new Error(`Video is ${(size / 1024 / 1024).toFixed(1)}MB; single-chunk upload caps at 64MB.`);
  }
  const accessToken = await refreshAccessToken();
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
  };

  const initRes = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      post_info: postInfo,
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
    },
    { headers: authHeaders }
  );
  const publishId: string | undefined = initRes.data?.data?.publish_id;
  const uploadUrl: string | undefined = initRes.data?.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error(`TikTok direct post init failed: ${JSON.stringify(initRes.data)}`);
  }

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
  log(`Uploaded; publish_id ${publishId}. Waiting for TikTok to process...`);

  let status = "PROCESSING_UPLOAD";
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    const st = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      { publish_id: publishId },
      { headers: authHeaders }
    );
    status = st.data?.data?.status || "UNKNOWN";
    if (status === "PUBLISH_COMPLETE") break;
    if (status === "FAILED") {
      throw new Error(`TikTok publish failed: ${st.data?.data?.fail_reason || JSON.stringify(st.data)}`);
    }
  }
  return { publishId, status };
}
