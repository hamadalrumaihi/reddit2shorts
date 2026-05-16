import { mkdir, access, readFile, writeFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const shortsDir = "shorts";
const cacheFile = path.join(shortsDir, ".bg-cache.json");

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readCache(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  } catch {
    return {};
  }
}

async function writeCache(cache: Record<string, string>) {
  await writeFile(cacheFile, JSON.stringify(cache, null, 2));
}

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const YTDLP_COMMON =
  'yt-dlp --remote-components ejs:github --extractor-args "youtube:player_client=ios,web"';

/**
 * Download background audio + video, with:
 *  - per-URL caching: a cached file is reused only if it came from one of the
 *    currently-requested URLs (avoids re-fetching the same source, but
 *    refreshes when the URL pool changes).
 *  - fallback pool: each URL is tried in turn until one succeeds.
 */
export async function downloadBackgroundAssets(
  videoUrls: string | string[],
  audioUrls: string | string[]
) {
  const videos = shuffled(
    Array.isArray(videoUrls) ? videoUrls : [videoUrls]
  );
  const audios = shuffled(
    Array.isArray(audioUrls) ? audioUrls : [audioUrls]
  );

  const mp3Path = path.join(shortsDir, "bgAudio.mp3");
  const mp4Path = path.join(shortsDir, "bgVideo.mp4");

  await mkdir(shortsDir, { recursive: true });
  const cache = await readCache();

  await ensureAsset({
    file: mp3Path,
    key: "bgAudio.mp3",
    urls: audios,
    cache,
    command: (url) =>
      `${YTDLP_COMMON} -x --audio-format mp3 -o "${shortsDir}/bgAudio.%(ext)s" "${url}"`,
  });

  await ensureAsset({
    file: mp4Path,
    key: "bgVideo.mp4",
    urls: videos,
    cache,
    command: (url) =>
      `${YTDLP_COMMON} -f "bestvideo[height<=720]+bestaudio/best" --merge-output-format mp4 -o "${shortsDir}/bgVideo.%(ext)s" "${url}"`,
  });

  await writeCache(cache);
}

async function ensureAsset({
  file,
  key,
  urls,
  cache,
  command,
}: {
  file: string;
  key: string;
  urls: string[];
  cache: Record<string, string>;
  command: (url: string) => string;
}) {
  if ((await fileExists(file)) && urls.includes(cache[key])) {
    return; // cached file came from a still-requested URL
  }

  const errors: string[] = [];
  for (const url of urls) {
    try {
      await execAsync(command(url));
      cache[key] = url;
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(`⚠️ Background source failed (${url}): ${message}`);
      errors.push(url);
    }
  }
  throw new Error(
    `All ${errors.length} background source(s) for ${key} failed. ` +
      `Update yt-dlp (yt-dlp -U) or supply different --bg URLs.`
  );
}
