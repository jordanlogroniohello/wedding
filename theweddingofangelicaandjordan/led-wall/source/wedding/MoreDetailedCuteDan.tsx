import { useId } from "react";
import { CheckLog, checkOn, CheckRoot, FLAT_PROP, part, xrayKeys } from "./check";
import { EYES, PARTS, PIC_H, POTRACE_T, SHOULDER } from "./moreDetailedCuteDanParts";
import { Face, type FaceGeo, type FaceProps } from "./tracedFace";
import { armFrame, bent, handAt, handT, Layers, rot, skin, Sway, swayPieces, unit, type ArmBlend, type ArmRig, type HairRig, type V } from "./tracedRig";
import { WineGlass } from "./WineGlass";

// MoreDetailedCute Dan: rebuilt from the user's own Dan & Ange picture (wedding test, 2026-10-25, for review).
// Traced in parts (moreDetailedCuteDanParts.ts, src/wedding/trace/split.py; round 5, the user: "head, body, shoulder +
// arms, hands, feet"; round 6, "what if we also consider hair?"): head (the face and ears, moustache, eyes; it carries
// on under the hair), the hair (its curls sway), the back hair (behind everything), the earring (it dangles), body (with
// what the others hide traced in), each sleeve + its round upper sleeve, each hand, each shoe. The brows and mouth are drawn in code so he can talk and emote,
// and each sleeve bends (skinning), its hand moving whole with the forearm.
// Picture px (1216x1294); the origin is bottom-centre between the shoes, ~610px tall at scale 1.

const K = 0.5;
const FEET: V = [306, 1229];
const NECK: V = [315, 432]; // the head turns about the middle of the jaw; the neck carries on straight up under it
// the curls bend from the crown: still over his forehead, the side curls swinging from his brows down to his collar
const HAIR: HairRig = { crown: [315, 90], from: 230, to: 520 };
const HAIR_PC = swayPieces(PARTS.hair, PIC_H, HAIR);
// how much of the follow-through the hair takes (his short springy curls swing less than long hair)
const HAIR_SWING = 0.6;
// the back hair: the hair again, in shadow, behind him (what shows where the hair swings off reads as more hair
// behind; a flat fill read as a dark wedge)
const BackHair: React.FC = () => (
  <>
    <Layers layers={PARTS.hair} t={POTRACE_T} />
    <path transform={POTRACE_T} d={PARTS.hair[0][1]} fill="#0B0807" opacity={0.45} />
  </>
);
// the cross earring hangs from his ear lobe: it swings about the hoop's top, a little more than the curls
const EAR_HOOK: V = [456, 340];

// [upper arm, forearm] in degrees from hanging straight down, positive = away from the body; optionally [.., fore,
// wrist]: fore < 1 shortens the forearm (mid-raise it swings toward the camera), wrist = the hand's lag in degrees
export type DanArm = "rest" | "wave" | "up" | "hi" | [number, number] | [number, number, number, number];
// (round 2, "wave animation is wrong": the old wave folded the elbow ~147° into a C with the hanging hand turned over
// into a claw; round 3, "look at dan wave hahahaha": an elbow out at chest height sagged like a droopy wing. The wave is
// a raised hello: the upper arm up and out past the shoulder line, a soft elbow, the open palm above his hair)
const ARM: Record<Exclude<DanArm, [number, number] | [number, number, number, number]>, [number, number]> = {
  rest: [5, 2], // the picture: arms hanging at his sides
  wave: [120, 170], // the hello: elbow by the side of his head (a ~53° elbow), the palm up above the hair
  hi: [105, 160], // a lower hello, the hand by his ear
  up: [125, 150], // hooray
};
const armPose = (p: DanArm): [number, number, number, number] => {
  const a = Array.isArray(p) ? p : ARM[p];
  return [a[0], a[1], a[2] ?? 1, a[3] ?? 0];
};
// the forearm is raised enough to show the open palm (the traced hand hangs: turned up it shows its back, like a claw)
const PALM_FROM = 110;

// measured per side (the sleeves aren't mirror images): S = the shoulder joint and E mid-sleeve at the elbow (the cut's
// SHOULDER: the round upper sleeve's axis), out/inn = just inside the sleeve's outlines at the elbow, cuff = the middle
// of the sleeve's end (the hand, its own part, starts there; the open palm swaps in below it)
const ARM_RIG: Record<-1 | 1, ArmRig> = {
  [-1]: { S: SHOULDER[-1].S, E: SHOULDER[-1].E, out: [86, 640], inn: [155, 640], tip: [112, 862], cuff: [112, 790] },
  [1]: { S: SHOULDER[1].S, E: SHOULDER[1].E, out: [528, 640], inn: [462, 640], tip: [505, 862], cuff: [505, 791] },
};
// a short elbow blend keeps a real elbow (a long one rounded the bend into a C); no inner fill (the round upper sleeve
// gives a raised upper arm its width)
const BLEND: ArmBlend = { shoulder: [-14, 34], elbow: 34, full: 0, fullAlong: [-10, 25, 115, 160] };
const SLEEVE_LINE = "#5E544C"; // the suit's outline colour (softer than the ink)
// (round 4, "LOL STILL. :( like a wing") The picture's sleeve hangs, so its top is a narrow wedge under the shoulder
// (foreshortened) that widens to the elbow: lifted, that wedge was a pinched root with a sail under it. A lifted upper
// arm shows the round upper sleeve instead (traced in the cut, shoulderL / shoulderR: the sleeve's own colours round a
// capsule about S), under the traced sleeve, which fades out above `cut` (along the arm from S). So the arm comes out of
// the top of the shoulder down to the armpit, and the jacket's side (traced under the sleeve, in the body) shows under
// it. The round sleeve's outline is drawn here, only where it sticks out past the body
const TUBE = { cut: [80, 100] as V, line: "#3A322C", w: 3.5 };
const UPPER = { [-1]: PARTS.shoulderL, [1]: PARTS.shoulderR };
const HANDS = { [-1]: PARTS.handL, [1]: PARTS.handR };
const SKINS = {
  [-1]: PARTS.armL.map(([c, d]) => [c, skin(ARM_RIG[-1], -1, d, PIC_H, BLEND)] as const),
  [1]: PARTS.armR.map(([c, d]) => [c, skin(ARM_RIG[1], 1, d, PIC_H, BLEND)] as const),
};
const HAND = { skin: "#F2C6A2", shade: "#E6A984", line: "#1E1714" }; // the picture's hand colours

// The open palm, facing the viewer, in the hand's rest space: from the cuff along the forearm (b, the fingers' way)
// and across (a, + = the arm's outer side; turned up, the thumb lands on the side toward his head). One union with one
// outline (an ink pass under a skin pass), the fingers parted by short lines
const Palm: React.FC<{ g: ArmRig; side: -1 | 1; wrist: number; xray?: string }> = ({ g, side, wrist, xray }) => {
  const f0 = unit(g.tip[0] - g.E[0], g.tip[1] - g.E[1]);
  const v: V = [side * f0[1], -side * f0[0]];
  const C = g.cuff!;
  const P = (a: number, b: number): V => [C[0] + v[0] * a + f0[0] * b, C[1] + v[1] * a + f0[1] * b];
  const cap = (a0: number, b0: number, a1: number, b1: number) => {
    const [p, q] = [P(a0, b0), P(a1, b1)];
    return `M ${p[0]} ${p[1]} L ${q[0]} ${q[1]}`;
  };
  // fingers from the little finger (inner side) to the index (by the thumb): base, tip, width
  // (chunky, like the picture's chibi hands: ~60px wide)
  // (round 3: longer, spread fingers, so it reads as an open hand and not a fist)
  const fingers: [number, number, number, number, number][] = [
    [-18, 40, -27, 61, 12.5],
    [-7, 44, -11, 71, 13.5],
    [5, 44, 5, 74, 13.5],
    [16, 41, 23, 68, 12.5],
  ];
  const thumb: [number, number, number, number, number] = [20, 16, 40, 28, 13.5];
  const palmC = P(0, 26);
  const ang = (Math.atan2(f0[1], f0[0]) * 180) / Math.PI;
  const shapes = (pad: number, fill: string, stroke?: string) => (
    <g fill={fill} stroke={stroke} strokeWidth={stroke ? pad : undefined} strokeLinejoin="round">
      <path d={cap(0, -8, 0, 12)} stroke={stroke ?? fill} strokeWidth={46 + (stroke ? pad : 0)} strokeLinecap="round" fill="none" />
      <ellipse cx={palmC[0]} cy={palmC[1]} rx={27} ry={25} transform={`rotate(${ang} ${palmC[0]} ${palmC[1]})`} />
      {[...fingers, thumb].map(([a0, b0, a1, b1, w], n) => (
        <path key={n} d={cap(a0, b0, a1, b1)} stroke={stroke ?? fill} strokeWidth={w + (stroke ? pad : 0)} strokeLinecap="round" fill="none" />
      ))}
    </g>
  );
  const W = C;
  return (
    <g transform={`rotate(${wrist * -side} ${W[0]} ${W[1]})`}>
      {xray ? (
        shapes(0, xray)
      ) : (
        <>
          {shapes(5, HAND.line, HAND.line)}
          {shapes(0, HAND.skin)}
          {/* a soft shade on the inner side of the palm, the fingers parted, a palm crease */}
          <path d={`M ${P(-25, 14).join(" ")} Q ${P(-29, 32).join(" ")} ${P(-19, 46).join(" ")}`} fill="none" stroke={HAND.shade} strokeWidth={6} strokeLinecap="round" />
          {[-12.5, -1, 10.5].map((a, n) => (
            <path key={n} d={cap(a, 45, a + (n - 1) * 1.5, 52)} fill="none" stroke={HAND.line} strokeWidth={2.2} strokeLinecap="round" />
          ))}
          <path d={`M ${P(10, 24).join(" ")} Q ${P(2, 34).join(" ")} ${P(4, 42).join(" ")}`} fill="none" stroke={HAND.shade} strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
    </g>
  );
};

// A fist round a wine glass's stem (the LED stage's toast), upright on screen like the glass (`turn` undoes the arm's
// rotation). (round 11, the user: "Dans hand look like this? circle ball likehands?": it was one rounded square) Four
// fingers wrapped round the stem toward the outer side, stacked, the thumb over the top, the back of the hand toward his
// body on the forearm's line, the wrist coming into it from the cuff (from above at rest, from below raised). One union
// with one outline (an ink pass under a skin pass, like the open palm), the fingers parted by short lines. Its frame: the
// back of the hand at 0 0, the fingertips to -x (mirrored to the outer side), the stem GRIP_STEM px along them
const GRIP_ALONG = 30; // the back of the hand, from the cuff along the forearm
const GRIP_STEM = 12;
const FIST = {
  back: [15, 21] as V, // an ellipse's radii
  fingers: [
    [-28, -14, 0, -14, 12],
    [-30, -2, 0, -2, 12.5],
    [-29, 10, 0, 10, 12],
    [-25, 20.5, -2, 20.5, 10],
  ] as [number, number, number, number, number][],
  creases: ["M -34 -8 Q -22 -7 -11 -8", "M -35 4 Q -22 5 -11 4", "M -32 15.5 Q -21 16.5 -12 15.5"],
  shade: "M -29 25 Q -14 28 0 22",
  thumb: [7, -19, -19, -24, 11.5] as [number, number, number, number, number],
  nail: "M -21 -27 Q -16 -27 -15 -22",
  wrist: 30,
};
const gripAt = (g: ArmRig): V => {
  const f0 = unit(g.tip[0] - g.E[0], g.tip[1] - g.E[1]);
  return [g.cuff![0] + f0[0] * GRIP_ALONG, g.cuff![1] + f0[1] * GRIP_ALONG];
};
// the stem's middle from the back of the hand, on screen (the back of the hand toward his body: the fingers outward)
const stemFrom = (side: -1 | 1): V => [side * GRIP_STEM, 1];
const Wrist: React.FC<{ g: ArmRig; xray?: string }> = ({ g, xray }) => {
  const [a, b] = [g.cuff!, gripAt(g)];
  return <path d={`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`} stroke={xray ?? HAND.skin} strokeWidth={FIST.wrist} strokeLinecap="round" />;
};
const Grip: React.FC<{ g: ArmRig; side: -1 | 1; turn: number; time?: number; id: string; xray?: string }> = ({ g, side, turn, time, id, xray }) => {
  const c = gripAt(g);
  const sg = -side; // the fist's frame mirrored so its fingertips point outward
  // the cuff in the fist's frame: the wrist runs from just past it into the back of the hand
  const t = (turn * Math.PI) / 180;
  const d: V = [g.cuff![0] - c[0], g.cuff![1] - c[1]];
  const cl: V = [d[0] * Math.cos(t) - d[1] * Math.sin(t), d[0] * Math.sin(t) + d[1] * Math.cos(t)];
  const L = Math.hypot(cl[0], cl[1]) || 1;
  const w0: V = [sg * (cl[0] - (cl[0] / L) * 4), cl[1] - (cl[1] / L) * 4];
  const line = (x0: number, y0: number, x1: number, y1: number, w: number, col: string, cap: "round" | "butt" = "round") => (
    <path d={`M ${x0} ${y0} L ${x1} ${y1}`} stroke={col} strokeWidth={w} strokeLinecap={cap} fill="none" />
  );
  const shapes = (pad: number, col: string) => (
    <>
      {line(w0[0], w0[1], 0, 0, FIST.wrist + pad, col, "butt")}
      <ellipse cx={0} cy={0} rx={FIST.back[0] + pad / 2} ry={FIST.back[1] + pad / 2} fill={col} />
      {FIST.fingers.map(([x0, y0, x1, y1, w], n) => (
        <g key={n}>{line(x0, y0, x1, y1, w + pad, col)}</g>
      ))}
    </>
  );
  const [tx0, ty0, tx1, ty1, tw] = FIST.thumb;
  return (
    <g transform={`translate(${c[0]} ${c[1]}) rotate(${-turn})`}>
      <WineGlass at={stemFrom(side)} time={time} id={id} xray={xray ? FLAT_PROP : undefined} />
      <g transform={`scale(${sg} 1)`}>
        {xray ? (
          <g>
            {shapes(0, xray)}
            {line(tx0, ty0, tx1, ty1, tw, xray)}
          </g>
        ) : (
          <>
            {shapes(5, HAND.line)}
            {shapes(0, HAND.skin)}
            <path d={FIST.shade} fill="none" stroke={HAND.shade} strokeWidth={5} strokeLinecap="round" />
            {FIST.creases.map((c_, n) => (
              <path key={n} d={c_} fill="none" stroke={HAND.line} strokeWidth={2.4} strokeLinecap="round" />
            ))}
            {line(tx0, ty0, tx1, ty1, tw + 5, HAND.line)}
            {line(tx0, ty0, tx1, ty1, tw, HAND.skin)}
            <path d={FIST.nail} fill="none" stroke={HAND.line} strokeWidth={2} strokeLinecap="round" />
          </>
        )}
      </g>
    </g>
  );
};

// the bent sleeve: its colour layers, plus an outline on its inner side once it's lifted. The picture's sleeve has no
// outline there (the seam belongs to the body); where a lifted arm sticks out past the body it gets one, and over the
// body it stays soft so the shoulder melts in. A folded-up forearm turns its seam side outward too, so the line comes
// in as soon as the arm leaves the body. The hand moves whole with the forearm, under the cuff; a raised forearm swaps it
// for the open palm
const ArmArt: React.FC<{ side: -1 | 1; pose: DanArm; id: string; glass?: boolean; time?: number; xray?: { arm: string; paw: string } }> = ({ side, pose, id, glass, time, xray }) => {
  const [ua, fa, fore, wrist] = armPose(pose);
  const g = ARM_RIG[side];
  const sh = SHOULDER[side];
  const layers = SKINS[side].map(([c, sk]) => [c, bent(sk, g, side, ua, fa, ARM.rest, fore)] as const);
  const raised = Math.max(0, Math.min(1, (ua - 8) / 12));
  // (round 11) a forearm folded up with the elbow still down (the toast) turns its seam side out too: its outline comes in
  // with the fold, hidden only round the shoulder (the hanging upper arm's seam is the picture's own line)
  const folded = Math.max(0, Math.min(1, (foldOf(pose) - 60) / 40)) * (1 - raised);
  const palm = fa >= PALM_FROM;
  const T = handT(g, side, ua, fa, ARM.rest, fore);
  const fr = armFrame(g, side, ua, fa, ARM.rest);
  // (the knot sits a little up the upper arm from the elbow's edge, where the two edges meet)
  const ce = fa - ARM.rest[1] - (ua - ARM.rest[0]) >= 0 ? g.out : g.inn;
  const cu = unit(g.S[0] - g.E[0], g.S[1] - g.E[1]);
  const crease = rot([ce[0] + cu[0] * 26, ce[1] + cu[1] * 26], g.S, fr.tu);
  // the upper arm's turn (it's rigid past the shoulder blend), the round upper sleeve along it, and how far the traced
  // sleeve's top is faded out (in the X-ray all or nothing: the checkers read flat keys)
  const up = `rotate(${(fr.tu * 180) / Math.PI} ${g.S[0]} ${g.S[1]})`;
  const u = unit(g.E[0] - g.S[0], g.E[1] - g.S[1]);
  const at = (l: number) => [g.S[0] + u[0] * l, g.S[1] + u[1] * l];
  const hide = xray ? (raised > 0.5 ? 1 : 0) : raised;
  const [c0, c1] = xray ? [TUBE.cut[0], TUBE.cut[0] + 1] : TUBE.cut;
  const grey = Math.round(255 * (1 - hide));
  return (
    <g>
      <defs>
        <mask id={`${id}melt`} maskUnits="userSpaceOnUse" x={-1500} y={-1500} width={4500} height={5500}>
          <rect x={-1500} y={-1500} width={4500} height={5500} fill="#fff" />
          <path transform={POTRACE_T} d={PARTS.body[0][1]} fill="#000" />
        </mask>
        <linearGradient id={`${id}fade`} gradientUnits="userSpaceOnUse" x1={at(c0)[0]} y1={at(c0)[1]} x2={at(c1)[0]} y2={at(c1)[1]}>
          <stop offset={0} stopColor={`rgb(${grey},${grey},${grey})`} />
          <stop offset={1} stopColor="#fff" />
        </linearGradient>
        <mask id={`${id}top`} maskUnits="userSpaceOnUse" x={-1500} y={-1500} width={4500} height={5500}>
          <rect x={-1500} y={-1500} width={4500} height={5500} fill={`url(#${id}fade)`} transform={up} />
        </mask>
        <clipPath id={`${id}arm`}>
          <path d={layers[0][1]} />
        </clipPath>
        <mask id={`${id}sh`} maskUnits="userSpaceOnUse" x={-1500} y={-1500} width={4500} height={5500}>
          <rect x={-1500} y={-1500} width={4500} height={5500} fill="#fff" />
          <circle cx={g.S[0]} cy={g.S[1]} r={Math.hypot(g.E[0] - g.S[0], g.E[1] - g.S[1]) * 0.6} fill="#000" />
          {/* and in the crease inside the bend (the elbow's edge on that side), where the sleeve folds over itself:
              stroked, the two edges met in a dark knot */}
          <circle cx={crease[0]} cy={crease[1]} r={30} fill="#000" />
        </mask>
      </defs>
      {hide > 0 &&
        (xray ? (
          <g transform={up}>
            <path transform={POTRACE_T} d={UPPER[side][0][1]} fill={xray.arm} />
          </g>
        ) : (
          <g opacity={hide}>
            <g mask={`url(#${id}melt)`}>
              <g transform={up}>
                <path d={`M ${at(0).join(" ")} L ${at(sh.len).join(" ")}`} stroke={TUBE.line} strokeWidth={sh.r * 2 + TUBE.w * 2} strokeLinecap="round" fill="none" />
              </g>
            </g>
            <g transform={up}>
              <Layers layers={UPPER[side]} t={POTRACE_T} />
            </g>
          </g>
        ))}
      <g transform={T}>
        {glass ? (
          <Wrist g={g} xray={xray?.paw} />
        ) : palm ? (
          <Palm g={g} side={side} wrist={wrist} xray={xray?.paw} />
        ) : xray ? (
          <path transform={POTRACE_T} d={HANDS[side][0][1]} fill={xray.paw} />
        ) : (
          <Layers layers={HANDS[side]} t={POTRACE_T} />
        )}
      </g>
      <g mask={hide > 0 ? `url(#${id}top)` : undefined}>
        {xray ? (
          <path d={layers[0][1]} fill={xray.arm} />
        ) : (
          <>
            {layers.map(([c, d], i) => (
              <path key={i} d={d} fill={c} />
            ))}
            {raised > 0 && <path d={layers[0][1]} fill="none" stroke={SLEEVE_LINE} strokeWidth={6} clipPath={`url(#${id}arm)`} mask={`url(#${id}melt)`} opacity={raised} />}
            {folded > 0 && <path d={layers[0][1]} fill="none" stroke={SLEEVE_LINE} strokeWidth={6} clipPath={`url(#${id}arm)`} mask={`url(#${id}sh)`} opacity={folded} />}
          </>
        )}
      </g>
      {glass && (
        <g transform={T}>
          <Grip g={g} side={side} turn={((fr.tu + fr.tr) * 180) / Math.PI} time={time} id={`${id}glass`} xray={xray?.paw} />
        </g>
      )}
    </g>
  );
};

// a raised forearm and hand pass in front of his hair (the rest of the arm stays behind it, under the hair at the
// shoulder, as in the picture): the arm drawn again over the head, clipped to a band along the forearm past the elbow
const ForearmFront: React.FC<{ side: -1 | 1; pose: DanArm; id: string; glass?: boolean; time?: number; xray?: { arm: string; paw: string } }> = ({ side, pose, id, glass, time, xray }) => {
  const [ua, fa, fore] = armPose(pose);
  if (ua < 20 || fa < 60) return null;
  const g = ARM_RIG[side];
  const E = rot(g.E, g.S, ((ua - ARM.rest[0]) * -side * Math.PI) / 180);
  const a = ((fa - ARM.rest[1]) * -side * Math.PI) / 180;
  const f0 = unit(g.tip[0] - g.E[0], g.tip[1] - g.E[1]);
  const f: V = [f0[0] * Math.cos(a) - f0[1] * Math.sin(a), f0[0] * Math.sin(a) + f0[1] * Math.cos(a)];
  const n: V = [-f[1], f[0]];
  const at = (along: number, across: number): V => [E[0] + f[0] * along + n[0] * across, E[1] + f[1] * along + n[1] * across];
  const band = [at(40 * fore, -75), at(400, -75), at(400, 75), at(40 * fore, 75)];
  const clip = `${id}front${side}`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={`M ${band.map((p) => p.join(" ")).join(" L ")} Z`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`} opacity={xray ? 1 : Math.min(1, (ua - 20) / 10)} data-rcp={xray ? (side === -1 ? "armL" : "armR") : undefined}>
        <ArmArt side={side} pose={pose} id={`${clip}art`} glass={glass} time={time} xray={xray} />
      </g>
    </g>
  );
};

// (in the X-ray each arm is its own part, armL / armR, as the v3 rig's: the motion sheet reads its box)
const Arm: React.FC<{ side: -1 | 1; pose: DanArm; id: string; glass?: boolean; time?: number; xray?: { arm: string; paw: string } }> = ({ side, pose, id, glass, time, xray }) =>
  xray ? (
    <g data-rcp={side === -1 ? "armL" : "armR"}>
      <ArmArt side={side} pose={pose} id={`${id}arm${side}`} glass={glass} xray={xray} />
    </g>
  ) : (
    <ArmArt side={side} pose={pose} id={`${id}arm${side}`} glass={glass} time={time} />
  );

// the arm's points for the motion check's log (picture space): shoulder, elbow, wrist (the cuff) and the hand's tip
export const danArmPts = (side: -1 | 1, pose: DanArm) => {
  const [ua, fa, fore] = armPose(pose);
  const g = ARM_RIG[side];
  const f0 = unit(g.tip[0] - g.E[0], g.tip[1] - g.E[1]);
  const tip: V = fa >= PALM_FROM ? [g.cuff![0] + f0[0] * 72, g.cuff![1] + f0[1] * 72] : g.tip;
  return {
    sh: g.S,
    elbow: rot(g.E, g.S, ((ua - ARM.rest[0]) * -side * Math.PI) / 180),
    wrist: handAt(g, side, ua, fa, ARM.rest, g.cuff!, fore),
    paw: handAt(g, side, ua, fa, ARM.rest, tip, fore),
  };
};

// where a glass held in that hand sits (picture space), for effects at the glass (the toast's sparkles)
export const danGlassAt = (side: -1 | 1, pose: DanArm): V => {
  const [ua, fa, fore] = armPose(pose);
  const g = ARM_RIG[side];
  const [x, y] = handAt(g, side, ua, fa, ARM.rest, gripAt(g), fore);
  const o = stemFrom(side);
  return [x + o[0], y + o[1]];
};

// A wave (frames from `at`, holding `hold` frames up): the forearm leads, folding up while the upper arm rises out and up
// to the hello (shortened mid-way: it passes toward the camera, so the hand travels a tight arc), overshoots a little and
// settles; it rocks about the elbow, the hand lagging the forearm; then back down the same way. Eased everywhere (no
// even spacing)
export const danWave = (f: number, at: number, hold: number): DanArm => {
  const R = 14;
  const L = 16;
  const [UA, FA] = ARM.wave;
  const e = (x: number) => {
    const t = Math.max(0, Math.min(1, x));
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  };
  const up = (t: number) => (t < at + R + hold ? e((t - at) / R) : 1 - e((t - at - R - hold) / L));
  const fa = (t: number) => {
    const u = t - at;
    const k = up(t) ** 0.6; // the forearm leads the elbow
    const settle = u > R - 3 && u < R + 6 ? Math.sin(((u - R + 3) / 9) * Math.PI) * 5 : 0; // overshoot, then settle
    const rockT = u - R - 4;
    const amp = rockT > 0 && u < R + hold ? 14 * Math.min(1, rockT / 4, (R + hold - u) / 5) : 0;
    const rock = amp * Math.sin((rockT / 11) * 2 * Math.PI);
    return 2 + (FA - 2) * k + (t < at + R + hold ? settle + rock : 0);
  };
  const ua = 5 + (UA - 5) * up(f);
  const F = fa(f);
  // mid-swing the forearm points at the camera: shortest when it's crossing sideways
  const fore = 1 - 0.5 * Math.sin(Math.max(0, Math.min(1, F / 180)) * Math.PI) ** 2;
  // the hand lags the forearm's turn (follow-through), more on the quick swings
  const wrist = Math.max(-18, Math.min(18, -(F - fa(f - 2)) * 0.7));
  return [ua, F, fore, wrist];
};

const INK = "#130E0D";
const FACE: FaceGeo = {
  art: EYES, // the open eyes are the picture's own (traced); the other states are drawn
  eyes: {
    [-1]: { o: [216, 277], i: [282, 279], top: 257, bot: 288, wing: [208, 276], iris: [254, 274], r: 18.5, shine: [[[246, 268.5], 3.8], [[261, 268], 2.6]], crease: 6, lashes: 0 },
    [1]: { o: [415, 277], i: [349, 279], top: 257, bot: 288, wing: [423, 276], iris: [376.5, 274], r: 18.5, shine: [[[368, 268.5], 3.8], [[383, 268], 2.6]], crease: 6, lashes: 0 },
  },
  brows: {
    [-1]: { a: [205, 246], m: [244, 223], b: [290, 236] },
    [1]: { a: [427, 246], m: [388, 223], b: [340, 236] },
  },
  browW: 13,
  mouth: { l: [262, 352], r: [365, 351], up: 343, open: 378, teeth: 374, lip: 393 },
  cheeks: [
    [228, 318],
    [402, 318],
  ],
  blush: 0,
  // the moustache (redrawn: the trace came out patchy): each half from its drooping tip to the middle, and the soul patch
  stache: {
    halves: [
      [[255, 361], [255, 342], [307, 340]],
      [[374, 360], [374, 341], [323, 340]],
    ],
    w: 7.5,
    col: "#4A403A",
    patch: [315, 398],
  },
  s: 0.42,
  lw: 2.4,
  liner: 5.2,
  col: { ink: INK, brow: "#1C1614", iris: "#3A2218", irisLo: "#6B4430", white: "#FBFAF7", lid: "#B07A62", lip: "#DD8770", lipHi: "#F0AE9C", mouth: "#5A2420", tongue: "#D9746A", teeth: "#FBFAF7", blush: "#F08E7A" },
};

export type MoreDetailedCuteDanProps = FaceProps & {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  tilt?: number;
  armL?: DanArm; // the screen-left sleeve
  armR?: DanArm;
  glass?: -1 | 1; // a wine glass in that hand (the LED stage's toast)
  hair?: number; // the curls' swing past the head, degrees (+ = the tips go screen-left): their follow-through, springLag
  squash?: number;
  time?: number;
};

// the elbow's fold (degrees, 0 = straight), for the hand check's X-ray key
const foldOf = (p: DanArm) => {
  const [ua, fa] = armPose(p);
  return Math.abs(fa - ARM.rest[1] - (ua - ARM.rest[0]));
};
const armLog = (s: "L" | "R", p: DanArm) => {
  const a = danArmPts(s === "L" ? -1 : 1, p);
  return { [`sh${s}`]: a.sh, [`elbow${s}`]: a.elbow, [`wrist${s}`]: a.wrist, [`paw${s}`]: a.paw };
};

export const MoreDetailedCuteDan: React.FC<MoreDetailedCuteDanProps> = ({ x, y, scale = 1, flip = false, tilt = 0, armL = "rest", armR = "rest", glass, hair = 0, squash = 0, time, ...face }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const live = time !== undefined;
  const breath = live ? Math.sin((time ?? 0) / 22) * 0.006 : 0;
  const sx = 1 + squash * 0.5 - breath * 0.5;
  const sy = 1 - squash + breath;
  // (and a slow idle sway)
  const swing = hair * HAIR_SWING + (live ? Math.sin((time ?? 0) / 34) * 0.6 : 0);
  // the checkers' X-ray (off in every normal render): Dan is "dan" in the cast (src/characters/cast.json)
  const ck = checkOn();
  const kL = ck.hand ? xrayKeys("dan", foldOf(armL)) : undefined;
  const kR = ck.hand ? xrayKeys("dan", foldOf(armR)) : undefined;
  const headT = `rotate(${tilt} ${NECK[0]} ${NECK[1]})`;
  return (
    <CheckRoot who="dan" uid={id} on={ck.rule}>
      <g transform={`translate(${x} ${y}) scale(${scale * K * (flip ? -1 : 1)} ${scale * K}) scale(${sx} ${sy}) translate(${-FEET[0]} ${-FEET[1]})`}>
        {/* the back hair, behind him: what the swinging curls uncover beside his face and neck */}
        <g transform={headT}>{part(ck.rule, "head", <BackHair />)}</g>
        {part(
          ck.rule,
          "body",
          <>
            <Layers layers={PARTS.body} t={POTRACE_T} />
            {/* the shoes over the ankles */}
            <Layers layers={PARTS.footL} t={POTRACE_T} />
            <Layers layers={PARTS.footR} t={POTRACE_T} />
          </>,
        )}
        <Arm side={-1} pose={armL} id={id} glass={glass === -1} time={time} xray={kL} />
        <Arm side={1} pose={armR} id={id} glass={glass === 1} time={time} xray={kR} />
        <g transform={headT}>
          {part(ck.rule, "head", <Layers layers={PARTS.head} t={POTRACE_T} />)}
          <Face g={FACE} id={id} {...face} mark={ck.rule ? (k, n) => part(true, k, n) : undefined} />
          {part(
            ck.rule,
            "head",
            <>
              <Sway pieces={HAIR_PC} rig={HAIR} deg={swing} t={POTRACE_T} />
              <g transform={`rotate(${swing * 1.4} ${EAR_HOOK[0]} ${EAR_HOOK[1]})`}>
                <Layers layers={PARTS.earring} t={POTRACE_T} />
              </g>
            </>,
          )}
        </g>
        <ForearmFront side={-1} pose={armL} id={id} glass={glass === -1} time={time} xray={kL} />
        <ForearmFront side={1} pose={armR} id={id} glass={glass === 1} time={time} xray={kR} />
        {ck.rule && (
          <CheckLog
            who="dan"
            uid={id}
            info={{ pose: "stand", view: "front", flip, scale, eyes: face.eyes ?? "open", mouth: face.mouth ?? "grin", open: face.mouthOpen ?? 0, tilt, hair: swing }}
            feet={FEET}
            unit={350}
            pts={{ ...armLog("L", armL), ...armLog("R", armR), neck: NECK, footL: [236, 1229], footR: [376, 1229] }}
            headT={headT}
            hpts={{ c: [315, 262], crown: [315, 96], chin: [315, 432], eyeL: [250, 274], eyeR: [382, 274], mouth: [313, 360] }}
          />
        )}
      </g>
    </CheckRoot>
  );
};
