# One face in every picture: the toast picture's faces (the master: eyes, brows, nose, mouth, Dan's moustache) laid onto a
# new AI picture's heads (the piggyback first, round 14), whose own faces drift picture to picture.
#   .venv/bin/python -I src/wedding/trace/master-face.py src/wedding/painted/toast-source.png \
#       src/wedding/painted/piggy-source.png <out dir>
# -> <out dir>/piggy-faces.png, plus checks: a line per feature printed + features.png (master | result, flagged rows
#    red), *-debug.png (red hair, blue painted out, yellow the moved boxes), *-tdebug.png, *-moved.png,
#    *-painted-out.png. A new picture = new PIGGY numbers (ovals + landmarks + hairlines, measured).
#   A 4th argument picks the new picture's numbers (default piggy): `cake` (the candle picture, round 22: the master's eyes
#   glancing aside, the picture's own blowing lips kept with the master's nose, and Dan's moustache and chin tuft, round
#   them), `cake-smile` (the master's mouths) or `cake-bare` (no mouth) -> <out dir>/<target>-faces.png
# 1. toast: each feature's box filled with the skin round it (S_t); the feature = toast - S_t (a signed difference, so
#    it takes on the new picture's own skin tone and blush)
# 2. piggy: its own eyes, brows, nose, mouth painted out the same way (S_p), only the features; where the hair lies over
#    them (Ange's eye corners), a measured hairline: the hair side stays, the face side is all face
# 3. the toast landmarks fitted onto the piggy's: turn, size, and for a 3/4 head a squash across the face; result =
#    S_p + the moved difference, only inside the piggy's face (never the hair)
import sys, json
import numpy as np, cv2

tp, pp, out = sys.argv[1:4]
target = sys.argv[4] if len(sys.argv) > 4 else "piggy"

def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    return im[..., :3].astype(np.float32), im[..., 3].astype(np.float32) / 255

T, Ta = load(tp)
G, Ga = load(pp)

def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def dil(m, r): return cv2.dilate(m.astype(np.uint8), disk(r)) > 0
def lab(img): return cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
def boxes(shape, bs):
    m = np.zeros(shape, bool)
    for x0, y0, x1, y1 in bs: m[y0:y1, x0:x1] = True
    return m
def polys(shape, ps):
    m = np.zeros(shape, np.uint8)
    for p in ps: cv2.fillPoly(m, [np.round(np.array(p)).astype(np.int32)], 1)
    return m > 0
def ellipses(shape, es):
    m = np.zeros(shape, np.uint8)
    for cx, cy, rx, ry, ang in es: cv2.ellipse(m, (int(cx), int(cy)), (int(rx), int(ry)), ang, 0, 360, 1, -1)
    return m > 0

def harmonic(v, reg, kn, iters=300):
    # 4-neighbour averaging over reg (unknown) + kn (fixed); a half-size solve first gives the start (big areas converge)
    h, w = reg.shape
    if reg.sum() > 150 and h > 12 and w > 12:
        sz = (w // 2, h // 2)
        kf = kn.astype(np.float32)
        ks = cv2.resize(kf, sz, interpolation=cv2.INTER_AREA)
        vs = cv2.resize(v * kf[..., None], sz, interpolation=cv2.INTER_AREA) / np.maximum(ks, 1e-6)[..., None]
        kns = ks > 0.5
        regs = (cv2.resize(reg.astype(np.float32), sz, interpolation=cv2.INTER_AREA) > 0) & ~kns
        vs[regs] = cv2.resize(v, sz, interpolation=cv2.INTER_AREA)[regs]
        vs = harmonic(vs, regs, kns, iters)
        ok = (regs | kns).astype(np.float32)
        up = cv2.resize(vs * ok[..., None], (w, h), interpolation=cv2.INTER_LINEAR) / np.maximum(cv2.resize(ok, (w, h), interpolation=cv2.INTER_LINEAR), 1e-6)[..., None]
        good = cv2.resize(ok, (w, h), interpolation=cv2.INTER_LINEAR) > 0.05
        v = v.copy(); v[reg & good] = up[reg & good]
    wt = (reg | kn).astype(np.float32)
    k = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], np.float32)
    den = cv2.filter2D(wt, -1, k, borderType=cv2.BORDER_CONSTANT)
    for _ in range(iters):
        num = np.stack([cv2.filter2D(v[..., c] * wt, -1, k, borderType=cv2.BORDER_CONSTANT) for c in range(3)], -1)
        v[reg] = (num / np.maximum(den, 1e-6)[..., None])[reg]
    return v

def fill(img, region, known):
    # region filled from the known pixels round it (a TELEA start, then the averaging)
    H, W = region.shape
    ys, xs = np.where(region)
    y0, y1, x0, x1 = max(ys.min() - 4, 0), min(ys.max() + 5, H), max(xs.min() - 4, 0), min(xs.max() + 5, W)
    reg, kn = region[y0:y1, x0:x1], known[y0:y1, x0:x1] & ~region[y0:y1, x0:x1]
    seed = cv2.inpaint(np.clip(img[y0:y1, x0:x1], 0, 255).astype(np.uint8), (~kn).astype(np.uint8), 8, cv2.INPAINT_TELEA)
    v = img[y0:y1, x0:x1].copy(); v[reg] = seed[reg]
    v = harmonic(v, reg, kn)
    o = img.copy(); o[y0:y1, x0:x1][reg] = v[reg]
    return o

def hair_of(img, a, region, skin, tol=28, r=7, back=3, browns=False):
    # what isn't skin and runs on past the feature areas: the hair, the face's outline, the ear (never moved, never painted
    # out). Strokes thinner than 2r (a lash wing, a brow touching the hair) are broken first, so a feature joined to the
    # hair by one stays a feature; the hair gets its own edges back (`back` px)
    # (`browns`: its mass from the browns alone, L >= 25: the near-black lashes and lid lines (L ~0-5; the hair is L ~45)
    # never join it)
    far = (np.linalg.norm(lab(img) - skin, axis=2) > tol) | (a < 0.98)
    mass = far & (lab(img)[..., 0] >= 25) if browns else far
    thick = cv2.morphologyEx(mass.astype(np.uint8), cv2.MORPH_OPEN, disk(r)) > 0
    n, cc = cv2.connectedComponents(thick.astype(np.uint8), connectivity=8)
    out = np.unique(cc[thick & ~dil(region, 2)])
    hair = np.isin(cc, out[out > 0])
    # (its edges grown back through touching pixels only: a speck a few px off it isn't hair)
    for _ in range(back):
        hair = dil(hair, 1) & far
    return hair

def holes(m):
    n, cc = cv2.connectedComponents((~m).astype(np.uint8), connectivity=4)
    edge = np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))
    return m | ~np.isin(cc, edge)

def whole_eye(img, a, skin, oval, box, hair, grow=16):
    # one eye, whole: its body inside the measured oval (the eye's middle and half-sizes: the whites, iris, lid line; never
    # the hair the oval reaches at the outer corners: it rode along as a dark smudge, round 17); then the lid line, lashes
    # and outer wings grown out from it through near-black ink only (L < 22: the lashes are ~5, her darkest hair 25-45), over
    # the hair too (her eye corners are drawn on it: without them the whites showed past the outline, rounds 16-17), up to
    # 16 px (her thick lid line joins the hair through the wing, so the hair test takes it too: the wing tips are 12-14 px
    # out), inside the oval grown 10 px wide and 4 px tall (never up a hair strand); then what that outline closes round
    # inside the oval (the white at the corner)
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy, hw, hh = oval
    ov = (((xx - cx) / (hw + 2)) ** 2 + ((yy - cy) / (hh + 2)) ** 2) <= 1
    far = (np.linalg.norm(lab(img) - skin, axis=2) > 28) | (a < 0.98)
    body = holes(cv2.morphologyEx((far & ov & ~dil(hair, 1)).astype(np.uint8), cv2.MORPH_CLOSE, disk(2)) > 0) & ov & ~dil(hair, 1)
    bm = boxes(a.shape, [box])
    reach = (((xx - cx) / (hw + 10)) ** 2 + ((yy - cy) / (hh + 4)) ** 2) <= 1
    black = (lab(img)[..., 0] < 22) & bm & reach
    eye = body
    for _ in range(grow):
        eye = eye | (dil(eye, 1) & black)
    eye |= holes(eye) & ov & far
    return eye & bm

def whole_brow(img, a, skin, core, box, hair, grow=45):
    # one brow, whole: grown from its middle (a measured oval) along its own ink (anything off the skin) to both ends,
    # never within 2 px of the hair; its box only bounds it (a tight box sliced the brows' ends off, round 17)
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy, hw, hh = core
    far = (np.linalg.norm(lab(img) - skin, axis=2) > 20) & boxes(a.shape, [box]) & ~dil(hair, 2)
    brow = far & ((((xx - cx) / hw) ** 2 + ((yy - cy) / hh) ** 2) <= 1)
    for _ in range(grow):
        brow = brow | (dil(brow, 1) & far)
    return brow

def band(shape, spine):
    # a soft stroke along measured points (x, y, half-thickness), drawn at 4x and brought down
    H, W = shape
    m = np.zeros((H * 4, W * 4), np.uint8)
    for (x0, y0, r0), (x1, y1, r1) in zip(spine, spine[1:]):
        for t in np.linspace(0, 1, int(np.hypot(x1 - x0, y1 - y0) * 4) + 2):
            x, y, r = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t
            cv2.circle(m, (int(round(x * 4 + 1.5)), int(round(y * 4 + 1.5))), max(int(round(r * 4)), 1), 255, -1, cv2.LINE_AA)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255

def skin_known(img, a, region, ref_box, tol=22, ring=1):
    # (`ring`: px left out round the region, neither filled nor known; 0 = the fill meets the skin right at its edge)
    L = lab(img)
    x0, y0, x1, y1 = ref_box
    skin = np.median(L[y0:y1, x0:x1].reshape(-1, 3), 0)
    return (a > 0.98) & ~dil(region, ring) & (np.linalg.norm(L - skin, axis=2) < tol) & (L[..., 0] > 120), skin

# --- measured (px in each picture) ---
# toast feature boxes (brows, eyes, nose+mouth+moustache) and landmarks; the skin reference = the nose bridge
TOAST = {
    "dan": dict(
        boxes=[(298, 234, 400, 280), (430, 236, 534, 284), (312, 271, 392, 310), (439, 271, 522, 312), (338, 328, 490, 416)],
        bridge=(395, 285, 435, 305),
        brows=[((349, 256, 18, 5), 0), ((482, 259, 18, 5), 1)],
        eyes=[((347.5, 289, 39, 16), 2), ((482, 292, 39, 16), 3)],
        narrow={1: 0.85, 3: 0.85},
        pts=dict(browL=(349, 256), browR=(482, 259), eyeL=(351, 290), eyeR=(480, 291), mouthL=(362, 362), mouthR=(470, 362), mouth=(415, 380)),
        # (for a glance: each eye's iris (middle x, radius) and corners (x), zoomed 6x; for a picture keeping its own
        # mouth: the mouth (lips, teeth and their line), and the nose, moustache and chin tuft round it, each moved on its
        # own, zoomed 5x; for a 3/4 head: the mouth (smile, moustache, tuft) in halves at its middle)
        irises={2: (355.6, 17, 314, 381), 3: (474.8, 17, 448, 516)},
        lips=[(358, 363), (375, 356), (399, 355), (415, 358), (431, 355), (455, 357), (467, 364), (456, 381), (436, 399),
              (415, 403), (395, 400), (374, 386)],
        subs={"nose": (385, 326, 442, 345), "moustache L": (342, 345, 413, 384), "moustache R": (413, 345, 484, 384),
              "chin": (395, 400, 430, 412), "smile L": (338, 345, 415, 416), "smile R": (415, 345, 490, 416)},
    ),
    "ange": dict(
        boxes=[(788, 300, 870, 338), (898, 298, 992, 340), (794, 327, 869, 383), (907, 324, 984, 381), (842, 388, 938, 460)],
        bridge=(874, 345, 902, 365),
        # her brows run under her hair: the right one shows end to end (over the hair at its outer end, two hair strands
        # across it), so it's measured along its middle (x, y, half its thickness; zoomed 9x) with the strands painted out
        # in its own colour; the left one's outer half is hidden under a lock, so it's the right one mirrored (they match
        # where both show) (round 17)
        brow_spines=[dict(box=1, strands=True, spine=[(911.2, 326.4, 0.6), (916, 321.5, 3.5), (924, 319.5, 4.2), (934, 317.6, 5.0),
                                                       (944, 316.3, 5.2), (954, 316.2, 5.2), (964, 317, 5.0), (973, 317.8, 3.6),
                                                       (979.6, 319.8, 0.6)]),
                     dict(box=0, mirror=(1, 1775))],
        eyes=[((832, 354, 31, 23), 2), ((949, 353, 35, 22), 3)],
        pts=dict(browL=(843, 322), browR=(936, 321), eyeL=(833, 355), eyeR=(945, 352), mouthL=(851, 424), mouthR=(928, 422), mouth=(890, 437)),
        irises={2: (836.3, 17.5, 806, 858), 3: (943, 18, 917, 970)},
        subs={"nose": (878, 388, 902, 410), "smile L": (842, 410, 890, 460), "smile R": (890, 410, 938, 460)},
    ),
}
# the piggy's own features to paint out (ellipses: middle, half-sizes, turn) and its landmarks; skin reference = a cheek
PIGGY = {
    "dan": dict(
        ell=[(869, 457, 58, 22, 20), (982, 507, 36, 18, 26), (849, 500, 52, 37, 20), (964, 546, 34, 31, 20), (872, 588, 78, 50, 23)],
        ref=(790, 520, 815, 545),
        face=(730, 410, 1010, 700),
        pts=dict(browL=(867, 456), browR=(982, 507), eyeL=(847, 500), eyeR=(963, 546), mouthL=(822, 565), mouthR=(925, 610), mouth=(873, 592)),
        squash=True,
    ),
    "ange": dict(
        ell=[(532, 302, 30, 13, -30), (612, 260, 30, 13, -30), (542, 351, 39, 35, -30), (637, 297, 39, 33, -30), (614, 371, 46, 36, -30)],
        ref=(575, 300, 595, 318),
        face=(480, 220, 700, 460),
        # where her hair lies over her old eyes, measured (zoomed 7x): the lock over the upper eye (its lower edge, then the
        # old lid line's top) and the strand by the lower eye (its edge: its own outline above the eye, round 17); the hair
        # side stays the picture's own, the face side is all face (the old lashes there go). The old lower eye's lid ran on
        # over the strand (black steps by the new eye, round 17): `under` fills it from the hair, and its new edge gets the
        # outline only where it changed (above, the strand keeps its own)
        hairlines=[
            dict(line=[(596, 236), (604, 244), (613, 250), (622, 257), (632, 263), (641, 268), (650, 271), (660, 274),
                       (670, 277), (678, 282), (683, 288)],
                 hair=[(700, 288), (700, 225), (596, 225)], face=[(683, 296), (681, 306), (596, 306)], outline=True),
            dict(line=[(509, 284), (509.5, 300), (510.5, 310), (510.5, 323), (510, 340), (507, 355), (503, 370), (499, 385),
                       (495, 398)],
                 hair=[(470, 398), (470, 284)], face=[(560, 398), (560, 284)], under=True, outline="changed"),
        ],
        pts=dict(browL=(532, 302), browR=(612, 260), eyeL=(542, 351), eyeR=(637, 297), mouthL=(584, 385), mouthR=(646, 349), mouth=(612, 372)),
        squash=False,
    ),
}
# the candle picture (round 22): 3/4 heads turned to each other (his far side on the right, hers on the left), blowing.
# Their own pursed lips stay (`parts`: the master's nose over them, and Dan's moustache, gathered in, and chin tuft, in
# place of the master's mouth); the master's eyes glance toward the candles (`gaze`: master px along the eye); each
# feature placed by hand (`place`: its middle, or a master point, onto the picture's px; `follow`: a brow kept over its
# eye as in the master), the far eye and brow narrowed for the turn (`narrow`, by name). Zoomed 5x.
CAKE = {
    "dan": dict(
        ell=[(520, 202, 50, 15, 0), (606, 216, 16, 10, 20), (512, 245, 40, 28, 0), (597, 259, 17, 26, 0), (578, 290, 13, 11, 0)],
        ref=(520, 298, 545, 318),
        face=(440, 160, 630, 390),
        pts=dict(browL=(520, 201), browR=(606, 216), eyeL=(512, 246), eyeR=(597, 259), mouth=(571, 326)),
        squash=False,
        # (his far eye and brow run into his face's outline and curls: the face's edge there, zoomed 8x; below the eye, the
        # inner edge of the light rim along his cheek, which stays whole, 6x)
        hairlines=[dict(line=[(617, 188), (618, 200), (618, 228), (613, 236), (609, 246), (606, 255), (602, 265), (600.5, 275),
                              (600, 288), (599.5, 300), (599, 310)],
                        hair=[(640, 310), (640, 188)], face=[(560, 310), (560, 188)])],
        known_tol=255,
        ring=0,
        gaze={2: 5, 3: 5},
        # (the moustache in halves meeting under the nose: the far one narrower, for the turn)
        parts=["nose", "moustache L", "moustache R", "chin"],
        own_lips=True,
        narrow={"brow R": 0.45, "eye R": 0.45, "nose": 0.85, "moustache L": 0.65, "moustache R": 0.45, "chin": 0.8},
        place={"eye L": (512, 247), "eye R": (597, 260), "nose": ((413, 338), (578, 291)),
               "moustache L": ((412.5, 352), (572, 305)), "moustache R": ((412.5, 352), (572, 305)), "chin": ((411, 405), (569, 347))},
        follow={"brow L": "eye L", "brow R": "eye R"},
    ),
    "ange": dict(
        ell=[(1407, 210, 14, 10, -20), (1478, 209, 23, 10, 8), (1400, 262, 21, 30, 0), (1499, 265, 44, 28, 0), (1421, 302, 9, 7, 0)],
        ref=(1470, 305, 1490, 320),
        face=(1370, 185, 1565, 378),
        pts=dict(browL=(1407, 210), browR=(1478, 209), eyeL=(1400, 262), eyeR=(1498, 265), mouth=(1425, 336)),
        squash=False,
        # (her brows' outer ends and her eyes' lashes run into her hair on both sides: its edge there, zoomed 7-8x)
        # (on the left, the line runs down her hair's soft shadow's edge on her forehead, keeping it, to her brow's end, then
        # down her hair's outline; zoomed 10x)
        hairlines=[dict(line=[(1414, 168), (1411, 180), (1408, 190), (1405, 197), (1399, 201), (1396, 206), (1393, 214), (1390, 222),
                              (1386, 234), (1382, 246), (1381, 260), (1381, 275), (1382, 288), (1383, 300)],
                        hair=[(1360, 300), (1360, 168)], face=[(1430, 300), (1430, 168)], outline="changed"),
                   dict(line=[(1488, 178), (1491, 192), (1495, 200), (1497.5, 207), (1500, 217), (1504, 225), (1507, 230), (1512, 236),
                              (1521, 247), (1530, 258), (1540, 270), (1548, 276), (1560, 282), (1572, 292)],
                        hair=[(1580, 292), (1580, 178)], face=[(1560, 300), (1460, 300), (1460, 178)], outline="changed")],
        # (and her hair's own outline along both new edges, where they changed: a smooth line, not the cut's px steps)
        # (filled from all the shading round the old features, her hair's soft shadow too, not only the plain skin: a fill
        # from the plain skin left lighter ovals where her big eyes and brows were)
        known_tol=255,
        # (and right at its edge: a 1 px ring left between cut the fill off from the skin round it, so it went flat)
        ring=0,
        gaze={2: -5, 3: -5},
        parts=["nose"],
        own_lips=True,
        narrow={"brow L": 0.6, "eye L": 0.6},
        place={"eye L": (1401, 263), "eye R": (1497, 266), "nose": ((889, 399), (1421, 302))},
        follow={"brow L": "eye L", "brow R": "eye R"},
    ),
}
# the same with the master's mouths, smiling (their lips painted out too): the nose where it was, the mouth in halves
# meeting at its middle on the pursed lips' middle, the far half narrower for the turn
CAKE_SMILE = {
    "dan": {**CAKE["dan"], "ell": CAKE["dan"]["ell"] + [(571, 326, 17, 17, 0)], "parts": ["nose", "smile L", "smile R"],
            "own_lips": False, "narrow": {**CAKE["dan"]["narrow"], "smile L": 0.75, "smile R": 0.45},
            "place": {**CAKE["dan"]["place"], "smile L": ((415, 380), (569, 328)), "smile R": ((415, 380), (569, 328))}},
    "ange": {**CAKE["ange"], "ell": CAKE["ange"]["ell"] + [(1425, 336, 15, 18, 0)], "parts": ["nose", "smile L", "smile R"],
             "own_lips": False, "narrow": {**CAKE["ange"]["narrow"], "smile L": 0.6, "smile R": 0.9},
             "place": {**CAKE["ange"]["place"], "smile L": ((890, 437), (1424, 337)), "smile R": ((890, 437), (1424, 337))}},
}
# and bare: no mouth at all (the lips painted out, only the nose): the scene's base, its mouths drawn over it as pieces
CAKE_BARE = {who: {**CAKE[who], "ell": CAKE_SMILE[who]["ell"], "parts": ["nose"], "own_lips": False} for who in CAKE}
TGT = {"piggy": PIGGY, "cake": CAKE, "cake-smile": CAKE_SMILE, "cake-bare": CAKE_BARE}[target]

def glance(img, box, iris, dx):
    # an eye looking aside: its iris slid dx px along the eye (the white squeezed on that side, opened on the other), the
    # lid and its wing sliding along themselves, the corners staying put
    cx, r, c0, c1 = iris
    x0, y0, x1, y1 = box
    xs = np.arange(x0, x1, dtype=np.float32)
    lo, hi = cx - r + dx, cx + r + dx
    ss = lambda u: np.clip(u, 0, 1) ** 2 * (3 - 2 * np.clip(u, 0, 1))
    w = np.where(xs < lo, ss((xs - c0) / (lo - c0)), np.where(xs > hi, ss((c1 - xs) / (c1 - hi)), 1))
    mx = np.tile(xs - dx * w, (y1 - y0, 1)).astype(np.float32)
    my = np.repeat(np.arange(y0, y1, dtype=np.float32)[:, None], x1 - x0, 1)
    o = img.copy()
    o[y0:y1, x0:x1] = cv2.remap(img, mx, my, cv2.INTER_CUBIC)
    return o

for who in ("dan", "ange"):
    for i, dx in TGT[who].get("gaze", {}).items():
        T = glance(T, TOAST[who]["boxes"][i], TOAST[who]["irises"][i], dx)

def fit(src, dst, squash):
    # dst = R(th) diag(s k, s) src + t, least squares over th, s, k (k = 1 unless squash), t
    src, dst = np.array(src, np.float64), np.array(dst, np.float64)
    best = None
    for th in np.radians(np.arange(-45, 45.01, 0.25)):
        c, s_ = np.cos(th), np.sin(th)
        R = np.array([[c, -s_], [s_, c]])
        d = dst @ R  # rotate dst back: R^T dst
        # d = diag(s k, s) src + t'  -> independent fits for x and y
        sc = src - src.mean(0); dc = d - d.mean(0)
        sy = (sc[:, 1] @ dc[:, 1]) / (sc[:, 1] @ sc[:, 1])
        sx = (sc[:, 0] @ dc[:, 0]) / (sc[:, 0] @ sc[:, 0]) if squash else None
        if not squash:
            s = (sc[:, 0] @ dc[:, 0] + sc[:, 1] @ dc[:, 1]) / (sc ** 2).sum()
            sx = sy = s
        A = R @ np.diag([sx, sy])
        t = dst.mean(0) - A @ src.mean(0)
        err = np.linalg.norm(src @ A.T + t - dst, axis=1)
        if best is None or (err ** 2).sum() < best[0]:
            best = ((err ** 2).sum(), A, t, np.degrees(th), sx, sy, err)
    return best

res = G.copy()
info = {}
NAMES = ["brow L", "brow R", "eye L", "eye R", "mouth"]
report, sheet = [], []
for who in ("dan", "ange"):
    tc, pc = TOAST[who], TGT[who]
    # (a picture keeping its own mouth: the master's nose, moustache, chin tuft in place of its mouth box, never its lips)
    fb = tc["boxes"][:4] + [tc["subs"][p] for p in pc["parts"]] if pc.get("parts") else tc["boxes"]
    names = NAMES[:4] + pc["parts"] if pc.get("parts") else NAMES
    lipm = dil(polys(Ta.shape, [tc["lips"]]), 1) if pc.get("own_lips") and "lips" in tc else np.zeros(Ta.shape, bool)
    # 1. the toast features as a difference over the skin
    tm = boxes(Ta.shape, tc["boxes"])
    kn, skin_t = skin_known(T, Ta, tm, tc["bridge"])
    hair_t = hair_of(T, Ta, tm, skin_t)
    St = fill(T, tm, kn)
    # (only the features' ink moves, not the toast's skin shading round them)
    dE = np.linalg.norm(lab(T) - lab(St), axis=2)
    ink = cv2.GaussianBlur(np.clip((dE - 4) / 10, 0, 1).astype(np.float32), (0, 0), 0.7)
    # (the brows and eyes move whole, at full strength: a brow end to end, every lid line, lash and wing, the whites inside
    # their outlines, plus the eye's crease line round it; the mouth by its ink)
    mass_t = hair_of(T, Ta, tm, skin_t, back=0)
    shapes = {bi: whole_brow(T, Ta, skin_t, core, tc["boxes"][bi], mass_t) for core, bi in tc.get("brows", [])}
    shapes.update({bi: whole_eye(T, Ta, skin_t, oval, tc["boxes"][bi], mass_t) for oval, bi in tc["eyes"]})
    ink_w = ink * ~hair_t
    weights = {}
    for i in range(len(fb)):
        if i not in shapes:
            weights[i] = ink_w * ~lipm
            continue
        w = cv2.GaussianBlur(dil(shapes[i], 1).astype(np.float32), (0, 0), 0.6)
        if any(bi == i for _, bi in tc["eyes"]):
            w = np.maximum(w, ink_w * dil(shapes[i], 6))
        weights[i] = w
    D = T - St
    # (measured brows: their own stroke, strands across it painted out; a mirrored one copies its twin)
    Ds, drawn = {}, set()
    for b in tc.get("brow_spines", []):
        i = b["box"]
        if "spine" in b:
            bw = band(Ta.shape, b["spine"])
            Tc = T
            if b.get("strands"):
                inside = bw > 0.3
                line = dil(inside & (lab(T)[..., 0] < 20), 1) & inside
                Tc = fill(T, line, inside & ~line)
            Ds[i], weights[i], shapes[i] = Tc - St, bw, bw > 0.5
        else:
            j, mx = b["mirror"]
            xs = np.arange(Ta.shape[1]); sx_ = mx - xs; ok = (sx_ >= 0) & (sx_ < Ta.shape[1])
            Dm, wm = np.zeros_like(D), np.zeros(Ta.shape, np.float32)
            Dm[:, ok], wm[:, ok] = Ds[j][:, sx_[ok]], weights[j][:, sx_[ok]]
            bx = boxes(Ta.shape, [tc["boxes"][i]])
            Ds[i], weights[i], shapes[i] = Dm, wm * bx, (wm > 0.5) & bx
        drawn.add(i)
    # 2. the piggy's features painted out: only the features themselves (a few px round each), so its own blush and
    #    shading stay round them; its hair never (the hair test, and where the hair lies over an old eye, the measured
    #    hairline)
    ell = ellipses(Ga.shape, pc["ell"])
    _, skin2 = skin_known(G, Ga, ell, pc["ref"])
    hair_p = hair_of(G, Ga, ell, skin2)
    for hl in pc.get("hairlines", []):
        hair_p |= polys(Ga.shape, [hl["line"] + hl["hair"]])
        hair_p &= ~polys(Ga.shape, [hl["line"] + hl["face"]]) | polys(Ga.shape, [hl["line"] + hl["hair"]])
    far2 = np.linalg.norm(lab(G) - skin2, axis=2) > 22
    feat = ell & far2 & ~hair_p
    pm = dil(feat, 4) & dil(ell, 4) & ~hair_p
    # (and on a hairline's face side, the hair's leftovers past the ovals: the line is then the hair's only edge)
    for hl in pc.get("hairlines", []):
        side = polys(Ga.shape, [hl["line"] + hl["face"]])
        pm |= dil(side & far2 & dil(ell, 10), 1) & side & ~hair_p
    kn2, _ = skin_known(G, Ga, pm, pc["ref"], pc.get("known_tol", 22), pc.get("ring", 1))
    Sp = fill(G, pm, kn2)
    # (then any speck the old features left by them, a few px: a lid line's tip)
    near = dil(ell, 8) & ~hair_p & ~pm
    sp = near & (np.linalg.norm(lab(Sp) - skin2, axis=2) > 15)
    n, cc, st, _ = cv2.connectedComponentsWithStats(sp.astype(np.uint8), connectivity=8)
    specks = np.isin(cc, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] <= 8])
    if specks.any():
        pm |= dil(specks, 1) & ~hair_p
        kn2, _ = skin_known(G, Ga, pm, pc["ref"], pc.get("known_tol", 22), pc.get("ring", 1))
        Sp = fill(G, pm, kn2)
    # (an old lid that ran on over a hairline's hair: its black there, by the line, filled from the hair round it)
    under = np.zeros(Ga.shape, bool)
    for hl in pc.get("hairlines", []):
        if hl.get("under"):
            hs = polys(Ga.shape, [hl["line"] + hl["hair"]])
            ln = np.zeros(Ga.shape, np.uint8)
            cv2.polylines(ln, [np.round(np.array(hl["line"])).astype(np.int32)], False, 1, 1)
            ud = hs & dil(ln > 0, 10) & dil(ell, 8) & (lab(G)[..., 0] < 26)
            if ud.any():
                Sp = fill(Sp, ud, hs & ~ud & (lab(G)[..., 0] >= 26))
                under |= ud
    # 3. fit and move
    keys = [k for k in tc["pts"] if k in pc["pts"]]
    _, A, t, th, sx, sy, err = fit([tc["pts"][k] for k in keys], [pc["pts"][k] for k in keys], pc["squash"])
    info[who] = dict(turn=round(th, 2), sx=round(sx, 3), sy=round(sy, 3), err={k: round(float(e), 1) for k, e in zip(keys, err)})
    H, W = Ga.shape
    Dw = np.zeros_like(G)
    fx0, fy0, fx1, fy1 = pc["face"]
    moves = {}
    kk = lambda i: pc["narrow"].get(names[i], 1) if "narrow" in pc else tc.get("narrow", {}).get(i, 1)
    mid = lambda i: np.array([(fb[i][0] + fb[i][2]) / 2, (fb[i][1] + fb[i][3]) / 2])
    def lands(i):
        # where feature i's middle lands: placed by hand, kept over the feature it follows, or where the fit puts it
        c, Ak = mid(i), A @ np.diag([kk(i), 1])
        pl = pc.get("place", {}).get(names[i])
        if pl is not None:
            src_pt, dst_pt = pl if np.ndim(pl) == 2 else (c, pl)
            return np.array(dst_pt, np.float64) + Ak @ (c - np.array(src_pt, np.float64))
        fo = pc.get("follow", {}).get(names[i])
        if fo is not None:
            j = names.index(fo)
            return lands(j) + Ak @ (c - mid(j))
        return A @ c + t
    for i, (bx0, by0, bx1, by1) in enumerate(fb):
        # each feature on its own, squashed across the face about its middle (a 3/4 head's far side)
        k = kk(i)
        c = np.array([(bx0 + bx1) / 2, (by0 + by1) / 2])
        Af = A @ np.diag([k, 1])
        tf = lands(i) - Af @ c
        moves[i] = np.hstack([Af, tf[:, None]]).astype(np.float32)
        bm = cv2.GaussianBlur(boxes(Ta.shape, [(bx0, by0, bx1, by1)]).astype(np.float32), (0, 0), 1.5)
        # (moved at 2x and brought back down: thin lashes turned and shrunk stay whole, not broken into steps)
        M2 = np.hstack([2 * Af, 2 * (tf - np.array([fx0, fy0]))[:, None]]).astype(np.float32)
        big = cv2.warpAffine(Ds.get(i, D) * (weights[i] * bm)[..., None], M2, (2 * (fx1 - fx0), 2 * (fy1 - fy0)), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0))
        Dw[fy0:fy1, fx0:fx1] += cv2.resize(big, (fx1 - fx0, fy1 - fy0), interpolation=cv2.INTER_AREA)
    # only inside the face: skin-like pixels and what was painted out, in its box, not the hair
    x0, y0, x1, y1 = pc["face"]
    Lg = lab(G)
    facem = ((np.linalg.norm(Lg - skin2, axis=2) < 30) | pm) & (Ga > 0.98) & ~hair_p
    facem &= boxes(Ga.shape, [pc["face"]])
    facem = cv2.morphologyEx(facem.astype(np.uint8), cv2.MORPH_CLOSE, disk(3)) > 0
    fw = cv2.GaussianBlur(facem.astype(np.float32), (0, 0), 0.8)[..., None]
    region = boxes(Ga.shape, [pc["face"]])[..., None]
    res = np.where(region, Sp + Dw * fw, res)
    # (a new hair edge gets the picture's own thin dark hair outline, smooth: on top, the hair's in front)
    for hl in pc.get("hairlines", []):
        if hl.get("outline"):
            ol = np.zeros((H * 4, W * 4), np.uint8)
            cv2.polylines(ol, [np.round(np.array(hl["line"]) * 4 + 1.5).astype(np.int32)], False, 255, 7, cv2.LINE_AA)
            ol = cv2.resize(ol, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)[..., None] / 255
            if hl["outline"] == "changed":
                # (tapering off past the change, never a cut end)
                ol *= cv2.GaussianBlur(dil(pm | under, 3).astype(np.float32), (0, 0), 2)[..., None]
            res = res * (1 - ol) + np.array([3, 5, 11], np.float32) * ol
    # 4. the check, every feature (scripts detect): its box mustn't cut it; how much of it arrives (seen, behind the hair,
    #    cut off elsewhere); its dark (lines, lids, iris, brow) in no more pieces than the master's (a broken corner); a
    #    line the cut stopped mustn't end on open skin (a cut line: the master's line ran on past where it was cut, into
    #    the hair); an eye's white no more open to the skin than the master's (white poking out past the outline); and a
    #    sheet of each, the master beside the result (round 17: "the eyebrow is broken", missed by zooming on the eyes)
    Lt, Lr = lab(T), lab(res)
    def pieces(m, core, joins=None, least=6):
        # the pieces of m (8-connected) with at least `least` px of a darker core (so a lip's soft shadow, right at the
        # line between dark and not, never counts as a piece); `joins` (the hair in front) links what it covers
        n, cc, st, _ = cv2.connectedComponentsWithStats((m | (joins if joins is not None else False)).astype(np.uint8), connectivity=8)
        return sum(int((m & core & (cc == k)).sum()) >= least for k in range(1, n))
    for i, box in enumerate(fb):
        bx0, by0, bx1, by1 = box
        F = shapes.get(i, (weights[i] > 0.5) & boxes(Ta.shape, [box]))
        frame = boxes(Ta.shape, [box]) & ~boxes(Ta.shape, [(bx0 + 1, by0 + 1, bx1 - 1, by1 - 1)])
        # (a part's edge shared with another part, like the moustache's halves meeting under the nose, isn't a cut)
        if pc.get("parts") and i >= 4:
            frame &= ~dil(boxes(Ta.shape, [b for j, b in enumerate(fb) if j >= 4 and j != i]), 1)
        flags = []
        if (F & frame).sum() > 2:
            flags.append(f"CUT by its box ({int((F & frame).sum())} px on the edge)")
        warp = lambda m: cv2.warpAffine(m.astype(np.float32), moves[i], (W, H), flags=cv2.INTER_LINEAR) > 0.5
        Fw = warp(F)
        n = max(int(Fw.sum()), 1)
        seen, behind = (Fw & facem).sum() / n, (Fw & hair_p).sum() / n
        lost = 1 - seen - behind
        if lost > 0.03:
            flags.append(f"{lost:.0%} cut off outside the face")
        # (dark: L < 128 of 255, the brows included, a piece with a core under 96; black: the lines themselves; white: an
        # eye's whites)
        dark_t, dark_r = (Lt[..., 0] < 128) & F, (Lr[..., 0] < 128) & dil(Fw, 1) & ~hair_p
        pt, pr = pieces(dark_t, Lt[..., 0] < 96), pieces(dark_r, Lr[..., 0] < 96, hair_p & dil(Fw, 3))
        if pr > pt:
            flags.append(f"IN PIECES: its dark in {pr} pieces, the master's in {pt}")
        black_t = Lt[..., 0] < 40
        # (a measured brow is drawn whole, tip and all: no line of it was cut)
        cut = warp(F & black_t & dil(black_t & ~F & ~mass_t, 1) & (i not in drawn))
        cut_open = int((cut & facem & ~dil(hair_p, 2)).sum())
        if cut_open > 3:
            flags.append(f"CUT LINE: {cut_open} px of a line the master ran on past the cut end on open skin")
        if any(bi == i for _, bi in tc["eyes"]):
            white = lambda L_: (L_[..., 0] > 200) & (np.abs(L_[..., 1] - 128) < 10) & (np.abs(L_[..., 2] - 128) < 14)
            wt_, wr_ = white(Lt) & F, white(Lr) & dil(Fw, 1)
            ot = int((wt_ & dil(np.linalg.norm(Lt - skin_t, axis=2) < 25, 1)).sum())
            orr = int((wr_ & dil((np.linalg.norm(Lr - skin2, axis=2) < 25) & ~wr_, 1)).sum())
            # (scaled: the result's eye is smaller or bigger than the master's)
            sc = max(wr_.sum(), 1) / max(wt_.sum(), 1)
            if orr > 1.5 * ot * np.sqrt(sc) + 6:
                flags.append(f"WHITE OPEN: {orr} px of white touch the skin (the master's {ot})")
        report.append(f"{who} {names[i]}: {seen:.0%} seen, {behind:.0%} behind the hair" + ("  <- " + "; ".join(flags) if flags else "  ok"))
        # (the sheet row: the master's box, the result round where it landed, both 4x)
        corners = cv2.transform(np.array([[[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]], np.float32), moves[i])[0]
        rx0, ry0 = np.floor(corners.min(0)).astype(int) - 4
        rx1, ry1 = np.ceil(corners.max(0)).astype(int) + 4
        m = np.clip(T[by0 - 4:by1 + 4, bx0 - 4:bx1 + 4], 0, 255).astype(np.uint8)
        r = np.clip(res[ry0:ry1, rx0:rx1], 0, 255).astype(np.uint8)
        sheet.append((f"{who} {names[i]}", m, r, bool(flags)))
    dbg = G.copy() * 0.5
    dbg[hair_p] = (0, 0, 255); dbg[pm] = (255, 120, 0)
    dbg[facem & ~dil(facem, 0) | (dil(facem, 1) & ~facem)] = (0, 255, 0)
    wm = cv2.warpAffine(np.ones(Ta.shape, np.float32) * 0 + boxes(Ta.shape, tc["boxes"]).astype(np.float32), np.hstack([A, t[:, None]]).astype(np.float32), (W, H)) > 0.5
    dbg[wm & ~dil(wm, 0) | (dil(wm, 1) & ~wm)] = (255, 255, 0)
    cv2.imwrite(f"{out}/{who}-debug.png", dbg[y0:y1, x0:x1].astype(np.uint8))
    tdbg = T.copy() * 0.5
    tdbg[ink > 0.5] = T[ink > 0.5]; tdbg[hair_t] = tdbg[hair_t] * 0.4 + np.array([0, 0, 150])
    bx = np.array(tc["boxes"]); tx0, ty0 = bx[:, :2].min(0) - 20; tx1, ty1 = bx[:, 2:].max(0) + 20
    cv2.imwrite(f"{out}/{who}-tdebug.png", tdbg[ty0:ty1, tx0:tx1].astype(np.uint8))
    cv2.imwrite(f"{out}/{who}-moved.png", np.clip(128 + Dw, 0, 255).astype(np.uint8)[y0:y1, x0:x1])
    cv2.imwrite(f"{out}/{who}-painted-out.png", np.clip(np.where(region, Sp, G), 0, 255).astype(np.uint8)[y0:y1, x0:x1])
    cv2.imwrite(f"{out}/{who}-toast-skin.png", np.clip(St, 0, 255).astype(np.uint8))

cv2.imwrite(f"{out}/{target}-faces.png", np.dstack([np.clip(res, 0, 255), Ga * 255]).astype(np.uint8))
print(json.dumps(info, indent=1))
print("\n".join(report))
# the feature sheet: a row per feature, master | result at 4x (a flagged row's label in red)
rows = []
for label, m, r, bad in sheet:
    h = 4 * max(m.shape[0], r.shape[0])
    up = lambda im: cv2.resize(im, (im.shape[1] * h // im.shape[0], h), interpolation=cv2.INTER_NEAREST)
    m4, r4 = up(m), up(r)
    row = np.full((h + 30, 160 + m4.shape[1] + 20 + r4.shape[1], 3), 40, np.uint8)
    cv2.putText(row, label, (8, 30 + h // 2), 0, 0.6, (80, 80, 255) if bad else (160, 207, 232), 1, cv2.LINE_AA)
    cv2.putText(row, "master", (160, 20), 0, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    cv2.putText(row, "result", (160 + m4.shape[1] + 20, 20), 0, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    row[30:, 160:160 + m4.shape[1]] = m4
    row[30:, 180 + m4.shape[1]:180 + m4.shape[1] + r4.shape[1]] = r4
    rows.append(row)
wmax = max(r.shape[1] for r in rows)
cv2.imwrite(f"{out}/features.png", np.vstack([np.pad(r, ((0, 6), (0, wmax - r.shape[1]), (0, 0)), constant_values=25) for r in rows]))
