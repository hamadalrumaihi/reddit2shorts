import ffmpeg from "fluent-ffmpeg";
import ffmpegStaticPath from "ffmpeg-static";

// Prefer an explicit system ffmpeg (FFMPEG_PATH) when set — useful when the
// ffmpeg-static binary is incompatible with the OS (e.g. install ffmpeg via
// winget/brew/apt and point FFMPEG_PATH at it). Falls back to ffmpeg-static.
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStaticPath;

if (!ffmpegPath) {
  throw new Error(
    "No ffmpeg binary found. Set FFMPEG_PATH to a system ffmpeg, or ensure the ffmpeg-static package is installed."
  );
}
ffmpeg.setFfmpegPath(ffmpegPath);

export default ffmpeg;
