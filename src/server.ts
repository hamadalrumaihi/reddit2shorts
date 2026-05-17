/**
 * Lightweight HTTP server for triggering reddit2shorts remotely.
 * Designed to be hit from iOS Shortcuts / Android Tasker over cellular.
 *
 * Start: bun run src/server.ts
 * Then expose via ngrok: ngrok http 3579
 */

import { serve } from "bun";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PORT = Number(process.env.R2S_PORT) || 3579;
const SECRET = process.env.R2S_SECRET || ""; // optional auth token

interface RunJob {
  id: string;
  status: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  account?: string;
  preset?: string;
  output?: string;
  error?: string;
  log: string[];
}

let currentJob: RunJob | null = null;
const jobHistory: RunJob[] = [];

function authCheck(req: Request): boolean {
  if (!SECRET) return true; // no secret = open access
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === SECRET;
}

function triggerRun(params: URLSearchParams): RunJob {
  const account = params.get("account") || undefined;
  const preset = params.get("preset") || undefined;
  const upload = params.get("upload") || "tiktok";
  const subreddit = params.get("subreddit") || undefined;

  const job: RunJob = {
    id: `job_${Date.now()}`,
    status: "running",
    startedAt: new Date().toISOString(),
    account,
    preset,
    log: [],
  };

  currentJob = job;

  // Build CLI args
  const args = ["run", "src/cli.ts", "--random", "--upload", upload, "--generate-metadata", "--trending"];
  if (account) args.push("--account", account);
  if (preset) args.push("--preset", preset);
  if (subreddit) args.push("--subreddits", subreddit);

  const child = spawn("bun", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: `C:\\Users\\hkalr\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin;${process.env.PATH}`,
    },
    shell: true,
  });

  child.stdout?.on("data", (data) => {
    const line = data.toString().trim();
    if (line) job.log.push(line);
  });

  child.stderr?.on("data", (data) => {
    const line = data.toString().trim();
    if (line) job.log.push(`[err] ${line}`);
  });

  child.on("close", (code) => {
    job.finishedAt = new Date().toISOString();
    if (code === 0) {
      job.status = "done";
      // Try to find the output file from logs
      const outputLine = job.log.find(l => l.includes("shorts/"));
      if (outputLine) job.output = outputLine;
    } else {
      job.status = "failed";
      job.error = `Process exited with code ${code}`;
    }
    jobHistory.unshift(job);
    if (jobHistory.length > 20) jobHistory.pop();
    if (currentJob?.id === job.id) currentJob = null;
  });

  return job;
}

function getAnalytics(): object | null {
  const runsFile = join(process.cwd(), "analytics", "runs.json");
  if (!existsSync(runsFile)) return null;
  try {
    const runs = JSON.parse(readFileSync(runsFile, "utf-8"));
    return {
      totalRuns: runs.length,
      last5: runs.slice(-5).reverse().map((r: any) => ({
        time: r.timestamp,
        sub: r.subreddit,
        title: r.postTitle?.slice(0, 50),
        upload: r.uploadStatus,
        ms: r.timing?.total,
      })),
    };
  } catch {
    return null;
  }
}

console.log(`\n🚀 reddit2shorts remote server running on port ${PORT}`);
console.log(`   Trigger: http://localhost:${PORT}/run`);
console.log(`   Status:  http://localhost:${PORT}/status`);
if (SECRET) console.log(`   Auth:    token required (?token=YOUR_SECRET)`);
console.log(`\n   Expose with: ngrok http ${PORT}\n`);

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Auth check
    if (!authCheck(req)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    // GET /run — trigger a new video
    if (path === "/run" || path === "/run/") {
      if (currentJob) {
        return Response.json({
          error: "busy",
          message: "A job is already running",
          job: { id: currentJob.id, startedAt: currentJob.startedAt, account: currentJob.account },
        }, { status: 429 });
      }

      const job = triggerRun(url.searchParams);
      return Response.json({
        ok: true,
        message: "Video generation started",
        jobId: job.id,
        account: job.account,
        checkStatus: `/status`,
      });
    }

    // GET /status — current job + recent history
    if (path === "/status" || path === "/status/") {
      return Response.json({
        currentJob: currentJob ? {
          id: currentJob.id,
          status: currentJob.status,
          startedAt: currentJob.startedAt,
          account: currentJob.account,
          logTail: currentJob.log.slice(-5),
        } : null,
        recentJobs: jobHistory.slice(0, 5).map(j => ({
          id: j.id,
          status: j.status,
          startedAt: j.startedAt,
          finishedAt: j.finishedAt,
          account: j.account,
        })),
        analytics: getAnalytics(),
      });
    }

    // GET /accounts — list available accounts
    if (path === "/accounts" || path === "/accounts/") {
      try {
        const accountsFile = join(process.cwd(), "accounts.json");
        if (existsSync(accountsFile)) {
          const data = JSON.parse(readFileSync(accountsFile, "utf-8"));
          return Response.json({
            default: data.defaultAccount,
            accounts: data.accounts.map((a: any) => ({
              name: a.name,
              platform: a.platform,
              subreddits: a.subreddits,
              style: a.contentStyle,
            })),
          });
        }
      } catch {}
      return Response.json({ accounts: ["main"] });
    }

    // GET /stop — kill current job
    if (path === "/stop" || path === "/stop/") {
      if (!currentJob) {
        return Response.json({ message: "No job running" });
      }
      currentJob.status = "failed";
      currentJob.error = "Manually stopped";
      currentJob.finishedAt = new Date().toISOString();
      jobHistory.unshift(currentJob);
      currentJob = null;
      return Response.json({ ok: true, message: "Job stopped" });
    }

    // GET / — simple health check with instructions
    if (path === "/" || path === "") {
      return Response.json({
        service: "reddit2shorts",
        version: "1.0.0",
        endpoints: {
          "/run": "Trigger new video (params: account, preset, upload, subreddit)",
          "/run?account=brainrot": "Run with specific account",
          "/run?upload=all": "Upload to all platforms",
          "/status": "Check current/recent job status",
          "/accounts": "List configured accounts",
          "/stop": "Stop current job",
        },
      });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});
