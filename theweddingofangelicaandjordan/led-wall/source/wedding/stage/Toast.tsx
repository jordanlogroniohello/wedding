import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { DanArm } from "../MoreDetailedCuteDan";
import { angeGlassAt } from "../MoreDetailedCuteAnge";
import { danGlassAt } from "../MoreDetailedCuteDan";
import { Pair, pairPt } from "../Pair";
import { PAINTED_BOWL, PaintedCouple, paintedArmPt, type PaintedPose } from "../painted/PaintedCouple";
import { springLag } from "../tracedRig";

// The LED stage's key 1: a toast. Dan & Ange pop in over the monogram with a glass each, smile at each other, raise
// their glasses to the guests ("Cheers!" in gold, a sparkle burst), share a look, lower them and fade out. Transparent:
// the stage's monogram background shows through. 4:3 (the LED wall is about 12 x 9 ft). Drawn with the painted cut-outs
// of the user's toast picture (round 12); `traced` = the traced puppets it had before (ToastTraced, to compare).
export const TOAST = {
  width: 1440,
  height: 1080,
  fps: 30,
  durationInFrames: 200,
};

const GOLD = "#E8CFA0";
const CX = 720;
const FEET_Y = 1050;
const S = 1.32;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.inOut(Easing.cubic) };
const back = { ...clamp, easing: Easing.out(Easing.back(1.6)) };

// Dan's glass arm: hanging at his side, then up to shoulder height out to his side (the elbow stays by his side)
const REST: DanArm = [5, 2, 1, 0];
const TOAST_ARM: DanArm = [8, 150, 0.8, 0];
const mix = (a: DanArm, b: DanArm, t: number): DanArm =>
  [0, 1, 2, 3].map((i) => (a as number[])[i] + ((b as number[])[i] - (a as number[])[i]) * t) as DanArm;
// the painted picture on the stage: the pair's middle (x 659.5) on CX, their feet (y 1198) on FEET_Y, about as tall as
// the traced pair
const PS = 0.66;
const PX = CX - 659.5 * PS;
const PY = FEET_Y - 1198 * PS;
// the painted raise: Dan's glass up and a little out (the elbow turns, the forearm comes toward the guests), Ange's arm
// swinging up and out from the shoulder
const danRaise = (u: number): PaintedPose => ({
  armTurn: -3 * u,
  armGrow: 1 + 0.07 * u,
});
const angeRaise = (u: number): PaintedPose => ({
  armTurn: -5 * u,
  armGrow: 1 + 0.02 * u,
});
// a blink: half, shut, shut, half
const lidAt = (t: number) => [0.5, 1, 1, 0.5][(t % 70) - 66] ?? 0;

// a four-point sparkle
const Sparkle: React.FC<{
  x: number;
  y: number;
  r: number;
  rot: number;
  o: number;
}> = ({ x, y, r, rot, o }) => (
  <path
    transform={`translate(${x} ${y}) rotate(${rot}) scale(${r})`}
    d="M 0 -1 C 0.12 -0.12 0.12 -0.12 1 0 C 0.12 0.12 0.12 0.12 0 1 C -0.12 0.12 -0.12 0.12 -1 0 C -0.12 -0.12 -0.12 -0.12 0 -1 Z"
    fill="#FFF3D1"
    opacity={o}
  />
);

export const Toast: React.FC<{ traced?: boolean }> = ({ traced = false }) => {
  const f = useCurrentFrame();
  // in and out: a soft rise and fade
  const enter = interpolate(f, [0, 18], [0, 1], back);
  const exit = interpolate(f, [178, 198], [0, 1], ease);
  const op = Math.min(interpolate(f, [0, 12], [0, 1], clamp), 1 - exit);
  const rise = (1 - enter) * 60 + exit * 30;
  // the raise (f 40-58, a little overshoot) and the lower (f 140-158)
  const up = (t: number) => interpolate(t, [40, 56, 60, 140, 158], [0, 1.04, 1, 1, 0], ease);
  const u = up(f);
  // looks: at each other (f 20-38 and 108-136), at the guests otherwise
  const atEach = interpolate(f, [20, 28, 36, 40, 108, 114, 132, 138], [0, 1, 1, 0, 0, 1, 1, 0], ease);
  // the heads lean in when they look at each other, and bob with the cheer
  const cheer = interpolate(f, [56, 62, 98, 106], [0, 1, 1, 0], ease);
  const bob = (t: number) => (t > 58 && t < 106 ? Math.sin((t - 58) / 6) * 2.5 * Math.min(1, (106 - t) / 10) : 0);
  const danTilt = (t: number) => interpolate(t, [20, 28, 36, 40, 108, 114, 132, 138], [0, 1, 1, 0, 0, 1, 1, 0], ease) * 5 + bob(t);
  const angeTilt = (t: number) => -interpolate(t, [20, 28, 36, 40, 108, 114, 132, 138], [0, 1, 1, 0, 0, 1, 1, 0], ease) * 6 - bob(t + 3);
  const blink = (o: number) => (f + o) % 70 > 66;
  const happy = cheer > 0.5;
  const arm = mix(REST, TOAST_ARM, u);
  // the sparkles burst from Dan's raised glass and Ange's glass as they cheer (f 56-96)
  const onStage = (p: [number, number]): [number, number] => [PX + p[0] * PS, PY + p[1] * PS];
  const [ax, ay] = angeGlassAt(1.4);
  const gd = traced ? pairPt(danGlassAt(1, TOAST_ARM), CX, FEET_Y, S) : onStage(paintedArmPt("dan", PAINTED_BOWL.dan, danRaise(1)));
  const ga = traced ? pairPt([ax, ay - 70], CX, FEET_Y, S) : onStage(paintedArmPt("ange", PAINTED_BOWL.ange, angeRaise(1)));
  const burst = (t: number) =>
    interpolate(f, [56 + t, 92 + t], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
  const words = interpolate(f, [56, 70], [0, 1], back);
  const wordsOut = interpolate(f, [150, 170], [0, 1], ease);
  // the painted pair: the same beats, smaller turns (the cut-outs turn rigidly; the cut leaves room for about 4 degrees at
  // the neck)
  const squash = (o: number) => cheer * Math.max(0, Math.sin((f - o) / 6)) * 0.012;
  const painted = (
    <PaintedCouple
      x={PX}
      y={PY}
      scale={PS}
      dan={{
        ...danRaise(u),
        tilt: atEach * 3 + bob(f) * 0.5,
        lid: lidAt(f),
        happy,
        squash: squash(58),
        breath: Math.sin(f / 24),
      }}
      ange={{
        ...angeRaise(u),
        tilt: -atEach * 3 - bob(f + 3) * 0.5,
        lid: lidAt(f + 23),
        happy,
        squash: squash(61),
        breath: Math.sin((f + 9) / 24),
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: op, transform: `translateY(${rise}px)` }}>
      <svg width={TOAST.width} height={TOAST.height} style={{ position: "absolute", overflow: "visible" }}>
        {/* a soft pool of light under them */}
        <ellipse cx={CX} cy={FEET_Y - 6} rx={430} ry={46} fill="#FFF1C8" opacity={0.08} />
      </svg>
      {traced ? null : painted}
      <svg width={TOAST.width} height={TOAST.height} style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <radialGradient id="toastGlow">
            <stop offset={0} stopColor="#FFF1C8" stopOpacity={0.9} />
            <stop offset={1} stopColor="#FFF1C8" stopOpacity={0} />
          </radialGradient>
          <filter id="toastText" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation={10} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g>
          {traced && (
            <Pair
              cx={CX}
              y={FEET_Y}
              s={S}
              time={f}
              dan={{
                armR: arm,
                glass: 1,
                look: [atEach * 4, 0],
                tilt: danTilt(f),
                hair: springLag(danTilt, f) * 1.6,
                eyes: blink(0) ? "closed" : happy ? "happy" : "open",
                mouth: happy ? "wide" : "grin",
                squash: cheer * Math.max(0, Math.sin((f - 58) / 6)) * 0.012,
              }}
              ange={{
                hold: "glass",
                lift: u * 1.4,
                look: [-atEach * 4, 0],
                tilt: angeTilt(f),
                hair: springLag(angeTilt, f) * 1.6,
                eyes: blink(23) ? "closed" : happy ? "happy" : "open",
                mouth: happy ? "wide" : "grin",
                blush: Math.max(atEach, cheer) * 0.6,
                squash: cheer * Math.max(0, Math.sin((f - 61) / 6)) * 0.012,
              }}
            />
          )}
          {/* the cheer: a glow at each glass and sparkles flying out */}
          {[gd, ga].map(([x, y], gi) => {
            const b = burst(gi * 3);
            return (
              <g key={gi}>
                <circle cx={x} cy={y} r={40 + b * 90} fill="url(#toastGlow)" opacity={b > 0 && b < 1 ? (1 - b) * 0.9 : 0} />
                {Array.from({ length: 12 }, (_, i) => {
                  const a = ((i / 12) * 360 + gi * 15 - 90) * (Math.PI / 180);
                  const d = 30 + b * (150 + (i % 3) * 60);
                  return (
                    <Sparkle
                      key={i}
                      x={x + Math.cos(a) * d}
                      y={y + Math.sin(a) * d * 0.9 - b * 30}
                      r={(20 + (i % 3) * 9) * (1 - b * 0.5)}
                      rot={b * 90}
                      o={b > 0 ? 1 - b * b : 0}
                    />
                  );
                })}
              </g>
            );
          })}
          <text
            x={CX}
            y={190}
            textAnchor="middle"
            fontFamily="Italianno, cursive"
            fontSize={190}
            fill={GOLD}
            filter="url(#toastText)"
            opacity={words * (1 - wordsOut)}
            transform={`translate(${CX} 150) scale(${0.6 + words * 0.4}) translate(${-CX} -150)`}
          >
            Cheers!
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
