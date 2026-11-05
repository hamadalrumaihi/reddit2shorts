import { uploadToYoutube } from "./index";
import { uploadToInstagram, TempHost } from "./instagram";
import { uploadToTiktok, uploadToTiktokDirect, TiktokPrivacy } from "./tiktok";
import { uploadToTiktokWithSession } from "./tiktokSession";

/**
 * Fan-out uploader used by the CLI for `--upload a,b,c`.
 *
 * Platforms:
 *   tiktok-api    official API, lands in the TikTok inbox as a draft (default TikTok route)
 *   tiktok-direct official API direct post with is_aigc=true (needs audited app for public posts)
 *   tiktok        session-cookie browser automation (opt-in fallback, fragile)
 *   instagram     Graph API Reels flow (container -> poll -> publish)
 *   youtube       YouTube Data API
 */

export type UploadPlatform = "tiktok-api" | "tiktok-direct" | "tiktok" | "instagram" | "youtube";

export const UPLOAD_PLATFORMS: UploadPlatform[] = ["tiktok-api", "tiktok-direct", "tiktok", "instagram", "youtube"];

export interface UploadJob {
  videoPath: string;
  coverPath?: string;
  caption: string;
  title: string;
  hashtags: string[];
  dryRun?: boolean;
  tiktokPrivacy?: TiktokPrivacy;
  igTempHost?: TempHost;
  igVideoUrl?: string;
  log?: (msg: string) => void;
}

export interface UploadOutcome {
  platform: UploadPlatform;
  success: boolean;
  detail?: string;
  url?: string;
  error?: string;
}

export function parseUploadPlatforms(raw: string | undefined): UploadPlatform[] {
  if (!raw) return [];
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: UploadPlatform[] = [];
  for (const p of list) {
    if (p === "all") {
      for (const q of ["tiktok-api", "instagram", "youtube"] as UploadPlatform[]) if (!out.includes(q)) out.push(q);
    } else if ((UPLOAD_PLATFORMS as string[]).includes(p)) {
      out.push(p as UploadPlatform);
    } else {
      throw new Error(`Unknown upload platform "${p}". Use: ${UPLOAD_PLATFORMS.join(", ")} or all`);
    }
  }
  return [...new Set(out)];
}

export async function runUploads(platforms: UploadPlatform[], job: UploadJob): Promise<UploadOutcome[]> {
  const log = job.log || (() => undefined);
  const results: UploadOutcome[] = [];
  const tasks = platforms.map(async (platform): Promise<UploadOutcome> => {
    try {
      switch (platform) {
        case "tiktok-api": {
          if (job.dryRun) {
            log(`[dry-run] would send ${job.videoPath} to the TikTok inbox as a draft (caption + AI label set in-app).`);
            return { platform, success: true, detail: "dry-run" };
          }
          const publishId = await uploadToTiktok(job.videoPath);
          return { platform, success: true, detail: `draft publish_id ${publishId} (open the TikTok app: add caption, enable the AI-generated label, post)` };
        }
        case "tiktok-direct": {
          const r = await uploadToTiktokDirect(job.videoPath, {
            title: job.caption,
            isAigc: true,
            privacyLevel: job.tiktokPrivacy,
            dryRun: job.dryRun,
            log,
          });
          return { platform, success: true, detail: `publish_id ${r.publishId} (${r.status})` };
        }
        case "tiktok": {
          if (job.dryRun) {
            log(`[dry-run] would upload via session cookie with caption:\n${job.caption}`);
            return { platform, success: true, detail: "dry-run" };
          }
          await uploadToTiktokWithSession(job.videoPath, job.caption);
          return { platform, success: true, detail: "posted via session cookie" };
        }
        case "instagram": {
          const r = await uploadToInstagram(job.videoPath, {
            caption: job.caption,
            coverPath: job.coverPath,
            tempHost: job.igTempHost,
            publicVideoUrl: job.igVideoUrl,
            dryRun: job.dryRun,
            log,
          });
          return { platform, success: true, detail: `media ${r.mediaId}`, url: r.permalink };
        }
        case "youtube": {
          if (job.dryRun) {
            log(`[dry-run] would upload to YouTube titled "${job.title}"`);
            return { platform, success: true, detail: "dry-run" };
          }
          const url = await uploadToYoutube(job.videoPath, job.title, job.caption, job.hashtags.slice(0, 3));
          return { platform, success: true, url };
        }
      }
    } catch (err) {
      return { platform, success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  for (const r of await Promise.all(tasks)) results.push(r);
  return results;
}
