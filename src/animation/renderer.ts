import { spawn } from "child_process";
import { once } from "events";
import { writeFile } from "fs/promises";
import puppeteer, { Browser, CDPSession, Page } from "puppeteer";
import { resolveFfmpegPath } from "../config/ffmpeg";
import { buildPageHtml } from "./page";
import { Timeline } from "./timeline";

/**
 * Renders the timeline to a silent H.264 video by screenshotting headless
 * Chrome frame-by-frame and piping PNGs straight into ffmpeg (no frame files
 * on disk). Several tabs capture in parallel; frames are written in order.
 */

export interface RenderOptions {
  timeline: Timeline;
  outVideoPath: string;
  /** Parallel Chrome tabs (default 3). */
  workers?: number;
  onProgress?: (frame: number, total: number) => void;
}

interface Worker {
  page: Page;
  cdp: CDPSession;
}

const launchOptions = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars", "--font-render-hinting=none"],
  ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
};

async function makeWorker(browser: Browser, html: string, timeline: Timeline): Promise<Worker> {
  const page = await browser.newPage();
  await page.setViewport({ width: timeline.width, height: timeline.height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
  await page.evaluate((tl) => (window as unknown as { __setup: (t: unknown) => void }).__setup(tl), timeline);
  const cdp = await page.createCDPSession();
  return { page, cdp };
}

async function captureFrame(w: Worker, frame: number, cover = false): Promise<Buffer> {
  await w.page.evaluate(
    (f, c) => (window as unknown as { renderFrame: (f: number, o: unknown) => void }).renderFrame(f, { cover: c }),
    frame,
    cover
  );
  const { data } = await w.cdp.send("Page.captureScreenshot", {
    format: cover ? "jpeg" : "png",
    quality: cover ? 92 : undefined,
    optimizeForSpeed: true,
  });
  return Buffer.from(data, "base64");
}

export async function renderAnimation(opts: RenderOptions): Promise<void> {
  const { timeline, outVideoPath } = opts;
  const workersCount = Math.max(1, opts.workers ?? Number(process.env.ANIM_RENDER_WORKERS || 3));
  const total = Math.ceil(timeline.durationSec * timeline.fps);
  const html = await buildPageHtml();

  const browser = await puppeteer.launch(launchOptions);
  const ffmpeg = spawn(resolveFfmpegPath(), [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-framerate",
    String(timeline.fps),
    "-i",
    "pipe:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(timeline.fps),
    "-movflags",
    "+faststart",
    outVideoPath,
  ]);
  let ffmpegErr = "";
  ffmpeg.stderr.on("data", (d) => (ffmpegErr += d.toString()));
  const ffmpegDone = new Promise<void>((resolve, reject) => {
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${ffmpegErr}`))));
    ffmpeg.on("error", reject);
  });

  try {
    const workers = await Promise.all(Array.from({ length: workersCount }, () => makeWorker(browser, html, timeline)));
    for (let f = 0; f < total; f += workers.length) {
      const batch = workers.slice(0, Math.min(workers.length, total - f));
      const frames = await Promise.all(batch.map((w, i) => captureFrame(w, f + i)));
      for (const png of frames) {
        if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, "drain");
      }
      opts.onProgress?.(Math.min(total, f + batch.length), total);
    }
    ffmpeg.stdin.end();
    await ffmpegDone;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Render the hook frame with the big title card as cover.jpg. */
export async function renderCover(timeline: Timeline, outPath: string, atSec?: number): Promise<void> {
  const html = await buildPageHtml();
  const browser = await puppeteer.launch(launchOptions);
  try {
    const w = await makeWorker(browser, html, timeline);
    const hook = timeline.beats[0];
    const t = atSec ?? Math.min(hook.startSec + 0.45, hook.endSec);
    const jpeg = await captureFrame(w, Math.round(t * timeline.fps), true);
    await writeFile(outPath, jpeg);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
