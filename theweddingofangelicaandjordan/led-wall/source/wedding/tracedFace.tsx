import type { V } from "./tracedRig";

// The faces of the traced Dan & Ange puppets, redrawn in code at the spots measured on the picture (picture px), so
// they can blink, look, talk and emote. Anime-style human eyes: a liner along the upper lid with a wing, an almond
// white, a big brown iris almost centred (pupils pushed toward the nose read cross-eyed), two shines.
// (round 2, 2026-10-25: "eye is wrong": with `art` the open eyes are the picture's own, traced (EyeArt); the code
// draws the closed, happy, squeeze and dizzy states and the lowered lids)

export type FaceEyes = "open" | "closed" | "happy" | "half" | "squint" | "wide" | "squeeze" | "dizzy";
export type FaceBrows = "neutral" | "raised" | "worried" | "angry" | "smug" | "flat";
export type FaceMouth = "grin" | "smile" | "closed" | "small" | "wide" | "o" | "flat" | "frown" | "smirk";

export type EyeGeo = {
  o: V; // outer corner of the opening
  i: V; // inner corner
  top: number; // highest point of the upper lid
  bot: number; // lowest point of the lower lid
  wing: V; // tip of the liner's wing, past the outer corner
  iris: V;
  r: number;
  shine: [V, number][];
  crease: number; // the lid crease, this far above the top (0 = none)
  lashes: number; // extra lash flicks at the outer end
};
// a traced eye (split.py's EYES), its paths inside `t`: the opening (the white and iris's outline), the white, the iris
// (slides inside the opening to look) and the liner (lashes, wing, crease, lower lid); skin = the face around it
export type EyeArt = { t: string; open: string; white: string; skin: string; sclera: [string, string][]; iris: [string, string][]; liner: [string, string][] };
export type BrowGeo = { a: V; m: V; b: V }; // outer end, middle, inner end
export type MouthGeo = { l: V; r: V; up: number; open: number; teeth: number; lip: number };
export type FaceGeo = {
  eyes: Record<-1 | 1, EyeGeo>;
  art?: Record<-1 | 1, EyeArt>;
  brows: Record<-1 | 1, BrowGeo>;
  browW: number;
  mouth: MouthGeo;
  cheeks: [V, V];
  blush: number; // the picture's own soft blush (0 = none)
  s: number; // face size relative to Kukki's MoreDetailedCute face (the expression offsets are in his px)
  lw: number; // line width
  liner: number; // the upper lid's liner width
  stache?: { halves: [V, V, V][]; w: number; col: string; patch?: V };
  col: { ink: string; brow: string; iris: string; irisLo: string; white: string; lid: string; lip: string; lipHi: string; mouth: string; tongue: string; teeth: string; blush: string };
};

// a cubic from a to b whose middle reaches y = peak
const arc = (a: V, b: V, peak: number) => {
  const c = (peak - 0.125 * (a[1] + b[1])) / 0.75;
  const dx = b[0] - a[0];
  return `C ${a[0] + dx * 0.22} ${c} ${a[0] + dx * 0.78} ${c} ${b[0]} ${b[1]}`;
};

const Eye: React.FC<{ g: FaceGeo; side: -1 | 1; eyes: FaceEyes; look: V; id: string }> = ({ g, side, eyes, look, id }) => {
  const e = g.eyes[side];
  const { col, lw } = g;
  const cx = (e.o[0] + e.i[0]) / 2;
  const cy = (e.top + e.bot) / 2;
  const w = Math.abs(e.i[0] - e.o[0]);
  const line = { fill: "none", stroke: col.ink, strokeWidth: lw * 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const out = side; // the outer corner is on this side of the eye
  if (eyes === "closed") {
    // lashes down: a soft ∪ with the wing
    return (
      <g>
        <path d={`M ${e.o[0]} ${cy} Q ${cx} ${cy + w * 0.2} ${e.i[0]} ${cy + 1}`} {...line} />
        <path d={`M ${e.o[0] + out * 1} ${cy} L ${e.o[0] + out * w * 0.13} ${cy - w * 0.04}`} {...line} strokeWidth={lw * 1.3} />
      </g>
    );
  }
  if (eyes === "happy") return <path d={`M ${e.o[0]} ${cy + w * 0.12} Q ${cx} ${cy - w * 0.3} ${e.i[0]} ${cy + w * 0.12}`} {...line} />;
  if (eyes === "squeeze") {
    const s = -out; // points toward the nose
    return <path d={`M ${cx - s * w * 0.34} ${cy - w * 0.24} L ${cx + s * w * 0.3} ${cy} L ${cx - s * w * 0.34} ${cy + w * 0.24}`} {...line} />;
  }
  if (eyes === "dizzy") {
    const k = w / 120;
    return (
      <path
        d={`M ${cx} ${cy} m ${-6 * k} 0 a ${6 * k} ${6 * k} 0 1 1 ${12 * k} 0 a ${14 * k} ${14 * k} 0 1 1 ${-26 * k} 0 a ${24 * k} ${24 * k} 0 1 1 ${46 * k} 0 a ${36 * k} ${36 * k} 0 1 1 ${-68 * k} 0`}
        {...line}
        strokeWidth={lw * 1.4}
      />
    );
  }
  const wide = eyes === "wide";
  const k = wide ? 1.1 : 1;
  const [lx, ly] = [look[0] * w * 0.06, look[1] * w * 0.04];
  if (g.art) return <TracedEye g={g} side={side} eyes={eyes} look={[lx, ly]} id={id} />;
  const upper = `M ${e.o[0]} ${e.o[1]} ${arc(e.o, e.i, e.top)}`;
  const almond = `${upper} ${arc(e.i, e.o, e.bot)} Z`;
  // lids: half and squint crop the eye from the top (and bottom), with the liner along the crop
  const h = e.bot - e.top;
  const topCut = eyes === "half" ? e.top + h * 0.45 : eyes === "squint" ? e.top + h * 0.38 : -1e4;
  const botCut = eyes === "squint" ? e.bot - h * 0.22 : 1e4;
  const clip = `${id}eye${side}`;
  const r = wide ? e.r * 0.86 : e.r;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={cx - w} y={topCut} width={w * 2} height={Math.min(botCut, 1e4) - topCut} />
        </clipPath>
        <clipPath id={`${clip}in`}>
          <path d={almond} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path d={almond} fill={col.white} />
        <g clipPath={`url(#${clip}in)`}>
          <circle cx={e.iris[0] + lx} cy={e.iris[1] + ly} r={r} fill={col.iris} />
          <circle cx={e.iris[0] + lx} cy={e.iris[1] + ly + r * 0.55} r={r * 0.62} fill={col.irisLo} opacity={0.75} />
          <circle cx={e.iris[0] + lx} cy={e.iris[1] + ly - r * 0.05} r={r * 0.5} fill={col.ink} opacity={0.85} />
          {/* the upper lid's shadow over the iris */}
          <path d={`M ${cx - w} ${e.top - 4} L ${cx + w} ${e.top - 4} L ${cx + w} ${e.top + h * 0.28} Q ${cx} ${e.top + h * 0.1} ${cx - w} ${e.top + h * 0.2} Z`} fill={col.ink} opacity={0.22} />
          {e.shine.map(([p, rr], n) => (
            <circle key={n} cx={p[0] + lx} cy={p[1] + ly} r={wide ? rr * 1.1 : rr} fill="#fff" />
          ))}
        </g>
        {/* the lower lid: a light line on the inner two thirds */}
        <path d={`M ${e.o[0] + (e.i[0] - e.o[0]) * 0.3} ${e.bot - h * 0.12} Q ${e.o[0] + (e.i[0] - e.o[0]) * 0.65} ${e.bot + 1} ${e.i[0]} ${e.i[1]}`} fill="none" stroke={col.lid} strokeWidth={lw * 0.7} strokeLinecap="round" />
      </g>
      {topCut < -1e3 ? (
        <g>
          {/* the liner: the upper lid, on into the wing */}
          <path d={`${upper}`} fill="none" stroke={col.ink} strokeWidth={g.liner} strokeLinecap="round" />
          <path d={`M ${e.o[0] + (e.i[0] - e.o[0]) * 0.18} ${e.o[1] - h * 0.32} Q ${e.o[0]} ${e.o[1] - h * 0.12} ${e.wing[0]} ${e.wing[1]} Q ${e.o[0] + out * 2} ${e.o[1] + 1} ${e.o[0] + (e.i[0] - e.o[0]) * 0.1} ${e.o[1] - h * 0.05} Z`} fill={col.ink} stroke={col.ink} strokeWidth={lw * 0.8} strokeLinejoin="round" />
          {Array.from({ length: e.lashes }, (_, n) => {
            const t = 0.05 + n * 0.12;
            const bx = e.o[0] + (e.i[0] - e.o[0]) * t;
            const by = e.o[1] - (e.o[1] - e.top) * (0.55 + n * 0.25) - 1;
            return <path key={n} d={`M ${bx} ${by} q ${out * w * 0.06} ${-h * 0.12} ${out * w * 0.12} ${-h * 0.1}`} fill="none" stroke={col.ink} strokeWidth={lw * 0.9} strokeLinecap="round" />;
          })}
        </g>
      ) : (
        <path d={`M ${e.o[0] - out * 2} ${topCut} L ${e.i[0]} ${topCut}`} fill="none" stroke={col.ink} strokeWidth={g.liner} strokeLinecap="round" />
      )}
      {botCut < 1e3 && <path d={`M ${e.o[0]} ${botCut} Q ${cx} ${botCut + 2} ${e.i[0]} ${botCut}`} fill="none" stroke={col.lid} strokeWidth={lw} strokeLinecap="round" />}
      {e.crease > 0 && topCut < -1e3 && (
        <path d={`M ${e.o[0] + (e.i[0] - e.o[0]) * 0.15} ${e.top + h * 0.05 - e.crease * 0.4} Q ${cx} ${e.top - e.crease} ${e.i[0] - (e.i[0] - e.o[0]) * 0.08} ${e.i[1] - h * 0.5}`} fill="none" stroke={col.lid} strokeWidth={lw * 0.7} strokeLinecap="round" opacity={0.8} />
      )}
    </g>
  );
};

const TracedEye: React.FC<{ g: FaceGeo; side: -1 | 1; eyes: FaceEyes; look: V; id: string }> = ({ g, side, eyes, look, id }) => {
  const e = g.eyes[side];
  const a = g.art![side];
  const cx = (e.o[0] + e.i[0]) / 2;
  const cy = (e.top + e.bot) / 2;
  const w = Math.abs(e.i[0] - e.o[0]);
  const h = e.bot - e.top;
  const k = eyes === "wide" ? 1.08 : 1;
  const clip = `${id}teye${side}`;
  // a piece: its layers clipped to its first one (the darker layers run past its edge, so they all end on it)
  const piece = (ls: [string, string][], k: string) => (
    <g transform={a.t}>
      <defs>
        <clipPath id={`${clip}${k}`}>
          <path d={ls[0][1]} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip}${k})`}>
        {ls.map(([c, d], n) => (
          <path key={n} d={d} fill={c} />
        ))}
      </g>
    </g>
  );
  // half and squint: the lid comes down (skin over the eye's own art above the cut, the liner along the cut)
  const topCut = eyes === "half" ? e.top + h * 0.45 : eyes === "squint" ? e.top + h * 0.38 : null;
  const botCut = eyes === "squint" ? e.bot - h * 0.22 : null;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
      <defs>
        <clipPath id={clip}>
          <path d={a.open} transform={a.t} />
        </clipPath>
        <clipPath id={`${clip}art`}>
          <path d={a.open} transform={a.t} />
          <path d={a.liner[0][1]} transform={a.t} />
        </clipPath>
      </defs>
      <path d={a.open} transform={a.t} fill={a.white} />
      <g clipPath={`url(#${clip})`}>
        {piece(a.sclera, "s")}
        {/* the iris slides; a copy a little higher fills in under the lid when it looks down */}
        {look[1] > 0 && <g transform={`translate(${look[0]} ${look[1] - 6})`}>{piece(a.iris, "j")}</g>}
        <g transform={`translate(${look[0]} ${look[1]})`}>{piece(a.iris, "i")}</g>
      </g>
      {piece(a.liner, "l")}
      {(topCut !== null || botCut !== null) && (
        <g>
          <g clipPath={`url(#${clip}art)`}>
            {topCut !== null && <rect x={cx - w} y={e.top - h} width={w * 2} height={topCut - e.top + h} fill={a.skin} />}
            {botCut !== null && <rect x={cx - w} y={botCut} width={w * 2} height={h} fill={a.skin} />}
          </g>
          {topCut !== null && <path d={`M ${e.o[0] - side * 3} ${topCut + 1} Q ${cx} ${topCut - 2} ${e.i[0]} ${topCut + 1}`} fill="none" stroke={g.col.ink} strokeWidth={g.liner} strokeLinecap="round" />}
          {botCut !== null && <path d={`M ${e.o[0]} ${botCut} Q ${cx} ${botCut + 2} ${e.i[0]} ${botCut}`} fill="none" stroke={g.col.lid} strokeWidth={g.lw} strokeLinecap="round" />}
        </g>
      )}
    </g>
  );
};

// a filled stroke along a quadratic p0 -> p2 whose half-width goes from w0 (at p0) to w1 (at p2) by `at`
const taper = (p0: V, p1: V, p2: V, w0: number, w1: number, at = 0.55, w2 = w1) => {
  const N = 14;
  const L: V[] = [];
  const R: V[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const u = 1 - t;
    const p: V = [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
    const d: V = [2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])];
    const l = Math.hypot(d[0], d[1]) || 1;
    const hw = t < at ? w0 + (w1 - w0) * Math.sin(((t / at) * Math.PI) / 2) : w1 + (w2 - w1) * ((t - at) / (1 - at)) ** 2;
    L.push([p[0] - (d[1] / l) * hw, p[1] + (d[0] / l) * hw]);
    R.push([p[0] + (d[1] / l) * hw, p[1] - (d[0] / l) * hw]);
  }
  return `M ${[...L, ...R.reverse()].map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")} Z`;
};

const Brow: React.FC<{ g: FaceGeo; side: -1 | 1; brows: FaceBrows }> = ({ g, side, brows }) => {
  const { a, m, b } = g.brows[side];
  // offsets for the outer end, the middle and the inner end, in Kukki's face px (scaled by g.s)
  const off: Record<FaceBrows, [number, number, number]> = {
    neutral: [0, 0, 0],
    raised: [-14, -26, -18],
    worried: [8, -6, -24],
    angry: [-10, 6, 22],
    smug: side === 1 ? [-14, -22, -14] : [6, 10, 8],
    flat: [10, 22, 12],
  };
  const [o1, o2, o3] = off[brows].map((v) => v * g.s);
  const mid = brows === "flat" ? (a[1] + b[1]) / 2 + o2 : m[1] + o2;
  const [p0, p1, p2]: V[] = [
    [a[0], a[1] + o1],
    [m[0], mid],
    [b[0], b[1] + o3],
  ];
  return (
    <g fill={g.col.brow}>
      <path d={taper(p0, p1, p2, g.browW * 0.2, g.browW / 2)} />
      <circle cx={p2[0]} cy={p2[1]} r={g.browW / 2} />
    </g>
  );
};

// open mouth: 0 = barely parted, 1 = wide; the picture's grin is about 0.6
const OpenMouth: React.FC<{ g: FaceGeo; o: number; id: string; tongue?: boolean }> = ({ g, o, id, tongue }) => {
  const { l, r, up, open, lip } = g.mouth;
  const { col, lw } = g;
  const cx = (l[0] + r[0]) / 2;
  const ly = (l[1] + r[1]) / 2;
  const span = open - ly;
  const bottom = ly + span * (0.25 + o * 1.25);
  const wk = 0.82 + 0.18 * Math.min(1, o / 0.6); // a small opening is narrower
  const L: V = [cx + (l[0] - cx) * wk, l[1]];
  const R: V = [cx + (r[0] - cx) * wk, r[1]];
  const opening = `M ${L[0]} ${L[1]} Q ${cx} ${ly + 5} ${R[0]} ${R[1]} ${arc(R, L, bottom)} Z`;
  const lipBot = bottom + (lip - open) * (0.8 + 0.4 * Math.min(1, o / 0.55));
  const clip = `${id}mouth`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={opening} />
        </clipPath>
      </defs>
      {/* lower lip, then the upper lip */}
      <path d={`M ${L[0]} ${L[1]} ${arc(L, R, bottom)} ${arc(R, L, lipBot)} Z`} fill={col.lip} />
      <path d={`M ${cx - (R[0] - L[0]) * 0.22} ${bottom + (lipBot - bottom) * 0.42} Q ${cx} ${bottom + (lipBot - bottom) * 0.3} ${cx + (R[0] - L[0]) * 0.22} ${bottom + (lipBot - bottom) * 0.42}`} fill="none" stroke={col.lipHi} strokeWidth={lw * 1.1} strokeLinecap="round" opacity={0.55} />
      <path d={`M ${L[0]} ${L[1]} ${arc(L, R, up)} Q ${cx} ${ly + 3} ${L[0]} ${L[1]} Z`} fill={col.lip} />
      <path d={opening} fill={col.mouth} />
      <g clipPath={`url(#${clip})`}>
        <path d={`M ${L[0] - 5} ${ly - 6} L ${R[0] + 5} ${ly - 6} L ${R[0] + 5} ${ly + 2} ${arc([R[0] + 5, ly + 2], [L[0] - 5, ly + 2], Math.min(bottom - span * 0.08, ly + span * 1.05))} Z`} fill={col.teeth} />
        {(tongue || o > 0.8) && <ellipse cx={cx} cy={bottom - span * 0.05} rx={(R[0] - L[0]) * 0.24} ry={span * 0.3} fill={col.tongue} />}
      </g>
      <path d={opening} fill="none" stroke={col.ink} strokeWidth={lw} strokeLinejoin="round" />
      {[L, R].map((p, n) => (
        <path key={n} d={`M ${p[0] + (n ? -1 : 1) * 2} ${p[1] + 1} l ${(n ? 1 : -1) * lw * 1.8} ${-lw * 1.2}`} stroke={col.ink} strokeWidth={lw * 1.1} strokeLinecap="round" />
      ))}
    </g>
  );
};

const Mouth: React.FC<{ g: FaceGeo; mouth: FaceMouth; open: number; id: string }> = ({ g, mouth, open, id }) => {
  const { l, r } = g.mouth;
  const { col, lw } = g;
  const cx = (l[0] + r[0]) / 2;
  const ly = (l[1] + r[1]) / 2;
  const w = r[0] - l[0];
  const line = { fill: "none", stroke: col.ink, strokeWidth: lw * 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const lipTint = (d: string) => <path d={d} fill="none" stroke={col.lip} strokeWidth={lw * 3.2} strokeLinecap="round" opacity={0.85} />;
  if (open > 0.05) return <OpenMouth g={g} o={Math.min(1, open)} id={id} />;
  switch (mouth) {
    case "grin":
      return <OpenMouth g={g} o={0.55} id={id} />;
    case "small":
      return <OpenMouth g={g} o={0.18} id={id} />;
    case "wide":
      return <OpenMouth g={g} o={1} id={id} tongue />;
    case "smile":
    case "closed": {
      const dip = mouth === "smile" ? w * 0.16 : w * 0.08;
      const k = mouth === "smile" ? 0.9 : 0.7;
      const d = `M ${cx - (w / 2) * k} ${ly} Q ${cx} ${ly + dip * 2} ${cx + (w / 2) * k} ${ly}`;
      return (
        <g>
          {lipTint(`M ${cx - w * 0.2} ${ly + dip * 1.35} Q ${cx} ${ly + dip * 1.7} ${cx + w * 0.2} ${ly + dip * 1.35}`)}
          <path d={d} {...line} />
        </g>
      );
    }
    case "o":
      return <ellipse cx={cx} cy={ly + w * 0.1} rx={w * 0.14} ry={w * 0.17} fill={col.mouth} stroke={col.ink} strokeWidth={lw} />;
    case "flat":
      return <path d={`M ${cx - w * 0.28} ${ly + w * 0.06} L ${cx + w * 0.28} ${ly + w * 0.06}`} {...line} />;
    case "frown":
      return <path d={`M ${cx - w * 0.3} ${ly + w * 0.14} Q ${cx} ${ly - w * 0.06} ${cx + w * 0.3} ${ly + w * 0.14}`} {...line} />;
    case "smirk":
      return <path d={`M ${cx - w * 0.3} ${ly + w * 0.05} Q ${cx + w * 0.02} ${ly + w * 0.16} ${cx + w * 0.34} ${ly - w * 0.06}`} {...line} />;
    default:
      return null;
  }
};

export type FaceProps = { eyes?: FaceEyes; eyesL?: FaceEyes; brows?: FaceBrows; mouth?: FaceMouth; mouthOpen?: number; look?: V; blush?: number };

// mark: the checkers' X-ray marks the eyes and the mouth as their own parts (src/wedding/check.tsx)
export const Face: React.FC<FaceProps & { g: FaceGeo; id: string; over?: React.ReactNode; mark?: (k: "eyes" | "muzzle", node: React.ReactNode) => React.ReactNode }> = ({
  g,
  id,
  eyes = "open",
  eyesL,
  brows = "neutral",
  mouth = "grin",
  mouthOpen = 0,
  look = [0, 0],
  blush = 0,
  over,
  mark = (_k, node) => node,
}) => {
  const b = Math.min(1, g.blush + blush * 0.7);
  const bw = (g.mouth.r[0] - g.mouth.l[0]) * 0.55;
  return (
  <g>
    <defs>
      <radialGradient id={`${id}blush`}>
        <stop offset="0" stopColor={g.col.blush} stopOpacity={0.75} />
        <stop offset="1" stopColor={g.col.blush} stopOpacity={0} />
      </radialGradient>
    </defs>
    {b > 0 && g.cheeks.map((c, n) => <ellipse key={n} cx={c[0]} cy={c[1]} rx={bw} ry={bw * 0.6} fill={`url(#${id}blush)`} opacity={b} />)}
    {mark(
      "eyes",
      <>
        <Eye g={g} side={-1} eyes={eyesL ?? eyes} look={look} id={id} />
        <Eye g={g} side={1} eyes={eyes} look={look} id={id} />
      </>,
    )}
    <Brow g={g} side={-1} brows={brows} />
    <Brow g={g} side={1} brows={brows} />
    {mark("muzzle", <Mouth g={g} mouth={mouth} open={mouthOpen} id={id} />)}
    {g.stache && (
      <g fill={g.stache.col}>
        {g.stache.halves.map(([a, m, c], n) => (
          <g key={n}>
            <path d={taper(a, m, c, g.stache!.w * 0.2, g.stache!.w * 0.62, 0.45, g.stache!.w * 0.3)} opacity={0.25} />
            <path d={taper(a, m, c, g.stache!.w * 0.1, g.stache!.w / 2, 0.45, g.stache!.w * 0.18)} opacity={0.62} />
          </g>
        ))}
        {g.stache.patch && (
          <ellipse cx={g.stache.patch[0]} cy={g.stache.patch[1]} rx={6} ry={4} opacity={0.12} />
        )}
      </g>
    )}
    {over}
  </g>
  );
};
