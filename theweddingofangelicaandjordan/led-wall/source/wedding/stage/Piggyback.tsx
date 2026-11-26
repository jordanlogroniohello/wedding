import { AbsoluteFill, useCurrentFrame } from "remotion";
import { PIGGY_GROUND, PIGGY_SPEED, PIGGY_STRIDE, PiggyRun, piggyBob } from "../painted/PiggyRun";

// The LED stage's key 2: the piggyback run (round 20; the user: "they running from left to right … no need to be super
// big … 30% of the screen bottom … seamlessly entering and exit"). Dan runs across the bottom of the screen with Ange on
// his back, in from past the screen's left edge, out past its right, at his feet's own speed (a planted foot stays put),
// a soft shadow under them and a puff of dust where each foot lands; the monogram stays up under them.
// Round 21 ("the entrance is not from left screen … it seems they have container"): a 4:3 video sits in the stage's 4:3
// box, so on a wider screen they came in from the box's edge. The stage now draws the run itself, full screen
// (Runner.tsx): one stride rendered in place (`PiggybackLoop`, packed into scenes/Piggyback.webp by build.mjs), moved
// across the whole screen at the feet's speed, the dust drawn there too. `Piggyback` (the run across a 4:3 frame) stays for
// the Studio and as the stage's fallback without the strip.

// (their widest reach, picture px: her hair and dress on the left, his fist on the right; the picture is 1391 px tall,
// bouquet to soles)
const LEFT = 10;
const RIGHT = 1120;
const FIGURE_H = 1391;
// where each heel lands (picture px from the picture's left: the near leg, the far one), every half stride, near first
const HEEL_X = [805, 787];
// a puff of dust (picture px), t = 0..1 over DUST frames after a heel lands: kicked back and up from the heel, fading
const DUST = 14;
const dustAt = (t: number) =>
  [[-1, -0.3, 1], [-0.6, -0.9, 0.8], [-1.4, -0.1, 0.7]].map(([dx, dy, r]) => ({
    dx: dx * (16 + 88 * t),
    dy: dy * (8 + 56 * t),
    r: r * (12 + 32 * t),
    o: 0.32 * (1 - t) ** 1.5,
  }));
const DUST_COLOR = "#d8c7a0";

// the shadow under them (picture px, the picture's top-left at 0,0), shrinking as they rise
const Shadow: React.FC<{ f: number; x: number; y: number; s: number }> = ({ f, x, y, s }) => {
  const lift = -piggyBob(f / PIGGY_STRIDE);
  return (
    <>
      <defs>
        <radialGradient id="shadow">
          <stop offset="0" stopColor="#000" stopOpacity={0.4} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x + 600 * s} cy={y + (PIGGY_GROUND + 8) * s} rx={(260 - lift * 2.5) * s} ry={26 * s} fill="url(#shadow)" />
    </>
  );
};

// --- the stride in place, for the stage's strip (one stride loops exactly: every move in PiggyRun repeats each stride) ---
const RS = 0.42; // the strip's scale: crisp on the screen at a third of its height up to ~1700 px tall
const OX = 10;
const OY = 24; // (room above the bouquet as the body rises)
export const PIGGY_LOOP = {
  width: Math.round((OX + RIGHT + 10) * RS),
  height: Math.round((OY + PIGGY_GROUND + 40) * RS),
  fps: 30,
  durationInFrames: PIGGY_STRIDE,
};
// what the stage needs to run the strip across the screen (strip px; the strip = the frames stacked top to bottom)
export type RunnerSpec = {
  frames: number;
  fps: number;
  figureH: number;
  groundY: number;
  left: number;
  right: number;
  speed: number;
  heels: number[];
  scale: number;
  // a puff of dust where a heel lands (picture px, t = 0..1 over `frames`)
  dust: { frames: number; color: string; at: (t: number) => { dx: number; dy: number; r: number; o: number }[] };
};
export const PIGGY_RUNNER: RunnerSpec = {
  frames: PIGGY_STRIDE,
  fps: 30,
  figureH: FIGURE_H * RS,
  groundY: (OY + PIGGY_GROUND) * RS,
  left: (OX + LEFT) * RS,
  right: (OX + RIGHT) * RS,
  speed: PIGGY_SPEED * RS,
  heels: HEEL_X.map((h) => (OX + h) * RS),
  scale: RS,
  dust: { frames: DUST, color: DUST_COLOR, at: dustAt },
};
export const PiggybackLoop: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <svg width={PIGGY_LOOP.width} height={PIGGY_LOOP.height} style={{ position: "absolute" }}>
        <Shadow f={f} x={OX * RS} y={OY * RS} s={RS} />
      </svg>
      <PiggyRun x={OX * RS} y={OY * RS} scale={RS} frame={f} />
    </AbsoluteFill>
  );
};

// --- the run across a 4:3 frame (the Studio; the stage's fallback) ---
const S = 0.25; // the picture about a third of the frame's height
const GROUND_Y = 1036;
const Y = GROUND_Y - PIGGY_GROUND * S;
const V = PIGGY_SPEED * S;
const X0 = -RIGHT * S;
const X1 = 1440 - LEFT * S + 4;
export const PIGGYBACK = { width: 1440, height: 1080, fps: 30, durationInFrames: Math.ceil((X1 - X0) / V) + 1 };

export const Piggyback: React.FC = () => {
  const f = useCurrentFrame();
  const x = X0 + V * f;
  const puffs = [];
  for (let k = 0; k * (PIGGY_STRIDE / 2) <= f; k++) {
    const t = (f - k * (PIGGY_STRIDE / 2)) / DUST;
    if (t > 1) continue;
    const at = X0 + V * k * (PIGGY_STRIDE / 2) + HEEL_X[k % 2] * S;
    for (const [i, d] of dustAt(t).entries())
      puffs.push(<circle key={`${k}-${i}`} cx={at + d.dx * S} cy={GROUND_Y + d.dy * S} r={d.r * S} fill={DUST_COLOR} opacity={d.o} />);
  }
  return (
    <AbsoluteFill>
      <svg width={1440} height={1080} style={{ position: "absolute" }}>
        <Shadow f={f} x={x} y={Y} s={S} />
        {puffs}
      </svg>
      <PiggyRun x={x} y={Y} scale={S} frame={f} />
    </AbsoluteFill>
  );
};
