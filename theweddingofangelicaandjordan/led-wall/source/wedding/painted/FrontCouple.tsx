import { Img } from "remotion";
import angeHead from "./ange-head.png";
import angeLids from "./ange-lids.png";
import danKiss from "./cake-dan-kiss.png";
import danTurnLids from "./cake-dan-lids.png";
import danSmile from "./cake-dan-smile.png";
import { CAKE } from "./cakeParts";
import danHead from "./dan-head.png";
import danLids from "./dan-lids.png";
import angeBare from "./front-ange-bare.png";
import angeBase from "./front-ange-base.png";
import angeLook1 from "./front-ange-look1.png";
import angeLook2 from "./front-ange-look2.png";
import angePucker from "./front-ange-pucker.png";
import danBare from "./front-dan-bare.png";
import danBase from "./front-dan-base.png";
import danLook1 from "./front-dan-look1.png";
import danLook2 from "./front-dan-look2.png";
import danPucker from "./front-dan-pucker.png";
import danTurn from "./front-dan-turn.png";
import { FRONT } from "./frontParts";
import { BentPiece, PaintedLids } from "./PaintedCouple";
import { PAINTED } from "./paintedParts";

// The candles facing the front (stage key 3, round 24; the user: "dapat naka harap nalang wag ng nakatagilid": facing
// the front, not side on): the toast picture's Dan & Ange (front-cut.py's pieces) behind the candle picture's cake, in
// CakeCouple's `people` slot. Each one: the base (the other arm mirrored into the glass arm's place: his hands in his
// pockets, hers on the bouquet; the table hides them), leaning about the waist; the head bending at the neck
// (painted-cut.py's mesh), with the face on it: the grin, or the bare face with the pursed lips (growing and shrinking
// with a blow); the eyes glancing at the other (a dart: half way, then all the way); the lids; a blush. For the kiss
// Dan's head turns to her (he can't reach her cheek facing the front): the candle picture's 3/4 head on his neck (its
// smile, its lips pushed out, its lids), his collar over its neck. Toast px inside, `FRONT_SCALE` to the candle
// picture's.
type V = readonly number[];
export type FrontWho = "dan" | "ange";
export type FrontPose = {
  x: number; // where the mouth is (the candle picture's px, before the lean and the tilt)
  y: number;
  lean?: number; // the body about its waist, degrees (+ = clockwise)
  tilt?: number; // the head at the neck, degrees (+ = clockwise)
  blow?: number; // 0 the grin .. 1 the pursed lips
  pucker?: number; // the pursed lips' size (1 = as drawn)
  look?: 0 | 1 | 2; // ahead, half way, at the other (his to the right, hers to the left)
  lid?: number; // 0 open .. 1 closed
  happy?: boolean; // closed, smiling (^ ^)
  blush?: number;
  // (Dan) his head turned to her: 0 front .. 1 turned (the two cross over), and the turned face
  turn?: number;
  turnTilt?: number;
  turnKiss?: number; // 0 smiling .. 1 the lips pushed out
  turnLid?: number;
};

export const FRONT_SCALE = 0.85; // toast px -> the candle picture's (the faces' size: eyes ~114 apart there, 134 here)
const S = FRONT_SCALE;
const [TW, TH] = FRONT.size;
const B = FRONT.boxes;
const SRC = {
  dan: { base: danBase, head: danHead, lids: danLids, bare: danBare, pucker: danPucker, look: [danLook1, danLook2] },
  ange: { base: angeBase, head: angeHead, lids: angeLids, bare: angeBare, pucker: angePucker, look: [angeLook1, angeLook2] },
};
// the lean's pivot: low on the body, under the table
const WAIST: Record<FrontWho, V> = { dan: [415, 700], ange: [890, 745] };
// the turned head's neck goes here (low in his collar, so its chin sits on the collar like the front one's; the collar
// drawn back over its neck)
const TURN_AT: V = [415, 466];
const COLLAR: V[] = [[350, 449], [476, 449], [482, 476], [446, 540], [386, 540], [344, 476]];
const BLUSH: Record<FrontWho, V[]> = { dan: [], ange: [[818, 404], [962, 402]] };

const rot = (p: V, c: V, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [p[0] - c[0], p[1] - c[1]];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};
const origin = (who: FrontWho, pose: FrontPose) => {
  const m = FRONT.mouth[who];
  return [pose.x - S * m[0], pose.y - S * m[1]];
};
const out = (who: FrontWho, pose: FrontPose, p: V): [number, number] => {
  const [ox, oy] = origin(who, pose);
  const q = rot(p, WAIST[who], pose.lean ?? 0);
  return [ox + S * q[0], oy + S * q[1]];
};
// a point on the face (toast px) -> the candle picture's px
export const frontFacePt = (who: FrontWho, pose: FrontPose, p: V) => out(who, pose, rot(p, PAINTED.pivots[`${who}.head`], pose.tilt ?? 0));
// the mouth's middle
export const frontMouth = (who: FrontWho, pose: FrontPose) => frontFacePt(who, pose, FRONT.mouth[who]);
// a point on his turned head (the candle picture's px, as in that picture) -> where it is now
export const turnPt = (pose: FrontPose, p: V) => {
  const q = rot(p, FRONT.turnNeck, pose.turnTilt ?? 0);
  return out("dan", pose, [TURN_AT[0] + (q[0] - FRONT.turnNeck[0]) / S, TURN_AT[1] + (q[1] - FRONT.turnNeck[1]) / S]);
};
// his pushed-out lips' tip on the turned head (the kiss)
export const TURN_LIPS = CAKE.lips["dan.kiss"];

const Piece: React.FC<{ src: string; box: V; style?: React.CSSProperties }> = ({ src, box, style }) => (
  <Img src={src} style={{ position: "absolute", left: box[0], top: box[1], width: box[2], height: box[3], ...style }} />
);
const about = (p: V, transform: string): React.CSSProperties => ({ position: "absolute", inset: 0, transformOrigin: `${p[0]}px ${p[1]}px`, transform });

// the face on the front head (turning with it): the eyes' glance, the mouth, the lids, the blush
const Face: React.FC<{ who: FrontWho; pose: FrontPose }> = ({ who, pose }) => {
  const src = SRC[who];
  const blow = pose.blow ?? 0;
  const [mx, my] = FRONT.mouth[who];
  const look = pose.look ?? 0;
  return (
    <div style={about(PAINTED.pivots[`${who}.head`], `rotate(${pose.tilt ?? 0}deg)`)}>
      {look > 0 && <Piece src={src.look[look - 1]} box={B[`${who}.look${look}`]} />}
      {blow > 0.01 && (
        <div style={{ position: "absolute", inset: 0, opacity: blow }}>
          <Piece src={src.bare} box={B[`${who}.bare`]} />
          <Piece
            src={src.pucker}
            box={B[`${who}.pucker`]}
            style={{ transformOrigin: `${mx - B[`${who}.pucker`][0]}px ${my - B[`${who}.pucker`][1]}px`, transform: `scale(${pose.pucker ?? 1})` }}
          />
        </div>
      )}
      {(pose.blush ?? 0) > 0.01 && (
        <svg width={TW} height={TH} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <filter id={`blush-${who}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={7} />
            </filter>
          </defs>
          {BLUSH[who].map((c, i) => (
            <ellipse key={i} cx={c[0]} cy={c[1]} rx={26} ry={13} fill="#ff7f86" opacity={(pose.blush ?? 0) * 0.55} filter={`url(#blush-${who})`} />
          ))}
        </svg>
      )}
      <PaintedLids src={src.lids} box={PAINTED.boxes[`${who}.lids`]} {...PAINTED.eyes[who]} lid={pose.lid ?? 0} happy={pose.happy ?? false} />
    </div>
  );
};

// his head turned to her: the candle picture's (its neck on his collar's middle), its smile or pushed-out lips, its lids
const TurnedHead: React.FC<{ pose: FrontPose }> = ({ pose }) => {
  const [nx, ny] = FRONT.turnNeck;
  const kiss = pose.turnKiss ?? 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CAKE.size[0],
        height: CAKE.size[1],
        transformOrigin: "0 0",
        transform: `translate(${TURN_AT[0]}px, ${TURN_AT[1]}px) scale(${1 / S}) rotate(${pose.turnTilt ?? 0}deg) translate(${-nx}px, ${-ny}px)`,
      }}
    >
      <Piece src={danTurn} box={B["dan.turn"]} />
      {kiss < 0.99 && <Piece src={danSmile} box={CAKE.boxes["dan.smile"]} style={{ opacity: 1 - kiss }} />}
      {kiss > 0.01 && <Piece src={danKiss} box={CAKE.boxes["dan.kiss"]} style={{ opacity: kiss }} />}
      <PaintedLids src={danTurnLids} box={CAKE.boxes["dan.lids"]} {...CAKE.eyes.dan} lid={pose.turnLid ?? 0} happy={false} weight={0.8} />
    </div>
  );
};

const One: React.FC<{ who: FrontWho; pose: FrontPose }> = ({ who, pose }) => {
  const src = SRC[who];
  const [ox, oy] = origin(who, pose);
  const turn = who === "dan" ? (pose.turn ?? 0) : 0;
  // (a quick turn: the front head narrowing, then the turned one in its place, narrow, widening; never both at once:
  // a cross-fade showed two faces)
  const front = turn < 0.5;
  const squeeze = 0.16 * (front ? turn / 0.5 : (1 - turn) / 0.5);
  const neck = PAINTED.pivots[`${who}.head`];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: TW, height: TH, transformOrigin: "0 0", transform: `translate(${ox}px, ${oy}px) scale(${S})` }}>
      <div style={about(WAIST[who], `rotate(${pose.lean ?? 0}deg)`)}>
        <Piece src={src.base} box={B[`${who}.base`]} />
        {front && (
          <div style={about(neck, `scaleX(${1 - squeeze})`)}>
            <BentPiece src={src.head} box={PAINTED.boxes[`${who}.head`]} mesh={PAINTED.mesh[`${who}.head`]} pivot={neck} deg={pose.tilt ?? 0} />
            <Face who={who} pose={pose} />
          </div>
        )}
        {!front && (
          <>
            <div style={about(TURN_AT, `scaleX(${1 - squeeze})`)}>
              <TurnedHead pose={pose} />
            </div>
            <Piece src={src.base} box={B[`${who}.base`]} style={{ clipPath: `polygon(${COLLAR.map((p) => `${p[0] - B[`${who}.base`][0]}px ${p[1] - B[`${who}.base`][1]}px`).join(", ")})` }} />
          </>
        )}
      </div>
    </div>
  );
};

// the two of them (her behind: his curls come over her hair when they're close, never her face)
export const FrontPeople: React.FC<{ dan: FrontPose; ange: FrontPose }> = ({ dan, ange }) => (
  <>
    <One who="ange" pose={ange} />
    <One who="dan" pose={dan} />
  </>
);
