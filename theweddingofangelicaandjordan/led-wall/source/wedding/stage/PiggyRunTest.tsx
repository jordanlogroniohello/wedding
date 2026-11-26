import { AbsoluteFill, useCurrentFrame } from "remotion";
import { PIGGY_GROUND, PIGGY_SPEED, PIGGY_STRIDE, PiggyRun, piggyBob } from "../painted/PiggyRun";

// The piggyback run on its own (round 19), for judging the rig before it goes on the stage (key 2): running on the spot
// over a dark ground, the ground's dashes going by at the feet's speed, a soft shadow that shrinks as they rise.
export const PIGGY_TEST = { width: 1440, height: 1080, fps: 30, durationInFrames: 4 * PIGGY_STRIDE * 2 };
const S = 0.72;
const GROUND_Y = 1040;
const X = 720 - 560 * S;
const Y = GROUND_Y - PIGGY_GROUND * S;

export const PiggyRunTest: React.FC<{ frame?: number }> = ({ frame }) => {
  const now = useCurrentFrame();
  const f = frame ?? now;
  const lift = -piggyBob(f / PIGGY_STRIDE);
  const step = PIGGY_SPEED * S;
  return (
    <AbsoluteFill style={{ background: "#0d2818" }}>
      <svg width={1440} height={1080} style={{ position: "absolute" }}>
        <defs>
          <filter id="soft" x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
        </defs>
        <ellipse cx={720 + 40 * S} cy={GROUND_Y + 4} rx={(200 - lift * 2) * S * 1.3} ry={16} fill="#000" opacity={0.35} filter="url(#soft)" />
        {Array.from({ length: 12 }, (_, k) => {
          const x = ((((k * 150 - f * step) % 1800) + 1800) % 1800) - 180;
          return <line key={k} x1={x} y1={GROUND_Y + 22} x2={x + 70} y2={GROUND_Y + 22} stroke="#3c5c34" strokeWidth={4} strokeLinecap="round" />;
        })}
      </svg>
      <PiggyRun x={X} y={Y} scale={S} frame={f} />
    </AbsoluteFill>
  );
};
