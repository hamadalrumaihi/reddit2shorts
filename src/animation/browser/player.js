/* global document, window */
/**
 * Browser-side animation player for the reddit2shorts cartoon pipeline.
 *
 * Runs inside headless Chrome. Node injects a timeline (beats, word timings,
 * per-frame voice level) with `window.__setup(timeline)` and then asks for
 * deterministic frames with `window.renderFrame(frameIndex, opts)`. Nothing
 * here depends on wall-clock time, so every frame is reproducible.
 *
 * Style: 1940s rubber-hose. Characters are SVG rigs (see assets/characters)
 * whose groups carry a data-pivot; the player rotates/scales those groups,
 * applies squash-and-stretch on the root, flips mouth/eye variants, and
 * drives props (door, anvil, sweat, stars, dust, emanata).
 */
(function () {
  const W = 1080;
  const H = 1920;
  const GROUND = 1460;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Where each rig's head sits in rig coordinates (viewBox 400x600).
  const RIG_HEAD = { crow: { x: 212, y: 150, r: 80 }, hedgehog: { x: 280, y: 380, r: 90 } };
  const HOME = {
    crow: { x: 330, scale: 0.92, flip: false, eyes: "eye-open", blinkPeriod: 3.1, blinkOffset: 0.4 },
    hedgehog: { x: 720, scale: 0.9, flip: true, eyes: "eye-squint", blinkPeriod: 4.3, blinkOffset: 1.9 },
  };

  const state = { tl: null, chars: {}, els: {}, captionChunks: [], lastChunkKey: "", lastScene: "" };

  // ---------------------------------------------------------------- utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeIn = (u) => Math.pow(clamp(u, 0, 1), 2);
  const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  function hash(n) {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  function smoothNoise(t, salt) {
    const i = Math.floor(t);
    const f = t - i;
    const a = hash(i * 31 + salt * 101);
    const b = hash((i + 1) * 31 + salt * 101);
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
  /** Damped spring overshoot, u in [0,1] -> settles at 1. */
  function overshoot(u) {
    u = clamp(u, 0, 1);
    return 1 - Math.cos(u * Math.PI * 2.5) * Math.exp(-u * 4.5) * (1 - u);
  }
  const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

  function setPivotTransform(el, pivot, p) {
    if (!el) return;
    const rot = p.rot || 0;
    const sx = p.sx == null ? 1 : p.sx;
    const sy = p.sy == null ? 1 : p.sy;
    const dx = p.dx || 0;
    const dy = p.dy || 0;
    el.setAttribute(
      "transform",
      `translate(${fmt(pivot.x + dx)} ${fmt(pivot.y + dy)}) rotate(${fmt(rot)}) scale(${fmt(sx)} ${fmt(sy)}) translate(${fmt(-pivot.x)} ${fmt(-pivot.y)})`
    );
  }

  function show(el, visible) {
    if (!el) return;
    if (visible) el.removeAttribute("display");
    else el.setAttribute("display", "none");
  }

  function parsePivot(el) {
    const raw = (el && el.getAttribute("data-pivot")) || "0,0";
    const [x, y] = raw.split(",").map(Number);
    return { x, y };
  }

  // ---------------------------------------------------------- characters
  function makeCharacter(name) {
    const tpl = document.getElementById("tpl-" + name);
    const rigSrc = tpl.querySelector('[id="rig"]');
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("id", "char-" + name);
    g.appendChild(rigSrc.cloneNode(true));
    document.getElementById("characters").appendChild(g);
    const q = (id) => g.querySelector('[id="' + id + '"]');
    const parts = {};
    for (const id of ["rig", "body", "head", "arm-l", "arm-r", "hand-l", "hand-r", "leg-l", "leg-r", "tail", "brows"]) {
      const el = q(id);
      if (el) parts[id] = { el, pivot: parsePivot(el) };
    }
    const eyes = {};
    for (const id of ["eye-open", "eye-wide", "eye-closed", "eye-squint"]) eyes[id] = q(id);
    const mouths = {};
    for (const id of ["mouth-closed", "mouth-mid", "mouth-open"]) mouths[id] = q(id);
    const home = HOME[name];
    return { name, g, parts, eyes, mouths, home, head: RIG_HEAD[name] };
  }

  /** Default pose: everything neutral. */
  function neutralPose(ch) {
    return {
      x: ch.home.x,
      y: GROUND,
      flip: ch.home.flip,
      sx: 1,
      sy: 1,
      lean: 0,
      jitter: true,
      body: { rot: 0 },
      head: { rot: 0, dx: 0, dy: 0 },
      armL: { rot: 0 },
      armR: { rot: 0 },
      legL: { rot: 0 },
      legR: { rot: 0 },
      tail: { rot: 0 },
      eyes: ch.home.eyes,
      mouth: null, // null -> driven by voice level
      forceMouth: null,
      opacity: 1,
    };
  }

  function applyPose(ch, pose, frame) {
    const s = ch.home.scale;
    const flip = pose.flip ? -1 : 1;
    const jx = pose.jitter ? (hash(frame * 7 + ch.name.length) - 0.5) * 2.2 : 0;
    const jy = pose.jitter ? (hash(frame * 11 + ch.name.length * 3) - 0.5) * 2.2 : 0;
    // Root: feet at (x,y); squash/stretch + lean around the feet.
    ch.g.setAttribute(
      "transform",
      `translate(${fmt(pose.x + jx)} ${fmt(pose.y + jy)}) rotate(${fmt(pose.lean * flip)}) scale(${fmt(s * flip * pose.sx)} ${fmt(s * pose.sy)}) translate(-200 -560)`
    );
    ch.g.setAttribute("opacity", fmt(pose.opacity));
    const P = ch.parts;
    if (P.body) setPivotTransform(P.body.el, P.body.pivot, pose.body);
    if (P.head) setPivotTransform(P.head.el, P.head.pivot, pose.head);
    if (P["arm-l"]) setPivotTransform(P["arm-l"].el, P["arm-l"].pivot, pose.armL);
    if (P["arm-r"]) setPivotTransform(P["arm-r"].el, P["arm-r"].pivot, pose.armR);
    if (P["leg-l"]) setPivotTransform(P["leg-l"].el, P["leg-l"].pivot, pose.legL);
    if (P["leg-r"]) setPivotTransform(P["leg-r"].el, P["leg-r"].pivot, pose.legR);
    if (P.tail) setPivotTransform(P.tail.el, P.tail.pivot, pose.tail);
    for (const id in ch.eyes) show(ch.eyes[id], id === pose.eyes);
    const mouth = pose.forceMouth || pose.mouth || "mouth-closed";
    for (const id in ch.mouths) show(ch.mouths[id], id === mouth);
  }

  /** Screen-space head centre for a pose (used to place props). */
  function headPoint(ch, pose) {
    const s = ch.home.scale;
    const flip = pose.flip ? -1 : 1;
    const hx = (ch.head.x - 200) * s * flip * pose.sx;
    const hy = (ch.head.y - 560) * s * pose.sy;
    return { x: pose.x + hx, y: pose.y + hy, r: ch.head.r * s };
  }

  // ------------------------------------------------------------- actions
  /**
   * Each action mutates poses for the speaker and listener given the local
   * time `tl` (seconds since the beat started), total beat duration `D`, and
   * returns prop instructions. Props are reset every frame.
   */
  const actions = {
    talk() {},

    gasp(ctx) {
      const { sp, tl } = ctx;
      if (tl < 0.12) {
        sp.sx = 1.15;
        sp.sy = 0.82;
      } else if (tl < 0.6) {
        const u = (tl - 0.12) / 0.48;
        sp.y = GROUND - 150 * Math.sin(Math.PI * u);
        sp.sx = 0.9;
        sp.sy = 1.18;
      } else if (tl < 1.1) {
        const u = (tl - 0.6) / 0.5;
        const o = overshoot(u);
        sp.sx = lerp(1.14, 1, o);
        sp.sy = lerp(0.84, 1, o);
      }
      if (tl < 1.3) {
        const u = easeOut(tl / 0.25);
        sp.armR.rot = -150 * u;
        sp.armL.rot = 150 * u;
      } else if (tl < 1.7) {
        const u = easeInOut((tl - 1.3) / 0.4);
        sp.armR.rot = -150 * (1 - u);
        sp.armL.rot = 150 * (1 - u);
      }
      if (tl < 1.8) sp.eyes = "eye-wide";
      if (tl < 0.7) sp.forceMouth = "mouth-open";
      if (ctx.li && tl < 1.2) ctx.li.lean = -6;
    },

    facepalm(ctx) {
      const { sp, tl } = ctx;
      const inU = easeOut(tl / 0.3);
      const outU = tl > 1.9 ? easeInOut((tl - 1.9) / 0.4) : 0;
      const k = inU * (1 - outU);
      sp.armR.rot = -160 * k;
      sp.head.rot = 18 * k;
      sp.head.dy = 10 * k;
      sp.sy = 1 - 0.05 * k;
      sp.sx = 1 + 0.03 * k;
      if (k > 0.5) sp.eyes = "eye-closed";
      if (tl > 0.3 && tl < 1.9) sp.lean = 4 * Math.sin(tl * 2 * Math.PI * 1.5);
      if (ctx.li) ctx.li.head.rot = -6;
    },

    door_slam(ctx) {
      const { sp, li, tl, props } = ctx;
      props.door = { open: tl < 0.12 ? 1 : tl < 0.32 ? 1 - easeIn((tl - 0.12) / 0.2) : 0 };
      if (tl >= 0.3 && tl < 0.9) {
        const k = Math.exp(-(tl - 0.3) * 6);
        props.shake = 22 * k;
        props.dust = { x: 200, y: GROUND, k: 1 - (tl - 0.3) / 0.6 };
      }
      const flinch = tl > 0.3 && tl < 0.8;
      for (const c of [sp, li]) {
        if (!c) continue;
        if (flinch) {
          c.eyes = "eye-closed";
          c.sy = 0.9;
          c.sx = 1.08;
          c.lean = sp === c ? 8 : -8;
        } else if (tl >= 0.8 && tl < 1.3) {
          const o = overshoot((tl - 0.8) / 0.5);
          c.sy = lerp(0.9, 1, o);
          c.sx = lerp(1.08, 1, o);
        }
        if (tl >= 0.8 && tl < 2.2) c.eyes = "eye-wide";
      }
    },

    sweat(ctx) {
      const { sp, tl, t, props } = ctx;
      sp.x += 4 * Math.sin(t * 2 * Math.PI * 13);
      sp.eyes = sp.eyes === "eye-squint" ? "eye-open" : "eye-wide";
      sp.armL.rot = 40 + 10 * Math.sin(t * 2 * Math.PI * 2);
      sp.armR.rot = -40 - 10 * Math.sin(t * 2 * Math.PI * 2);
      sp.head.rot = 3 * Math.sin(t * 2 * Math.PI * 6);
      props.sweat = { who: "speaker", tl };
      if (tl > 0.2 && tl < 2.4) props.sweatVisible = true;
    },

    anvil(ctx) {
      const { sp, li, tl, props } = ctx;
      const target = li || sp;
      const impact = 0.55;
      if (tl < impact) {
        props.anvil = { who: li ? "listener" : "speaker", u: easeIn(tl / impact), stage: "fall" };
        if (li && tl > 0.25) li.eyes = "eye-wide";
        if (li && tl > 0.25) li.head.rot = -20;
      } else if (tl < 2.3) {
        const k = tl - impact;
        if (k < 0.25) {
          target.sy = 0.38;
          target.sx = 1.55;
        } else if (k < 1.1) {
          const o = overshoot((k - 0.25) / 0.85);
          target.sy = lerp(0.38, 1, o);
          target.sx = lerp(1.55, 1, o);
        }
        target.eyes = k < 0.6 ? "eye-closed" : "eye-wide";
        target.forceMouth = k < 0.5 ? "mouth-open" : null;
        props.anvil = { who: li ? "listener" : "speaker", u: 1, stage: "rest", k, fade: clamp((k - 1.4) / 0.4, 0, 1) };
        if (k < 0.5) props.shake = 20 * Math.exp(-k * 7);
        props.stars = { who: li ? "listener" : "speaker", k };
        if (sp !== target) {
          sp.eyes = k < 0.5 ? "eye-closed" : "eye-wide";
          sp.lean = -6;
        }
      }
    },

    chase(ctx) {
      const { sp, li, tl, t, props, beat } = ctx;
      const runners = [sp, li].filter(Boolean);
      const half = Math.min(1.7, beat.durationSec / 2.2);
      let dir = 0; // -1 running left, +1 running right
      if (tl < half) {
        dir = -1;
        const u = tl / half;
        for (const c of runners) c.x = c.x - u * 760;
      } else if (tl < half * 2) {
        dir = 1;
        const u = easeOut((tl - half) / half);
        for (const c of runners) c.x = lerp(W + 260, c.x, u);
      }
      if (dir !== 0) {
        for (const c of runners) {
          c.flip = dir < 0;
          c.lean = -16 * dir;
          const ph = t * 2 * Math.PI * 7 + (c === sp ? 0 : 1.3);
          c.legL.rot = 45 * Math.sin(ph);
          c.legR.rot = -45 * Math.sin(ph);
          c.armL.rot = 60 * Math.sin(ph + 0.5) - 30;
          c.armR.rot = -60 * Math.sin(ph + 0.5) + 30;
          c.y = GROUND - 14 * Math.abs(Math.sin(ph));
          c.sy = 1.04;
          c.sx = 0.97;
          c.eyes = c === li ? "eye-wide" : c.eyes;
        }
        props.dust = { x: (runners[0] ? runners[0].x : W / 2) + dir * 120, y: GROUND, k: 0.8 };
      } else if (tl < half * 2 + 0.4) {
        // skid to a stop, little bounce
        const o = overshoot((tl - half * 2) / 0.4);
        for (const c of runners) {
          c.sy = lerp(0.86, 1, o);
          c.sx = lerp(1.12, 1, o);
        }
      }
    },

    reaction(ctx) {
      const { sp, li, tl, props } = ctx;
      if (tl < 0.1) {
        sp.sx = 1.18;
        sp.sy = 0.8;
      } else if (tl < 0.5) {
        const u = (tl - 0.1) / 0.4;
        sp.y = GROUND - 110 * Math.sin(Math.PI * u);
        sp.sx = 0.88;
        sp.sy = 1.22;
        props.emanata = { who: "speaker", k: 1 - u };
      } else if (tl < 1.0) {
        const o = overshoot((tl - 0.5) / 0.5);
        sp.sx = lerp(1.16, 1, o);
        sp.sy = lerp(0.84, 1, o);
      }
      if (tl < 1.4) {
        sp.eyes = "eye-wide";
        sp.armR.rot = -120 * easeOut(tl / 0.2) * (tl > 1.0 ? 1 - easeInOut((tl - 1.0) / 0.4) : 1);
      }
      if (tl < 0.5) sp.forceMouth = "mouth-open";
      if (li && tl < 1.6) {
        li.eyes = "eye-wide";
        li.y = GROUND - (tl < 0.5 ? 50 * Math.sin(Math.PI * tl / 0.5) : 0);
        props.shock = { who: "listener", k: tl };
      }
      props.punch = clamp(1 - tl / 0.5, 0, 1);
    },
  };

  // --------------------------------------------------------------- setup
  function setup(tl) {
    state.tl = tl;
    state.chars.crow = makeCharacter("crow");
    state.chars.hedgehog = makeCharacter("hedgehog");
    const E = state.els;
    const byId = (id) => document.getElementById(id);
    E.scenes = {};
    for (const name of ["house", "office", "street", "kitchen"]) E.scenes[name] = byId("scene-" + name);
    E.camera = byId("camera");
    E.door = byId("door");
    E.doorPanel = byId("door-panel");
    E.anvil = byId("anvil");
    E.stars = byId("stars");
    E.star = [0, 1, 2].map((i) => byId("star-" + i));
    E.sweat = byId("sweat");
    E.drop = [0, 1, 2].map((i) => byId("drop-" + i));
    E.dust = byId("dust");
    E.dustBall = [0, 1, 2, 3].map((i) => byId("dust-" + i));
    E.emanata = byId("emanata");
    E.shock = byId("shock-mark");
    E.iris = byId("iris");
    E.film = byId("film");
    E.film.setAttribute("href", makeFilmOverlay(W + 400, H + 400, tl.seed || 1));
    E.flicker = byId("flicker");
    E.scratch = byId("scratch");
    E.captions = byId("captions");
    E.title = byId("title-card");
    E.titleText = byId("title-text");
    E.titleBadge = byId("title-badge");
    E.watermark = byId("watermark");
    E.titleText.textContent = tl.hook;
    E.titleBadge.textContent = "r/" + tl.subreddit;
    state.captionChunks = buildCaptionChunks(tl);
    // Draw order: listener behind? Keep hedgehog in front (he's rounder).
  }

  /**
   * Bake paper grain + vignette into one RGBA bitmap (data URL). Drawn as an
   * <image> that jitters a few pixels per frame for a hand-made "boil".
   */
  function makeFilmOverlay(w, h, seed) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    const d = img.data;
    let s = (seed * 2654435761) >>> 0 || 1;
    const rnd = () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967295;
    };
    const cx = w / 2;
    const cy = h * 0.48;
    const rMax = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // grain: sparse dark specks + faint fibres
        const g = rnd();
        let a = g < 0.12 ? 0.16 + rnd() * 0.12 : g > 0.985 ? 0.3 : 0;
        // vignette
        const dist = Math.hypot(x - cx, y - cy) / rMax;
        const v = Math.max(0, (dist - 0.62) / 0.38);
        a += v * v * 0.5;
        d[i] = 27;
        d[i + 1] = 21;
        d[i + 2] = 16;
        d[i + 3] = Math.min(255, Math.round(a * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function buildCaptionChunks(tl) {
    const chunks = [];
    for (const beat of tl.beats) {
      let cur = [];
      let chars = 0;
      const flush = () => {
        if (cur.length) chunks.push({ beatId: beat.id, words: cur, start: cur[0].startMs / 1000, end: cur[cur.length - 1].endMs / 1000 });
        cur = [];
        chars = 0;
      };
      for (const w of beat.words) {
        if (cur.length >= 4 || (chars + w.word.length > 22 && cur.length)) flush();
        cur.push(w);
        chars += w.word.length + 1;
      }
      flush();
    }
    return chunks;
  }

  function currentBeat(t) {
    const beats = state.tl.beats;
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const next = beats[i + 1];
      if (t < (next ? next.startSec : Infinity)) return { beat: b, index: i, prev: beats[i - 1] || null, next: next || null };
    }
    return { beat: beats[beats.length - 1], index: beats.length - 1, prev: null, next: null };
  }

  function mouthShape(level) {
    if (level < 0.14) return "mouth-closed";
    if (level < 0.48) return "mouth-mid";
    return "mouth-open";
  }

  // ------------------------------------------------------------- render
  function renderFrame(frame, opts) {
    opts = opts || {};
    const tl = state.tl;
    const fps = tl.fps;
    const t = frame / fps;
    const E = state.els;
    const { beat, prev, next } = currentBeat(t);
    const tlLocal = t - beat.startSec;
    const level = tl.mouth[Math.min(frame, tl.mouth.length - 1)] || 0;

    // ---- scene
    for (const name in E.scenes) show(E.scenes[name], name === beat.scene);

    // ---- poses
    const crow = state.chars.crow;
    const hog = state.chars.hedgehog;
    const poses = { crow: neutralPose(crow), hedgehog: neutralPose(hog) };
    const speakerName = beat.speaker;
    const listenerName = speakerName === "crow" ? "hedgehog" : "crow";
    const sp = poses[speakerName];
    const li = poses[listenerName];
    const speaking = tlLocal >= 0 && t <= beat.endSec + 0.05;

    // Idle life for both.
    for (const name in poses) {
      const p = poses[name];
      const ch = state.chars[name];
      const ph = t * 2 * Math.PI * 0.9 + (name === "crow" ? 0 : 2.1);
      p.sy = 1 + 0.016 * Math.sin(ph);
      p.sx = 1 - 0.01 * Math.sin(ph);
      p.head.rot = 2.5 * Math.sin(ph * 0.5);
      p.tail.rot = 6 * Math.sin(ph * 1.3);
      const bp = (t + ch.home.blinkOffset) % ch.home.blinkPeriod;
      if (bp < 0.13) p.eyes = "eye-closed";
    }
    // Speaker gestures: arm beats on the voice, head nods with volume.
    if (speaking) {
      sp.mouth = mouthShape(level);
      sp.armR.rot = -25 - 30 * level - 12 * Math.sin(t * 2 * Math.PI * 1.6);
      sp.armL.rot = 18 + 10 * Math.sin(t * 2 * Math.PI * 1.1);
      sp.head.rot += -6 * level;
      sp.head.dy = -4 * level;
      sp.sy += 0.02 * level;
      // Listener leans in and nods now and then.
      li.head.rot += 4 * Math.sin(t * 2 * Math.PI * 0.35);
      li.lean = 3;
    }

    const props = {};
    const ctx = { sp, li, tl: tlLocal, t, beat, props };
    const act = actions[beat.action] || actions.talk;
    if (tlLocal >= 0) act(ctx);

    // Opening/closing beats fade characters in/out slightly for polish.
    if (beat.kind === "outro") {
      const u = clamp(tlLocal / 0.3, 0, 1);
      sp.armR.rot = -70 * u + 10 * Math.sin(t * 2 * Math.PI * 2.5) * u; // wave
    }

    // ---- camera: subtle drift per beat + shake + punch
    const beatU = clamp(tlLocal / Math.max(0.5, beat.durationSec), 0, 1);
    const zoom = 1.015 + 0.03 * beatU * (beat.id % 2 === 0 ? 1 : -1) + 0.035 * (beat.id % 2 === 0 ? 0 : 1) + 0.08 * (props.punch || 0);
    const panX = (beat.id % 3 - 1) * 18 * beatU;
    const shake = props.shake || 0;
    const shX = shake ? (hash(frame * 3.7) - 0.5) * 2 * shake : 0;
    const shY = shake ? (hash(frame * 5.3 + 9) - 0.5) * 2 * shake : 0;
    E.camera.setAttribute(
      "transform",
      `translate(${fmt(W / 2 + shX + panX)} ${fmt(1100 + shY)}) scale(${fmt(zoom)}) translate(${fmt(-W / 2)} ${fmt(-1100)})`
    );

    // Hedgehog is drawn after crow; during a chase facing swaps are handled by flip.
    applyPose(crow, poses.crow, frame);
    applyPose(hog, poses.hedgehog, frame);

    // ---- props
    renderProps(props, poses, frame, t);

    // ---- iris transition between scenes
    let irisR = null;
    if (next && next.scene !== beat.scene && next.startSec - t < 0.3) irisR = 1300 * clamp((next.startSec - t) / 0.3, 0, 1);
    if (prev && prev.scene !== beat.scene && tlLocal < 0.3 && tlLocal >= 0) irisR = 1300 * clamp(tlLocal / 0.3, 0, 1);
    if (irisR !== null) {
      show(E.iris, true);
      E.iris.setAttribute("d", `M0 0 H${W} V${H} H0 Z M${W / 2} ${1000 - irisR} a ${irisR} ${irisR} 0 1 0 0.01 0 Z`);
    } else show(E.iris, false);

    // ---- film look: grain boil, flicker, occasional hair/scratch
    const gx = Math.floor(hash(frame * 1.3) * 120) - 60;
    const gy = Math.floor(hash(frame * 2.9 + 4) * 120) - 60;
    E.film.setAttribute("transform", `translate(${gx} ${gy})`);
    const dip = hash(frame * 17.1) < 0.025 ? 0.1 : 0;
    E.flicker.setAttribute("opacity", fmt(0.015 + 0.045 * smoothNoise(frame * 0.7, 3) + dip));
    if (hash(frame * 23.3 + 1) < 0.035) {
      show(E.scratch, true);
      const sx = Math.floor(hash(frame * 29.1) * W);
      E.scratch.setAttribute("x1", sx);
      E.scratch.setAttribute("x2", sx + 2);
    } else show(E.scratch, false);

    // ---- title card (hook beat) / cover mode
    renderTitle(beat, tlLocal, next, opts.cover);

    // ---- captions (hidden while the title card shows the hook itself)
    if (opts.cover || beat.id === tl.beats[0].id) E.captions.style.display = "none";
    else renderCaptions(t);

    return true;
  }

  function renderTitle(beat, tlLocal, next, cover) {
    const E = state.els;
    const tl = state.tl;
    if (cover) {
      E.title.style.display = "block";
      E.title.classList.add("cover");
      E.title.style.opacity = "1";
      E.title.style.transform = "translateY(0) rotate(-1.5deg)";
      return;
    }
    E.title.classList.remove("cover");
    const hookBeat = tl.beats[0];
    const t = beat.startSec + tlLocal;
    const hideAt = (next && hookBeat.id === beat.id ? next.startSec : hookBeat.endSec + 0.35);
    if (beat.id === hookBeat.id || t < hideAt + 0.35) {
      const inU = easeOut(t / 0.35);
      const outU = t > hideAt ? easeIn((t - hideAt) / 0.35) : 0;
      const k = inU * (1 - outU);
      if (k <= 0.001) {
        E.title.style.display = "none";
        return;
      }
      E.title.style.display = "block";
      E.title.style.opacity = fmt(k);
      E.title.style.transform = `translateY(${fmt((1 - inU) * -60 + outU * -40)}px) rotate(${fmt(-1.5 + 0.6 * Math.sin(t * 2))}deg) scale(${fmt(0.96 + 0.04 * inU)})`;
    } else {
      E.title.style.display = "none";
    }
  }

  function renderCaptions(t) {
    const E = state.els;
    const chunks = state.captionChunks;
    let chunk = null;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const nextStart = chunks[i + 1] ? chunks[i + 1].start : Infinity;
      if (t >= c.start - 0.05 && t < Math.min(c.end + 0.35, nextStart)) {
        chunk = c;
        break;
      }
    }
    if (!chunk) {
      E.captions.style.display = "none";
      state.lastChunkKey = "";
      return;
    }
    const key = chunk.beatId + ":" + chunk.start;
    if (key !== state.lastChunkKey) {
      E.captions.innerHTML = chunk.words.map((w) => `<span class="w">${escapeHtml(w.word)}</span>`).join(" ");
      state.lastChunkKey = key;
    }
    E.captions.style.display = "block";
    const spans = E.captions.querySelectorAll(".w");
    let activeIdx = -1;
    for (let i = 0; i < chunk.words.length; i++) if (t >= chunk.words[i].startMs / 1000) activeIdx = i;
    spans.forEach((s, i) => s.classList.toggle("active", i === activeIdx));
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderProps(props, poses, frame, t) {
    const E = state.els;
    const who = (w) => (w === "speaker" ? poses[state.tl.beats && currentSpeaker(t)] : poses[currentListener(t)]);
    const headOf = (w) => {
      const name = w === "speaker" ? currentSpeaker(t) : currentListener(t);
      return headPoint(state.chars[name], poses[name]);
    };

    // door
    if (props.door) {
      show(E.door, true);
      const open = props.door.open; // 1 = swung into the room, 0 = closed
      const pv = parsePivot(E.doorPanel);
      E.doorPanel.setAttribute("transform", `translate(${pv.x} ${pv.y}) scale(${fmt(lerp(1, -0.72, open))} 1) translate(${-pv.x} ${-pv.y})`);
    } else show(E.door, false);

    // anvil
    if (props.anvil) {
      show(E.anvil, true);
      const hp = headOf(props.anvil.who);
      const target = who(props.anvil.who);
      const restY = hp.y - hp.r - 55;
      let y;
      if (props.anvil.stage === "fall") y = lerp(-200, restY, props.anvil.u);
      else y = headPoint(state.chars[props.anvil.who === "speaker" ? currentSpeaker(t) : currentListener(t)], target).y - hp.r * target.sy - 55;
      E.anvil.setAttribute("transform", `translate(${fmt(hp.x)} ${fmt(y)}) rotate(${fmt(props.anvil.stage === "fall" ? -8 : 0)})`);
      E.anvil.setAttribute("opacity", fmt(1 - (props.anvil.fade || 0)));
    } else show(E.anvil, false);

    // stars
    if (props.stars && props.stars.k < 1.8) {
      show(E.stars, true);
      const hp = headOf(props.stars.who);
      const k = props.stars.k;
      const fade = clamp((1.8 - k) / 0.4, 0, 1);
      E.stars.setAttribute("opacity", fmt(fade));
      E.star.forEach((s, i) => {
        const a = k * 5 + (i * Math.PI * 2) / 3;
        s.setAttribute("transform", `translate(${fmt(hp.x + Math.cos(a) * 110)} ${fmt(hp.y - hp.r - 70 + Math.sin(a) * 26)}) rotate(${fmt(k * 200)})`);
      });
    } else show(E.stars, false);

    // sweat drops
    if (props.sweatVisible) {
      show(E.sweat, true);
      const hp = headOf("speaker");
      const flip = who("speaker").flip ? -1 : 1;
      E.drop.forEach((d, i) => {
        const ph = (props.sweat.tl * 1.4 + i * 0.33) % 1;
        d.setAttribute("transform", `translate(${fmt(hp.x + flip * (hp.r + 20 + i * 18) - ph * 16 * flip)} ${fmt(hp.y - 40 + ph * 150)}) scale(${fmt(0.8 + 0.3 * (1 - ph))})`);
        d.setAttribute("opacity", fmt(1 - ph * ph));
      });
    } else show(E.sweat, false);

    // dust puffs
    if (props.dust) {
      show(E.dust, true);
      E.dustBall.forEach((b, i) => {
        const ph = (t * 2.5 + i * 0.25) % 1;
        b.setAttribute("cx", fmt(props.dust.x + (hash(i * 9 + Math.floor(t * 4)) - 0.5) * 120 + ph * 60));
        b.setAttribute("cy", fmt(props.dust.y - 20 - ph * 90));
        b.setAttribute("r", fmt(22 + ph * 26));
        b.setAttribute("opacity", fmt((1 - ph) * props.dust.k * 0.9));
      });
    } else show(E.dust, false);

    // emanata (radial burst lines)
    if (props.emanata) {
      show(E.emanata, true);
      const hp = headOf(props.emanata.who);
      E.emanata.setAttribute("transform", `translate(${fmt(hp.x)} ${fmt(hp.y)}) rotate(${fmt(frame * 9)}) scale(${fmt(0.8 + (1 - props.emanata.k) * 0.6)})`);
      E.emanata.setAttribute("opacity", fmt(props.emanata.k));
    } else show(E.emanata, false);

    // "!" shock mark
    if (props.shock) {
      show(E.shock, true);
      const hp = headOf(props.shock.who);
      const k = props.shock.k;
      const pop = k < 0.3 ? overshoot(k / 0.3) * 1.2 : 1.2 - (k > 1.2 ? (k - 1.2) * 2 : 0);
      E.shock.setAttribute("transform", `translate(${fmt(hp.x)} ${fmt(hp.y - hp.r - 40)}) scale(${fmt(Math.max(0, pop))})`);
    } else show(E.shock, false);
  }

  function currentSpeaker(t) {
    return currentBeat(t).beat.speaker;
  }
  function currentListener(t) {
    return currentSpeaker(t) === "crow" ? "hedgehog" : "crow";
  }

  window.__setup = setup;
  window.renderFrame = renderFrame;
})();
