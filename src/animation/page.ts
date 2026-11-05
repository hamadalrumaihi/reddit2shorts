import { readFile } from "fs/promises";
import path from "path";
import { H, propsLayer, SCENES, W } from "./scenes";

/**
 * Assemble the single-page HTML the renderer screenshots. Everything is
 * inlined (rigs, scenes, font, player script) so the page has no network
 * dependencies and renders identically everywhere.
 */

const ROOT = path.resolve(__dirname, "../..");
export const CHARACTERS_DIR = path.join(ROOT, "assets", "characters");
export const FONT_PATH = path.join(ROOT, "assets", "fonts", "Fredoka-Bold.woff2");
const PLAYER_PATH = path.join(__dirname, "browser", "player.js");

function stripXmlHeader(svg: string): string {
  return svg.replace(/<\?xml[^>]*>/, "").replace(/<!--[\s\S]*?-->/g, "");
}

export async function loadRig(name: string): Promise<string> {
  const svg = await readFile(path.join(CHARACTERS_DIR, `${name}.svg`), "utf8");
  // Give the template a stable id and hide it; the player clones its <g id="rig">.
  return stripXmlHeader(svg).replace("<svg ", `<svg id="tpl-${name}" `);
}

export async function buildPageHtml(): Promise<string> {
  const [crow, hedgehog, player] = await Promise.all([
    loadRig("crow"),
    loadRig("hedgehog"),
    readFile(PLAYER_PATH, "utf8"),
  ]);
  let fontFace = "";
  try {
    const font = await readFile(FONT_PATH);
    fontFace = `@font-face { font-family: "Fredoka"; font-weight: 700; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); }`;
  } catch {
    /* fall back to system sans */
  }
  const scenes = Object.values(SCENES)
    .map((fn) => fn().replace(/<g id="scene-(\w+)">/, '<g id="scene-$1" display="none">'))
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
${fontFace}
html, body { margin: 0; padding: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #F4E4C1; }
body { position: relative; font-family: "Fredoka", "Nunito", "Arial Rounded MT Bold", sans-serif; }
#stage { position: absolute; left: 0; top: 0; }
#rig-templates { position: absolute; left: -9999px; top: -9999px; width: 0; height: 0; overflow: hidden; }
#title-card { position: absolute; left: 70px; top: 230px; width: 940px; box-sizing: border-box; padding: 44px 48px 52px;
  background: #FFF6DF; border: 12px solid #1B1510; border-radius: 34px; box-shadow: 14px 14px 0 #1B1510;
  transform-origin: 50% 50%; display: none; }
#title-card.cover { top: 210px; padding: 54px 52px 62px; }
#title-badge { display: inline-block; background: #C0503A; color: #FFF6DF; font-weight: 700; font-size: 38px; padding: 8px 26px;
  border-radius: 999px; border: 6px solid #1B1510; margin-bottom: 20px; letter-spacing: 0.5px; }
#title-text { font-weight: 700; font-size: 84px; line-height: 1.08; color: #1B1510; }
#title-card.cover #title-text { font-size: 96px; }
#captions { position: absolute; left: 60px; top: 690px; width: 858px; text-align: center; display: none;
  font-weight: 700; font-size: 72px; line-height: 1.12; color: #FFFFFF;
  -webkit-text-stroke: 10px #1B1510; paint-order: stroke fill; text-shadow: 6px 8px 0 rgba(27,21,16,0.55);
  text-transform: uppercase; letter-spacing: 1px; }
#captions .w { display: inline-block; padding: 0 4px; transition: none; transform-origin: 50% 70%; }
#captions .w.active { color: #FFD400; transform: scale(1.12) rotate(-2deg); }
#watermark { position: absolute; left: 60px; top: 1500px; font-size: 30px; font-weight: 700; color: rgba(27,21,16,0.55); display: none; }
</style></head>
<body>
<div id="rig-templates">${crow}${hedgehog}</div>
<svg id="stage" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs></defs>
  <g id="camera">
    <g id="scenes">${scenes}</g>
    <g id="characters"></g>
    ${propsLayer()}
  </g>
  <g id="fx">
    <path id="iris" d="" fill="#1B1510" fill-rule="evenodd" display="none"/>
    <!-- Paper grain + vignette are baked into one bitmap at setup (see player.js
         makeFilmOverlay) because live feTurbulence costs ~70 ms per frame. -->
    <image id="film" x="-200" y="-200" width="${W + 400}" height="${H + 400}" opacity="1"/>
    <rect id="flicker" width="${W}" height="${H}" fill="#1B1510" opacity="0.03"/>
    <line id="scratch" x1="300" y1="0" x2="302" y2="${H}" stroke="#1B1510" stroke-width="2" opacity="0.28" display="none"/>
  </g>
</svg>
<div id="title-card"><div id="title-badge">r/</div><div id="title-text"></div></div>
<div id="captions"></div>
<div id="watermark"></div>
<script>${player}</script>
</body></html>`;
}
