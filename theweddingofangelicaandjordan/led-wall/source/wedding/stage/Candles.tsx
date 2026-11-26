import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CAKE_SIZE, CakeCouple, PUCKER, carried, lipTip, type Breath, type CakeFlame, type CakePose, type Who } from "../painted/CakeCouple";
import { CAKE } from "../painted/cakeParts";

// The LED stage's key 3 (round 23): candles and a kiss, from the user's candle picture (round 22's brief: "Groom (Left →
// Right) … blowing out candles one by one while gradually moving toward the center. Bride (Right → Left) … Flames go out
// sequentially … subtle smoke … Both reach the center as the final candle goes out. Kiss: They stop blowing, face each
// other, smile, lean closer, and share a sweet kiss. Ending: They pull back slightly, smile at each other, and hold";
// then: "move the character behind the cake then animate the blow step by step"). They take turns: Dan blows the left
// candles out one by one, Ange the right ones, each sliding along behind the cake to the next (a breath in, a blow, the
// flame leans and goes out, smoke curls off the wick); he gets to the middle first and waits for her, and they blow the
// last two out together. Then they look at each other and smile, lean in, close their eyes and kiss (gold hearts float
// up from behind their heads), pull back a little, smile, and hold. Transparent and wide (the picture's own 3:1, with room
// above their heads for the hearts): the stage shows it across the whole screen's width at the bottom (scenes.json
// `fit: "bottom"`).
export const CANDLES = {
  width: 1920,
  height: 800,
  fps: 30,
  durationInFrames: 450,
};
const SCALE = CANDLES.width / CAKE_SIZE[0];
const TOP = CANDLES.height - Math.round(CAKE_SIZE[1] * SCALE); // the picture sits on the bottom
const GOLD = "#F3D9A4";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const back = { ...clamp, easing: Easing.out(Easing.back(1.4)) };

// the blows in order: who, which candle (0-7, left to right), and the blow's first frame (the breath in is the 10 before)
const BLOWS: { who: Who; c: number; at: number }[] = [
  { who: "dan", c: 0, at: 26 },
  { who: "ange", c: 7, at: 52 },
  { who: "dan", c: 1, at: 82 },
  { who: "ange", c: 6, at: 108 },
  { who: "dan", c: 2, at: 138 },
  { who: "ange", c: 5, at: 164 },
  // (the last two together: he's been waiting at the middle)
  { who: "dan", c: 3, at: 212 },
  { who: "ange", c: 4, at: 212 },
];
const INHALE = 10;
const OUT = 8; // the flame's gone this many frames into the blow
const BREATH = 14;
const SLIDE = 22; // to the next candle, starting 18 frames after a blow
// where each one stands for a candle: slid by the candles' gap from where they are in the picture (his lips by the
// first, hers by the last)
const shiftFor = (who: Who, c: number) => CAKE.candles[c].cx - CAKE.candles[who === "dan" ? 0 : 7].cx;

// the kiss: leaning in (degrees toward each other), his pushed-out lips' tip on hers, just past the picture's middle,
// their mouths' middles level
const MEET = 1003;
const KISS_LEAN = { dan: 3, ange: 2 };
const kissPose = (who: Who): CakePose => {
  const lean = KISS_LEAN[who];
  const tip = carried(who, { lean }, lipTip(who, who === "dan"));
  const mid = { dan: carried("dan", { lean: KISS_LEAN.dan }, PUCKER.dan), ange: carried("ange", { lean: KISS_LEAN.ange }, PUCKER.ange) };
  return { lean, x: (who === "dan" ? MEET + 1 : MEET - 1) - tip[0], y: who === "ange" ? mid.dan[1] - mid.ange[1] : 0 };
};
const KISS = { dan: kissPose("dan"), ange: kissPose("ange") };
const T = { stop: 232, look: 236, leanIn: 262, touch: 288, back: 338, backEnd: 352, fadeOut: 425 };
// a blink: half, shut, shut, half
const blinkAt = (f: number, at: number) => [0.5, 1, 1, 0.5][f - at] ?? 0;

const poseAt = (who: Who, f: number): CakePose => {
  const mine = BLOWS.filter((b) => b.who === who);
  // along the table: at each candle in turn, then in for the kiss and a little back
  const xs: number[] = [];
  const ts: number[] = [];
  mine.forEach((b, k) => {
    if (k === 0) {
      ts.push(0);
      xs.push(shiftFor(who, b.c));
      return;
    }
    const start = mine[k - 1].at + 18;
    ts.push(start, start + SLIDE);
    xs.push(shiftFor(who, mine[k - 1].c), shiftFor(who, b.c));
  });
  const kiss = KISS[who];
  const away = who === "dan" ? -40 : 40;
  ts.push(T.leanIn, T.touch, T.back, T.backEnd);
  xs.push(shiftFor(who, mine[mine.length - 1].c), kiss.x ?? 0, kiss.x ?? 0, (kiss.x ?? 0) + away);
  const x = interpolate(f, ts, xs, ease);
  // (a little bob as they shuffle along)
  let y = 0;
  for (let k = 1; k < mine.length; k++) {
    const start = mine[k - 1].at + 18;
    y -= Math.sin(Math.PI * interpolate(f, [start, start + SLIDE], [0, 1], clamp)) * 5;
  }
  // a blow: drawing breath (the lips in, leaning back a touch, lifting), then blowing (the lips out, leaning in), easing back
  let pucker = 1;
  let lean = 0;
  for (const b of mine) {
    const u = f - b.at;
    pucker += interpolate(u, [-INHALE, 0, 3, 12, 22], [0, -0.18, 0.12, 0.12, 0], ease);
    lean += interpolate(u, [-INHALE, 0, 4, 12, 22], [0, -1.2, 1.6, 1.6, 0], ease);
    y += interpolate(u, [-INHALE, 0, 6, 16], [0, -3, 1, 0], ease);
  }
  // then they straighten up to look at each other, a giggle, in for the kiss, a little back
  const up = interpolate(f, [T.stop - 4, T.look + 6], [0, 1], ease);
  y += -3 * up + Math.sin(Math.PI * interpolate(f, [246, 254], [0, 1], clamp)) * -2.5 + Math.sin(Math.PI * interpolate(f, [254, 262], [0, 1], clamp)) * -2;
  const kissIn = interpolate(f, [T.leanIn, T.touch], [0, 1], ease);
  const kissOut = interpolate(f, [T.back, T.backEnd], [0, 1], ease);
  lean += -0.8 * up * (1 - kissIn) + (kiss.lean ?? 0) * kissIn * (1 - kissOut * 0.55);
  y += ((kiss.y ?? 0) + 3) * kissIn * (1 - kissOut * 0.5);
  // the mouth: blowing, then a smile, the kiss, a smile
  const toSmile = interpolate(f, [T.stop, T.stop + 5], [0, 1], clamp);
  const toKiss = interpolate(f, [272, 278], [0, 1], clamp);
  const backSmile = interpolate(f, [T.back + 4, T.back + 9], [0, 1], clamp);
  const mouth: Pick<CakePose, "mouth" | "mouth2" | "mix"> =
    f < T.stop + 5 ? { mouth: "blow", mouth2: "smile", mix: toSmile } : f < T.back ? { mouth: "smile", mouth2: "kiss", mix: toKiss } : { mouth: "kiss", mouth2: "smile", mix: backSmile };
  // the eyes: a blink as they look, shut for the kiss, open again, a blink in the hold
  const shut = interpolate(f, [276, 284, T.back + 2, T.back + 8], [0, 1, 1, 0], ease);
  const lid = Math.max(shut, blinkAt(f, who === "dan" ? 242 : 244), blinkAt(f, who === "dan" ? 392 : 396), blinkAt(f, who === "dan" ? 120 : 186));
  return { x, y, lean, pucker, lid, ...mouth };
};

// each candle: lit, pushed over by its blow, out; the breath that blew out the one before it makes it shiver a little
const flamesAt = (f: number): CakeFlame[] =>
  CAKE.candles.map((_, i) => {
    const b = BLOWS.find((x) => x.c === i)!;
    const u = f - b.at;
    const prev = BLOWS.find((x) => x.who === b.who && x.c === i + (b.who === "dan" ? -1 : 1));
    const shiver = prev ? interpolate(f - prev.at, [1, 5, 9, 16], [0, 0.18, 0.18, 0], clamp) : 0;
    const push = u < OUT ? interpolate(u, [0, 4, OUT], [0, 0.7, 1], clamp) : 0;
    return { bend: Math.max(push, shiver), from: b.who, out: u >= OUT ? u - OUT : undefined };
  });

const breathAt = (f: number): Breath[] =>
  BLOWS.filter((b) => f >= b.at && f < b.at + BREATH).map((b) => {
    const c = CAKE.candles[b.c];
    return { who: b.who, t: (f - b.at) / BREATH, to: [c.cx, c.top - 22] };
  });

// a gold heart, its point at the bottom (they rise from behind the two heads, growing, swaying, fading out up top)
const Heart: React.FC<{ x: number; y: number; s: number; o: number; rot: number }> = ({ x, y, s, o, rot }) => (
  <path
    transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
    d="M 0 0.32 C -0.12 0.2 -0.52 -0.04 -0.52 -0.3 C -0.52 -0.56 -0.2 -0.66 0 -0.4 C 0.2 -0.66 0.52 -0.56 0.52 -0.3 C 0.52 -0.04 0.12 0.2 0 0.32 Z"
    fill={GOLD}
    opacity={o}
  />
);
const HEARTS = [
  { at: 286, dx: -8, rot: -10, s: 50 },
  { at: 300, dx: 34, rot: 12, s: 40 },
  { at: 314, dx: -40, rot: -16, s: 34 },
];
const HEART_LIFE = 72;

export const Candles: React.FC = () => {
  const f = useCurrentFrame();
  const op = Math.min(interpolate(f, [0, 14], [0, 1], clamp), 1 - interpolate(f, [T.fadeOut, T.fadeOut + 20], [0, 1], ease));
  const dan = poseAt("dan", f);
  const ange = poseAt("ange", f);
  const [kx, ky] = carried("dan", dan, lipTip("dan", true));
  return (
    <AbsoluteFill>
      <CakeCouple
        x={0}
        y={TOP}
        scale={SCALE}
        f={f}
        dan={dan}
        ange={ange}
        flames={flamesAt(f)}
        breath={breathAt(f)}
        kissLips={f >= T.touch - 2 && f < T.back + 6}
        opacity={op}
        behind={
          <svg width={CAKE_SIZE[0]} height={CAKE_SIZE[1]} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {HEARTS.map((h, i) => {
              const t = f - h.at;
              if (t < 0 || t > HEART_LIFE) return null;
              const grow = interpolate(t, [0, 24], [0.55, 1], back);
              const fade = interpolate(t, [HEART_LIFE - 18, HEART_LIFE], [1, 0], clamp);
              return <Heart key={i} x={kx + h.dx + Math.sin(t * 0.12 + i * 2) * 8} y={ky - 230 - t * 2.6} s={h.s * grow} o={fade} rot={h.rot + Math.sin(t * 0.1 + i) * 6} />;
            })}
          </svg>
        }
      />
    </AbsoluteFill>
  );
};
