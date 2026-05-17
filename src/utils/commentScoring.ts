/**
 * Smart comment scoring for selecting the best comments to include in shorts.
 * Scores comments by: length sweet spot, awards, reply count, score, humor indicators.
 */

export interface RedditComment {
  id: string;
  body: string;
  score: number;
  replies?: number;
  awards?: number;
  author: string;
  depth?: number;
}

export interface ScoredComment extends RedditComment {
  totalScore: number;
  breakdown: {
    lengthScore: number;
    engagementScore: number;
    humorScore: number;
    awardScore: number;
    replyScore: number;
  };
}

const HUMOR_INDICATORS = [
  "lol", "lmao", "lmfao", "rofl", "haha", "hahaha", "dead",
  "crying", "im dying", "i'm dying", "bruh", "bro", "skull",
  "💀", "😂", "🤣", "😭", "no way"
];

/**
 * Score a single comment based on multiple quality signals.
 */
export function scoreComment(comment: RedditComment, replyTexts: string[] = []): ScoredComment {
  const body = comment.body.trim();
  const charLen = body.length;

  // Length scoring: sweet spot is 50-200 chars
  let lengthScore = 0;
  if (charLen >= 50 && charLen <= 200) {
    lengthScore = 10; // perfect range
  } else if (charLen >= 30 && charLen < 50) {
    lengthScore = 6;
  } else if (charLen > 200 && charLen <= 400) {
    lengthScore = 7;
  } else if (charLen > 400) {
    lengthScore = 3; // too long for shorts
  } else {
    lengthScore = 2; // too short
  }

  // Engagement score from upvotes (logarithmic)
  const engagementScore = Math.min(10, Math.log2(Math.max(1, comment.score)) * 1.5);

  // Humor indicators in the comment itself and its replies
  const allText = [body, ...replyTexts].join(" ").toLowerCase();
  const humorHits = HUMOR_INDICATORS.filter(h => allText.includes(h)).length;
  const humorScore = Math.min(10, humorHits * 2.5);

  // Award score (logarithmic)
  const awardScore = Math.min(10, (comment.awards ?? 0) * 3);

  // Reply count score (more replies = more engaging)
  const replies = comment.replies ?? 0;
  const replyScore = Math.min(10, Math.log2(Math.max(1, replies + 1)) * 3);

  const totalScore = (
    lengthScore * 2.0 +
    engagementScore * 2.5 +
    humorScore * 1.5 +
    awardScore * 1.5 +
    replyScore * 1.0
  );

  return {
    ...comment,
    totalScore,
    breakdown: { lengthScore, engagementScore, humorScore, awardScore, replyScore },
  };
}

/**
 * Score and rank comments, returning the best N for inclusion in a short.
 */
export function selectBestComments(
  comments: RedditComment[],
  count: number = 10,
  replyMap: Map<string, string[]> = new Map()
): ScoredComment[] {
  // Filter out deleted/removed/bot comments
  const validComments = comments.filter(c => {
    const body = c.body.trim().toLowerCase();
    return (
      body !== "[deleted]" &&
      body !== "[removed]" &&
      !body.startsWith("i am a bot") &&
      c.author !== "AutoModerator" &&
      c.body.trim().length > 10
    );
  });

  const scored = validComments.map(c =>
    scoreComment(c, replyMap.get(c.id) ?? [])
  );

  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored.slice(0, count);
}
