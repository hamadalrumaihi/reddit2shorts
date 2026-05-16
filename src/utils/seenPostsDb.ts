import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), ".seen-posts.db");
const LEGACY_JSON_PATH = path.resolve(process.cwd(), ".seen-posts.json");
const DEFAULT_WINDOW_DAYS = 90;

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS seen_posts (
        id TEXT PRIMARY KEY,
        seen_at INTEGER NOT NULL
      )
    `);
    migrateLegacyJson();
  }
  return db;
}

/**
 * On first run, if the legacy .seen-posts.json exists, migrate its IDs
 * into the SQLite database and leave the JSON file in place (user can delete).
 */
function migrateLegacyJson(): void {
  if (!existsSync(LEGACY_JSON_PATH)) return;

  const database = db;
  // Check if we already migrated (table has rows)
  const count = database
    .prepare("SELECT COUNT(*) as cnt FROM seen_posts")
    .get() as { cnt: number };
  if (count.cnt > 0) return;

  try {
    const data = JSON.parse(readFileSync(LEGACY_JSON_PATH, "utf8"));
    if (!Array.isArray(data)) return;

    const now = Date.now();
    const insert = database.prepare(
      "INSERT OR IGNORE INTO seen_posts (id, seen_at) VALUES (?, ?)"
    );
    const migrate = database.transaction((ids: string[]) => {
      for (const id of ids) {
        insert.run(id, now);
      }
    });
    migrate(data);
  } catch {
    // If JSON is corrupt, skip migration silently
  }
}

/** Extract the base36 post id from a permalink like /r/x/comments/<id>/slug/. */
export function postIdFromPermalink(permalink: string): string | null {
  const parts = permalink.split("/").filter(Boolean);
  const i = parts.indexOf("comments");
  return i !== -1 && parts[i + 1] ? parts[i + 1] : null;
}

/** Mark a post ID as seen with the current timestamp. */
export function markSeen(id: string): void {
  const database = getDb();
  database
    .prepare(
      "INSERT OR REPLACE INTO seen_posts (id, seen_at) VALUES (?, ?)"
    )
    .run(id, Date.now());
}

/**
 * Check if a post ID has been seen.
 * If windowDays is provided, only returns true if seen within that window.
 * Defaults to 90 days.
 */
export function isSeen(id: string, windowDays: number = DEFAULT_WINDOW_DAYS): boolean {
  const database = getDb();
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const row = database
    .prepare("SELECT seen_at FROM seen_posts WHERE id = ? AND seen_at >= ?")
    .get(id, cutoff) as { seen_at: number } | undefined;
  return row !== undefined;
}

/**
 * Get all seen post IDs, optionally limited to a time window.
 */
export function getSeenIds(windowDays?: number): Set<string> {
  const database = getDb();
  let rows: { id: string }[];

  if (windowDays !== undefined) {
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    rows = database
      .prepare("SELECT id FROM seen_posts WHERE seen_at >= ?")
      .all(cutoff) as { id: string }[];
  } else {
    rows = database.prepare("SELECT id FROM seen_posts").all() as {
      id: string;
    }[];
  }

  return new Set(rows.map((r) => r.id));
}

/** True if this post (by permalink) has already been seen. */
export function isPermalinkSeen(permalink: string, seen: Set<string>): boolean {
  const id = postIdFromPermalink(permalink);
  return id !== null && seen.has(id);
}

/**
 * Delete entries older than the specified number of days.
 * Returns the number of deleted rows.
 */
export function pruneOld(olderThanDays: number): number {
  const database = getDb();
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const result = database
    .prepare("DELETE FROM seen_posts WHERE seen_at < ?")
    .run(cutoff);
  return result.changes;
}
