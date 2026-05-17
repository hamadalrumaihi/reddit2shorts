/**
 * A/B Title Testing - Generates multiple title variations per video
 * and tracks which title was used + performance data.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { RedditPost } from "../reddit/types";
import { generateVideoMetadata, type Platform } from "../metadata";

export interface TitleVariation {
  id: string;
  title: string;
  style: string;
  hook: string;
  description: string;
  hashtags: string[];
}

export interface ABTestRecord {
  videoId: string;
  postId: string;
  subreddit: string;
  createdAt: string;
  variations: TitleVariation[];
  selectedVariation: string; // id of the chosen one
  platform: string;
  performance?: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
    watchTime?: number;
    lastUpdated?: string;
  };
}

const METADATA_DIR = "metadata";
const AB_TRACKING_FILE = join(METADATA_DIR, "ab-tests.json");

function ensureMetadataDir(): void {
  if (!existsSync(METADATA_DIR)) {
    mkdirSync(METADATA_DIR, { recursive: true });
  }
}

function loadABTests(): ABTestRecord[] {
  ensureMetadataDir();
  if (!existsSync(AB_TRACKING_FILE)) return [];
  try {
    return JSON.parse(readFileSync(AB_TRACKING_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveABTests(records: ABTestRecord[]): void {
  ensureMetadataDir();
  writeFileSync(AB_TRACKING_FILE, JSON.stringify(records, null, 2), "utf-8");
}

/**
 * Generate 3 title variations for a video using different metadata styles.
 */
export function generateTitleVariations(
  post: RedditPost,
  platform: Platform = "all"
): TitleVariation[] {
  const styles = ["viral", "storytelling", "controversial"] as const;

  return styles.map((style, i) => {
    const metadata = generateVideoMetadata(post, {
      platform,
      style,
      includeCallToAction: true,
    });

    return {
      id: `var_${Date.now()}_${i}`,
      title: metadata.title,
      style,
      hook: metadata.hook,
      description: metadata.description,
      hashtags: metadata.hashtags,
    };
  });
}

/**
 * Save an A/B test record for a generated video.
 */
export function saveABTestRecord(
  videoId: string,
  postId: string,
  subreddit: string,
  variations: TitleVariation[],
  selectedIndex: number = 0,
  platform: string = "all"
): ABTestRecord {
  const record: ABTestRecord = {
    videoId,
    postId,
    subreddit,
    createdAt: new Date().toISOString(),
    variations,
    selectedVariation: variations[selectedIndex]?.id ?? variations[0].id,
    platform,
  };

  const records = loadABTests();
  records.push(record);
  saveABTests(records);

  return record;
}

/**
 * Update performance data for a specific A/B test.
 */
export function updateABTestPerformance(
  videoId: string,
  performance: ABTestRecord["performance"]
): void {
  const records = loadABTests();
  const record = records.find(r => r.videoId === videoId);
  if (record) {
    record.performance = { ...record.performance, ...performance, lastUpdated: new Date().toISOString() };
    saveABTests(records);
  }
}

/**
 * Get all A/B test records.
 */
export function getABTestRecords(): ABTestRecord[] {
  return loadABTests();
}

/**
 * Analyze which style performs best based on historical data.
 */
export function analyzeBestStyle(): Record<string, { avgViews: number; count: number }> {
  const records = loadABTests().filter(r => r.performance?.views);
  const styleStats: Record<string, { totalViews: number; count: number }> = {};

  for (const record of records) {
    const selected = record.variations.find(v => v.id === record.selectedVariation);
    if (!selected || !record.performance?.views) continue;

    if (!styleStats[selected.style]) {
      styleStats[selected.style] = { totalViews: 0, count: 0 };
    }
    styleStats[selected.style].totalViews += record.performance.views;
    styleStats[selected.style].count += 1;
  }

  const result: Record<string, { avgViews: number; count: number }> = {};
  for (const [style, stats] of Object.entries(styleStats)) {
    result[style] = {
      avgViews: Math.round(stats.totalViews / stats.count),
      count: stats.count,
    };
  }
  return result;
}
