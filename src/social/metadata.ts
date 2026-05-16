export interface RedditPost {
  title: string;
  body: string;
  subreddit: string;
  author: string;
  score: number;
  numComments: number;
  flair?: string;
}

export interface PlatformMetadata {
  title: string;
  description: string;
  hashtags: string[];
  tags?: string[];
}

const TRENDING_TIKTOK_TAGS = [
  '#fyp', '#foryou', '#foryoupage', '#viral', '#story', '#storytime',
  '#reddit', '#redditstories', '#askreddit', '#tiktokviral'
];

const YOUTUBE_BASE_TAGS = [
  'reddit', 'reddit stories', 'askreddit', 'best of reddit',
  'reddit top posts', 'reddit shorts', 'short'
];

const INSTAGRAM_CTA_PHRASES = [
  'Follow for more stories like this!',
  'Save this for later!',
  'Tag someone who needs to hear this!',
  'Double tap if you agree!',
  'Share this with a friend!'
];

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function extractKeywords(post: RedditPost): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'it', 'to', 'in', 'for', 'of', 'and', 'or', 'but', 'my', 'your', 'was', 'that', 'this']);
  const words = `${post.title} ${post.body}`.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  const freq = new Map<string, number>();
  words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
  
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function getSubredditHashtags(subreddit: string): string[] {
  const map: Record<string, string[]> = {
    askreddit: ['#askreddit', '#question', '#answers'],
    tifu: ['#tifu', '#funny', '#fail', '#embarrassing'],
    aita: ['#aita', '#amithea**hole', '#judgment', '#drama'],
    relationships: ['#relationship', '#love', '#dating', '#advice'],
    nosleep: ['#scary', '#horror', '#creepy', '#nosleep'],
    maliciouscompliance: ['#pettyrevenge', '#revenge', '#satisfying'],
    prorevenge: ['#revenge', '#justice', '#satisfying', '#karma'],
  };
  return map[subreddit.toLowerCase()] || [`#${subreddit.toLowerCase()}`];
}

export function generateTikTokMetadata(post: RedditPost): PlatformMetadata {
  const hooks = [
    `This ${post.subreddit} story is WILD`,
    `POV: You find this on Reddit`,
    `Wait for the ending...`,
    `Reddit never disappoints`,
  ];
  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  
  const title = truncate(`${hook} | ${post.title}`, 150);
  
  const description = truncate(
    post.body ? `${post.title}\n\n${post.body}` : post.title,
    300
  );

  const subredditTags = getSubredditHashtags(post.subreddit);
  const trendingTags = TRENDING_TIKTOK_TAGS.slice(0, 5);
  const hashtags = [...new Set([...subredditTags, ...trendingTags])].slice(0, 10);

  return { title, description, hashtags };
}

export function generateYouTubeMetadata(post: RedditPost): PlatformMetadata {
  const seoTitle = truncate(
    `${post.title} - r/${post.subreddit} | Reddit Stories #shorts`,
    100
  );

  const keywords = extractKeywords(post);
  const timestamps = '0:00 - Story begins';
  
  const description = [
    truncate(post.title, 200),
    '',
    timestamps,
    '',
    `Originally posted on r/${post.subreddit}`,
    `Score: ${post.score} | Comments: ${post.numComments}`,
    '',
    'Subscribe for daily Reddit stories!',
    '',
    `Tags: ${keywords.join(', ')}`,
  ].join('\n');

  const tags = [
    ...YOUTUBE_BASE_TAGS,
    `r/${post.subreddit}`,
    ...keywords.slice(0, 5),
  ];

  const hashtags = [`#reddit`, `#${post.subreddit}`, '#shorts'];

  return { title: seoTitle, description, hashtags, tags };
}

export function generateInstagramMetadata(post: RedditPost): PlatformMetadata {
  const cta = INSTAGRAM_CTA_PHRASES[Math.floor(Math.random() * INSTAGRAM_CTA_PHRASES.length)];
  
  const title = truncate(post.title, 125);
  
  const subredditTags = getSubredditHashtags(post.subreddit);
  const baseTags = ['#reddit', '#redditstories', '#viral', '#trending', '#reels'];
  const hashtags = [...new Set([...subredditTags, ...baseTags])].slice(0, 20);

  const caption = [
    truncate(post.title, 200),
    '',
    truncate(post.body || '', 500),
    '',
    cta,
    '',
    hashtags.join(' '),
  ].join('\n');

  return { title, description: caption, hashtags };
}
