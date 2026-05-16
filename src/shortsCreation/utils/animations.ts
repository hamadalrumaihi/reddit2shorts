import type { AnimationType, BgEffect } from "../../config/videoConfig";

/**
 * Returns an ffmpeg filter string for title animations.
 *
 * @param type - The animation type to apply
 * @param durationSec - Duration of the clip in seconds (used for frame count at 30fps)
 * @returns ffmpeg filter string, or empty string if no filter needed
 */
export function getTitleAnimationFilter(
  type: AnimationType,
  durationSec: number
): string {
  const frames = Math.round(durationSec * 30);
  const fadeFrames = Math.min(30, frames); // 1 second fade or less

  switch (type) {
    case "fade":
      return `fade=in:0:${fadeFrames}`;

    case "slide":
      // Slide up from below: crop revealing content from bottom to top
      return `crop=iw:ih:0:'max(0,ih-t*ih/${fadeFrames})'`;

    case "zoom":
      // Slow zoom in from 1.0 to 1.2x over the duration
      return `zoompan=z='min(zoom+0.002,1.2)':d=${frames}:s=1080x1920:fps=30`;

    case "typewriter":
      // Typewriter effect is handled in the HTML template, not via ffmpeg filter
      return "";

    case "none":
    default:
      return "";
  }
}

/**
 * Returns an ffmpeg filter string for comment animations with stagger support.
 *
 * @param type - The animation type to apply
 * @param index - Comment index (0-based) for stagger offset calculation
 * @param staggerMs - Milliseconds between each comment's animation start
 * @returns ffmpeg filter string, or empty string if no filter needed
 */
export function getCommentAnimationFilter(
  type: AnimationType,
  index: number,
  staggerMs: number
): string {
  // Calculate the start frame based on stagger
  const staggerFrames = Math.round((staggerMs * index) / (1000 / 30));
  const fadeFrames = 20; // ~0.67 seconds

  switch (type) {
    case "fade":
      return `fade=in:${staggerFrames}:${fadeFrames}`;

    case "slide":
      // Slide up with stagger offset
      if (staggerFrames > 0) {
        return `fade=in:${staggerFrames}:${fadeFrames}`;
      }
      return `fade=in:0:${fadeFrames}`;

    case "zoom":
      return `fade=in:${staggerFrames}:${fadeFrames}`;

    case "typewriter":
      // Handled in template rendering
      return "";

    case "none":
    default:
      return "";
  }
}

/**
 * Returns an ffmpeg filter string for background video effects.
 *
 * @param effect - The background effect to apply
 * @returns ffmpeg filter string, or empty string if no effect
 */
export function getBgEffectFilter(effect: BgEffect): string {
  switch (effect) {
    case "blur":
      return "boxblur=10:5";

    case "zoom":
      // Slow continuous zoom on the background
      return "zoompan=z='min(zoom+0.0005,1.15)':d=1:s=1080x1920:fps=30";

    case "grayscale":
      return "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3";

    case "warm":
      // Shift color temperature warmer (higher kelvin)
      return "colortemperature=temperature=6500";

    case "cool":
      // Shift color temperature cooler (lower kelvin)
      return "colortemperature=temperature=3500";

    case "none":
    default:
      return "";
  }
}
