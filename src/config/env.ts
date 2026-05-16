import { z } from "zod";

const envSchema = z.object({
  // Optional: only required when running with `--source reddit`.
  REDDIT_CLIENT_ID: z.string().min(1).optional(),
  REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
  REDDIT_USERNAME: z.string().min(1).optional(),
  REDDIT_PASSWORD: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_ACCESS_TOKEN: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
  GOOGLE_CREDENTIALS: z.string().min(1),
});

const env = envSchema.parse(process.env);

export default env;
