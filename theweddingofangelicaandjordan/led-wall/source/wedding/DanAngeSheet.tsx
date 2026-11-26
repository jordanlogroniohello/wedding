import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Fredoka";
import ref from "./dan-ange-ref.png";
import { MoreDetailedCuteAnge, type MoreDetailedCuteAngeProps } from "./MoreDetailedCuteAnge";
import { danWave, MoreDetailedCuteDan, type MoreDetailedCuteDanProps } from "./MoreDetailedCuteDan";
import { ANGE_FEET, DAN_FEET, K, Pair } from "./Pair";
import { springLag } from "./tracedRig";

// Review sheet for Dan & Ange (traced from the user's own picture, wedding test): the picture, the rebuilt pair,
// a pose, and faces; plus a 4.5s motion test.
const { fontFamily } = loadFont("normal", { weights: ["500", "600"] });
const BG = "#F6F1EA";
const DARK = "#2B2F3A";
const Label: React.FC<{ x: number; y: number; children: string; size?: number }> = ({ x, y, children, size = 20 }) => (
  <text x={x} y={y} textAnchor="middle" fontFamily={fontFamily} fontWeight={500} fontSize={size} fill="#5A4A3E">
    {children}
  </text>
);
const Chip: React.FC<{ x: number; y: number; children: string }> = ({ x, y, children }) => (
  <g>
    <rect x={x} y={y} width={children.length * 15 + 36} height={42} rx={21} fill={DARK} />
    <text x={x + 18} y={y + 29} fontFamily={fontFamily} fontWeight={600} fontSize={25} fill="#fff">
      {children}
    </text>
  </g>
);

const DAN_FACES: [string, Partial<MoreDetailedCuteDanProps>][] = [
  ["Grin (picture)", {}],
  ["Smile", { eyes: "happy", mouth: "smile" }],
  ["Talking", { mouthOpen: 0.85, brows: "raised" }],
  ["Surprised", { eyes: "wide", mouth: "o", brows: "raised" }],
  ["Laughing", { eyes: "squeeze", mouth: "wide", tilt: -5 }],
];
const ANGE_FACES: [string, Partial<MoreDetailedCuteAngeProps>][] = [
  ["Grin (picture)", {}],
  ["Shy", { eyes: "half", mouth: "smile", blush: 1, look: [0, 2], tilt: 5 }],
  ["Talking", { mouthOpen: 0.8, brows: "raised" }],
  ["Wink", { eyesL: "happy", mouth: "smile", tilt: -4 }],
  ["Touched", { eyes: "happy", brows: "worried", mouth: "smile", blush: 0.6 }],
];

export const DanAngeSheet: React.FC = () => {
  const cell = (i: number) => 32 + i * 188;
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <svg width={1920} height={1080}>
        <defs>
          {Array.from({ length: 10 }, (_, i) => (
            <clipPath key={i} id={`bust${i}`}>
              <rect x={cell(i)} y={736} width={178} height={226} rx={18} />
            </clipPath>
          ))}
        </defs>
        <rect x={20} y={20} width={610} height={696} rx={28} fill="#fff" />
        <rect x={646} y={20} width={610} height={696} rx={28} fill="#fff" />
        <rect x={1272} y={20} width={628} height={696} rx={28} fill="#fff" />
        <rect x={20} y={726} width={1880} height={286} rx={28} fill="#fff" />
        <Chip x={40} y={40}>Your picture</Chip>
        <Chip x={666} y={40}>Rebuilt (moves)</Chip>
        <Chip x={1292} y={40}>Pose: wave + bouquet lift</Chip>
        <foreignObject x={36} y={96} width={578} height={610}>
          <Img src={ref} style={{ width: 578, height: 610, objectFit: "contain" }} />
        </foreignObject>
        <Pair cx={951} y={700} s={0.98} />
        {/* (smaller and a little right: his raised hello stays inside the panel) */}
        <Pair
          cx={1622}
          y={700}
          s={0.9}
          dan={{ armL: "wave", eyes: "happy", mouth: "grin", tilt: 6 }}
          ange={{ lift: 1, eyes: "happy", mouth: "grin", tilt: -6, blush: 0.5 }}
        />
        {[
          ...DAN_FACES.map(([n, p]) => ({ n, dan: p as Partial<MoreDetailedCuteDanProps> | undefined, ange: undefined })),
          ...ANGE_FACES.map(([n, p]) => ({ n, dan: undefined, ange: p as Partial<MoreDetailedCuteAngeProps> | undefined })),
        ].map((c, i) => {
          const cx = cell(i) + 89;
          const s = 0.8;
          // the head's middle (picture px) lands mid-cell
          const [hx, hy, feet] = c.dan ? [306, 236, DAN_FEET] : [860, 330, ANGE_FEET];
          const x = cx - (hx - feet) * K * s;
          const y = 830 + (1229 - hy) * K * s;
          return (
            <g key={i}>
              <rect x={cell(i)} y={736} width={178} height={226} rx={18} fill={i < 5 ? "#F4EEE6" : "#F1ECF4"} />
              <g clipPath={`url(#bust${i})`}>{c.dan ? <MoreDetailedCuteDan x={x} y={y} scale={s} {...c.dan} /> : <MoreDetailedCuteAnge x={x} y={y} scale={s} {...c.ange} />}</g>
              <Label x={cx} y={992}>
                {c.n}
              </Label>
            </g>
          );
        })}
        <rect y={1018} width={1920} height={62} fill={DARK} />
        <text x={40} y={1060} fontFamily={fontFamily} fontWeight={600} fontSize={32} fill="#fff">
          Dan &amp; Ange
        </text>
        <text x={1180} y={1057} textAnchor="middle" fontFamily={fontFamily} fontWeight={500} fontSize={22} fill="#ffffffcc">
          MoreDetailedCute Dan &amp; Ange · traced from your picture + rigged in SVG · test, for review
        </text>
      </svg>
    </AbsoluteFill>
  );
};

// 4.5s motion test: blink, look, talk (him, then her), his wave (danWave), her bouquet lift, and the heads lean in
// together at the end, the hair following every head move (a beat to settle at the end)
export const DanAngeTest: React.FC = () => {
  const f = useCurrentFrame();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const blink = (o: number) => (f + o) % 50 > 46;
  const talkD = f > 12 && f < 48 ? Math.max(0, Math.sin(f * 0.9)) : 0;
  const talkA = f > 50 && f < 84 ? Math.max(0, Math.sin(f * 0.85)) : 0;
  // the wave (danWave: raise f56-70, rock, down f92-108); his head tilts into it a few frames after the arm (overlap)
  const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const up = interpolate(f, [56, 70, 92, 108], [0, 1, 1, 0], ease);
  const upHead = (t: number) => interpolate(t, [59, 75, 95, 113], [0, 1, 1, 0], ease);
  const lift = interpolate(f, [30, 46, 60, 76], [0, 1, 1, 0], ease) + (f > 46 && f < 60 ? Math.sin((f - 46) * 0.45) * 0.12 : 0);
  const lean = (t: number) => interpolate(t, [96, 110], [0, 1], ease);
  const look: [number, number] = f < 12 ? [3, 0] : [0, 0];
  // the heads' tilts; the hair follows each one a beat late and swings past it (round 6: the hair is its own part).
  // She tips her head, happy, with the bouquet up
  const danTilt = (t: number) => lean(t) * 6 - upHead(t) * 4;
  const angeTilt = (t: number) => -lean(t) * 6 + interpolate(t, [44, 52, 62, 72], [0, 5, 5, 0], ease);
  const HAIR_GAIN = 1.6;
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <svg width={1080} height={1080}>
        {/* (room on the left for his wave: the elbow goes out to about his shoulder line) */}
        <Pair
          cx={600}
          y={1050}
          s={1.4}
          time={f}
          dan={{
            eyes: blink(0) ? "closed" : up > 0.6 || lean(f) > 0.5 ? "happy" : "open",
            mouthOpen: talkD,
            brows: talkD > 0 ? "raised" : "neutral",
            look,
            armL: danWave(f, 56, 22),
            tilt: danTilt(f),
            hair: springLag(danTilt, f) * HAIR_GAIN,
          }}
          ange={{
            eyes: blink(17) ? "closed" : lift > 0.6 || lean(f) > 0.5 ? "happy" : "open",
            mouthOpen: talkA,
            brows: talkA > 0 ? "raised" : "neutral",
            look,
            lift: Math.max(0, lift),
            tilt: angeTilt(f),
            hair: springLag(angeTilt, f) * HAIR_GAIN,
            blush: lean(f) * 0.6,
          }}
        />
      </svg>
    </AbsoluteFill>
  );
};

// rest pose check: the picture and the puppet at the same scale, face by face (the eyes, nose and mouth must land on
// the picture's), plus the neck and the hands
const CHECKS: { who: "dan" | "ange"; vb: [number, number, number, number] }[] = [
  { who: "dan", vb: [123, 222, 384, 216] },
  { who: "ange", vb: [684, 281, 352, 198] },
];
export const DanAngeFaceCheck: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BG }}>
    {CHECKS.map(({ who, vb }, row) =>
      [0, 1].map((col) => (
        <svg key={`${row}${col}`} viewBox={vb.join(" ")} width={960} height={540} style={{ position: "absolute", left: col * 960, top: row * 540 }}>
          <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="#fff" />
          {col === 0 ? (
            <foreignObject x={0} y={0} width={1216} height={1294}>
              <Img src={ref} style={{ width: 1216, height: 1294 }} />
            </foreignObject>
          ) : who === "dan" ? (
            <MoreDetailedCuteDan x={DAN_FEET} y={1229} scale={1 / K} />
          ) : (
            <MoreDetailedCuteAnge x={ANGE_FEET} y={1229} scale={1 / K} />
          )}
        </svg>
      )),
    )}
  </AbsoluteFill>
);
