import { detect } from "tinyld";

/**
 * Detect the language of a text string.
 * Returns an ISO 639-1 language code (e.g. "en", "es", "fr") or null if detection fails.
 */
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length === 0) return null;
  const result = detect(text);
  return result || null;
}

/**
 * Returns true if the text is detected as English, or if detection is ambiguous/fails.
 * Ambiguity is treated as "probably English" to avoid false negatives on short text.
 */
export function isEnglish(text: string): boolean {
  const lang = detectLanguage(text);
  // If detection returns null (ambiguous/failed) or "en", treat as English
  return lang === null || lang === "en";
}

/**
 * Check if text passes a language filter.
 * If allowedLangs is not provided, defaults to ["en"] (English only).
 * Returns true if the detected language is in the allowed list, or if detection is ambiguous.
 */
export function passesLanguageFilter(
  text: string,
  allowedLangs?: string[]
): boolean {
  const allowed = allowedLangs && allowedLangs.length > 0 ? allowedLangs : ["en"];
  const lang = detectLanguage(text);
  // If detection is ambiguous, let it pass
  if (lang === null) return true;
  return allowed.includes(lang);
}
