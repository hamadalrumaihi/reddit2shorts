import { execFile } from "child_process";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import ora from "ora";
import ffmpeg, { resolveFfmpegPath } from "../config/ffmpeg";
import { RedditInterface } from "../reddit/RedditInterface";
import { RedditPost } from "../reddit/types";
import { TtsInterface, WordTiming } from "../tts/tts";
import { EdgeTts } from "../tts/impl/edgeTts";
import { buildStoryboard } from "../story/beats";
import { writeHook } from "../story/hook";
import { StoryBeat } from "../story/types";
import { renderAnimation, renderCover } from "../animation/renderer";
import { SfxEvent, TimedBeat, Timeline } from "../animation/timeline";
import { H, W } from "../animation/scenes";
import { ensureMusic, ensureSfxLibrary } from "../audio/library";
import { mixAudio, SfxPlacement } from "../audio/mix";
import { voiceEnvelope } from "../audio/envelope";
import { SfxName } from "../audio/synth";
import { AnimatedCaption, buildAnimatedCaption } from "../social/animatedCaption";
import { postIdFromPermalink } from "../utils/seenPosts";
import { logEvent } from "../utils/logger";

const execFileAsync = promisify(execFile);

export interface AnimatedShortOptions {
  post: RedditPost;
  reddit: RedditInterface;
  /** Top comments to consider for "verdict" beats. */
  commentsCount: number;
  maxDuration?: number;
  minDuration?: number;
  /** Narrator voice (the crow). */
  voice?: string;
  /** Verdict voice (the hedgehog). */
  voice2?: string;
  rate?: string;
  /** Path to a royalty-free music file; `false` disables music. */
  music?: string | false;
  sfx?: boolean;
  fps?: number;
  outDir?: string;
  keepTemp?: boolean;
  renderWorkers?: number;
}

export interface AnimatedShortResult {
  outputPath: string;
  coverPath: string;
  metadataPath: string;
  timeline: Timeline;
  caption: AnimatedCaption;
  durationSec: number;
}

interface SynthesisedBeat {
  beat: StoryBeat;
  file: string;
  durationSec: number;
  words: WordTiming[];
}

/** Which SFX fire for each action and when (seconds after the beat starts). */
const ACTION_SFX_TIMING: Record<string, [SfxName, number][]> = {
  chase: [
    ["whoosh", 0.0],
    ["tiptoe", 0.15],
    ["whoosh", 1.7],
    ["boing", 3.45],
  ],
  gasp: [
    ["gasp", 0.05],
    ["slide_up", 0.15],
  ],
  facepalm: [
    ["slide_down", 0.05],
    ["pop", 0.32],
  ],
  door_slam: [["door_slam", 0.28]],
  sweat: [
    ["drip", 0.4],
    ["drip", 1.1],
    ["drip", 1.8],
  ],
  anvil: [
    ["slide_down", 0.0],
    ["clang", 0.55],
  ],
  reaction: [
    ["boing", 0.1],
    ["sparkle", 0.35],
  ],
  talk: [],
};

const probeDuration = (file: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, meta) => (err ? reject(err) : resolve(meta.format.duration || 0)));
  });

async function synthesiseBeat(beat: StoryBeat, tts: TtsInterface, audioDir: string): Promise<SynthesisedBeat> {
  const file = path.join(audioDir, `beat-${String(beat.id).padStart(2, "0")}.mp3`);
  let words: WordTiming[] = [];
  if (tts.getAudioWithTimings) {
    const r = await tts.getAudioWithTimings(beat.text);
    await writeFile(file, r.audio);
    words = r.words;
  } else {
    await writeFile(file, await tts.getAudioAsBuffer(beat.text));
  }
  const durationSec = await probeDuration(file);
  if (words.length === 0) {
    // No timings from this provider: spread the words evenly (keeps captions working).
    const ws = beat.text.split(/\s+/).filter(Boolean);
    const per = (durationSec * 1000) / Math.max(1, ws.length);
    words = ws.map((w, i) => ({ word: w, startMs: i * per, endMs: (i + 1) * per - 40 }));
  }
  return { beat, file, durationSec, words };
}

function gapBefore(kind: StoryBeat["kind"]): number {
  if (kind === "verdict") return 0.55;
  if (kind === "outro") return 0.45;
  return 0.3;
}

/**
 * Lay synthesised beats on the time axis. `gapScale` widens pauses and
 * `tailHold` extends the ending when a story runs short of minDuration.
 */
function layout(beats: SynthesisedBeat[], gapScale = 1, tailHold = 1.0): { timed: TimedBeat[]; durationSec: number } {
  const timed: TimedBeat[] = [];
  let t = 0.4; // small lead-in so the title card can pop first
  for (const sb of beats) {
    if (timed.length) t += gapBefore(sb.beat.kind) * gapScale;
    const startSec = t;
    const endSec = t + sb.durationSec;
    timed.push({
      ...sb.beat,
      startSec,
      endSec,
      durationSec: sb.durationSec,
      audioFile: sb.file,
      words: sb.words.map((w) => ({ word: w.word, startMs: Math.round(startSec * 1000 + w.startMs), endMs: Math.round(startSec * 1000 + w.endMs) })),
    });
    t = endSec;
  }
  return { timed, durationSec: Math.round((t + tailHold) * 100) / 100 };
}

/**
 * Pick which beats fit the 45–59 s window, synthesising on the way so real
 * TTS durations drive the decision. Story beats are cut first (the cliff-
 * hanger justifies "Follow for part 2"), verdict beats fill remaining room.
 */
async function fitBeats(
  all: StoryBeat[],
  ttsFor: (beat: StoryBeat) => TtsInterface,
  audioDir: string,
  maxDuration: number,
  log: (msg: string) => void
): Promise<SynthesisedBeat[]> {
  const outro = all.find((b) => b.kind === "outro")!;
  const outroSynth = await synthesiseBeat(outro, ttsFor(outro), audioDir);
  const reserve = gapBefore("outro") + outroSynth.durationSec;
  const kept: SynthesisedBeat[] = [];
  let total = 0.4;

  const tryAdd = async (beat: StoryBeat): Promise<boolean> => {
    const sb = await synthesiseBeat(beat, ttsFor(beat), audioDir);
    const need = (kept.length ? gapBefore(beat.kind) : 0) + sb.durationSec;
    if (total + need + reserve > maxDuration) {
      await rm(sb.file, { force: true });
      return false;
    }
    kept.push(sb);
    total += need;
    return true;
  };

  let cutStory = false;
  for (const beat of all.filter((b) => b.kind === "hook" || b.kind === "story")) {
    if (!(await tryAdd(beat))) {
      cutStory = true;
      break;
    }
  }
  if (cutStory) {
    const last = kept[kept.length - 1];
    if (last && last.beat.kind === "story") {
      last.beat.action = "reaction";
      last.beat.punchline = true;
    }
    log(`Story trimmed to fit ${maxDuration}s (${kept.length - 1} story beats kept)`);
  }
  for (const beat of all.filter((b) => b.kind === "verdict")) {
    if (!(await tryAdd(beat))) break;
  }
  kept.push(outroSynth);
  return kept;
}

function sfxEvents(beats: TimedBeat[]): SfxEvent[] {
  const events: SfxEvent[] = [];
  for (const b of beats) {
    for (const [name, offset] of ACTION_SFX_TIMING[b.action] || []) {
      if (offset < b.durationSec + 0.2) events.push({ atSec: b.startSec + offset, name });
    }
    if (b.punchline && b.action !== "reaction") events.push({ atSec: b.endSec - 0.4, name: "sparkle", gainDb: -4 });
  }
  return events.sort((a, b) => a.atSec - b.atSec);
}

export async function createAnimatedShort(opts: AnimatedShortOptions): Promise<AnimatedShortResult> {
  const fps = opts.fps ?? 30;
  const maxDuration = opts.maxDuration ?? 59;
  const minDuration = opts.minDuration ?? 45;
  const post = opts.post;
  const id = postIdFromPermalink(post.permalink) || `story-${Date.now().toString(36)}`;
  const outDir = opts.outDir ?? path.join("shorts", id);
  const audioDir = path.join(outDir, "audio");
  const tmpDir = path.join(outDir, "tmp");
  await mkdir(audioDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  const ttsA = new EdgeTts({ voice: opts.voice, rate: opts.rate });
  const ttsB = new EdgeTts({ voice: opts.voice2 || process.env.EDGE_TTS_VOICE_2 || "en-US-GuyNeural", rate: opts.rate });
  const ttsFor = (beat: StoryBeat): TtsInterface => (beat.speaker === "hedgehog" ? ttsB : ttsA);

  // 1) Story -> storyboard
  const s1 = ora("Writing hook and storyboard").start();
  const comments = await opts.reddit.getTopComments(post, Math.max(opts.commentsCount, 1), true, true);
  const hook = await writeHook(post);
  const storyboard = buildStoryboard(post, comments, hook, { verdictComments: Math.max(1, opts.commentsCount) });
  s1.succeed(`Hook: "${hook}" (${storyboard.beats.length} beats)`);

  // 2) Voice + fit to duration
  const s2 = ora(`Voicing beats with ${ttsA.voiceName} / ${ttsB.voiceName}`).start();
  let kept = await fitBeats(storyboard.beats, ttsFor, audioDir, maxDuration, (m) => s2.info(m));
  let { timed, durationSec } = layout(kept);
  if (durationSec < minDuration) {
    // Too short: widen pauses a little and hold the last pose; if still well
    // short, re-voice everything slightly slower.
    const shortfall = minDuration - durationSec;
    const gaps = kept.length - 1;
    const gapScale = Math.min(2.2, 1 + Math.min(shortfall, gaps * 0.5) / Math.max(1, gaps * 0.35));
    ({ timed, durationSec } = layout(kept, gapScale, Math.min(2.5, 1 + shortfall * 0.4)));
    if (durationSec < minDuration - 2 && !opts.rate) {
      s2.info(`Story runs ${durationSec.toFixed(1)}s; re-voicing slower to reach ${minDuration}s`);
      const slowA = new EdgeTts({ voice: opts.voice, rate: "-10%" });
      const slowB = new EdgeTts({ voice: ttsB.voiceName, rate: "-10%" });
      const slowFor = (b: StoryBeat) => (b.speaker === "hedgehog" ? slowB : slowA);
      kept = await Promise.all(kept.map((sb) => synthesiseBeat(sb.beat, slowFor(sb.beat), audioDir)));
      ({ timed, durationSec } = layout(kept, gapScale, Math.min(2.5, 1 + shortfall * 0.4)));
    }
  }
  if (durationSec > maxDuration) durationSec = maxDuration; // hard cap (audio/video are trimmed)
  s2.succeed(`Voiced ${kept.length} beats, ${durationSec.toFixed(1)}s total`);

  // 3) Audio mix (voice + music ducked + sfx)
  const s3 = ora("Mixing audio").start();
  const sfx = sfxEvents(timed);
  const sfxLib = opts.sfx === false ? null : await ensureSfxLibrary();
  const musicFile = opts.music === false ? undefined : await ensureMusic(opts.music || process.env.ANIM_MUSIC || undefined);
  const mixFile = path.join(tmpDir, "audio.m4a");
  const voiceFile = path.join(tmpDir, "voice.wav");
  const placements: SfxPlacement[] = sfxLib ? sfx.map((e) => ({ file: sfxLib[e.name], atSec: e.atSec, gainDb: e.gainDb })) : [];
  await mixAudio({
    voice: timed.map((b) => ({ file: b.audioFile, atSec: b.startSec })),
    music: musicFile,
    musicUnderVoiceDb: Number(process.env.ANIM_MUSIC_DB || -18),
    sfx: placements,
    durationSec,
    outFile: mixFile,
    voiceOnlyFile: voiceFile,
  });
  const mouth = await voiceEnvelope(voiceFile, fps, durationSec);
  s3.succeed(`Audio mixed (${sfx.length} sound effects${musicFile ? ", music" : ""})`);

  const timeline: Timeline = {
    fps,
    width: W,
    height: H,
    durationSec,
    hook,
    title: post.title,
    subreddit: post.subreddit.display_name,
    sourceId: storyboard.sourceId,
    beats: timed,
    mouth,
    sfx,
    seed: parseInt(id, 36) % 100000 || 7,
  };
  await writeFile(path.join(outDir, "timeline.json"), JSON.stringify(timeline, null, 2));

  // 4) Render frames -> silent video, then cover
  const totalFrames = Math.ceil(durationSec * fps);
  const s4 = ora(`Rendering ${totalFrames} frames`).start();
  const silentVideo = path.join(tmpDir, "video.mp4");
  await renderAnimation({
    timeline,
    outVideoPath: silentVideo,
    workers: opts.renderWorkers,
    onProgress: (f, t) => (s4.text = `Rendering frames ${f}/${t}`),
  });
  s4.succeed(`Rendered ${totalFrames} frames`);
  const coverPath = path.join(outDir, "cover.jpg");
  await renderCover(timeline, coverPath);

  // 5) Mux
  const s5 = ora("Muxing final short").start();
  const outputPath = path.join(outDir, "output.mp4");
  await execFileAsync(resolveFfmpegPath(), [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    silentVideo,
    "-i",
    mixFile,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-t",
    String(durationSec),
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  s5.succeed(`Video saved at ${outputPath}`);

  // 6) Metadata
  const caption = buildAnimatedCaption(post, hook);
  const metadata = {
    sourcePostId: storyboard.sourceId,
    permalink: post.permalink,
    subreddit: post.subreddit.display_name,
    title: post.title,
    hook,
    caption: caption.caption,
    cta: caption.cta,
    hashtags: caption.hashtags,
    aiDisclosure: caption.aiDisclosure,
    aiGeneratedContent: true,
    durationSec,
    fps,
    resolution: `${W}x${H}`,
    voices: { narrator: ttsA.voiceName, verdict: ttsB.voiceName },
    music: musicFile ? path.basename(musicFile) : null,
    files: { video: path.basename(outputPath), cover: path.basename(coverPath) },
    beats: timed.map((b) => ({ id: b.id, kind: b.kind, speaker: b.speaker, scene: b.scene, action: b.action, start: b.startSec, end: b.endSec, text: b.text })),
    createdAt: new Date().toISOString(),
  };
  const metadataPath = path.join(outDir, "metadata.json");
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  logEvent("animated_render_complete", { outputPath, durationSec, beats: timed.length });

  if (!opts.keepTemp) {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(audioDir, { recursive: true, force: true });
  }

  return { outputPath, coverPath, metadataPath, timeline, caption, durationSec };
}
