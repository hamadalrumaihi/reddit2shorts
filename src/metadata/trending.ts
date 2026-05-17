/**
 * Trending topic detection from subreddit hot posts.
 * Identifies viral-potential content by analyzing post velocity,
 * engagement ratios, and keyword patterns.
 */

import axios from "axios";

const USER_AGENT = "reddit2shorts/1.0 (trending-detector)";
const BASE_URL = "https://www.reddit.com";

export interface TrendingTopic {
  title: string;
  subreddit: string;
  score: number;
  commentCount: number;
  permalink: string;
  engagementRatio: number; // comments / score — higher = more controversial/engaging
  ageHours: number;
  velocityScore: number; // score / age — how fast it's growing
}

/**
 * Fetch hot posts from a subreddit and rank by viral potential.
 */
export async function detectTrendingTopics(
  subreddits: string[],
  limit = 10
): Promise<TrendingTopic[]> {
  const allTopics: TrendingTopic[] = [];

  for (const sub of subreddits) {
    try {
      const response = await axios.get(
        `${BASE_URL}/r/${sub}/hot.json?limit=25`,
        { headers: { "User-Agent": USER_AGENT } }
      );

      const posts = response.data?.data?.children || [];
      const now = Date.now() / 1000;

      for (const { data: post } of posts) {
        if (!post.is_self || post.stickied) continue;

        const ageHours = (now - post.created_utc) / 3600;
        const velocityScore = ageHours > 0 ? post.ups / ageHours : 0;
        const engagementRatio =
          post.ups > 0 ? post.num_comments / post.ups : 0;

        allTopics.push({
          title: post.title,
          subreddit: sub,
          score: post.ups,
          commentCount: post.num_comments,
          permalink: post.permalink,
          engagementRatio,
          ageHours,
          velocityScore,
        });
      }
    } catch {
      // Skip failed subreddits silently
    }
  }

  // Sort by viral potential: high velocity + high engagement = trending
  return allTopics
    .sort((a, b) => {
      const aViralScore = a.velocityScore * (1 + a.engagementRatio);
      const bViralScore = b.velocityScore * (1 + b.engagementRatio);
      return bViralScore - aViralScore;
    })
    .slice(0, limit);
}

/**
 * Get the single best trending post for content creation.
 */
export async function getBestTrendingPost(
  subreddits: string[]
): Promise<TrendingTopic | null> {
  const topics = await detectTrendingTopics(subreddits, 1);
  return topics[0] || null;
}
