# The candle scene's pieces (stage key 3, round 23), cut from the user's candle picture (cake-source.png) with the toast
# faces on (master-face.py: cake-faces-bare.png = no mouth, the base; cake-faces.png = blowing; cake-faces-smile.png =
# smiling). The user: "move the character behind the cake then animate the blow step by step", so the picture comes
# apart into what slides and what stays. Back to front: Dan and Ange (they slide along the far side of the table); the
# candles (the sticks, and each flame on its own: it bends and goes out; the wicks are drawn in code); the front (table,
# cake, both flower bunches). Plus the face pieces: the pursed lips (Dan's moustache with them), the smiles, the
# closed-eye skin (the lash lines are drawn in code, like the toast's).
#   .venv/bin/python -I src/wedding/trace/cake-cut.py <skin dir> <check dir>
#   (<skin dir>: master-face.py's `cake-bare` run, its {dan,ange}-painted-out.png: each face box with no features)
# -> src/wedding/painted/cake-*.png + cakeParts.ts; <check dir>/owners.png (who owns each px: Dan red, Ange blue, the
#    front green, sticks yellow, flames orange, what's filled in behind the flowers purple), owners-*.png zoomed
import sys, json
import numpy as np, cv2

skin_dir, chk = sys.argv[1:3]
PD = "src/wedding/painted"

def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32)
    return im[..., :3], im[..., 3] / 255

S, Sa = load(f"{PD}/cake-source.png")
B, _ = load(f"{PD}/cake-faces-bare.png")
F, _ = load(f"{PD}/cake-faces.png")
M, _ = load(f"{PD}/cake-faces-smile.png")
H, W = Sa.shape
yy, xx = np.mgrid[0:H, 0:W]
# each face box with no features at all (where master-face.py cut it out: its CAKE face boxes)
FACE = {"dan": (440, 160), "ange": (1370, 185)}
P = B.copy()
for who, (x0, y0) in FACE.items():
    pc = cv2.imread(f"{skin_dir}/{who}-painted-out.png").astype(np.float32)
    P[y0:y0 + pc.shape[0], x0:x0 + pc.shape[1]] = pc

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def dil(m, r): return cv2.dilate(m.astype(np.uint8), disk(r)) > 0
def poly(ps):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(ps) * 4).astype(np.int32)], 1, cv2.LINE_8, 2)
    return m > 0
def lab(img): return cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
L = lab(S)
op = Sa > 0.02
MIDDLE = 1003  # between candles 4 and 5: a person's px left of it are his, right hers

# --- the candles: each stick (its columns, its top, where the piping covers it), its flame, its wick ---
cols = []
band = Sa[375:392, 600:1400].min(0) > 0.78
x = 0
while x < band.size:
    if band[x]:
        e = x
        while e < band.size and band[e]: e += 1
        cols.append((x + 600, e - 1 + 600)); x = e
    else: x += 1
assert len(cols) == 8, cols
candles = []
sticks = np.zeros((H, W), bool)
flames = []
for x0, x1 in cols:
    cx = (x0 + x1) / 2
    # the stick's top: its left outline turns dark brown (the flame above it is bright)
    top = next(y for y in range(330, 380) if Sa[y, x0 + 1] > 0.9 and L[y, x0 + 1, 0] < 140)
    # the piping covers it where the cake runs on past both its sides
    pip = next(y for y in range(top + 5, 430) if Sa[y, x0 - 4] > 0.9 and Sa[y, x1 + 4] > 0.9)
    sticks[top - 1:pip, x0 - 1:x1 + 2] = True
    # the flame: the piece over the stick's top round its bright middle (only that piece: her hair is a few px off
    # the last one)
    near = op & (np.abs(xx - cx) <= 15) & (yy < top) & (yy > 280)
    n, cc = cv2.connectedComponents(near.astype(np.uint8), connectivity=8)
    fl = cc == cc[top - 20, int(round(cx))]
    assert cc[top - 20, int(round(cx))] > 0
    flames.append(fl)
    fys, fxs = np.where(fl)
    # the wick: the dark line up from the stick's top inside the flame
    wk = fl & (L[..., 0] < 120) & (np.abs(xx - cx) <= 4) & (yy >= top - 20)
    wys, wxs = np.where(wk)
    candles.append(dict(cx=round(float(cx), 1), x0=x0, x1=x1, top=top, pip=pip,
                        flame=[int(fxs.min()), int(fys.min()), int(fxs.max() - fxs.min() + 1), int(fys.max() - fys.min() + 1)],
                        wick=[round(float(wxs.mean()), 1), int(wys.min()), top]))
flame = np.any(flames, 0)
sticks &= op & ~flame

# --- the table: its top edge (a dark line ~3 px), measured down each column where nothing stands on it; round both
# corners (measured, zoomed 3-8x); under the hands the line was their outline, so it's drawn in there from a clean column
CORNER_L = [(106.7, 663.3), (123.3, 630), (140, 600), (156.7, 570), (161, 565), (166.7, 561.7)]
CORNER_R = [(1810, 561.7), (1823.3, 570), (1836.7, 613.3), (1856.7, 666.7)]
def edge_y(x): return next(y for y in range(546, 568) if Sa[y, x] > 0.9 and L[y, x, 0] < 120)
tops = {x: edge_y(x) for x in list(range(168, 292)) + list(range(1645, 1810))}
HANDS = {"dan": (292, 395, 285), "ange": (1560, 1645, 1652)}  # (from, to, the clean column drawn in)
for a, b, ref in HANDS.values():
    for x in range(a, b): tops[x] = tops.get(ref, edge_y(ref))
for x in range(395, 1560): tops[x] = 556  # (behind the flowers and the cake)
top_pts = [(x, tops[x] - 1) for x in range(168, 1810)]
table = poly(CORNER_L + top_pts + CORNER_R + [(1860, 680), (100, 680)]) & op
T = S.copy()
for a, b, ref in HANDS.values():
    ty = edge_y(ref)
    for x in range(a, b):
        T[ty - 3:ty + 12, x] = S[ty - 3:ty + 12, ref]

# --- the cake: the piping's top to the board (its right end meets her hair at x 1383) ---
cake = poly([(592, 394), (1383, 394), (1383, 590), (592, 590)]) & op & ~sticks & ~flame

# --- the flower bunches ---
# his: traced along the leaves' and petals' outlines where they meet his jacket, cuff and hand (zoomed 4-14x): the
# outlines stay with the flowers, everything past them is his
DAN_EDGE = [(512, 372), (511.5, 400), (511, 410.5), (496.5, 411), (496.5, 427), (503.5, 441), (505, 444.5), (498, 446),
            (491, 449), (486.5, 455), (487.5, 464.5), (482.5, 466), (471, 465), (462.5, 467), (464, 471), (467.5, 480),
            (474, 484.5), (480, 485.5), (471, 488), (462.5, 487.5), (451, 491), (446, 495), (444.5, 499), (430, 498.5),
            (415, 499.5), (415, 511), (416, 519), (410, 521), (400, 521.5), (395.5, 521.5), (396.5, 529.4), (399, 536.6),
            (400.5, 541.6), (402.5, 546), (401, 550), (395, 552.5), (390, 558), (384, 567), (372, 600)]
lbunch = poly(DAN_EDGE + [(620, 610), (620, 372)]) & op & ~table & ~cake & ~sticks & ~flame
# hers: her dark hair shows in pockets between the leaves, so inside a loose line through her hair, arm and hand the
# split is a watershed: the leaves (green) and petals (light, not her skin's pink) one way, her hair (dark, not the
# leaves' olive outlines) and everything of hers outside the line the other
ANGE_EDGE = [(1395, 372), (1430, 385), (1475, 410), (1500, 432), (1510, 455), (1522, 480), (1529, 503), (1535, 508),
             (1562, 509), (1563, 520), (1554, 530), (1550, 545), (1560, 556), (1575, 560), (1580, 572), (1580, 610)]
rarea = poly(ANGE_EDGE + [(1150, 610), (1150, 372)]) & op & ~table & ~cake & ~sticks & ~flame
green = L[..., 1] < 125
petal = (L[..., 0] > 195) & (L[..., 1] < 140)
hair = cv2.morphologyEx(((L[..., 0] < 70) & (L[..., 2] - L[..., 1] <= 8)).astype(np.uint8), cv2.MORPH_OPEN, disk(2)) > 0
x0, y0, x1, y1 = 1330, 360, 1640, 625
mk = np.zeros((H, W), np.int32)
mk[op & ~rarea] = 1
mk[table | cake | sticks | flame] = 2
mk[~op] = 3
mk[rarea] = 0
mk[rarea & (green | petal)] = 2
mk[rarea & hair] = 1
ws = mk[y0:y1, x0:x1].copy()
cv2.watershed(np.clip(S[y0:y1, x0:x1], 0, 255).astype(np.uint8), ws)
lab_ws = np.zeros((H, W), np.int32); lab_ws[y0:y1, x0:x1] = ws
# (the watershed's own boundary px: whichever side is nearer)
d1 = cv2.distanceTransform((lab_ws != 1).astype(np.uint8), cv2.DIST_L2, 3)
d2 = cv2.distanceTransform((lab_ws != 2).astype(np.uint8), cv2.DIST_L2, 3)
rbunch = rarea & ((lab_ws == 2) | ((lab_ws == -1) & (d2 <= d1)) | (lab_ws == 3))

front = table | cake | lbunch | rbunch
person = op & ~front & ~sticks & ~flame
dan = person & (xx < MIDDLE)
ange = person & (xx >= MIDDLE)

# --- what's behind the flowers, for when they slide: each one's own px filled in behind the opaque flowers, inside
# their outline carried on down (his jacket's edge from x 511 to the table; her hair's edge from x 1392) ---
behind = {"dan": poly([(511, 405), (522, 557), (300, 557), (300, 405)]),
          "ange": poly([(1392, 380), (1384, 557), (1600, 557), (1600, 380)])}
layer = {}
for who, m in (("dan", dan), ("ange", ange)):
    fill = behind[who] & front & (Sa > 0.98) & ~m
    ys, xs = np.where(dil(fill, 12))
    by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    known = m[by0:by1, bx0:bx1]
    c = cv2.inpaint(np.clip(B[by0:by1, bx0:bx1], 0, 255).astype(np.uint8), (~known).astype(np.uint8), 8, cv2.INPAINT_TELEA)
    rgb = B.copy()
    rgb[by0:by1, bx0:bx1][fill[by0:by1, bx0:bx1]] = c[fill[by0:by1, bx0:bx1]]
    a = np.where(m, Sa, 0) + np.where(fill, 1.0, 0)
    layer[who] = (rgb, a, fill)
# her dress runs off the picture's right edge (x 1999, y 589-666), and that edge would show once she slides left: it
# gets its own outline instead (her dress's own ink, ~3 px), carried on down from where it leaves the picture (x 1986.5
# at y 581), the dress cut away past it
rgb, a, fill = layer["ange"]
xo = 1986.5 + np.clip(yy - 581, 0, None) * 7.5 / 86
d = xx - xo
zone = (yy >= 581) & (xx >= 1970)
w = (np.clip(2.0 - np.abs(d), 0, 1) * zone)[..., None]
layer["ange"] = (rgb * (1 - w) + np.array([6, 6, 10], np.float32) * w, np.where(zone, a * np.clip(2.0 - d, 0, 1), a), fill)

# --- the face pieces ---
def patch(X, who):
    # what the face picture X changes on the bare face, a few px round it, edges softened (X = the bare face there)
    d = (np.abs(X - B).max(2) > 4) & (dan if who == "dan" else ange)
    m = dil(d, 3)
    return np.dstack([X, np.clip(cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2) * 1.4, 0, 1) * Sa])
# the eyes (the toast's, put on): what they change on the featureless face, round each one's placed middle; closed =
# that featureless skin; each eye's corners and lid for the lash line drawn in code
EYES = {"dan": [(512, 247), (597, 260)], "ange": [(1401, 263), (1497, 266)]}
eyes_ts, lids = {}, {}
for who, cs in EYES.items():
    d = (np.abs(B - P).max(2) > 12) & (dan if who == "dan" else ange)
    n, cc, st, _ = cv2.connectedComponentsWithStats(d.astype(np.uint8), connectivity=8)
    em = np.zeros((H, W), bool)
    geo = []
    for (cx, cy) in cs:
        # (within an oval round it: the brows sit ~50 px up, and her hair's repainted edges join up with them)
        oval = (((xx - cx) / 52) ** 2 + ((yy - cy) / 28) ** 2) <= 1
        core = np.unique(cc[(np.hypot(xx - cx, yy - cy) <= 8) & d])
        e = np.isin(cc, core[core > 0]) & oval
        # (and every lash within a few px of it)
        near = np.unique(cc[dil(e, 3) & d & oval])
        e |= np.isin(cc, [i for i in near if i > 0 and st[i, cv2.CC_STAT_AREA] >= 6]) & oval
        e = cv2.morphologyEx(e.astype(np.uint8), cv2.MORPH_CLOSE, disk(3)) > 0
        ys, xs = np.where(e)
        # (the corners: its ends across its middle, not the lash wings' tips)
        bd = np.abs(ys - cy) <= 8
        l, r = xs[bd].min(), xs[bd].max()
        ly, ry = ys[bd & (xs <= l + 2)].mean(), ys[bd & (xs >= r - 2)].mean()
        mid = (xs > (l + r) / 2 - 3) & (xs < (l + r) / 2 + 3)
        geo.append(dict(l=[int(l), round(float(ly), 1)], r=[int(r), round(float(ry), 1)], top=int(ys[mid].min()), bot=int(ys[mid].max())))
        em |= e
    Lb = lab(B)
    ink = B[em & (Lb[..., 0] <= np.percentile(Lb[..., 0][em], 6))].mean(0)
    eyes_ts[who] = dict(eyes=geo, ink="#%02X%02X%02X" % (int(ink[2]), int(ink[1]), int(ink[0])))
    # (the featureless skin in the eye itself, the face as it is round it: her hair's edge by the far lashes stays)
    lids[who] = np.dstack([np.where(dil(em, 2)[..., None], P, B), cv2.GaussianBlur(dil(em, 3).astype(np.float32), (0, 0), 1.2)])
# the pursed lips (the biggest piece of red the blowing face adds) and their front tip: his rightmost, her leftmost
Lf = lab(F)
lips, lipm = {}, {}
for who, m in (("dan", dan), ("ange", ange)):
    red = (Lf[..., 1] > 145) & (np.abs(F - B).max(2) > 4) & m
    n, cc, st, _ = cv2.connectedComponentsWithStats(red.astype(np.uint8), connectivity=8)
    lm = cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    lm = cv2.morphologyEx(lm.astype(np.uint8), cv2.MORPH_CLOSE, disk(2)) > 0
    ys, xs = np.where(lm)
    tip = xs.max() if who == "dan" else xs.min()
    lips[who] = [int(tip), round(float(ys[np.abs(xs - tip) <= 2].mean()), 1)]
    lipm[who] = dil(lm, 2)  # (with their own darker edge)
# the kiss: his face's edge is ~20 px past his lips (his cheek, turned), so for it his pursed lips (and the shade under
# them) push forward as far as they go and stay inside his jaw's line (the moustache stays, the skin where they were is
# the bare face's), and hers come over his face's edge to meet them (`ange.lips`: just her lips, drawn over him)
diff = (np.abs(F - B).max(2) > 4) & dan
lt = np.where(lipm["dan"].any(1))[0]
under = diff & (yy > lt.min() + 6) & ~lipm["dan"]  # (the shade under his lips)
lip_rows = [y for y in lt if lipm["dan"][y].any()]
push = min(int(np.where(dan[y, :MIDDLE])[0].max()) - int(np.where(lipm["dan"][y])[0].max()) for y in lip_rows) - 5
src = lipm["dan"] | under
moved = np.zeros((H, W), bool); moved[:, push:] = src[:, :-push]
K = np.where((diff & ~src)[..., None], F, B)
K[moved] = np.roll(F, push, axis=1)[moved]
ka = np.clip(cv2.GaussianBlur(dil(diff | lipm["dan"] | moved, 3).astype(np.float32), (0, 0), 1.2) * 1.4, 0, 1) * Sa
kiss = np.dstack([K, ka])
lips["dan.kiss"] = [lips["dan"][0] + push, lips["dan"][1]]
ange_lips = np.dstack([F, cv2.GaussianBlur(lipm["ange"].astype(np.float32), (0, 0), 0.7)])

# --- save ---
def save(name, rgb, a):
    ys, xs = np.where(a > 0.004)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    o = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), np.clip(a[y0:y1, x0:x1] * 255, 0, 255)]).astype(np.uint8)
    cv2.imwrite(f"{PD}/{name}.png", o, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

boxes = {}
boxes["front"] = save("cake-front", T, np.where(front, Sa, 0))
boxes["sticks"] = save("cake-sticks", S, np.where(sticks, Sa, 0))
for i, fl in enumerate(flames):
    boxes[f"flame{i + 1}"] = save(f"cake-flame-{i + 1}", S, np.where(fl, Sa, 0))
for who in ("dan", "ange"):
    rgb, a, _ = layer[who]
    boxes[who] = save(f"cake-{who}", rgb, a)
    for name, X in (("blow", F), ("smile", M)):
        pc = patch(X, who)
        boxes[f"{who}.{name}"] = save(f"cake-{who}-{name}", pc[..., :3], pc[..., 3])
    boxes[f"{who}.lids"] = save(f"cake-{who}-lids", lids[who][..., :3], lids[who][..., 3])
boxes["dan.kiss"] = save("cake-dan-kiss", kiss[..., :3], kiss[..., 3])
boxes["ange.lips"] = save("cake-ange-lips", ange_lips[..., :3], ange_lips[..., 3])
# (every px of the picture is in exactly one piece)
total = (front.astype(int) + sticks + flame + dan + ange)[op]
assert total.min() == 1 and total.max() == 1, (total.min(), total.max())

ts = ["// The candle scene's pieces (stage key 3), made by trace/cake-cut.py from cake-source.png + master-face.py's cake faces:",
      "// each piece's box in the picture ([x, y, w, h], picture px); the candles (stick columns, top, where the piping",
      "// covers it, the flame's box, the wick: [x, top, bottom]); the eyes (corners, lids, lash colour) for the blinks drawn",
      "// in code; and where each one's pursed lips reach (the front tip: his rightmost, hers leftmost; his pushed out to his",
      "// face's edge for the kiss, `dan.kiss`).",
      "export const CAKE = {",
      f"  size: [{W}, {H}] as const,",
      "  boxes: {"]
ts += [f'    "{k}": {json.dumps(v)},' for k, v in boxes.items()]
ts += ["  } as Record<string, number[]>,", "  candles: ["]
ts += [f"    {json.dumps(c)}," for c in candles]
ts += ["  ],", "  eyes: {"]
ts += [f"    {k}: {json.dumps(v)}," for k, v in eyes_ts.items()]
ts += ["  },", f"  lips: {json.dumps(lips)},", "};", ""]
open(f"{PD}/cakeParts.ts", "w").write("\n".join(ts))

# the check: who owns what (and, in fill-*.png, each one's layer alone with what's filled in behind the flowers)
tint = S.copy() * 0.45
for m, c in ((dan, (60, 60, 255)), (ange, (255, 120, 40)), (front, (60, 200, 60)), (sticks, (0, 220, 255)), (flame, (0, 140, 255))):
    tint[m] = tint[m] + np.array(c, np.float32) * 0.55
tint = np.clip(tint * Sa[..., None] + 40 * (1 - Sa[..., None]), 0, 255).astype(np.uint8)
cv2.imwrite(f"{chk}/owners.png", tint)
ZOOM = {"lflowers": (370, 370, 630, 610), "rflowers": (1340, 370, 1600, 610)}
for name, (x0, y0, x1, y1) in ZOOM.items():
    cv2.imwrite(f"{chk}/owners-{name}.png", cv2.resize(tint[y0:y1, x0:x1], ((x1 - x0) * 3, (y1 - y0) * 3), interpolation=cv2.INTER_NEAREST))
for who, name in (("dan", "lflowers"), ("ange", "rflowers")):
    rgb, a, _ = layer[who]
    x0, y0, x1, y1 = ZOOM[name]
    v = (rgb * a[..., None] + 40 * (1 - a[..., None]))[y0:y1, x0:x1]
    cv2.imwrite(f"{chk}/fill-{who}.png", cv2.resize(np.clip(v, 0, 255).astype(np.uint8), ((x1 - x0) * 3, (y1 - y0) * 3), interpolation=cv2.INTER_NEAREST))
print(json.dumps(boxes)); print(json.dumps(candles)); print(json.dumps(eyes_ts)); print(json.dumps(lips))
