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
