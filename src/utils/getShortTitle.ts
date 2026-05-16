import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "../config/env";

export async function getShortTitle(reddittTitle: string, subreddit: string) {
    const ai = new GoogleGenAI({
        apiKey: requireEnv("GEMINI_API_KEY", "YouTube title generation"),
    });

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `for this ${reddittTitle} reddit post from ${subreddit} just give only one catchy title preferably make it resemble the given reddit title, the title should be aimed to get more views and should be in plain text`,
    });
    return response.text

}


