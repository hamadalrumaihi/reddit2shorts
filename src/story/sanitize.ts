/**
 * Remove anything that identifies real people before a story is voiced:
 * Reddit handles, @mentions, links, e-mails, phone numbers, age/gender tags
 * like "(24F)", and first names that follow a relationship word
 * ("my coworker Sarah" -> "my coworker"). Also drops trailing EDIT/UPDATE
 * blocks, which rarely fit a 59 s short.
 */

const RELATION_WORDS = [
  "friend",
  "best friend",
  "bf",
  "gf",
  "boyfriend",
  "girlfriend",
  "husband",
  "wife",
  "fiance",
  "fiancé",
  "fiancée",
  "partner",
  "ex",
  "mom",
  "mum",
  "mother",
  "dad",
  "father",
  "sister",
  "brother",
  "son",
  "daughter",
  "cousin",
  "aunt",
  "uncle",
  "niece",
  "nephew",
  "grandma",
  "grandpa",
  "grandmother",
  "grandfather",
  "roommate",
  "coworker",
  "co-worker",
  "colleague",
  "boss",
  "manager",
  "neighbor",
  "neighbour",
  "stepmom",
  "stepdad",
  "stepsister",
  "stepbrother",
  "mil",
  "fil",
  "sil",
  "bil",
  "mother-in-law",
  "father-in-law",
  "sister-in-law",
  "brother-in-law",
  "teacher",
  "landlord",
  "classmate",
  "buddy",
  "mate",
];

const relationPattern = new RegExp(
  `\\b((?:[Mm]y|[Oo]ur|[Hh]is|[Hh]er|[Tt]heir)\\s+(?:${RELATION_WORDS.map((w) =>
    w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  ).join("|")}))(?:,)?\\s+(?:\\(?"?)([A-Z][a-z]{2,})(?:"?\\)?)(?=[\\s,.!?;:])`,
  "g"
);

const NOT_NAMES = new Set([
  "And",
  "But",
  "Who",
  "Which",
  "That",
  "Then",
  "She",
  "He",
  "They",
  "The",
  "Was",
  "Were",
  "Has",
  "Had",
  "Is",
  "Are",
  "Said",
  "Told",
  "Asked",
  "Went",
  "Got",
  "Came",
  "Just",
  "Also",
  "Still",
  "Always",
  "Never",
  "Really",
  "Recently",
  "Yesterday",
  "Today",
  "Last",
  "This",
  "Who's",
  "Whose",
  "Did",
  "Does",
  "Would",
  "Could",
  "Should",
  "Will",
  "Can",
  "Started",
  "Decided",
  "Wanted",
  "Called",
  "Texted",
  "Thinks",
  "Says",
  "Keeps",
  "Gets",
  "Lives",
  "Works",
  "Both",
  "Not",
]);

/** Clearly fictional stand-ins so a story still reads naturally after names are swapped. */
const STAND_IN_NAMES = ["Sam", "Alex", "Jo", "Max", "Robin", "Kit", "Lee", "Remy", "Quinn", "Ash"];

/** Capitalised words that are not people (brands, places, days, acronyms...). */
const NOT_PEOPLE = new Set(
  [
    "Reddit", "Instagram", "TikTok", "Facebook", "YouTube", "Twitter", "Snapchat", "Discord", "WhatsApp",
    "Amazon", "Google", "Apple", "Uber", "Lyft", "Netflix", "Disney", "Walmart", "Target", "Costco",
    "Starbucks", "McDonalds", "Ikea", "Zoom", "Venmo", "PayPal", "Zelle", "Airbnb", "Spotify", "Xbox",
    "Playstation", "Nintendo", "Tesla", "Toyota", "Honda", "Ford", "Christmas", "Thanksgiving",
    "Halloween", "Easter", "Hanukkah", "Ramadan", "Eid", "Diwali", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December", "God", "Jesus", "Bible",
    "Christian", "Muslim", "Jewish", "Catholic", "Hindu", "English", "Spanish", "French", "German",
    "Italian", "Chinese", "Japanese", "Korean", "Indian", "Mexican", "American", "British", "Canadian",
    "Australian", "European", "African", "Asian", "America", "Europe", "Africa", "Asia", "Canada",
    "Mexico", "England", "London", "Paris", "Texas", "California", "Florida", "York", "Vegas", "Covid",
    "Uni", "University", "College", "High", "School", "Hospital", "Church", "Hotel", "Airport", "Phd",
    "PhD", "Internet", "Wifi", "Dr", "Mr", "Mrs", "Ms", "Op", "Nta", "Yta", "Esh", "Nah", "Aita",
    "Tifu", "Lol", "Omg", "Wtf", "Btw", "Idk", "Tldr", "Ok", "Okay", "Yes", "No", "Thanks", "Thank",
    "Sorry", "Please", "Hey", "Hi", "Hello", "Wow", "Oh", "Ugh", "Well", "Anyway", "Also", "However",
    "Meanwhile", "Later", "Now", "Then", "Even", "Only", "Every", "Some", "Many", "Most", "Both",
    "Nobody", "Everyone", "Someone", "Anyone", "Nothing", "Everything", "Something", "Basically",
    "Honestly", "Apparently", "Obviously", "Literally", "Seriously", "Fast", "Forward", "Cue", "Spoiler",
    "Context", "Background", "Note", "Important", "Long", "Short", "Story", "Part", "Day", "Night",
    "Week", "Month", "Year", "Dad", "Mom", "Mum", "Grandma", "Grandpa", "Nana", "Papa", "Aunt", "Uncle",
    "Karen", "Chad", "Becky",
  ]
);

/**
 * Find likely first names: a capitalised word mid-sentence (not sentence
 * initial), 3-12 letters, not all caps, not in the stop lists, seen at least
 * twice OR introduced by a relationship word. Returns a stable mapping to
 * stand-in names.
 */
export function detectNames(text: string, seeded: Iterable<string> = []): Map<string, string> {
  const counts = new Map<string, number>();
  const sentenceStart = /(^|[.!?]\s+|\n\s*)([A-Z][a-z]+)/g;
  const starts = new Set<string>();
  for (const m of text.matchAll(sentenceStart)) starts.add(`${m.index! + m[1].length}`);
  const midSentence = new Set<string>();
  const wordRe = /\b([A-Z][a-z]{2,11})(?:'s)?\b/g;
  for (const m of text.matchAll(wordRe)) {
    const w = m[1];
    if (NOT_PEOPLE.has(w) || NOT_NAMES.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
    if (!starts.has(`${m.index}`)) midSentence.add(w);
  }
  const names = new Set<string>(seeded);
  // Seen twice overall and at least once mid-sentence (sentence-initial words
  // alone are too ambiguous: "Hope you're well" is not a person).
  for (const [w, n] of counts) if (n >= 2 && midSentence.has(w)) names.add(w);
  const mapping = new Map<string, string>();
  let i = 0;
  for (const name of [...names].sort()) {
    mapping.set(name, STAND_IN_NAMES[i % STAND_IN_NAMES.length]);
    i++;
  }
  return mapping;
}

/**
 * Collect a shared name mapping across several texts (post body + comments) so
 * a person named once in the story and once in a comment is still caught, and
 * gets the same stand-in everywhere.
 */
export function collectNames(texts: string[]): Map<string, string> {
  const combined = texts.join("\n");
  const introduced: string[] = [];
  for (const m of combined.matchAll(relationPattern)) {
    if (!NOT_NAMES.has(m[2]) && !NOT_PEOPLE.has(m[2])) introduced.push(m[2]);
  }
  return detectNames(combined, introduced);
}

export function sanitizeStory(input: string, sharedNames?: Map<string, string>): string {
  let text = input.replace(/\r\n?/g, "\n");

  // Drop trailing edit/update/tl;dr blocks (at a line or sentence start).
  text = text.replace(
    /(?:^|\n|(?<=[.!?])\s+)(?:edit|eta|update|final update|tl;?dr)\s*\d*\s*[:\-–—][\s\S]*$/i,
    ""
  );

  // Markdown noise.
  text = text
    .replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, "$1") // [text](url) -> text
    .replace(/[*_~`>#]+/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x200B;|\u200b/g, "");

  // Identifiers.
  text = text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
    .replace(/(^|[\s(])\/?u\/[A-Za-z0-9_-]+/g, "$1someone")
    .replace(/(^|[\s(])\/?r\/([A-Za-z0-9_]+)/g, "$1the $2 subreddit")
    .replace(/(^|\s)@[A-Za-z0-9_.]+/g, "$1someone");

  // Age/gender tags: (24F), [31 M], 27m, F25.
  text = text
    .replace(/\s*[([]\s*\d{1,2}\s*[mfMF]?\s*[)\]]/g, "")
    .replace(/\s*[([]\s*[mfMF]\s*\d{1,2}\s*[)\]]/g, "")
    .replace(/\b\d{1,2}\s?[mfMF]\b/g, "")
    .replace(/\b[mfMF]\s?\d{1,2}\b/g, "");

  // Names: "my coworker Sarah" marks Sarah as a person; every occurrence of a
  // detected name (and repeated capitalised words) becomes a fictional stand-in.
  const introduced: string[] = [];
  for (const m of text.matchAll(relationPattern)) {
    if (!NOT_NAMES.has(m[2]) && !NOT_PEOPLE.has(m[2])) introduced.push(m[2]);
  }
  const names = detectNames(text, introduced);
  if (sharedNames) for (const [real, fake] of sharedNames) names.set(real, fake);
  for (const [real, fake] of names) {
    text = text.replace(new RegExp(`\\b${real}\\b`, "g"), fake);
  }

  // Quoted nicknames: my sister "Bee" -> my sister
  text = text.replace(/("|“)[A-Z][a-z]{1,12}("|”)\s/g, "");

  // Whitespace tidy.
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  return text;
}

/** Shorter sanitiser for comments: same rules, single line. */
export function sanitizeComment(input: string, sharedNames?: Map<string, string>): string {
  return sanitizeStory(input, sharedNames).replace(/\n+/g, " ").trim();
}
