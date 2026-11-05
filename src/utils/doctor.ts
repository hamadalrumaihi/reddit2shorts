import { exec, execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";
import ffmpegStaticPath from "ffmpeg-static";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  critical: boolean;
}

export interface DoctorOptions {
  /**
   * Animated mode draws its own background, so yt-dlp (gameplay downloads)
   * is only advisory; Chrome and the Python edge-tts bridge matter more.
   */
  animated?: boolean;
}

async function firstLine(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 20_000 });
    return stdout.trim().split("\n")[0] || "(no output)";
  } catch {
    return null;
  }
}

async function pythonWithEdgeTts(): Promise<string | null> {
  for (const py of [process.env.EDGE_TTS_PYTHON, "python3", "python", "py"]) {
    if (!py) continue;
    try {
      const { stdout } = await execFileAsync(
        py,
        ["-c", "import edge_tts,sys;print(getattr(edge_tts,'__version__','?'))"],
        { timeout: 15_000 }
      );
      return `${py} (edge-tts ${stdout.trim()})`;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function runDoctor(opts: DoctorOptions = {}): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const ytdlp = await firstLine("yt-dlp --version");
  results.push({
    name: "yt-dlp",
    ok: !!ytdlp,
    detail: ytdlp
      ? `v${ytdlp} (keep current with: yt-dlp -U)`
      : opts.animated
        ? "not found — only needed for gameplay backgrounds (not --animated)"
        : "NOT found on PATH — install yt-dlp (or use --animated, which needs no downloads)",
    critical: !opts.animated,
  });

  const ffmpegEnv = process.env.FFMPEG_PATH;
  let ff = await firstLine(`"${ffmpegEnv || "ffmpeg"}" -version`);
  let ffSource = ffmpegEnv ? "FFMPEG_PATH" : "system PATH";
  if (!ff && ffmpegStaticPath) {
    ff = await firstLine(`"${ffmpegStaticPath}" -version`);
    ffSource = "ffmpeg-static";
  }
  results.push({
    name: "ffmpeg",
    ok: !!ff,
    detail: ff
      ? `${ff} (${ffSource})`
      : "no working ffmpeg — set FFMPEG_PATH or install ffmpeg",
    critical: true,
  });

  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const chromeVersion = chromePath ? await firstLine(`"${chromePath}" --version`) : null;
  results.push({
    name: "chromium (animation/screenshots)",
    ok: chromePath ? !!chromeVersion : true,
    detail: chromePath
      ? chromeVersion
        ? `${chromeVersion} (PUPPETEER_EXECUTABLE_PATH)`
        : `PUPPETEER_EXECUTABLE_PATH=${chromePath} does not run`
      : "puppeteer-bundled Chromium (downloaded by bun install)",
    critical: !!opts.animated,
  });

  const py = await pythonWithEdgeTts();
  results.push({
    name: "edge-tts (python bridge)",
    ok: !!py,
    detail: py
      ? `${py} — word timings + proxy support`
      : "not found — run 'pip install edge-tts' (falls back to node-edge-tts, which may be rejected by Microsoft)",
    critical: false,
  });

  const fontPath = path.resolve("assets/fonts/Fredoka-Bold.woff2");
  const fontOk = existsSync(fontPath);
  results.push({
    name: "caption font",
    ok: fontOk,
    detail: fontOk ? "assets/fonts/Fredoka-Bold.woff2 (OFL)" : "assets/fonts/Fredoka-Bold.woff2 missing — captions fall back to system sans",
    critical: false,
  });

  const rigs = ["crow", "hedgehog"].map((n) => path.resolve(`assets/characters/${n}.svg`));
  const rigsOk = rigs.every((r) => existsSync(r));
  results.push({
    name: "character rigs",
    ok: rigsOk,
    detail: rigsOk ? "assets/characters/{crow,hedgehog}.svg" : "assets/characters/*.svg missing",
    critical: !!opts.animated,
  });

  const df = await firstLine(
    "df -Pk . | tail -1 | awk '{print int($4/1024) \"MB free\"}'"
  );
  results.push({
    name: "disk space (cwd)",
    ok: true,
    detail: df ?? "unknown (df unavailable on this OS)",
    critical: false,
  });

  return results;
}

export function formatDoctor(results: CheckResult[]): string {
  return results
    .map((r) => `${r.ok ? "✅" : r.critical ? "❌" : "⚠️"} ${r.name}: ${r.detail}`)
    .join("\n");
}

/** True if every *critical* check passed. */
export function doctorPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.ok || !r.critical);
}
