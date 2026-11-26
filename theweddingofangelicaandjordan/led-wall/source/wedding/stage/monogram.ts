import { MONOGRAM as M } from "./monogramData";
import { INK, type Theme } from "./theme";

// The A♥J monogram as SVG, written on by a pen (2026-11-16; the user: "yung monogram is redraw sa svg tapos dahan dahan na
// yung pag fill ng logo"). The ink is one filled path (traced from the monogram picture, src/wedding/trace/monogram-svg.py);
// it shows through a mask of round-capped strokes that run along its centre line in writing order (round 28, approved
// 2026-11-17, the user: "what if unahin yung infinity tapos sabay na fifill yung A and J?": the infinity first as a thin
// line in one sweep, a beat, then two pens at once, the A (left leg, then its thick right leg) and the J, ending
// together), each piece as wide as the ink under it and clipped to its own ink where strands cross, so the fill flows
// along the letters with their own thick and thin. Then the heart pops in, a light sweeps across, and the date comes up
// (body.written; the names and the hashtag were removed in round 30). The pens' tips (screen px) are read by the PixiJS layer for their glow and glitter: one per stroke
// running at the same time (a stroke takes the first pen that is free when it starts).
// Replaces the <img> in .monogram (left there as the fallback when the script can't run).
const NS = "http://www.w3.org/2000/svg";
const START = 1.4; // s after mount: the background and florals are fading in
const HEART_AT = M.writeEnd + 0.12;
const HEART_DUR = 0.6;
const SWEEP_AT = HEART_AT + 0.35;
const SWEEP_DUR = 1.6;
const IDLE_SWEEP_EVERY = 14; // s, a softer light sweep while idle
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const backOut = (x: number) => { const c = 1.9; const u = x - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

export type Pen = { x: number; y: number; on: boolean };
// inkAt(u): a point on the monogram's strokes (u 0..1 along all of them, in screen px) once it's written, for the
// sparkle looks' glints on the gold; null while it's being written
// pulse(s): the heart thumps (up to s times its size and back; round 36, when the peeking couple's kiss / arrow hits it);
// showHeart(false): the heart is gone from the monogram (round 38: Dan steals it and brings it back), true = back
export type Monogram = { pens: Pen[]; replay: () => void; finish: () => void; inkAt: (u: number) => { x: number; y: number } | null; setTheme: (t: Theme) => void; pulse: (s: number) => void; showHeart: (on: boolean) => void };

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
  const e = document.createElementNS(NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};

export function mountMonogram(host: HTMLElement, on: { written: () => void; unwritten: () => void; heart: (x: number, y: number) => void }): Monogram {
  const svg = el("svg", { viewBox: `0 0 ${M.w} ${M.h}`, "aria-label": "A & J", role: "img" });
  svg.style.cssText = "display:block;width:100%;height:auto;overflow:visible;transition:opacity .7s ease";
  const defs = el("defs", {}, svg);
  // the ink's colour: the picture's cream with the page's brightness(1.12) baked in, a little lighter top-left (the
  // theme's, round 32: sage green on the light ones; the stops fade to a new theme's in 1.2 s)
  const gold = el("linearGradient", { id: "mgGold", gradientUnits: "userSpaceOnUse", x1: 300, y1: 60, x2: 1400, y2: 930 }, defs);
  const inkStops = INK.green.stops.map((c, i) => {
    const st = el("stop", { offset: i / 2 }, gold);
    st.style.stopColor = c;
    st.style.transition = "stop-color 1.2s ease";
    return st;
  });
  let theme: Theme = "green";
  // the light sweep: a soft diagonal band moved by its gradientTransform
  const shine = el("linearGradient", { id: "mgShine", gradientUnits: "userSpaceOnUse", x1: -520, y1: 0, x2: 520, y2: 380 }, defs);
  for (const [o, a] of [[0, 0], [0.42, 0], [0.5, 0.85], [0.58, 0], [1, 0]] as const) el("stop", { offset: o, "stop-color": "#fff", "stop-opacity": a }, shine);
  const clip = el("clipPath", { id: "mgInk" }, defs);
  el("path", { d: M.ink }, clip);
  const clipHeart = el("path", { d: M.heart }, clip);
  const mask = el("mask", { id: "mgWrite", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: M.w, height: M.h }, defs);
  const maskG = el("g", { fill: "none", stroke: "#fff", "stroke-linecap": "round", "stroke-linejoin": "round" }, mask);
  // (a piece at a crossing is clipped to its own ink, so it never shows a tick of the strand it crosses)
  const pieces = M.strokes.flatMap((s) => s.pieces).map((p, i) => {
    const path = el("path", { d: p.d, "stroke-width": p.w, visibility: "hidden" }, maskG);
    if (p.clip) {
      el("path", { d: p.clip }, el("clipPath", { id: `mgC${i}`, clipPathUnits: "userSpaceOnUse" }, defs));
      path.setAttribute("clip-path", `url(#mgC${i})`);
    }
    return { ...p, path, len: 0, shown: -1 };
  });
  const ink = el("g", { mask: "url(#mgWrite)" }, svg);
  el("path", { d: M.ink, fill: "url(#mgGold)", "data-ink": "" }, ink); // (data-ink: the bokeh's clear zone is measured round it)
  const heart = el("path", { d: M.heart, fill: "url(#mgGold)", opacity: 0 }, svg);
  const [hx, hy, hw, hh] = M.heartBox;
  heart.style.transformBox = "view-box";
  heart.style.transformOrigin = `${hx + hw / 2}px ${hy + hh * 0.8}px`; // grows from its point
  const sweep = el("rect", { x: 0, y: 0, width: M.w, height: M.h, fill: "url(#mgShine)", "clip-path": "url(#mgInk)", opacity: 0 }, svg);

  host.querySelector("img")?.remove();
  host.appendChild(svg);

  // the glow (round 30): the ink blurred ONCE into a canvas behind the SVG, pulsing by its opacity only (index.html's
  // .mono-glow). It was four CSS drop-shadows on .monogram, animated, so re-blurred every frame: at the bigger size that
  // cut the frame rate to a third (A/B in Chrome: ~19 fps writing with it, 60 without). It comes up once the monogram is
  // written (body.written), so it never shows a letter ahead of the pen; redrawn when the monogram's size changes
  const GLOW_PAD = 0.1; // round the monogram, of its width (the widest shadow reaches ~80 px out)
  // (the shadows: theme.ts INK, a light halo + a faint sage edge on the light themes)
  const glowBox = document.createElement("div");
  glowBox.className = "mono-glow";
  const glowC = document.createElement("canvas");
  glowBox.appendChild(glowC);
  host.insertBefore(glowBox, svg);
  const glowPaths = [new Path2D(M.ink), new Path2D(M.heart)];
  const drawGlow = () => {
    const w = host.clientWidth;
    if (!w) return;
    const h = (w * M.h) / M.w, pad = w * GLOW_PAD, q = 0.5; // (half resolution: it is all blur)
    Object.assign(glowBox.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${w + 2 * pad}px`, height: `${h + 2 * pad}px` });
    glowC.width = Math.round((w + 2 * pad) * q);
    glowC.height = Math.round((h + 2 * pad) * q);
    const ctx = glowC.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, glowC.width, glowC.height);
    // (the shapes drawn off the canvas, only their shadows land on it: a shadow's blur works in every browser)
    const sc = (w / M.w) * q, OFF = glowC.width + 2000;
    ctx.fillStyle = "#000";
    for (const [b, c] of INK[theme].shadows) {
      ctx.setTransform(sc, 0, 0, sc, pad * q + OFF, pad * q);
      ctx.shadowOffsetX = -OFF;
      ctx.shadowBlur = b * q;
      ctx.shadowColor = c;
      for (const p of glowPaths) ctx.fill(p);
    }
  };
  drawGlow();
  new ResizeObserver(drawGlow).observe(host);
  for (const p of pieces) {
    p.len = p.path.getTotalLength();
    p.path.setAttribute("stroke-dasharray", `${p.len} ${p.len + p.w + 20}`);
  }

  // the pens: each stroke takes the first one free when it starts (the A's legs one after the other on one, the J beside
  // them on a second)
  const laneEnd: number[] = [];
  const laneOf = M.strokes.map((st) => {
    let l = laneEnd.findIndex((e) => e <= st.t0 + 1e-6);
    if (l < 0) { l = laneEnd.length; laneEnd.push(0); }
    laneEnd[l] = st.t1;
    return l;
  });
  const pieceLane = M.strokes.flatMap((st, i) => st.pieces.map(() => laneOf[i]));
  const pens: Pen[] = laneEnd.map(() => ({ x: 0, y: 0, on: false }));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t0 = performance.now() + START * 1000;
  let writtenSent = false, heartSent = false, fading = false;
  const toScreen = (x: number, y: number) => {
    const m = svg.getScreenCTM();
    return m ? { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f } : { x, y };
  };
  const setPiece = (p: (typeof pieces)[number], k: number) => {
    const q = Math.round(k * 400) / 400; // fewer DOM writes
    if (q === p.shown) return;
    p.shown = q;
    p.path.setAttribute("visibility", q <= 0 ? "hidden" : "visible");
    p.path.setAttribute("stroke-dashoffset", String(p.len * (1 - q)));
  };
  let sweepOn = true, heartQ = -1;
  const sweepAt = (k: number, strength: number) => {
    const on = k > 0 && k < 1;
    if (!on && !sweepOn) return; // (idle: nothing to write)
    sweepOn = on;
    sweep.setAttribute("opacity", on ? String(strength) : "0");
    shine.setAttribute("gradientTransform", `translate(${-200 + 2300 * ease(k)} 0)`);
  };
  const frame = () => {
    requestAnimationFrame(frame);
    if (fading) return;
    const t = (performance.now() - t0) / 1000;
    for (const pen of pens) pen.on = false;
    pieces.forEach((p, i) => {
      const k = (t - p.t0) / (p.t1 - p.t0);
      setPiece(p, Math.max(0, Math.min(1, k)));
      if (k > 0 && k < 1) {
        const pt = p.path.getPointAtLength(p.len * k);
        const s = toScreen(pt.x, pt.y), pen = pens[pieceLane[i]];
        pen.x = s.x; pen.y = s.y; pen.on = true;
      }
    });
    const hk = (t - HEART_AT) / HEART_DUR, hq = Math.max(0, Math.min(1, hk));
    if (hq !== heartQ) {
      heartQ = hq;
      heart.setAttribute("opacity", String(Math.max(0, Math.min(1, hk * 2.5))));
      heart.style.transform = `scale(${hk <= 0 ? 0 : hk >= 1 ? 1 : backOut(hk)})`;
    }
    if (hk > 0.25 && !heartSent) {
      heartSent = true;
      const c = toScreen(hx + hw / 2, hy + hh / 2);
      on.heart(c.x, c.y);
    }
    if (t >= SWEEP_AT - 0.2 && !writtenSent) { writtenSent = true; on.written(); }
    // the first sweep strong, then a soft one every IDLE_SWEEP_EVERY s
    const st = t - SWEEP_AT;
    if (st >= 0) {
      const n = Math.floor(st / IDLE_SWEEP_EVERY);
      sweepAt((st - n * IDLE_SWEEP_EVERY) / SWEEP_DUR, n === 0 ? 0.7 : 0.4);
    }
  };
  const finish = () => { t0 = performance.now() - (SWEEP_AT + SWEEP_DUR) * 1000; };
  if (reduced) finish();
  requestAnimationFrame(frame);
  return {
    pens,
    finish,
    pulse: (s) => {
      if (!heartSent || fading) return;
      heart.animate(
        [{ transform: "scale(1)" }, { transform: `scale(${s})`, offset: 0.28 }, { transform: `scale(${1 - (s - 1) * 0.22})`, offset: 0.58 }, { transform: "scale(1)" }],
        { duration: 760, easing: "ease-out" },
      );
    },
    // (its visibility only: the write-on's opacity + scale stay its own; the light sweep leaves out the empty spot too)
    showHeart: (on) => {
      heart.style.visibility = on ? "" : "hidden";
      clipHeart.style.display = on ? "" : "none";
    },
    setTheme: (t) => {
      theme = t;
      INK[t].stops.forEach((c, i) => (inkStops[i].style.stopColor = c));
      drawGlow();
    },
    inkAt: (u) => {
      if (!writtenSent || fading) return null;
      let L = u * pieces.reduce((a, p) => a + p.len, 0);
      for (const p of pieces) {
        if (L <= p.len) { const pt = p.path.getPointAtLength(L); return toScreen(pt.x, pt.y); }
        L -= p.len;
      }
      return null;
    },
    // R on the stage: fade out, then write it again from the start
    replay: () => {
      if (fading) return;
      fading = true;
      for (const pen of pens) pen.on = false;
      svg.style.opacity = "0";
      on.unwritten();
      setTimeout(() => {
        for (const p of pieces) setPiece(p, 0);
        heart.setAttribute("opacity", "0");
        heartQ = -1;
        sweepAt(0, 0);
        writtenSent = heartSent = false;
        t0 = performance.now() + 0.5 * 1000;
        svg.style.opacity = "1";
        fading = false;
        if (reduced) finish();
      }, 900);
    },
  };
}
