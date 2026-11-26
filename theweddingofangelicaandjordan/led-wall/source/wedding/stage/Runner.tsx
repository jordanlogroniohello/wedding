import { useEffect, useRef } from "react";
import type { RunnerSpec } from "./Piggyback";

// A scene that runs across the whole screen (round 21: the piggyback run came in from the stage's 4:3 box's edge, not the
// screen's): a full-screen canvas, the stride's strip (scenes/<id>.webp, its frames stacked top to bottom) drawn a third
// of the screen's height tall on the ground near the bottom, from just past the left edge to just past the right, at the
// feet's own speed (moving a frame's worth each frame, so a planted foot stays put), and a puff of dust where each heel
// lands, left behind on the ground. Any screen shape; `onEnd` once they're gone, `onFail` if there's no strip.
const HEIGHT = 1 / 3; // the figure, of the screen's height
const GROUND = 0.96; // the ground, down the screen

export const Runner: React.FC<{
  id: string;
  spec: RunnerSpec;
  onEnd: () => void;
  onFail: () => void;
}> = ({ id, spec, onEnd, onFail }) => {
  const { dust } = spec;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    let raf = 0;
    let start = 0;
    let done = false;
    const draw = (now: number) => {
      if (done) return;
      if (!start) start = now;
      const f = Math.floor(((now - start) / 1000) * spec.fps);
      // (the frame and where they are, for checking the speed from the console)
      (window as unknown as { stageRunner?: object }).stageRunner = { f, ms: Math.round(now - start) };
      const dpr = window.devicePixelRatio || 1;
      const [w, h] = [window.innerWidth, window.innerHeight];
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      // strip px -> screen px
      const k = (HEIGHT * h) / spec.figureH;
      const ground = GROUND * h;
      const x0 = -spec.right * k;
      const xAt = (frame: number) => x0 + spec.speed * k * frame;
      const x = xAt(f);
      if (x + spec.left * k > w) {
        done = true;
        onEnd();
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // the dust where the heels landed (one every half stride, near leg first), behind them
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
      ctx.globalAlpha = 1;
      const fw = img.naturalWidth;
      const fh = img.naturalHeight / spec.frames;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, (f % spec.frames) * fh, fw, fh, x, ground - spec.groundY * k, fw * k, fh * k);
      raf = requestAnimationFrame(draw);
    };
    img.onload = () => {
      raf = requestAnimationFrame(draw);
    };
    img.onerror = onFail;
    img.src = `scenes/${id}.webp`;
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};
