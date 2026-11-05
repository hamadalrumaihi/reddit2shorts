/**
 * Flat, warm, thick-outlined scene art for the animated shorts, as SVG
 * strings. Every scene fills 1080x1920 with the ground line at GROUND_Y so
 * characters stand on the same floor; props get ids the browser player moves.
 */

export const W = 1080;
export const H = 1920;
export const GROUND_Y = 1460;

export const PALETTE = {
  ink: "#1B1510",
  paper: "#F4E4C1",
  cream: "#F7E6C8",
  mustard: "#E0A526",
  brick: "#C0503A",
  teal: "#4F8A8B",
  brown: "#6B4A2B",
  wood: "#B97A4B",
  sky: "#9CD3E6",
  sun: "#FFD166",
  grey: "#6E6A66",
  slate: "#3E3D4A",
  sand: "#D9CBB0",
  leaf: "#7FA65A",
};

const INK = `stroke="${PALETTE.ink}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"`;
const INK_THIN = `stroke="${PALETTE.ink}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

function floor(fill: string, extra = ""): string {
  return `<rect x="0" y="${GROUND_Y}" width="${W}" height="${H - GROUND_Y}" fill="${fill}"/>
  <line x1="0" y1="${GROUND_Y}" x2="${W}" y2="${GROUND_Y}" ${INK}/>${extra}`;
}

function windowFrame(x: number, y: number, w: number, h: number, inner: string, frame = PALETTE.brown): string {
  return `<g>
    <rect x="${x - 18}" y="${y - 18}" width="${w + 36}" height="${h + 36}" fill="${frame}" ${INK}/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PALETTE.sky}" ${INK}/>
    ${inner}
    <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" ${INK}/>
    <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" ${INK}/>
  </g>`;
}

export function houseScene(): string {
  const stripes = Array.from({ length: 13 }, (_, i) => `<rect x="${i * 90 + 20}" y="0" width="38" height="${GROUND_Y}" fill="#F2D7A4"/>`).join("");
  const planks = Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${GROUND_Y + 60 * (i + 1)}" x2="${W}" y2="${GROUND_Y + 60 * (i + 1)}" ${INK_THIN} opacity="0.5"/>`).join("");
  return `<g id="scene-house">
    <rect width="${W}" height="${GROUND_Y}" fill="#EBC98F"/>${stripes}
    ${windowFrame(130, 400, 380, 440, `<circle cx="420" cy="500" r="54" fill="${PALETTE.sun}" ${INK}/><ellipse cx="240" cy="640" rx="90" ry="34" fill="#FFFDF5" ${INK_THIN}/>`)}
    <path d="M100 380 Q 150 640 100 860 L 160 860 Q 200 640 170 380 Z" fill="${PALETTE.brick}" ${INK}/>
    <path d="M540 380 Q 490 640 540 860 L 480 860 Q 440 640 470 380 Z" fill="${PALETTE.brick}" ${INK}/>
    <g>
      <rect x="640" y="440" width="260" height="210" fill="${PALETTE.brown}" ${INK}/>
      <rect x="668" y="468" width="204" height="154" fill="${PALETTE.sky}" ${INK_THIN}/>
      <path d="M668 622 Q 740 520 800 580 Q 840 540 872 600 L 872 622 Z" fill="${PALETTE.leaf}"/>
      <circle cx="840" cy="500" r="20" fill="${PALETTE.sun}"/>
    </g>
    <g id="couch">
      <rect x="600" y="${GROUND_Y - 240}" width="440" height="200" rx="30" fill="${PALETTE.teal}" ${INK}/>
      <rect x="640" y="${GROUND_Y - 170}" width="170" height="110" rx="20" fill="#5FA3A4" ${INK}/>
      <rect x="830" y="${GROUND_Y - 170}" width="170" height="110" rx="20" fill="#5FA3A4" ${INK}/>
      <rect x="580" y="${GROUND_Y - 190}" width="60" height="190" rx="24" fill="${PALETTE.teal}" ${INK}/>
      <rect x="1000" y="${GROUND_Y - 190}" width="60" height="190" rx="24" fill="${PALETTE.teal}" ${INK}/>
      <rect x="620" y="${GROUND_Y - 300}" width="400" height="80" rx="24" fill="${PALETTE.teal}" ${INK}/>
    </g>
    <g id="lamp">
      <rect x="880" y="${GROUND_Y - 760}" width="18" height="420" fill="${PALETTE.brown}" ${INK_THIN}/>
      <path d="M800 ${GROUND_Y - 760} L 978 ${GROUND_Y - 760} L 1010 ${GROUND_Y - 640} L 768 ${GROUND_Y - 640} Z" fill="${PALETTE.mustard}" ${INK}/>
    </g>
    <rect x="0" y="${GROUND_Y - 44}" width="${W}" height="44" fill="#8E5A33" ${INK}/>
    ${floor(PALETTE.wood, planks)}
    <ellipse cx="420" cy="${GROUND_Y + 200}" rx="420" ry="110" fill="${PALETTE.brick}" ${INK}/>
    <ellipse cx="420" cy="${GROUND_Y + 200}" rx="330" ry="78" fill="none" stroke="${PALETTE.mustard}" stroke-width="12"/>
  </g>`;
}

export function officeScene(): string {
  const slats = Array.from({ length: 9 }, (_, i) => `<rect x="110" y="${400 + i * 48}" width="400" height="22" fill="#FFFDF5" ${INK_THIN}/>`).join("");
  const tiles = Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${GROUND_Y + 76 * (i + 1)}" x2="${W}" y2="${GROUND_Y + 76 * (i + 1)}" ${INK_THIN} opacity="0.45"/>`).join("") +
    Array.from({ length: 8 }, (_, i) => `<line x1="${i * 150}" y1="${GROUND_Y}" x2="${i * 150 - 120}" y2="${H}" ${INK_THIN} opacity="0.3"/>`).join("");
  return `<g id="scene-office">
    <rect width="${W}" height="${GROUND_Y}" fill="#CFD8C4"/>
    <rect x="0" y="${GROUND_Y - 420}" width="${W}" height="420" fill="#B9C4AF"/>
    <line x1="0" y1="${GROUND_Y - 420}" x2="${W}" y2="${GROUND_Y - 420}" ${INK}/>
    <g>
      <rect x="92" y="382" width="436" height="480" fill="${PALETTE.sky}" ${INK}/>${slats}
      <line x1="310" y1="372" x2="310" y2="394" ${INK}/>
    </g>
    <g id="clock">
      <circle cx="820" cy="360" r="90" fill="#FFFDF5" ${INK}/>
      <line x1="820" y1="360" x2="820" y2="300" ${INK}/>
      <line x1="820" y1="360" x2="862" y2="384" ${INK}/>
      <circle cx="820" cy="360" r="8" fill="${PALETTE.ink}"/>
    </g>
    <g id="cabinet">
      <rect x="60" y="${GROUND_Y - 440}" width="220" height="440" fill="${PALETTE.grey}" ${INK}/>
      <rect x="86" y="${GROUND_Y - 400}" width="168" height="110" fill="#858079" ${INK_THIN}/>
      <rect x="86" y="${GROUND_Y - 270}" width="168" height="110" fill="#858079" ${INK_THIN}/>
      <rect x="86" y="${GROUND_Y - 140}" width="168" height="110" fill="#858079" ${INK_THIN}/>
      <rect x="150" y="${GROUND_Y - 356}" width="40" height="16" fill="${PALETTE.mustard}" ${INK_THIN}/>
      <rect x="150" y="${GROUND_Y - 226}" width="40" height="16" fill="${PALETTE.mustard}" ${INK_THIN}/>
      <rect x="150" y="${GROUND_Y - 96}" width="40" height="16" fill="${PALETTE.mustard}" ${INK_THIN}/>
    </g>
    <g id="desk">
      <rect x="600" y="${GROUND_Y - 300}" width="460" height="40" fill="${PALETTE.brown}" ${INK}/>
      <rect x="640" y="${GROUND_Y - 260}" width="60" height="260" fill="${PALETTE.brown}" ${INK}/>
      <rect x="960" y="${GROUND_Y - 260}" width="60" height="260" fill="${PALETTE.brown}" ${INK}/>
      <rect x="700" y="${GROUND_Y - 520}" width="260" height="200" rx="14" fill="${PALETTE.slate}" ${INK}/>
      <rect x="724" y="${GROUND_Y - 496}" width="212" height="150" fill="#9CD3E6" ${INK_THIN}/>
      <rect x="800" y="${GROUND_Y - 320}" width="60" height="22" fill="${PALETTE.slate}" ${INK_THIN}/>
      <rect x="620" y="${GROUND_Y - 330}" width="120" height="30" fill="#FFFDF5" ${INK_THIN}/>
      <path d="M980 ${GROUND_Y - 360} h 56 v 60 h -56 z" fill="${PALETTE.brick}" ${INK_THIN}/>
    </g>
    <g id="plant">
      <rect x="470" y="${GROUND_Y - 150}" width="110" height="150" fill="${PALETTE.brick}" ${INK}/>
      <path d="M525 ${GROUND_Y - 150} Q 440 ${GROUND_Y - 280} 500 ${GROUND_Y - 380} Q 540 ${GROUND_Y - 280} 525 ${GROUND_Y - 150} Z" fill="${PALETTE.leaf}" ${INK}/>
      <path d="M525 ${GROUND_Y - 150} Q 600 ${GROUND_Y - 280} 560 ${GROUND_Y - 360} Q 520 ${GROUND_Y - 260} 525 ${GROUND_Y - 150} Z" fill="${PALETTE.leaf}" ${INK}/>
    </g>
    ${floor("#B8B4AA", tiles)}
  </g>`;
}

export function streetScene(): string {
  const windows = (x: number, y: number, w: number, h: number, cols: number, rows: number, color: string) => {
    let out = "";
    const cw = (w - 40) / cols;
    const rh = (h - 40) / rows;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++)
        out += `<rect x="${x + 20 + c * cw + 10}" y="${y + 20 + r * rh + 10}" width="${cw - 20}" height="${rh - 20}" fill="${color}" ${INK_THIN}/>`;
    return out;
  };
  const sidewalkTiles = Array.from({ length: 10 }, (_, i) => `<line x1="${i * 120}" y1="${GROUND_Y - 160}" x2="${i * 120 - 30}" y2="${GROUND_Y}" ${INK_THIN} opacity="0.4"/>`).join("");
  const dashes = Array.from({ length: 6 }, (_, i) => `<rect x="${i * 200 + 40}" y="${GROUND_Y + 220}" width="110" height="18" fill="${PALETTE.sun}"/>`).join("");
  return `<g id="scene-street">
    <rect width="${W}" height="${GROUND_Y}" fill="${PALETTE.sky}"/>
    <circle cx="860" cy="300" r="110" fill="${PALETTE.sun}" ${INK}/>
    <g id="clouds">
      <g><ellipse cx="240" cy="340" rx="140" ry="60" fill="#FFFDF5" ${INK}/><ellipse cx="300" cy="300" rx="90" ry="60" fill="#FFFDF5" ${INK}/><ellipse cx="190" cy="310" rx="70" ry="50" fill="#FFFDF5" ${INK}/><ellipse cx="240" cy="345" rx="140" ry="55" fill="#FFFDF5"/></g>
      <g><ellipse cx="640" cy="560" rx="110" ry="46" fill="#FFFDF5" ${INK}/><ellipse cx="680" cy="530" rx="70" ry="46" fill="#FFFDF5" ${INK}/><ellipse cx="640" cy="565" rx="110" ry="42" fill="#FFFDF5"/></g>
    </g>
    <g id="buildings">
      <rect x="-20" y="760" width="300" height="${GROUND_Y - 160 - 760}" fill="${PALETTE.brick}" ${INK}/>${windows(-20, 760, 300, 540, 2, 4, PALETTE.sun)}
      <rect x="260" y="640" width="320" height="${GROUND_Y - 160 - 640}" fill="${PALETTE.sand}" ${INK}/>${windows(260, 640, 320, 660, 3, 5, PALETTE.sky)}
      <rect x="560" y="820" width="260" height="${GROUND_Y - 160 - 820}" fill="${PALETTE.mustard}" ${INK}/>${windows(560, 820, 260, 480, 2, 3, PALETTE.sky)}
      <rect x="800" y="700" width="320" height="${GROUND_Y - 160 - 700}" fill="#7FA3B0" ${INK}/>${windows(800, 700, 320, 600, 3, 4, PALETTE.sun)}
      <path d="M560 ${GROUND_Y - 330} L 840 ${GROUND_Y - 330} L 810 ${GROUND_Y - 260} L 590 ${GROUND_Y - 260} Z" fill="${PALETTE.brick}" ${INK}/>
      <rect x="620" y="${GROUND_Y - 260}" width="140" height="100" fill="${PALETTE.brown}" ${INK}/>
    </g>
    <g id="lamppost">
      <rect x="960" y="${GROUND_Y - 620}" width="22" height="620" fill="${PALETTE.slate}" ${INK_THIN}/>
      <path d="M930 ${GROUND_Y - 620} h 82 l -14 -70 h -54 z" fill="${PALETTE.slate}" ${INK}/>
      <rect x="946" y="${GROUND_Y - 690}" width="50" height="40" fill="${PALETTE.sun}" ${INK_THIN}/>
    </g>
    <g id="hydrant">
      <rect x="110" y="${GROUND_Y - 150}" width="80" height="150" rx="20" fill="${PALETTE.brick}" ${INK}/>
      <rect x="90" y="${GROUND_Y - 110}" width="120" height="28" rx="10" fill="${PALETTE.brick}" ${INK}/>
      <ellipse cx="150" cy="${GROUND_Y - 150}" rx="30" ry="18" fill="${PALETTE.brick}" ${INK}/>
    </g>
    <rect x="0" y="${GROUND_Y - 160}" width="${W}" height="160" fill="${PALETTE.sand}"/>
    <line x1="0" y1="${GROUND_Y - 160}" x2="${W}" y2="${GROUND_Y - 160}" ${INK}/>${sidewalkTiles}
    ${floor(PALETTE.grey, dashes)}
  </g>`;
}

export function kitchenScene(): string {
  const grid =
    Array.from({ length: 10 }, (_, i) => `<line x1="${i * 120}" y1="0" x2="${i * 120}" y2="${GROUND_Y}" stroke="#E3C89A" stroke-width="6"/>`).join("") +
    Array.from({ length: 13 }, (_, i) => `<line x1="0" y1="${i * 120}" x2="${W}" y2="${i * 120}" stroke="#E3C89A" stroke-width="6"/>`).join("");
  const checker = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 10 }, (_, c) => ((r + c) % 2 === 0 ? `<rect x="${c * 120 - 60}" y="${GROUND_Y + r * 60}" width="120" height="60" fill="#E8D7B4"/>` : "")).join("")
  ).join("");
  const cupboards = Array.from({ length: 4 }, (_, i) => `<rect x="${100 + i * 220}" y="300" width="200" height="240" fill="${PALETTE.mustard}" ${INK}/><rect x="${180 + i * 220}" y="470" width="40" height="14" rx="6" fill="${PALETTE.brown}" ${INK_THIN}/>`).join("");
  return `<g id="scene-kitchen">
    <rect width="${W}" height="${GROUND_Y}" fill="${PALETTE.cream}"/>${grid}
    ${cupboards}
    <g id="fridge">
      <rect x="60" y="${GROUND_Y - 720}" width="250" height="720" rx="20" fill="#DDE5E8" ${INK}/>
      <line x1="60" y1="${GROUND_Y - 460}" x2="310" y2="${GROUND_Y - 460}" ${INK}/>
      <rect x="260" y="${GROUND_Y - 640}" width="20" height="120" rx="8" fill="${PALETTE.slate}" ${INK_THIN}/>
      <rect x="260" y="${GROUND_Y - 420}" width="20" height="160" rx="8" fill="${PALETTE.slate}" ${INK_THIN}/>
      <rect x="100" y="${GROUND_Y - 680}" width="90" height="70" fill="#FFFDF5" ${INK_THIN}/>
    </g>
    <g id="counter">
      <rect x="360" y="${GROUND_Y - 330}" width="720" height="330" fill="${PALETTE.brick}" ${INK}/>
      <rect x="340" y="${GROUND_Y - 360}" width="760" height="50" fill="${PALETTE.sand}" ${INK}/>
      <rect x="400" y="${GROUND_Y - 260}" width="220" height="200" fill="#A8432F" ${INK_THIN}/>
      <rect x="660" y="${GROUND_Y - 260}" width="220" height="200" fill="#A8432F" ${INK_THIN}/>
      <circle cx="610" cy="${GROUND_Y - 160}" r="12" fill="${PALETTE.mustard}" ${INK_THIN}/>
      <circle cx="670" cy="${GROUND_Y - 160}" r="12" fill="${PALETTE.mustard}" ${INK_THIN}/>
    </g>
    <g id="stove">
      <rect x="560" y="${GROUND_Y - 400}" width="300" height="50" fill="${PALETTE.slate}" ${INK}/>
      <ellipse cx="640" cy="${GROUND_Y - 400}" rx="60" ry="18" fill="#1B1510"/>
      <ellipse cx="790" cy="${GROUND_Y - 400}" rx="60" ry="18" fill="#1B1510"/>
      <g id="pot">
        <rect x="580" y="${GROUND_Y - 520}" width="150" height="120" rx="10" fill="${PALETTE.slate}" ${INK}/>
        <rect x="560" y="${GROUND_Y - 540}" width="190" height="30" rx="10" fill="${PALETTE.slate}" ${INK}/>
        <g id="steam">
          <path d="M620 ${GROUND_Y - 560} q 20 -40 0 -80 q -20 -40 0 -80" fill="none" ${INK_THIN} opacity="0.6"/>
          <path d="M680 ${GROUND_Y - 560} q 20 -40 0 -80 q -20 -40 0 -80" fill="none" ${INK_THIN} opacity="0.6"/>
        </g>
      </g>
    </g>
    <g id="pan">
      <circle cx="960" cy="640" r="60" fill="${PALETTE.slate}" ${INK}/>
      <rect x="900" y="540" width="24" height="110" transform="rotate(35 912 595)" fill="${PALETTE.brown}" ${INK_THIN}/>
    </g>
    ${floor(PALETTE.wood, checker)}
  </g>`;
}

export const SCENES: Record<string, () => string> = {
  house: houseScene,
  office: officeScene,
  street: streetScene,
  kitchen: kitchenScene,
};

/** Props the player animates; each gets a stable id. Hidden until used. */
export function propsLayer(): string {
  return `<g id="props">
    <g id="door" display="none">
      <rect x="40" y="${GROUND_Y - 640}" width="300" height="640" fill="${PALETTE.brown}" ${INK}/>
      <g id="door-panel" data-pivot="60,${GROUND_Y - 320}">
        <rect x="60" y="${GROUND_Y - 620}" width="260" height="620" fill="${PALETTE.mustard}" ${INK}/>
        <rect x="90" y="${GROUND_Y - 580}" width="200" height="220" fill="none" ${INK_THIN}/>
        <rect x="90" y="${GROUND_Y - 320}" width="200" height="270" fill="none" ${INK_THIN}/>
        <circle cx="290" cy="${GROUND_Y - 330}" r="16" fill="${PALETTE.slate}" ${INK_THIN}/>
      </g>
    </g>
    <g id="anvil" display="none">
      <path d="M-120 -40 L 120 -40 L 100 10 L 40 10 L 50 60 L -60 60 L -50 10 L -100 10 L -140 -10 Z" fill="${PALETTE.slate}" ${INK}/>
      <path d="M-100 -30 L 100 -30 L 90 -12 L -90 -12 Z" fill="#5A5970"/>
      <text x="-2" y="48" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="30" font-weight="700" fill="#FFFDF5">1 TON</text>
    </g>
    <g id="stars" display="none">
      ${[0, 1, 2].map((i) => `<path id="star-${i}" d="M0 -26 L 8 -8 L 27 -8 L 12 4 L 18 22 L 0 11 L -18 22 L -12 4 L -27 -8 L -8 -8 Z" fill="${PALETTE.sun}" ${INK_THIN}/>`).join("")}
    </g>
    <g id="sweat" display="none">
      ${[0, 1, 2].map((i) => `<path id="drop-${i}" d="M0 -22 C 8 -8 14 0 14 8 A 14 14 0 1 1 -14 8 C -14 0 -8 -8 0 -22 Z" fill="${PALETTE.sky}" ${INK_THIN}/>`).join("")}
    </g>
    <g id="dust" display="none">
      ${[0, 1, 2, 3].map((i) => `<circle id="dust-${i}" r="28" fill="#F7E6C8" ${INK_THIN}/>`).join("")}
    </g>
    <g id="emanata" display="none">
      ${Array.from({ length: 10 }, (_, i) => `<line x1="0" y1="-120" x2="0" y2="-170" transform="rotate(${i * 36})" ${INK}/>`).join("")}
    </g>
    <g id="shock-mark" display="none">
      <text x="0" y="0" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="150" font-weight="700" fill="${PALETTE.brick}" stroke="${PALETTE.ink}" stroke-width="10" paint-order="stroke">!</text>
    </g>
  </g>`;
}
