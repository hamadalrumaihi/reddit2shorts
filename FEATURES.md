# reddit2shorts Feature Requests

## CONTENT SELECTION
- Add weighted subreddit rotation pool configurable via config file (e.g. r/AskReddit 40%, r/tifu 20%, r/AmItheAsshole 20%, r/MaliciousCompliance 20%)
- Add minimum post score filter (configurable threshold, default 1000)
- Add minimum comment count filter (configurable threshold, default 50)
- Add maximum post age filter (e.g. only posts from last 7 days)
- Add NSFW filter toggle with default off
- Add profanity scrubber with three modes: bleep (audio mute + beep), censor (visual black bar over word in caption), substitute (replace with configurable word list)
- Add duplicate detection layer: hash post IDs to local SQLite DB, refuse regeneration within configurable window (default 90 days)
- Add post length filter (min/max character count for post body and selected comments)
- Add language detection to skip non-English posts unless explicitly enabled

## VIDEO OUTPUT
- Support multiple aspect ratios: 9:16, 1:1, 16:9 selectable via CLI flag
- Support multiple resolutions: 720p, 1080p, 1440p
- Add karaoke-style word-by-word caption highlighting synced to TTS timestamps
- Add configurable caption styling: font family, size, color, stroke width, stroke color, position (top/middle/bottom), background box opacity
- Add animated post-title card with configurable entrance transitions (fade, slide, zoom, typewriter)
- Add animated comment cards with stagger timing between cards
- Add subreddit logo/icon overlay in corner
- Add username display toggle (show/hide/anonymize as "u/Redditor")
- Add background video effects: blur, zoom-in over time, color grading presets
- Add intro and outro card support (configurable templates)

## AUDIO AND VOICE
- Add TTS engine abstraction layer with adapters for: edge-tts (current), ElevenLabs, OpenAI TTS, Coqui, Azure TTS
- Add per-role voice assignment: distinct voice for post title vs comments vs OP
- Add per-commenter voice rotation (cycle through voice pool for different commenters)
- Add speech rate and pitch configuration per voice
- Add volume ducking: background music auto-lowers to -20dB during narration
- Add background music library independent of YouTube gameplay (local audio file pool)
- Add SFX support: transition whoosh between comments, ding on post reveal
- Add silence trimming on TTS output to tighten pacing

## PIPELINE AND AUTOMATION
- Add batch mode: generate N videos in single run with --count flag
- Add parallelization with configurable worker count
- Add cron-style scheduler for unattended generation
- Add YouTube upload integration via YouTube Data API v3
- Add TikTok upload integration via TikTok Content Posting API
- Add Instagram Reels upload via Instagram Graph API
- Add metadata templating: auto-generate title, description, hashtags from subreddit and post data
- Add web dashboard (local server) for run monitoring, video preview, approval queue before upload
- Add webhook support for pipeline events (started, completed, failed)

## QUALITY AND RELIABILITY
- Add content safety pre-check: reject posts containing slurs (configurable wordlist), self-harm references, platform-prohibited topics
- Add retry queue with exponential backoff for failed pipeline steps
- Add --dry-run flag: validate dependencies, test sample Reddit fetch, no video output
- Add --doctor command: verify yt-dlp version, ffmpeg version, TTS connectivity, disk space
- Add structured logging (JSON output mode) for downstream analysis
- Add per-run analytics file: post source, generation time per stage, output file size
- Add post-upload performance tracking if upload integration enabled (views, retention, engagement)

## DEVELOPER EXPERIENCE
- Add YAML or JSON config file replacing hardcoded constants
- Add config presets: "askreddit-story", "tifu-narrative", "aita-judgment", "shower-thought"
- Add Dockerfile and docker-compose.yml for one-command setup
- Add unit tests for JsonReddit parser
- Add unit tests for TTS chunking and timestamp alignment
- Add integration test that runs full pipeline against fixture data
- Add GitHub Actions CI workflow
- Add CHANGELOG.md and semantic versioning
- Add CLI help text and --version flag
- Add .env.example documenting all environment variables
- Add output directory cleanup command to purge old generated videos

## DEPENDENCY HARDENING (lessons from recent debugging)
- Pin yt-dlp to known-good version in package.json with auto-update check on startup
- Replace ffmpeg-static dependency with system ffmpeg detection and clear error if missing
- Add startup health check that runs yt-dlp --version, ffmpeg -version, TTS auth test
- Cache YouTube background video downloads to avoid repeated fetches of same URL
- Add fallback YouTube URL pool if primary background source fails
