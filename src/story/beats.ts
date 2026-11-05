import { RedditComment, RedditPost } from "../reddit/types";
import * as cheerio from "cheerio";
import { collectNames, sanitizeComment, sanitizeStory } from "./sanitize";
import { ActionName, SceneName, Speaker, StoryBeat, Storyboard } from "./types";
import { postIdFromPermalink } from "../utils/seenPosts";

/** Split text into sentences, keeping terminal punctuation. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Group sentences into beats of roughly `maxWords` words (one caption burst). */
export function groupIntoBeats(sentences: string[], maxWords = 24): string[] {
  const beats: string[] = [];
  let current: string[] = [];
  let count = 0;
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length;
    if (words > maxWords * 1.6) {
      // Very long sentence: split on commas / conjunctions.
      if (current.length) {
        beats.push(current.join(" "));
        current = [];
        count = 0;
      }
      const parts = sentence.split(/,\s+(?=(?:and|but|so|because|which|then|when|while)\b)/i);
      let chunk: string[] = [];
      let chunkWords = 0;
      for (const part of parts) {
        const pw = part.split(/\s+/).length;
        if (chunkWords + pw > maxWords && chunk.length) {
          beats.push(chunk.join(", "));
          chunk = [];
          chunkWords = 0;
        }
        chunk.push(part);
        chunkWords += pw;
      }
      if (chunk.length) beats.push(chunk.join(", "));
      continue;
    }
    if (count + words > maxWords && current.length) {
      beats.push(current.join(" "));
      current = [];
      count = 0;
    }
    current.push(sentence);
    count += words;
  }
  if (current.length) beats.push(current.join(" "));
  return beats;
}

const SCENE_KEYWORDS: Record<SceneName, RegExp> = {
  kitchen: /\b(kitchen|cook(?:ed|ing)?|dinner|lunch|breakfast|food|fridge|oven|stove|dish(?:es)?|recipe|meal|bak(?:e|ed|ing)|grocer(?:y|ies)|restaurant|cake|pizza)\b/i,
  office: /\b(work|job|boss|manager|cowork(?:er|ers)|co-work(?:er|ers)|office|meeting|shift|hr|email|desk|client|interview|promotion|fired|quit|colleague|company)\b/i,
  street: /\b(car|drove|driving|drive|parking|park|street|road|walk(?:ed|ing)?|outside|store|mall|bus|train|traffic|neighbo(?:u)?r|sidewalk|downtown|gym|school|airport|flight|trip|vacation|hotel|wedding|venue)\b/i,
  house: /\b(home|house|living room|couch|bedroom|room|apartment|tv|bed|sleep|door|move(?:d)? in|rent|roommate|family)\b/i,
};

const ACTION_KEYWORDS: [ActionName, RegExp][] = [
  ["chase", /\b(ran|run|running|chase(?:d)?|rush(?:ed)?|hurr(?:y|ied)|late|sprint(?:ed)?|raced|bolted|catch|caught up)\b/i],
  ["door_slam", /\b(slam(?:med)?|storm(?:ed)? (?:out|off)|walked out|left the|kicked (?:me|him|her|them) out|threw (?:me|him|her|them) out|locked|stomped|moved out|got up and left)\b/i],
  ["gasp", /\b(shock(?:ed)?|scream(?:ed)?|realiz(?:ed|e)|found out|suddenly|turns? out|discover(?:ed)?|caught (?:him|her|them)|secretly|can'?t believe|couldn'?t believe|unbelievable|what the|omg|wtf|exploded|furious|freaked)\b/i],
  ["facepalm", /\b(embarrass(?:ed|ing)|forgot|mistake|stupid|regret|idiot|dumb|awkward|cringe|accidentally|oops|messed up|screwed up|ruined|humiliat(?:ed|ing)|facepalm)\b/i],
  ["sweat", /\b(nervous|anxious|scared|worried|terrified|panick(?:ed|ing)|panic|afraid|uncomfortable|stress(?:ed)?|guilty|tense|dread(?:ed|ing)?)\b/i],
  ["anvil", /\b(bill|cost|paid|pay(?:ing)?|money|dollars|\$\d|broke|crashed|fell|dropped|hit|punch(?:ed)?|smash(?:ed)?|destroyed|disaster|worst)\b/i],
];

const PUNCHLINE = /\b(turns? out|so now|and now|the kicker|plot twist|guess what|anyway|long story short|needless to say|now (?:everyone|my whole family|she|he|they))\b|!$/i;

export function detectScene(text: string, previous: SceneName): SceneName {
  const scores = (Object.keys(SCENE_KEYWORDS) as SceneName[]).map((scene) => ({
    scene,
    hits: (text.match(SCENE_KEYWORDS[scene]) || []).length,
  }));
  scores.sort((a, b) => b.hits - a.hits);
  return scores[0].hits > 0 ? scores[0].scene : previous;
}

export function detectAction(text: string, index: number): ActionName {
  for (const [action, re] of ACTION_KEYWORDS) {
    if (re.test(text)) return action;
  }
  // Keep the picture moving even without keywords.
  const idle: ActionName[] = ["talk", "talk", "sweat", "talk", "gasp"];
  return idle[index % idle.length];
}

/** Reddit's JSON ships body_html entity-escaped; decode until no tags remain. */
export function htmlToText(html: string, fallback = ""): string {
  let text = html || fallback;
  for (let i = 0; i < 3 && /<\w+[^>]*>|&lt;|&gt;|&amp;|&#/.test(text); i++) {
    text = cheerio.load(text)("body").text();
  }
  return text.replace(/\s+/g, " ").trim();
}

/** Family-friendly expansions for the AITA vocabulary (spoken + captions). */
const AITA_TERMS: [RegExp, string][] = [
  [/\bAITA\b/g, "Am I the jerk"],
  [/\bWIBTA\b/g, "Would I be the jerk"],
  [/\bNTA\b/g, "Not the jerk"],
  [/\bYTA\b/g, "You're the jerk"],
  [/\bESH\b/g, "Everyone sucks here"],
  [/\bNAH\b/g, "No jerks here"],
  [/\bOP\b/g, "the poster"],
  [/\bTIFU\b/g, "Today I messed up"],
  [/\bTL;?DR\b/gi, "Long story short"],
  [/\bSO\b/g, "partner"],
  [/\bMIL\b/g, "mother-in-law"],
  [/\bFIL\b/g, "father-in-law"],
  [/\bSIL\b/g, "sister-in-law"],
  [/\bBIL\b/g, "brother-in-law"],
  [/\bBF\b/g, "boyfriend"],
  [/\bGF\b/g, "girlfriend"],
  [/\bIMO\b/g, "in my opinion"],
  [/\bIDK\b/g, "I don't know"],
  [/\bTBH\b/g, "to be honest"],
  [/\bLOL\b/g, "haha"],
];

export function expandForSpeech(text: string): string {
  let out = text;
  for (const [re, rep] of AITA_TERMS) out = out.replace(re, rep);
  return out;
}

function commentText(comment: RedditComment, names: Map<string, string>): string {
  return expandForSpeech(sanitizeComment(htmlToText(comment.body_html, comment.body), names));
}

export interface BuildStoryboardOptions {
  /** Max words per story beat (caption burst). */
  maxWordsPerBeat?: number;
  /** How many top comments to turn into "verdict" beats. */
  verdictComments?: number;
}

/**
 * Turn a post (+ comments) into a storyboard of beats with scenes, actions
 * and speakers. Duration fitting happens later, once TTS lengths are known.
 */
export function buildStoryboard(
  post: RedditPost,
  comments: RedditComment[],
  hook: string,
  opts: BuildStoryboardOptions = {}
): Storyboard {
  const maxWords = opts.maxWordsPerBeat ?? 24;
  const verdictCount = opts.verdictComments ?? 3;
  const subreddit = post.subreddit.display_name;
  const isAita = /aita|amitheasshole/i.test(subreddit);

  const rawComments = comments.map((c) => htmlToText(c.body_html, c.body));
  const names = collectNames([post.title, post.selftext || "", ...rawComments]);
  const body = expandForSpeech(sanitizeStory(post.selftext || "", names));
  const sentences = splitSentences(body);
  const chunks = groupIntoBeats(sentences, maxWords);

  const beats: StoryBeat[] = [];
  let id = 0;
  let scene: SceneName = "house";
  let sceneAge = 0;

  beats.push({
    id: id++,
    kind: "hook",
    text: expandForSpeech(hook),
    speaker: "crow",
    scene: detectScene(`${post.title} ${chunks[0] || ""}`, "house"),
    action: "gasp",
    punchline: false,
  });
  scene = beats[0].scene;

  chunks.forEach((text, i) => {
    const wanted = detectScene(text, scene);
    // Hold a scene for at least two beats so backgrounds don't strobe.
    if (wanted !== scene && sceneAge >= 2) {
      scene = wanted;
      sceneAge = 0;
    }
    sceneAge++;
    const punchline = PUNCHLINE.test(text) || i === chunks.length - 1;
    const action = punchline && i === chunks.length - 1 ? "reaction" : detectAction(text, i);
    beats.push({
      id: id++,
      kind: "story",
      text,
      speaker: "crow",
      scene,
      action,
      punchline,
    });
  });

  // Verdict beats: the hedgehog reads the internet's judgement.
  const verdicts = comments
    .map((c) => commentText(c, names))
    .filter((t) => t.length > 12 && t.split(/\s+/).length <= 45)
    .slice(0, verdictCount);
  verdicts.forEach((text, i) => {
    const lead = i === 0 ? (isAita ? "The internet's verdict: " : "Top comment: ") : "";
    beats.push({
      id: id++,
      kind: "verdict",
      text: `${lead}${text}`,
      speaker: "hedgehog",
      scene,
      action: i === 0 ? "reaction" : /\b(nta|yta|esh|nah)\b/i.test(text) ? "anvil" : "talk",
      punchline: /\b(nta|yta)\b/i.test(text),
    });
  });

  beats.push({
    id: id++,
    kind: "outro",
    text: "Follow for part two.",
    speaker: "hedgehog",
    scene,
    action: "talk",
    punchline: false,
  });

  return {
    sourceId: postIdFromPermalink(post.permalink) || "unknown",
    subreddit,
    title: post.title,
    hook,
    beats,
  };
}

/** Which character narrates a beat kind. */
export function speakerFor(kind: StoryBeat["kind"]): Speaker {
  return kind === "verdict" || kind === "outro" ? "hedgehog" : "crow";
}
