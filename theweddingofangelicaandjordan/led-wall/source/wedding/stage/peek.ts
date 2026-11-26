// The couple peeking in (round 34, 2026-11-25; the user: "can you randomly show the faces of couple sa ibang ibang bahagi
// ng screen? like they peeking randomly? hahaha only faces and doing some face expression?"). Now and then a head comes
// in from an edge of the screen, acts a little beat, and goes back out: Dan on the left, Ange on the right, now and then
// both at once (glancing at each other across the screen). Round 34b: whatever edge it comes from is its floor (below).
// The faces are the toast picture's own painted heads (painted-cut.py) with the face pieces already cut for the candles
// (front-cut.py): the eyes glancing at the other (half way, all the way), the closed-lid skin (blinks, a wink, happy ^^
// eyes), Ange's blush; the full side views (round 35, side-cut.py). Round 37 (2026-11-26, the user: "yung current na kiss
// animation reject please ayoko nun"): the front face's kiss (the bare face + pursed lips) is out of the peeks: a kiss
// plays in the side views, face to face. Round 38 (2026-11-26, "give me more pose funny one" → "go"): five funny shows
// (the bonk, the heart battle, the missed arrow, the stolen heart, the fight for the spot) + a test key for every
// peek (main.tsx, the H list). Round 39 (the user: "cupids arrow only on right? … the heart battle aswell", "kita na
// headless"): the arrows from the left too (on a curve over the A), the heart battle from the top + either one first, no
// head ever further in than the top of its chin's fade; 0 = every peek non-stop, 9 = stop them all. Their glances point at the other one (Dan's to his
// right in the picture, Ange's to her left), which picks their spots so the glance goes to the middle. No mirrored faces
// (they're the user's own).
// Plain DOM (no React / Remotion): a few <img>s per head, moved by one transform a frame, only while a peek plays.
// P on the stage turns them off / on (main.tsx); they wait while the monogram writes and while a scene plays.
import angeHead from "../painted/ange-head.png";
import angeLids from "../painted/ange-lids.png";
import danHead from "../painted/dan-head.png";
import danLids from "../painted/dan-lids.png";
import angeLook1 from "../painted/front-ange-look1.png";
import angeLook2 from "../painted/front-ange-look2.png";
import danLook1 from "../painted/front-dan-look1.png";
import danLook2 from "../painted/front-dan-look2.png";
import { FRONT } from "../painted/frontParts";
import { PAINTED } from "../painted/paintedParts";
import angeSide from "../painted/side-ange.png";
import danSide from "../painted/side-dan.png";
import { SIDE } from "../painted/sideParts";
import { MONOGRAM } from "./monogramData";
import { asTheme, INK } from "./theme";

type Who = "dan" | "ange";
type Edge = "left" | "right" | "bottom" | "top";
type V = readonly number[];
const SRC = {
  dan: { head: danHead, lids: danLids, look: [danLook1, danLook2], side: danSide },
  ange: { head: angeHead, lids: angeLids, look: [angeLook1, angeLook2], side: angeSide },
};
// per head (toast px): the eyes' line + the mouth's, as a share of the head picture's height (how far a head rises over
// the bottom edge), where its picture fades out under the chin (Dan's collar, Ange's shoulders), her blush (FrontCouple's),
// the chin's lowest point (toast px: the side view is sized to the front's eye-to-chin), Dan's ear lobes (his crosses),
// where a kiss lands on the cheek (Ange's left one, just in from her blush: the stolen kiss; round 39: Dan's on the
// picture's right, the side toward her, as far in from his eye's corner + as far down to the mouth as hers); round 38: how far the hair
// reaches left + right of the head's middle at its widest (toast px, measured on the head pictures: where two heads side
// by side touch), the profile's forehead (side-source px, the front of the curls / her fringe: the bonk)
const SHAPE: Record<Who, { eyes: number; mouth: number; fade: [number, number]; blush: V[]; chin: number; lobes: V[]; cheek: V; half: [number, number]; brow: V }> = {
  dan: { eyes: 0.56, mouth: 0.75, fade: [0.84, 0.93], blush: [], chin: 444, lobes: [[271, 355], [560, 352]], cheek: [508, 364], half: [213, 210], brow: [796, 352] },
  ange: { eyes: 0.45, mouth: 0.61, fade: [0.78, 0.93], blush: [[818, 404], [962, 402]], chin: 488, lobes: [], cheek: [806, 414], half: [177, 185], brow: [968, 400] },
};
// Dan's cross earrings, both ears (round 35, 2026-11-26; the user: "may earrings akong krus ikaw nlng mag add?", both
// ears): a small gold hoop through the lobe, a Latin cross hanging from it, in the head's own frame (no gravity, like the
// heads). `L` = its whole length, hoop to foot (toast px on the front head, ~1/11 of the head)
const EARRING_L = 40;
const crossEarring = (svg: SVGElement, gradId: string, x: number, y: number, L: number) => {
  const u = L / 41; // drawn on a 41-unit cross: the hoop at 0..7, the cross 7..41
  const g = svgEl("g", { transform: `translate(${x} ${y}) scale(${u})` });
  g.appendChild(svgEl("circle", { cx: 0, cy: 3, r: 4.2, fill: "none", stroke: `url(#${gradId})`, "stroke-width": 2.2 }));
  g.appendChild(svgEl("path", { d: "M-3.2 7H3.2V16H10.5V22H3.2V41H-3.2V22H-10.5V16H-3.2Z", fill: `url(#${gradId})`, stroke: "#5f400f", "stroke-width": 1.1, "stroke-linejoin": "round" }));
  g.appendChild(svgEl("path", { d: "M-1.7 9V39M-8.8 17.6H8", stroke: "#fff4cf", "stroke-width": 1, opacity: 0.75, "stroke-linecap": "round" }));
  svg.appendChild(g);
};
const goldGradient = (svg: SVGElement, id: string) => {
  const defs = svgEl("defs", {}), lg = svgEl("linearGradient", { id, x1: 0, y1: 0, x2: 1, y2: 1 });
  for (const [o, c] of [[0, "#fff0b8"], [0.45, "#e9bd55"], [1, "#a8761e"]] as const) lg.appendChild(svgEl("stop", { offset: o, "stop-color": c }));
  defs.appendChild(lg); svg.appendChild(defs);
};

// ── a pose: what the face does at a moment ──
type Pose = {
  p: number; // in: 0 = out of sight, 0.5 = the eyes over the edge, 1 = the face (over 1 = an overshoot)
  tilt?: number; // degrees on top of the spot's turn (a head-tilt, a giggle's wobble)
  look?: 0 | 1 | 2; // 0 = at us, 1 / 2 = half / all the way toward the middle
  lid?: number; // both eyes closing, 0..1 (a blink)
  wink?: number; // the eye nearer the middle closing, 0..1
  happy?: boolean; // ^^ eyes
  blush?: number;
  side?: number; // the turn to the side view: 0 = front, 1 = the profile (the front narrows away, the profile widens in)
  squash?: number; // a hit from the side (round 38): the head narrower by this share, a little taller
};
// (a heart off the lips / by the eye of the front face, or off the profile's lips, ahead of its face)
type Hearts = { at: number; from: "lips" | "eye" | "side" }[];
type Beat = { dur: number; pose: (t: number) => Pose; hearts?: Hearts };

const ss = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ramp = (t: number, a: number, b: number) => ss((t - a) / (b - a));
const inOut = (t: number, a: number, b: number, c: number, d: number) => ramp(t, a, b) * (1 - ramp(t, c, d));
const blink = (t: number, at: number) => { const d = (t - at) / 0.24; return d <= 0 || d >= 1 ? 0 : Math.sin(d * Math.PI); };
const between = (t: number, a: number, b: number) => t >= a && t < b;
const back = (x: number) => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 2.2; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; }; // ease-out with an overshoot

// the beats (seconds). Every one starts and ends out of sight
const BEATS: Record<string, Beat> = {
  // sneaks up to the eyes, darts a look at the monogram, catches us looking, then comes up all smiles (^^, a blush)
  sneak: {
    dur: 5.6,
    pose: (t) => ({
      p: t < 5 ? 0.5 * ramp(t, 0, 1.3) + 0.5 * ramp(t, 2.9, 3.4) : 1 - ramp(t, 5, 5.6),
      look: between(t, 1.4, 1.55) || between(t, 2.25, 2.4) ? 1 : between(t, 1.55, 2.25) ? 2 : 0,
      lid: blink(t, 2.55), happy: between(t, 3.6, 4.8), blush: inOut(t, 3.6, 4, 4.8, 5.2),
    }),
  },
  // leans in, a head-tilt and a wink, a little heart by the eye
  wink: {
    dur: 4.2,
    pose: (t) => ({
      p: ramp(t, 0, 0.8) - ramp(t, 3.6, 4.2), tilt: 7 * inOut(t, 1.05, 1.3, 2.1, 2.4),
      wink: inOut(t, 1.3, 1.4, 1.8, 1.9), lid: blink(t, 2.75), blush: inOut(t, 1.3, 1.7, 3.2, 3.6),
    }),
    hearts: [{ at: 1.4, from: "eye" }],
  },
  // up, ^^ and a blush, a giggling wobble
  giggle: {
    dur: 4,
    pose: (t) => ({
      p: ramp(t, 0, 0.7) - ramp(t, 3.4, 4) + 0.025 * Math.abs(Math.sin(t * 9.4)) * inOut(t, 0.75, 0.9, 2.6, 2.9),
      tilt: 5 * Math.sin(t * 9.4) * inOut(t, 0.75, 0.9, 2.6, 2.9),
      happy: between(t, 0.6, 3.1), blush: inOut(t, 0.6, 1, 3.1, 3.5),
    }),
  },
  // creeps up to the eyes, stares at the monogram, sees us… and ducks away fast
  caught: {
    dur: 3.1,
    pose: (t) => ({
      p: t < 2.75 ? 0.5 * ramp(t, 0, 1.5) : 0.5 * (1 - ramp(t, 2.75, 3.0)),
      look: between(t, 1.5, 2.3) ? 2 : 0, lid: blink(t, 2.4) * 0.5,
    }),
  },
  // pops in (with a bounce), a double blink, ^^, out
  pop: {
    dur: 3.5,
    pose: (t) => ({ p: back(t / 0.5) - ramp(t, 2.95, 3.5), lid: blink(t, 1.1) + blink(t, 1.42), happy: between(t, 1.9, 2.6) }),
  },
};
// both at once, along the same edge (bottom or top): they glance at each other, blush, ^^, a heart each
const BOTH: Beat = {
  dur: 5.2,
  pose: (t) => ({
    p: ramp(t, 0, 1) - ramp(t, 4.6, 5.2), look: between(t, 1.1, 1.25) ? 1 : between(t, 1.25, 3.2) ? 2 : 0,
    lid: blink(t, 1.9), tilt: 4 * inOut(t, 2.3, 2.6, 3.2, 3.5), happy: between(t, 3.2, 4.2), blush: inOut(t, 2.3, 2.7, 4.2, 4.6),
  }),
  hearts: [{ at: 2.5, from: "lips" }],
};

// ── a head: built once, posed every frame of a peek ──
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string) => { const e = document.createElement(tag); e.style.cssText = css; return e; };
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number>) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); return e; };

const makeHead = (who: Who, layer: HTMLElement) => {
  const hb = PAINTED.boxes[`${who}.head`], [hx, hy, hw, hh] = hb, sh = SHAPE[who], src = SRC[who];
  const B = FRONT.boxes;
  const at = (box: V, s: string) => el("img", `position:absolute;left:${box[0] - hx}px;top:${box[1] - hy}px;width:${box[2]}px;height:${box[3]}px;${s}`);
  const root = el("div", `position:absolute;left:0;top:0;width:${hw}px;height:${hh}px;transform-origin:50% 50%;will-change:transform;visibility:hidden`);
  // (each view fades out under its own chin: a mask on the views, not on this box, which would cut the wider profile)
  const fadeMask = (a: number, b: number) => { const g = `linear-gradient(to bottom,#000 ${a * 100}%,transparent ${b * 100}%)`; return `-webkit-mask-image:${g};mask-image:${g}`; };
  const face = el("div", "position:absolute;inset:0");
  root.appendChild(face);
  const head = el("img", `position:absolute;left:0;top:0;width:${hw}px;height:${hh}px`);
  head.src = src.head; face.appendChild(head);
  const looks = [1, 2].map((n) => { const i = at(B[`${who}.look${n}`], "display:none"); i.src = src.look[n - 1]; face.appendChild(i); return i; });
  // the blush (soft pink under the eyes)
  const svg = svgEl("svg", { width: hw, height: hh, viewBox: `${hx} ${hy} ${hw} ${hh}` }) as SVGSVGElement;
  svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
  const blurId = `peek-blush-${who}`;
  const defs = svgEl("defs", {}), f = svgEl("filter", { id: blurId, x: "-50%", y: "-50%", width: "200%", height: "200%" });
  f.appendChild(svgEl("feGaussianBlur", { stdDeviation: 7 })); defs.appendChild(f); svg.appendChild(defs);
  const blush = svgEl("g", { opacity: 0 });
  for (const c of sh.blush) blush.appendChild(svgEl("ellipse", { cx: c[0], cy: c[1], rx: 26, ry: 13, fill: "#ff7f86", filter: `url(#${blurId})` }));
  svg.appendChild(blush);
  // the lids (PaintedCouple's PaintedLids, per eye so one can wink): the closed-eye skin down to the lid + the lash line
  const lb = PAINTED.boxes[`${who}.lids`], E = PAINTED.eyes[who];
  const lidImgs = E.eyes.map(() => { const i = at(lb, "display:none"); i.src = src.lids; return i; });
  face.append(...lidImgs);
  face.appendChild(svg);
  const lash = E.eyes.map(() => { const p = svgEl("path", { stroke: E.ink, "stroke-linecap": "round", fill: "none", opacity: 0.92 }); svg.appendChild(p); return p; });
  const setLid = (i: number, shut: number, happy: boolean) => {
    const e = E.eyes[i], img = lidImgs[i], line = lash[i];
    if (happy) shut = 1;
    if (shut <= 0.02) { img.style.display = "none"; line.setAttribute("d", ""); return; }
    const h = e.bot - e.top + 8, y = e.top - 4 + h * shut;
    const x0 = e.l[0] - 8 - lb[0], x1 = e.r[0] + 8 - lb[0];
    img.style.display = "";
    img.style.clipPath = shut >= 1 ? `polygon(${x0}px 0,${x1}px 0,${x1}px 100%,${x0}px 100%)` : `polygon(${x0}px 0,${x1}px 0,${x1}px ${y - lb[1]}px,${x0}px ${y - lb[1]}px)`;
    const eh = e.bot - e.top, mxe = (e.l[0] + e.r[0]) / 2, cy = (e.l[1] + e.r[1]) / 2;
    line.setAttribute("d", happy
      ? `M ${e.l[0] + 4} ${cy + eh * 0.15} Q ${mxe} ${cy - eh * 0.75} ${e.r[0] - 4} ${cy + eh * 0.15}`
      : shut >= 1 ? `M ${e.l[0]} ${e.l[1]} Q ${mxe} ${cy + eh * 0.45} ${e.r[0]} ${e.r[1]}`
        : `M ${e.l[0] + 2} ${y} L ${e.r[0] - 2} ${y}`);
    line.setAttribute("stroke-width", String(happy ? 6 : 5));
  };
  // Dan's crosses on the front head (both lobes)
  if (sh.lobes.length) {
    goldGradient(svg, `peek-gold-${who}`);
    for (const [x, y] of sh.lobes) crossEarring(svg, `peek-gold-${who}`, x, y, EARRING_L);
  }
  // the front pieces in one layer (narrowing away in a turn), the side view in another (round 35): the profile sized so its
  // eye-to-chin is the front's, its eye on the front's eye line, its neck on the front's (the head turns on its neck)
  const neckX = PAINTED.pivots[`${who}.head`][0] - hx;
  const front = el("div", `position:absolute;inset:0;transform-origin:${neckX}px 50%;${fadeMask(sh.fade[0], sh.fade[1])}`);
  front.append(...Array.from(face.childNodes));
  face.appendChild(front);
  const eyeY = E.eyes.reduce((a, e) => a + (e.top + e.bot) / 2, 0) / E.eyes.length;
  const sb = SIDE.boxes[`${who}.side`], se = SIDE.eye[who], sn = SIDE.neck[who];
  const sc = (sh.chin - eyeY) / (SIDE.chin[who][1] - se[1]);
  const sFade = (SIDE.chin[who][1] + 22 - sb[1]) / sb[3]; // (just under the profile's chin)
  const sideV = el("div", `position:absolute;left:${neckX - (sn[0] - sb[0]) * sc}px;top:${eyeY - hy - (se[1] - sb[1]) * sc}px;width:${sb[2] * sc}px;height:${sb[3] * sc}px;transform-origin:${(sn[0] - sb[0]) * sc}px 50%;display:none;${fadeMask(sFade, Math.min(1, sFade + 0.09))}`);
  const sideImg = el("img", "position:absolute;inset:0;width:100%;height:100%");
  sideImg.src = src.side;
  // (decoded now, while the page starts: the first turn to the profile cost a dropped frame or a 0.2 s hitch otherwise)
  for (const im of [head, sideImg]) im.decode().catch(() => {});
  sideV.appendChild(sideImg);
  if (who === "dan") {
    const ss = svgEl("svg", { viewBox: `${sb[0]} ${sb[1]} ${sb[2]} ${sb[3]}`, width: "100%", height: "100%" }) as SVGSVGElement;
    ss.style.cssText = "position:absolute;inset:0;overflow:visible";
    goldGradient(ss, `peek-gold-${who}-side`);
    crossEarring(ss, `peek-gold-${who}-side`, SIDE.lobe.dan[0], SIDE.lobe.dan[1], EARRING_L / sc);
    sideV.appendChild(ss);
  }
  face.appendChild(sideV);
  layer.appendChild(root);
  // (`near`: the eye nearer the screen's middle, the one that winks; picked per peek)
  const pose = (P: Pose, near: number) => {
    const turn = P.side ?? 0;
    front.style.display = turn < 0.5 ? "" : "none";
    sideV.style.display = turn < 0.5 ? "none" : "";
    if (turn < 0.5) front.style.transform = turn > 0 ? `scaleX(${Math.max(0.06, 1 - 2 * turn)})` : "";
    else sideV.style.transform = turn < 1 ? `scaleX(${Math.max(0.06, 2 * turn - 1)})` : "";
    looks.forEach((im, i) => (im.style.display = (P.look ?? 0) === i + 1 && !P.happy ? "" : "none"));
    blush.setAttribute("opacity", String(0.55 * (P.blush ?? 0)));
    const lid = P.lid ?? 0, w = P.wink ?? 0;
    E.eyes.forEach((_, i) => setLid(i, Math.min(1, Math.max(lid, i === near ? w : 0)), !!P.happy));
  };
  const eyes = E.eyes.map((e) => [(e.l[0] + e.r[0]) / 2, (e.top + e.bot) / 2] as const);
  // the profile's lips in the head's own px (toast px), and which way it faces (Dan's to the right, Ange's to the left)
  // (any point of the profile picture → the head's own px)
  const sidePt = (x: number, y: number) => [neckX + hx + (x - sn[0]) * sc, eyeY + (y - se[1]) * sc] as const;
  const sm = SIDE.mouth[who];
  const sideMouth = sidePt(sm[0], sm[1]);
  const faces = Math.sign(sm[0] - sn[0]) as 1 | -1;
  // (the top of the head: where dizzy stars circle, where a stolen heart sits)
  const crown = [hx + hw / 2, hy + 4] as const;
  return { who, root, hw, hh, pose, center: [hx + hw / 2, hy + hh / 2] as const, mouth: FRONT.mouth[who], eyes, sideMouth, faces, sidePt, crown };
};
type Head = ReturnType<typeof makeHead>;

// ── where a head peeks from: its edge, along it, its turn, its size ──
// Round 34b (2026-11-25, the user: "if from right, left, or top no need to apply the gravity … flat na treat mo sya as ang
// bottom nya yung left, right or top"): the edge a head comes from is its floor. It comes in straight from it, its neck on
// the edge: upright from the bottom, on its side from the left (90°) or the right (−90°), upside down from the top (180°),
// a few degrees of tilt only. The glance pieces look sideways in the head, so on a side edge (sideways = up / down the
// screen) the glance is left out; from the top Dan peeks on the right half + Ange on the left, so upside down their glance
// still goes to the middle (and at each other when both peek from the top)
type Spot = { edge: Edge; along: number; rot: number; size: number };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const EDGES: Record<Who, Edge[]> = { dan: ["left", "bottom", "top"], ange: ["right", "bottom", "top"] };
const FLOOR: Record<Edge, number> = { bottom: 0, left: 90, right: -90, top: 180 };
// (the florals sit top-left + bottom-right, the monogram in the middle, the date under it: the spots keep clear of them)
const spotFor = (who: Who, edge: Edge): Spot => {
  const size = rnd(0.25, 0.29); // the head's height, a share of the screen's
  const along =
    edge === "left" ? rnd(0.42, 0.66) : edge === "right" ? rnd(0.3, 0.52)
      : edge === "top" ? (who === "dan" ? rnd(0.76, 0.86) : rnd(0.33, 0.4))
        : who === "dan" ? rnd(0.13, 0.27) : rnd(0.645, 0.69);
  // (from the bottom tipped a little toward the middle, as before; elsewhere a little either way)
  const tip = edge === "bottom" ? (who === "dan" ? 1 : -1) * rnd(3, 11) : rnd(3, 9) * (Math.random() < 0.5 ? -1 : 1);
  return { edge, along, rot: FLOOR[edge] + tip, size };
};
// a pose's `p` → the head's centre on the screen: how much of the head is in from its edge, along the head (the eyes at
// .5, down past the mouth at 1)
const place = (H: Head, s: Spot, P: Pose) => {
  const W = innerWidth, Hs = innerHeight, k = (s.size * Hs) / H.hh, sh = SHAPE[H.who];
  const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
  // (round 39, "kita na headless": never further in than just past the top of the fade under the chin; further, the
  // whole head floats with the edge of its picture in sight)
  const p = Math.min(P.p, P_MAX[H.who]);
  const vis = p <= 0.5 ? lerp(0, sh.eyes + 0.07, p / 0.5) : lerp(sh.eyes + 0.07, sh.mouth + 0.1, (p - 0.5) / 0.5);
  const d = vis * H.hh * k - (H.hh * k) / 2; // the centre's distance in from the edge
  if (s.edge === "bottom") return { x: s.along * W, y: Hs - d, k };
  if (s.edge === "top") return { x: s.along * W, y: d, k };
  return { x: s.edge === "left" ? d : W - d, y: s.along * Hs, k };
};

// ── the hearts: a little one floats off the lips / by the eye, in the theme's colour (the date's), away from the head's
// edge (its "up") and a little to the side ──
const HEART = "M12 21s-7.5-4.6-9.6-9.1C.9 8.7 2.7 5 6.3 5c2.2 0 3.6 1.3 4.2 2.6h3c.6-1.3 2-2.6 4.2-2.6 3.6 0 5.4 3.7 3.9 6.9C19.5 16.4 12 21 12 21z";
const heartAt = (layer: HTMLElement, x: number, y: number, k: number, up: readonly number[], side: readonly number[]) => {
  const size = Math.max(20, 95 * k);
  const d = el("div", `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;pointer-events:none`);
  const s = svgEl("svg", { viewBox: "0 0 24 24", width: size, height: size });
  s.appendChild(svgEl("path", { d: HEART, fill: "var(--date)" }));
  d.appendChild(s); layer.appendChild(d);
  const dx = (side[0] * 0.9 + up[0] * 1.6) * size, dy = (side[1] * 0.9 + up[1] * 1.6) * size, r = dx >= 0 ? 1 : -1;
  d.animate(
    [
      { transform: "translate(0,0) scale(.2)", opacity: 0 },
      { transform: `translate(${dx * 0.2}px,${dy * 0.15}px) scale(1.1)`, opacity: 1, offset: 0.2 },
      { transform: `translate(${dx * 0.6}px,${dy * 0.6}px) scale(.95) rotate(${r * 8}deg)`, opacity: 0.9, offset: 0.65 },
      { transform: `translate(${dx}px,${dy}px) scale(.8) rotate(${r * 14}deg)`, opacity: 0 },
    ],
    { duration: 1700, easing: "ease-out" },
  ).onfinish = () => d.remove();
};

// ── the shows (round 36, 2026-11-26; the user: "both flying kiss then mag tatagpo sa gitna yung heart then booom, like,
// arrowing the monogram, then the arrow stuck pero sympre mawawala after nila mawala din" → "go lahat"): a show = one or
// more heads, each with its spot(s) + pose on the same clock, plus what leaves them (`fx`: the flying hearts, the BOOM,
// the arrow), drawn in the layer OVER the monogram (#peekFx; the heads stay under it). Every frame is a function of the
// clock, so a frozen `at` shows that moment. The beats above are one-head shows.
type Where = { x: number; y: number; k: number; deg: number; near: number; P: Pose };
type Part = { H: Head; spot: (t: number) => Spot; pose: (t: number) => Pose; hearts?: Hearts; z?: number };
type Show = { dur: number; parts: Part[]; fx?: (t: number, w: Where[]) => void; end?: () => void };
// (round 38: `heart(false)` takes the monogram's heart away, `heart(true)` puts it back)
export type PeekHooks = { boom: (x: number, y: number) => void; pulse: (scale: number) => void; heart?: (on: boolean) => void };
const PAIR_SHOWS = ["both", "kissboom", "taguan", "stolen", "bonk", "battle", "nakaw", "agawan"] as const;
// (the arrow comes from a side edge: round 37's arrow is the monogram's own flat colour, so a tip coming out UNDER the
// heart (Dan from the top) sank into the J's stroke. From the right it flies straight in; round 39, from the left on a
// curve over the A (`curveTo`). No glance on a side edge, so either one can shoot from either side)
const shooterSide = (edge?: Edge): Edge => (edge === "left" || edge === "right" ? edge : Math.random() < 0.5 ? "left" : "right");
// the monogram's ink, flat (its gradient's middle stop, by the theme on the page)
const inkNow = () => INK[asTheme(document.body.dataset.theme) ?? "green"].stops[1];

// the monogram's heart on the screen (the SVG is drawn at its viewBox's aspect, so one scale `u`)
const monoBox = () => {
  const s = document.querySelector<SVGSVGElement>(".monogram svg");
  if (!s) return null;
  const r = s.getBoundingClientRect();
  return r.width > 0 ? { left: r.left, top: r.top, u: r.width / MONOGRAM.w } : null;
};
const heartOnScreen = () => {
  const m = monoBox();
  if (!m) return null;
  const [hx, hy, hw, hh] = MONOGRAM.heartBox;
  return { x: m.left + (hx + hw / 2) * m.u, y: m.top + (hy + hh * 0.45) * m.u, w: hw * m.u };
};
// a shape (on a 24-unit box) in the fx layer, placed by its centre each frame (op 0 = hidden); `cy` = its middle's height
// on the box, as a share (a heart's middle sits low); `base` = the px it's drawn at (round 39: the battle's giant heart
// is drawn at its full size, not 100 px blown up ~5x: a 0.2–0.5 s frame now and then as it swelled, its glow redrawn)
type Setter = (x: number, y: number, size: number, rot: number, op: number) => void;
const sprite = (layer: HTMLElement, made: HTMLElement[], d: string, fill: string, glow: boolean, cy = 0.5, base = 100): Setter => {
  // (turned + sized round its own middle, so a heart turned upside down stays where it's put)
  const g = el("div", `position:absolute;left:0;top:0;width:${base}px;height:${base}px;opacity:0;transform-origin:50% ${cy * 100}%;will-change:transform,opacity;${glow ? "filter:drop-shadow(0 0 7px var(--date-glow))" : ""}`);
  const s = svgEl("svg", { viewBox: "0 0 24 24", width: base, height: base });
  s.appendChild(svgEl("path", { d, fill }));
  g.appendChild(s); layer.appendChild(g); made.push(g);
  return (x, y, size, rot, op) => {
    g.style.opacity = String(Math.max(0, Math.min(1, op)));
    if (op > 0) g.style.transform = `translate(${x - base / 2}px,${y - cy * base}px) rotate(${rot}deg) scale(${size / base})`;
  };
};
// a heart in the fx layer
const flyer = (layer: HTMLElement, glow: boolean, made: HTMLElement[], fill = "var(--date)", base = 100) => sprite(layer, made, HEART, fill, glow, 0.54, base);
// round 38: a star (the bonk's, the dizzy ones circling a head)
const STAR = "M12 1.6l3.05 6.85 7.45.68-5.62 4.93 1.66 7.3L12 17.55l-6.54 3.81 1.66-7.3L1.5 9.13l7.45-.68z";
// a word that pops (the bonk's), in the date's font + colour, placed by its centre, `size` = its letters' height
const word = (layer: HTMLElement, made: HTMLElement[], text: string): Setter => {
  const d = el("div", "position:absolute;left:0;top:0;opacity:0;white-space:nowrap;font-family:'Jost',system-ui,sans-serif;font-weight:700;font-size:100px;line-height:1;letter-spacing:.03em;color:var(--date);text-shadow:0 0 18px var(--date-glow);transform-origin:0 0;will-change:transform,opacity");
  d.textContent = text; layer.appendChild(d); made.push(d);
  return (x, y, size, rot, op) => {
    d.style.opacity = String(Math.max(0, Math.min(1, op)));
    if (op > 0) d.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg) scale(${size / 72}) translate(-50%,-50%)`;
  };
};
const easeIO = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeIn = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x);
// the `p` that shows `vis` of a head (its share of the head picture's height in from the edge; place() backwards)
const pForVis = (who: Who, vis: number) => {
  const e = SHAPE[who].eyes + 0.07, m = SHAPE[who].mouth + 0.1;
  return vis <= e ? (0.5 * vis) / e : 0.5 + (0.5 * (vis - e)) / (m - e);
};
// as far in as a head ever comes (place() holds it there): 30% into the fade under its chin (Dan p 1.04, Ange 1.3)
const VIS_MAX = (who: Who) => SHAPE[who].fade[0] + 0.3 * (SHAPE[who].fade[1] - SHAPE[who].fade[0]);
const P_MAX: Record<Who, number> = { dan: pForVis("dan", VIS_MAX("dan")), ange: pForVis("ange", VIS_MAX("ange")) };

// the arrow (rounds 36–37, shared with round 38's missed shot): in the monogram's units over its SVG, the monogram's flat
// ink + its glow, tip at the head. It sinks into `hole` (the heart, or the letters' ink): a mask round `at` (monogram
// units), on only once the tip is near there (a mask over the whole screen cost a 0.5 s frame); it quivers round `at`
type MonoBox = { left: number; top: number; u: number };
const arrowSprite = (layer: HTMLElement, made: HTMLElement[], hole: string, at: readonly number[], id: string) => {
  const s = MONOGRAM.heartBox[2], L = 3.1 * s, th = 0.1 * s, hl = 0.5 * s, F = 0.62 * s;
  const svg = svgEl("svg", { viewBox: `0 0 ${MONOGRAM.w} ${MONOGRAM.h}` }) as SVGSVGElement;
  svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;opacity:0;filter:drop-shadow(0 0 5px var(--svg-glow))";
  const defs = svgEl("defs", {}), [cx, cy] = at, R = 1.6 * (L + s);
  const mask = svgEl("mask", { id, maskUnits: "userSpaceOnUse", x: cx - R, y: cy - R, width: 2 * R, height: 2 * R });
  mask.appendChild(svgEl("rect", { x: cx - R, y: cy - R, width: 2 * R, height: 2 * R, fill: "#fff" }));
  mask.appendChild(svgEl("path", { d: hole, fill: "#000" }));
  defs.appendChild(mask); svg.appendChild(defs);
  let col = inkNow(), masked = false;
  // (the mask on the outer group, the quiver inside it: the hole stays put while the arrow shakes)
  const holder = svgEl("g", {}), wob = svgEl("g", {}), arrow = svgEl("g", { fill: col });
  for (const sg of [-1, 1]) // the feathers, slanting back
    arrow.appendChild(svgEl("path", { d: `M${-L + F} 0L${-L + 0.38 * F} ${sg * 0.3 * F}L${-L - 0.1 * F} ${sg * 0.3 * F}L${-L + 0.12 * F} 0Z` }));
  arrow.appendChild(svgEl("rect", { x: -L, y: -th / 2, width: L - hl * 0.5, height: th, rx: th / 2 }));
  arrow.appendChild(svgEl("path", { d: HEART, transform: `rotate(-90) scale(${hl / 16}) translate(-12 -21)` }));
  wob.appendChild(arrow); holder.appendChild(wob); svg.appendChild(holder); layer.appendChild(svg); made.push(svg as unknown as HTMLElement);
  // (the tip in monogram units, the heading in degrees, the quiver in degrees, the opacity)
  return (m: MonoBox | null, tip: readonly number[], deg: number, quiver: number, op: number) => {
    if (!m || op <= 0) { svg.style.opacity = "0"; return; }
    svg.style.width = `${MONOGRAM.w * m.u}px`;
    svg.style.transform = `translate(${m.left}px,${m.top}px)`;
    const c = inkNow();
    if (c !== col) { col = c; arrow.setAttribute("fill", c); }
    arrow.setAttribute("transform", `translate(${tip[0]} ${tip[1]}) rotate(${deg})`);
    const inside = Math.hypot(tip[0] - cx, tip[1] - cy) < 1.15 * (L + s);
    if (inside !== masked) { masked = inside; if (inside) holder.setAttribute("mask", `url(#${id})`); else holder.removeAttribute("mask"); }
    wob.setAttribute("transform", quiver ? `rotate(${quiver} ${cx} ${cy})` : "");
    svg.style.opacity = String(Math.min(1, op));
  };
};
// where the arrow flies to in the monogram: the heart's middle (a hit), the A's thick right stroke near its top (the
// round-38 miss: measured on the ink, rows 180–220 run 774–846, so (812, 200) is inside it)
const HEART_AIM = [MONOGRAM.heartBox[0] + MONOGRAM.heartBox[2] / 2, MONOGRAM.heartBox[1] + MONOGRAM.heartBox[3] * 0.48] as const;
const A_AIM = [812, 200] as const;
// round 39: from the left, the A in the way. The missed shot falls short into the A's thick top (rows 120–140 run
// 832–886 / 830–870), reached from up-left over clear screen; the hit flies a curve over the A and comes into the heart
// no steeper than ENTRY (measured: a flight up to ~36° down comes out of the heart clear; steeper, the tip sinks into the
// J under it), so its tip comes out the far side as from the right
const A_TOP = [858, 128] as const;
const ENTRY = 28;
type Pt = readonly number[];
const bez = (P: Pt[], u: number) => { const m = 1 - u, a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u; return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]; };
const bezD = (P: Pt[], u: number) => { const m = 1 - u, a = 3 * m * m, b = 6 * m * u, c = 3 * u * u; return [a * (P[1][0] - P[0][0]) + b * (P[2][0] - P[1][0]) + c * (P[3][0] - P[2][0]), a * (P[1][1] - P[0][1]) + b * (P[2][1] - P[1][1]) + c * (P[3][1] - P[2][1])]; };
// the arrow's curve from S into E (monogram units), arriving at `entry` degrees (0 = right, + = down): the lowest arc
// over the letters on which nothing of the arrow (its tip's path, its shaft behind the tip) crosses their ink, tested
// on the page's own ink path (inside `near` of E it's meant to: the tip sinking in), kept on the screen; its length
// table so it flies at an even pace. Worked out once, when a show starts (a few ms)
type Curve = { P: Pt[]; len: number[] };
const curveTo = (m: MonoBox, S: Pt, E: Pt, entry: number, near: number): Curve => {
  const ink = document.querySelector<SVGPathElement>(".monogram svg [data-ink]"), pt = ink?.ownerSVGElement?.createSVGPoint();
  const inInk = (x: number, y: number) => { if (!ink || !pt) return false; pt.x = x; pt.y = y; return ink.isPointInFill(pt); };
  const a = (entry * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)], dist = Math.hypot(E[0] - S[0], E[1] - S[1]);
  const L = 3.1 * MONOGRAM.heartBox[2], top = (0.06 * innerHeight - m.top) / m.u;
  const make = (lift: number, lam: number): Pt[] => [S, [S[0] + 0.4 * (E[0] - S[0]), Math.min(S[1], E[1]) - lift], [E[0] - d[0] * lam * dist, E[1] - d[1] * lam * dist], E];
  const test = (P: Pt[]) => {
    for (let i = 0; i <= 40; i++) {
      const b = bez(P, i / 40);
      if (b[1] < top) return "high";
      if (Math.hypot(b[0] - E[0], b[1] - E[1]) < near) continue;
      const g = bezD(P, i / 40), gl = Math.hypot(g[0], g[1]) || 1;
      for (const s of [0, 0.35, 0.7, 1]) if (inInk(b[0] - (g[0] / gl) * s * L, b[1] - (g[1] / gl) * s * L)) return "ink";
    }
    return "ok";
  };
  let P = make(200, 0.35);
  search: for (const lam of [0.3, 0.42]) for (let lift = 60; lift <= 1600; lift += 60) {
    const Q = make(lift, lam), r = test(Q);
    if (r === "high") break;
    P = Q;
    if (r === "ok") break search;
  }
  const len = [0];
  for (let i = 1, prev = bez(P, 0); i <= 60; i++) { const b = bez(P, i / 60); len.push(len[i - 1] + Math.hypot(b[0] - prev[0], b[1] - prev[1])); prev = b; }
  return { P, len };
};
// the arrow along a curve, `f` = 0..1 of its flight (an even pace, easing out), then on straight for `out` (through the
// heart and out the far side)
const flightAlong = (arrow: ReturnType<typeof arrowSprite>, m: MonoBox, c: Curve, out: number, f: number, quiver: number, op: number) => {
  const total = c.len[60], s = (1 - (1 - Math.min(1, Math.max(0, f))) ** 1.35) * (total + out);
  let tip: Pt, g: Pt;
  if (s <= total) {
    let i = 1;
    while (i < 60 && c.len[i] < s) i++;
    const u = (i - 1 + (s - c.len[i - 1]) / Math.max(1e-6, c.len[i] - c.len[i - 1])) / 60;
    tip = bez(c.P, u); g = bezD(c.P, u);
  } else {
    g = bezD(c.P, 1);
    const gl = Math.hypot(g[0], g[1]) || 1, E = c.P[3];
    tip = [E[0] + (g[0] / gl) * (s - total), E[1] + (g[1] / gl) * (s - total)];
  }
  arrow(m, tip, (Math.atan2(g[1], g[0]) * 180) / Math.PI, quiver, op);
};

// the test keys (main.tsx; listed in the H list): the letter, the show, its name on screen, the who / edge it goes
// round on each press. Round 39: 0 = all of them non-stop, one after another; 9 = stop them all
const SINGLE: [Who, Edge][] = [["dan", "left"], ["ange", "right"], ["dan", "bottom"], ["ange", "bottom"], ["dan", "top"], ["ange", "top"]];
const PAIR_EDGES: [Who | "both", Edge][] = [["both", "bottom"], ["both", "top"]];
const SHOOTERS: [Who, Edge][] = [["dan", "right"], ["ange", "left"], ["ange", "right"], ["dan", "left"]];
// (the heart battle's: who blows the first little heart, at the bottom or upside down from the top)
const BATTLES: [Who, Edge][] = [["dan", "bottom"], ["ange", "top"], ["ange", "bottom"], ["dan", "top"]];
export const TEST_KEYS: { key: string; name: string; label: string; v: [Who | "both", Edge][]; first?: boolean }[] = [
  { key: "q", name: "sneak", label: "Sneak", v: SINGLE },
  { key: "w", name: "wink", label: "Wink", v: SINGLE },
  { key: "g", name: "giggle", label: "Giggle", v: SINGLE },
  { key: "c", name: "caught", label: "Caught", v: SINGLE },
  { key: "y", name: "pop", label: "Pop", v: SINGLE },
  { key: "b", name: "both", label: "Both glance", v: PAIR_EDGES },
  { key: "k", name: "kissboom", label: "Flying kiss", v: PAIR_EDGES },
  { key: "u", name: "cupid", label: "Cupid's arrow", v: SHOOTERS },
  { key: "m", name: "sablay", label: "Missed arrow", v: SHOOTERS },
  { key: "t", name: "taguan", label: "Hide-and-seek", v: [["both", "bottom"]] },
  { key: "x", name: "stolen", label: "Stolen kiss", v: [["both", "bottom"]] },
  { key: "o", name: "bonk", label: "Bonk", v: [["both", "bottom"]] },
  { key: "v", name: "battle", label: "Heart battle", v: BATTLES, first: true },
  { key: "n", name: "nakaw", label: "Stolen heart", v: [["both", "bottom"]] },
  { key: "a", name: "agawan", label: "Fight for the spot", v: [["both", "bottom"]] },
];

// ── the player ──
export const startPeeks =(layer: HTMLElement, fxLayer: HTMLElement = layer, hooks: PeekHooks = { boom: () => {}, pulse: () => {} }) => {
  const heads: Record<Who, Head> = { dan: makeHead("dan", layer), ange: makeHead("ange", layer) };
  let on = true, timer = 0, raf = 0, last = "", lastWho: Who | "both" = "both", lastPair = "";
  // (round 39: 0 = non-stop, every test key's every variant one after another, shuffled, no show twice in a row)
  let nonstop = false, queue: [(typeof TEST_KEYS)[number], Who | "both", Edge][] = [];
  let current: Show | null = null;
  const ready = () => document.body.classList.contains("written") && !document.body.classList.contains("playing") && !document.hidden;
  // both: side by side along the bottom or the top (Dan left + Ange right at the bottom, the other way round upside down)
  const pair = (edge: Edge = Math.random() < 0.5 ? "bottom" : "top") => [{ H: heads.dan, spot: spotFor("dan", edge) }, { H: heads.ange, spot: spotFor("ange", edge) }];
  const pickBeat = () => { const names = [...Object.keys(BEATS), "cupid", "sablay"].filter((n) => n !== last); const n = names[Math.floor(Math.random() * names.length)]; last = n; return n; };

  // a point on the head (picture px) → the screen, the head at (x, y), turned `deg`, sized `k`
  const onScreen = (H: Head, x: number, y: number, deg: number, k: number, px: number, py: number) => {
    const a = (deg * Math.PI) / 180, lx = (px - H.center[0]) * k, ly = (py - H.center[1]) * k;
    return [x + lx * Math.cos(a) - ly * Math.sin(a), y + lx * Math.sin(a) + ly * Math.cos(a)] as const;
  };
  const at = (H: Head, w: Where, px: number, py: number) => onScreen(H, w.x, w.y, w.deg, w.k, px, py);
  // the eye nearer the screen's middle (it winks; the hearts come out on its side)
  const nearEye = (H: Head, spot: Spot) => {
    const { x, y, k } = place(H, spot, { p: 1 }), cx = innerWidth / 2, cy = innerHeight / 2;
    const dist = H.eyes.map((e) => { const [ex, ey] = onScreen(H, x, y, spot.rot, k, e[0], e[1]); return Math.hypot(ex - cx, ey - cy); });
    return dist[0] <= dist[1] ? 0 : 1;
  };
  // (a head's Where for a spot + pose: what the frame would give at that moment, for things fixed at a moment (where an
  // arrow leaves from), so a still held later shows them the same)
  const whereOf = (H: Head, spot: Spot, P: Pose): Where => { const { x, y, k } = place(H, spot, P); return { x, y, k, deg: spot.rot + (P.tilt ?? 0), near: 0, P }; };
  const simple = (cast: { H: Head; spot: Spot }[], beat: Beat): Show =>
    ({ dur: beat.dur, parts: cast.map(({ H, spot }) => ({ H, spot: () => spot, pose: beat.pose, hearts: beat.hearts })) });

  const stop = () => {
    cancelAnimationFrame(raf); raf = 0;
    for (const H of Object.values(heads)) { H.root.style.visibility = "hidden"; H.root.style.zIndex = ""; }
    current?.end?.(); current = null;
  };
  const run = (show: Show, freeze?: number, over?: Partial<Pose>) => {
    stop();
    current = show;
    const t0 = performance.now() - (freeze ?? 0) * 1000;
    const fired = new Set<number>(), where: Where[] = [];
    // (the near eye per part, worked out again only when its spot changes: a spot that slides is a new one every frame)
    const lastSpot: (Spot | null)[] = show.parts.map(() => null), lastNear: number[] = show.parts.map(() => 0);
    for (const p of show.parts) if (p.z) p.H.root.style.zIndex = String(p.z);
    const frame = () => {
      const t = Math.min(freeze ?? (performance.now() - t0) / 1000, show.dur);
      show.parts.forEach((part, ci) => {
        const { H } = part, spot = part.spot(t);
        const P0 = { ...part.pose(t), ...over };
        // (on a side edge the sideways glance would look up / down the screen: left out)
        const P: Pose = spot.edge === "left" || spot.edge === "right" ? { ...P0, look: 0 } : P0;
        const { x, y, k } = place(H, spot, P);
        const deg = spot.rot + (P.tilt ?? 0);
        if (lastSpot[ci] !== spot) { lastSpot[ci] = spot; lastNear[ci] = nearEye(H, spot); }
        const near = lastNear[ci];
        H.root.style.visibility = P.p > 0.002 ? "visible" : "hidden";
        const sq = P.squash ?? 0;
        H.root.style.transform = `translate(${x - H.hw / 2}px,${y - H.hh / 2}px) rotate(${deg}deg) scale(${sq ? `${k * (1 - sq)},${k * (1 + 0.6 * sq)}` : k})`;
        H.pose(P, near);
        const w = (where[ci] = { x, y, k, deg, near, P });
        (part.hearts ?? []).forEach((h, i) => {
          const key = ci * 100 + i;
          if (t < h.at || fired.has(key)) return;
          fired.add(key);
          // beside the face on the near eye's side (never over it), off the lips' height or above the eye; a profile's
          // ahead of its face
          const e = H.eyes[near], sd = h.from === "side" ? H.faces : Math.sign(e[0] - H.center[0]) || 1;
          const [px, py] = h.from === "side" ? [H.sideMouth[0] + H.faces * 150, H.sideMouth[1] - 70]
            : h.from === "lips" ? [H.center[0] + sd * 195, H.mouth[1] - 30] : [H.center[0] + sd * 185, e[1] - 95];
          const [hx, hy] = at(H, w, px, py);
          const a = (deg * Math.PI) / 180;
          heartAt(layer, hx, hy, k, [Math.sin(a), -Math.cos(a)], [sd * Math.cos(a), sd * Math.sin(a)]);
        });
      });
      show.fx?.(t, where);
      if (freeze !== undefined) raf = 0;
      else if (t < show.dur) raf = requestAnimationFrame(frame);
      else { raf = 0; stop(); schedule(); }
    };
    raf = requestAnimationFrame(frame);
  };

  // 1 · the flying kiss → BOOM. Round 37 (2026-11-26, the user: "flying kiss should use the side view harapan dapat"; the
  // front pucker rejected): both come up, glance at each other, turn to their profiles FACING each other, lean in and
  // blow: a heart leaves each one's lips, forward, at the other; the two sweep round and meet on the monogram's heart, one
  // from either side: a flash + glints (the bokeh's own burst), the heart thumps, a ring of hearts goes out; they jump a
  // little, turn back to us, ^^, blushing, a giggle
  const kissBoom = (edge?: Edge): Show => {
    const cast = pair(edge);
    const LAUNCH = 2.12, MEET = 3.32, made: HTMLElement[] = [];
    const pose = (H: Head) => (t: number): Pose => ({
      p: ramp(t, 0, 0.9) - ramp(t, 6.1, 6.7) + 0.06 * inOut(t, MEET, MEET + 0.07, MEET + 0.12, MEET + 0.45),
      look: between(t, 0.95, 1.08) ? 1 : between(t, 1.08, 1.5) ? 2 : 0, lid: blink(t, 1.22),
      side: ramp(t, 1.5, 1.74) - ramp(t, MEET + 0.5, MEET + 0.74),
      // (the blow: a lean in toward the other + back as the heart leaves; later the giggle's wobble, facing us)
      tilt: H.faces * 7 * inOut(t, 1.85, 2.05, 2.15, 2.45) + 5 * Math.sin((t - MEET) * 9.4) * inOut(t, MEET + 0.8, MEET + 0.95, 5.0, 5.3),
      happy: between(t, MEET + 0.75, 5.4),
      blush: inOut(t, MEET + 0.75, MEET + 1.1, 5.4, 5.9),
    });
    const hearts = cast.map(() => ({ main: flyer(fxLayer, true, made), trail: [0, 1, 2].map(() => flyer(fxLayer, false, made)) }));
    const ring = Array.from({ length: 10 }, () => flyer(fxLayer, false, made));
    let from: { S: readonly [number, number]; f: [number, number] }[] | null = null, boomed = false;
    return {
      dur: 6.7,
      parts: cast.map(({ H, spot }) => ({ H, spot: () => spot, pose: pose(H) })),
      end: () => made.forEach((d) => d.remove()),
      fx: (t, w) => {
        const C = heartOnScreen();
        if (!C) return;
        // (from just ahead of each profile's lips, where they are when the kiss leaves, going forward = at the other)
        if (t >= LAUNCH && !from) from = cast.map(({ H }, i) => {
          const a = (w[i].deg * Math.PI) / 180;
          return { S: at(H, w[i], H.sideMouth[0] + H.faces * 40, H.sideMouth[1]), f: [H.faces * Math.cos(a), H.faces * Math.sin(a)] };
        });
        const big = Math.max(48, C.w * 1.8); // (a 9 x 12 ft wall: the hearts must read from the back of the room)
        cast.forEach((_, i) => {
          const h = hearts[i], u = (t - LAUNCH) / (MEET - LAUNCH);
          if (!from || u < 0 || u > 1.1) { h.main(0, 0, 0, 0, 0); h.trail.forEach((f) => f(0, 0, 0, 0, 0)); return; }
          // (a curve that leaves forward, at the other one, and comes into the heart from its own side: the left one's
          // from the left, the right one's from the right, so they meet head on)
          const { S, f } = from[i], O = from[1 - i].S, len = Math.hypot(C.x - S[0], C.y - S[1]);
          const side = S[0] <= O[0] ? -1 : 1;
          const P1 = [S[0] + f[0] * 0.32 * len, S[1] + f[1] * 0.32 * len];
          const P2 = [C.x + side * 0.3 * len, C.y + Math.sign(S[1] - C.y) * 0.1 * len];
          const B = (v: number) => {
            const e = easeIO(v), m = 1 - e, a = m * m * m, b = 3 * m * m * e, c = 3 * m * e * e, d = e * e * e;
            return [a * S[0] + b * P1[0] + c * P2[0] + d * C.x, a * S[1] + b * P1[1] + c * P2[1] + d * C.y];
          };
          const beat = 1 + 0.08 * Math.sin(t * 15);
          const [x, y] = B(Math.min(u, 1));
          const size = big * (0.3 + 0.7 * easeIO(Math.min(u, 1))) * beat * (u > 1 ? 1 + 3 * (u - 1) : 1);
          h.main(x, y, size, 12 * Math.sin(u * Math.PI * 2), u > 1 ? 1 - (u - 1) / 0.1 : ramp(u, 0, 0.06));
          h.trail.forEach((f, j) => {
            const v = u - 0.055 * (j + 1);
            if (v < 0 || u > 1) { f(0, 0, 0, 0, 0); return; }
            const [tx, ty] = B(v);
            f(tx, ty, size * (0.55 - 0.12 * j), 0, 0.42 - 0.12 * j);
          });
        });
        if (t >= MEET && !boomed) { boomed = true; hooks.boom(C.x, C.y); hooks.pulse(1.5); }
        const tau = (t - MEET) / 1.3, R = Math.max(140, 0.17 * Math.min(innerWidth, innerHeight));
        ring.forEach((f, i) => {
          if (tau < 0 || tau > 1) { f(0, 0, 0, 0, 0); return; }
          const a = (i / ring.length) * Math.PI * 2 + 0.31, r = R * (1 - (1 - tau) ** 3);
          f(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r - 16 * tau, big * 0.5 * (1 - 0.4 * tau), 25 * Math.cos(a), tau < 0.08 ? tau / 0.08 : 1 - (tau - 0.08) / 0.92);
        });
      },
    };
  };

  // 2 · the cupid: one comes up, closes an eye to aim… an arrow flies up from beside the face and sticks THROUGH the
  // monogram's heart (the shaft + its feathers on the near side, the heart-tipped head out the far side, the part
  // inside hidden by the heart), it quivers, the heart thumps; a proud ^^ + a blush, back down; the arrow fades once
  // they've gone ("mawawala after nila mawala din"). Drawn in the monogram's own units over its SVG, in its own flat
  // colour with its glow (round 37: "make the arrow same color flat kung anong gamit ng svg (theme)")
  // (round 39: from either side; from the left on a curve over the A, a longer flight)
  const cupid = (who: Who, edge?: Edge): Show => {
    const side = shooterSide(edge), curved = side === "left", H = heads[who], spot = spotFor(who, side);
    const SHOOT = 2.05, HIT = SHOOT + (curved ? 0.8 : 0.45), made: HTMLElement[] = [];
    const pose = (t: number): Pose => ({
      p: 0.5 * ramp(t, 0, 0.8) + 0.35 * ramp(t, 1.0, 1.3) - 0.85 * ramp(t, HIT + 1.5, HIT + 2.1),
      lid: blink(t, 0.95), wink: inOut(t, 1.35, 1.45, SHOOT + 0.05, SHOOT + 0.15),
      tilt: 6 * inOut(t, 1.3, 1.5, SHOOT, SHOOT + 0.2) + 4 * Math.sin((t - HIT - 0.1) * 9.4) * inOut(t, HIT + 0.15, HIT + 0.3, HIT + 0.9, HIT + 1.1),
      happy: between(t, HIT + 0.1, HIT + 1.3), blush: inOut(t, HIT + 0.1, HIT + 0.45, HIT + 1.3, HIT + 1.7),
    });
    const arrow = arrowSprite(fxLayer, made, MONOGRAM.heart, HEART_AIM, "peek-arrow-mask");
    // (from beside the face, at the edge, on the heart's side: fixed by the pose at the shot; the curve worked out now)
    const m0 = monoBox(), S0 = m0 ? shotFrom(H, whereOf(H, spot, pose(SHOOT)), m0, HEART_AIM) : null;
    const C = curved && m0 && S0 ? curveTo(m0, S0, HEART_AIM, ENTRY, 0.5 * MONOGRAM.heartBox[2]) : null;
    let S: readonly number[] | null = null, hit = false;
    return {
      dur: HIT + 3.5,
      parts: [{ H, spot: () => spot, pose }],
      end: () => made.forEach((d) => d.remove()),
      fx: (t) => {
        const m = monoBox();
        if (!m || t < SHOOT) { arrow(null, [0, 0], 0, 0, 0); return; }
        S ??= S0 ?? shotFrom(H, whereOf(H, spot, pose(SHOOT)), m, HEART_AIM);
        const q = t - HIT, f = (t - SHOOT) / (HIT - SHOOT), quiver = q > 0 ? 6 * Math.exp(-5 * q) * Math.sin(38 * q) : 0, op = 1 - ramp(t, HIT + 2.4, HIT + 3.4);
        if (C) flightAlong(arrow, m, C, 1.12 * MONOGRAM.heartBox[2], f, quiver, op);
        else flight(arrow, m, S, HEART_AIM, true, f, quiver, op);
        if (t >= HIT && !hit) { hit = true; heartHit(1.22); }
      },
    };
  };
  // the arrow's start: beside the face, at the edge, on the side toward `aim` (or away from it: the missed shot's, up
  // over the heart), in monogram units
  const shotFrom = (H: Head, ww: Where, m: MonoBox, aim: readonly number[], away = false) => {
    const [bx, by] = at(H, ww, H.center[0], SHAPE[H.who].chin + 30);
    const a = (ww.deg * Math.PI) / 180, ex = Math.cos(a), ey = Math.sin(a);
    const ax = m.left + aim[0] * m.u, ay = m.top + aim[1] * m.u;
    const sg = ((ax - bx) * ex + (ay - by) * ey < 0 ? -1 : 1) * (away ? -1 : 1), off = 0.42 * H.hw * ww.k;
    return [(bx + sg * ex * off - m.left) / m.u, (by + sg * ey * off - m.top) / m.u] as const;
  };
  // an arrow from S to `aim` (monogram units), `f` = 0..1 of its flight: a hit goes through to come out the far side (the
  // tip out far enough that a bit of shaft shows between it + the heart: round 37's flat colour made the two hearts read
  // as one); a miss stops with its tip in the stroke
  const flight = (arrow: ReturnType<typeof arrowSprite>, m: MonoBox, S: readonly number[], aim: readonly number[], through: boolean, f: number, quiver: number, op: number) => {
    const dx = aim[0] - S[0], dy = aim[1] - S[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const out = through ? 1.12 * MONOGRAM.heartBox[2] : 0, T = [aim[0] + ux * out, aim[1] + uy * out];
    const e = 1 - (1 - Math.min(1, Math.max(0, f))) ** 1.6;
    arrow(m, [S[0] + (T[0] - S[0]) * e, S[1] + (T[1] - S[1]) * e], (Math.atan2(uy, ux) * 180) / Math.PI, quiver, op);
  };
  // the heart hit: it thumps, two little hearts pop off it
  const heartHit = (s: number) => {
    hooks.pulse(s);
    const hs = heartOnScreen();
    if (hs) for (const sd of [-1, 1]) heartAt(fxLayer, hs.x + sd * hs.w * 0.4, hs.y - hs.w * 0.3, hs.w / 150, [0, -1], [sd, 0]);
  };

  // round 38 · the missed arrow (sablay): as the cupid, from the right edge, but high up: the first arrow flies just over
  // the heart and sticks in the A (it quivers there). A blink-blink, a blush, they sink to the eyes and hide; come back
  // up lower down, aim again… the second goes through the heart; proud ^^. Both arrows fade once they've gone. Round 39,
  // from the left: the first one falls short, into the top of the A; back a little lower, a higher curve into the heart
  const sablay = (who: Who, edge?: Edge): Show => {
    const side = shooterSide(edge), curved = side === "left", H = heads[who], made: HTMLElement[] = [];
    const SHOOT1 = 2.05, MISS = SHOOT1 + (curved ? 0.65 : 0.45), d1 = MISS - 2.5, SWAP = 3.9 + d1;
    const BACK = 4.1 + d1, SHOOT2 = BACK + 1.65, HIT = SHOOT2 + (curved ? 0.8 : 0.45), PUP = 0.85;
    const missAim = curved ? A_TOP : A_AIM, m0 = monoBox(), hb = MONOGRAM.heartBox;
    let first: Spot, second: Spot;
    if (curved) {
      first = { edge: "left", along: rnd(0.5, 0.56), rot: FLOOR.left - 4, size: 0.27 };
      second = { edge: "left", along: rnd(0.4, 0.45), rot: FLOOR.left + 4, size: 0.27 };
    } else {
      // (high enough that the line from beside the face to the A passes over the heart with room: tried from 0.34 up)
      first = { edge: "right", along: 0.28, rot: FLOOR.right + 4, size: 0.27 };
      if (m0) for (let al = 0.34; al >= 0.2; al -= 0.02) {
        const sp: Spot = { edge: "right", along: al, rot: FLOOR.right + 4, size: 0.27 };
        const S = shotFrom(H, whereOf(H, sp, { p: PUP, tilt: 6 }), m0, A_AIM, true);
        const hx = hb[0] + hb[2] / 2, yAt = A_AIM[1] + ((S[1] - A_AIM[1]) * (hx - A_AIM[0])) / (S[0] - A_AIM[0]);
        first = sp;
        if (yAt < hb[1] - 0.45 * hb[3]) break;
      }
      second = { edge: "right", along: rnd(0.42, 0.46), rot: FLOOR.right - 4, size: 0.27 };
    }
    const pose = (t: number): Pose => t < SWAP ? {
      p: 0.5 * ramp(t, 0, 0.8) + (PUP - 0.5) * ramp(t, 1.0, 1.3) - (PUP - 0.45) * ramp(t, 3.05 + d1, 3.35 + d1) - 0.45 * ramp(t, 3.5 + d1, 3.8 + d1),
      lid: blink(t, 0.95) + blink(t, 2.7 + d1) + blink(t, 2.95 + d1), wink: inOut(t, 1.35, 1.45, SHOOT1 + 0.05, SHOOT1 + 0.15),
      tilt: 6 * inOut(t, 1.3, 1.5, SHOOT1, SHOOT1 + 0.2) - 5 * inOut(t, 2.6 + d1, 2.7 + d1, 3.0 + d1, 3.2 + d1), blush: ramp(t, 2.9 + d1, 3.2 + d1),
    } : {
      p: 0.5 * ramp(t, BACK, BACK + 0.5) + (PUP - 0.5) * ramp(t, BACK + 0.7, BACK + 0.9) - PUP * ramp(t, HIT + 1.4, HIT + 2.0),
      lid: blink(t, BACK + 0.45), wink: inOut(t, BACK + 0.95, BACK + 1.05, SHOOT2 + 0.05, SHOOT2 + 0.15),
      tilt: 6 * inOut(t, BACK + 0.9, BACK + 1.1, SHOOT2, SHOOT2 + 0.2) + 4 * Math.sin((t - HIT - 0.1) * 9.4) * inOut(t, HIT + 0.15, HIT + 0.3, HIT + 0.9, HIT + 1.1),
      happy: between(t, HIT + 0.1, HIT + 1.3), blush: 1 - ramp(t, BACK + 0.3, BACK + 0.8) + inOut(t, HIT + 0.1, HIT + 0.4, HIT + 1.2, HIT + 1.6),
    };
    const miss = arrowSprite(fxLayer, made, MONOGRAM.ink, missAim, "peek-miss-mask");
    const hit = arrowSprite(fxLayer, made, MONOGRAM.heart, HEART_AIM, "peek-hit-mask");
    // (each shot from beside the face, fixed by the pose at that shot; from the left, the curves worked out now)
    const shot1 = (m: MonoBox) => shotFrom(H, whereOf(H, first, pose(SHOOT1)), m, missAim, !curved);
    const shot2 = (m: MonoBox) => shotFrom(H, whereOf(H, second, pose(SHOOT2)), m, HEART_AIM);
    const C1 = curved && m0 ? curveTo(m0, shot1(m0), A_TOP, 45, 45) : null;
    const C2 = curved && m0 ? curveTo(m0, shot2(m0), HEART_AIM, ENTRY, 0.5 * hb[2]) : null;
    let S1: readonly number[] | null = null, S2: readonly number[] | null = null, hitDone = false;
    return {
      dur: HIT + 3.1,
      parts: [{ H, spot: (t) => (t < SWAP ? first : second), pose }],
      end: () => made.forEach((d) => d.remove()),
      fx: (t) => {
        const m = monoBox(), op = 1 - ramp(t, HIT + 2.1, HIT + 3.1);
        if (!m) return;
        if (t >= SHOOT1) {
          const q = t - MISS, f = (t - SHOOT1) / (MISS - SHOOT1), quiver = q > 0 ? 9 * Math.exp(-4 * q) * Math.sin(34 * q) : 0;
          if (C1) flightAlong(miss, m, C1, 0, f, quiver, op);
          else flight(miss, m, (S1 ??= shot1(m)), A_AIM, false, f, quiver, op);
        } else miss(null, [0, 0], 0, 0, 0);
        if (t >= SHOOT2) {
          const q = t - HIT, f = (t - SHOOT2) / (HIT - SHOOT2), quiver = q > 0 ? 6 * Math.exp(-5 * q) * Math.sin(38 * q) : 0;
          if (C2) flightAlong(hit, m, C2, 1.12 * hb[2], f, quiver, op);
          else flight(hit, m, (S2 ??= shot2(m)), HEART_AIM, true, f, quiver, op);
          if (q >= 0 && !hitDone) { hitDone = true; heartHit(1.25); }
        } else hit(null, [0, 0], 0, 0, 0);
      },
    };
  };

  // 3 · taguan (hide-and-seek): they keep missing each other (each pops up just after the other has ducked: hers at the
  // bottom, his at the bottom, hers from the right, his from the left), then both come up at the bottom at once, see each
  // other, turn to the side (the profiles, face to face), a heart between them, turn back, ^^, down
  const taguan = (): Show => {
    const sp = (who: Who, e: Edge) => spotFor(who, e);
    const dan = [sp("dan", "bottom"), sp("dan", "left"), sp("dan", "bottom")], ange = [sp("ange", "bottom"), sp("ange", "right"), sp("ange", "bottom")];
    const END = 7.7;
    const finale = (t: number): Pose => ({
      p: back((t - END) / 0.45) - ramp(t, 10.4, 11.0) + 0.04 * inOut(t, 8.22, 8.28, 8.32, 8.5),
      look: between(t, 8.2, 8.62) ? 2 : 0, lid: blink(t, 8.0),
      side: ramp(t, 8.62, 8.86) - ramp(t, 9.9, 10.14),
      tilt: 3 * Math.sin((t - 9.0) * 8) * inOut(t, 9.0, 9.15, 9.7, 9.85),
      happy: between(t, 10.14, 10.6), blush: inOut(t, 10.1, 10.3, 10.6, 10.9),
    });
    return {
      dur: 11.0,
      parts: [
        {
          H: heads.ange, spot: (t) => (t < 2.4 ? ange[0] : t < 6.4 ? ange[1] : ange[2]), hearts: [{ at: 9.15, from: "side" }],
          pose: (t) => t >= 6.4 ? finale(t) : t < 2.4
            ? { p: 0.55 * ramp(t, 0, 0.8) - 0.55 * ramp(t, 1.9, 2.25), look: between(t, 0.85, 1.0) ? 1 : between(t, 1.0, 1.55) ? 2 : 0, lid: blink(t, 1.65) }
            : { p: 0.6 * ramp(t, 4.2, 4.7) - 0.6 * ramp(t, 5.85, 6.25), lid: blink(t, 5.0), tilt: -6 * inOut(t, 5.1, 5.3, 5.6, 5.8) },
        },
        {
          H: heads.dan, spot: (t) => (t < 4.5 ? dan[0] : t < 7.65 ? dan[1] : dan[2]), hearts: [{ at: 9.15, from: "side" }],
          pose: (t) => t >= 7.65 ? finale(t) : t < 4.5
            ? { p: back((t - 2.1) / 0.45) - ramp(t, 3.9, 4.35), look: between(t, 2.6, 3.2) ? 2 : 0, lid: blink(t, 3.45), tilt: 7 * inOut(t, 3.2, 3.4, 3.7, 3.9) }
            : { p: 0.5 * ramp(t, 5.9, 6.4) - 0.5 * ramp(t, 7.1, 7.5), lid: blink(t, 6.75) },
        },
      ],
    };
  };

  // 4 · the stolen kiss: Ange comes up at the bottom-left, eyes shut, dreaming (^^, a sway); Dan comes up in profile a
  // gap away from her, scoots over to her (round 37, the user: "dapat may gap tapos lapit lang then kiss"), leans in and
  // kisses her cheek (a heart pops over the kiss), and is gone; her eyes fly open at where he was, she blushes, then ^^
  // and a giggle. His lips are placed ON her cheek: his height + spot are solved from hers
  const stolen = (): Show => {
    const A = heads.ange, D = heads.dan, W = innerWidth, Hs = innerHeight, size = 0.27, made: HTMLElement[] = [];
    // (on the bottom-left: he comes in on her left, and on the right half his curls ran into the date; the left is clear
    // of the date + the florals, and her glance after the kiss, to her left, goes where he went)
    // (round 37: a little further in, so his gap still fits on the screen; her hair stays under the date)
    const aSpot: Spot = { edge: "bottom", along: rnd(0.38, 0.41), rot: -4, size };
    const dRot = 3, LEAN = 6, kd = (size * Hs) / D.hh, sd = SHAPE.dan;
    const pFor = (vis: number) => { const e = sd.eyes + 0.07, m = sd.mouth + 0.1; return vis <= e ? (0.5 * vis) / e : 0.5 + (0.5 * (vis - e)) / (m - e); };
    let pA = 1, pD = 1, along = 0.4;
    for (pA = 1; pA >= 0.8; pA -= 0.02) {
      const a = place(A, aSpot, { p: pA });
      const [cx, cy] = onScreen(A, a.x, a.y, aSpot.rot, a.k, SHAPE.ange.cheek[0], SHAPE.ange.cheek[1]);
      const ang = ((dRot + LEAN) * Math.PI) / 180, lx = (D.sideMouth[0] - D.center[0]) * kd, ly = (D.sideMouth[1] - D.center[1]) * kd;
      const hx = cx - (lx * Math.cos(ang) - ly * Math.sin(ang)), hy = cy - (lx * Math.sin(ang) + ly * Math.cos(ang));
      along = hx / W;
      pD = pFor((Hs - hy) / (D.hh * kd) + 0.5);
      if (pD <= 1.06) break;
    }
    // where he comes up (a clear gap, his face well off hers), how close he scoots before he leans in
    const gap = (0.8 * D.hw * kd) / W, close = (0.08 * D.hw * kd) / W;
    const scoot = (t: number) => ramp(t, 2.35, 2.95), lean = (t: number) => inOut(t, 2.95, 3.1, 3.4, 3.6);
    const smack = flyer(fxLayer, true, made, "#ff8fa6"); // (pink: a kiss mark, on every theme)
    return {
      dur: 6.9,
      parts: [
        {
          H: A, spot: () => aSpot, hearts: [{ at: 4.65, from: "lips" }],
          pose: (t) => ({
            p: pA * (ramp(t, 0, 0.9) - ramp(t, 6.3, 6.9)) + 0.025 * Math.abs(Math.sin((t - 4.35) * 9.4)) * inOut(t, 4.4, 4.55, 5.35, 5.55),
            happy: between(t, 0.9, 3.35) || between(t, 4.35, 5.7),
            tilt: 3 * Math.sin((t - 0.9) * 2.6) * inOut(t, 0.95, 1.3, 2.6, 2.9) + 4 * Math.sin((t - 4.35) * 9.4) * inOut(t, 4.4, 4.55, 5.35, 5.55),
            look: between(t, 3.4, 4.3) ? 2 : 0, lid: blink(t, 3.95),
            blush: ramp(t, 3.3, 3.65) * (1 - ramp(t, 5.8, 6.2)),
          }),
        },
        {
          H: D, z: 2, spot: (t) => ({ edge: "bottom", along: along - gap * (1 - scoot(t)) - close * (1 - lean(t)), rot: dRot, size }),
          // (up a gap away, a beat, the scoot over with two little hops, the kiss, then gone)
          pose: (t) => ({
            p: pD * (0.55 * ramp(t, 1.0, 1.6) + 0.45 * ramp(t, 1.9, 2.2) - ramp(t, 3.45, 3.85)) + 0.035 * Math.abs(Math.sin(((t - 2.35) * Math.PI) / 0.3)) * inOut(t, 2.35, 2.4, 2.9, 2.95),
            side: 1, tilt: LEAN * lean(t),
          }),
        },
      ],
      end: () => made.forEach((d) => d.remove()),
      fx: (t, w) => {
        // the heart over the kiss: pops as his lips land, sits there, then floats off up-left after him (never over her
        // eye) + fades as he goes
        const q = t - 3.08;
        if (q < 0 || q > 0.6) { smack(0, 0, 0, 0, 0); return; }
        const [x, y] = at(A, w[0], SHAPE.ange.cheek[0], SHAPE.ange.cheek[1]);
        const size = 170 * w[0].k * (q < 0.14 ? back(q / 0.14) : 1);
        const go = q > 0.35 ? (q - 0.35) * 260 * w[0].k : 0;
        // (out quickly: half-faded pink over the dark green reads as a brown smudge)
        smack(x - 8 * w[0].k - go * 1.3, y - go * 0.55, size * (1 + 0.15 * ramp(q, 0.35, 0.6)), -8 - go * 0.04, q > 0.3 ? 1 - ramp(q, 0.3, 0.55) : 1);
      },
    };
  };

  // ── round 38: the funny ones ──
  // little things circling a head's crown (dizzy stars, lovestruck hearts): a flat ring over the top of the head, the near
  // half a little bigger + brighter
  const orbit = (H: Head, w: Where, items: Setter[], t: number, op: number, size: number) => {
    const [cx, cy] = at(H, w, H.crown[0], H.crown[1] - 0.02 * H.hh), a = (w.deg * Math.PI) / 180;
    const rx = 0.42 * H.hw * w.k, ry = 0.075 * H.hh * w.k;
    items.forEach((f, i) => {
      if (op <= 0 || w.P.p <= 0.002) { f(0, 0, 0, 0, 0); return; }
      const b = t * 6.2 + (i / items.length) * Math.PI * 2, lx = rx * Math.cos(b), ly = ry * Math.sin(b), front = Math.sin(b);
      f(cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a), size * (0.85 + 0.2 * front), w.deg + 20 * Math.cos(b), op * (0.7 + 0.3 * front));
    });
  };
  // a burst of n little things flying out of a point (the bonk's stars, a heart popping into a ring of hearts)
  const burst = (items: Setter[], x: number, y: number, q: number, dur: number, R: number, size: number, spin = 0) => {
    const tau = q / dur;
    items.forEach((f, i) => {
      if (tau < 0 || tau > 1) { f(0, 0, 0, 0, 0); return; }
      const a = (i / items.length) * Math.PI * 2 + 0.31, r = R * (1 - (1 - tau) ** 3);
      f(x + Math.cos(a) * r, y + Math.sin(a) * r - 16 * tau, size * (1 - 0.4 * tau), spin * tau + 25 * Math.cos(a), tau < 0.08 ? tau / 0.08 : 1 - (tau - 0.08) / 0.92);
    });
  };
  // where a head point lands on the screen for a spot + pose (with along 0: the spot's own x is added as along * width)
  const pointAt = (H: Head, s: Spot, P: Pose, px: number, py: number) => {
    const { x, y, k } = place(H, s, P);
    return onScreen(H, x, y, s.rot + (P.tilt ?? 0), k, px, py);
  };

  // 5 · the bonk (untugan): both come up at the bottom a little apart, glance, turn to their profiles face to face… and
  // both rush in for a kiss at once: BONK, foreheads. Squashed, they bounce apart, turn back to us with their eyes shut,
  // stars circling their heads, swaying; they open their eyes, look at each other, and laugh (^^, blushing)
  const bonk = (): Show => {
    const D = heads.dan, A = heads.ange, W = innerWidth, Hs = innerHeight, size = 0.27, made: HTMLElement[] = [];
    const HIT = 2.55, PB = 0.9, rD = 3, rA = -3, LEAN = 8;
    // (their foreheads meet left of the date, so the BONK! over them stays clear of it: each one's along solved from its
    // forehead at the hit pose)
    const brow = (H: Head) => H.sidePt(SHAPE[H.who].brow[0], SHAPE[H.who].brow[1]);
    const hitAlong = (H: Head, rot: number, X: number) => {
      const b = brow(H), [bx] = pointAt(H, { edge: "bottom", along: 0, rot, size }, { p: PB, tilt: H.faces * LEAN }, b[0], b[1]);
      return (X - bx) / W;
    };
    const X = 0.3 * W, aD = hitAlong(D, rD, X), aA = hitAlong(A, rA, X), APART = 0.13;
    const rush = (t: number) => easeIn((t - 2.3) / (HIT - 2.3)), wind = (t: number) => inOut(t, 1.95, 2.15, 2.22, 2.3);
    const recoil = (t: number) => back((t - HIT) / 0.3);
    const along = (sg: number, a0: number) => (t: number) => a0 + sg * (APART * (1 - rush(t)) + 0.012 * wind(t) + 0.06 * recoil(t));
    const spotD = along(-1, aD), spotA = along(1, aA);
    const pose = (H: Head) => (t: number): Pose => {
      const f = H.faces, q = t - HIT;
      return {
        p: PB * ramp(t, 0, 0.9) - PB * ramp(t, 6.6, 7.2) - 0.1 * inOut(t, HIT, HIT + 0.06, HIT + 0.5, HIT + 0.9),
        look: between(t, 1.0, 1.12) ? 1 : between(t, 1.12, 1.5) || between(t, 4.35, 4.95) ? 2 : 0,
        lid: blink(t, 1.25) + (between(t, HIT + 0.08, 4.3) ? 1 : 0) + blink(t, 4.62),
        side: ramp(t, 1.5, 1.72) - ramp(t, HIT + 0.04, HIT + 0.18),
        tilt: (q < 0 ? f * LEAN * ramp(t, 2.3, HIT) - f * 4 * wind(t) : -f * 14 * Math.exp(-6 * q) * Math.cos(q * 16))
          + f * 6 * Math.sin(q * 4.2) * inOut(t, HIT + 0.5, HIT + 0.8, 4.1, 4.4) + 5 * Math.sin((t - 5) * 9.4) * inOut(t, 5.0, 5.15, 6.1, 6.4),
        squash: 0.14 * inOut(t, HIT, HIT + 0.03, HIT + 0.07, HIT + 0.24),
        happy: between(t, 4.95, 6.4), blush: inOut(t, 4.95, 5.25, 6.3, 6.7),
      };
    };
    const stars = [D, A].map(() => [0, 1, 2, 3].map(() => sprite(fxLayer, made, STAR, "var(--date)", true)));
    const pops = Array.from({ length: 7 }, () => sprite(fxLayer, made, STAR, "var(--date)", true));
    const bonkWord = word(fxLayer, made, "BONK!");
    let C: readonly [number, number] | null = null;
    const parts: Part[] = [
      { H: D, spot: (t) => ({ edge: "bottom", along: spotD(t), rot: rD, size }), pose: pose(D) },
      { H: A, z: 2, spot: (t) => ({ edge: "bottom", along: spotA(t), rot: rA, size }), pose: pose(A) },
    ];
    return {
      dur: 7.2,
      parts,
      end: () => made.forEach((d) => d.remove()),
      fx: (t, w) => {
        const q = t - HIT;
        // (the hit's point: between the foreheads, where they are at the hit)
        if (q >= 0 && !C) {
          const [b0, b1] = parts.map(({ H, spot, pose }) => { const b = brow(H); return pointAt(H, spot(HIT), pose(HIT), b[0], b[1]); });
          C = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
        }
        const s = 0.27 * Hs;
        if (C) {
          burst(pops, C[0], C[1], q, 0.55, 0.16 * s * 2, 0.13 * s, 90);
          const pop = q < 0.16 ? back(q / 0.16) : 1;
          // (up over them + a little to the left, off the date)
          bonkWord(C[0] - 0.25 * s, C[1] - 0.45 * s - 30 * ramp(q, 0, 1.2), 0.25 * s * pop, -7, q < 1.2 ? 1 - ramp(q, 0.85, 1.2) : 0);
        }
        const op = inOut(t, HIT + 0.2, HIT + 0.4, 4.05, 4.35);
        [D, A].forEach((H, i) => orbit(H, w[i], stars[i], t, op, 0.16 * s));
      },
    };
  };

  // 6 · the heart battle: Dan, in profile, blows Ange a tiny heart; it bobs across and boops her cheek (kilig, ^^). She
  // turns to her profile, leans back… a GIANT heart swells at her lips, and she blows it: it knocks him clean out of the
  // screen (a flash + a ring of hearts). Oops: she looks where he was. He pops back up dazed, little hearts circling his
  // head, then ^^, blushing; she giggles. Round 39: either one blows the first (and gets knocked out), at the bottom or
  // upside down from the top (Dan on the right there, so their profiles still face each other: no mirrored faces)
  const battle = (firstIn?: Who, edgeIn?: Edge): Show => {
    const edge: Edge = edgeIn === "top" || edgeIn === "bottom" ? edgeIn : Math.random() < 0.5 ? "bottom" : "top";
    const first: Who = firstIn ?? (Math.random() < 0.5 ? "dan" : "ange");
    const F = heads[first], R = heads[first === "dan" ? "ange" : "dan"], Hs = innerHeight, made: HTMLElement[] = [];
    const fS = spotFor(F.who, edge), rS = spotFor(R.who, edge);
    // (into the screen from the edge; knocked out away from the other one; from the top the hearts off their lips turn
    // with them, upside down: round 39, "pag nasa top … baliktad yung bigheart")
    const inward = edge === "bottom" ? -1 : 1, away = Math.sign(fS.along - rS.along), flip = edge === "top" ? 180 : 0;
    const GO = 2.0, BOOP = 3.3, SWELL = 4.3, FIRE = 5.05, HIT = 5.35, BACKUP = 6.05, PF = 0.95, PR = 0.95;
    const firstPose = (t: number): Pose => ({
      p: t < BACKUP - 0.05
        ? PF * ramp(t, 0, 0.9) - 0.1 * inOut(t, 4.75, 4.95, 5.6, 5.7) - PF * ramp(t, HIT, HIT + 0.28)
        : PF * back((t - BACKUP) / 0.45) - PF * ramp(t, 8.4, 9.0),
      look: between(t, 1.0, 1.12) ? 1 : between(t, 1.12, 1.35) || between(t, 2.45, 3.4) || between(t, 4.5, HIT) ? 2 : 0,
      side: ramp(t, 1.35, 1.55) - ramp(t, 2.25, 2.45),
      lid: blink(t, 1.15) + blink(t, 4.72) + (between(t, BACKUP + 0.1, 7.25) ? 0.6 : 0),
      tilt: F.faces * 7 * inOut(t, 1.75, 1.9, 2.0, 2.2) - (t < BACKUP - 0.05 ? F.faces * 28 * ramp(t, HIT, HIT + 0.25) : 0)
        + 7 * Math.sin((t - 6.2) * 3.4) * inOut(t, 6.2, 6.4, 7.1, 7.3) + 4 * Math.sin((t - 7.3) * 9.4) * inOut(t, 7.35, 7.5, 8.0, 8.2),
      happy: between(t, 3.45, 3.95) || between(t, 7.3, 8.3), blush: inOut(t, 7.25, 7.5, 8.2, 8.5),
    });
    const replyPose = (t: number): Pose => {
      const f = R.faces;
      return {
        p: PR * ramp(t, 0.1, 1.0) - PR * ramp(t, 8.4, 9.0),
        look: between(t, 1.5, 3.3) || between(t, 5.6, 6.3) ? 2 : 0,
        side: ramp(t, 4.0, 4.2) - ramp(t, 5.45, 5.62),
        lid: blink(t, 1.8) + blink(t, 5.85),
        tilt: 5 * inOut(t, 3.3, 3.45, 3.8, 4.0) - f * 9 * ramp(t, 4.3, 4.9) * (1 - ramp(t, 4.98, 5.08)) + f * 10 * inOut(t, 4.98, 5.08, 5.15, 5.4)
          + 5 * Math.sin((t - 6.4) * 9.4) * inOut(t, 6.45, 6.6, 7.4, 7.7),
        happy: between(t, 3.35, 3.95) || between(t, 6.4, 7.7), blush: inOut(t, 3.3, 3.6, 4.0, 4.3) + inOut(t, 6.4, 6.7, 7.7, 8.1),
      };
    };
    // (the tiny one + the dazed ones pink, a kiss's colour: a cream heart on her cheek didn't show at all)
    const G = Math.max(220, 0.46 * Hs); // (bigger than the whole head)
    const tiny = flyer(fxLayer, true, made, "#ff8fa6"), giant = flyer(fxLayer, true, made, "var(--date)", Math.round(G));
    const ring = Array.from({ length: 10 }, () => flyer(fxLayer, false, made));
    const daze = [0, 1, 2].map(() => flyer(fxLayer, true, made, "#ff8fa6"));
    let from: readonly [number, number] | null = null, launch: readonly [number, number] | null = null, target: readonly [number, number] | null = null, hit = false;
    const cheek = SHAPE[R.who].cheek;
    return {
      dur: 9.0,
      parts: [
        { H: F, spot: (t) => (t < HIT || t >= BACKUP - 0.05 ? fS : { ...fS, along: fS.along + away * 0.05 * ramp(t, HIT, HIT + 0.28) }), pose: firstPose },
        { H: R, z: 2, spot: () => rS, pose: replyPose },
      ],
      end: () => made.forEach((d) => d.remove()),
      fx: (t, w) => {
        // the tiny heart: off the first one's lips, bobbing across (into the screen) to the other's cheek, a little pop
        if (t >= GO && !from) from = pointAt(F, fS, firstPose(GO), F.sideMouth[0] + F.faces * 40, F.sideMouth[1]);
        const u = (t - GO) / (BOOP - GO);
        if (from && u >= 0 && u < 1.25) {
          const to = at(R, w[1], cheek[0], cheek[1]), e = easeIO(Math.min(1, u));
          const x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e + inward * (Math.sin(Math.min(1, u) * Math.PI) * 0.09 * Hs - 9 * Math.sin(u * 15));
          const sz = 0.034 * Hs * (u > 1 ? 1 + 2.4 * (u - 1) : ramp(u, 0, 0.1));
          tiny(x, y, sz, flip + 10 * Math.sin(u * 9), u > 1 ? 1 - (u - 1) / 0.25 : 1);
        } else tiny(0, 0, 0, 0, 0);
        // the giant: swells in front of the other's lips (wobbling), then flies at the first one's face
        const lipsAhead = (ww = w[1]) => {
          const [lx, ly] = at(R, ww, R.sideMouth[0], R.sideMouth[1]), a = (ww.deg * Math.PI) / 180;
          // (ahead of the lips + into the screen: never closer to the edge than its half + a little, so it's whole; round
          // 39: from the top its lips are as near the edge as at the bottom, and it was cut)
          return (sz: number) => {
            const y = ly + R.faces * Math.sin(a) * (0.5 * sz + 6) + inward * 0.24 * sz, lim = 0.36 * sz + 8;
            return [lx + R.faces * Math.cos(a) * (0.5 * sz + 6), edge === "top" ? Math.max(y, lim) : Math.min(y, Hs - lim)] as const;
          };
        };
        if (t >= SWELL && t < FIRE) {
          const sz = G * ss((t - SWELL) / 0.7) * (1 + 0.06 * Math.sin(t * 23));
          const [x, y] = lipsAhead()(sz);
          giant(x, y, sz, flip - 8 * R.faces, 1);
        } else if (t >= FIRE && t < HIT + 0.14) {
          if (!launch) { launch = lipsAhead(whereOf(R, rS, replyPose(FIRE)))(G); target = pointAt(F, fS, firstPose(FIRE), F.center[0], F.eyes[0][1]); }
          const v = easeIn((t - FIRE) / (HIT - FIRE)), [x0, y0] = launch!, [x1, y1] = target!;
          const pop = t > HIT ? (t - HIT) / 0.14 : 0;
          giant(x0 + (x1 - x0) * v, y0 + (y1 - y0) * v, G * (1 + 0.12 * v + 0.4 * pop), flip - 8 * R.faces * (1 - v), 1 - pop);
        } else giant(0, 0, 0, 0, 0);
        if (t >= HIT && !hit && target) { hit = true; hooks.boom(target[0], target[1]); }
        if (target) burst(ring, target[0], target[1], t - HIT, 1.2, Math.max(140, 0.17 * Hs), 0.06 * Hs);
        // dazed: little hearts circling the first one's head
        orbit(F, w[0], daze, t, inOut(t, BACKUP + 0.15, BACKUP + 0.35, 7.15, 7.4), 0.055 * Hs);
      },
    };
  };

  // 7 · the stolen heart (ninakaw): Dan comes down from the top, upside down, over the monogram's heart; the top of his
  // curls touches it… it sticks, and he's gone up with it. A dashed outline where it was. Ange comes up, looks at the
  // monogram, blinks twice, tilts her head. Dan pops up at the bottom, the heart on his head, all innocent. She narrows
  // her eyes at him; he glances at her, caught, sinks a little: the heart flies back to its place (it thumps, a flash).
  // Both ^^, blushing
  const nakaw = (): Show => {
    const D = heads.dan, A = heads.ange, W = innerWidth, Hs = innerHeight, made: HTMLElement[] = [];
    const [hbx, hby, hbw, hbh] = MONOGRAM.heartBox, m0 = monoBox(), u0 = m0?.u ?? 0.57;
    const heartTop = m0 ? m0.top + hby * u0 : 0.32 * Hs, heartX = m0 ? m0.left + (hbx + hbw / 2) * u0 : 0.68 * W;
    // (round 39, "kita na headless": the whole head in (vis 1 + a dip to 1.07) showed his picture's cut edge, floating.
    // Now never further in than any head (VIS_MAX, the top of the fade under his chin), and his head bigger for it:
    // sized so his curls reach just into the heart at the dip, a little short of it before)
    const VIS = VIS_MAX("dan"), size = Math.min(0.44, Math.max(0.3, (heartTop + 0.1 * hbh * u0) / (VIS * Hs)));
    const top: Spot = { edge: "top", along: heartX / W, rot: 180, size };
    const bottom: Spot = { edge: "bottom", along: rnd(0.17, 0.24), rot: 5, size: 0.27 };
    const aS: Spot = { edge: "bottom", along: rnd(0.645, 0.68), rot: -5, size: 0.27 };
    const IN = pForVis("dan", VIS - 0.04), DIP = pForVis("dan", VIS), GRAB = 2.0, UP = 2.85, POP = 6.0, GIVE = 8.0, HOME = 8.8;
    const danPose = (t: number): Pose => t < UP ? {
      // (down to the eyes, a look round, down to the heart, a dip, the wink, zip, up and gone)
      p: 0.6 * ramp(t, 0, 0.8) + (IN - 0.6) * ramp(t, 1.25, 1.75) + (DIP - IN) * inOut(t, 1.85, GRAB, GRAB + 0.05, 2.25) - IN * ramp(t, 2.4, 2.75),
      lid: blink(t, 1.0), wink: inOut(t, GRAB + 0.05, GRAB + 0.12, 2.32, 2.4),
    } : {
      p: back((t - POP) / 0.45) - 0.15 * ramp(t, 7.75, 7.95) + 0.15 * ramp(t, 8.8, 9.0) - ramp(t, 10.2, 10.8),
      look: between(t, 7.4, 7.95) ? 2 : 0, lid: blink(t, 6.6) + blink(t, 7.7),
      tilt: 3 * Math.sin((t - 6.3) * 3.2) * inOut(t, 6.3, 6.5, 7.2, 7.4) + 4 * Math.sin((t - 8.9) * 9.4) * inOut(t, 8.95, 9.1, 9.8, 10.0),
      happy: between(t, 8.9, 10.0), blush: inOut(t, 7.8, 8.1, 10.0, 10.4),
    };
    const angePose = (t: number): Pose => ({
      p: 0.95 * ramp(t, 3.4, 4.2) - 0.95 * ramp(t, 10.2, 10.8),
      look: between(t, 4.3, 5.9) || between(t, 6.4, 7.95) ? 2 : 0,
      lid: blink(t, 4.6) + blink(t, 4.85) + (between(t, 6.65, 7.95) ? 0.42 : 0),
      tilt: 9 * inOut(t, 5.0, 5.2, 5.8, 6.0) + 5 * Math.sin((t - 8.9) * 9.4) * inOut(t, 8.95, 9.1, 9.8, 10.0),
      happy: between(t, 8.9, 10.0), blush: inOut(t, 8.9, 9.2, 10.0, 10.4),
    });
    // the heart he carries: the monogram's own shape + size, in its flat ink + glow
    const carry = svgEl("svg", { viewBox: `${hbx} ${hby} ${hbw} ${hbh}` }) as SVGSVGElement;
    carry.style.cssText = "position:absolute;left:0;top:0;overflow:visible;opacity:0;filter:drop-shadow(0 0 5px var(--svg-glow));will-change:transform";
    const carryPath = svgEl("path", { d: MONOGRAM.heart, fill: inkNow() });
    carry.appendChild(carryPath); fxLayer.appendChild(carry); made.push(carry as unknown as HTMLElement);
    // the dashed outline where it was
    const gone = svgEl("svg", { viewBox: `0 0 ${MONOGRAM.w} ${MONOGRAM.h}` }) as SVGSVGElement;
    gone.style.cssText = "position:absolute;left:0;top:0;overflow:visible;opacity:0;filter:drop-shadow(0 0 4px var(--svg-glow))";
    const gonePath = svgEl("path", { d: MONOGRAM.heart, fill: "none", stroke: inkNow(), "stroke-width": 4.5, "stroke-dasharray": "13 10", "stroke-linecap": "round" });
    gone.appendChild(gonePath); fxLayer.appendChild(gone); made.push(gone as unknown as HTMLElement);
    let taken = false, home = false, hold: readonly [number, number] | null = null, flyFrom: readonly [number, number] | null = null;
    const putBack = () => { if (taken && !home) { home = true; hooks.heart?.(true); } };
    return {
      dur: 10.8,
      parts: [
        { H: D, spot: (t) => (t < UP ? top : bottom), pose: danPose },
        { H: A, spot: () => aS, pose: angePose },
      ],
      end: () => { putBack(); made.forEach((d) => d.remove()); },
      fx: (t, w) => {
        const m = monoBox();
        if (!m) return;
        const ink = inkNow(), hw = hbw * m.u, hh = hbh * m.u;
        carryPath.setAttribute("fill", ink); gonePath.setAttribute("stroke", ink);
        const C = [m.left + (hbx + hbw / 2) * m.u, m.top + (hby + hbh / 2) * m.u] as const;
        const place2 = (x: number, y: number, rot: number, op: number) => {
          carry.style.opacity = String(op);
          if (op > 0) { carry.style.width = `${hw}px`; carry.style.transform = `translate(${x - hw / 2}px,${y - hh / 2}px) rotate(${rot}deg)`; }
        };
        // (the grab: from then on it keeps where it was against the top of his head, so nothing jumps; worked out from his
        // pose AT the grab, so a still held later shows it right too)
        const crown = at(D, w[0], D.crown[0], D.crown[1]);
        if (t >= GRAB && !taken) {
          taken = true; hooks.heart?.(false);
          const c0 = pointAt(D, top, danPose(GRAB), D.crown[0], D.crown[1]);
          hold = [C[0] - c0[0], C[1] - c0[1]];
        }
        if (taken && t < UP) place2(crown[0] + hold![0], crown[1] + hold![1], 0, w[0].P.p > 0.002 ? 1 : 0);
        else if (t >= POP && t < GIVE) {
          // (on his head at the bottom: its point in his curls, turning with him)
          const a = (w[0].deg * Math.PI) / 180, up = 0.36 * hh;
          place2(crown[0] + Math.sin(a) * up, crown[1] - Math.cos(a) * up, w[0].deg * 0.8, w[0].P.p > 0.002 ? 1 : 0);
        } else if (t >= GIVE && t < HOME) {
          // (back home round the monogram, never over its letters (the same colour, it vanished on the A): up its left
          // side, over its top, down into its place)
          if (!flyFrom) { const a = (w[0].deg * Math.PI) / 180; flyFrom = [crown[0] + Math.sin(a) * 0.36 * hh, crown[1] - Math.cos(a) * 0.36 * hh]; }
          const v = easeIO((t - GIVE) / (HOME - GIVE)), [x0, y0] = flyFrom, mw = MONOGRAM.w * m.u;
          const P1 = [m.left - 0.1 * mw, m.top - 0.1 * Hs], P2 = [C[0] + 0.02 * W, m.top - 0.18 * Hs];
          const b0 = (1 - v) ** 3, b1 = 3 * (1 - v) ** 2 * v, b2 = 3 * (1 - v) * v * v, b3 = v ** 3;
          const x = b0 * x0 + b1 * P1[0] + b2 * P2[0] + b3 * C[0], y = b0 * y0 + b1 * P1[1] + b2 * P2[1] + b3 * C[1];
          place2(x, y, 360 * v + w[0].deg * 0.8 * (1 - v), 1);
        } else place2(0, 0, 0, 0);
        if (t >= HOME && !home) { putBack(); home = true; hooks.pulse(1.4); hooks.boom(C[0], C[1]); }
        gone.style.width = `${MONOGRAM.w * m.u}px`;
        gone.style.transform = `translate(${m.left}px,${m.top}px)`;
        gone.style.opacity = String(0.8 * inOut(t, UP - 0.3, UP + 0.1, HOME - 0.05, HOME));
      },
    };
  };

  // 8 · the fight for the spot (agawan sa pwesto): Dan comes up in the middle, under the date, all smiles. Ange comes up
  // beside him… and shoves him out of it with her head (squashed, eyes shut; he stares at her). He shoves her back; she
  // stares. They glance, crouch… and both rush in at once: squashed cheek to cheek, a little tussle, then they find
  // they're cheek to cheek: ^^, blushing, swaying together, a heart
  const agawan = (): Show => {
    // (a little smaller + lower than the others: in the middle the top of his curls came up to the date)
    const D = heads.dan, A = heads.ange, W = innerWidth, Hs = innerHeight, size = 0.25;
    const kD = (size * Hs) / D.hh, kA = (size * Hs) / A.hh;
    // (the gap between their middles when his curls touch her hair: his right reach + her left one)
    const dC = (SHAPE.dan.half[1] * kD + SHAPE.ange.half[0] * kA) * 0.9;
    const X0 = 0.5 * W, XD_OUT = X0 - dC - 0.07 * W, XA_IN = X0 + dC + 0.11 * W, XA_OUT = X0 + dC + 0.07 * W;
    const XM = (X0 + XA_OUT) / 2, d2 = dC * 0.8;
    const P = 0.8;
    // where each one is (px): push 1 (she slides in, he's moved by her, then knocked further), push 2 (the other way
    // round), then both rush to meet + a tussle
    const xs = (t: number) => {
      let xA: number, xD: number;
      if (t < 3.9) {
        xA = XA_IN + (X0 - XA_IN) * easeIn((t - 2.55) / 0.23);
        xD = Math.min(X0, xA - dC) + ramp(t, 2.78, 3.05) * (XD_OUT - X0 + dC);
      } else if (t < 5.2) {
        xD = XD_OUT + (X0 - XD_OUT) * easeIn((t - 3.95) / 0.23);
        xA = Math.max(X0, xD + dC) + ramp(t, 4.18, 4.45) * (XA_OUT - X0 - dC);
      } else {
        const wind = inOut(t, 5.3, 5.5, 5.55, 5.62) * 12, go = easeIn((t - 5.6) / 0.25);
        const tus = 7 * Math.sin((t - 5.85) * 24) * inOut(t, 5.85, 5.9, 6.2, 6.4);
        xD = X0 - wind + (XM - d2 / 2 - X0) * go + tus;
        xA = XA_OUT + wind + (XM + d2 / 2 - XA_OUT) * go + tus;
      }
      return [xD / W, xA / W];
    };
    const sway = (t: number) => 3 * Math.sin((t - 6.8) * 3.0) * inOut(t, 6.8, 7.1, 8.4, 8.7);
    const crouch = (t: number) => 0.08 * inOut(t, 5.3, 5.5, 5.6, 5.8);
    const hitSq = (t: number, a: number) => 0.1 * inOut(t, a, a + 0.03, a + 0.08, a + 0.25);
    const danPose = (t: number): Pose => ({
      p: P * ramp(t, 0, 0.8) - P * ramp(t, 8.9, 9.5) - crouch(t),
      look: between(t, 3.1, 3.9) || between(t, 5.1, 5.6) || between(t, 6.4, 6.7) ? 2 : 0,
      lid: blink(t, 2.05) + (between(t, 2.72, 2.98) ? 1 : 0) + blink(t, 3.5),
      happy: between(t, 0.9, 1.7) || between(t, 4.35, 5.0) || between(t, 6.75, 8.6),
      tilt: 4 * Math.sin((t - 0.9) * 9.4) * inOut(t, 0.95, 1.05, 1.5, 1.7) - 12 * inOut(t, 2.7, 2.78, 3.0, 3.3)
        + 4 * Math.sin((t - 4.35) * 9.4) * inOut(t, 4.4, 4.5, 4.85, 5.0) - 5 * inOut(t, 5.3, 5.5, 5.6, 5.7) + 8 * ramp(t, 5.75, 5.95) * (1 - ramp(t, 8.8, 9.2)) + sway(t),
      squash: hitSq(t, 2.7) + hitSq(t, 5.83), blush: inOut(t, 6.7, 7.0, 8.6, 9.0),
    });
    const angePose = (t: number): Pose => ({
      p: P * ramp(t, 1.3, 2.0) - P * ramp(t, 8.9, 9.5) - crouch(t),
      look: between(t, 2.0, 2.5) || between(t, 4.5, 5.6) || between(t, 6.4, 6.7) ? 2 : 0,
      lid: blink(t, 2.25) + (between(t, 4.12, 4.4) ? 1 : 0) + blink(t, 4.85),
      happy: between(t, 2.95, 3.7) || between(t, 6.75, 8.6),
      tilt: 4 * Math.sin((t - 2.95) * 9.4) * inOut(t, 3.0, 3.1, 3.5, 3.7) + 12 * inOut(t, 4.12, 4.2, 4.42, 4.7)
        + 5 * inOut(t, 5.3, 5.5, 5.6, 5.7) - 8 * ramp(t, 5.75, 5.95) * (1 - ramp(t, 8.8, 9.2)) + sway(t),
      squash: hitSq(t, 4.12) + hitSq(t, 5.83), blush: inOut(t, 6.7, 7.0, 8.6, 9.0),
    });
    let hearted = false;
    return {
      dur: 9.5,
      parts: [
        { H: D, spot: (t) => ({ edge: "bottom", along: xs(t)[0], rot: 2, size }), pose: danPose },
        { H: A, z: 2, spot: (t) => ({ edge: "bottom", along: xs(t)[1], rot: -2, size }), pose: angePose },
      ],
      fx: (t, w) => {
        // (a heart rising from over their cheeks)
        if (t >= 7.1 && !hearted) {
          hearted = true;
          const y = Math.min(w[0].y, w[1].y) - 0.3 * size * Hs;
          heartAt(fxLayer, (w[0].x + w[1].x) / 2, y, w[0].k * 1.3, [0, -1], [1, 0]); // (drifting right, off the date)
        }
      },
    };
  };

  const showFor = (name: string, who: Who | "both", edge?: Edge): Show | null => {
    if (name === "kissboom") return kissBoom(edge === "top" || edge === "bottom" ? edge : undefined);
    if (name === "taguan") return taguan();
    if (name === "stolen") return stolen();
    if (name === "bonk") return bonk();
    if (name === "battle") return battle(who === "both" ? undefined : who, edge);
    if (name === "nakaw") return nakaw();
    if (name === "agawan") return agawan();
    if (name === "cupid" && who !== "both") return cupid(who, edge);
    if (name === "sablay" && who !== "both") return sablay(who, edge);
    if (who === "both") return simple(pair(edge === "top" || edge === "bottom" ? edge : undefined), BOTH);
    return BEATS[name] && edge ? simple([{ H: heads[who], spot: spotFor(who, edge) }], BEATS[name]) : null;
  };

  const labelOf = (tk: (typeof TEST_KEYS)[number], who: Who | "both", edge: Edge) => {
    const name = (x: string) => x[0].toUpperCase() + x.slice(1);
    return `${tk.label}${tk.v.length > 1 ? ` · ${who === "both" ? edge : `${name(who)}${tk.first ? " first" : ""}, ${edge}`}` : ""}`;
  };
  const refill = () => {
    const all = TEST_KEYS.flatMap((tk) => tk.v.map(([who, edge]) => [tk, who, edge] as [(typeof TEST_KEYS)[number], Who | "both", Edge]));
    queue = [];
    while (all.length) {
      const prev = queue[queue.length - 1]?.[0].key, ok = all.filter((x) => x[0].key !== prev), pool = ok.length ? ok : all;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      queue.push(pick); all.splice(all.indexOf(pick), 1);
    }
  };
  const peek = () => {
    if (!on || raf) return;
    if (!ready()) { schedule(2); return; }
    if (nonstop) {
      if (!queue.length) refill();
      const [tk, who, edge] = queue.shift()!, show = showFor(tk.name, who, edge);
      if (show) run(show); else schedule();
      return;
    }
    // who: mostly one at a time, taking turns; now and then both (the glance, the flying kiss, taguan, the stolen kiss)
    if (lastWho !== "both" && Math.random() < 0.35) {
      lastWho = "both";
      const names = PAIR_SHOWS.filter((n) => n !== lastPair);
      lastPair = names[Math.floor(Math.random() * names.length)];
      run(showFor(lastPair, "both")!);
      return;
    }
    const who: Who = lastWho === "dan" ? "ange" : lastWho === "ange" ? "dan" : Math.random() < 0.5 ? "dan" : "ange";
    lastWho = who;
    const name = pickBeat();
    const edge = EDGES[who][Math.floor(Math.random() * EDGES[who].length)];
    run(showFor(name, who, edge)!);
  };
  // the next one in 12–24 s (sooner the first time; non-stop: right after)
  const schedule = (sec?: number) => { clearTimeout(timer); if (on) timer = window.setTimeout(peek, (sec ?? (nonstop ? 0.9 : rnd(12, 24))) * 1000); };
  schedule(4);
  // the test keys (round 38, the user: "for testing purpose lagyan mo din hotkey every pose/animations"): a letter plays
  // that peek right away (over whatever is playing); pressed again, the next who / edge in its list. Round 39 (the user:
  // "if i press 0 it will run the automatic non stop … if press 9 cancel all animation so we have option to stop"):
  // 0 = non-stop, every peek one after another; 9 = everything stops now, the random ones too (P or 0 starts them
  // again). Nothing on screen says which (round 39: "pangit pag lumalabas at makita ng audience"); the name it returns
  // is for the console / the checks
  const turn: Record<string, number> = {};
  const hotkey = (k: string) => {
    if (k === "0") { on = true; nonstop = true; refill(); clearTimeout(timer); stop(); schedule(1.4); return "Non-stop: every peek, one after another (9 = stop)"; }
    if (k === "9") { on = false; nonstop = false; clearTimeout(timer); stop(); return "Peeks stopped (P or 0 = on again)"; }
    const tk = TEST_KEYS.find((x) => x.key === k);
    if (!tk) return null;
    const i = turn[k] ?? 0, [who, edge] = tk.v[i % tk.v.length];
    turn[k] = i + 1;
    const show = showFor(tk.name, who, edge);
    if (!show) return null;
    clearTimeout(timer);
    run(show);
    return labelOf(tk, who, edge);
  };
  return {
    hotkey,
    // P: off (any peek playing finishes) / on (one comes right away; the random ones, not non-stop)
    toggle: () => { on = !on; nonstop = false; if (on) schedule(0.6); else clearTimeout(timer); return on; },
    now: () => { on = true; clearTimeout(timer); peek(); },
    // (for checking, from the console: stagePeek("ange", "right", "wink"), stagePeek("both", "bottom", "kissboom"),
    // stagePeek("dan", "right", "cupid"), "taguan", "stolen"; round 38: "bonk", "battle", "nakaw", "agawan", ("dan",
    // "right", "sablay"); round 39: ("ange", "left", "cupid" / "sablay"), ("ange", "top", "battle") = Ange first, from the
    // top; with `at`, held still at that second)
    test: (who: Who | "both", edge: Edge, name: string, at?: number, over?: Partial<Pose>) => {
      clearTimeout(timer);
      const show = showFor(name, who, edge);
      if (show) run(show, at, over);
    },
  };
};
