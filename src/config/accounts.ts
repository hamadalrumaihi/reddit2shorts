/**
 * Multi-account support for TikTok/YouTube with different subreddit pools and styles per account.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface AccountConfig {
  name: string;
  platform: "tiktok" | "youtube" | "both";
  // TikTok credentials
  tiktokSessionId?: string;
  tiktokClientKey?: string;
  tiktokClientSecret?: string;
  tiktokRefreshToken?: string;
  // YouTube credentials
  googleClientId?: string;
  googleClientSecret?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  // Content configuration
  subreddits: string[];
  contentStyle: string; // preset name or custom style
  voiceStyle: "normal" | "genz" | "brainrot";
  metadataStyle: "viral" | "storytelling" | "controversial" | "wholesome" | "brainrot";
  // Scheduling
  postsPerDay?: number;
  postTimes?: string[]; // e.g., ["07:00", "12:00", "19:00"]
}

export interface AccountsFile {
  defaultAccount: string;
  accounts: AccountConfig[];
}

const ACCOUNTS_FILE = "accounts.json";

let _cachedAccounts: AccountsFile | null = null;

/**
 * Load accounts configuration from accounts.json.
 */
export function loadAccounts(): AccountsFile {
  if (_cachedAccounts) return _cachedAccounts;

  const filePath = join(process.cwd(), ACCOUNTS_FILE);
  if (!existsSync(filePath)) {
    // Return a default single-account config
    const defaultAccounts: AccountsFile = {
      defaultAccount: "main",
      accounts: [
        {
          name: "main",
          platform: "both",
          subreddits: ["AskReddit", "tifu", "AmItheAsshole", "ProRevenge"],
          contentStyle: "tiktok-viral",
          voiceStyle: "normal",
          metadataStyle: "viral",
          postsPerDay: 3,
          postTimes: ["07:00", "12:00", "19:00"],
        },
      ],
    };
    _cachedAccounts = defaultAccounts;
    return defaultAccounts;
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    _cachedAccounts = JSON.parse(raw) as AccountsFile;
    return _cachedAccounts;
  } catch (e) {
    console.error(`Error loading accounts.json: ${e}`);
    process.exit(1);
  }
}

/**
 * Get a specific account by name.
 */
export function getAccount(name?: string): AccountConfig {
  const accounts = loadAccounts();
  const accountName = name ?? accounts.defaultAccount;
  const account = accounts.accounts.find(a => a.name === accountName);

  if (!account) {
    console.error(
      `Error: Account "${accountName}" not found. Available: ${accounts.accounts.map(a => a.name).join(", ")}`
    );
    process.exit(1);
  }

  return account;
}

/**
 * List all configured account names.
 */
export function listAccounts(): string[] {
  return loadAccounts().accounts.map(a => a.name);
}

/**
 * Get credentials for a specific account and platform.
 */
export function getAccountCredentials(account: AccountConfig, platform: "tiktok" | "youtube") {
  if (platform === "tiktok") {
    return {
      sessionId: account.tiktokSessionId ?? process.env.TIKTOK_SESSION_ID,
      clientKey: account.tiktokClientKey ?? process.env.TIKTOK_CLIENT_KEY,
      clientSecret: account.tiktokClientSecret ?? process.env.TIKTOK_CLIENT_SECRET,
      refreshToken: account.tiktokRefreshToken ?? process.env.TIKTOK_REFRESH_TOKEN,
    };
  }
  return {
    clientId: account.googleClientId ?? process.env.GOOGLE_CLIENT_ID,
    clientSecret: account.googleClientSecret ?? process.env.GOOGLE_CLIENT_SECRET,
    accessToken: account.googleAccessToken ?? process.env.GOOGLE_ACCESS_TOKEN,
    refreshToken: account.googleRefreshToken ?? process.env.GOOGLE_REFRESH_TOKEN,
  };
}
