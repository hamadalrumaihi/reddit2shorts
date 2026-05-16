import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

if (!ffmpegPath) {
  throw new Error(
    "ffmpeg-static did not resolve a binary path. Is the package installed?"
  );
}
ffmpeg.setFfmpegPath(ffmpegPath);

export default ffmpeg;
