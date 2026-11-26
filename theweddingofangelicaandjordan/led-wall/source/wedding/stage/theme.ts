// The colour themes (round 32, 2026-11-25; the user: "can you make an switch version? like press S to switch version it
// will goes to white sage green … white backgroun or beige then green the monogram"). S on the stage goes round them:
//   green   the stage as it was: the gold monogram on dark green
//   beige   the monogram in sage green on a warm beige, champagne-gold sparkle
//   white   the same sage on white
// The page's own colours (background, florals, the date) are CSS on body[data-theme] (index.html); the monogram's ink and
// glow (monogram.ts) and the bokeh (bokeh.ts) take the palette below. ?theme=beige in the address opens on one.
export const THEMES = ["green", "beige", "white"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_NAMES: Record<Theme, string> = { green: "Gold on green", beige: "Sage on beige", white: "Sage on white" };
export const asTheme = (v: string | null | undefined) => ((THEMES as readonly string[]).includes(v ?? "") ? (v as Theme) : null);
export const isLight = (t: Theme) => t !== "green";

type RGB = readonly [number, number, number];
// the monogram: its ink gradient (lighter top-left), the glow canvas's shadows [blur px, colour] (drawn in order)
export const INK: Record<Theme, { stops: [string, string, string]; shadows: [number, string][] }> = {
  green: {
    stops: ["#FFF7DC", "#FEEDC4", "#F4D9A6"],
    shadows: [[6, "rgba(240,220,170,.42)"], [18, "rgba(232,207,160,.35)"], [45, "rgba(220,190,130,.25)"], [80, "rgba(200,170,100,.14)"]],
  },
  // on a light ground a glow can't be light on light: a soft white halo lifts it off the beige, a faint sage shadow
  // close in gives the strokes their edge
  beige: {
    stops: ["#93AB8B", "#7A9672", "#62805C"],
    shadows: [[70, "rgba(255,253,246,.7)"], [32, "rgba(255,252,242,.6)"], [14, "rgba(98,128,92,.16)"], [4, "rgba(80,108,74,.2)"]],
  },
  white: {
    stops: ["#93AB8B", "#7A9672", "#62805C"],
    shadows: [[22, "rgba(110,140,104,.12)"], [8, "rgba(98,128,92,.14)"], [3, "rgba(80,108,74,.18)"]],
  },
};

// the bokeh: the same particles, their colours + how they blend. On green they ADD light (gold on dark); on a light
// ground added light vanishes, so they're laid on normally, in sage green (round 33), fainter
export type Palette = {
  add: boolean;
  col: RGB[]; // dust, glows, twinkles
  bokeh: RGB[]; // the lens discs, behind + in front
  glitter: RGB[]; // sparkle stars, glitter dust, the pens' glitter, the heart's burst
  pen: number; // the pens' glow
  flash: number; // the heart's flash + its streak
  ghost: number[]; // the lens flare's ghosts
  a: { far: number; mid: number; disc: number; near: number; dust: number; star: number; ghost: number; pen: number; flash: number };
};
const GOLD: Palette = {
  add: true,
  col: [[232, 207, 160], [220, 195, 140], [240, 225, 190], [245, 235, 205], [255, 245, 215]],
  bokeh: [[218, 175, 82], [205, 160, 65], [230, 185, 90], [200, 150, 55], [215, 168, 72], [225, 178, 68]],
  glitter: [[255, 236, 190], [255, 246, 222], [246, 214, 140], [255, 225, 160]],
  pen: 0xffe2a8,
  flash: 0xffe6b0,
  ghost: [0xffe0a0, 0xffc890, 0xfff0c8, 0xe8b870, 0xffd6a0, 0xf2c48a, 0xffe6b8],
  a: { far: 1, mid: 1, disc: 1, near: 1, dust: 1, star: 1, ghost: 1, pen: 1, flash: 1 },
};
// Round 33 (2026-11-25; the user: "the bokeh and flare should change din if sage green sa beige and white"): on the
// light themes the bokeh, the flare's ghosts, the dust + the sparkles are sage green too (round 32 had them champagne
// gold + white: they read as the green theme's gold). Light sage discs, deeper sage sparkles so they show on the ground
const SAGE_ON_BEIGE: Palette = {
  add: false,
  col: [[150, 174, 140], [128, 156, 120], [170, 190, 158], [112, 142, 106], [186, 204, 174]],
  bokeh: [[168, 190, 156], [150, 174, 140], [186, 204, 174], [134, 160, 126], [200, 214, 190], [158, 182, 148]],
  glitter: [[118, 148, 110], [136, 162, 128], [102, 132, 96], [152, 176, 142]],
  pen: 0xa8c09c,
  flash: 0xeef3e8,
  ghost: [0xb4c8a8, 0x9cb890, 0xc8d8bc, 0x8fae86, 0xa8c09c, 0x88a880, 0xbcd0b0],
  a: { far: 0.55, mid: 0.45, disc: 1, near: 0.6, dust: 0.85, star: 0.8, ghost: 2, pen: 0.7, flash: 0.9 },
};
const SAGE_ON_WHITE: Palette = {
  ...SAGE_ON_BEIGE,
  // (on white the palest discs vanish: a shade deeper)
  bokeh: [[150, 174, 140], [134, 160, 126], [168, 190, 156], [120, 148, 112], [178, 198, 166], [142, 168, 134]],
  flash: 0xc8d8bc,
  a: { ...SAGE_ON_BEIGE.a, near: 0.45, disc: 0.85 },
};
export const PALETTE: Record<Theme, Palette> = { green: GOLD, beige: SAGE_ON_BEIGE, white: SAGE_ON_WHITE };
