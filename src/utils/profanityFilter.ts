export type ProfanityMode = "bleep" | "censor" | "substitute" | "off";

const DEFAULT_WORDLIST: string[] = [
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "douchebag",
  "fag",
  "faggot",
  "fuck",
  "fucking",
  "goddamn",
  "hell",
  "jackass",
  "motherfucker",
  "nigger",
  "nigga",
  "piss",
  "prick",
  "pussy",
  "retard",
  "retarded",
  "shit",
  "shitty",
  "slut",
  "twat",
  "whore",
  "wanker",
  "wtf",
];

const DEFAULT_SUBSTITUTES: string[] = [
  "frick",
  "dang",
  "heck",
  "shoot",
  "crap",
  "butt",
  "jerk",
  "dork",
  "gosh",
  "geez",
  "fudge",
  "crud",
  "darn",
  "yikes",
  "nuts",
];

function buildRegex(words: string[]): RegExp {
  // Sort by length descending so longer matches take priority
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

function getWordlist(customWords?: string[]): string[] {
  if (customWords && customWords.length > 0) {
    return [...DEFAULT_WORDLIST, ...customWords];
  }
  return DEFAULT_WORDLIST;
}

/**
 * Check whether text contains any profanity.
 */
export function containsProfanity(
  text: string,
  customWords?: string[]
): boolean {
  const wordlist = getWordlist(customWords);
  const regex = buildRegex(wordlist);
  return regex.test(text);
}

/**
 * Filter profanity from text using the specified mode.
 *
 * - "bleep": replaces with "[BLEEP]"
 * - "censor": replaces with "****"
 * - "substitute": replaces with random words from substitute list
 * - "off": returns text unchanged
 */
export function filterText(
  text: string,
  mode: ProfanityMode,
  customWords?: string[],
  substitutes?: string[]
): string {
  if (mode === "off") return text;

  const wordlist = getWordlist(customWords);
  const regex = buildRegex(wordlist);
  const subList =
    substitutes && substitutes.length > 0 ? substitutes : DEFAULT_SUBSTITUTES;

  return text.replace(regex, (match) => {
    switch (mode) {
      case "bleep":
        return "[BLEEP]";
      case "censor":
        return "*".repeat(Math.max(match.length, 4));
      case "substitute":
        return subList[Math.floor(Math.random() * subList.length)];
      default:
        return match;
    }
  });
}
