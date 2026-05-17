/**
 * Analytics tracker - logs each pipeline run with timestamps, performance data,
 * and outcome information to analytics/runs.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ANALYTICS_DIR = "analytics";
const RUNS_FILE = join(ANALYTICS_DIR, "runs.json");

export interface RunRecord {
  id: string;
  timestamp: string;
  subreddit: string;
  postId: string;
  postTitle: string;
  postScore: number;
  account?: string;
  // Timing per stage (ms)
  timing: {
    fetch?: number;
    tts?: number;
    render?: number;
    upload?: number;
    total: number;
  };
  // Output info
  outputFile?: string;
  outputSizeMb?: number;
  durationSeconds?: number;
  // Upload status
  uploadStatus: "skipped" | "success" | "failed";
  uploadPlatforms: string[];
  uploadErrors?: string[];
  // Metadata
  metadataGenerated: boolean;
  titleUsed?: string;
  hashtagsUsed?: string[];
}

function ensureAnalyticsDir(): void {
  if (!existsSync(ANALYTICS_DIR)) {
    mkdirSync(ANALYTICS_DIR, { recursive: true });
  }
}

function loadRuns(): RunRecord[] {
  ensureAnalyticsDir();
  if (!existsSync(RUNS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(RUNS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveRuns(runs: RunRecord[]): void {
  ensureAnalyticsDir();
  writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), "utf-8");
}

/**
 * Create a new run tracker instance. Call methods to record timing, then finalize.
 */
export class RunTracker {
  private record: Partial<RunRecord>;
  private stageStart: number = 0;
  private runStart: number;

  constructor() {
    this.runStart = Date.now();
    this.record = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      timing: { total: 0 },
      uploadStatus: "skipped",
      uploadPlatforms: [],
      metadataGenerated: false,
    };
  }

  setPostInfo(subreddit: string, postId: string, title: string, score: number): void {
    this.record.subreddit = subreddit;
    this.record.postId = postId;
    this.record.postTitle = title;
    this.record.postScore = score;
  }

  setAccount(account: string): void {
    this.record.account = account;
  }

  startStage(): void {
    this.stageStart = Date.now();
  }

  endStage(stage: "fetch" | "tts" | "render" | "upload"): void {
    if (!this.record.timing) this.record.timing = { total: 0 };
    this.record.timing[stage] = Date.now() - this.stageStart;
  }

  setOutput(file: string, sizeMb: number, durationSeconds?: number): void {
    this.record.outputFile = file;
    this.record.outputSizeMb = sizeMb;
    this.record.durationSeconds = durationSeconds;
  }

  setUploadResult(platforms: string[], status: "success" | "failed", errors?: string[]): void {
    this.record.uploadPlatforms = platforms;
    this.record.uploadStatus = status;
    this.record.uploadErrors = errors;
  }

  setMetadata(title: string, hashtags: string[]): void {
    this.record.metadataGenerated = true;
    this.record.titleUsed = title;
    this.record.hashtagsUsed = hashtags;
  }

  /**
   * Finalize and save the run record.
   */
  finalize(): RunRecord {
    if (!this.record.timing) this.record.timing = { total: 0 };
    this.record.timing.total = Date.now() - this.runStart;

    const finalRecord = this.record as RunRecord;
    const runs = loadRuns();
    runs.push(finalRecord);
    saveRuns(runs);

    return finalRecord;
  }
}

/**
 * Get all run records.
 */
export function getRunHistory(): RunRecord[] {
  return loadRuns();
}

/**
 * Get summary statistics.
 */
export function getRunStats() {
  const runs = loadRuns();
  if (runs.length === 0) return null;

  const successRuns = runs.filter(r => r.uploadStatus === "success");
  const avgTotalTime = runs.reduce((sum, r) => sum + r.timing.total, 0) / runs.length;
  const avgRenderTime = runs.filter(r => r.timing.render).reduce((sum, r) => sum + (r.timing.render ?? 0), 0) / (runs.filter(r => r.timing.render).length || 1);

  const subredditCounts: Record<string, number> = {};
  runs.forEach(r => {
    subredditCounts[r.subreddit] = (subredditCounts[r.subreddit] ?? 0) + 1;
  });

  return {
    totalRuns: runs.length,
    successfulUploads: successRuns.length,
    failedUploads: runs.filter(r => r.uploadStatus === "failed").length,
    avgTotalTimeMs: Math.round(avgTotalTime),
    avgRenderTimeMs: Math.round(avgRenderTime),
    subredditDistribution: subredditCounts,
    lastRun: runs[runs.length - 1]?.timestamp,
  };
}
