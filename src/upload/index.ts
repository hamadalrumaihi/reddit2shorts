import { requireEnv } from "../config/env";
import fs from "fs";
import { google } from "googleapis";

export async function uploadToYoutube(
  videoPath: string,
  title: string,
  description: string,
  tags: string[],
) {
  const CLIENT_ID = requireEnv("GOOGLE_CLIENT_ID", "--upload youtube");
  const CLIENT_SECRET = requireEnv("GOOGLE_CLIENT_SECRET", "--upload youtube");
  const REDIRECT_URI = "https://developers.google.com/oauthplayground";

  const ACCESS_TOKEN = requireEnv("GOOGLE_ACCESS_TOKEN", "--upload youtube");
  const REFRESH_TOKEN = requireEnv("GOOGLE_REFRESH_TOKEN", "--upload youtube");

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expiry_date: Date.now() - 1000,
  });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  try {
    const res = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: tags.slice(0, 3),
          defaultLanguage: "en", // UI language (e.g., 'en', 'fr', 'es')
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: "public", // 'public', 'private', or 'unlisted'
          madeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    return `https://www.youtube.com/watch?v=${res.data.id}`;
  } catch (error) {
    console.error("YouTube upload failed:", error);
    throw error;
  }
}
