
# reddit2shorts

Make youtube shorts from reddit posts


## Demo


https://github.com/user-attachments/assets/3fb76b45-5695-41e2-93d0-03a2b515aff4


## Installation

### dependencies 
install [yt_dlp](https://github.com/yt-dlp/yt-dlp) and add it to path (gameplay backgrounds only; not needed for `--animated`)

```bash
pip install edge-tts   # recommended: keeps the free Edge voices working and gives word timings
```

```bash
  git clone https://github.com/yogeshdofficial/reddit2shorts
  cd reddit2shorts
  mv .env.example .env # only needed for snoowrap/gemini/google/upload
  bun install
  bun src/cli.ts --random                                         # ZERO credentials: json source + edge tts (defaults)
  bun src/cli.ts --random --upload youtube                         # add YouTube upload (needs GOOGLE_* creds)
  bun src/cli.ts --random --upload tiktok                          # TikTok via session cookie (needs TIKTOK_SESSION_ID)
  bun src/cli.ts --random --upload tiktok-api                       # TikTok official API draft (needs TIKTOK_CLIENT_* creds)
  bun src/cli.ts --source snoowrap --random                        # Reddit API (needs creds)
  bun src/cli.ts --source gemini                                   # AI-generated story (needs GEMINI_API_KEY)
  bun src/cli.ts --random --preset animated --upload tiktok-api,instagram   # original cartoon animation + TikTok draft + IG Reel
  bun src/cli.ts --doctor --animated                               # environment check for the animated pipeline
```

### One-click run

After cloning once, you don't need to remember commands:

- **Windows:** double-click `run.bat` (or `run.bat --preset aita-judgment`)
- **macOS/Linux:** `./run.sh` (or `./run.sh --minScore 200`)

It updates the repo, installs deps, runs the environment check, then renders
a short into `shorts/`. Any extra args are passed straight to the CLI.

### Run on Replit (works from a phone)

This repo ships `.replit` and `replit.nix`, so you can run it without a local machine:

1. Import the repo into Replit (Create → Import from GitHub).
2. Press **Run**. Replit installs bun, yt-dlp and Chromium automatically, then runs the zero-credential default (`--source json --tts edge`).
3. The finished video appears at `shorts/<id>/output.mp4` in the file tree.

No credentials needed. The Run button has a **dropdown with two options**:
- **JSON (default)** — zero credentials.
- **Gemini fallback** — use this if Reddit blocks Replit's datacenter IP (repeated `403` warnings). One-time setup: add a free `GEMINI_API_KEY` in Replit's **Secrets** tab, then pick this option from the Run dropdown. It never touches Reddit, so the IP block doesn't apply.

## Animated shorts (original cartoon, no gameplay footage)

`--preset animated` (or `--animated` on top of any other preset) replaces the
gameplay background with an **original 1940s rubber-hose cartoon** rendered
from scratch for every story:

- **Characters** — an original duo that stays the same in every video:
  *Beaky*, a lanky nervous crow who narrates, and *Mort*, a stubby grumpy
  hedgehog who delivers the internet's verdict. Both are SVG rigs in
  `assets/characters/` (head, body, limbs, tail/quills, 3 mouth shapes, 4 eye
  states) animated with squash-and-stretch, a paper-grain texture, vignette
  and a slight film flicker.
- **Beats** — the story is split into beats; each beat picks a scene
  (house, office, street, kitchen) from its keywords and an action: chase,
  gasp, facepalm, door slam, sweat drops, or the anvil gag. Punchlines pop a
  reaction pose with emanata. Scene changes use an iris wipe.
- **Lip-sync** — mouth flaps are driven by the TTS amplitude; the narrator and
  verdict voices are separate (`--voice`, `--voice2`).
- **Captions** — word-by-word, bold rounded font (Fredoka, OFL), white with a
  black stroke, the active word highlighted yellow, kept in the middle third
  with the bottom 20 % and the right 15 % left clear for the TikTok/IG UI.
- **Audio** — Edge TTS voice, a generated royalty-free swing loop ducked
  18 dB under the voice (or your own file via `--music`), and procedurally
  synthesised cartoon SFX (boing, whoosh, slide whistle, clang, door slam…)
  on action beats. All audio is generated in code, so there is nothing to
  license.
- **Output** — `shorts/<post id>/output.mp4` (1080×1920, 30 fps, H.264
  `-preset veryfast -crf 20`, AAC 192 k, fitted to 45–59 s), `cover.jpg` (the
  hook frame with the title card), `metadata.json` (caption, hashtags, source
  post id, beats) and `timeline.json` (debug).

```bash
# default animated run: AITA story, TikTok draft + Instagram Reel
bun src/cli.ts --source json --random --preset animated --upload tiktok-api,instagram

# animated TIFU / AskReddit
bun src/cli.ts --random --preset tifu-narrative --animated
bun src/cli.ts --random --preset askreddit-story --animated

# render but don't post: prints exactly what each upload would do
bun src/cli.ts --random --preset animated --upload tiktok-api,instagram --upload-dry-run
```

The story is rewritten before voicing: the title becomes a ~2 second hook
("Am I wrong for not letting my friend use the photographer?"), usernames,
links, e-mails, phone numbers, age tags and first names are stripped (names
become consistent stand-ins such as *Sam* or *Jo*), AITA jargon is expanded to
family-friendly speech, and trailing *Edit:* blocks are dropped. Stories that
run long are cut at a story beat (the cliff-hanger is what "Follow for part 2"
refers to); short ones get wider pauses or a slightly slower read to reach 45 s.

Content filters used by the preset: `--minScore 1000 --minComments 50
--minBodyChars 300 --maxBodyChars 1500`, NSFW excluded. If Reddit answers
403 (common on cloud IPs) the run falls back to `--source gemini` when
`GEMINI_API_KEY` is set, otherwise to cached posts (`--source offline`).

### Animated flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--animated` | off | Cartoon animation instead of a gameplay background (set by `--preset animated`) |
| `--voice <name>` | `en-US-AriaNeural` | Edge TTS voice for the narrator (crow); env `EDGE_TTS_VOICE` |
| `--voice2 <name>` | `en-US-GuyNeural` | Edge TTS voice for the verdict/outro (hedgehog); env `EDGE_TTS_VOICE_2` |
| `--tts-rate <rate>` | `+0%` | Speaking rate, e.g. `+8%`; env `EDGE_TTS_RATE` |
| `--music <file>` | generated loop | Royalty-free music file; env `ANIM_MUSIC` |
| `--no-music` / `--no-sfx` | — | Disable music / cartoon sound effects |
| `--minDuration <s>` | `45` | Lower bound (upper bound is `--maxDuration`, default 59) |
| `--keep-temp` | off | Keep per-beat audio, the voice track and the silent render in `shorts/<id>/` |
| `--render-workers <n>` | `3` | Parallel Chrome tabs while rendering (env `ANIM_RENDER_WORKERS`) |

Rendering: headless Chrome draws every frame (SVG rigs + scenes + HTML
captions) and pipes PNGs straight into ffmpeg; nothing is downloaded. A 55 s
short renders in roughly one to two minutes on a 4-core machine.

## Uploading to TikTok and Instagram

`--upload` takes a comma-separated list. Add `--upload-dry-run` to render
everything and only print what each platform upload would do (nothing is
posted). Captions for animated shorts are: hook + "Follow for part 2" + an
AI-disclosure line + five niche hashtags (see `metadata.json`).

| Platform | How | AI-generated label |
| --- | --- | --- |
| `tiktok-api` | Official Content Posting API, **inbox/draft** (default TikTok route; works for unaudited apps) | The inbox endpoint has no label field — toggle "AI-generated content" in the app when you post the draft |
| `tiktok-direct` | Official API **direct post**: caption + `is_aigc: true`. Unaudited apps can only post `SELF_ONLY` (`--tiktok-privacy`, env `TIKTOK_PRIVACY_LEVEL`) | Set automatically |
| `instagram` | Graph API Reels flow: create container → poll until `FINISHED` → publish | The Graph API has no AI-label field; the caption carries "AI-assisted animation" and the label can be toggled in-app |
| `tiktok` | Session-cookie browser automation (opt-in fallback, fragile) | Manual |
| `youtube` | YouTube Data API | Manual |

### Instagram setup

1. Convert the Instagram account to **Business** or **Creator** and link it to
   a Facebook Page.
2. Create a Meta app, add the Instagram Graph API product and generate a
   **long-lived user access token** with `instagram_basic`,
   `instagram_content_publish`, `pages_show_list` and `pages_read_engagement`.
3. Find the IG user id: `GET /me/accounts` → page id → `GET /<page-id>?fields=instagram_business_account`.
4. Put `IG_USER_ID` and `IG_ACCESS_TOKEN` in `.env`.

The Graph API fetches the video from a **public URL**, so the file is parked on
a temporary host first and removed/expired afterwards (`IG_TEMP_HOST` /
`--ig-temp-host`): `litterbox` (default, expires after `IG_TEMP_HOST_EXPIRY`,
1 h), `catbox` (deleted after publishing when `CATBOX_USERHASH` is set),
`custom` (`IG_TEMP_HOST_CMD` uploads and prints the URL, e.g. an S3 bucket;
`IG_TEMP_HOST_CLEANUP_CMD` removes it) or `url` (`--ig-video-url` with a URL
you already host). Instagram processes reels asynchronously; the tool polls the
container status every 5 s for up to 6 minutes before publishing.

### Text-to-speech

The default `--tts edge` now prefers the Python `edge-tts` package
(`pip install edge-tts`): it tracks Microsoft's handshake changes within days
(the bundled Node port currently gets HTTP 403), returns **word timings** for
karaoke captions and lip-sync, and honours `HTTPS_PROXY`. If Python is
missing the Node port is used as a fallback. `bun src/cli.ts --doctor` reports
which transport is available; with `--animated` it also checks Chrome, the
rigs and the caption font, and no longer treats yt-dlp as required.

## Environment Variables

To run this project, you will need to rename .env.example to .env add the following

get from https://www.reddit.com/prefs/apps, set type to personal use script (only required with `--source snoowrap`; NOT needed for the default `--source json` or for `--source gemini`)
`REDDIT_CLIENT_ID`  
`REDDIT_CLIENT_SECRET`  
`REDDIT_USERNAME`  
`REDDIT_PASSWORD`    

 get from [google cloud console](https://console.cloud.google.com/) ->IAM->service account ->create service account ->manage kes ->create and download key as json ans set the variable to the key inside quotes 
`GOOGLE_CREDENTIALS`  

get from https://aistudio.google.com/app/apikey  
`GEMINI_API_KEY`  

get by following this [article](https://amandevelops.medium.com/how-to-generate-refresh-token-and-use-them-to-access-google-api-f7565413c548)   
`GOOGLE_CLIENT_ID`  
`GOOGLE_CLIENT_SECRET`  
`GOOGLE_ACCESS_TOKEN`  
`GOOGLE_REFRESH_TOKEN`   

get by installing [extension](https://cookie-editor.com/) and getting the `sessionid` cookie from the tiktok.com website (used by `--tts tiktok` voices **and** `--upload tiktok`)  
`TIKTOK_SESSION_ID`  

for `--upload tiktok-api` (official API): register an app at [developers.tiktok.com](https://developers.tiktok.com/), add the **Content Posting API** product with the `video.upload` scope, then run the OAuth flow once to get a refresh token. Set:  
`TIKTOK_CLIENT_KEY`  
`TIKTOK_CLIENT_SECRET`  
`TIKTOK_REFRESH_TOKEN`  

> **Two TikTok upload modes:**
> - `--upload tiktok` — drives the TikTok web upload UI with your `TIKTOK_SESSION_ID` cookie via a headless browser. One command, no dev app. **Best-effort and fragile**: TikTok actively fights upload automation (selectors change, headless detection, captchas, the cookie expires) — expect occasional breakage and selector maintenance. Against TikTok's ToS; use on your own account at your own risk.
> - `--upload tiktok-api` — official Content Posting API. Sends the video to your TikTok app **inbox as a draft** (tap *Post* in-app to publish). Needs a registered dev app but is durable and ToS-compliant. Tokens auto-refresh each run.

## Usage/Examples

```bash
Usage: reddit2shorts [options]

Make youtube shorts from reddit posts

Options:
  -V, --version                       output the version number
  -s --subreddits <subreddit...>      List of subreddits to choose text post from (default:
                                      ["AskReddit","TIFU"])
  --source <source>                   Story source: "json" (Reddit public JSON, no creds — default), "snoowrap" (Reddit API) or "gemini" (AI-generated)
  -r, --random                        Make short from a random post (json/snoowrap only)
  -p, --postId <postId>               Make short from the post with id
  -c --commentsCount <commentsCount>  Number of comments to include (default: "10")
  --maxDuration <seconds>             Hard cap on final short length (default: "59"; YouTube Shorts <= 60s)
  --minScore <n>                      Min post score for --random (default: "1000")
  --minComments <n>                   Min comment count for --random (default: "50")
  --maxAgeDays <n>                    Max post age in days for --random, 0=off (default: "7")
  --allowNsfw                         Allow NSFW posts (default: off)
  --minBodyChars <n>                  Min post body length (default: "0")
  --maxBodyChars <n>                  Max post body length, 0=off (default: "0")
  --doctor                            Check environment (yt-dlp, ffmpeg, disk) and exit
  --dry-run                           Validate env + sample fetch, no video output
  -t --tts <tts>                      Which tts to use: "edge" (no creds — default), "google" or "tiktok"
  -u --upload <platform>              Upload after render: "youtube", "tiktok" (session cookie) or "tiktok-api" (official)
  -g --tags <tags...>                 Tags for video title (default: ["shorts","reddit","redditstories"])
  -a --bgAudio <bgAudio>              Background audio (default: "https://www.youtube.com/watch?v=xy_NKN75Jhw")
  -v --bgVideo <bgVideo>              Background video (default: "https://www.youtube.com/watch?v=XBIaqOm0RKQ")
  -h, --help                          display help for command
```

Each successfully-rendered Reddit post is recorded in `.seen-posts.json`
(gitignored) and skipped on later `--random` runs, so an automated/scheduled
loop never re-posts the same content. Delete that file to reset.

### Config file & presets

Instead of long flag lists you can use a JSON config file (default
`reddit2shorts.config.json`, or `--config <path>`) and/or a built-in preset.

```bash
cp reddit2shorts.config.example.json reddit2shorts.config.json   # then edit
bun src/cli.ts --random                                          # uses the config
bun src/cli.ts --random --preset aita-judgment                   # built-in preset
```

Presets: `askreddit-story`, `tifu-narrative`, `aita-judgment`, `shower-thought`.

Precedence (highest first): **explicit CLI flag → `--preset` → config file → built-in default**. Config/preset keys are the camelCase option names (`minScore`, `maxDuration`, `subreddits`, …).

## Troubleshooting

**yt-dlp fails / "Sign in to confirm you're not a bot" / n-signature errors**
YouTube rotates anti-bot challenges often. The background-download commands
already pass `--extractor-args "youtube:player_client=ios,web"` and
`--remote-components ejs:github`, but this only works with a **recent yt-dlp**.
Keep it current: `pip install -U yt-dlp` (or `yt-dlp -U`). On Replit the
Nix-provided yt-dlp can be outdated — if downloads fail there, upgrade it with
pip in the shell before running.

**ffmpeg errors / `ffmpeg-static` binary incompatible with your system**
Install a real ffmpeg (winget/brew/apt) and point the app at it via the
`FFMPEG_PATH` env var, e.g. on Windows:
```
set FFMPEG_PATH=C:\path\to\ffmpeg\bin\ffmpeg.exe
```
When `FFMPEG_PATH` is set it overrides the bundled `ffmpeg-static` binary.

## Authors

- [@yogeshdofficial](https://www.github.com/yogeshdofficial)

## Acknowledgements
Since it is my first difficult project, any help and advice is much appreciated
