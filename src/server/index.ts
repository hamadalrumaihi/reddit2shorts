/**
 * R2S Mobile Control Panel Server
 * Serves a PWA web app and provides API endpoints for remote job management.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { spawn, type ChildProcess } from "child_process";

const PORT = 3579;
const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const WEBAPP_PATH = join(import.meta.dir, "webapp.html");
const RUNS_PATH = join(PROJECT_ROOT, "analytics", "runs.json");

// Job state
let currentJob: ChildProcess | null = null;
let jobState = {
  running: false,
  step: "",
  postTitle: "",
  startTime: 0,
  elapsed: 0,
  lastRun: null as { postTitle?: string; duration?: number } | null,
};

// Parse stdout for progress updates
function parseOutput(line: string) {
  const l = line.trim();
  if (!l) return;

  // Detect step changes from ora spinners and log output
  if (l.includes("Fetching") || l.includes("fetching")) jobState.step = "Fetching post";
  else if (l.includes("Generating audio") || l.includes("TTS")) jobState.step = "Generating audio";
  else if (l.includes("Screenshot") || l.includes("screenshot")) jobState.step = "Taking screenshots";
  else if (l.includes("Composing") || l.includes("ffmpeg") || l.includes("video")) jobState.step = "Composing video";
  else if (l.includes("Upload") || l.includes("upload")) jobState.step = "Uploading";
  else if (l.includes("metadata") || l.includes("Metadata")) jobState.step = "Generating metadata";

  // Try to capture post title
  const titleMatch = l.match(/(?:Post|Title|Creating short for)[:\s]+["']?(.{10,80})["']?/i);
  if (titleMatch) jobState.postTitle = titleMatch[1].replace(/["']/g, "");

  // Also capture from structured log
  if (l.includes('"postTitle"')) {
    const m = l.match(/"postTitle"\s*:\s*"([^"]+)"/);
    if (m) jobState.postTitle = m[1];
  }
}

function startJob(params: { account?: string; upload?: string; preset?: string }) {
  if (currentJob) return { ok: false, error: "A job is already running" };

  const args = ["src/cli.ts", "--random"];
  if (params.account) args.push("--account", params.account);
  if (params.upload) args.push("--upload", params.upload);
  if (params.preset) args.push("--preset", params.preset);

  jobState = {
    running: true,
    step: "Starting",
    postTitle: "",
    startTime: Date.now(),
    elapsed: 0,
    lastRun: jobState.lastRun,
  };

  currentJob = spawn("bun", args, {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: `C:\\Users\\hkalr\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin;${process.env.PATH}`,
    },
  });

  currentJob.stdout?.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach(parseOutput);
  });

  currentJob.stderr?.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach(parseOutput);
  });

  currentJob.on("close", (code) => {
    const duration = Date.now() - jobState.startTime;
    jobState.lastRun = {
      postTitle: jobState.postTitle || "Unknown",
      duration,
    };
    jobState.running = false;
    jobState.step = code === 0 ? "Completed" : `Exited (${code})`;
    currentJob = null;
  });

  return { ok: true };
}

function stopJob() {
  if (!currentJob) return { ok: false, error: "No job running" };
  currentJob.kill("SIGTERM");
  setTimeout(() => {
    if (currentJob) currentJob.kill("SIGKILL");
  }, 5000);
  return { ok: true };
}

function getHistory(): any[] {
  try {
    if (!existsSync(RUNS_PATH)) return [];
    const data = JSON.parse(readFileSync(RUNS_PATH, "utf-8"));
    return Array.isArray(data) ? data.slice(-10).reverse() : [];
  } catch {
    return [];
  }
}

// SVG Icon
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1a2e"/>
  <text x="256" y="340" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="220" fill="#00FFAA">R2S</text>
</svg>`;

// PWA Manifest
const MANIFEST = JSON.stringify({
  name: "R2S",
  short_name: "R2S",
  description: "Reddit to Shorts Control Panel",
  start_url: "/",
  display: "standalone",
  background_color: "#1a1a2e",
  theme_color: "#00FFAA",
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
  ]
});

// Serve
const webappHTML = readFileSync(WEBAPP_PATH, "utf-8");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers for ngrok
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Routes
    if (path === "/" || path === "/index.html") {
      return new Response(webappHTML, {
        headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/manifest.json") {
      return new Response(MANIFEST, {
        headers: { ...headers, "Content-Type": "application/manifest+json" },
      });
    }

    if (path === "/icon.svg") {
      return new Response(ICON_SVG, {
        headers: { ...headers, "Content-Type": "image/svg+xml" },
      });
    }

    if (path === "/api/run" && req.method === "POST") {
      try {
        const body = await req.json();
        const result = startJob(body);
        return Response.json(result, { headers });
      } catch {
        return Response.json({ ok: false, error: "Invalid request" }, { headers });
      }
    }

    if (path === "/api/status") {
      if (jobState.running) {
        jobState.elapsed = Date.now() - jobState.startTime;
      }
      return Response.json(jobState, { headers });
    }

    if (path === "/api/stop" && req.method === "POST") {
      const result = stopJob();
      return Response.json(result, { headers });
    }

    if (path === "/api/history") {
      return Response.json(getHistory(), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  },
});

console.log(`
╔══════════════════════════════════════════╗
║   R2S Control Panel                      ║
║   Local:  http://localhost:${PORT}          ║
║   Remote: https://map-reroute-freefall.ngrok-free.dev
╚══════════════════════════════════════════╝
`);
