# Dan & Ange as cut-outs of the user's own painted toast picture (round 12, 2026-10-26; the user: "more detailed and PNG,
# cause currently your cuts has a white background excess … more like this very like this. yours is kinda flat"). No
# tracing: every piece keeps the picture's own pixels (its shading, highlights and soft edges) and moves rigidly in code.
# Per character: the base (everything that stays), the head (face + hair, turning at the neck), the glass arm (forearm,
# hand and glass, turning at the elbow) and the closed-eye skin for blinks. Where a piece moves off what it covered, the
# base shows what's behind it: inside each piece, the band a move can uncover (as wide as that point's farthest move) is
# refilled from the body round it (masked diffusion, the body's own colours), see-through where no body was (the
# background); deeper in, the picture is kept (always covered). Cut edges that run through cloth or skin (the arm's
# elbow) fade out, over the base's own copy of that cloth.
# Usage: .venv/bin/python -I src/wedding/trace/painted-cut.py <toast PNG> <work dir> src/wedding/painted
#   -> <out>/{dan,ange}-{base,head,arm,lids}.png + <out>/paintedParts.ts
# Hand-measured on the 1312x1199 transparent toast PNG (picture px).
import sys, os, json, cv2, numpy as np

src, wd, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(wd, exist_ok=True)
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
H, W = im.shape[:2]
bgr = im[..., :3].astype(np.float32)
alpha = im[..., 3].astype(np.float32) / 255
opaque = alpha > 0.5
lum = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY)
Lab = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def poly(pts):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m > 0
def box(x0, y0, x1, y1):
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = True
    return m
def dil(m, r): return cv2.dilate(m.astype(np.uint8), disk(r)) > 0
def ero(m, r): return cv2.erode(m.astype(np.uint8), disk(r)) > 0
def keep_touching(cand, core):
    n, cc = cv2.connectedComponents((cand | core).astype(np.uint8), connectivity=8)
    return np.isin(cc, [i for i in np.unique(cc[core]) if i])

# the two of them (a clear gap between his jacket and her dress)
n, cc, st, cen = cv2.connectedComponentsWithStats((alpha > 0.02).astype(np.uint8), connectivity=8)
WHO = {"dan": np.isin(cc, [i for i in range(1, n) if cen[i][0] < 640]),
       "ange": np.isin(cc, [i for i in range(1, n) if cen[i][0] >= 640])}

# hair: the dark, thick masses (opened, so the thin outlines of the jacket, arms and bodice it touches stay put)
dark = cv2.morphologyEx(((lum < 95) & opaque).astype(np.uint8), cv2.MORPH_OPEN, disk(3)) > 0

def strands(head, band):
    # the thin strands at the hair's edge (the opening above leaves them out): small dark bits in the band touching the
    # head; the body's outlines it touches are long, joined lines and stay put
    thin = (lum < 95) & (alpha > 0.02) & band & ~head
    n, cc, st, _ = cv2.connectedComponentsWithStats(thin.astype(np.uint8), connectivity=8)
    near = dil(head, 1)
    return head | np.isin(cc, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < 200 and (near & (cc == i)).any()])

def chin(x0, x1, y0, y1):
    # the face's skin above the jaw's outline: down each column from y0 to the first dark run, through it
    m = np.zeros((H, W), bool)
    for x in range(x0, x1):
        y = y0
        while y < y1 and lum[y, x] >= 95: y += 1
        while y < y1 and lum[y, x] < 95: y += 1
        m[y0:y + 1, x] = True
    return m

# the pieces: mask, pivot (picture px), how far it turns / grows at most (for the band a move can uncover), the closing
# radius and the reach (D) that decide where body lies behind it, and its anchors: where it meets the body and mustn't
# move. Each piece bends rather than turning stiff (round 13, the user: "the cut rig is obvious", red arrows at Dan's
# shoulder and Ange's armpit): its turn is weighted 0 at the anchors, rising smoothly to 1 over L px (`w`); the code
# draws it through a mesh with those weights
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
P = {}
# Dan's head: everything above y 405, and below it the hair masses and the chin down to the jaw's line (the neck stays);
# held by his jacket's shoulders (the curls over them stay put, so the shoulder line under them never shows)
arm_d = poly([(120, 370), (232, 370), (232, 495), (240, 520), (240, 640), (120, 640)]) & WHO["dan"]
# (but not the curl tips reaching in beside the bowl: dark bits joined, near there, to the hair right of the box)
near = (lum < 95) & (alpha > 0.02) & box(200, 370, 262, 470)
n, cc = cv2.connectedComponents(near.astype(np.uint8), connectivity=8)
arm_d &= ~dil(np.isin(cc, [i for i in np.unique(cc[:, 233:262][near[:, 233:262]]) if i]), 1)
core = WHO["dan"] & ~arm_d & (np.arange(H)[:, None] < 405) & (alpha > 0.02)
band = WHO["dan"] & ~arm_d & box(0, 405, W, 500)
head_d = strands(core | keep_touching(band & (dil(dark, 2) & (alpha > 0.02) | chin(300, 515, 405, 470)), core), band)
P["dan.head"] = dict(m=head_d, pivot=(405, 452), k=0.075, R=20, D=24, anchor=(yy > 440) & (np.abs(xx - 405) > 70), touch=False, L=70)
# Dan's glass arm: the glass, his hand, the cuff and the sleeve down to y 640, cut short of the sleeve's outer line on
# the right (that line and the elbow below stay on the base); it turns at the sleeve's outer edge on the cut, held
# along the cut
P["dan.arm"] = dict(m=arm_d, pivot=(145, 640), k=0.13, R=10, D=20, anchor=box(150, 490, 262, 652) & ~box(0, 0, 238, 636), touch=True, L=60)
# Ange's head: everything above y 480 (but her glass), and below it her hair down to her shoulders, and the chin; held
# by her shoulders and arms under the hair
glass_a = box(1092, 420, 1190, 645) & WHO["ange"]
core = WHO["ange"] & ~glass_a & (np.arange(H)[:, None] < 480) & (alpha > 0.02)
band = WHO["ange"] & ~glass_a & box(0, 480, W, 625)
head_a = strands(core | keep_touching(band & (dil(dark, 2) & (alpha > 0.02) | chin(815, 965, 470, 500)), core), band)
P["ange.head"] = dict(m=head_a, pivot=(890, 505), k=0.075, R=24, D=24, anchor=(yy > 520) & (np.abs(xx - 890) > 70), touch=False, L=70)
# Ange's glass arm: all of it, from the shoulder under her hair (drawn behind the hair, as in the picture) to the hand
# and the glass, beside the bodice's outline (that stays); it swings out from the shoulder, held where it touches the
# bodice (the armpit stays shut)
arm_a = poly([(989, 560), (1092, 560), (1092, 420), (1190, 420), (1190, 645), (1115, 652), (1066, 712), (1031, 715),
              (1000, 705), (989, 650)]) & WHO["ange"] & ~head_a
P["ange.arm"] = dict(m=arm_a, pivot=(1005, 578), k=0.12, R=6, D=0, anchor=box(978, 560, 1000, 662), touch=True, L=70)

def diffuse(region, known, iters):
    # fill `region` from the `known` pixels round it: repeated 4-neighbour averaging over region + known only
    ys, xs = np.where(region)
    y0, y1, x0, x1 = max(ys.min() - 2, 0), min(ys.max() + 3, H), max(xs.min() - 2, 0), min(xs.max() + 3, W)
    reg, kn = region[y0:y1, x0:x1], known[y0:y1, x0:x1] & ~region[y0:y1, x0:x1]
    # (started from a quick inpaint of the known pixels alone, so the averaging only has to smooth it)
    seed = cv2.inpaint(np.clip(bgr[y0:y1, x0:x1], 0, 255).astype(np.uint8), (~kn).astype(np.uint8), 6, cv2.INPAINT_TELEA)
    v = bgr[y0:y1, x0:x1].copy(); v[reg] = seed[reg]
    w = (reg | kn).astype(np.float32)
    k = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], np.float32)
    den = cv2.filter2D(w, -1, k, borderType=cv2.BORDER_CONSTANT)
    for i in range(iters):
        num = np.stack([cv2.filter2D(v[..., c] * w, -1, k, borderType=cv2.BORDER_CONSTANT) for c in range(3)], -1)
        nv = num / np.maximum(den, 1e-6)[..., None]
        v[reg] = nv[reg]
    full = bgr.copy(); full[y0:y1, x0:x1][reg] = v[reg]
    return full

base = {"dan": np.dstack([bgr, alpha * WHO["dan"]]).copy(), "ange": np.dstack([bgr, alpha * WHO["ange"]]).copy()}
pieces, debug, bend = {}, {}, {}
for name, p in P.items():
    who = name.split(".")[0]
    m = p["m"]
    # (the body here is everything of them but this piece: her arm runs on under her hair too)
    body = WHO[who] & opaque & ~m
    # its bend: 0 at the anchors (the body it meets there), 1 from L px away
    anchors = body & p["anchor"] & (dil(m, 2) if p["touch"] else True)
    t = np.clip(cv2.distanceTransform((~anchors).astype(np.uint8), cv2.DIST_L2, 5) / p["L"], 0, 1)
    bend[name] = t * t * (3 - 2 * t)
    # how deep each point sits in the piece's solid part vs. how far it moves at most; the see-through glass is never deep
    # (the base mustn't show through it)
    depth = cv2.distanceTransform((m & (alpha >= 0.98)).astype(np.uint8), cv2.DIST_L2, 5)
    reach = np.hypot(xx - p["pivot"][0], yy - p["pivot"][1]) * p["k"] * bend[name] + 3
    band_m = m & (depth <= reach)
    # behind it: body where the body closes over it or runs on under it (the neck under the chin, the shoulders under
    # the hair: up to D px in), else nothing; never under the piece's see-through or soft edges (the background showed
    # through those in the picture)
    behind = (cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_CLOSE, disk(p["R"])) > 0) | (dil(body, p["D"]) & m)
    behind &= alpha >= 0.98
    fill_m = band_m & behind
    b = base[who]
    if fill_m.any():
        filled = diffuse(fill_m, body, 400)
        b[..., :3][fill_m] = filled[fill_m]
    b[..., 3][band_m] = 0
    soft = cv2.GaussianBlur(fill_m.astype(np.float32), (0, 0), 0.8)
    b[..., 3] = np.where(band_m, np.maximum(b[..., 3], soft * fill_m), b[..., 3])
    # the piece: the picture's pixels, whole inside its cut (at rest it shows exactly the picture) and softened a px past
    # it (the picture's own pixels again, so that's exact too)
    edge = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.7)
    a = alpha * np.where(m, 1, edge * (dil(m, 1)))
    pieces[name] = np.dstack([bgr, a])
    debug[name] = dict(band=band_m, fill=fill_m)

# the eyes: in an oval round each (its middle and half-sizes, measured; her outer lash wings and the hair beside them
# stay out), what isn't the skin (the whites, irises, lashes) -> closed-eye skin, filled from the skin round each eye;
# and each eye's corners and lids for the lash line drawn in code
EYES = {"dan": [(347.5, 289, 39, 16), (482, 292, 39, 16)], "ange": [(832, 354, 31, 23), (949, 353, 35, 22)]}
# the skin each face is judged against: the bridge of the nose, between the eyes
BRIDGE = {"dan": (395, 285, 435, 305), "ange": (874, 345, 902, 365)}
eyes_ts, lids = {}, {}
for who, boxes in EYES.items():
    em = np.zeros((H, W), bool)
    geo = []
    for (cx, cy, hw, hh) in boxes:
        x0, y0, x1, y1 = int(cx - hw), int(cy - hh), int(cx + hw) + 1, int(cy + hh) + 1
        oval = (((xx - cx) / hw) ** 2 + ((yy - cy) / hh) ** 2) <= 1
        skin = np.median(Lab[box(*BRIDGE[who])], 0)
        # (dark lashes and irises, or the bright whites: past her blush, shading and eyeshadow)
        chroma = np.hypot(Lab[..., 1] - 128, Lab[..., 2] - 128)
        far = (np.linalg.norm(Lab - skin, axis=2) > 45) & ((lum < 120) | ((Lab[..., 0] > 190) & (chroma < 25))) & oval
        # (and the whites' shaded corners: grey, no warmth)
        far |= (Lab[..., 0] > 110) & (chroma < 12) & oval
        # (the eye, plus every lash and wing within a few px of it, so none is left to darken the closed lid; not the
        # brows or the hair at the box's edges)
        n, cc, st, _ = cv2.connectedComponentsWithStats(far.astype(np.uint8), connectivity=8)
        eye = cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        near = dil(eye, 4)
        e = np.isin(cc, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 12 and (near & (cc == i)).any()])
        e = cv2.morphologyEx(e.astype(np.uint8), cv2.MORPH_CLOSE, disk(4)) > 0
        # (and what it closes round: the waterline, the highlights)
        n2, cc2 = cv2.connectedComponents((~e & box(x0 - 1, y0 - 1, x1 + 1, y1 + 1)).astype(np.uint8), connectivity=4)
        e |= oval & ~np.isin(cc2, np.unique(np.concatenate([cc2[y0 - 1, x0 - 1:x1 + 1], cc2[y1, x0 - 1:x1 + 1], cc2[y0 - 1:y1 + 1, x0 - 1], cc2[y0 - 1:y1 + 1, x1]])))
        ys, xs = np.where(e)
        l, r = xs.min(), xs.max()
        ly, ry = ys[xs <= l + 2].mean(), ys[xs >= r - 2].mean()
        mid = (xs > (l + r) / 2 - 3) & (xs < (l + r) / 2 + 3)
        geo.append(dict(l=[int(l), round(float(ly), 1)], r=[int(r), round(float(ry), 1)], top=int(ys[mid].min()),
                        bot=int(ys[mid].max())))
        em |= dil(e, 3)
    # (filled from the skin only: never the brows, lashes or hair round it)
    skin = np.median(Lab[dil(em, 8) & ~dil(em, 3)], 0)
    known = WHO[who] & opaque & ~dil(em, 1) & (np.linalg.norm(Lab - skin, axis=2) < 20) & (lum > 120)
    filled = diffuse(em, known, 900)
    a = cv2.GaussianBlur(dil(em, 1).astype(np.float32), (0, 0), 1.2)
    lids[who] = np.dstack([filled, a])
    cv2.imwrite(f"{wd}/{who}-eyes-mask.png", np.where(em[..., None], (bgr * 0.4 + np.array([0, 0, 150])), bgr).astype(np.uint8))
    # the lash colour: the darkest of the eye
    ink = bgr[em & (lum <= np.percentile(lum[em], 6))].mean(0)
    eyes_ts[who] = dict(eyes=geo, ink="#%02X%02X%02X" % (int(ink[2]), int(ink[1]), int(ink[0])))

def save(name, rgba):
    a = rgba[..., 3]
    ys, xs = np.where(a > 0.004)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    o = np.dstack([np.clip(rgba[y0:y1, x0:x1, :3], 0, 255), np.clip(a[y0:y1, x0:x1] * 255, 0, 255)]).astype(np.uint8)
    cv2.imwrite(f"{out}/{name}.png", o, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

boxes = {}
for who in ("dan", "ange"):
    boxes[f"{who}.base"] = save(f"{who}-base", base[who])
    boxes[f"{who}.lids"] = save(f"{who}-lids", lids[who])
for name, rgba in pieces.items(): boxes[name] = save(name.replace(".", "-"), rgba)

# checks: each base alone on the stage green, the refilled band in magenta, the uncovered-but-empty band in cyan
for who in ("dan", "ange"):
    b = base[who]; g = np.full((H, W, 3), (24, 40, 13), np.float32)
    c = g * (1 - b[..., 3:]) + b[..., :3] * b[..., 3:]
    cv2.imwrite(f"{wd}/{who}-base-on-green.png", c.astype(np.uint8))
    for name in P:
        if not name.startswith(who): continue
        c[debug[name]["fill"]] = c[debug[name]["fill"]] * 0.5 + np.array([255, 0, 255]) * 0.5
        c[debug[name]["band"] & ~debug[name]["fill"]] = c[debug[name]["band"] & ~debug[name]["fill"]] * 0.5 + np.array([255, 255, 0]) * 0.5
    cv2.imwrite(f"{wd}/{who}-base-bands.png", c.astype(np.uint8))
cut = (bgr * 0.3).astype(np.uint8)
colors = {"dan.head": (0, 200, 255), "dan.arm": (255, 120, 0), "ange.head": (0, 200, 255), "ange.arm": (255, 120, 0)}
for name, p in P.items(): cut[p["m"]] = (bgr[p["m"]] * 0.5 + np.array(colors[name]) * 0.5).astype(np.uint8)
cv2.imwrite(f"{wd}/cut.png", cut)
# (and each piece's bend: blue where it's held, red where it turns fully)
bv = (bgr * 0.3).astype(np.uint8)
for name, p in P.items(): bv[p["m"]] = (bgr[p["m"]] * 0.3 + np.stack([255 * (1 - bend[name]), 0 * bend[name], 255 * bend[name]], -1)[p["m"]] * 0.7).astype(np.uint8)
cv2.imwrite(f"{wd}/bend.png", bv)

# each moving piece's mesh: its bend sampled every ~MESH px over its box (the vertices, row by row)
MESH = 12
mesh = {}
for name in P:
    x0, y0, bw, bh = boxes[name]
    nx, ny = int(np.ceil(bw / MESH)) + 1, int(np.ceil(bh / MESH)) + 1
    gx = np.clip(np.round(np.linspace(x0, x0 + bw, nx)).astype(int), 0, W - 1)
    gy = np.clip(np.round(np.linspace(y0, y0 + bh, ny)).astype(int), 0, H - 1)
    mesh[name] = dict(n=[nx, ny], w=[round(float(v), 2) for v in bend[name][np.ix_(gy, gx)].ravel()])

ts = ["// GENERATED by src/wedding/trace/painted-cut.py: Dan & Ange cut from the user's own painted toast picture (round 12):",
      "// each piece's box in the picture ([x, y, w, h], picture px), the moving pieces' pivots, the eyes (corners, lids,",
      "// lash colour) for the blinks drawn in code, and each moving piece's mesh (its bend, 0..1, at n[0] x n[1] vertices",
      "// spread evenly over its box, row by row).",
      "export const PAINTED = {", f"  size: {json.dumps([W, H])},", "  boxes: {"]
ts += [f'    "{k}": {json.dumps(v)},' for k, v in boxes.items()] + ["  },", "  pivots: {"]
ts += [f'    "{k}": {json.dumps(list(v["pivot"]))},' for k, v in P.items()] + ["  },", "  eyes: {"]
ts += [f"    {k}: {json.dumps(v)}," for k, v in eyes_ts.items()] + ["  },", "  mesh: {"]
ts += [f'    "{k}": {json.dumps(v, separators=(",", ":"))},' for k, v in mesh.items()] + ["  },", "} as const;", ""]
open(f"{out}/paintedParts.ts", "w").write("\n".join(ts))
print(json.dumps(boxes)); print(json.dumps(eyes_ts))

# the check: at rest (no moves) the pieces over a background must give back the picture. A half-opaque cut edge mixes
# the refill in (notches by Dan's shoulder in the first cut); a few px of rounding are fine
g = np.full((H, W, 3), (24, 40, 13), np.float32)
def over(img, rgba):
    a = np.clip(rgba[..., 3:], 0, 1)
    return img * (1 - a) + np.clip(rgba[..., :3], 0, 255) * a
comp = g.copy()
for who in ("dan", "ange"):
    comp = over(comp, base[who])
    for name in P:
        if name.startswith(who): comp = over(comp, pieces[name])
off = int((np.abs(comp - over(g, np.dstack([bgr, alpha]))).max(2) > 24).sum())
print(f"at rest: {off} px differ from the picture")
if off > 50: sys.exit("the pieces at rest don't give back the picture: see the cut edges")
