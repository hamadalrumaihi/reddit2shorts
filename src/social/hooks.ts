import { RedditPost } from './metadata';

export interface Hook {
  text: string;
  style: 'question' | 'challenge' | 'shock' | 'curiosity' | 'relatable';
  estimatedDuration: number; // seconds
}

const HOOK_TEMPLATES: Record<Hook['style'], string[]> = {
  question: [
    'What would YOU do in this situation?',
    'Can you guess how this ends?',
    'Would you have done the same thing?',
    'Have you ever been in this situation?',
    'What do you think happened next?',
  ],
  challenge: [
    'Wait for the plot twist...',
    'Try not to cringe at this one...',
    'I bet you can\'t guess the ending',
    'Only 1% of people would do what this person did',
    'This will change how you see things',
  ],
  shock: [
    'This is the wildest thing I\'ve ever read on Reddit',
    'I literally could NOT believe this was real',
    'This story had my jaw on the FLOOR',
    'You won\'t believe what happened next',
    'This is absolutely insane...',
  ],
  curiosity: [
    'So this happened on Reddit today...',
    'I found this story and had to share it',
    'This Reddit post is going viral for a reason',
    'Everyone is talking about this post...',
    'You need to hear this story',
  ],
  relatable: [
    'We\'ve ALL been here before...',
    'Tell me this hasn\'t happened to you',
    'This is literally everyone\'s worst nightmare',
    'POV: You\'re scrolling Reddit at 3am and find this',
    'If this doesn\'t sound familiar, you\'re lying',
  ],
};

function detectBestStyle(post: RedditPost): Hook['style'] {
  const titleLower = post.title.toLowerCase();
  const subreddit = post.subreddit.toLowerCase();

  if (subreddit === 'aita' || titleLower.includes('aita') || titleLower.includes('am i the')) {
    return 'question';
  }
  if (subreddit === 'tifu' || titleLower.includes('tifu') || titleLower.includes('messed up')) {
    return 'relatable';
  }
  if (subreddit === 'nosleep' || titleLower.includes('scary') || titleLower.includes('creepy')) {
    return 'shock';
  }
  if (post.score > 10000 || post.numComments > 2000) {
    return 'curiosity';
  }
  if (titleLower.includes('revenge') || titleLower.includes('karma') || titleLower.includes('satisfying')) {
    return 'challenge';
  }
  if (titleLower.includes('?')) {
    return 'question';
  }

  const styles: Hook['style'][] = ['question', 'challenge', 'shock', 'curiosity', 'relatable'];
  return styles[Math.floor(Math.random() * styles.length)];
}

function personalizeHook(template: string, post: RedditPost): string {
  const subredditMention = post.subreddit.length < 15 ? ` on r/${post.subreddit}` : '';
  
  if (template.includes('this story') && subredditMention) {
    return template.replace('this story', `this story${subredditMention}`);
  }
  if (template.includes('this post') && subredditMention) {
    return template.replace('this post', `this post${subredditMention}`);
  }
  return template;
}

export function generateHook(post: RedditPost, style?: Hook['style']): Hook {
  const selectedStyle = style || detectBestStyle(post);
  const templates = HOOK_TEMPLATES[selectedStyle];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const text = personalizeHook(template, post);

  const wordsPerSecond = 2.5;
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = Math.min(3, Math.max(1.5, wordCount / wordsPerSecond));

  return { text, style: selectedStyle, estimatedDuration };
}

export function generateHookVariants(post: RedditPost, count: number = 3): Hook[] {
  const styles: Hook['style'][] = ['question', 'challenge', 'shock', 'curiosity', 'relatable'];
  const bestStyle = detectBestStyle(post);
  
  const prioritizedStyles = [bestStyle, ...styles.filter(s => s !== bestStyle)];
  
  return prioritizedStyles.slice(0, count).map(style => generateHook(post, style));
}

export function generateTransitionHook(post: RedditPost): string {
  const transitions = [
    `Here\'s what happened...`,
    `Let me tell you this story...`,
    `So basically...`,
    `Here\'s the full story...`,
    `Listen to this...`,
  ];
  return transitions[Math.floor(Math.random() * transitions.length)];
}
