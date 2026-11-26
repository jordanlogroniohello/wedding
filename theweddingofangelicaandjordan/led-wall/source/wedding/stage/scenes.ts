import type { ComponentType } from "react";
import list from "./scenes.json";
import { Piggyback, PIGGY_RUNNER, PIGGYBACK, type RunnerSpec } from "./Piggyback";

// the LED stage's scenes, by key: scenes.json (key, composition id, name; build.mjs --render reads it too), each a
// transparent 4:3 composition (also in src/wedding/Root.tsx). The stage plays its rendered video (scenes/<id>.webm,
// smooth on any machine); without one it draws the scene live (the Player). `dim: false`: the monogram stays up under it
// (a scene that only crosses the bottom, like the piggyback run). `runner`: it runs across the whole screen instead
// (Runner.tsx), from its stride's strip (scenes/<id>.webp, rendered from scenes.json's `strip` composition). `fit:
// "bottom"`: a wide scene (not 4:3) shown across the screen's whole width, along its bottom (the candles, round 23; facing
// the front, round 24). Round 39 (2026-11-26, the user: "remove the wine toasting, and cake blowing 1 and 3 keys"): the
// toast (key 1) and the candles (key 3) are off the stage; their compositions stay in Root.tsx. To bring one back: its
// line in scenes.json + its import and COMPS entry here (Toast / CandlesFront, as before). Round 40 (2026-11-26): the
// piggyback run on key 1; `loop`: it runs back and forth until its key again or any other key (main.tsx); `banner`: the
// lines of the thank-you banner it flies (banner.ts)
export type Scene = {
  id: string;
  name: string;
  dim: boolean;
  fit?: "bottom";
  component: ComponentType;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  runner?: RunnerSpec;
  loop?: boolean;
  banner?: string[];
};
const COMPS: Record<string, Omit<Scene, "id" | "name" | "dim">> = {
  Piggyback: { component: Piggyback, ...PIGGYBACK, runner: PIGGY_RUNNER },
};
export const SCENES: Record<string, Scene> = Object.fromEntries(
  list.map((s: { key: string; id: string; name: string; dim?: boolean; fit?: string; loop?: boolean; banner?: string[] }) => [
    s.key,
    { ...COMPS[s.id], id: s.id, name: s.name, dim: s.dim !== false, fit: s.fit === "bottom" ? "bottom" : undefined, loop: s.loop === true, banner: s.banner },
  ]),
);
