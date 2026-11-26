import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LOOKS, startBokeh, type Look } from "./bokeh";
import { mountMonogram, type Monogram } from "./monogram";
import { Runner } from "./Runner";
import { startPeeks, TEST_KEYS } from "./peek";
import { asTheme, THEMES, type Theme } from "./theme";
import { SCENES } from "./scenes";

// the idle screen (2026-11-16): the monogram written on as SVG (monogram.ts) + the bokeh on the GPU (bokeh.ts, PixiJS;
// index.html's canvas version only when WebGL can't start). R = write the monogram again.
const w = window as unknown as { __stageReady?: boolean; startCanvasBokeh?: () => void };
w.__stageReady = true;
let mono: Monogram | null = null;
let fx: Awaited<ReturnType<typeof startBokeh>> | null = null;
try {
  mono = mountMonogram(document.querySelector<HTMLElement>(".monogram")!, {
    written: () => document.body.classList.add("written"),
    unwritten: () => document.body.classList.remove("written"),
    heart: (x, y) => fx?.burst(x, y),
  });
} catch (e) {
  console.error("monogram", e);
  document.body.classList.add("written");
}
// the look (round 26): L switches bokeh / bokeh + sparkle + flare / sparkle + flare, or set in the address:
// index.html?look=flare. Round 30 (2026-11-25, the user picked "boke with flare"): every run opens on "sparkle" (the bokeh +
// sparkle + flare); L changes it for that run only, never remembered (the DJ's computer always starts on the pick)
const asLook = (v: string | null) => (LOOKS as readonly string[]).includes(v ?? "") ? (v as Look) : null;
let look: Look = asLook(new URLSearchParams(location.search).get("look")) ?? "sparkle";
// (round 39, the user: "dont show the … sa lahat ng keys every press tanggalin mo yun pangit pag lumalabas at makita ng
// audience yun": no key puts a word on the screen any more (the look's, the colours', P's, the peeks' names); H's list
// is the one place that says what the keys do)
// the colours (round 32, 2026-11-25: "press S to switch version … white backgroun or beige then green the monogram"): S
// goes round gold on green / sage on beige / sage on white (theme.ts), or ?theme=beige in the address. The page cross-fades
// (index.html), the bokeh + the monogram's glow fade out, change, and come back
let theme: Theme = asTheme(new URLSearchParams(location.search).get("theme")) ?? "green";
const applyTheme = () => {
  document.body.dataset.theme = theme;
  mono?.setTheme(theme);
  fx?.setTheme(theme);
};
applyTheme();
let switchTimer = 0;
const nextTheme = () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  document.body.classList.add("switching");
  clearTimeout(switchTimer);
  switchTimer = window.setTimeout(() => {
    applyTheme();
    switchTimer = window.setTimeout(() => document.body.classList.remove("switching"), 250);
  }, 400);
};
startBokeh(document.getElementById("pBack") as HTMLCanvasElement, document.getElementById("pFront") as HTMLCanvasElement, () => mono?.pens ?? [], (u) => mono?.inkAt(u) ?? null)
  .then((b) => { fx = b; b.setLook(look); b.setTheme(theme); })
  .catch((e) => { console.error("PixiJS bokeh, using the canvas one", e); w.startCanvasBokeh?.(); });
// the couple peeking in now and then (round 34, peek.ts): P turns them off / on. Round 36: what they send over the
// monogram (the flying kiss's hearts, the cupid's arrow) goes in #peekFx; the BOOM = the bokeh's own heart burst + the
// monogram's heart thumping. Round 38: the stolen heart takes the monogram's heart away for a while (and puts it back)
const peeks = startPeeks(document.getElementById("peeks")!, document.getElementById("peekFx")!, {
  boom: (x, y) => fx?.burst(x, y),
  pulse: (s) => mono?.pulse(s),
  heart: (on) => mono?.showHeart(on),
});
(window as unknown as { stagePeek?: typeof peeks.test }).stagePeek = peeks.test;
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.repeat) return;
  if (k === "r") mono?.replay();
  else if (k === "l" && fx) {
    look = LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length];
    fx.setLook(look);
  } else if (k === "s") nextTheme();
  else if (k === "p") peeks.toggle();
  // (round 38: a letter = test that peek now; round 39: 0 = all of them non-stop, 9 = stop them all; the list in H)
  else if (!e.metaKey && !e.ctrlKey && !e.altKey) peeks.hotkey(k);
});

// The LED stage: the monogram page (index.html) idles; a number key plays that scene over it (the monogram dims), then
// it goes back to the monogram (a scene with `dim: false` plays over it undimmed). Esc stops a scene, F = full screen, H = the key list. A scene plays its rendered video
// (transparent WebM, scenes/<id>.webm), or a runner runs its strip across the whole screen (Runner.tsx); without one it's
// drawn live (the Player: too heavy for a smooth 30 fps)
const Stage: React.FC = () => {
  const [scene, setScene] = useState<string | null>(null);
  const [run, setRun] = useState(0); // the same key again restarts the scene
  const [live, setLive] = useState<Record<string, boolean>>({}); // the scenes with no video
  const ref = useRef<PlayerRef>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") setScene(null);
      else if (k === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      } else if (k === "h" || k === "?") document.body.classList.toggle("help");
      else if (SCENES[k]) {
        setScene(k);
        setRun((r) => r + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("playing", scene !== null && SCENES[scene].dim);
  }, [scene]);
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    // (the playing frame, for checking the playback speed from the console)
    (window as unknown as { stageFrame?: () => number }).stageFrame = () => p.getCurrentFrame();
    const end = () => setScene(null);
    p.addEventListener("ended", end);
    return () => p.removeEventListener("ended", end);
  }, [scene, run]);
  if (!scene) return null;
  const s = SCENES[scene];
  const fail = () => setLive((l) => ({ ...l, [s.id]: true }));
  if (s.runner && !live[s.id]) return <Runner key={run} id={s.id} spec={s.runner} onEnd={() => setScene(null)} onFail={fail} />;
  // (a wide scene: the screen's whole width, along its bottom, not in the 4:3 box)
  const box: React.CSSProperties | undefined =
    s.fit === "bottom" ? { position: "absolute", left: 0, bottom: 0, width: "100vw", aspectRatio: `${s.width} / ${s.height}` } : undefined;
  if (!live[s.id])
    return (
      <div className="frame" style={box}>
        <video
          key={run}
          src={`scenes/${s.id}.webm`}
          autoPlay
          muted
          playsInline
          onEnded={() => setScene(null)}
          onError={fail}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
    );
  return (
    <div className="frame" style={box}>
      <Player
        key={run}
        ref={ref}
        component={s.component}
        durationInFrames={s.durationInFrames}
        fps={s.fps}
        compositionWidth={s.width}
        compositionHeight={s.height}
        autoPlay
        controls={false}
        style={{ width: "100%", height: "100%" }}
        acknowledgeRemotionLicense
      />
    </div>
  );
};

const help = document.getElementById("help");
// the last line = the screen's size + shape, so the DJ / the LED team can see the output is 4:3 like the 9x12 ft wall (round 31)
const screenLine = () => {
  const w = innerWidth, h = innerHeight, r = w / h;
  const shape = Math.abs(r - 4 / 3) < 0.03 ? "4:3, the wall's shape" : Math.abs(r - 16 / 9) < 0.03 ? "16:9, the wall is 4:3" : `${r.toFixed(2)}:1, the wall is 4:3`;
  return `<span style="opacity:.7">screen ${w} × ${h} (${shape})</span>`;
};
// (the test keys, a few to a line: "<b>W</b> wink · <b>G</b> giggle …")
const peekKeys = () => {
  const all = [...TEST_KEYS.map((t) => `<b>${t.key.toUpperCase()}</b> ${t.label.toLowerCase()}`), "<b>0</b> all of them, non-stop", "<b>9</b> stop them all"];
  const lines = ["<span style=\"opacity:.7\">test a peek now (again = the next one / edge):</span>"];
  for (let i = 0; i < all.length; i += 4) lines.push(all.slice(i, i + 4).join(" &nbsp;·&nbsp; "));
  return lines;
};
const fillHelp = () => {
  if (help) help.innerHTML = [...Object.entries(SCENES).map(([k, s]) => `<b>${k}</b> &nbsp;${s.name}`), "<b>Esc</b> &nbsp;back to the monogram", "<b>R</b> &nbsp;write the monogram again", "<b>L</b> &nbsp;the look: bokeh / + sparkle + flare / sparkle + flare", "<b>S</b> &nbsp;the colours: gold on green / sage on beige / sage on white", "<b>P</b> &nbsp;the faces peeking in: on / off", ...peekKeys(), "<b>F</b> &nbsp;full screen", "<b>H</b> &nbsp;this list", screenLine()].join("<br>");
};
fillHelp();
addEventListener("resize", fillHelp);
createRoot(document.getElementById("scene")!).render(<Stage />);
