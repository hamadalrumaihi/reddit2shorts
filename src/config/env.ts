import { z } from "zod";

/**
 * Every variable is optional so the app starts with an empty .env. Each one is
 * validated lazily, only when the feature that needs it actually runs, via
 * {@link requireEnv}. This keeps low-credential paths (e.g. `--source json`)
 * runnable without filling in unrelated keys.
 */
const envSchema = z.object({
  // Reddit API — only `--source snoowrap`.
  REDDIT_CLIENT_ID: z.string().min(1).optional(),
  REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
  REDDIT_USERNAME: z.string().min(1).optional(),
  REDDIT_PASSWORD: z.string().min(1).optional(),
  // Gemini — `--source gemini` and YouTube title generation.
  GEMINI_API_KEY: z.string().min(1).optional(),
  // Google OAuth — only `--upload youtube`.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_ACCESS_TOKEN: z.string().min(1).optional(),
  GOOGLE_REFRESH_TOKEN: z.string().min(1).optional(),
  // Google Cloud TTS credentials JSON — only `--tts google`.
  GOOGLE_CREDENTIALS: z.string().min(1).optional(),
  // TikTok Content Posting API — only `--upload tiktok-api`.
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  TIKTOK_REFRESH_TOKEN: z.string().min(1).optional(),
  // TikTok session cookie — `--tts tiktok` voices and `--upload tiktok`.
  TIKTOK_SESSION_ID: z.string().min(1).optional(),
  // TikTok direct post privacy (unaudited apps: SELF_ONLY) — `--upload tiktok-direct`.
  TIKTOK_PRIVACY_LEVEL: z.string().min(1).optional(),
  // Instagram Graph API — only `--upload instagram`.
  IG_USER_ID: z.string().min(1).optional(),
  IG_ACCESS_TOKEN: z.string().min(1).optional(),
  IG_GRAPH_VERSION: z.string().min(1).optional(),
  IG_TEMP_HOST: z.string().min(1).optional(),
  IG_TEMP_HOST_EXPIRY: z.string().min(1).optional(),
  IG_TEMP_HOST_CMD: z.string().min(1).optional(),
  IG_TEMP_HOST_CLEANUP_CMD: z.string().min(1).optional(),
  CATBOX_USERHASH: z.string().min(1).optional(),
  // Edge TTS voice configuration — `--tts edge` (default).
  EDGE_TTS_VOICE: z.string().min(1).optional(),
  EDGE_TTS_VOICE_2: z.string().min(1).optional(),
  EDGE_TTS_RATE: z.string().min(1).optional(),
  EDGE_TTS_PITCH: z.string().min(1).optional(),
  EDGE_TTS_PYTHON: z.string().min(1).optional(),
  // Animated pipeline knobs.
  ANIM_MUSIC: z.string().min(1).optional(),
  ANIM_MUSIC_DB: z.string().min(1).optional(),
  ANIM_RENDER_WORKERS: z.string().min(1).optional(),
});

const env = envSchema.parse(process.env);

export type EnvKey = keyof typeof env;

/**
 * Returns the env var or throws a clear, actionable error naming the variable
 * and the feature that needs it.
 */
export function requireEnv(key: EnvKey, neededFor: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key} (needed for ${neededFor}). Add it to your .env file.`
    );
  }
  return value;
}

export default env;
