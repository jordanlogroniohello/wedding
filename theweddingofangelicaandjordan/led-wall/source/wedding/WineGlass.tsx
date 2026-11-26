// A wine glass of sparkling wine (gold, for the wedding's palette), drawn in code in the puppets' picture px. Its origin
// is the middle of the stem, where a hand holds it: the bowl above, the foot below. Upright on screen whatever holds it
// (`turn` undoes the holder's rotation). Bubbles rise when `time` is given.
import type { V } from "./tracedRig";

const INK = "#2A211C";
const WINE = ["#F6DC92", "#E2B65A"];
// the bowl: rim y, bottom y and half widths (tulip: widest a little under the rim)
const RIM = -98;
const BOT = -34;
const RW = 27;
const FOOT = 32;

const bowl = `M ${-RW} ${RIM} C ${-RW - 4} ${RIM + 30} ${-22} ${BOT - 2} 0 ${BOT} C 22 ${BOT - 2} ${RW + 4} ${RIM + 30} ${RW} ${RIM} Z`;
// the wine: the bowl below `top`
const wineTop = RIM + 22;

export const WineGlass: React.FC<{ at: V; turn?: number; time?: number; id: string; fill?: number; xray?: string }> = ({ at, turn = 0, time, id, fill = 1, xray }) => {
  const top = BOT - (BOT - wineTop) * fill;
  const bub = time === undefined ? [] : [0, 1, 2, 3].map((i) => ((time * 0.9 + i * 13) % 40) / 40);
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${-turn})`}>
      {xray ? (
        <g fill={xray}>
          <path d={bowl} />
          <rect x={-3} y={BOT} width={6} height={FOOT - BOT} />
          <ellipse cx={0} cy={FOOT} rx={22} ry={6} />
        </g>
      ) : (
        <>
          <defs>
            <clipPath id={`${id}bowl`}>
              <path d={bowl} />
            </clipPath>
            <linearGradient id={`${id}wine`} x1={0} y1={top} x2={0} y2={BOT} gradientUnits="userSpaceOnUse">
              <stop offset={0} stopColor={WINE[0]} />
              <stop offset={1} stopColor={WINE[1]} />
            </linearGradient>
          </defs>
          {/* the foot and stem (outlined as one), then the bowl: the glass a pale tint, the wine, its surface, bubbles */}
          <g stroke={INK} strokeWidth={3} strokeLinejoin="round">
            <ellipse cx={0} cy={FOOT} rx={22} ry={6} fill="#F4F1EC" />
            <rect x={-3} y={BOT - 2} width={6} height={FOOT - BOT - 2} rx={3} fill="#F4F1EC" />
          </g>
          <path d={bowl} fill="#FFFFFF" fillOpacity={0.35} />
          <g clipPath={`url(#${id}bowl)`}>
            <rect x={-RW - 6} y={top} width={RW * 2 + 12} height={BOT - top + 2} fill={`url(#${id}wine)`} />
            <ellipse cx={0} cy={top} rx={RW + 2} ry={4} fill="#FBEBC0" />
            {bub.map((b, i) => (
              <circle key={i} cx={[-9, 6, -2, 11][i]} cy={BOT - 4 - b * (BOT - 4 - top)} r={1.8} fill="#FFF8E4" opacity={1 - b * 0.6} />
            ))}
          </g>
          <path d={bowl} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          {/* a highlight down the bowl's left side */}
          <path d={`M ${-RW + 7} ${RIM + 8} C ${-RW + 5} ${RIM + 26} ${-RW + 8} ${RIM + 40} ${-RW + 14} ${RIM + 50}`} fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" opacity={0.85} />
        </>
      )}
    </g>
  );
};
