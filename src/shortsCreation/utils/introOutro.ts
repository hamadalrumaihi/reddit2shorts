import ffmpeg from "fluent-ffmpeg";
import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";
import { introTemplate, outroTemplate } from "../../constants/templates";
import { getTitleAnimationFilter } from "./animations";
import type { AnimationType } from "../../config/videoConfig";

interface IntroConfig {
  subreddit: string;
  title: string;
  template?: string;
}

interface OutroConfig {
  subscribeCta?: string;
  template?: string;
}

/**
 * Generate an intro card image by rendering an HTML template with Puppeteer.
 */
export async function generateIntroCard(
  config: IntroConfig,
  outputPath: string
): Promise<void> {
  const html = (config.template || introTemplate)
    .replace(/%subreddit%/g, config.subreddit)
    .replace(/%title%/g, config.title);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false,
    });
  } finally {
    await browser.close();
  }
}

/**
 * Generate an outro card image by rendering an HTML template with Puppeteer.
 */
export async function generateOutroCard(
  config: OutroConfig,
  outputPath: string
): Promise<void> {
  const cta = config.subscribeCta || "Like & Subscribe for more!";
  const html = (config.template || outroTemplate).replace(
    /%subscribeCta%/g,
    cta
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false,
    });
  } finally {
    await browser.close();
  }
}

/**
 * Create a video from a still image with a specified duration and optional animation.
 *
 * @param imagePath - Path to the input image (PNG)
 * @param durationSec - Duration of the output video in seconds
 * @param outputPath - Path for the output MP4 file
 * @param animation - Optional animation type to apply
 */
export async function createIntroVideo(
  imagePath: string,
  durationSec: number,
  outputPath: string,
  animation?: AnimationType
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(imagePath)
      .inputOptions(["-loop 1", "-framerate 30"]);

    // Build video filters
    const filters: string[] = [];

    // Ensure even dimensions
    filters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");

    // Add animation filter if specified
    if (animation && animation !== "none") {
      const animFilter = getTitleAnimationFilter(animation, durationSec);
      if (animFilter) {
        filters.push(animFilter);
      }
    }

    command
      .videoFilters(filters)
      .outputOptions([
        `-t ${durationSec}`,
        "-c:v libx264",
        "-tune stillimage",
        "-r 30",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
        // Generate silent audio track so concat works with audio streams
        "-f lavfi",
        "-i anullsrc=r=44100:cl=stereo",
        "-shortest",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}
