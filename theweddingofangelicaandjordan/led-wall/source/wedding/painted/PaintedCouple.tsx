import { Img } from "remotion";
import angeArm from "./ange-arm.png";
import angeBase from "./ange-base.png";
import angeHead from "./ange-head.png";
import angeLids from "./ange-lids.png";
import danArm from "./dan-arm.png";
import danBase from "./dan-base.png";
import danHead from "./dan-head.png";
import danLids from "./dan-lids.png";
import { MeshPiece, type MeshPlace } from "./MeshPiece";
import { PAINTED } from "./paintedParts";

// Dan & Ange as cut-outs of the user's own painted toast picture (round 12, the user: "more detailed and PNG … more like
// this very like this. yours is kinda flat"): the picture's own pixels (painted-cut.py cuts them). Each one: the base,
// the head turning at the neck, the glass arm turning (Dan's forearm at the elbow, coming forward; Ange's whole arm at the
// shoulder, behind her hair), and blinks: the closed-eye skin over the eye, down to the lid, with the lash line drawn
// along it. The head and arm bend rather than turn stiff (round 13, the user: "the cut rig is obvious"): drawn through a
// mesh (WebGL), each vertex turned by its share of the turn, 0 where the piece meets the body (Dan's curls on his
// shoulders, Ange's armpit, the elbow's cut), so those joins never open. Everything here is in picture px (the
// 1312 x 1199 picture); `PaintedCouple` places the picture with `x`, `y` (its top-left) and `scale`.
type V = [number, number];
type Who = "dan" | "ange";
const SRC = {
  dan: { base: danBase, head: danHead, arm: danArm, lids: danLids },
  ange: { base: angeBase, head: angeHead, arm: angeArm, lids: angeLids },
};
const [W, H] = PAINTED.size;
// where each one's feet are (the breath and the bounce squash about them)
const FEET: Record<Who, V> = { dan: [400, 1197], ange: [895, 1199] };
// his glass is in front of his hair; her arm hangs behind hers
const ARM_BEHIND: Record<Who, boolean> = { dan: false, ange: true };

export type PaintedPose = {
  tilt?: number; // the head, degrees (+ = clockwise on screen)
  armTurn?: number; // the glass arm, degrees at its pivot (his elbow, her shoulder)
  armGrow?: number; // the glass arm coming forward (1 = as drawn)
  lid?: number; // 0 open .. 1 closed
  happy?: boolean; // closed, smiling eyes (^ ^)
  squash?: number; // a bounce: + = squashed down
  breath?: number; // -1..1
};

// a layer of the whole picture, turned (and grown) about a picture point
const about = (p: readonly number[], deg: number, s = 1): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  transformOrigin: `${p[0]}px ${p[1]}px`,
  transform: `rotate(${deg}deg) scale(${s})`,
});

// a moving piece bent through its mesh: every vertex turned (and grown) about the pivot by its share (`mesh.w`) of the
// move (MeshPiece draws it; also the candles facing the front, FrontCouple.tsx)
type Mesh = { readonly n: readonly number[]; readonly w: readonly number[] };
export const BentPiece: React.FC<{ src: string; box: readonly number[]; mesh: Mesh; pivot: readonly number[]; deg: number; grow?: number }> = ({
  src,
  box,
  mesh,
  pivot,
  deg,
  grow = 1,
}) => {
  const a = (deg * Math.PI) / 180;
  const k = grow - 1;
  const place: MeshPlace = (x, y, v) => {
    const [dx, dy] = [x - pivot[0], y - pivot[1]];
    const [t, sc] = [a * mesh.w[v], 1 + k * mesh.w[v]];
    return [pivot[0] + sc * (dx * Math.cos(t) - dy * Math.sin(t)), pivot[1] + sc * (dx * Math.sin(t) + dy * Math.cos(t))];
  };
  return <MeshPiece src={src} box={box} n={mesh.n} place={place} />;
};

const Piece: React.FC<{ src: string; box: readonly number[] }> = ({ src, box }) => (
  <Img
    src={src}
    style={{
      position: "absolute",
      left: box[0],
      top: box[1],
      width: box[2],
      height: box[3],
    }}
  />
);

// a picture point after the arm's move (for the sparkles at the glass)
export const paintedArmPt = (who: Who, p: V, pose: PaintedPose): V => {
  const c = PAINTED.pivots[`${who}.arm`];
  const a = ((pose.armTurn ?? 0) * Math.PI) / 180;
  const s = pose.armGrow ?? 1;
  const [dx, dy] = [(p[0] - c[0]) * s, (p[1] - c[1]) * s];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};
// the glasses' bowls in the picture
export const PAINTED_BOWL: Record<Who, V> = {
  dan: [178, 455],
  ange: [1138, 485],
};

// the lids: the closed-eye skin over each eye down to the lid (all of it when closed), and the lash line along the lid
// (also the candle scene's, CakeCouple.tsx: its own lid skin and eyes; `weight` scales the lash line)
type Eye = { l: readonly number[]; r: readonly number[]; top: number; bot: number };
export const PaintedLids: React.FC<{
  src: string;
  box: readonly number[];
  eyes: readonly Eye[];
  ink: string;
  lid: number;
  happy: boolean;
  weight?: number;
}> = ({ src, box, eyes, ink, lid, happy, weight = 1 }) => {
  const shut = happy ? 1 : lid;
  if (shut <= 0.02) return null;
  return (
    <>
      {eyes.map((e, i) => {
        const h = e.bot - e.top + 8;
        // the lid's edge: straight across the eye, from its top down to (closed) just below the eye's middle
        const y = e.top - 4 + h * shut;
        const clip =
          shut >= 1
            ? `polygon(${e.l[0] - 8 - box[0]}px 0, ${e.r[0] + 8 - box[0]}px 0, ${e.r[0] + 8 - box[0]}px 100%, ${e.l[0] - 8 - box[0]}px 100%)`
            : `polygon(${e.l[0] - 8 - box[0]}px 0, ${e.r[0] + 8 - box[0]}px 0, ${e.r[0] + 8 - box[0]}px ${y - box[1]}px, ${e.l[0] - 8 - box[0]}px ${y - box[1]}px)`;
        return (
          <Img
            key={i}
            src={src}
            style={{
              position: "absolute",
              left: box[0],
              top: box[1],
              width: box[2],
              height: box[3],
              clipPath: clip,
            }}
          />
        );
      })}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {eyes.map((e, i) => {
          const h = e.bot - e.top;
          const mx = (e.l[0] + e.r[0]) / 2;
          const cy = (e.l[1] + e.r[1]) / 2;
          // closed: a soft downward curve a little below the eye's middle; happy: an arch (^); half: across the clip
          const d = happy
            ? `M ${e.l[0] + 4} ${cy + h * 0.15} Q ${mx} ${cy - h * 0.75} ${e.r[0] - 4} ${cy + h * 0.15}`
            : shut >= 1
              ? `M ${e.l[0]} ${e.l[1]} Q ${mx} ${cy + h * 0.45} ${e.r[0]} ${e.r[1]}`
              : `M ${e.l[0] + 2} ${e.top - 4 + (h + 8) * shut} L ${e.r[0] - 2} ${e.top - 4 + (h + 8) * shut}`;
          return <path key={i} d={d} stroke={ink} strokeWidth={(happy ? 6 : 5) * weight} strokeLinecap="round" fill="none" opacity={0.92} />;
        })}
      </svg>
    </>
  );
};
const Lids: React.FC<{ who: Who; lid: number; happy: boolean }> = ({ who, lid, happy }) => (
  <PaintedLids src={SRC[who].lids} box={PAINTED.boxes[`${who}.lids`]} {...PAINTED.eyes[who]} lid={lid} happy={happy} />
);

const One: React.FC<{ who: Who; pose: PaintedPose }> = ({ who, pose }) => {
  const src = SRC[who];
  const b = PAINTED.boxes;
  const feet = FEET[who];
  const sq = pose.squash ?? 0;
  const br = (pose.breath ?? 0) * 0.004;
  const arm = (
    <BentPiece
      src={src.arm}
      box={b[`${who}.arm`]}
      mesh={PAINTED.mesh[`${who}.arm`]}
      pivot={PAINTED.pivots[`${who}.arm`]}
      deg={pose.armTurn ?? 0}
      grow={pose.armGrow ?? 1}
    />
  );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${feet[0]}px ${feet[1]}px`,
        transform: `scale(${1 + sq * 0.6}, ${1 - sq + br})`,
      }}
    >
      <Piece src={src.base} box={b[`${who}.base`]} />
      {ARM_BEHIND[who] && arm}
      <BentPiece src={src.head} box={b[`${who}.head`]} mesh={PAINTED.mesh[`${who}.head`]} pivot={PAINTED.pivots[`${who}.head`]} deg={pose.tilt ?? 0} />
      {/* (the face turns whole: its share of the turn is all of it) */}
      <div style={about(PAINTED.pivots[`${who}.head`], pose.tilt ?? 0)}>
        <Lids who={who} lid={pose.lid ?? 0} happy={pose.happy ?? false} />
      </div>
      {!ARM_BEHIND[who] && arm}
    </div>
  );
};

// the couple as in the picture, its top-left at x, y, at `scale` (picture px -> screen)
export const PaintedCouple: React.FC<{
  x: number;
  y: number;
  scale: number;
  dan?: PaintedPose;
  ange?: PaintedPose;
  opacity?: number;
}> = ({ x, y, scale, dan = {}, ange = {}, opacity = 1 }) => (
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
    <One who="dan" pose={dan} />
    <One who="ange" pose={ange} />
  </div>
);
export const PAINTED_SIZE = PAINTED.size;
