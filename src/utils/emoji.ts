/**
 * Emoji handling utilities for TTS and caption rendering.
 * Strips, preserves, or converts emojis depending on the output target.
 */

// Regex matching most Unicode emoji ranges
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

// Map of common emojis to their spoken-word equivalents
const EMOJI_TO_WORDS: Record<string, string> = {
  '\u{1F602}': 'laughing',
  '\u{1F923}': 'rolling on the floor laughing',
  '\u{1F60D}': 'heart eyes',
  '\u{1F525}': 'fire',
  '\u{1F4AF}': 'one hundred',
  '\u{1F622}': 'crying',
  '\u{1F62D}': 'sobbing',
  '\u{1F621}': 'angry',
  '\u{1F620}': 'furious',
  '\u{1F914}': 'thinking',
  '\u{1F631}': 'screaming',
  '\u{1F480}': 'skull',
  '\u{2764}\u{FE0F}': 'love',
  '\u{1F44D}': 'thumbs up',
  '\u{1F44E}': 'thumbs down',
  '\u{1F44F}': 'clapping',
  '\u{1F64F}': 'praying',
  '\u{1F389}': 'party',
  '\u{1F3C6}': 'trophy',
  '\u{1F4A9}': 'poop',
  '\u{1F47B}': 'ghost',
  '\u{1F440}': 'eyes',
  '\u{1F928}': 'raised eyebrow',
  '\u{1F92F}': 'mind blown',
  '\u{1F971}': 'yawning',
  '\u{1F972}': 'smiling with tear',
  '\u{1F973}': 'celebrating',
  '\u{1F975}': 'hot face',
  '\u{1F976}': 'cold face',
  '\u{1F4A4}': 'sleeping',
  '\u{1F4A5}': 'explosion',
  '\u{1F4AA}': 'strong',
  '\u{1F937}': 'shrug',
  '\u{1F644}': 'eye roll',
  '\u{1F60E}': 'cool',
  '\u{1F913}': 'nerd',
  '\u{1F47D}': 'alien',
  '\u{1F916}': 'robot',
  '\u{1F4B0}': 'money',
  '\u{23F0}': 'alarm clock',
  '\u{2705}': 'check mark',
  '\u{274C}': 'cross mark',
  '\u{26A0}\u{FE0F}': 'warning',
  '\u{1F6A8}': 'police light',
  '\u{1F3AF}': 'bullseye',
};

/**
 * Remove all emojis from text. Use for TTS input where emojis
 * should be silently dropped.
 */
export function stripEmojis(text: string): string {
  return text
    .replace(EMOJI_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Keep emojis intact. Useful for caption rendering where emojis
 * add visual flair. Normalizes surrounding whitespace.
 */
export function preserveEmojis(text: string): string {
  return text.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Replace known emojis with their spoken-word equivalents for TTS.
 * Unknown emojis are stripped silently.
 */
export function replaceEmojisWithWords(text: string): string {
  let result = text;

  // Replace known emojis with words
  for (const [emoji, word] of Object.entries(EMOJI_TO_WORDS)) {
    result = result.replaceAll(emoji, ` ${word} `);
  }

  // Strip any remaining unknown emojis
  result = result.replace(EMOJI_REGEX, '');

  // Normalize whitespace
  return result.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Detect if a string contains any emojis.
 */
export function containsEmojis(text: string): boolean {
  return EMOJI_REGEX.test(text);
}

/**
 * Count the number of emojis in a string.
 */
export function countEmojis(text: string): number {
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}
