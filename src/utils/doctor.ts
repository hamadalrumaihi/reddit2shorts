import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStaticPath from "ffmpeg-static";

const execAsync = promisify(exec);

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  critical: boolean;
}

async function firstLine(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 20_000 });
    return stdout.trim().split("\n")[0] || "(no output)";
  } catch {
    return null;
  }
}

export async function runDoctor(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const ytdlp = await firstLine("yt-dlp --version");
  results.push({
    name: "yt-dlp",
    ok: !!ytdlp,
    detail: ytdlp
      ? `v${ytdlp} (keep current with: yt-dlp -U)`
      : "NOT found on PATH — install yt-dlp",
    critical: true,
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

  const chromium =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "(puppeteer-bundled Chromium — downloaded by bun install)";
  results.push({
    name: "chromium (screenshots/tiktok)",
    ok: true,
    detail: chromium,
    critical: false,
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
    .map((r) => `${r.ok ? "✅" : "❌"} ${r.name}: ${r.detail}`)
    .join("\n");
}

/** True if every *critical* check passed. */
export function doctorPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.ok || !r.critical);
}
