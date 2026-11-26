import { MoreDetailedCuteAnge, type MoreDetailedCuteAngeProps } from "./MoreDetailedCuteAnge";
import { MoreDetailedCuteDan, type MoreDetailedCuteDanProps } from "./MoreDetailedCuteDan";

export const K = 0.5; // the puppets' own scale (picture px -> screen at scale 1)
export const PAIR_MID = 638.5; // the middle of the pair in the picture (x)
export const DAN_FEET = 306;
export const ANGE_FEET = 853;
// a picture point (either of them, as they stand in the picture) to the screen, for a pair centred on cx with its feet on y
export const pairPt = (p: [number, number], cx: number, y: number, s: number): [number, number] => [
  cx + (p[0] - PAIR_MID) * K * s,
  y + (p[1] - 1229) * K * s,
];

// the pair standing as in the picture, centred on cx
export const Pair: React.FC<{ cx: number; y: number; s: number; dan?: Partial<MoreDetailedCuteDanProps>; ange?: Partial<MoreDetailedCuteAngeProps>; time?: number }> = ({ cx, y, s, dan, ange, time }) => (
  <g>
    <MoreDetailedCuteDan x={cx + (DAN_FEET - PAIR_MID) * K * s} y={y} scale={s} time={time} {...dan} />
    <MoreDetailedCuteAnge x={cx + (ANGE_FEET - PAIR_MID) * K * s} y={y} scale={s} time={time} {...ange} />
  </g>
);
