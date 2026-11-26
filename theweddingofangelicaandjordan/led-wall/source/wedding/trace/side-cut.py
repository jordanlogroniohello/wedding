"""The side views (round 35, 2026-11-26): Dan + Ange's heads in full profile, cut from the user's own AI picture
(`src/wedding/painted/side-source.png`, made from the toast picture with the prompt in the wedding note), for the peeks
(stage/peek.ts): the turn to each other, later the kiss.

  .venv/bin/python -I src/wedding/trace/side-cut.py [--check out.png]

1. The white ground → transparent (flood-filled from the edges, so the teeth + the eyes' whites stay; the anti-aliased rim
   un-blended from white).
2. The two heads apart (the gap between them).
3. Their colours matched to the toast picture's (the master): the skin and the hair, each region moved to the toast's
   own mean + spread in Lab (the AI picture made Ange paler + her hair browner; a front head turning into this one must
   not change colour).
4. side-dan.png / side-ange.png + sideParts.ts (the boxes + the points the stage needs, measured on the picture: the eye,
   the chin, the mouth, the neck, Dan's ear lobe for his cross earring).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
PAINTED = ROOT / "src/wedding/painted"
SRC = PAINTED / "side-source.png"

# measured on side-source.png (1774 x 887), by grid crops: the visible eye's middle, the chin's lowest point, the
# mouth's middle, the neck's middle at the chin's height, Dan's left ear lobe (the piercing, just above its edge)
POINTS = {
    "dan": {"eye": [650, 462], "chin": [705, 715], "mouth": [690, 610], "neck": [470, 715], "lobe": [372, 598]},
    "ange": {"eye": [1185, 468], "chin": [1072, 696], "mouth": [1090, 600], "neck": [1315, 715]},
}
# the boxes round each eye (kept out of the hair's colour match: the irises are dark brown too)
EYE_BOX = {"dan": (555, 405, 735, 520), "ange": (1105, 400, 1255, 530)}
# the white that's really white (the eyes' whites + shines, the teeth): every other white patch the ground's flood can't
# reach (the gaps between his curls) is ground too
KEEP_WHITE = [EYE_BOX["dan"], (630, 570, 765, 685), EYE_BOX["ange"], (1035, 560, 1145, 655)]
SPLIT_X = 900  # the gap between the heads
OUT_SCALE = 0.62


def to_alpha(img):
    """White ground → alpha: what's near-white AND connected to the picture's edge is ground; a 2-px rim round it gets
    its alpha from how far it is from white, its colour un-blended."""
    h, w = img.shape[:2]
    near_white = (img.min(axis=2) > 232).astype(np.uint8)
    ground = np.zeros((h + 2, w + 2), np.uint8)
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] + [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    fill = near_white.copy()
    for x, y in seeds:
        if fill[y, x] == 1:
            cv2.floodFill(fill, ground, (x, y), 2)
    bg = fill == 2
    # (white pockets shut in by the hair: ground, unless they're in an eye or a mouth; a white dot on the skin (the
    # cheeks' shine) stays: only a pocket ringed by dark hair goes)
    n, lab, st, cen = cv2.connectedComponentsWithStats((fill == 1).astype(np.uint8), 8)
    val = img.max(axis=2)
    for i in range(1, n):
        cx, cy = cen[i]
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in KEEP_WHITE):
            continue
        x, y, w, h = st[i, :4]
        sub = (lab[max(0, y - 4):y + h + 4, max(0, x - 4):x + w + 4] == i).astype(np.uint8)
        ring = cv2.dilate(sub, np.ones((7, 7), np.uint8)).astype(bool) & ~sub.astype(bool)
        if np.median(val[max(0, y - 4):y + h + 4, max(0, x - 4):x + w + 4][ring]) < 110:
            bg |= lab == i
    alpha = np.where(bg, 0.0, 1.0)
    rim = cv2.dilate(bg.astype(np.uint8), np.ones((5, 5), np.uint8)) .astype(bool) & ~bg
    lo = img.min(axis=2).astype(float)
    a_rim = np.clip((255 - lo) / (255 - 120), 0, 1)
    alpha[rim] = np.minimum(alpha[rim], a_rim[rim])
    a = alpha[..., None]
    out = np.where(a > 0.02, (img.astype(float) - 255 * (1 - a)) / np.maximum(a, 0.02), img.astype(float))
    return np.clip(out, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)


def regions(bgr, alpha, eye_box=None):
    """skin + hair masks (opaque pixels only)"""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    opaque = alpha > 200
    skin = opaque & (H <= 22) & (S >= 25) & (S <= 150) & (V >= 150)
    hair = opaque & (V < 150) & ~skin
    if eye_box:
        x0, y0, x1, y1 = eye_box
        hair[y0:y1, x0:x1] = False
    return skin, hair


def stats(lab, mask):
    v = lab[mask].astype(float)
    return v.mean(axis=0), v.std(axis=0) + 1e-3


def transfer(lab, mask, src, dst, feather=6):
    """move a region's Lab colours to the target mean + spread (Reinhard), feathered at its edge"""
    (ms, ss), (md, sd) = src, dst
    moved = (lab.astype(float) - ms) / ss * sd + md
    w = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), feather)[..., None]
    w = np.clip(w * 1.0, 0, 1)
    return lab.astype(float) * (1 - w) + moved * w


def main():
    side = cv2.imread(str(SRC))
    rgb, alpha = to_alpha(side)
    out_parts = {"size": [side.shape[1], side.shape[0]], "boxes": {}, **{k: {} for k in ["eye", "chin", "mouth", "neck", "lobe"]}}
    check = []
    for who, (x0, x1) in {"dan": (0, SPLIT_X), "ange": (SPLIT_X, side.shape[1])}.items():
        a = alpha.copy()
        a[:, :x0] = 0
        a[:, x1:] = 0
        ys, xs = np.nonzero(a > 8)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        # the master: the toast picture's own head cut
        toast = cv2.imread(str(PAINTED / f"{who}-head.png"), cv2.IMREAD_UNCHANGED)
        t_bgr, t_a = toast[..., :3], toast[..., 3]
        t_skin, t_hair = regions(t_bgr, t_a)
        s_skin, s_hair = regions(rgb, a, EYE_BOX[who])
        lab = cv2.cvtColor(rgb, cv2.COLOR_BGR2LAB)
        t_lab = cv2.cvtColor(t_bgr, cv2.COLOR_BGR2LAB)
        fixed = transfer(lab, s_skin, stats(lab, s_skin), stats(t_lab, t_skin))
        fixed = transfer(fixed, s_hair, stats(lab, s_hair), stats(t_lab, t_hair), feather=3)
        fixed = cv2.cvtColor(np.clip(fixed, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
        piece = np.dstack([fixed, a])[by0:by1, bx0:bx1]
        # (saved at the front heads' own resolution: the stage shows a profile at ~0.6 of the picture's size; sideParts.ts
        # stays in the picture's px, the page sizes the image by its box)
        small = cv2.resize(piece, (round(piece.shape[1] * OUT_SCALE), round(piece.shape[0] * OUT_SCALE)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(PAINTED / f"side-{who}.png"), small, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        out_parts["boxes"][f"{who}.side"] = [int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0)]
        for k, v in POINTS[who].items():
            out_parts[k][who] = v
        sk = lambda im, m: np.median(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)[m], axis=0).round().astype(int).tolist()
        print(f"{who}: box {out_parts['boxes'][f'{who}.side']} | skin toast {sk(t_bgr, t_skin)} side {sk(rgb, s_skin)} -> {sk(fixed, s_skin)}"
              f" | hair toast {sk(t_bgr, t_hair)} side {sk(rgb, s_hair)} -> {sk(fixed, s_hair)}")
        # the check row: toast head | the side before | after (on white, 420 tall)
        def on_white(bgr, al):
            f = al[..., None] / 255.0
            return (bgr * f + 255 * (1 - f)).astype(np.uint8)
        row = [on_white(t_bgr, t_a), on_white(rgb[by0:by1, bx0:bx1], a[by0:by1, bx0:bx1]), on_white(fixed[by0:by1, bx0:bx1], a[by0:by1, bx0:bx1])]
        check.append(np.hstack([cv2.resize(r, (int(r.shape[1] * 420 / r.shape[0]), 420)) for r in row]))

    ts = PAINTED / "sideParts.ts"
    ts.write_text(
        "// GENERATED by src/wedding/trace/side-cut.py: Dan + Ange's heads in full profile (round 35), cut from the user's own\n"
        "// side picture (side-source.png px): each head's box, its visible eye's middle, its chin, mouth, neck (at the chin's\n"
        "// height) and Dan's ear lobe (his cross earring).\n"
        f"export const SIDE = {json.dumps(out_parts)} as const;\n"
    )
    print("wrote", ts.relative_to(ROOT), "+ side-dan.png, side-ange.png")
    if "--check" in sys.argv:
        dest = sys.argv[sys.argv.index("--check") + 1]
        w = max(r.shape[1] for r in check)
        cv2.imwrite(dest, np.vstack([np.pad(r, ((0, 10), (0, w - r.shape[1]), (0, 0)), constant_values=255) for r in check]))
        print("check:", dest)


if __name__ == "__main__":
    main()
