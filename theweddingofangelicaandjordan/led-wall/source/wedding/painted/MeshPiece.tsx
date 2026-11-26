import { useLayoutEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

// A painted piece drawn through a mesh (WebGL): n[0] x n[1] vertices spread evenly over its box (picture px, row by row),
// each placed by `place` (its rest point -> where it goes, picture px), the picture mapped on (premultiplied, smooth), on
// a canvas `pad` px bigger than the box all round (room to move). The toast's bending head and arm (round 13) and the
// piggyback's legs and base (round 19) are drawn with it. `res` < 1: drawn at that resolution (the picture shrunk
// smoothly first), for a piece shown that much smaller: a full-size canvas shrunk on screen lost its thin lines.
export type MeshPlace = (x: number, y: number, i: number) => readonly [number, number];

// the picture shrunk to r of its size, halving at most each step (smooth, no lost lines)
const shrink = (img: HTMLImageElement, r: number): TexImageSource => {
  const [tw, th] = [Math.max(1, Math.round(img.width * r)), Math.max(1, Math.round(img.height * r))];
  let src: HTMLImageElement | HTMLCanvasElement = img;
  while (src.width > tw || src.height > th) {
    const c = document.createElement("canvas");
    [c.width, c.height] = [Math.max(tw, Math.round(src.width / 2)), Math.max(th, Math.round(src.height / 2))];
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, c.width, c.height);
    src = c;
  }
  return src;
};

const VERT = "attribute vec2 p; attribute vec2 uv; varying vec2 t; void main() { t = uv; gl_Position = vec4(p, 0.0, 1.0); }";
const FRAG = "precision mediump float; varying vec2 t; uniform sampler2D img; void main() { gl_FragColor = texture2D(img, t); }";

export const MeshPiece: React.FC<{
  src: string;
  box: readonly number[];
  n: readonly number[];
  place: MeshPlace;
  pad?: number;
  res?: number;
  style?: React.CSSProperties;
}> = ({ src, box, n, place, pad = 40, res = 1, style }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gl = useRef<{ g: WebGLRenderingContext; pos: WebGLBuffer; at: number; count: number } | null>(null);
  const [handle] = useState(() => delayRender(`mesh piece ${src.slice(-40)}`));
  const placeNow = useRef(place);
  placeNow.current = place;
  const [cw, ch] = [box[2] + 2 * pad, box[3] + 2 * pad];
  const [nx, ny] = n;
  const draw = () => {
    const s = gl.current;
    if (!s) return;
    const xy = new Float32Array(nx * ny * 2);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v = j * nx + i;
        const [px, py] = placeNow.current(box[0] + (box[2] * i) / (nx - 1), box[1] + (box[3] * j) / (ny - 1), v);
        xy[v * 2] = ((px - box[0] + pad) / cw) * 2 - 1;
        xy[v * 2 + 1] = 1 - ((py - box[1] + pad) / ch) * 2;
      }
    const { g } = s;
    g.bindBuffer(g.ARRAY_BUFFER, s.pos);
    g.bufferData(g.ARRAY_BUFFER, xy, g.DYNAMIC_DRAW);
    g.vertexAttribPointer(s.at, 2, g.FLOAT, false, 0, 0);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.drawElements(g.TRIANGLES, s.count, g.UNSIGNED_SHORT, 0);
  };
  useLayoutEffect(() => {
    const img = new Image();
    img.onload = () => {
      const g = canvas.current!.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false })!;
      const shader = (type: number, code: string) => {
        const sh = g.createShader(type)!;
        g.shaderSource(sh, code);
        g.compileShader(sh);
        return sh;
      };
      const prog = g.createProgram()!;
      g.attachShader(prog, shader(g.VERTEX_SHADER, VERT));
      g.attachShader(prog, shader(g.FRAGMENT_SHADER, FRAG));
      g.linkProgram(prog);
      g.useProgram(prog);
      // the picture's side of each vertex (fixed), and the triangles (two a cell, drawn row by row: a later row over an
      // earlier one where a bend folds them)
      const uv = new Float32Array(nx * ny * 2);
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) [uv[(j * nx + i) * 2], uv[(j * nx + i) * 2 + 1]] = [i / (nx - 1), j / (ny - 1)];
      const tris: number[] = [];
      for (let j = 0; j < ny - 1; j++)
        for (let i = 0; i < nx - 1; i++) {
          const v = j * nx + i;
          tris.push(v, v + 1, v + nx, v + 1, v + nx + 1, v + nx);
        }
      const uvBuf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, uvBuf);
      g.bufferData(g.ARRAY_BUFFER, uv, g.STATIC_DRAW);
      const uvAt = g.getAttribLocation(prog, "uv");
      g.enableVertexAttribArray(uvAt);
      g.vertexAttribPointer(uvAt, 2, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, g.createBuffer());
      g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), g.STATIC_DRAW);
      g.bindTexture(g.TEXTURE_2D, g.createTexture());
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, res < 1 ? shrink(img, res) : img);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      const at = g.getAttribLocation(prog, "p");
      g.enableVertexAttribArray(at);
      gl.current = { g, pos: g.createBuffer()!, at, count: tris.length };
      draw();
      continueRender(handle);
    };
    img.onerror = () => cancelRender(new Error(`mesh piece didn't load: ${src.slice(0, 80)}`));
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(draw);
  return (
    <canvas
      ref={canvas}
      width={Math.round(cw * res)}
      height={Math.round(ch * res)}
      style={{ position: "absolute", left: box[0] - pad, top: box[1] - pad, width: cw, height: ch, ...style }}
    />
  );
};
