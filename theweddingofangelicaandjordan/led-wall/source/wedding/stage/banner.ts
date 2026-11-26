import type { Theme } from "./theme";

// The thank-you banner (round 40, 2026-11-26; the user: "yung piggyback pwede kayang may parang banner na nakadikit kay
// ange like parang baloon string tapos banner ang nakalagay "THANK YOU FOR CELEBRATING WITH US""): a cloth banner flying
// behind the piggyback run like a balloon on a string. The string goes up and back from Ange's fist (the bouquet's
// stem) to a knot; two short bridle lines run from the knot to a rod along the banner's front edge; the cloth trails
// behind with a wave running down it and a swallow-tailed end. Drawn on the runner's canvas and never mirrored: on the
// way back the run is mirrored, and the banner only moves to their other side, so its words always read. The theme's
// colours: an ivory cloth, gold trim and deep green letters on the green theme; a sage cloth with ivory letters on beige
// and white. Every size is a part of the screen's height (U).

type Look = { cloth: [string, string]; trim: string; text: [string, string]; rod: string; string: string; shadow: string };
const SAGE: Look = {
  cloth: ["#89A480", "#6E8B66"],
  trim: "rgba(255,250,236,.8)",
  text: ["#FFFDF6", "#FBF7EC"],
  rod: "#B8955A",
  string: "#5E7958",
  shadow: "rgba(70,80,55,.22)",
};
const LOOK: Record<Theme, Look> = {
  green: {
    cloth: ["#FFFAEE", "#F2E4C4"],
    trim: "#C9A45A",
    text: ["#1D3A28", "#2C4D37"],
    rod: "#D7B46A",
    string: "#F1E4C3",
    shadow: "rgba(0,0,0,.35)",
  },
  beige: SAGE,
  white: SAGE,
};

// the letters: the first line big in the page's Cormorant Garamond, the rest smaller in the date's Jost, both capitals
// (all × U)
const BIG = 0.056;
const SMALL = 0.031;
const FONTS = [`600 ${BIG}px 'Cormorant Garamond'`, `400 ${SMALL}px Jost`];
const PAD_X = 0.045;
const PAD_Y = 0.03;
const GAP = 0.022; // between the lines' capitals
const NOTCH = 0.034; // the swallow tail's depth
const TRIM_IN = 0.011;
const MARGIN = 0.03; // round the cloth in the picture, for its shadow
// how it flies (× U): the knot behind and above her fist, the rod behind the knot
const BACK = 0.085;
const UP = 0.075;
const BRIDLE = 0.03;

export type BannerArt = {
  img: HTMLCanvasElement;
  dpr: number;
  w: number; // the cloth (CSS px), tail to rod
  h: number;
  m: number; // the picture's margin round it
  front: 1 | -1; // the rod's end: 1 = the right (running right), -1 = the left
  look: Look;
};

// the fonts are in the page (embedded); wait for them before drawing the letters
export const bannerFonts = () => Promise.all(FONTS.map((f) => document.fonts.load(f.replace(/[\d.]+px/, "40px")))).catch(() => []);

// the cloth with its letters, flat, its rod at the `front` end (the wave and the shading are added when it's drawn)
export const makeBanner = (lines: string[], theme: Theme, U: number, front: 1 | -1, dpr: number): BannerArt => {
  const look = LOOK[theme];
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = (i: number) => (i === 0 ? `600 ${BIG * U}px 'Cormorant Garamond', Georgia, serif` : `400 ${SMALL * U}px Jost, 'Helvetica Neue', Arial, sans-serif`);
  const spacing = (i: number) => (i === 0 ? 0.06 * BIG * U : 0.16 * SMALL * U);
  const measure = lines.map((text, i) => {
    ctx.font = font(i);
    ctx.letterSpacing = `${spacing(i)}px`;
    const mt = ctx.measureText(text);
    const cap = ctx.measureText("H").actualBoundingBoxAscent;
    return { text, width: mt.width - spacing(i), cap };
  });
  const notch = NOTCH * U;
  const w = Math.ceil(Math.max(...measure.map((l) => l.width)) + 2 * PAD_X * U + notch / 2);
  const h = Math.ceil(2 * PAD_Y * U + measure.reduce((a, l) => a + l.cap, 0) + GAP * U * (lines.length - 1));
  const m = Math.ceil(MARGIN * U);
  c.width = Math.ceil((w + 2 * m) * dpr);
  c.height = Math.ceil((h + 2 * m) * dpr);
  ctx.scale(dpr, dpr);
  ctx.translate(m, m);
  // the outline: the tail's notch at the end away from the rod
  const tail = front > 0 ? 0 : w;
  const inward = front > 0 ? 1 : -1;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(tail, 0);
    ctx.lineTo(w - tail, 0);
    ctx.lineTo(w - tail, h);
    ctx.lineTo(tail, h);
    ctx.lineTo(tail + inward * notch, h / 2);
    ctx.closePath();
  };
  const cloth = ctx.createLinearGradient(0, 0, 0, h);
  cloth.addColorStop(0, look.cloth[0]);
  cloth.addColorStop(1, look.cloth[1]);
  ctx.save();
  ctx.shadowColor = look.shadow;
  ctx.shadowBlur = 0.014 * U * dpr;
  ctx.shadowOffsetY = 0.006 * U * dpr;
  shape();
  ctx.fillStyle = cloth;
  ctx.fill();
  ctx.restore();
  // the trim: a fine line along the top and the bottom, in from the edges
  const ti = TRIM_IN * U;
  const tipAt = (y: number) => tail + inward * notch * (1 - Math.abs(y - h / 2) / (h / 2));
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = Math.max(1, 0.0035 * U);
  for (const y of [ti, h - ti]) {
    ctx.beginPath();
    ctx.moveTo(tipAt(y) + inward * ti, y);
    ctx.lineTo(w - tail - inward * ti, y);
    ctx.stroke();
  }
  // the letters, centred on the cloth past the notch
  const cx = front > 0 ? (notch / 2 + w) / 2 : (w - notch / 2) / 2;
  let y = PAD_Y * U;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  measure.forEach((l, i) => {
    y += l.cap;
    ctx.font = font(i);
    ctx.letterSpacing = `${spacing(i)}px`;
    ctx.fillStyle = look.text[Math.min(i, 1)];
    // (the spacing comes after every letter, the last one too: half of it back so the line sits in the middle)
    ctx.fillText(l.text, cx + spacing(i) / 2, y);
    y += GAP * U;
  });
  return { img: c, dpr, w, h, m, front, look };
};

// how far behind her fist the banner reaches (CSS px), for when they've gone
export const bannerReach = (art: BannerArt, U: number) => (BACK + BRIDLE + 0.01) * U + art.w + art.m;

// the banner flying at time t (s) behind the fist: `hand` = the fist now (the string's end), `rest` = the fist's
// middle place over the stride (the knot follows that, not every bob of the stride); `dir` = 1 running right, -1 left
export const drawBanner = (ctx: CanvasRenderingContext2D, art: BannerArt, hand: readonly number[], rest: readonly number[], dir: 1 | -1, t: number, U: number) => {
  const { img, dpr, w, h, m, look } = art;
  // the knot: behind and above the fist, bobbing like a balloon
  const kx = rest[0] - dir * BACK * U + 0.005 * U * Math.sin(2 * Math.PI * 0.31 * t + 1);
  const ky = rest[1] - UP * U + 0.007 * U * Math.sin(2 * Math.PI * 0.55 * t);
  const rodX = kx - dir * BRIDLE * U;
  const top = ky - h / 2;
  const left = dir > 0 ? rodX - w : rodX;
  // the wave: nothing at the rod, growing towards the tail, running back along the cloth
  const A = 0.011 * U;
  const L = 0.5 * w;
  const wave = (s: number) => {
    const q = Math.max(0, Math.min(1, s / w));
    const ph = 2 * Math.PI * (1.3 * t - s / L);
    const ph2 = 2 * Math.PI * (1.9 * t - s / (0.3 * w));
    return { dy: A * q ** 1.1 * (Math.sin(ph) + 0.3 * Math.sin(ph2)), slope: A * q ** 1.1 * ((2 * Math.PI) / L) * Math.cos(ph) };
  };
  const SW = 3;
  const full = w + 2 * m;
  const n = Math.ceil(full / SW);
  const at: { x: number; y: number; sw: number; slope: number }[] = [];
  for (let i = 0; i < n; i++) {
    const lx = i * SW;
    const sw = Math.min(SW, full - lx);
    // (the slice's distance from the rod)
    const s = dir > 0 ? m + w - (lx + sw / 2) : lx + sw / 2 - m;
    const { dy, slope } = wave(s);
    const x = left - m + lx;
    const y = top - m + dy;
    ctx.drawImage(img, lx * dpr, 0, sw * dpr, img.height, x, y, sw + 0.6, h + 2 * m);
    at.push({ x, y, sw, slope });
  }
  // the folds' light and shade, on the cloth only
  ctx.globalCompositeOperation = "source-atop";
  for (const { x, y, sw, slope } of at) {
    const a = Math.min(0.12, Math.abs(slope) * 0.55);
    if (a < 0.01) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = slope > 0 ? "#000" : "#fff";
    ctx.fillRect(x, y, sw + 0.6, h + 2 * m);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  // the rod along the front edge, the bridle from its ends to the knot, the string down to her fist (a little slack)
  const rt = ky - h / 2 - 0.008 * U;
  const rb = ky + h / 2 + 0.008 * U;
  ctx.lineCap = "round";
  ctx.strokeStyle = look.rod;
  ctx.lineWidth = 0.0055 * U;
  ctx.beginPath();
  ctx.moveTo(rodX, rt);
  ctx.lineTo(rodX, rb);
  ctx.stroke();
  ctx.strokeStyle = look.string;
  ctx.lineWidth = Math.max(1, 0.0016 * U);
  ctx.beginPath();
  ctx.moveTo(rodX, rt + 0.004 * U);
  ctx.lineTo(kx, ky);
  ctx.lineTo(rodX, rb - 0.004 * U);
  ctx.moveTo(kx, ky);
  ctx.quadraticCurveTo((kx + hand[0]) / 2, (ky + hand[1]) / 2 + 0.012 * U, hand[0], hand[1]);
  ctx.stroke();
  ctx.fillStyle = look.string;
  ctx.beginPath();
  ctx.arc(kx, ky, 0.0028 * U, 0, 2 * Math.PI);
  ctx.fill();
};
