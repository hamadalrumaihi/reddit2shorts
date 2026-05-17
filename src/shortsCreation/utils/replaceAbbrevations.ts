import { stripEmojis, replaceEmojisWithWords } from "../../utils/emoji";

export type VoiceStyle = "normal" | "genz" | "brainrot";

/**
 * Standard Reddit abbreviation expansions for TTS readability.
 */
const STANDARD_REPLACEMENTS: Record<string, string> = {
  "\\bOP\\b": "Original Poster",
  "\\bTL;DR\\b": "Too Long; Didn't Read",
  "\\bIMO\\b": "In My Opinion",
  "\\bIMHO\\b": "In My Humble Opinion",
  "\\bAITA\\b": "Am I The Asshole",
  "\\bNSFW\\b": "Not Safe For Work",
  "\\bTIL\\b": "Today I Learned",
  "\\bELI5\\b": "Explain Like I'm 5",
  "\\bAMA\\b": "Ask Me Anything",
  "\\bFTFY\\b": "Fixed That For You",
  "\\bIIRC\\b": "If I Recall Correctly",
  "\\bEDIT\\b": "Edit",
  "\\bETA\\b": "Edited To Add",
  "\\bLOL\\b": "Laughing Out Loud",
  "\\bSMH\\b": "Shaking My Head",
  "\\bYOLO\\b": "You Only Live Once",
  "\\bNTA\\b": "Not the asshole",
  "\\bWTF\\b": "What the frick",
  "\\bTIFU\\b": "Today I fricked up",
  "\\bLMAO\\b": "Laughing my arse off",
  "\\bLPT\\b": "Life pro tips",
  "\\bICYMI\\b": "In case you missed it",
  "\\bFOMO\\b": "fear of missing out",
  "\\bDAE\\b": "does anyone else",
  "\\bMFW\\b": "my face when",
  "\\bTFW\\b": "that feeling when",
  "\\bMRW\\b": "my reaction when",
  "\\bIRL\\b": "in real life",
  "\\bDM\\b": "direct message",
  "\\bBRB\\b": "be right back",
  "\\bIDK\\b": "I don't know",
  "\\bTBH\\b": "to be honest",
  "\\bIMK\\b": "in my knowledge",
  "\\bFR\\b": "for real",
  "\\bNGL\\b": "not gonna lie",
  "\\bONG\\b": "on god",
};

/**
 * Gen-Z voice style: reads abbreviations how a zoomer would actually say them.
 * Shorter, punchier, uses slang pronunciation.
 */
const GENZ_REPLACEMENTS: Record<string, string> = {
  "\\bOP\\b": "O P",
  "\\bTL;DR\\b": "tee ell dee are",
  "\\bIMO\\b": "in my opinion",
  "\\bIMHO\\b": "in my humble opinion",
  "\\bAITA\\b": "am I the A hole",
  "\\bNSFW\\b": "not safe for work",
  "\\bTIL\\b": "today I learned",
  "\\bELI5\\b": "explain like I'm five",
  "\\bAMA\\b": "A M A",
  "\\bFTFY\\b": "fixed that for you",
  "\\bIIRC\\b": "if I remember correctly",
  "\\bEDIT\\b": "edit",
  "\\bETA\\b": "edited to add",
  "\\bLOL\\b": "lol",
  "\\bSMH\\b": "shaking my head",
  "\\bYOLO\\b": "yolo",
  "\\bNTA\\b": "not the A hole",
  "\\bWTF\\b": "what the actual",
  "\\bTIFU\\b": "today I effed up",
  "\\bLMAO\\b": "lmao",
  "\\bLPT\\b": "life pro tip",
  "\\bICYMI\\b": "in case you missed it",
  "\\bFOMO\\b": "fomo",
  "\\bDAE\\b": "does anyone else",
  "\\bMFW\\b": "my face when",
  "\\bTFW\\b": "that feeling when",
  "\\bMRW\\b": "my reaction when",
  "\\bIRL\\b": "in real life",
  "\\bDM\\b": "D M",
  "\\bBRB\\b": "be right back",
  "\\bIDK\\b": "I dunno",
  "\\bTBH\\b": "to be honest",
  "\\bFR\\b": "for real",
  "\\bNGL\\b": "not gonna lie",
  "\\bONG\\b": "on god",
  "\\bW\\b": "dub",
  "\\bL\\b": "L",
  "\\bRN\\b": "right now",
  "\\bFS\\b": "for sure",
  "\\bICL\\b": "I can't lie",
  "\\bISWEAR\\b": "I swear",
  "\\bBET\\b": "bet",
  "\\bSUS\\b": "sus",
  "\\bCAP\\b": "cap",
  "\\bNO CAP\\b": "no cap",
  "\\bBUSIN\\b": "bussin",
  "\\bSLAY\\b": "slay",
  "\\bRIZZ\\b": "rizz",
  "\\bSKIBIDI\\b": "skibidi",
};

/**
 * Brain rot mode: maximum zoomer unhinged energy.
 * Adds filler words, hype phrases, and reads like a TikTok commentary.
 */
const BRAINROT_REPLACEMENTS: Record<string, string> = {
  ...GENZ_REPLACEMENTS,
  "\\bOP\\b": "this person, bro,",
  "\\bTL;DR\\b": "okay so basically",
  "\\bAITA\\b": "am I cooked or what",
  "\\bNTA\\b": "nah fam you're valid",
  "\\bWTF\\b": "bro what",
  "\\bTIFU\\b": "bro I'm so cooked because",
  "\\bLMAO\\b": "I'm literally deceased",
  "\\bLOL\\b": "no way bruh",
  "\\bSMH\\b": "I can't with this",
  "\\bYOLO\\b": "only lives once vibes",
  "\\bEDIT\\b": "wait hold up, update:",
  "\\bIMO\\b": "okay but like",
  "\\bTBH\\b": "real talk",
  "\\bFR\\b": "on god for real",
  "\\bNGL\\b": "I'm not even gonna cap",
  "\\bONG\\b": "on god no cap",
  "\\bIDK\\b": "like I literally have no clue",
};

/**
 * Brain rot filler interjections to sprinkle in for chaos energy.
 */
const BRAINROT_FILLERS = [
  "bro,",
  "like,",
  "no because,",
  "wait,",
  "okay but,",
  "nah because,",
  "literally,",
  "lowkey,",
  "highkey,",
  "yo,",
  "fam,",
  "deadass,",
];

/**
 * Add brain rot filler words randomly into text for unhinged energy.
 * Inserts a filler roughly every 8-15 words.
 */
function addBrainRotFillers(text: string): string {
  const words = text.split(" ");
  if (words.length < 10) return text;

  const result: string[] = [];
  let sinceLastFiller = 0;
  const insertEvery = 8 + Math.floor(Math.random() * 7); // 8-15 words

  for (const word of words) {
    sinceLastFiller++;
    if (sinceLastFiller >= insertEvery && Math.random() > 0.4) {
      const filler =
        BRAINROT_FILLERS[Math.floor(Math.random() * BRAINROT_FILLERS.length)];
      result.push(filler);
      sinceLastFiller = 0;
    }
    result.push(word);
  }

  return result.join(" ");
}

/**
 * Replace Reddit abbreviations and expand text for TTS based on voice style.
 *
 * @param text - Raw text from Reddit post/comment
 * @param style - Voice style: "normal", "genz", or "brainrot"
 * @param convertEmojis - If true, convert emojis to words instead of stripping
 */
export function replaceRedditAbbreviations(
  text: string,
  style: VoiceStyle = "normal",
  convertEmojis = false
): string {
  // Choose replacement map based on style
  let replacements: Record<string, string>;
  switch (style) {
    case "genz":
      replacements = GENZ_REPLACEMENTS;
      break;
    case "brainrot":
      replacements = BRAINROT_REPLACEMENTS;
      break;
    default:
      replacements = STANDARD_REPLACEMENTS;
  }

  // Apply abbreviation replacements
  for (const abbr in replacements) {
    const regex = new RegExp(abbr, "gi");
    text = text.replace(regex, replacements[abbr]);
  }

  // Handle emojis
  if (convertEmojis) {
    text = replaceEmojisWithWords(text);
  } else {
    text = stripEmojis(text);
  }

  // Add brain rot fillers for maximum chaos
  if (style === "brainrot") {
    text = addBrainRotFillers(text);
  }

  // Clean up double spaces
  text = text.replace(/\s{2,}/g, " ").trim();

  return text;
}
