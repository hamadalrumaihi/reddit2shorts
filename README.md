
# reddit2shorts

Make youtube shorts from reddit posts


## Demo


https://github.com/user-attachments/assets/3fb76b45-5695-41e2-93d0-03a2b515aff4


## Installation

### dependencies 
install [yt_dlp](https://github.com/yt-dlp/yt-dlp) and add it to path

```bash
  git clone https://github.com/yogeshdofficial/reddit2shorts
  cd reddit2shorts
  mv .env.example .env # only needed for snoowrap/gemini/google/upload
  bun install
  bun src/cli.ts --random                                         # ZERO credentials: json source + edge tts (defaults)
  bun src/cli.ts --random --upload youtube                         # add YouTube upload (needs GOOGLE_* creds)
  bun src/cli.ts --random --upload tiktok                          # send to TikTok inbox as a draft (needs TIKTOK_* creds)
  bun src/cli.ts --source snoowrap --random                        # Reddit API (needs creds)
  bun src/cli.ts --source gemini                                   # AI-generated story (needs GEMINI_API_KEY)
```

### Run on Replit (works from a phone)

This repo ships `.replit` and `replit.nix`, so you can run it without a local machine:

1. Import the repo into Replit (Create → Import from GitHub).
2. Press **Run**. Replit installs bun, yt-dlp and Chromium automatically, then runs the zero-credential default (`--source json --tts edge`).
3. The finished video appears at `shorts/<id>/output.mp4` in the file tree.

No credentials needed. The Run button has a **dropdown with two options**:
- **JSON (default)** — zero credentials.
- **Gemini fallback** — use this if Reddit blocks Replit's datacenter IP (repeated `403` warnings). One-time setup: add a free `GEMINI_API_KEY` in Replit's **Secrets** tab, then pick this option from the Run dropdown. It never touches Reddit, so the IP block doesn't apply.

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

get by installing [extension](https://cookie-editor.com/) and getting cookie from tiktok webiste's sessionid (only for `--tts tiktok` voices)  
`TIKTOK_SESSION_ID`  

for `--upload tiktok`: register an app at [developers.tiktok.com](https://developers.tiktok.com/), add the **Content Posting API** product with the `video.upload` scope, then run the OAuth flow once to get a refresh token. Set:  
`TIKTOK_CLIENT_KEY`  
`TIKTOK_CLIENT_SECRET`  
`TIKTOK_REFRESH_TOKEN`  

> **Note:** `--upload tiktok` sends the finished video to your TikTok app **inbox as a draft** — you tap *Post* in the app to publish (set caption/privacy there). This works without TikTok app review. Fully automated public posting requires TikTok's app audit + the direct-post endpoint; the inbox flow is the durable, ToS-compliant default. TikTok access tokens are refreshed automatically on each run.

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
  -t --tts <tts>                      Which tts to use: "edge" (no creds — default), "google" or "tiktok"
  -u --upload <platform>              Upload after render: "youtube" or "tiktok"
  -g --tags <tags...>                 Tags for video title (default: ["shorts","reddit","redditstories"])
  -a --bgAudio <bgAudio>              Background audio (default: "https://www.youtube.com/watch?v=xy_NKN75Jhw")
  -v --bgVideo <bgVideo>              Background video (default: "https://www.youtube.com/watch?v=XBIaqOm0RKQ")
  -h, --help                          display help for command
```

Each successfully-rendered Reddit post is recorded in `.seen-posts.json`
(gitignored) and skipped on later `--random` runs, so an automated/scheduled
loop never re-posts the same content. Delete that file to reset.

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
