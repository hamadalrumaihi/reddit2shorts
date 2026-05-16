# Changelog

All notable changes to this project. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the project is pre-1.0 so
minor versions may include breaking CLI changes.

## [Unreleased]

### Added
- `--doctor` (environment check) and `--dry-run` (validate + sample fetch).
- Content-quality filters for `--random`: `--minScore` (1000),
  `--minComments` (50), `--maxAgeDays` (7), `--allowNsfw`,
  `--minBodyChars` / `--maxBodyChars`.
- JSON config file (`reddit2shorts.config.json` / `--config`) and built-in
  presets (`--preset`): askreddit-story, tifu-narrative, aita-judgment,
  shower-thought. Precedence: CLI > preset > config > default.
- Background-asset per-URL caching and fallback URL pool.
- Structured JSON logging (`--json`) at pipeline milestones.
- `--clean` to purge generated videos (keeps bg cache).
- TikTok upload: `--upload tiktok` (session cookie) and
  `--upload tiktok-api` (official Content Posting API).
- Credential-free Edge TTS (`--tts edge`, the new default).
- `--source json` (Reddit public JSON, no auth) and `--source gemini`
  (AI-generated). Per-feature lazy env validation.
- Duration cap (`--maxDuration`, default 59s) for valid Shorts.
- No-repeat guard via `.seen-posts.json`.
- Replit support (`.replit` / `replit.nix`).
- GitHub Actions CI (typecheck + lint + tests); unit tests for the
  JsonReddit parser and post filters; complete `.env.example`.

### Fixed
- yt-dlp YouTube bot-detection (iOS client args, remote components).
- `ffmpeg-static` incompatibility — `FFMPEG_PATH` override.
- Background-asset filename mismatch; 6-field cron; README `ts-node`.
- Cleared all pre-existing `tsc`/`eslint` errors.
