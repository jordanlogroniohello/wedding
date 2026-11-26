import { useId } from "react";
import { CheckLog, checkOn, CheckRoot, FLAT_PROP, part, xrayKeys } from "./check";
import { EYES, LIFT_GRID, PARTS, PIC_H, POTRACE_T } from "./moreDetailedCuteAngeParts";
import { Face, type FaceGeo, type FaceProps } from "./tracedFace";
import { smooth, Sway, swayPieces, toCubics, toPath, Layers, type HairRig, type V } from "./tracedRig";
import { WineGlass } from "./WineGlass";

// MoreDetailedCute Ange: rebuilt from the user's own Dan & Ange picture (wedding test, 2026-10-25, for review).
// Traced in parts (moreDetailedCuteAngeParts.ts, src/wedding/trace/split.py; round 5, the user: "head, body, shoulder +
// arms, hands, feet"; round 6, "what if we also consider hair?"): head (the face and ears, eyes; it carries on under the
// hair), the hair (down to the locks over her shoulders; it sways, with its shadow on her skin), the back hair (behind
// everything), body (the dress, with what the others hide traced in), each shoulder + arm, each hand, the bouquet, each
// shoe (under the hem). The brows and mouth are drawn in code.
// Her hands hold the bouquet together, so her arms, hands and bouquet move together: `lift` raises the bouquet, the
// forearms following from the elbows (weights = how far along the arms from the shoulders, LIFT_GRID). `hold: "glass"`
// swaps the bouquet for a wine glass (the LED stage's toast), held in hands drawn in code.
// Picture px (1216x1294); the origin is bottom-centre between the shoes, ~560px tall at scale 1.

const K = 0.5;
const FEET: V = [853, 1229];
const NECK: V = [860, 480];
// the hair bends from the crown: still over the forehead, the curtains swinging from her eyes down to the tips
const HAIR: HairRig = { crown: [860, 150], from: 300, to: 640 };
const HAIR_PC = swayPieces(PARTS.hair, PIC_H, HAIR);
const SHADE_PC = swayPieces(PARTS.shade, PIC_H, HAIR);
// how much of the follow-through the hair takes (her long hair takes the whole swing)
const HAIR_SWING = 1;
// the back hair: the hair again, in shadow, behind her (what shows where the hair swings off reads as more hair
// behind; a flat fill read as a dark wedge)
const BackHair: React.FC = () => (
  <>
    <Layers layers={PARTS.hair} t={POTRACE_T} />
    <path transform={POTRACE_T} d={PARTS.hair[0][1]} fill="#0B0807" opacity={0.45} />
  </>
);
// along the arms from the shoulders: the elbows are ~75px down; it runs on past the wrists (117-145 in LIFT_GRID) into
// the hands, so the forearms rise softly (ending it at the wrists folded them at the elbows)
const LIFT_FROM = 70;
const LIFT_TO = 170;
const LIFT_PX = 40;
// what her clasped hands hold: the picture's bouquet, or a wine glass (the toast; the dress under the bouquet is traced
// in for it). Its origin is the middle of its stem
const GLASS_AT: V = [856, 726];
export const angeGlassAt = (lift: number): V => handMove("grip", -lift * LIFT_PX)(GLASS_AT);
// her hands with the glass, drawn (round 9, the user: "angelica hands twisted"; the traced hands clasp the bouquet's
// thick stems, and round a thin stem they read twisted): the screen-left hand cups the glass's foot under it, the
// screen-right one wraps its stem over it, four fingers. Each: its shape (from ~10px up the forearm, over its end), its
// outlines (carrying on the forearms' edges: the under ones from where the picture's ink ends, round 11), a soft shade
// along its underside, its wrist (where the forearm ends under it) and its arm's side (ARM_PTS: the elbow). Lifted, each
// moves whole with its wrist (`handMove`), its forearm bending into that move just before the wrist (`liftPath`; by the
// arms' weights all through they squashed: those run on to 1 in the hands); the glass moves with the hand round its stem
const HAND_LINE = "#2E2520";
const GLASS_HANDS = {
  cup: {
    d: "M 812 707 L 790 725 C 794 746 810 760 836 766 C 852 769 866 768 874 762 C 879 755 870 746 858 741 C 846 734 832 728 821 722 C 817 716 815 711 812 707 Z",
    lines: ["M 774 716 C 780 719.5 786 723 789 725.5 C 792 728 794 731 795 735 C 801 751 814 761 836 766 C 852 769 866 768 874 762 C 877 757 875 752 870 749", "M 812 707 C 816 713 819 718 821 722 C 830 729 838 735 846 740"],
    creases: [] as string[],
    shade: "M 803 745 C 812 757 826 763 842 765 C 856 767 866 765 872 761",
    wrist: [[821, 723], [803, 735]] as V[],
    side: "L" as const,
    roll: 0.5,
  },
  grip: {
    d: "M 907 693 L 929 719 C 920 727 913 730 909 735 C 901 743 892 748 878 750 C 862 753 846 752 840 746 C 834 740 834 730 840 724 C 846 719 856 717 866 716 C 880 714 892 709 899 706 C 902 702 905 697 907 693 Z",
    lines: ["M 946 712 C 939 715.5 932 718.8 926 722 C 919 726 914 729 911 732 C 903 741 893 747 878 750 C 862 753 846 752 840 746 C 834 740 834 730 840 724 C 846 719 856 717 866 716 C 880 714 892 709 899 706 C 902 702 905 697 907 693"],
    creases: ["M 864 727 C 857 727 850 728 844 730", "M 866 735 C 858 736 851 737 843 737", "M 865 743 C 858 744 851 744 845 743"],
    shade: "M 912 734 C 902 743 890 748 876 751 C 860 753 848 752 841 747",
    wrist: [[899, 706], [913, 728]] as V[],
    side: "R" as const,
    roll: 0.4,
  },
};
type Hand = keyof typeof GLASS_HANDS;
// a hand's wrist: its ends, its middle and how high it lifts (the arms' weights there)
const wristOf = (hand: Hand) => {
  const [a, b] = GLASS_HANDS[hand].wrist;
  const c: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return { a, b, c, lift: (liftWeight(a) + liftWeight(b) + liftWeight(c)) / 3 };
};
// how a hand moves with the arms' lift `dy`: whole, as high as its wrist rises, rolling part way (`roll`) with its forearm
// (the forearm's turn from its elbow to the wrist; the rest is the wrist bending: the hand round the stem rolls less, its
// glass upright)
const handMove = (hand: Hand, dy: number) => {
  const { side, roll } = GLASS_HANDS[hand];
  const { c, lift } = wristOf(hand);
  const e = ARM_PTS[side].elbow;
  // (from the forearm's direction at rest to lifted: cross and dot, the screen-right one points through 180 degrees)
  const v = [c[0] - e[0], c[1] - e[1]];
  const u = [v[0], v[1] + dy * lift];
  const turn = Math.atan2(v[0] * u[1] - v[1] * u[0], v[0] * u[0] + v[1] * u[1]) * roll;
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  return (p: V): V => [c[0] + (p[0] - c[0]) * cos - (p[1] - c[1]) * sin, c[1] + dy * lift + (p[0] - c[0]) * sin + (p[1] - c[1]) * cos];
};
// with the glass, each forearm rises straight: its weight runs evenly along it, from its elbow `e` (easing in) to 1 at
// its wrist `c`. Round 11: by the arms' weights (how far along from the shoulders: they climb unevenly, steepest at the
// wrists) a lifted glass tipped the forearms' ends up ~50 degrees while the hands turned half that, and the outlines
// peaked at the wrists
const forearmWeight = (p: V, e: V, c: V) => {
  const x = Math.max(0, Math.min(1, ((p[0] - e[0]) * (c[0] - e[0]) + (p[1] - e[1]) * (c[1] - e[1])) / ((c[0] - e[0]) ** 2 + (c[1] - e[1]) ** 2)));
  const k = 0.3;
  return (x < k ? (x * x) / (2 * k) : x - k / 2) / (1 - k / 2);
};
// each point: up the forearm, its straight rise, bending into the hand's move over the last BEND px before the wrist (so
// the outlines run on into the hand's); past the wrist, the hand's move. The traced forearms and the drawn hands both
// move this way
const BEND = 36;
const liftPoint = (dy: number, hand: Hand) => {
  const { a, b, c, lift } = wristOf(hand);
  const e = ARM_PTS[GLASS_HANDS[hand].side].elbow;
  const move = handMove(hand, dy);
  // (the wrist's normal, toward the hand: the glass's side)
  const n = [a[1] - b[1], b[0] - a[0]];
  const l = Math.hypot(n[0], n[1]) * Math.sign((GLASS_AT[0] - a[0]) * n[0] + (GLASS_AT[1] - a[1]) * n[1]);
  return (p: V): V => {
    const past = ((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]) / l;
    const m = move(p);
    if (past >= 0) return m;
    const t = smooth(-BEND, 0, past);
    const sy = p[1] + dy * lift * forearmWeight(p, e, c);
    return [p[0] + (m[0] - p[0]) * t, sy + (m[1] - sy) * t];
  };
};
// (the paths' points are all x y pairs)
const liftPath = (d: string, dy: number, hand: Hand) => {
  if (!dy) return d;
  const f = liftPoint(dy, hand);
  return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => {
    const [px, py] = f([+x, +y]);
    return `${px.toFixed(1)} ${py.toFixed(1)}`;
  });
};
const GlassHand: React.FC<{ hand: Hand; dy: number; id: string; flat?: string }> = ({ hand, dy, id, flat }) => {
  const g = GLASS_HANDS[hand];
  const h = { d: liftPath(g.d, dy, hand), shade: liftPath(g.shade, dy, hand), lines: g.lines.map((d) => liftPath(d, dy, hand)), creases: g.creases.map((d) => liftPath(d, dy, hand)) };
  if (flat) return <path d={h.d} fill={flat} />;
  return (
    <>
      <clipPath id={`${id}${hand}`}>
        <path d={h.d} />
      </clipPath>
      <path d={h.d} fill="#FACBAA" />
      <path d={h.shade} clipPath={`url(#${id}${hand})`} fill="none" stroke="#ECAB89" strokeWidth={8} strokeLinecap="round" />
      <g fill="none" stroke={HAND_LINE} strokeLinecap="round" strokeLinejoin="round">
        {h.lines.map((d, i) => (
          <path key={`l${i}`} d={d} strokeWidth={2.6} />
        ))}
        {h.creases.map((d, i) => (
          <path key={`c${i}`} d={d} strokeWidth={1.8} />
        ))}
      </g>
    </>
  );
};

const liftWeight = (p: V) => {
  const { x0, y0, step, d } = LIFT_GRID;
  // blended from the measured cells round it (round 9: the nearest cell's weight stepped, ~5px a cell at a full lift,
  // and the forearms' edges went jagged)
  const fx = (p[0] - x0) / step;
  const fy = (p[1] - y0) / step;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  let sum = 0;
  let ws = 0;
  for (const [cx, cy, w] of [
    [ix, iy, (1 - (fx - ix)) * (1 - (fy - iy))],
    [ix + 1, iy, (fx - ix) * (1 - (fy - iy))],
    [ix, iy + 1, (1 - (fx - ix)) * (fy - iy)],
    [ix + 1, iy + 1, (fx - ix) * (fy - iy)],
  ]) {
    const v = d[cy]?.[cx];
    if (v !== undefined && v >= 0) {
      sum += v * w;
      ws += w;
    }
  }
  if (ws > 0) return smooth(LIFT_FROM, LIFT_TO, sum / ws);
  const gx = Math.round(fx);
  const gy = Math.round(fy);
  // the traced outline sits up to a few px outside the mask: take the nearest measured cell
  for (let r = 0; r <= 3; r++) {
    let best = -1;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const v = d[gy + dy]?.[gx + dx];
        if (v !== undefined && v >= 0 && (best < 0 || v < best)) best = v;
      }
    if (best >= 0) return smooth(LIFT_FROM, LIFT_TO, best);
  }
  return 0;
};
// the lifting parts, bottom to top (each carries on a few px under the ones over it): the arms bend by their weights,
// the hands and the bouquet they hold move whole
const LIFTING = ["armL", "armR", "bouquet", "handL", "handR"] as const;
const PIECES = Object.fromEntries(
  LIFTING.map((k) => [
    k,
    PARTS[k].map(([c, d]) => {
      const pts = toCubics(d, PIC_H);
      return { c, pts, w: pts.map((s) => s.map((p) => (k === "armL" || k === "armR" ? liftWeight(p) : 1))) };
    }),
  ]),
) as Record<(typeof LIFTING)[number], { c: string; pts: V[][]; w: number[][] }[]>;

const INK = "#17110D";
const FACE: FaceGeo = {
  art: EYES, // the open eyes are the picture's own (traced); the other states are drawn
  eyes: {
    [-1]: { o: [772, 345], i: [829, 347], top: 322, bot: 358, wing: [764, 341], iris: [802.5, 344], r: 18, shine: [[[795, 336], 3.8], [[810.5, 336], 3.4]], crease: 5, lashes: 2 },
    [1]: { o: [944, 345], i: [888, 347], top: 322, bot: 358, wing: [953, 341], iris: [916, 344], r: 18, shine: [[[905, 336], 3.8], [[920, 335], 3.4]], crease: 5, lashes: 2 },
  },
  brows: {
    [-1]: { a: [790, 307], m: [808, 297], b: [832, 306] },
    [1]: { a: [930, 306], m: [910, 297], b: [886, 307] },
  },
  browW: 8,
  mouth: { l: [817, 411], r: [899, 411], up: 405, open: 432, teeth: 428, lip: 441 },
  cheeks: [
    [788, 386],
    [930, 386],
  ],
  blush: 0.45,
  s: 0.36,
  lw: 2,
  liner: 5.6,
  col: { ink: INK, brow: "#33251E", iris: "#3A2218", irisLo: "#6E4430", white: "#FBFAF7", lid: "#B88270", lip: "#E88A7A", lipHi: "#F4B3A3", mouth: "#5A2420", tongue: "#D9746A", teeth: "#FBFAF7", blush: "#F3A08C" },
};

export type MoreDetailedCuteAngeProps = FaceProps & {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  tilt?: number;
  lift?: number; // 0 = the picture (bouquet at her waist), 1 = raised ~40px
  hold?: "bouquet" | "glass";
  hair?: number; // the hair's swing past the head, degrees (+ = the tips go screen-left): its follow-through, springLag
  squash?: number;
  time?: number;
};

// for the checkers' log (picture px): the arms' points (the elbows and wrists lift by their weight)
const ARM_PTS: Record<"L" | "R", Record<"sh" | "elbow" | "wrist" | "paw", V>> = {
  L: { sh: [765, 575], elbow: [722, 668], wrist: [800, 728], paw: [838, 752] },
  R: { sh: [955, 575], elbow: [1000, 672], wrist: [893, 725], paw: [868, 745] },
};

export const MoreDetailedCuteAnge: React.FC<MoreDetailedCuteAngeProps> = ({ x, y, scale = 1, flip = false, tilt = 0, lift = 0, hold = "bouquet", hair = 0, squash = 0, time, ...face }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const live = time !== undefined;
  const breath = live ? Math.sin((time ?? 0) / 22) * 0.006 : 0;
  const sx = 1 + squash * 0.5 - breath * 0.5;
  const sy = 1 - squash + breath;
  // (and a slow idle sway)
  const swing = hair * HAIR_SWING + (live ? Math.sin((time ?? 0) / 38) * 0.7 : 0);
  const dy = -lift * LIFT_PX;
  // (with the glass, each forearm runs into its drawn hand's move past the wrist)
  const glassArm = { armL: hold === "glass" && lift ? liftPoint(dy, "cup") : undefined, armR: hold === "glass" && lift ? liftPoint(dy, "grip") : undefined } as Record<string, ((p: V) => V) | undefined>;
  const lifted = Object.fromEntries(
    LIFTING.map((k) => [
      k,
      PIECES[k].map(({ c, pts, w }) => {
        const ga = glassArm[k];
        return [c, ga ? toPath(pts, (p) => ga(p)) : lift ? toPath(pts, (p, a, b) => [p[0], p[1] + dy * w[a][b]]) : toPath(pts, (p) => p)] as const;
      }),
    ]),
  ) as Record<(typeof LIFTING)[number], (readonly [string, string])[]>;
  // the checkers' X-ray (off in every normal render): Ange is "ange" in the cast (src/characters/cast.json)
  const ck = checkOn();
  const keys = ck.hand ? xrayKeys("ange") : undefined;
  const headT = `rotate(${tilt} ${NECK[0]} ${NECK[1]})`;
  // (with the glass, every arm point moves as drawn: the paws whole with their wrists)
  const armLog = (sd: "L" | "R") =>
    Object.fromEntries(
      Object.entries(ARM_PTS[sd]).map(([k, p]) => [`${k}${sd}`, hold === "glass" ? liftPoint(dy, sd === "L" ? "cup" : "grip")(p) : ([p[0], p[1] + dy * liftWeight(p)] as V)]),
    );
  return (
    <CheckRoot who="ange" uid={id} on={ck.rule}>
      <g transform={`translate(${x} ${y}) scale(${scale * K * (flip ? -1 : 1)} ${scale * K}) scale(${sx} ${sy}) translate(${-FEET[0]} ${-FEET[1]})`}>
        {/* the back hair, behind her: what the swinging hair uncovers beside her face and neck */}
        <g transform={headT}>{part(ck.rule, "head", <BackHair />)}</g>
        {part(
          ck.rule,
          "body",
          <>
            {/* the shoes under the dress's hem */}
            <Layers layers={PARTS.footL} t={POTRACE_T} />
            <Layers layers={PARTS.footR} t={POTRACE_T} />
            <Layers layers={PARTS.body} t={POTRACE_T} />
          </>,
        )}
        {keys ? (
          <g shapeRendering="crispEdges">
            {/* each side's arm, the hands and the bouquet split down her middle into armL / armR (the motion sheet reads
                each one's box; the hands clasp in the middle, so each side's paw is the hands on its side) */}
            <defs>
              {(["L", "R"] as const).map((sd) => (
                <clipPath key={sd} id={`${id}half${sd}`}>
                  <rect x={sd === "L" ? 0 : NECK[0]} y={0} width={sd === "L" ? NECK[0] : 1300} height={1400} />
                </clipPath>
              ))}
            </defs>
            {(["L", "R"] as const).map((sd) => (
              <g key={sd} data-rcp={`arm${sd}`} clipPath={`url(#${id}half${sd})`}>
                <path d={lifted[`arm${sd}`][0][1]} fill={keys.arm} />
                {hold === "glass" ? (
                  <>
                    <GlassHand hand="cup" dy={dy} id={id} flat={keys.paw} />
                    <WineGlass at={angeGlassAt(lift)} id={`${id}x${sd}`} xray={FLAT_PROP} />
                    <GlassHand hand="grip" dy={dy} id={id} flat={keys.paw} />
                  </>
                ) : (
                  <>
                    <path d={lifted.bouquet[0][1]} fill={FLAT_PROP} />
                    <path d={lifted.handL[0][1]} fill={keys.paw} />
                    <path d={lifted.handR[0][1]} fill={keys.paw} />
                  </>
                )}
              </g>
            ))}
          </g>
        ) : (
          LIFTING.map((k) =>
            hold === "glass" && k !== "armL" && k !== "armR" ? (
              k === "bouquet" && (
                <g key={k}>
                  <GlassHand hand="cup" dy={dy} id={id} />
                  <WineGlass at={angeGlassAt(lift)} time={time} id={`${id}glass`} />
                  <GlassHand hand="grip" dy={dy} id={id} />
                </g>
              )
            ) : (
              lifted[k].map(([c, d], i) => <path key={`${k}${i}`} fill={c} d={d} />)
            ),
          )
        )}
        {/* the hair's shadow on her skin moves with the hair, kept on her skin and dress (not in the X-ray) */}
        {!ck.hand && (
          <>
            <defs>
              <clipPath id={`${id}onBody`}>
                <path transform={POTRACE_T} d={PARTS.body[0][1]} />
                <path transform={POTRACE_T} d={PARTS.armL[0][1]} />
                <path transform={POTRACE_T} d={PARTS.armR[0][1]} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${id}onBody)`}>
              <g transform={headT}>
                <Sway pieces={SHADE_PC} rig={HAIR} deg={swing} t={POTRACE_T} />
              </g>
            </g>
          </>
        )}
        <g transform={headT}>
          {part(ck.rule, "head", <Layers layers={PARTS.head} t={POTRACE_T} />)}
          <Face g={FACE} id={id} {...face} mark={ck.rule ? (k, n) => part(true, k, n) : undefined} />
          {part(ck.rule, "head", <Sway pieces={HAIR_PC} rig={HAIR} deg={swing} t={POTRACE_T} />)}
        </g>
        {ck.rule && (
          <CheckLog
            who="ange"
            uid={id}
            info={{ pose: "stand", view: "front", flip, scale, eyes: face.eyes ?? "open", mouth: face.mouth ?? "grin", open: face.mouthOpen ?? 0, tilt, lift, hold, hair: swing }}
            feet={FEET}
            unit={190}
            pts={{ ...armLog("L"), ...armLog("R"), neck: NECK, footL: [835, 1229], footR: [875, 1229] }}
            headT={headT}
            hpts={{ c: [860, 330], crown: [860, 140], chin: [860, 478], eyeL: [802, 344], eyeR: [916, 344], mouth: [858, 420] }}
          />
        )}
      </g>
    </CheckRoot>
  );
};
