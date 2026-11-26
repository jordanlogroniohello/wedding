import { Img } from "remotion";
import { MeshPiece, type MeshPlace } from "./MeshPiece";
import base from "./piggy-base.png";
import foot from "./piggy-foot.png";
import leg from "./piggy-leg.png";
import { PIGGY } from "./piggyParts";

// The piggyback, running (round 19): the approved piggyback picture (the toast faces on it) cut by piggy-cut.py into the
// base (Ange, Dan's body, the jacket), his near leg (hip to cuff) and his shoe with the ankle. The A/B examples (a stiff
// leg, a mirrored one) couldn't run ("twisted"), so his legs are rigged: each one a thigh and a shin through one mesh
// (every vertex shared between them, eased across the knee, so the outline runs on round it) and the shoe turning at
// the ankle behind the cuff; his far leg is the same pieces a shade darker, behind. A run cycle drives them: each foot's
// path (on the ground, rolling heel to toe, then kicked up behind, through under him, the knee up, reaching forward),
// the knee found by IK (always bending forward), the body dipping as each foot takes his weight and rising off it. The
// base bends a little through its own mesh: her bouquet arm and his fist swing, her hair and dress wave out a beat
// after each step, his curls bounce, and she bounces on his back a beat after him. Everything in picture px (the 1122 x
// 1402 picture); `PiggyRun` places the picture with `x`, `y` (its top-left) and `scale`.
type V = [number, number];
const { hip: HIP, knee: KNEE, ankle: ANKLE, heel: HEEL, toe: TOE } = PIGGY.bones;
const [W, H] = PIGGY.size;
const L1 = Math.hypot(KNEE[0] - HIP[0], KNEE[1] - HIP[1]);
const L2 = Math.hypot(ANKLE[0] - KNEE[0], ANKLE[1] - KNEE[1]);
const REST1 = Math.atan2(KNEE[1] - HIP[1], KNEE[0] - HIP[0]);
const REST2 = Math.atan2(ANKLE[1] - KNEE[1], ANKLE[0] - KNEE[0]);
const MAX_BEND = 110;
const D_MIN = Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos((MAX_BEND * Math.PI) / 180));
const rad = (d: number) => (d * Math.PI) / 180;
const turn = (p: readonly number[], c: readonly number[], a: number): V => {
  const [dx, dy] = [p[0] - c[0], p[1] - c[1]];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};

// the ground (picture px), and how far the body dips (+) and rises (-) over a step
export const PIGGY_GROUND = 1400;
const BOB = 12;
// the stance: the foot lands this far in front of the hip and leaves this far behind (picture px), over this much of
// the stride
const LAND = 150;
const LEAVE = -160;
const STANCE = 0.38;
// the swing, after the foot leaves: [phase, ankle x from the hip, ankle y] (kicked up behind, heel under him, knee up,
// reaching), then it lands again at 1
const SWING: [number, number, number][] = [
  [0.5, -215, 1120],
  [0.62, -100, 1080],
  [0.76, 70, 1060],
  [0.88, 185, 1185],
];
// the shoe's turn from the picture (degrees, + = toe down), over the stride: landing on the heel, flat, rolling onto the
// toe, kicked up behind (the sole up), coming through, reaching
const FOOT: [number, number][] = [
  [0, 8],
  [0.07, 35],
  [0.24, 35],
  [0.38, 85],
  [0.5, 140],
  [0.62, 115],
  [0.76, 60],
  [0.88, 15],
];

const wrap = (p: number) => ((p % 1) + 1) % 1;
// a smooth closed curve through keys [phase, ...values] (Catmull-Rom)
const loop = (keys: readonly (readonly number[])[], p: number): number[] => {
  const n = keys.length;
  const ph = wrap(p);
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= ph) i = k;
  const at = (k: number) => keys[((k % n) + n) % n];
  const span = (k: number) => wrap(at(k + 1)[0] - at(k)[0]) || 1;
  const t = wrap(ph - at(i)[0]) / span(i);
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return p1.slice(1).map((_, c) => {
    const [a, b, d, e] = [p0[c + 1], p1[c + 1], p2[c + 1], p3[c + 1]];
    return 0.5 * (2 * b + (-a + d) * t + (2 * a - 5 * b + 4 * d - e) * t2 + (-a + 3 * b - 3 * d + e) * t3);
  });
};

// the body's dip (+ down) over the stride: lowest as either foot takes his weight, highest between
export const piggyBob = (p: number) => BOB * Math.cos(4 * Math.PI * (p - STANCE / 2));
const footTurn = (p: number) => loop(FOOT, p)[0];
// how far the ankle sits above the ground with the shoe turned so (its lowest end, heel or toe, on the ground)
const ankleLift = (deg: number) => {
  const a = rad(deg);
  return Math.max(...[HEEL, TOE].map((q) => (q[0] - ANKLE[0]) * Math.sin(a) + (q[1] - ANKLE[1]) * Math.cos(a)));
};
// the ankle's place over the stride (x from the hip, y on the picture)
const anklePath = (p: number): V => {
  const ph = wrap(p);
  const onGround = (q: number): V => [LAND + (LEAVE - LAND) * (q / STANCE), PIGGY_GROUND - ankleLift(footTurn(q))];
  if (ph <= STANCE) return onGround(ph);
  // the swing: from where the foot leaves, through the keys, to where it lands (with the stance's ends as the curve's
  // outer keys, so it leaves and lands moving along the ground)
  const keys = [[STANCE - 0.06, ...onGround(STANCE - 0.06)], [STANCE, ...onGround(STANCE)], ...SWING, [1, ...onGround(0)], [1.06, ...onGround(0.06)]];
  let i = 1;
  while (i < keys.length - 2 && keys[i + 1][0] <= ph) i++;
  const [p0, p1, p2, p3] = [keys[i - 1], keys[i], keys[i + 1], keys[i + 2]];
  const t = (ph - p1[0]) / (p2[0] - p1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  const c = (k: number) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return [c(1), c(2)];
};

// one leg at phase p, its hip at `hip`: the thigh's and shin's turns from the picture (IK, the knee forward)
const legAt = (p: number, hip: V) => {
  const [ax, ay] = anklePath(p);
  const [tx, ty] = [ax + hip[0], ay];
  // (the knee bends at most MAX_BEND: past that the trousers' mesh folds over itself at the back of the knee)
  const d = Math.min(Math.max(Math.hypot(tx - hip[0], ty - hip[1]), D_MIN), L1 + L2 - 0.5);
  const phi = Math.atan2(ty - hip[1], tx - hip[0]);
  const alpha = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const th1 = phi - alpha;
  const knee: V = [hip[0] + L1 * Math.cos(th1), hip[1] + L1 * Math.sin(th1)];
  // (the shin from the knee to the target, or as near as the leg reaches)
  const ankle: V = [hip[0] + d * Math.cos(phi), hip[1] + d * Math.sin(phi)];
  const th2 = Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]);
  return { r1: th1 - REST1, r2: th2 - REST2, knee, ankle, foot: rad(footTurn(p)) };
};

const Leg: React.FC<{ p: number; hip: V; far?: boolean; res: number }> = ({ p, hip, far, res }) => {
  const { r1, r2, knee, ankle, foot: f } = legAt(p, hip);
  const w = PIGGY.mesh.leg.w;
  const place: MeshPlace = (x, y, v) => {
    const t = turn([x - HIP[0] + hip[0], y - HIP[1] + hip[1]], hip, r1);
    const s = turn([x - KNEE[0] + knee[0], y - KNEE[1] + knee[1]], knee, r2);
    return [t[0] + (s[0] - t[0]) * w[v], t[1] + (s[1] - t[1]) * w[v]];
  };
  const fb = PIGGY.boxes.foot;
  const shade: React.CSSProperties | undefined = far ? { filter: "brightness(0.86) sepia(0.12)" } : undefined;
  return (
    <>
      {/* the shoe behind the cuff, turned at the ankle */}
      <Img
        src={foot}
        style={{
          position: "absolute",
          left: fb[0],
          top: fb[1],
          width: fb[2],
          height: fb[3],
          transformOrigin: `${ANKLE[0] - fb[0]}px ${ANKLE[1] - fb[1]}px`,
          transform: `translate(${ankle[0] - ANKLE[0]}px, ${ankle[1] - ANKLE[1]}px) rotate(${f}rad)`,
          ...shade,
        }}
      />
      <MeshPiece src={leg} box={PIGGY.boxes.leg} n={PIGGY.mesh.leg.n} place={place} pad={420} res={res} style={shade} />
    </>
  );
};

// the base's moves at phase p (the stride), as one placing of its mesh
const baseAt = (p: number): MeshPlace => {
  const m = PIGGY.mesh.base;
  const step = 4 * Math.PI * p;
  const stride = 2 * Math.PI * p;
  const bq = rad(6 * Math.sin(stride - 0.8));
  const fist = rad(8 * Math.sin(stride));
  // (she rides a beat behind his dip)
  const ride = piggyBob(p - 0.07) - piggyBob(p);
  const [bp, fp] = [PIGGY.pivots.bouquet, PIGGY.pivots.fist];
  return (x, y, v) => {
    const kh = (470 - x) / 90;
    const kd = (600 - x) / 110;
    let px = x + 4 * Math.cos(step - kh) * m.hair[v] + 5 * Math.sin(step - 0.6 - kd) * m.dress[v];
    let py = y + 9 * Math.sin(step - kh) * m.hair[v] + 12 * Math.sin(step - 0.3 - kd) * m.dress[v];
    py += 6 * Math.sin(step - 1.2) * m.curls[v] + ride * m.ange[v];
    [px, py] = turn([px, py], bp, bq * m.bouquet[v]);
    [px, py] = turn([px, py], fp, fist * m.fist[v]);
    return [px, py];
  };
};

// the stride's length in frames (two steps)
export const PIGGY_STRIDE = 20;
// how far the ground goes by in a frame while a foot is down (picture px), for a ground drawn under them
export const PIGGY_SPEED = (LAND - LEAVE) / (STANCE * PIGGY_STRIDE);

// the couple running, at frame `frame` of the run; the picture's top-left at x, y, at `scale`
export const PiggyRun: React.FC<{ x: number; y: number; scale: number; frame: number }> = ({ x, y, scale, frame }) => {
  const p = frame / PIGGY_STRIDE;
  const dip = piggyBob(p);
  const hip: V = [HIP[0], HIP[1] + dip];
  // (his far hip a little behind and above the near one)
  const farHip: V = [hip[0] - 18, hip[1] - 4];
  const bb = PIGGY.boxes.base;
  // (the meshes drawn at the size they're shown)
  const res = Math.min(1, scale);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: H,
        transformOrigin: "0 0",
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
      }}
    >
      <Leg p={p + 0.5} hip={farHip} far res={res} />
      <Leg p={p} hip={hip} res={res} />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${dip}px)` }}>
        <MeshPiece src={base} box={bb} n={PIGGY.mesh.base.n} place={baseAt(p)} pad={40} res={res} />
      </div>
    </div>
  );
};
