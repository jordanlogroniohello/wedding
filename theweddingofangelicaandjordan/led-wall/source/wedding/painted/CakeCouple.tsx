import { Img } from "remotion";
import angeBase from "./cake-ange.png";
import angeBlow from "./cake-ange-blow.png";
import angeLids from "./cake-ange-lids.png";
import angeLips from "./cake-ange-lips.png";
import angeSmile from "./cake-ange-smile.png";
import danBase from "./cake-dan.png";
import danBlow from "./cake-dan-blow.png";
import danKiss from "./cake-dan-kiss.png";
import danLids from "./cake-dan-lids.png";
import danSmile from "./cake-dan-smile.png";
import flame1 from "./cake-flame-1.png";
import flame2 from "./cake-flame-2.png";
import flame3 from "./cake-flame-3.png";
import flame4 from "./cake-flame-4.png";
import flame5 from "./cake-flame-5.png";
import flame6 from "./cake-flame-6.png";
import flame7 from "./cake-flame-7.png";
import flame8 from "./cake-flame-8.png";
import front from "./cake-front.png";
import sticks from "./cake-sticks.png";
import { CAKE } from "./cakeParts";
import { PaintedLids } from "./PaintedCouple";

// The candle scene (stage key 3, round 23): the user's candle picture in pieces (cake-cut.py; the user: "move the
// character behind the cake then animate the blow step by step"). Back to front: Ange, then Dan (each slides along the
// far side of the table and leans about a point low on the body, with their mouth, lids and lash lines); her lips over
// his face's edge for the kiss; the candle sticks; the wicks (an ember glowing on one just blown out); each flame
// (flickering, pushed over by a blow, shrinking out); the smoke off a wick just blown out; a blow's breath; and the front
// (the table, the cake, both flower bunches). Picture px (2000 x 667); `CakeCouple` places it with x, y, scale.
type V = readonly number[];
export type Who = "dan" | "ange";
export type Mouth = "blow" | "smile" | "kiss" | "none";
export type CakePose = {
  x?: number; // slid along the table (picture px, + = right)
  y?: number; // up (-) or down (a bob)
  lean?: number; // degrees toward the other one, about the pivot low on the body
  mouth?: Mouth;
  mouth2?: Mouth; // crossfading to this one by `mix`
  mix?: number;
  pucker?: number; // the pursed lips' size (1 = as drawn: smaller drawing breath, bigger blowing)
  lid?: number; // 0 open .. 1 closed
  happy?: boolean;
};
export type CakeFlame = {
  out?: number; // frames since it was blown out (none = still lit)
  bend?: number; // a blow pushing it over, 0..1, away from `from`
  from?: Who;
  flat?: number; // blown from both sides at once (the candles facing the front): pressed down and fluttering, 0..1
};
// t 0..1 over the blow; to = where it's blown at; from = the lips (the candles facing the front: FrontCouple.tsx's)
export type Breath = { who: Who; t: number; to: V; from?: V };

const [W, H] = CAKE.size;
const B = CAKE.boxes;
const SRC = {
  dan: { base: danBase, blow: danBlow, smile: danSmile, kiss: danKiss, lids: danLids },
  ange: { base: angeBase, blow: angeBlow, smile: angeSmile, kiss: angeBlow, lids: angeLids },
};
const FLAMES = [flame1, flame2, flame3, flame4, flame5, flame6, flame7, flame8];
// where each one leans from: his forearm on the table, hers
const PIVOT: Record<Who, V> = { dan: [360, 545], ange: [1600, 545] };
// the middle of each pursed mouth (a blow's pucker grows and shrinks about it; the kiss lines them up)
export const PUCKER: Record<Who, V> = { dan: [571, 328], ange: [1424, 336] };
// toward the other one: his is clockwise on screen, hers anticlockwise
const turn = (who: Who, lean: number) => (who === "dan" ? lean : -lean);
const WICK = "#3b2a1c";
const SMOKE = "#ece6dc";

// a picture point carried along with one of them (slid, leaned): where a lip tip or a mouth is on screen
export const carried = (who: Who, pose: CakePose, p: V): [number, number] => {
  const a = (turn(who, pose.lean ?? 0) * Math.PI) / 180;
  const [cx, cy] = PIVOT[who];
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a) + (pose.x ?? 0), cy + dx * Math.sin(a) + dy * Math.cos(a) + (pose.y ?? 0)];
};
// the pursed lips' front tip (his rightmost, hers leftmost; his pushed out to his face's edge for the kiss)
export const lipTip = (who: Who, kiss = false): V => (who === "dan" && kiss ? CAKE.lips["dan.kiss"] : CAKE.lips[who]);

const Piece: React.FC<{ src: string; box: V; style?: React.CSSProperties }> = ({ src, box, style }) => (
  <Img src={src} style={{ position: "absolute", left: box[0], top: box[1], width: box[2], height: box[3], ...style }} />
);

const MouthPiece: React.FC<{ who: Who; mouth: Mouth; opacity: number; pucker: number }> = ({ who, mouth, opacity, pucker }) => {
  if (mouth === "none" || opacity <= 0.01) return null;
  const key = mouth === "kiss" && who === "ange" ? "blow" : mouth;
  const box = B[`${who}.${key}`];
  const [px, py] = PUCKER[who];
  const grow = mouth === "smile" ? 1 : pucker;
  return (
    <Piece
      src={SRC[who][mouth]}
      box={box}
      style={{ opacity, transformOrigin: `${px - box[0]}px ${py - box[1]}px`, transform: `scale(${grow})` }}
    />
  );
};

// one of them: the picture's own px slid and leaned, the face's pieces on it
const One: React.FC<{ who: Who; pose: CakePose; lipsOnly?: boolean }> = ({ who, pose, lipsOnly }) => {
  const [px, py] = PIVOT[who];
  const mix = pose.mouth2 ? (pose.mix ?? 0) : 0;
  const pucker = pose.pucker ?? 1;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${px}px ${py}px`,
        transform: `translate(${pose.x ?? 0}px, ${pose.y ?? 0}px) rotate(${turn(who, pose.lean ?? 0)}deg)`,
      }}
    >
      {lipsOnly ? (
        // (her lips alone, over his face's edge: where theirs meet in the kiss)
        <Piece src={angeLips} box={B["ange.lips"]} />
      ) : (
        <>
          <Piece src={SRC[who].base} box={B[who]} />
          <MouthPiece who={who} mouth={pose.mouth ?? "blow"} opacity={1 - mix} pucker={pucker} />
          {pose.mouth2 && <MouthPiece who={who} mouth={pose.mouth2} opacity={mix} pucker={pucker} />}
          <PaintedLids src={SRC[who].lids} box={B[`${who}.lids`]} {...CAKE.eyes[who]} lid={pose.lid ?? 0} happy={pose.happy ?? false} weight={0.8} />
        </>
      )}
    </div>
  );
};

// a flame: flickering (its own rhythm), pushed over by a blow (its top away from the blower), shrinking to nothing
// in the 5 frames after it's blown out; all about its foot (the wick's)
const Flame: React.FC<{ i: number; f: number; flame: CakeFlame }> = ({ i, f, flame }) => {
  const c = CAKE.candles[i];
  const out = flame.out ?? -1;
  if (out >= 5) return null;
  const gone = out < 0 ? 0 : (out + 1) / 5;
  const bend = (flame.bend ?? 0) * (flame.from === "ange" ? -1 : 1);
  const flick = Math.sin(f * 0.83 + i * 1.7) * 0.035 + Math.sin(f * 2.1 + i * 0.6) * 0.02;
  const sway = Math.sin(f * 0.57 + i * 2.3) * 2.2 + Math.sin(f * 1.9 + i) * 1.1;
  // (a blow: it leans hard and flutters)
  const flat = flame.flat ?? 0;
  const shiver = Math.sin(f * 3.1 + i) * 6 * Math.max(Math.abs(bend), flat);
  const skew = -(sway + bend * 32 + shiver);
  const sy = (1 + flick - Math.abs(bend) * 0.18 - flat * 0.3) * (1 - gone * 0.85);
  const sx = (1 - flick * 0.5) * (1 - gone * 0.5);
  const box = B[`flame${i + 1}`];
  return (
    <Piece
      src={FLAMES[i]}
      box={box}
      style={{
        transformOrigin: `${c.wick[0] - box[0]}px ${c.top - box[1]}px`,
        transform: `skewX(${skew}deg) scale(${sx}, ${sy})`,
        opacity: 1 - gone * 0.6,
      }}
    />
  );
};

// the smoke off a wick just blown out: two thin wisps rising and curling, drifting the way it was blown, fading
const Smoke: React.FC<{ i: number; flame: CakeFlame }> = ({ i, flame }) => {
  const t = (flame.out ?? -1) - 2;
  if (t < 0 || t > 70) return null;
  const c = CAKE.candles[i];
  const [wx, wy] = c.wick;
  const dir = flame.from === "ange" ? -1 : 1;
  const grow = Math.min(1, t / 24);
  const fade = Math.min(1, t / 6) * Math.max(0, 1 - Math.max(0, t - 24) / 46);
  return (
    <>
      {[0, 1].map((k) => {
        const len = (70 + k * 22) * grow + t * 0.5;
        const pts = Array.from({ length: 14 }, (_, n) => {
          const u = n / 13;
          const x = wx + dir * (10 + k * 6) * u * u + Math.sin(u * 6 + t * 0.11 + k * 2) * (3 + 7 * u) + Math.sin(t * 0.05 + k) * 4 * u;
          const y = wy - 2 - len * u - t * 0.25;
          return `${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        return (
          <path
            key={k}
            d={`M ${pts.join(" L ")}`}
            stroke={`url(#smoke${k})`}
            strokeWidth={k ? 2.2 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={fade * (k ? 0.45 : 0.6)}
          />
        );
      })}
    </>
  );
};

// a blow's breath: three short strokes streaming from the lips toward the flame, staggered, each fading in and out
const BreathLines: React.FC<{ b: Breath; pose: CakePose }> = ({ b, pose }) => {
  const [mx, my] = b.from ?? carried(b.who, pose, lipTip(b.who));
  const dir = b.who === "dan" ? 1 : -1;
  const from = [mx + dir * 6, my + 4];
  const dx = b.to[0] - from[0];
  const dy = b.to[1] - from[1];
  return (
    <>
      {[-1, 0, 1].map((k) => {
        const u = b.t * 1.25 - (k + 1) * 0.12;
        if (u <= 0 || u >= 1) return null;
        const o = Math.sin(Math.PI * u) * 0.75;
        const x = from[0] + dx * u * 0.85;
        const y = from[1] + dy * u * 0.85 + k * 7 * (0.4 + u);
        const l = 16 + 10 * Math.sin(Math.PI * u);
        return (
          <path
            key={k}
            d={`M ${x} ${y} q ${(dir * l) / 2} ${-3} ${dir * l} ${0}`}
            stroke="#fffaf0"
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            opacity={o}
          />
        );
      })}
    </>
  );
};

// the scene at one moment, its top-left at x, y, at `scale` (picture px -> screen)
export const CakeCouple: React.FC<{
  x: number;
  y: number;
  scale: number;
  f: number;
  dan?: CakePose;
  ange?: CakePose;
  flames?: CakeFlame[];
  breath?: Breath[];
  kissLips?: boolean; // her lips over his face's edge (the kiss)
  opacity?: number;
  behind?: React.ReactNode; // drawn behind them both (picture px)
  people?: React.ReactNode; // drawn in their place (the candles facing the front: FrontCouple.tsx's; picture px)
  children?: React.ReactNode; // drawn over everything (picture px)
}> = ({ x, y, scale, f, dan = {}, ange = {}, flames = [], breath = [], kissLips = false, opacity = 1, behind, people, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: W,
      height: H,
      transformOrigin: "0 0",
      transform: `translate(${x}px, ${y}px) scale(${scale})`,
      opacity,
    }}
  >
    {behind}
    {people ?? (
      <>
        <One who="ange" pose={ange} />
        <One who="dan" pose={dan} />
        {kissLips && <One who="ange" pose={ange} lipsOnly />}
      </>
    )}
    <Piece src={sticks} box={B.sticks} />
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {CAKE.candles.map((c, i) => {
        const out = flames[i]?.out ?? -1;
        // (the ember: bright as it goes out, dimming over a second)
        const ember = out < 0 ? 0 : Math.max(0, 1 - out / 30);
        return (
          <g key={i}>
            <line x1={c.wick[0]} y1={c.wick[1]} x2={c.wick[0]} y2={c.top} stroke={WICK} strokeWidth={2.4} strokeLinecap="round" />
            {ember > 0 && (
              <>
                <circle cx={c.wick[0]} cy={c.wick[1] + 1} r={6} fill="#ff9a3c" opacity={ember * 0.35} />
                <circle cx={c.wick[0]} cy={c.wick[1] + 1} r={2.2} fill="#ffb25c" opacity={ember} />
              </>
            )}
          </g>
        );
      })}
    </svg>
    {CAKE.candles.map((_, i) => (
      <Flame key={i} i={i} f={f} flame={flames[i] ?? {}} />
    ))}
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        {[0, 1].map((k) => (
          <linearGradient key={k} id={`smoke${k}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={SMOKE} stopOpacity={0.9} />
            <stop offset="0.6" stopColor={SMOKE} stopOpacity={0.5} />
            <stop offset="1" stopColor={SMOKE} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      {CAKE.candles.map((_, i) => (
        <Smoke key={i} i={i} flame={flames[i] ?? {}} />
      ))}
      {breath.map((b, i) => (
        <BreathLines key={i} b={b} pose={b.who === "dan" ? dan : ange} />
      ))}
    </svg>
    <Piece src={front} box={B.front} />
    {children}
  </div>
);
export const CAKE_SIZE = CAKE.size;
