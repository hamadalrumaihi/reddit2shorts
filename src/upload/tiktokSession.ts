import puppeteer from "puppeteer";
import { requireEnv } from "../config/env";

/**
 * Best-effort TikTok upload by driving the web UI with a `sessionid` cookie
 * (TIKTOK_SESSION_ID). This is intentionally fragile: TikTok actively fights
 * upload automation (DOM changes, headless detection, captchas, cookie
 * expiry). It is the user's explicit choice over the official API. Treat
 * selector breakage as expected maintenance, not a bug.
 *
 * The official, durable alternative remains available via `--upload tiktok-api`.
 */

const launchOptions = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  ...(process.env.PUPPETEER_EXECUTABLE_PATH
    ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
    : {}),
};

const UPLOAD_URL = "https://www.tiktok.com/tiktokstudio/upload";
const NAV_TIMEOUT = 120_000;

export async function uploadToTiktokWithSession(
  videoPath: string,
  caption = ""
): Promise<void> {
  const sessionId = requireEnv("TIKTOK_SESSION_ID", "--upload tiktok");

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    await page.setCookie({
      name: "sessionid",
      value: sessionId,
      domain: ".tiktok.com",
      path: "/",
      httpOnly: true,
      secure: true,
    });

    await page.goto(UPLOAD_URL, { waitUntil: "networkidle2" });

    // The upload page renders the real <input type=file> inside an iframe in
    // some variants and inline in others; try the page first, then iframes.
    const fileInput = await findFileInput(page);
    if (!fileInput) {
      throw new Error(
        "Could not find the TikTok file input — the page layout likely changed, " +
          "or the session cookie is invalid/expired (you may have been redirected to login)."
      );
    }
    await fileInput.uploadFile(videoPath);

    // Wait for TikTok to ingest/transcode the file. The caption box appears
    // once the upload is accepted.
    const captionBox = await waitForCaptionBox(page);
    if (caption && captionBox) {
      await captionBox.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.keyboard.type(caption, { delay: 15 });
    }

    const posted = await clickPostButton(page);
    if (!posted) {
      throw new Error(
        "Upload reached the editor but the Post button could not be clicked " +
          "(selector changed, or TikTok showed a verification/captcha)."
      );
    }

    // Give TikTok a moment to register the publish before tearing down.
    await new Promise((r) => setTimeout(r, 8000));
  } finally {
    await browser.close();
  }
}

async function findFileInput(page: import("puppeteer").Page) {
  try {
    await page.waitForSelector('input[type="file"]', { timeout: 30_000 });
    const direct = await page.$('input[type="file"]');
    if (direct) return direct;
  } catch {
    /* fall through to iframes */
  }
  for (const frame of page.frames()) {
    const input = await frame.$('input[type="file"]').catch(() => null);
    if (input) return input;
  }
  return null;
}

async function waitForCaptionBox(page: import("puppeteer").Page) {
  // TikTok's caption is a contenteditable div; selector has churned a lot.
  const selectors = [
    'div[contenteditable="true"]',
    '[data-text="true"]',
    ".public-DraftEditor-content",
  ];
  for (const sel of selectors) {
    const el = await page
      .waitForSelector(sel, { timeout: 60_000 })
      .catch(() => null);
    if (el) return el;
  }
  return null;
}

async function clickPostButton(page: import("puppeteer").Page) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const post = buttons.find(
      (b) => b.textContent?.trim().toLowerCase() === "post"
    );
    if (post && !(post as HTMLButtonElement).disabled) {
      (post as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  return clicked;
}
