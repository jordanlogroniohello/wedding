// Shared bits for the traced Dan & Ange puppets (wedding test, 2026-10-25). The arm skinning is the one in
// src/characters/kukki-miru/MoreDetailedCuteKukki.tsx (that file is left as approved), with the picture's height and
// the blend lengths as parameters instead of Kukki's numbers.

export type V = [number, number];

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const rot = (p: V, c: V, a: number): V => {
  const [s, k] = [Math.sin(a), Math.cos(a)];
  const [dx, dy] = [p[0] - c[0], p[1] - c[1]];
  return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k];
};
export const unit = (x: number, y: number): V => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

// a potrace path (drawn inside POTRACE_T) -> subpaths of cubic points [p0, c1, c2, p1, ...] in picture space, cut into
// ~24px pieces so a bent path follows the bend
export const toCubics = (d: string, picH: number): V[][] => {
  const tok = d.match(/[MmCcLlZz]|-?\d*\.?\d+/g) ?? [];
  const P = (x: number, y: number): V => [x * 0.1, picH - y * 0.1];
  const subs: V[][] = [];
  let cur: V[] = [];
  let [x, y, x0, y0] = [0, 0, 0, 0];
  let cmd = "";
  const seg = (a: V, b: V, c: V, e: V) => {
    const n = Math.max(1, Math.ceil((Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(e[0] - c[0], e[1] - c[1])) / 24));
    const at = (t: number): V => {
      const u = 1 - t;
      return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1]];
    };
    const dt = (t: number): V => {
      const u = 1 - t;
      return [3 * (u * u * (b[0] - a[0]) + 2 * u * t * (c[0] - b[0]) + t * t * (e[0] - c[0])), 3 * (u * u * (b[1] - a[1]) + 2 * u * t * (c[1] - b[1]) + t * t * (e[1] - c[1]))];
    };
    for (let i = 0; i < n; i++) {
      const [t0, t1] = [i / n, (i + 1) / n];
      const [q0, q3, d0, d1] = [at(t0), at(t1), dt(t0), dt(t1)];
      const h = (t1 - t0) / 3;
      cur.push([q0[0] + d0[0] * h, q0[1] + d0[1] * h], [q3[0] - d1[0] * h, q3[1] - d1[1] * h], q3);
    }
  };
  const line = (e: V) => {
    const a = cur[cur.length - 1];
    seg(a, [a[0] + (e[0] - a[0]) / 3, a[1] + (e[1] - a[1]) / 3], [a[0] + ((e[0] - a[0]) * 2) / 3, a[1] + ((e[1] - a[1]) * 2) / 3], e);
  };
  for (let i = 0; i < tok.length; ) {
    if (/[A-Za-z]/.test(tok[i])) {
      cmd = tok[i++];
      if (cmd === "z" || cmd === "Z") {
        if (x !== x0 || y !== y0) line(P(x0, y0));
        [x, y] = [x0, y0];
        if (cur.length > 1) subs.push(cur);
        cur = [];
      }
      continue;
    }
    const n = () => parseFloat(tok[i++]);
    if (cmd === "M" || cmd === "m") {
      const rel = cmd === "m";
      [x, y] = rel ? [x + n(), y + n()] : [n(), n()];
      [x0, y0] = [x, y];
      cur = [P(x, y)];
      cmd = rel ? "l" : "L";
    } else if (cmd === "c" || cmd === "C") {
      const [ox, oy] = cmd === "c" ? [x, y] : [0, 0];
      const pts = [n(), n(), n(), n(), n(), n()];
      seg(cur[cur.length - 1], P(ox + pts[0], oy + pts[1]), P(ox + pts[2], oy + pts[3]), P(ox + pts[4], oy + pts[5]));
      [x, y] = [ox + pts[4], oy + pts[5]];
    } else if (cmd === "l" || cmd === "L") {
      const [ox, oy] = cmd === "l" ? [x, y] : [0, 0];
      [x, y] = [ox + n(), oy + n()];
      line(P(x, y));
    } else i++;
  }
  if (cur.length > 1) subs.push(cur);
  return subs;
};

const f1 = (p: V) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
// cubic points back to a closed SVG path, each point moved by fn (its subpath and index, for precomputed weights)
export const toPath = (subs: V[][], fn: (p: V, i: number, j: number) => V) =>
  subs
    .map((sub, i) => {
      const q = sub.map((p, j) => fn(p, i, j));
      let d = `M ${f1(q[0])}`;
      for (let j = 1; j + 2 < q.length; j += 3) d += ` C ${f1(q[j])} ${f1(q[j + 1])} ${f1(q[j + 2])}`;
      return `${d} Z`;
    })
    .join(" ");

// a stack of traced colour layers [colour, path] (lightest first), drawn inside the parts file's POTRACE_T
export const Layers: React.FC<{ layers: [string, string][]; t: string }> = ({ layers, t }) => (
  <g transform={t}>
    {layers.map(([fill, d], i) => (
      <path key={i} d={d} fill={fill} />
    ))}
  </g>
);

// ---- arms: each traced arm (shoulder to hand) is ONE piece, bent in code (2D skinning). Every point turns about the
// shoulder by a share of the upper arm's angle, then about the elbow by a share of the forearm's extra angle, so the
// arm bends like one soft limb with no joint lines, and the rest pose is exactly the picture.
// S = shoulder pivot (in the thin top of the arm), E = middle of the arm at the elbow, out/inn = just inside the
// outer/inner outline there, tip = the hand's tip. side -1 = the screen-left arm.
// cuff = the middle of the sleeve's end (the hand starts there; optional)
export type ArmRig = { S: V; E: V; out: V; inn: V; tip: V; cuff?: V };
export type ArmBlend = { shoulder: V; elbow: number; full: number; fullAlong: [number, number, number, number] };
export type Skin = { pts: V[][]; wu: number[][]; wf: number[][]; fl: number[][]; nIn: V };

export const skin = (g: ArmRig, side: -1 | 1, d: string, picH: number, b: ArmBlend): Skin => {
  const u0 = unit(g.E[0] - g.S[0], g.E[1] - g.S[1]);
  const f0 = unit(g.tip[0] - g.E[0], g.tip[1] - g.E[1]);
  const n = unit(u0[0] + f0[0], u0[1] + f0[1]); // across the elbow: halfway between the upper arm and the forearm
  const nIn: V = [-u0[1] * side, u0[0] * side]; // toward the chest
  const pts = toCubics(d, picH);
  const along = (p: V) => (p[0] - g.S[0]) * u0[0] + (p[1] - g.S[1]) * u0[1];
  const [a0, a1, a2, a3] = b.fullAlong;
  return {
    pts,
    nIn,
    wu: pts.map((s) => s.map((p) => smooth(b.shoulder[0], b.shoulder[1], along(p)))),
    wf: pts.map((s) => s.map((p) => smooth(-b.elbow, b.elbow, (p[0] - g.E[0]) * n[0] + (p[1] - g.E[1]) * n[1]))),
    fl: pts.map((s) =>
      s.map((p) => {
        const l = (p[0] - g.S[0]) * nIn[0] + (p[1] - g.S[1]) * nIn[1];
        const a = along(p);
        return l > 0 ? l * b.full * smooth(a0, a1, a) * (1 - smooth(a2, a3, a)) : 0;
      }),
    ),
  };
};

// [upper arm, forearm] in degrees from hanging straight down, positive = away from the body; rest = the picture's.
// The angles and the elbow's pivot: the upper arm turns by tu about the shoulder, the forearm by tr more about piv
export const armFrame = (g: ArmRig, side: -1 | 1, ua: number, fa: number, rest: [number, number]) => {
  const [ua0, fa0] = rest;
  const tu = ((ua - ua0) * -side * Math.PI) / 180;
  const rel = fa - fa0 - (ua - ua0); // > 0: the forearm folds further out than the upper arm turned
  const tr = (rel * -side * Math.PI) / 180;
  // the elbow turns about a point toward the inside of the bend, so that side creases instead of folding over
  const s = Math.max(-1, Math.min(1, rel / 20)) * 0.7;
  const e = s >= 0 ? g.out : g.inn;
  const piv = rot([g.E[0] + (e[0] - g.E[0]) * Math.abs(s), g.E[1] + (e[1] - g.E[1]) * Math.abs(s)], g.S, tu);
  return { tu, tr, piv };
};
// fore < 1 shortens the forearm toward the elbow (it swings toward the camera mid-raise): the sleeve squashes up to its
// cuff, the hand past it moves up whole
const foreShift = (g: ArmRig, fore: number) => {
  const f0 = unit(g.tip[0] - g.E[0], g.tip[1] - g.E[1]);
  const c = g.cuff ?? g.tip;
  const Lc = (c[0] - g.E[0]) * f0[0] + (c[1] - g.E[1]) * f0[1];
  return { f0, Lc, k: 1 - fore };
};
export const bent = (sk: Skin, g: ArmRig, side: -1 | 1, ua: number, fa: number, rest: [number, number], fore = 1) => {
  const { tu, tr, piv } = armFrame(g, side, ua, fa, rest);
  const full = Math.max(0, Math.min(1, (ua - 20) / 25));
  const fs = foreShift(g, fore);
  return toPath(sk.pts, (p0, i, j) => {
    const k = sk.fl[i][j] * full;
    let p: V = k ? [p0[0] + sk.nIn[0] * k, p0[1] + sk.nIn[1] * k] : p0;
    if (fs.k) {
      const a = (p[0] - g.E[0]) * fs.f0[0] + (p[1] - g.E[1]) * fs.f0[1];
      const d = a > 0 ? fs.k * Math.min(a, fs.Lc) * sk.wf[i][j] : 0;
      if (d) p = [p[0] - fs.f0[0] * d, p[1] - fs.f0[1] * d];
    }
    return rot(rot(p, g.S, sk.wu[i][j] * tu), piv, sk.wf[i][j] * tr);
  });
};
// the hand's own transform (rest picture space -> bent): it moves whole with the forearm, as an SVG transform
export const handT = (g: ArmRig, side: -1 | 1, ua: number, fa: number, rest: [number, number], fore = 1) => {
  const { tu, tr, piv } = armFrame(g, side, ua, fa, rest);
  const fs = foreShift(g, fore);
  const deg = 180 / Math.PI;
  return `rotate(${tr * deg} ${piv[0]} ${piv[1]}) rotate(${tu * deg} ${g.S[0]} ${g.S[1]}) translate(${-fs.f0[0] * fs.k * fs.Lc} ${-fs.f0[1] * fs.k * fs.Lc})`;
};
// ---- hair (round 6, the user: "what if we also consider hair? can you trace it?"): the hair is ONE traced piece over
// the face, bent in code like the arms. Every point turns about the crown by the swing times its weight: 0 above `from`
// (the crown and the hair over the forehead stay with the head), 1 from `to` down (the tips), so the hair bends like one
// soft lock with no cut lines, and at swing 0 it's exactly the picture.
export type HairRig = { crown: V; from: number; to: number };
export type SwayPiece = { c: string; d: string; pts: V[][]; w: number[][] };
export const swayPieces = (layers: [string, string][], picH: number, rig: HairRig): SwayPiece[] =>
  layers.map(([c, d]) => {
    const pts = toCubics(d, picH);
    return { c, d, pts, w: pts.map((s) => s.map((p) => smooth(rig.from, rig.to, p[1]))) };
  });
// a point where the swing puts it (for anything that hangs on the hair)
export const swayAt = (rig: HairRig, deg: number, p: V): V => rot(p, rig.crown, ((deg * Math.PI) / 180) * smooth(rig.from, rig.to, p[1]));
// the pieces swung by `deg` (+ = clockwise: the tips go screen-left); drawn in picture space (at 0, the traced paths)
export const Sway: React.FC<{ pieces: SwayPiece[]; rig: HairRig; deg: number; t: string; fill?: string }> = ({ pieces, rig, deg, t, fill }) =>
  Math.abs(deg) < 0.01 ? (
    <g transform={t}>
      {pieces.map(({ c, d }, i) => (
        <path key={i} d={d} fill={fill ?? c} />
      ))}
    </g>
  ) : (
    <g>
      {pieces.map(({ c, pts, w }, i) => (
        <path key={i} d={toPath(pts, (p, a, b) => rot(p, rig.crown, ((deg * Math.PI) / 180) * w[a][b]))} fill={fill ?? c} />
      ))}
    </g>
  );
// the hair's follow-through: a soft spring chasing `target` (e.g. the head's tilt) frame by frame; returns how far the
// hair lags behind it (degrees; past it on the overshoot)
export const springLag = (target: (f: number) => number, f: number, k = 0.14, damp = 0.32) => {
  let [x, v] = [target(0), 0];
  for (let i = 1; i <= f; i++) {
    v += k * (target(i) - x) - damp * v;
    x += v;
  }
  return x - target(f);
};

// a point of the hand (rest space) where handT puts it
export const handAt = (g: ArmRig, side: -1 | 1, ua: number, fa: number, rest: [number, number], p: V, fore = 1): V => {
  const { tu, tr, piv } = armFrame(g, side, ua, fa, rest);
  const fs = foreShift(g, fore);
  return rot(rot([p[0] - fs.f0[0] * fs.k * fs.Lc, p[1] - fs.f0[1] * fs.k * fs.Lc], g.S, tu), piv, tr);
};
