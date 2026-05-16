import { readdir, stat, rm } from "fs/promises";
import path from "path";

const SHORTS_DIR = "shorts";
// Preserved across cleanups (cached background assets, not generated output).
const KEEP = new Set(["bgVideo.mp4", "bgAudio.mp3", ".bg-cache.json"]);

/**
 * Delete generated per-post folders under shorts/. Background-asset cache
 * files are preserved. `olderThanDays` of 0 means delete all.
 * Returns the number of folders removed.
 */
export async function cleanGeneratedVideos(olderThanDays = 0): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(SHORTS_DIR);
  } catch {
    return 0; // nothing generated yet
  }

  const cutoff = Date.now() - olderThanDays * 86400_000;
  let removed = 0;

  for (const name of entries) {
    if (KEEP.has(name)) continue;
    const full = path.join(SHORTS_DIR, name);
    const info = await stat(full).catch(() => null);
    if (!info || !info.isDirectory()) continue;
    if (olderThanDays > 0 && info.mtimeMs > cutoff) continue;
    await rm(full, { recursive: true, force: true });
    removed++;
  }
  return removed;
}
