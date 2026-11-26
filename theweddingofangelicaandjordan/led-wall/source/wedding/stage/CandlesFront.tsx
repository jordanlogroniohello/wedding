import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CAKE_SIZE, CakeCouple, type Breath, type CakeFlame } from "../painted/CakeCouple";
import { CAKE } from "../painted/cakeParts";
import { FrontPeople, frontFacePt, frontMouth, turnPt, TURN_LIPS, type FrontPose, type FrontWho } from "../painted/FrontCouple";

// The LED stage's key 3, facing the front (round 24; the user, on round 23's side-on version: "nice pero dapat naka
// harap nalang wag ng nakatagilid bro (side view)"): the toast picture's Dan & Ange behind the candle picture's cake
// (round 22's brief: he blows the candles out left to right, she right to left, both sliding toward the middle; the
// flames go out one by one with a little smoke; both reach the middle as the last one goes out; then they look at each
// other, smile, lean closer, a sweet kiss, pull back a little, smile at each other, and hold). They take turns, each
// glancing at their candle, leaning in to it (a breath in, a blow, the flame leans and goes out, smoke curls off the
// wick); he gets to the middle first, and they blow the last one out together, from both sides. Then their eyes go to
// each other and they smile, and he turns his head to her (from the front he can't reach her cheek: the candle
// picture's 3/4 head) and kisses her cheek; her eyes close smiling, she blushes, gold hearts float up. He pulls back a
// little, they smile at each other, he turns back to the front, and they hold, heads together, eyes on each other.
// Transparent and wide, with room above their heads for the hearts: the stage shows it across the whole screen's width
// at the bottom (scenes.json `fit: "bottom"`).
export const CANDLES_FRONT = {
  width: 1920,
  height: 860,
  fps: 30,
  durationInFrames: 480,
};
const SCALE = CANDLES_FRONT.width / CAKE_SIZE[0];
const TOP = CANDLES_FRONT.height - Math.round(CAKE_SIZE[1] * SCALE); // the picture sits on the bottom
const GOLD = "#F3D9A4";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const back = { ...clamp, easing: Easing.out(Easing.back(1.4)) };

// the blows in order: who, which candle (0-7, left to right), and the blow's first frame (the breath in is the 10 before)
const LAST = 4;
const BLOWS: { who: FrontWho; c: number; at: number }[] = [
  { who: "dan", c: 0, at: 26 },
  { who: "ange", c: 7, at: 52 },
  { who: "dan", c: 1, at: 82 },
  { who: "ange", c: 6, at: 108 },
  { who: "dan", c: 2, at: 138 },
  { who: "ange", c: 5, at: 164 },
  { who: "dan", c: 3, at: 188 },
  // (the last one together, from both sides: he's been waiting by it)
  { who: "dan", c: LAST, at: 236 },
  { who: "ange", c: LAST, at: 236 },
];
const INHALE = 10;
const OUT = 8; // the flame's gone this many frames into the blow
const BREATH = 14;
const SLIDE = 22; // to the next candle, starting 18 frames after a blow
const DIR: Record<FrontWho, number> = { dan: 1, ange: -1 }; // toward the middle
// where each one's mouth is for a candle: just beside it (his on its left, hers on its right), a little above the
// flame; for the last one, one on each side of it (his curls just clear of her face)
const MOUTH_Y = 296;
const spot = (who: FrontWho, c: number) => CAKE.candles[c].cx - DIR[who] * (c === LAST ? 155 : 58);

// the kiss: his turned head's pushed-out lips on her cheek (toast px on her face), him leaning in, her head tilted to him
const ANGE_CHEEK = [804, 414];
const T = { stop: 250, look: 251, turn: 278, leanIn: 286, touch: 306, back: 346, backEnd: 362, turnBack: 392, fadeOut: 452 };
const ANGE_KISS: FrontPose = { x: spot("ange", LAST), y: MOUTH_Y, tilt: -6, lean: -1 };
const KISS_LEAN = 6;
const KISS_TILT = 3;
const DAN_KISS: FrontPose = (() => {
  const target = frontFacePt("ange", ANGE_KISS, ANGE_CHEEK);
  const p0 = turnPt({ x: 0, y: 0, lean: KISS_LEAN, turnTilt: KISS_TILT, turn: 1 }, TURN_LIPS);
  return { x: target[0] + 2 - p0[0], y: target[1] - p0[1], lean: KISS_LEAN, turnTilt: KISS_TILT };
})();
// a blink: half, shut, shut, half
const blinkAt = (f: number, at: number) => [0.5, 1, 1, 0.5][f - at] ?? 0;

const poseAt = (who: FrontWho, f: number): FrontPose => {
  const mine = BLOWS.filter((b) => b.who === who);
  const dir = DIR[who];
  // along the table: at each candle in turn, then (him) in for the kiss and a little back
  const ts: number[] = [0];
  const xs: number[] = [spot(who, mine[0].c)];
  for (let k = 1; k < mine.length; k++) {
    const start = mine[k - 1].at + 18;
    ts.push(start, start + SLIDE);
    xs.push(spot(who, mine[k - 1].c), spot(who, mine[k].c));
  }
  const kiss = who === "dan" ? DAN_KISS : ANGE_KISS;
  // (and as he turns back to the front, back to where his curls clear her face)
  ts.push(T.leanIn, T.touch, T.back, T.backEnd, T.turnBack, T.turnBack + 14);
  xs.push(spot(who, LAST), kiss.x, kiss.x, kiss.x - (who === "dan" ? 34 : 0), kiss.x - (who === "dan" ? 34 : 0), who === "dan" ? spot(who, LAST) - 6 : kiss.x);
  const x = interpolate(f, ts, xs, ease);
  // (a little bob as they shuffle along)
  let y = MOUTH_Y;
  for (let k = 1; k < mine.length; k++) {
    const start = mine[k - 1].at + 18;
    y -= Math.sin(Math.PI * interpolate(f, [start, start + SLIDE], [0, 1], clamp)) * 5;
  }
  // a blow: drawing breath (the lips in, back a touch, lifting), then blowing (the lips out, leaning and tilting in to
  // the candle), easing back
  let pucker = 1;
  let lean = 0;
  let tilt = 0;
  for (const b of mine) {
    const u = f - b.at;
    pucker += interpolate(u, [-INHALE, 0, 3, 12, 22], [0, -0.18, 0.14, 0.14, 0], ease);
    lean += dir * interpolate(u, [-INHALE, 0, 4, 12, 22], [0, -1, 2.5, 2.5, 0], ease);
    tilt += dir * interpolate(u, [-INHALE, 0, 4, 12, 22], [0, -1.5, 5, 5, 0], ease);
    y += interpolate(u, [-INHALE, 0, 6, 16], [0, -3, 2, 0], ease);
  }
  // then they straighten up, smile, eyes on each other, heads tilting to each other, a giggle
  const up = interpolate(f, [T.stop - 4, T.stop + 10], [0, 1], ease);
  tilt += dir * 3.5 * up;
  y += Math.sin(Math.PI * interpolate(f, [258, 266], [0, 1], clamp)) * -3 + Math.sin(Math.PI * interpolate(f, [266, 274], [0, 1], clamp)) * -2;
  const blow = 1 - interpolate(f, [T.stop - 2, T.stop + 3], [0, 1], clamp);
  // (the eyes: ahead, then on their candle, on each other)
  let look: 0 | 1 | 2 = f < 18 ? 0 : f < T.look ? 1 : 2;
  const kissIn = interpolate(f, [T.leanIn, T.touch], [0, 1], ease);
  const kissOut = interpolate(f, [T.back, T.backEnd], [0, 1], ease);
  const toKiss = kissIn * (1 - kissOut * (who === "dan" ? 0.6 : 0.5));
  lean += (kiss.lean ?? 0) * toKiss;
  y += (kiss.y - MOUTH_Y) * kissIn * (1 - kissOut * (who === "dan" ? 0.6 : 0));
  let lid = Math.max(blinkAt(f, who === "dan" ? 120 : 196), blinkAt(f, who === "dan" ? 420 : 423));
  let blush = 0;
  let happy = false;
  if (who === "ange") {
    tilt += ((kiss.tilt ?? 0) + 3.5) * interpolate(f, [290, T.touch], [0, 1], ease) * (1 - interpolate(f, [T.turnBack, T.turnBack + 12], [0, 0.6], ease));
    // her eyes close smiling as his lips come, open again on him after
    const shut = interpolate(f, [300, 304, 368, 372], [0, 1, 1, 0], clamp);
    lid = Math.max(lid, shut);
    happy = f >= 304 && f < 368;
    blush = interpolate(f, [304, 320, T.fadeOut], [0, 1, 0.8], clamp);
    if (f >= 300 && f < 372) look = 2;
    return { x, y, lean, tilt, blow, pucker, look, lid, happy, blush };
  }
  // him: his head turns to her, he leans in, the lips push out, eyes close; then back a little, smiling, and he turns
  // back to the front
  const turn = interpolate(f, [T.turn, T.turn + 5, T.turnBack, T.turnBack + 5], [0, 1, 1, 0], clamp);
  const turnTilt = interpolate(f, [T.turn, T.leanIn, T.touch, T.back, T.backEnd], [-4, -4, KISS_TILT, KISS_TILT, -2], ease);
  const turnKiss = interpolate(f, [294, 299, 350, 355], [0, 1, 1, 0], clamp);
  const turnLid = Math.max(interpolate(f, [298, 304, 348, 354], [0, 1, 1, 0], ease), blinkAt(f, 374));
  if (f >= T.turnBack) tilt += 1;
  return { x, y, lean, tilt, blow, pucker, look, lid, turn, turnTilt, turnKiss, turnLid };
};

// each candle: lit, pushed over by its blow (the last one pressed down from both sides), out; the breath that blew out
// the one beside it makes it shiver a little
const flamesAt = (f: number): CakeFlame[] =>
  CAKE.candles.map((_, i) => {
    const bs = BLOWS.filter((x) => x.c === i);
    const b = bs[0];
    const u = f - b.at;
    const near = BLOWS.filter((x) => x.at < b.at && ((x.who === "dan" && x.c === i - 1) || (x.who === "ange" && x.c === i + 1))).pop();
    const shiver = near ? interpolate(f - near.at, [1, 5, 9, 16], [0, 0.18, 0.18, 0], clamp) : 0;
    const push = u < OUT ? interpolate(u, [0, 4, OUT], [0, 0.7, 1], clamp) : 0;
    const out = u >= OUT ? u - OUT : undefined;
    if (bs.length > 1) return { flat: push, bend: push > 0 ? 0 : shiver, from: near?.who, out };
    return { bend: Math.max(push, shiver), from: push > 0 ? b.who : (near?.who ?? b.who), out };
  });

const breathAt = (f: number, poses: Record<FrontWho, FrontPose>): Breath[] =>
  BLOWS.filter((b) => f >= b.at && f < b.at + BREATH).map((b) => {
    const c = CAKE.candles[b.c];
    const m = frontMouth(b.who, poses[b.who]);
    return { who: b.who, t: (f - b.at) / BREATH, to: [c.cx, c.top - 22], from: [m[0] + DIR[b.who] * 14, m[1] + 6] };
  });

// a gold heart, its point at the bottom (they rise from above the kiss, growing, swaying, fading out up top)
const Heart: React.FC<{ x: number; y: number; s: number; o: number; rot: number }> = ({ x, y, s, o, rot }) => (
  <path
    transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
    d="M 0 0.32 C -0.12 0.2 -0.52 -0.04 -0.52 -0.3 C -0.52 -0.56 -0.2 -0.66 0 -0.4 C 0.2 -0.66 0.52 -0.56 0.52 -0.3 C 0.52 -0.04 0.12 0.2 0 0.32 Z"
    fill={GOLD}
    opacity={o}
  />
);
const HEARTS = [
  { at: 308, dx: -6, rot: -10, s: 52 },
  { at: 322, dx: 40, rot: 12, s: 40 },
  { at: 336, dx: -46, rot: -16, s: 34 },
];
const HEART_LIFE = 72;
const KISS_AT = frontFacePt("ange", ANGE_KISS, ANGE_CHEEK);

export const CandlesFront: React.FC = () => {
  const f = useCurrentFrame();
  const op = Math.min(interpolate(f, [0, 14], [0, 1], clamp), 1 - interpolate(f, [T.fadeOut, T.fadeOut + 20], [0, 1], ease));
  const poses = { dan: poseAt("dan", f), ange: poseAt("ange", f) };
  return (
    <AbsoluteFill>
      <CakeCouple
        x={0}
        y={TOP}
        scale={SCALE}
        f={f}
        flames={flamesAt(f)}
        breath={breathAt(f, poses)}
        opacity={op}
        people={<FrontPeople dan={poses.dan} ange={poses.ange} />}
      >
        <svg width={CAKE_SIZE[0]} height={CAKE_SIZE[1]} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {HEARTS.map((h, i) => {
            const t = f - h.at;
            if (t < 0 || t > HEART_LIFE) return null;
            const grow = interpolate(t, [0, 24], [0.55, 1], back);
            const fade = Math.min(interpolate(t, [0, 6], [0, 1], clamp), interpolate(t, [HEART_LIFE - 18, HEART_LIFE], [1, 0], clamp));
            return (
              <Heart
                key={i}
                x={KISS_AT[0] + h.dx + Math.sin(t * 0.12 + i * 2) * 8}
                y={KISS_AT[1] - 300 - t * 2.2}
                s={h.s * grow}
                o={fade}
                rot={h.rot + Math.sin(t * 0.1 + i) * 6}
              />
            );
          })}
        </svg>
      </CakeCouple>
    </AbsoluteFill>
  );
};
