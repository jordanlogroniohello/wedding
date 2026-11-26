import { AbsoluteFill } from "remotion";
import { Pair } from "../Pair";
import type { DanArm } from "../MoreDetailedCuteDan";

// a work sheet for the toast's raised glass: Dan's arm angles side by side (and Ange's glass, lifted)
const ARMS: DanArm[] = [
  [8, 150, 0.8, 0],
  [8, 128, 0.75, 0],
  [8, 134, 0.65, 0],
  [7, 138, 0.6, 0],
];
export const ToastPoses: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0d2818" }}>
    <svg width={1920} height={1080}>
      {ARMS.map((a, i) => (
        <Pair key={i} cx={260 + i * 470} y={1040} s={0.95} dan={{ armR: a, glass: 1 }} ange={{ hold: "glass", lift: 1.4 }} />
      ))}
    </svg>
  </AbsoluteFill>
);
