import { createHash } from "crypto";
import { writeFile } from "fs/promises";

/**
 * Fetch the icon URL for a subreddit from the Reddit API.
 * Returns null if the icon cannot be retrieved.
 */
export async function fetchSubredditIcon(
  subreddit: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/about.json`,
      {
        headers: {
          "User-Agent": "reddit2shorts/1.0",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      data?: {
        icon_img?: string;
        community_icon?: string;
      };
    };

    // Try icon_img first, then community_icon (which may have query params)
    const iconUrl =
      data.data?.icon_img ||
      data.data?.community_icon?.split("?")[0] ||
      null;

    if (!iconUrl || iconUrl.length === 0) {
      return null;
    }

    return iconUrl;
  } catch {
    return null;
  }
}

/**
 * Download an image from a URL to a local file path.
 */
export async function downloadIcon(
  url: string,
  outputPath: string
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "reddit2shorts/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download icon: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
}

/**
 * Returns an ffmpeg overlay filter string to place a small icon in a corner.
 *
 * The icon is expected to already be scaled appropriately (e.g. 64x64).
 * The filter overlays the icon input on top of the main video input.
 *
 * @param iconPath - Path to the icon image (used as a second input)
 * @param position - Corner placement for the icon
 * @returns ffmpeg overlay filter string
 */
export function getOverlayFilter(
  iconPath: string,
  position: "top-left" | "top-right"
): string {
  const padding = 30;

  switch (position) {
    case "top-left":
      return `overlay=${padding}:${padding}`;
    case "top-right":
      return `overlay=main_w-overlay_w-${padding}:${padding}`;
  }
}

// Internal counter map for deterministic anonymization within a session
const anonymizationMap = new Map<string, string>();
let anonymizationCounter = 0;

/**
 * Anonymize a Reddit username deterministically.
 * The same input name always returns the same anonymized name within a process.
 * Uses a hash to ensure consistency across calls.
 *
 * @param name - The original Reddit username (with or without u/ prefix)
 * @returns An anonymized username like "u/Redditor1"
 */
export function anonymizeUsername(name: string): string {
  // Normalize: strip "u/" prefix if present
  const normalized = name.replace(/^u\//, "").toLowerCase();

  if (anonymizationMap.has(normalized)) {
    return anonymizationMap.get(normalized)!;
  }

  // Use a hash-based index for deterministic ordering
  const hash = createHash("md5").update(normalized).digest("hex");
  const hashNum = parseInt(hash.substring(0, 8), 16);

  // Assign a sequential number but use hash for consistency
  anonymizationCounter += 1;
  const anonymized = `u/Redditor${anonymizationCounter}`;

  anonymizationMap.set(normalized, anonymized);
  return anonymized;
}

/**
 * Reset the anonymization state. Useful between separate video generations.
 */
export function resetAnonymization(): void {
  anonymizationMap.clear();
  anonymizationCounter = 0;
}
