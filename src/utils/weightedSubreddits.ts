import { subreddits } from "../constants/subreddits";

/**
 * Pick a single subreddit based on weighted probabilities.
 * Weights don't need to sum to 100 — they're relative.
 * Falls back to uniform random from default list if no weights provided.
 */
export function pickWeightedSubreddit(
  weights?: Record<string, number>
): string {
  if (!weights || Object.keys(weights).length === 0) {
    return subreddits[Math.floor(Math.random() * subreddits.length)];
  }

  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * totalWeight;

  for (const [sub, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return sub;
  }

  // Fallback (shouldn't happen due to floating point but just in case)
  return entries[entries.length - 1][0];
}

/**
 * Pick N unique subreddits based on weighted probabilities (without replacement).
 * If count exceeds available subreddits, returns all of them.
 */
export function pickWeightedSubreddits(
  weights?: Record<string, number>,
  count: number = 1
): string[] {
  if (!weights || Object.keys(weights).length === 0) {
    // Uniform random pick from defaults without replacement
    const shuffled = [...subreddits].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  const remaining = { ...weights };
  const picked: string[] = [];

  const maxPicks = Math.min(count, Object.keys(remaining).length);

  for (let i = 0; i < maxPicks; i++) {
    const choice = pickWeightedSubreddit(remaining);
    picked.push(choice);
    delete remaining[choice];
  }

  return picked;
}
