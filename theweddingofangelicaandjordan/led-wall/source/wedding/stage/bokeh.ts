// PixiJS (MIT) is the studio's one copy in demos/three/pixi/node_modules (the main package.json stays as it is, CLAUDE.md
// "3D + GPU effects"); esbuild bundles it into stage.js, so the built page still runs offline from file://
import { Application, Container, Particle, ParticleContainer, Sprite, Texture } from "../../../demos/three/pixi/node_modules/pixi.js";
import type { Pen } from "./monogram";
import { PALETTE, type Palette, type Theme } from "./theme";

// The LED stage's bokeh on the GPU (2026-11-16; the user: "gumamit ako dun ng bokeh effects baka pwede natin gamitin si
// pixi js?"). Same design as the page's canvas version (index.html's startCanvasBokeh, kept as the fallback): warm gold
// light falling slowly, clear round the monogram and the date, big soft discs along the sides in front; now as sprites
// in two Pixi canvases (back: behind the florals and the monogram; front: over everything, dimmed while a scene plays):
//   back   far dust (tiny points) · mid glows · lens bokeh discs (a soft rim like a real lens) · twinkles (star glints)
//   front  near bokeh (big, defocused) · the pens: a warm glow on each tip + glitter shed as they write · the heart's burst
// Every ambient particle is a pure function of (index, t): nothing drifts or piles up over a long night.
// The colours are the theme's (theme.ts PALETTE, round 32): gold light ADDED on the green; on beige / white, sage
// green laid on normally (added light vanishes on a light ground), fainter (round 33: the bokeh + flare sage too)
type RGB = readonly [number, number, number];
const hex = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const pick = <T,>(a: readonly T[], i: number) => a[Math.floor(rnd(i) * a.length) % a.length];
const wrap = (v: number, m: number) => ((v % m) + m) % m;

const canvasTex = (size: number, paint: (g: CanvasRenderingContext2D, r: number) => void) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!, size / 2);
  return Texture.from(c);
};
const radial = (stops: [number, number][]) => (g: CanvasRenderingContext2D, r: number) => {
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, r * 2, r * 2);
};
// the textures (white, tinted per sprite): the canvas version's own gradients, plus a lens rim and a star glint
const makeTextures = () => ({
  dot: canvasTex(32, radial([[0, 1], [0.55, 1], [0.8, 0.5], [1, 0]])),
  glow: canvasTex(64, radial([[0, 1], [0.3, 0.6], [1, 0]])),
  // a lens's out-of-focus highlight: a flat disc, a slightly brighter rim, a soft edge
  bokeh: canvasTex(128, radial([[0, 0.62], [0.5, 0.66], [0.74, 0.78], [0.84, 0.92], [0.91, 0.42], [0.97, 0.08], [1, 0]])),
  // further out of focus (the nearest, biggest ones): no rim, a wide soft edge
  soft: canvasTex(128, radial([[0, 1], [0.65, 0.85], [0.82, 0.4], [0.93, 0.1], [1, 0]])),
  // a sparkle: a hot core, two long tapered rays and two short diagonal ones (light catching glitter)
  star: canvasTex(128, (g, r) => {
    radial([[0, 1], [0.05, 0.95], [0.16, 0.3], [0.4, 0.05], [1, 0]])(g, r);
    g.globalCompositeOperation = "lighter";
    const ray = (len: number, w: number, a: number, rot: number) => {
      g.save(); g.translate(r, r); g.rotate(rot);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${a})`); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill();
      g.restore();
    };
    ray(r, 2.6, 1, 0); ray(r, 2.6, 1, Math.PI / 2); ray(r * 0.42, 1.6, 0.55, Math.PI / 4); ray(r * 0.42, 1.6, 0.55, -Math.PI / 4);
  }),
  // a lens flare's ghost ring and its anamorphic streak (a long thin horizontal light)
  ring: canvasTex(128, radial([[0, 0.05], [0.7, 0.08], [0.86, 0.55], [0.92, 0.65], [0.97, 0.15], [1, 0]])),
  streak: (() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 32;
    const g = c.getContext("2d")!;
    for (let y = 0; y < 32; y++) {
      const v = Math.exp(-(((y - 15.5) / 3.2) ** 2));
      const lg = g.createLinearGradient(0, 0, 512, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.35, `rgba(255,255,255,${0.35 * v})`);
      lg.addColorStop(0.5, `rgba(255,255,255,${v})`); lg.addColorStop(0.65, `rgba(255,255,255,${0.35 * v})`); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.fillRect(0, y, 512, 1);
    }
    return Texture.from(c);
  })(),
  glint: canvasTex(64, (g, r) => {
    radial([[0, 1], [0.12, 0.7], [0.35, 0.12], [1, 0]])(g, r);
    g.globalCompositeOperation = "lighter";
    for (const [len, w, a] of [[r, 1.6, 0.9], [r * 0.55, 1.1, 0.35]] as const) {
      const rot = len === r ? 0 : Math.PI / 4;
      for (const k of [0, 1]) {
        g.save(); g.translate(r, r); g.rotate(rot + (k * Math.PI) / 2);
        const lg = g.createLinearGradient(-len, 0, len, 0);
        lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${a})`); lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg; g.fillRect(-len, -w / 2, len * 2, w);
        g.restore();
      }
    }
  }),
});

// The looks (2026-11-16, round 26; the user: "what if instead of bokeh or add pa tayo ng flare? or sparkling?"), L on the
// stage switches them:
//   bokeh     round 25 as it was
//   sparkle   the bokeh + sparkles (stars flashing, glitter dust flickering, glints on the monogram's gold) + a lens flare
//             (the stage's look since round 30, 2026-11-25: "boke with flare pero remove mo tong malaki na to": the flare's
//             big light by the top-left florals, its star and its long streak, are gone; its faint ghost rings stay)
//   flare     no bokeh discs: sparkles + the lens flare only (the tiny dust stays, as glitter)
export const LOOKS = ["bokeh", "sparkle", "flare"] as const;
export type Look = (typeof LOOKS)[number];
export const LOOK_NAMES: Record<Look, string> = { bokeh: "Bokeh", sparkle: "Bokeh + sparkle + flare", flare: "Sparkle + flare (no bokeh)" };
export type Bokeh = { burst: (x: number, y: number) => void; zone: () => void; setLook: (l: Look) => void; setTheme: (t: Theme) => void };
type Pt = { x: number; y: number };

export async function startBokeh(back: HTMLCanvasElement, front: HTMLCanvasElement, pens: () => readonly Pen[], inkAt: (u: number) => Pt | null = () => null): Promise<Bokeh> {
  const make = async (canvas: HTMLCanvasElement) => {
    const app = new Application();
    await app.init({
      canvas, backgroundAlpha: 0, resizeTo: window, antialias: false, preference: "webgl", powerPreference: "high-performance",
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, sharedTicker: true,
    });
    return app;
  };
  const appB = await make(back);
  const appF = await make(front);
  let PAL: Palette = PALETTE.green; // (PAL: the pens' loop below names its pen P)
  const tex = makeTextures();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // the clear zone round the monogram + the date (the canvas version's calcCenter / atten): round the ink itself, not the
  // SVG's box (its frame has wide margins, and the monogram is big since round 30)
  let zc = { x: 0, y: 0, rx: 1, ry: 1 };
  const zone = () => {
    const mono = document.querySelector(".monogram [data-ink]") ?? document.querySelector(".monogram"), typo = document.querySelector(".typography");
    if (!mono || !typo) return;
    const a = mono.getBoundingClientRect(), b = typo.getBoundingClientRect();
    const top = Math.min(a.top, b.top), bot = Math.max(a.bottom, b.bottom), lft = Math.min(a.left, b.left), rgt = Math.max(a.right, b.right);
    zc = { x: (lft + rgt) / 2, y: (top + bot) / 2, rx: (rgt - lft) / 2 + innerWidth * 0.18, ry: (bot - top) / 2 + innerHeight * 0.14 };
  };
  const atten = (x: number, y: number) => {
    const dx = (x - zc.x) / zc.rx, dy = (y - zc.y) / zc.ry, d = dx * dx + dy * dy;
    if (d >= 1) return 1;
    const t = Math.sqrt(d);
    return t * t * (3 - 2 * t);
  };
  addEventListener("resize", () => setTimeout(zone, 50));
  zone();
  void document.fonts?.ready.then(() => setTimeout(zone, 100));

  const W = () => appB.screen.width, H = () => appB.screen.height;
  const k = () => Math.max(0.75, Math.min(1.8, H() / 1000)); // sizes + speeds follow the screen's height

  // ── back ──
  const far = new ParticleContainer({ dynamicProperties: { position: true, color: true, vertex: true } });
  const mid = new ParticleContainer({ dynamicProperties: { position: true, color: true, vertex: true } });
  far.blendMode = "add"; mid.blendMode = "add";
  const FAR = 520, MID = 130, DISCS = 16, TW = 20;
  const farP = Array.from({ length: FAR }, () => { const p = new Particle({ texture: tex.dot, anchorX: 0.5, anchorY: 0.5 }); far.addParticle(p); return p; });
  const midP = Array.from({ length: MID }, () => { const p = new Particle({ texture: tex.glow, anchorX: 0.5, anchorY: 0.5 }); mid.addParticle(p); return p; });
  const discs = new Container();
  const discS = Array.from({ length: DISCS }, () => { const s = new Sprite({ texture: tex.bokeh, anchor: 0.5, blendMode: "add" }); discs.addChild(s); return s; });
  const twinkles = new Container();
  const twS = Array.from({ length: TW }, () => { const s = new Sprite({ texture: tex.glint, anchor: 0.5, blendMode: "add" }); twinkles.addChild(s); return s; });
  // sparkle looks: glitter dust (flickering grains) + stars that flash now and then, behind the monogram
  const DUST = 200, STARS = 70;
  const dust = new ParticleContainer({ dynamicProperties: { position: true, color: true, vertex: true } });
  dust.blendMode = "add";
  const dustP = Array.from({ length: DUST }, () => { const p = new Particle({ texture: tex.glint, anchorX: 0.5, anchorY: 0.5 }); dust.addParticle(p); return p; });
  const stars = new Container();
  const starS = Array.from({ length: STARS }, () => { const s = new Sprite({ texture: tex.star, anchor: 0.5, blendMode: "add" }); stars.addChild(s); return s; });
  appB.stage.addChild(far, mid, discs, twinkles, dust, stars);

  // ── front ──
  const NEAR = 24;
  const near = new Container();
  const nearS = Array.from({ length: NEAR }, (_, i) => {
    const s = new Sprite({ texture: i < 9 ? tex.soft : tex.bokeh, anchor: 0.5 });
    near.addChild(s); return s;
  });
  const fx = new Container();
  // (each pen's own glow + core, made as a pen first writes: two at once since round 28, the A and the J)
  const penFx: { glow: Sprite; core: Sprite; glowA: number; last: Pen | null }[] = [];
  const penAt = (i: number) => {
    while (penFx.length <= i) {
      const glow = new Sprite({ texture: tex.glow, anchor: 0.5, tint: PAL.pen, blendMode: PAL.add ? "add" : "normal", alpha: 0 });
      const core = new Sprite({ texture: tex.glint, anchor: 0.5, tint: 0xfff6e0, blendMode: "add", alpha: 0 });
      const at = fx.getChildIndex(flash); // (under the heart's flash, as before)
      fx.addChildAt(core, at); fx.addChildAt(glow, at);
      penFx.push({ glow, core, glowA: 0, last: null });
    }
    return penFx[i];
  };
  const GL = 360; // the glitter pool (shed from the pen tips)
  const glitter = Array.from({ length: GL }, () => { const s = new Sprite({ texture: tex.glint, anchor: 0.5, blendMode: "add", visible: false }); fx.addChild(s); return s; });
  const BURST = 44;
  const burstS = Array.from({ length: BURST }, () => { const s = new Sprite({ texture: tex.glint, anchor: 0.5, blendMode: "add", visible: false }); fx.addChild(s); return s; });
  const flash = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: "add", visible: false });
  const heartStreak = new Sprite({ texture: tex.streak, anchor: 0.5, blendMode: "add", visible: false });
  fx.addChild(flash, heartStreak);
  // the lens flare: its ghosts along the line from a warm light up by the top-left florals (drifting slowly) through the
  // middle of the screen (the way a real lens throws them); the light itself (a halo, a star and a long streak) was
  // removed in round 30 ("remove mo tong malaki na to")
  const flare = new Container();
  const GHOSTS: { f: number; r: number; a: number; tex: Texture }[] = [
    { f: 0.32, r: 16, a: 0.16, tex: tex.soft }, { f: 0.55, r: 38, a: 0.08, tex: tex.ring },
    { f: 0.86, r: 11, a: 0.18, tex: tex.soft }, { f: 1.2, r: 64, a: 0.06, tex: tex.bokeh },
    { f: 1.45, r: 24, a: 0.12, tex: tex.ring }, { f: 1.8, r: 100, a: 0.05, tex: tex.ring },
    { f: 2.15, r: 30, a: 0.1, tex: tex.soft },
  ];
  // (their tints: the theme's, PALETTE ghost)
  const ghostS = GHOSTS.map((g) => new Sprite({ texture: g.tex, anchor: 0.5, blendMode: "add" }));
  flare.addChild(...ghostS);
  // glints on the monogram's gold once it's written: a star flashing on a stroke every ~0.4 s
  const INK = 6, INK_PERIOD = 2.6, INK_LIFE = 0.95;
  const inkG = new Container();
  const inkS = Array.from({ length: INK }, (_, i) => { const s = new Sprite({ texture: tex.star, anchor: 0.5, tint: i % 2 ? 0xffffff : 0xfff4dc, blendMode: "add", visible: false }); inkG.addChild(s); return s; });
  const inkAtN: { n: number; p: Pt | null }[] = Array.from({ length: INK }, () => ({ n: -1, p: null }));
  appF.stage.addChild(near, flare, inkG, fx);

  // the theme (round 32): every particle re-tinted by its own index, the blend switched (the glints on the ink stay added
  // light: they sit on the monogram's strokes, gold or sage)
  const setTheme = (t: Theme) => {
    PAL = PALETTE[t];
    const bl = PAL.add ? "add" : "normal";
    far.blendMode = mid.blendMode = dust.blendMode = bl;
    farP.forEach((p, i) => (p.tint = hex(pick(PAL.col, i * 5 + 4))));
    midP.forEach((p, i) => (p.tint = hex(pick(PAL.col, i * 7 + 2))));
    discS.forEach((d, i) => { d.tint = hex(pick(PAL.bokeh, i * 3 + 1)); d.blendMode = bl; });
    twS.forEach((g, i) => { g.tint = hex(pick(PAL.col, i * 11 + 3)); g.blendMode = bl; });
    dustP.forEach((p, i) => (p.tint = hex(pick(PAL.glitter, i * 19 + 7))));
    starS.forEach((g, i) => { g.tint = hex(pick(PAL.glitter, i * 29 + 3)); g.blendMode = bl; });
    nearS.forEach((n, i) => (n.tint = hex(pick(PAL.bokeh, i * 13 + 5))));
    burstS.forEach((b, i) => { b.tint = hex(pick(PAL.glitter, i)); b.blendMode = bl; });
    for (const g of glitter) g.blendMode = bl;
    flash.tint = heartStreak.tint = PAL.flash; flash.blendMode = heartStreak.blendMode = bl;
    ghostS.forEach((g, k) => { g.tint = PAL.ghost[k % PAL.ghost.length]; g.blendMode = bl; });
    for (const F of penFx) { F.glow.tint = PAL.pen; F.glow.blendMode = bl; }
  };
  setTheme("green");

  let look: Look = "sparkle";
  const setLook = (l: Look) => {
    look = l;
    const bokehOn = l !== "flare", extra = l !== "bokeh";
    mid.visible = discs.visible = near.visible = bokehOn;
    dust.visible = stars.visible = flare.visible = inkG.visible = extra;
    twinkles.visible = !extra; // (the sparkle stars take their place)
  };
  setLook(look);

  // the glitter: a ring buffer; each grain = (born, x, y, vx, vy, life, size, colour)
  type Grain = { born: number; x: number; y: number; vx: number; vy: number; life: number; size: number };
  const grains: (Grain | null)[] = Array(GL).fill(null);
  let gi = 0, seed = 1, shed = 0;
  let burst: { t: number; x: number; y: number } | null = null;

  const t0 = performance.now();
  const tick = () => {
    const t = reduced ? 40 : (performance.now() - t0) / 1000;
    const w = W(), h = H(), s = k(), A = PAL.a;
    // far dust: tiny points falling slowly with a little sway
    for (let i = 0; i < FAR; i++) {
      const p = farP[i];
      const r = (0.4 + 2.1 * rnd(i * 3 + 7)) * s, vy = (7 + 18 * rnd(i * 3 + 8)) * s;
      p.x = rnd(i * 3 + 9) * w + 5 * Math.sin(t * (0.2 + 0.3 * rnd(i)) + i);
      p.y = wrap(rnd(i * 5 + 1) * (h + 20) + t * vy, h + 20) - 10;
      p.scaleX = p.scaleY = (r * 2) / 32;
      p.alpha = (0.35 + 0.6 * rnd(i * 5 + 2)) * (0.8 + 0.2 * Math.sin(t * (0.6 + rnd(i * 2)) + i)) * atten(p.x, p.y) * A.far;
    }
    // mid glows: fewer, brighter, a bit faster
    for (let i = 0; i < MID; i++) {
      const p = midP[i];
      const r = (1.5 + 4 * rnd(i * 7 + 3)) * 2 * s, vy = (18 + 27 * rnd(i * 7 + 4)) * s;
      p.x = rnd(i * 7 + 5) * w + 10 * Math.sin(t * (0.15 + 0.2 * rnd(i * 7 + 6)) + i * 2);
      p.y = wrap(rnd(i * 7 + 6) * (h + 40) + t * vy, h + 40) - 20;
      p.scaleX = p.scaleY = (r * 2) / 64;
      p.alpha = (0.25 + 0.4 * rnd(i * 7 + 8)) * atten(p.x, p.y) * A.mid;
    }
    // lens discs behind: small, faint, a slow drift and a slow breath
    for (let i = 0; i < DISCS; i++) {
      const d = discS[i];
      const r = (9 + 14 * rnd(i * 17 + 1)) * s, vy = (9 + 12 * rnd(i * 17 + 2)) * s;
      d.x = rnd(i * 17 + 3) * w + 22 * Math.sin(t * 0.12 + i * 1.7);
      d.y = wrap(rnd(i * 17 + 4) * (h + 2 * r) + t * vy, h + 2 * r) - r;
      d.scale.set((r * 2) / 128);
      d.alpha = (0.14 + 0.16 * rnd(i * 17 + 5)) * (0.75 + 0.25 * Math.sin(t * 0.5 + i)) * atten(d.x, d.y) * A.disc;
    }
    // twinkles: still points that brighten into a star now and then (about 6 at once)
    for (let i = 0; i < TW; i++) {
      const g = twS[i];
      g.x = rnd(i * 23 + 1) * w; g.y = rnd(i * 23 + 2) * h;
      const per = 7 + 6 * rnd(i * 23 + 3), ph = wrap(t + per * rnd(i * 23 + 4), per) / per; // 0..1 through its cycle
      const on = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) : 0;
      const sz = (6 + 10 * rnd(i * 23 + 5)) * s * (0.5 + 0.9 * on);
      g.scale.set((sz * 2) / 64);
      g.rotation = t * 0.15 + i;
      g.alpha = (0.12 + (0.5 + 0.4 * rnd(i * 23 + 6)) * on) * atten(g.x, g.y) * A.star;
    }
    // near bokeh along the sides (the canvas version's three sizes: 1 very large, 8 large, 15 medium)
    for (let i = 0; i < NEAR; i++) {
      const n = nearS[i];
      const tier = i === 0 ? 0 : i < 9 ? 1 : 2;
      const r = (tier === 0 ? 35 + 20 * rnd(i * 31 + 1) : tier === 1 ? 22 + 16 * rnd(i * 31 + 1) : 12 + 14 * rnd(i * 31 + 1)) * s;
      const a = tier === 0 ? 0.35 + 0.15 * rnd(i * 31 + 2) : tier === 1 ? 0.5 + 0.2 * rnd(i * 31 + 2) : 0.85 + 0.15 * rnd(i * 31 + 2);
      const side = rnd(i * 31 + 3) < 0.5;
      const ex = side ? rnd(i * 31 + 4) * 0.28 * w - 30 : w * 0.72 + rnd(i * 31 + 4) * 0.28 * w + 30;
      const vy = (21 + 27 * rnd(i * 31 + 5)) * s;
      n.x = ex + 16 * Math.sin(t * (0.1 + 0.08 * rnd(i * 31 + 6)) + i);
      n.y = wrap(rnd(i * 31 + 7) * (h + 2 * r + 80) + t * vy, h + 2 * r + 80) - r - 40;
      n.scale.set((r * 2) / 128);
      n.alpha = a * 0.8 * atten(n.x, n.y) * A.near;
    }
    if (look !== "bokeh") {
      const solo = look === "flare"; // no bokeh: the sparkles carry the screen (more, bigger, longer flashes)
      const dense = solo ? 1 : 0.65; // with the bokeh up, fewer sparkles (not busy)
      // glitter dust: grains falling slowly, each catching the light in short flickers
      for (let i = 0; i < DUST; i++) {
        const p = dustP[i];
        if (i >= DUST * dense) { p.alpha = 0; continue; }
        const sz = (solo ? 2.5 + 5 * rnd(i * 41 + 1) : 2 + 4 * rnd(i * 41 + 1)) * s, vy = (10 + 22 * rnd(i * 41 + 2)) * s;
        p.x = rnd(i * 41 + 3) * w + 8 * Math.sin(t * (0.2 + 0.25 * rnd(i * 41 + 4)) + i);
        p.y = wrap(rnd(i * 41 + 5) * (h + 20) + t * vy, h + 20) - 10;
        p.scaleX = p.scaleY = (sz * 2) / 64;
        const fl = 0.5 + 0.5 * Math.sin(t * (2.5 + 5 * rnd(i * 41 + 6)) + 6.28 * rnd(i * 41 + 7));
        p.alpha = (0.15 + 0.85 * fl ** 6) * (0.55 + 0.45 * rnd(i * 41 + 8)) * (solo ? 1 : 0.8) * atten(p.x, p.y) * A.dust;
      }
      // stars: still points that flash bright for a moment, each on its own slow cycle
      for (let i = 0; i < STARS; i++) {
        const g = starS[i];
        if (i >= STARS * dense) { g.visible = false; continue; }
        g.visible = true;
        g.x = rnd(i * 53 + 1) * w; g.y = rnd(i * 53 + 2) * h;
        const per = 4 + 5 * rnd(i * 53 + 3), ph = wrap(t + per * rnd(i * 53 + 4), per) / per, fl = solo ? 0.2 : 0.13;
        const on = ph < fl ? Math.sin((ph / fl) * Math.PI) : 0;
        const sz = (solo ? 16 + 26 * rnd(i * 53 + 5) : 12 + 20 * rnd(i * 53 + 5)) * s * (0.25 + 0.75 * on);
        g.scale.set((sz * 2) / 128);
        g.rotation = rnd(i * 53 + 6) * 0.6 - 0.3 + on * 0.25;
        g.alpha = (0.1 + 0.9 * on) * atten(g.x, g.y) * A.star;
      }
      // the lens flare (breathing slowly)
      const br = 0.85 + 0.15 * Math.sin(t * 0.55) + 0.05 * Math.sin(t * 1.7);
      const sx = w * (0.13 + 0.05 * Math.sin(t * 0.045)), sy = h * (0.12 + 0.04 * Math.cos(t * 0.037));
      const cx = w * 0.5, cy = h * 0.43; // through the monogram's centre (--monoY, round 31)
      GHOSTS.forEach((G, k) => {
        const gs = ghostS[k];
        gs.x = sx + (cx - sx) * G.f; gs.y = sy + (cy - sy) * G.f;
        gs.scale.set((G.r * 2 * s) / 128);
        gs.alpha = G.a * br * (0.35 + 0.65 * atten(gs.x, gs.y)) * A.ghost; // fainter over the monogram + the date
      });
      // glints on the monogram: glint j flashes once per INK_PERIOD, at a new spot on the strokes each time
      for (let j = 0; j < INK; j++) {
        const sp = inkS[j], tt = t + (j * INK_PERIOD) / INK, n = Math.floor(tt / INK_PERIOD), age = tt - n * INK_PERIOD;
        if (inkAtN[j].n !== n) inkAtN[j] = { n, p: inkAt(rnd(j * 97 + n * 13 + 5)) };
        const P = inkAtN[j].p;
        if (!P || age > INK_LIFE) { sp.visible = false; continue; }
        const u = Math.sin((age / INK_LIFE) * Math.PI);
        sp.visible = true; sp.position.set(P.x, P.y);
        sp.scale.set(((26 + 18 * rnd(j * 31 + n)) * s * 2 * u) / 128);
        sp.rotation = (age / INK_LIFE) * 0.7;
        sp.alpha = 0.95 * u;
      }
    }
    // the pens: a warm glow on each tip, glitter shed behind it (more when it moves fast)
    pens().forEach((P, pi) => {
      const F = penAt(pi), lastPen = F.last;
      const live = P.on && !reduced;
      F.glowA += ((live ? 1 : 0) - F.glowA) * 0.12;
      if (live || F.glowA > 0.01) {
        F.glow.position.set(P.x, P.y); F.core.position.set(P.x, P.y);
        F.glow.scale.set((46 * s) / 64); F.glow.alpha = 0.55 * F.glowA * A.pen;
        F.core.scale.set((22 * s) / 64); F.core.alpha = 0.9 * F.glowA; F.core.rotation = t * 1.4 + pi * 0.8;
      } else { F.glow.alpha = F.core.alpha = 0; }
      if (live) {
        const moved = lastPen?.on ? Math.hypot(P.x - lastPen.x, P.y - lastPen.y) : 0;
        shed += 0.55 + moved * 0.09; // per frame
        while (shed >= 1) {
          shed -= 1; seed++;
          const a = rnd(seed * 3) * Math.PI * 2, sp = (10 + 30 * rnd(seed * 3 + 1)) * s;
          const f = rnd(seed * 3 + 2); // spread back along the last frame's move
          grains[gi] = {
            born: t, x: P.x - (P.x - (lastPen?.x ?? P.x)) * f + 5 * s * Math.cos(a), y: P.y - (P.y - (lastPen?.y ?? P.y)) * f + 5 * s * Math.sin(a),
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 14 * s, life: 0.7 + 0.8 * rnd(seed * 7), size: (3 + 7 * rnd(seed * 5) ** 2) * s,
          };
          glitter[gi].tint = hex(pick(PAL.glitter, seed * 13));
          gi = (gi + 1) % GL;
        }
      }
      F.last = { ...P };
    });
    for (let i = 0; i < GL; i++) {
      const g = grains[i], sp = glitter[i];
      const age = g ? t - g.born : 99;
      if (!g || age > g.life) { sp.visible = false; continue; }
      const u = age / g.life;
      sp.visible = true;
      sp.x = g.x + g.vx * age; sp.y = g.y + g.vy * age + 18 * s * age * age; // drifting, then falling
      sp.scale.set((g.size * 2 * (1 - 0.5 * u)) / 64);
      sp.rotation = g.born * 7 + age * 2;
      sp.alpha = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * (0.6 + 0.4 * Math.sin(age * 22 + g.born * 9));
    }
    // the heart's burst: a soft flash + glints out from it, slowing down
    if (burst) {
      const age = t - burst.t;
      flash.visible = age < 1.2;
      flash.position.set(burst.x, burst.y);
      flash.scale.set(((60 + 90 * Math.min(1, age / 0.4)) * s * 2) / 64);
      flash.alpha = 0.55 * Math.max(0, 1 - age / 1.2) * A.flash;
      // (the flare looks) a light streak across the heart as it lands
      heartStreak.visible = look !== "bokeh" && age < 1.1;
      heartStreak.position.set(burst.x, burst.y);
      heartStreak.scale.set((w * 0.36 * Math.min(1, age / 0.25 + 0.2)) / 512, (26 * s) / 32);
      heartStreak.alpha = 0.6 * Math.max(0, 1 - age / 1.1) * A.flash;
      for (let i = 0; i < BURST; i++) {
        const b = burstS[i], life = 1.1 + 0.8 * rnd(i * 5 + 1);
        if (age > life) { b.visible = false; continue; }
        const a = (i / BURST) * Math.PI * 2 + 0.4 * rnd(i * 5 + 2), sp = (70 + 120 * rnd(i * 5 + 3)) * s;
        const d = sp * (1 - Math.exp(-age * 2.6)) / 2.6;
        b.visible = true;
        b.x = burst.x + Math.cos(a) * d; b.y = burst.y + Math.sin(a) * d + 10 * s * age * age;
        b.scale.set(((4 + 6 * rnd(i * 5 + 4)) * s * 2) / 64);
        b.rotation = age * 3 + i;
        b.alpha = Math.min(1, age / 0.1) * (1 - age / life);
      }
      if (age > 2.2) { burst = null; for (const b of burstS) b.visible = false; flash.visible = heartStreak.visible = false; }
    }
  };
  appB.ticker.add(tick);
  return {
    zone,
    setLook,
    setTheme,
    burst: (x, y) => { if (!reduced) burst = { t: (performance.now() - t0) / 1000, x, y }; },
  };
}
