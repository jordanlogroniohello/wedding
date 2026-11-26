import type { ReactNode } from "react";
import cast from "../characters/cast.json";
import { HAND_KEYS, HAND_LIMITS, handCheckOn } from "../characters/kukki-miru/CuteV3Critter";
import { RuleLog, ruleCheckOn, rulePart, ruleRoot, RuleStyle, type RulePart } from "../characters/kukki-miru/ruleCheck";
import type { V } from "./tracedRig";

// The Dan & Ange puppets in the project's checkers (wedding test, round 2, 2026-10-25: "did you run motion check? hand
// check"): scripts/motion-sheet.py and scripts/hand-check.py read the v3 rig's X-ray (`handCheck`: arms and paws one
// flat key colour each; `ruleCheck`: every part one key, plus the rig's log of its points). Dan & Ange are in the cast
// (src/characters/cast.json; 2026-10-26, the user: "go make dan & ange as their own characters. (human)"): each logs its
// own name and paints its X-ray in its colour set (the X-ray has two: Dan wears Kukki's, Ange Miru's), and the reports
// name them, in a human's words and with a human's WING rule. Off (every normal render) nothing here draws or logs. The
// wedding renders are run through them by src/wedding/trace/checks.sh.
export type Who = "dan" | "ange";
const slotOf = (who: Who) => cast.cast[who].slot as "kukki" | "miru";
export const checkOn = () => ({ rule: ruleCheckOn(), hand: handCheckOn() || ruleCheckOn() });
// the arm's key: natural, or folded past the hand check's limit (as CuteV3Critter paints a folded elbow)
export const xrayKeys = (who: Who, fold = 0) => ({ arm: HAND_KEYS[slotOf(who)].arm[fold > HAND_LIMITS.fold ? 2 : 0], paw: HAND_KEYS[slotOf(who)].paw });
export const FLAT_PROP = "#808080"; // a held prop in the X-ray: no key's hue (like the checker's blanket)

export const part = (on: boolean, k: RulePart, node: ReactNode) => (on ? rulePart(k, node) : node);

// the character's root group in the X-ray, its style, and its log (points in picture space, measured on screen)
export const CheckRoot: React.FC<{ who: Who; uid: string; on: boolean; children: ReactNode }> = ({ who, uid, on, children }) =>
  on ? (
    <g {...ruleRoot(slotOf(who), uid)}>
      <RuleStyle />
      {children}
    </g>
  ) : (
    <>{children}</>
  );

export const CheckLog: React.FC<{
  who: Who;
  uid: string;
  info: Record<string, unknown>;
  feet: V;
  unit: number; // picture px per 100 character units (the arm ~106 units, like Kukki and Miru's)
  pts: Record<string, V>;
  headT: string;
  hpts: Record<string, V>;
}> = ({ who, uid, info, feet, unit, pts, headT, hpts }) => (
  <RuleLog who={who} uid={uid} info={info} pts={{ o: feet, up: [feet[0], feet[1] - unit], ...pts }} headT={headT} hpts={hpts} />
);
