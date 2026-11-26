import { useEffect, useRef } from "react";
import { bannerFonts, bannerReach, drawBanner, makeBanner, type BannerArt } from "./banner";
import type { RunnerSpec } from "./Piggyback";
import { asTheme } from "./theme";

// A scene that runs across the whole screen (round 21: the piggyback run came in from the stage's 4:3 box's edge, not the
// screen's): a full-screen canvas, the stride's strip (scenes/<id>.webp, its frames stacked top to bottom) drawn a third
// of the screen's height tall on the ground near the bottom, from just past the left edge to just past the right, at the
// feet's own speed (moving a frame's worth each frame, so a planted foot stays put), and a puff of dust where each heel
// lands, left behind on the ground. Any screen shape; `onEnd` once they're gone, `onFail` if there's no strip.
// Round 40 (2026-11-26, the user: "non stop to unless pindutin ulit yung no.1 or other keys, like from left to right then
// balik right to left and so on"; the way back mirrored: "kahit mirror nalang siguro"): `loop` = once they're gone off
// the right they come back from the right, running left (the strip, the dust and the hand mirrored round the screen's
// middle), then right again, until the stage stops it. `banner` = its lines on a cloth banner flying behind them on a
// string from the strip's `hand` (banner.ts), never mirrored; a pass ends when the banner's tail is gone too.
const HEIGHT = 1 / 3; // the figure, of the screen's height
const GROUND = 0.96; // the ground, down the screen
const TURN = 0.5; // s off screen between the passes (they turn round)

export const Runner: React.FC<{
  id: string;
  spec: RunnerSpec;
  onEnd: () => void;
  onFail: () => void;
  loop?: boolean;
  banner?: string[];
}> = ({ id, spec, onEnd, onFail, loop = false, banner }) => {
  const { dust } = spec;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    let raf = 0;
    let start = 0;
    let passStart = 0;
    let pass = 0;
    let done = false;
    // the banner's picture, made once per direction (its rod at the front) + colours + screen height
    const hands = banner?.length ? spec.hand : undefined;
    const rest = hands ? [0, 1].map((c) => hands.reduce((a, p) => a + p[c], 0) / hands.length) : null;
    const arts = new Map<string, BannerArt>();
    const artFor = (dir: 1 | -1, U: number, dpr: number) => {
      const theme = asTheme(document.body.dataset.theme) ?? "green";
      const key = `${theme} ${dir} ${U} ${dpr}`;
      let art = arts.get(key);
      if (!art) {
        if (arts.size > 6) arts.clear();
        art = makeBanner(banner!, theme, U, dir, dpr);
        arts.set(key, art);
      }
      return art;
    };
    const draw = (now: number) => {
      if (done) return;
      if (!start) start = passStart = now;
      const dpr = window.devicePixelRatio || 1;
      const [w, h] = [window.innerWidth, window.innerHeight];
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      raf = requestAnimationFrame(draw);
      // (turning round, off screen)
      if (now < passStart) return;
      const f = Math.floor(((now - passStart) / 1000) * spec.fps);
      const dir: 1 | -1 = pass % 2 === 0 ? 1 : -1;
      // (the frame, the pass and where they are, for checking from the console)
      (window as unknown as { stageRunner?: object }).stageRunner = { f, pass, dir, ms: Math.round(now - passStart) };
      // strip px -> screen px; everything worked out running right, the way back mirrored round the screen's middle
      const k = (HEIGHT * h) / spec.figureH;
      const ground = GROUND * h;
      const top = ground - spec.groundY * k;
      const x0 = -spec.right * k;
      const xAt = (frame: number) => x0 + spec.speed * k * frame;
      const x = xAt(f);
      const art = hands && rest ? artFor(dir, h, dpr) : null;
      const behind = art && rest ? rest[0] * k - bannerReach(art, h) : spec.left * k;
      if (x + behind > w) {
        if (!loop) {
          done = true;
          cancelAnimationFrame(raf);
          onEnd();
          return;
        }
        pass++;
        passStart = now + TURN * 1000;
        return;
      }
      const sx = (X: number) => (dir > 0 ? X : w - X);
      const mirror = () => {
        if (dir < 0) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
      };
      // the dust where the heels landed (one every half stride, near leg first), behind them
      ctx.save();
      mirror();
      const half = spec.frames / 2;
      ctx.fillStyle = dust.color;
      for (let n = Math.max(0, Math.floor((f - dust.frames) / half)); n * half <= f; n++) {
        const t = (f - n * half) / dust.frames;
        if (t > 1) continue;
        const at = xAt(n * half) + spec.heels[n % 2] * k;
        for (const d of dust.at(t)) {
          ctx.globalAlpha = d.o;
          ctx.beginPath();
          ctx.arc(at + d.dx * spec.scale * k, ground + d.dy * spec.scale * k, d.r * spec.scale * k, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
      // the banner behind them, its string to her fist (the fist drawn over the string's end)
      if (art && hands && rest) {
        const fist = hands[f % spec.frames];
        drawBanner(ctx, art, [sx(x + fist[0] * k), top + fist[1] * k], [sx(x + rest[0] * k), top + rest[1] * k], dir, (now - start) / 1000, h);
      }
      ctx.save();
      mirror();
      const fw = img.naturalWidth;
      const fh = img.naturalHeight / spec.frames;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, (f % spec.frames) * fh, fw, fh, x, top, fw * k, fh * k);
      ctx.restore();
    };
    img.onerror = onFail;
    img.src = `scenes/${id}.webp`;
    // (once the strip is in, and the page's fonts for the banner's letters)
    void Promise.all([img.decode().catch(() => null), hands ? bannerFonts() : null]).then(() => {
      if (!done && img.naturalWidth) raf = requestAnimationFrame(draw);
    });
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};
