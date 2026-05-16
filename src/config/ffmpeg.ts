import ffmpeg from "fluent-ffmpeg";
import ffmpegStaticPath from "ffmpeg-static";

/**
 * Resolve ffmpeg without throwing at import time (so `--doctor` can still run
 * to diagnose a missing binary). Priority:
 *   1. FFMPEG_PATH env var (system/winget/brew ffmpeg)
 *   2. ffmpeg-static bundled binary
 *   3. fall back to whatever `ffmpeg` is on PATH (don't pin a path)
 */
const resolved = process.env.FFMPEG_PATH || ffmpegStaticPath || null;
if (resolved) {
  ffmpeg.setFfmpegPath(resolved);
}

export default ffmpeg;
