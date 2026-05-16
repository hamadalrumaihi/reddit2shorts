import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

/**
 * Tiny persistent record of Reddit post IDs already turned into a short, so an
 * automated/repeated run never re-posts the same content. Stored as a JSON
 * array at the project root (gitignored).
 */

const SEEN_FILE = path.resolve(process.cwd(), ".seen-posts.json");

/** Extract the base36 post id from a permalink like /r/x/comments/<id>/slug/. */
export function postIdFromPermalink(permalink: string): string | null {
  const parts = permalink.split("/").filter(Boolean);
  const i = parts.indexOf("comments");
  return i !== -1 && parts[i + 1] ? parts[i + 1] : null;
}

export function getSeenIds(): Set<string> {
  if (!existsSync(SEEN_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(SEEN_FILE, "utf8"));
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

export function markSeen(id: string): void {
  const ids = getSeenIds();
  if (ids.has(id)) return;
  ids.add(id);
  writeFileSync(SEEN_FILE, JSON.stringify([...ids], null, 2));
}

/** True if this post (by permalink) has already been used. */
export function isPermalinkSeen(permalink: string, seen: Set<string>): boolean {
  const id = postIdFromPermalink(permalink);
  return id !== null && seen.has(id);
}
