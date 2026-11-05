import axios from "axios";
import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { requireEnv } from "../config/env";

const execFileAsync = promisify(execFile);

/**
 * Instagram Reels publishing via the Instagram Graph API.
 *
 * Flow (https://developers.facebook.com/docs/instagram-platform/content-publishing):
 *   1. POST /{ig-user-id}/media  media_type=REELS video_url=<public url>
 *   2. GET  /{container-id}?fields=status_code  until FINISHED
 *   3. POST /{ig-user-id}/media_publish creation_id=<container-id>
 *
 * Requirements: an Instagram Business/Creator account linked to a Facebook
 * Page, a long-lived user token with instagram_business_content_publish (or
 * the Instagram-login equivalents). Set IG_USER_ID and IG_ACCESS_TOKEN.
 *
 * The API only accepts a *public* video URL, so the file is parked on a
 * temporary host first (IG_TEMP_HOST: litterbox | catbox | custom | url) and
 * removed/expired once the reel is published.
 *
 * Note: the Graph API has no field for Instagram's "AI label"; the caption
 * carries an AI disclosure line instead, and the label can be toggled in-app.
 */

export type TempHost = "litterbox" | "catbox" | "custom" | "url";

export interface InstagramUploadOptions {
  caption: string;
  coverPath?: string;
  shareToFeed?: boolean;
  /** Where to park the file so Instagram can fetch it. Default: IG_TEMP_HOST or litterbox. */
  tempHost?: TempHost;
  /** With tempHost "url": an already-public URL for the video. */
  publicVideoUrl?: string;
  publicCoverUrl?: string;
  /** Log every step instead of calling the API. */
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface HostedFile {
  url: string;
  cleanup: () => Promise<void>;
}

const GRAPH = () => `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION || "v21.0"}`;

async function postMultipart(url: string, fields: Record<string, string>, file?: { field: string; path: string }): Promise<string> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) {
    const buf = await readFile(file.path);
    const type = file.path.endsWith(".jpg") ? "image/jpeg" : "video/mp4";
    form.append(file.field, new Blob([buf], { type }), path.basename(file.path));
  }
  const res = await fetch(url, { method: "POST", body: form });
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

/** Park a file on a public host; returns its URL and a cleanup function. */
export async function hostTemporarily(filePath: string, host: TempHost = (process.env.IG_TEMP_HOST as TempHost) || "litterbox"): Promise<HostedFile> {
  switch (host) {
    case "litterbox": {
      // Files expire on their own (1h/12h/24h/72h); nothing to delete.
      const time = process.env.IG_TEMP_HOST_EXPIRY || "1h";
      const url = await postMultipart(
        "https://litterbox.catbox.moe/resources/internals/api.php",
        { reqtype: "fileupload", time },
        { field: "fileToUpload", path: filePath }
      );
      if (!/^https?:\/\//.test(url)) throw new Error(`litterbox upload failed: ${url}`);
      return { url, cleanup: async () => undefined };
    }
    case "catbox": {
      const userhash = process.env.CATBOX_USERHASH || "";
      const url = await postMultipart(
        "https://catbox.moe/user/api.php",
        { reqtype: "fileupload", ...(userhash ? { userhash } : {}) },
        { field: "fileToUpload", path: filePath }
      );
      if (!/^https?:\/\//.test(url)) throw new Error(`catbox upload failed: ${url}`);
      return {
        url,
        cleanup: async () => {
          if (!userhash) return; // anonymous uploads cannot be deleted
          await postMultipart("https://catbox.moe/user/api.php", {
            reqtype: "deletefiles",
            userhash,
            files: path.basename(url),
          }).catch(() => undefined);
        },
      };
    }
    case "custom": {
      // IG_TEMP_HOST_CMD: a program that prints the public URL, e.g.
      //   IG_TEMP_HOST_CMD="aws s3 cp {file} s3://bucket/{name} --acl public-read && echo https://bucket.s3.amazonaws.com/{name}"
      // IG_TEMP_HOST_CLEANUP_CMD (optional) runs after publishing with the same placeholders.
      const cmd = requireEnv("IG_TEMP_HOST_CMD", "IG_TEMP_HOST=custom");
      const name = path.basename(filePath);
      const render = (c: string) => c.replace(/\{file\}/g, filePath).replace(/\{name\}/g, name);
      const { stdout } = await execFileAsync("sh", ["-c", render(cmd)], { timeout: 10 * 60_000 });
      const url = stdout.trim().split("\n").pop() || "";
      if (!/^https?:\/\//.test(url)) throw new Error(`IG_TEMP_HOST_CMD did not print a URL (got: ${url})`);
      const cleanupCmd = process.env.IG_TEMP_HOST_CLEANUP_CMD;
      return {
        url,
        cleanup: async () => {
          if (cleanupCmd) await execFileAsync("sh", ["-c", render(cleanupCmd)]).catch(() => undefined);
        },
      };
    }
    case "url":
      throw new Error("tempHost 'url' needs publicVideoUrl");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface InstagramUploadResult {
  mediaId: string;
  containerId: string;
  permalink?: string;
  videoUrl: string;
}

export async function uploadToInstagram(videoPath: string, opts: InstagramUploadOptions): Promise<InstagramUploadResult> {
  const log = opts.log || (() => undefined);
  const host = opts.tempHost || ((process.env.IG_TEMP_HOST as TempHost) || "litterbox");

  if (opts.dryRun) {
    log(`[dry-run] would host ${videoPath} on ${host}, create a REELS container, poll until FINISHED, publish, then clean up.`);
    log(`[dry-run] caption:\n${opts.caption}`);
    return { mediaId: "dry-run", containerId: "dry-run", videoUrl: "dry-run" };
  }

  const igUserId = requireEnv("IG_USER_ID", "--upload instagram");
  const token = requireEnv("IG_ACCESS_TOKEN", "--upload instagram");

  // 1) Public URLs.
  let video: HostedFile;
  let cover: HostedFile | null = null;
  if (host === "url") {
    if (!opts.publicVideoUrl) throw new Error("IG_TEMP_HOST=url requires --ig-video-url (a public URL for the rendered video)");
    video = { url: opts.publicVideoUrl, cleanup: async () => undefined };
    if (opts.publicCoverUrl) cover = { url: opts.publicCoverUrl, cleanup: async () => undefined };
  } else {
    log(`Hosting video on ${host}...`);
    video = await hostTemporarily(videoPath, host);
    if (opts.coverPath) cover = await hostTemporarily(opts.coverPath, host).catch(() => null);
  }
  log(`Public video URL: ${video.url}`);

  try {
    // 2) Create the container.
    const createRes = await axios.post(`${GRAPH()}/${igUserId}/media`, null, {
      params: {
        media_type: "REELS",
        video_url: video.url,
        caption: opts.caption,
        share_to_feed: opts.shareToFeed === false ? "false" : "true",
        ...(cover ? { cover_url: cover.url } : {}),
        access_token: token,
      },
    });
    const containerId: string | undefined = createRes.data?.id;
    if (!containerId) throw new Error(`Instagram container creation failed: ${JSON.stringify(createRes.data)}`);
    log(`Container ${containerId} created; waiting for processing...`);

    // 3) Poll (Meta: about once per minute; we poll every 5 s for up to ~6 minutes).
    let status = "IN_PROGRESS";
    for (let i = 0; i < 72 && status !== "FINISHED"; i++) {
      await sleep(5000);
      const st = await axios.get(`${GRAPH()}/${containerId}`, {
        params: { fields: "status_code,status", access_token: token },
      });
      status = st.data?.status_code || "UNKNOWN";
      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error(`Instagram container ${status}: ${st.data?.status || "no detail"}`);
      }
    }
    if (status !== "FINISHED") throw new Error("Instagram container did not finish processing in time");

    // 4) Publish.
    const pub = await axios.post(`${GRAPH()}/${igUserId}/media_publish`, null, {
      params: { creation_id: containerId, access_token: token },
    });
    const mediaId: string | undefined = pub.data?.id;
    if (!mediaId) throw new Error(`Instagram publish failed: ${JSON.stringify(pub.data)}`);

    let permalink: string | undefined;
    try {
      const info = await axios.get(`${GRAPH()}/${mediaId}`, { params: { fields: "permalink", access_token: token } });
      permalink = info.data?.permalink;
    } catch {
      /* optional */
    }
    return { mediaId, containerId, permalink, videoUrl: video.url };
  } finally {
    // 5) Remove the temporary copies.
    await video.cleanup();
    if (cover) await cover.cleanup();
  }
}
