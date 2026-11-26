// Builds the LED stage into out/wedding/stage/ (open its index.html in Chrome, press F for full screen):
//   node src/wedding/stage/build.mjs            the page (scenes without a video play live)
//   node src/wedding/stage/build.mjs --render   ...and renders every scene to a transparent video (scenes/<id>.webm)
//   node src/wedding/stage/build.mjs --render --only=Piggyback   ...only those scenes (ids, comma-separated)
//   node src/wedding/stage/build.mjs --dj   ...and the offline package for the DJ (round 30, 2026-11-25: "i also need an
//     offline version … ipapasa ko sa dj and let them play it sa led wall"): out/wedding/led-wall-dj/ (the stage + a
//     README) and led-wall-dj.zip beside it. Everything is local already (the script, the pictures, the scenes, the
//     fonts as data inside the page); the build checks the page names no web address it would load
// a scene with a `strip` (a runner: it runs across the whole screen, Runner.tsx) gets that composition's frames instead,
// stacked top to bottom into one transparent picture (scenes/<id>.webp)
// the scenes (esbuild, one script), the monogram page with its fonts embedded (Chrome won't load fonts from file://;
// downloaded once into out/wedding/stage-fonts/), and the monogram's pictures copied from the wedding folder
// (WEDDING_DIR, default ~/wedding)
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const here = import.meta.dirname;
const root = path.resolve(here, "../../..");
const out = path.join(root, "out/wedding/stage");
const fontDir = path.join(root, "out/wedding/stage-fonts");
const wedding = process.env.WEDDING_DIR ?? path.join(os.homedir(), "wedding");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(fontDir, { recursive: true });

await build({
  entryPoints: [path.join(here, "main.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome110",
  minify: true,
  jsx: "automatic",
  outfile: path.join(out, "stage.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".png": "dataurl" },
  logLevel: "warning",
});

// the fonts: the monogram page's Cormorant Garamond (both styles, variable weight) and Italianno, latin; Jost (variable,
// OFL) for the date since round 30
const italianno = (await import("@remotion/google-fonts/Italianno")).getInfo().fonts;
const cormorant = (await import("@remotion/google-fonts/CormorantGaramond")).getInfo().fonts;
const jost = (await import("@remotion/google-fonts/Jost")).getInfo().fonts;
const FONTS = [
  { family: "Jost", style: "normal", weight: "100 900", url: jost.normal["300"].latin },
  { family: "Italianno", style: "normal", weight: "400", url: italianno.normal["400"].latin },
  { family: "Cormorant Garamond", style: "normal", weight: "300 700", url: cormorant.normal["400"].latin },
  { family: "Cormorant Garamond", style: "italic", weight: "300 700", url: cormorant.italic["400"].latin },
];
let css = "";
for (const f of FONTS) {
  const file = path.join(fontDir, path.basename(new URL(f.url).pathname));
  if (!fs.existsSync(file)) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`font download failed: ${f.url} (${res.status})`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const b64 = fs.readFileSync(file).toString("base64");
  css += `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
}
const html = fs.readFileSync(path.join(here, "index.html"), "utf8").replace("/*FONTS*/", css);
fs.writeFileSync(path.join(out, "index.html"), html);

for (const [from, to] of [
  ["theweddingofangelicaandjordan/monogram.png", "monogram.png"],
  ["floral-top-left.png", "floral-top-left.png"],
]) fs.copyFileSync(path.join(wedding, from), path.join(out, to));

// the scenes' videos: VP9 with alpha (the monogram shows through), one render at a time
if (process.argv.includes("--render")) {
  fs.mkdirSync(path.join(out, "scenes"), { recursive: true });
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  for (const { id, strip } of JSON.parse(fs.readFileSync(path.join(here, "scenes.json"), "utf8"))) {
    if (only && !only.includes(id)) continue;
    if (strip) {
      const frames = fs.mkdtempSync(path.join(os.tmpdir(), `strip-${id}-`));
      execFileSync("npx", ["remotion", "render", "src/wedding/index.ts", strip, frames, "--sequence", "--image-format=png", "--log=error"], { cwd: root, stdio: "inherit" });
      const pngs = fs.readdirSync(frames).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(frames, f));
      const { default: sharp } = await import("sharp");
      const { width, height } = await sharp(pngs[0]).metadata();
      const file = path.join(out, "scenes", `${id}.webp`);
      await sharp({ create: { width, height: height * pngs.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(pngs.map((input, i) => ({ input, left: 0, top: i * height })))
        .webp({ quality: 92, alphaQuality: 100, effort: 6 })
        .toFile(file);
      fs.rmSync(frames, { recursive: true });
      console.log(`scene ${id}: ${file} (${pngs.length} frames of ${width} x ${height}, ${Math.round(fs.statSync(file).size / 1024)} KB)`);
      continue;
    }
    const file = path.join(out, "scenes", `${id}.webm`);
    execFileSync("npx", ["remotion", "render", "src/wedding/index.ts", id, file, "--codec=vp9", "--image-format=png", "--pixel-format=yuva420p", "--log=error"], { cwd: root, stdio: "inherit" });
    console.log(`scene ${id}: ${file} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
}

const kb = (f) => Math.round(fs.statSync(path.join(out, f)).size / 1024);
console.log(`stage: ${path.join(out, "index.html")} (page ${kb("index.html")} KB, scenes ${kb("stage.js")} KB)`);

// the DJ's offline package: a copy of the stage + how to play it, zipped
if (process.argv.includes("--dj")) {
  // (no web address the page would load: src= / href= / url( / @import pointing at http(s); the script's own strings
  // are only error messages and namespaces)
  const page = fs.readFileSync(path.join(out, "index.html"), "utf8");
  const online = page.match(/(?:src=|href=|url\(|@import\s*)["']?https?:\/\/[^"')\s]+/g);
  if (online) throw new Error(`the page loads from the web: ${online.join(", ")}`);
  const dj = path.join(root, "out/wedding/led-wall-dj");
  fs.rmSync(dj, { recursive: true, force: true });
  const SCENES = JSON.parse(fs.readFileSync(path.join(here, "scenes.json"), "utf8"));
  // (the scenes' files that a key plays: an old render left in scenes/, like round 22's Candles, stays out)
  const keep = (f) => path.basename(f) !== ".DS_Store" && (path.basename(path.dirname(f)) !== "scenes" || SCENES.some((s) => path.parse(f).name === s.id));
  fs.cpSync(out, dj, { recursive: true, filter: keep });
  fs.writeFileSync(path.join(dj, "README.txt"), [
    "LED WALL: THE MONOGRAM SCREEN (works offline, no internet needed)",
    "",
    "1. Copy this whole folder to the computer that plays on the LED wall (keep the files together).",
    "2. Open index.html in Google Chrome (or Microsoft Edge): double-click it, or drag it onto the browser.",
    "3. Press F for full screen. The monogram writes itself, then stays on with the lights moving.",
    "",
    "Keys:",
    "  F      full screen on / off",
    "  R      write the monogram again",
    "  S      the colours: gold on green / sage green on beige / sage green on white (opens on gold on green)",
    "  P      the couple's faces peeking in now and then (a wink, a giggle, a flying kiss that goes BOOM on the heart, a cupid's arrow, hide-and-seek, a stolen kiss, a bonk, a heart battle, the stolen heart, ...): off / on (on when it opens)",
    "  letters  play one of the peeks right now, for testing (the list is in H). Not needed on the day",
    "  0      all the peeks non-stop, one after another (for testing)",
    "  9      stop all the peeks now (P or 0 turns them on again)",
    ...SCENES.map((s) =>
      s.loop
        ? `  ${s.key}      "${s.name}"${s.banner ? ` with the "${s.banner.join(" ")}" banner` : ""}: back and forth across the bottom, non-stop. Press ${s.key} again (or any other key) to stop it; F and H don't stop it`
        : `  ${s.key}      play "${s.name}", then back to the monogram`,
    ),
    "  Esc    stop a scene, back to the monogram",
    "  H      show / hide this list of keys on screen",
    "",
    "The LED wall is 9 x 12 ft = 4:3. Set the computer's display output to a 4:3 size (the wall's own pixel size from",
    "the LED team, or 1024 x 768 / 1280 x 960 / 1600 x 1200) so the monogram is not stretched or cut. Press H: the",
    "last line shows the screen size and whether it is 4:3. At 16:9 the page still fits, with more room at the sides.",
    "",
    "Tips: set the computer to never sleep and hide the dock / taskbar; the mouse pointer is hidden on the page.",
    "",
  ].join("\n"));
  const zip = dj + ".zip";
  fs.rmSync(zip, { force: true });
  execFileSync("zip", ["-rqX", zip, "led-wall-dj"], { cwd: path.dirname(dj) });
  console.log(`DJ package: ${dj}/ + ${zip} (${Math.round(fs.statSync(zip).size / 1024)} KB)`);
}
