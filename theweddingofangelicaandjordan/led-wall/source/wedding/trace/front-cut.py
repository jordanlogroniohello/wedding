# The candles facing the front (stage key 3, round 24; the user: "dapat naka harap nalang wag ng nakatagilid", facing
# the front, not side on): the toast picture's Dan & Ange (the master faces, from the front) behind the candle picture's
# cake. From the toast's own pieces (painted-cut.py), each base with its glass arm's place filled by the other arm,
# mirrored (his hand in his pocket, her hand on the bouquet: the table and the flowers hide both), and Dan's without its
# head above the collar (for the kiss his head turns to her: the candle picture's 3/4 head goes on his neck). The faces:
# each grin painted out (the bare face the pursed lips go on), the pursed lips (the candle picture's own, made even for
# a face from the front), the eyes glancing at each other (master-face.py's glance, in two steps: a dart), and Dan's
# turned head (the candle picture's, its neck down to the collar).
#   .venv/bin/python -I src/wedding/trace/front-cut.py <check dir>
# -> src/wedding/painted/front-*.png + frontParts.ts; <check dir>/front-*.png (each piece on blue, zoomed)
import sys, json, re, ast
import numpy as np, cv2

chk = sys.argv[1]
PD = "src/wedding/painted"
# master-face.py's own helpers (the fill from the skin round a feature, an eye's glance) and its toast numbers, taken
# from its source (it runs a whole picture when run, so it isn't imported)
_src = ast.parse(open("src/wedding/trace/master-face.py").read())
_keep = {"disk", "dil", "lab", "harmonic", "fill", "glance", "TOAST"}
_mf = {"np": np, "cv2": cv2}
exec(compile(ast.Module([n for n in _src.body if (isinstance(n, ast.FunctionDef) and n.name in _keep) or
                         (isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") in _keep)], []), "master-face.py", "exec"), _mf)
fill, glance, TOAST, disk, dil, lab = (_mf[k] for k in ("fill", "glance", "TOAST", "disk", "dil", "lab"))

def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32)
    return im[..., :3], im[..., 3] / 255
def poly(shape, ps):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.round(np.array(ps) * 4).astype(np.int32)], 1, cv2.LINE_8, 2)
    return m > 0
def boxes_of(ts):
    # (a parts file's `boxes` block only: its pivots use the same names)
    block = ts[ts.index("boxes: {"):]
    block = block[:block.index("}")]
    return {k: [int(v) for v in vs.split(",")] for k, vs in re.findall(r'"([\w.]+)": \[([\d, ]+)\]', block)}

T, Ta = load(f"{PD}/toast-source.png")
H, W = Ta.shape
yy, xx = np.mgrid[0:H, 0:W]
TB = boxes_of(open(f"{PD}/paintedParts.ts").read())
def placed(name, box, shape=(H, W)):
    # a piece put back where it was in its picture (rgb, alpha)
    rgb, a = load(f"{PD}/{name}.png")
    R, A = np.zeros(shape + (3,), np.float32), np.zeros(shape, np.float32)
    x, y, w, h = box
    R[y:y + h, x:x + w], A[y:y + h, x:x + w] = rgb, a
    return R, A

# --- the bases: the glass arm's place = the other side, mirrored about the body's middle ---
# (his: left of his jacket's front panel, from the shoulders down: the hanging sleeve; hers: right of her bodice from the
# glass down, and right of the bouquet lower down: the arm down to the bouquet)
NECK = 444  # his chin sits on his collar here: his base keeps what's below it (the collar, his curls on the shoulders)
MIRROR = {
    "dan": (826, (xx < 257) & (yy >= NECK)),
    "ange": (1780, ((xx > 985) & (yy >= 430)) | ((xx > 958) & (yy >= 690))),
}
bases = {}
for who, (twice_mid, region) in MIRROR.items():
    R, A = placed(f"{who}-base", TB[f"{who}.base"])
    sx = np.clip(twice_mid - xx, 0, W - 1)
    R = np.where(region[..., None], R[yy, sx], R)
    A = np.where(region, A[yy, sx], A)
    if who == "dan":
        A[:NECK] = 0
    bases[who] = (R, A)

# --- the faces: each grin painted out from the skin round it ---
L = lab(T)
def skin_near(ref, tol):
    s = L[ref[1]:ref[3], ref[0]:ref[2]].reshape(-1, 3).mean(0)
    return (np.linalg.norm(L - s, axis=2) < tol) & (Ta > 0.98)
# (Dan's lips as master-face.py measured them; Ange's: what isn't skin round her mouth)
grin = {"dan": dil(poly((H, W), TOAST["dan"]["lips"]), 3)}
near = np.zeros((H, W), np.uint8); cv2.ellipse(near, (890, 436), (54, 28), 0, 0, 360, 1, -1)
ag = (near > 0) & (yy > 413) & ~skin_near(TOAST["ange"]["bridge"], 16)
n, cc, st, _ = cv2.connectedComponentsWithStats(ag.astype(np.uint8), connectivity=8)
ag = cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
grin["ange"] = dil(cv2.morphologyEx(ag.astype(np.uint8), cv2.MORPH_CLOSE, disk(3)) > 0, 3)
bare = {}
for who in ("dan", "ange"):
    known = skin_near(TOAST[who]["bridge"], 30) & ~dil(grin[who], 1)
    filled = fill(T, grin[who], known)
    bare[who] = (filled, cv2.GaussianBlur(dil(grin[who], 1).astype(np.float32), (0, 0), 1.0))

# --- the eyes glancing at each other (his toward the screen's right, hers left): half way, then all the way (a dart) ---
# (only the eye itself changes: her hair over its corner stays where it is)
LOOK = {"dan": {2: 7, 3: 7}, "ange": {2: -6, 3: -6}}
eye_oval = {}
for who in LOOK:
    m = np.zeros((H, W), np.uint8)
    for (cx_, cy_, rx, ry), _ in TOAST[who]["eyes"]:
        cv2.ellipse(m, (int(cx_), int(cy_)), (int(rx) + 6, int(ry) + 5), 0, 0, 360, 1, -1)
    eye_oval[who] = m > 0
looks = {}
for who, dxs in LOOK.items():
    for step in (1, 2):
        G = T.copy()
        for i, dx in dxs.items():
            G = glance(G, TOAST[who]["boxes"][i], TOAST[who]["irises"][i], dx * step / 2)
        looks[(who, step)] = G

# --- the pursed lips: the candle picture's own (cake-cut.py's: the biggest piece of red the blowing face adds), grown
# to the toast's size, and made even: the fuller half (by the lips' outer edge) and its mirror image about the dark
# middle ---
CS = 1 / 0.85  # candle picture px -> toast px (the faces' size: eyes ~114 apart there, 134 here)
F, Fa = load(f"{PD}/cake-faces.png")
Bc, _ = load(f"{PD}/cake-faces-bare.png")
CB = boxes_of(open(f"{PD}/cakeParts.ts").read())
Lf = lab(F)
# (each one's own face in the candle picture: his box, hers)
CFACE = {"dan": (500, 280, 640, 380), "ange": (1380, 290, 1480, 390)}
MOUTH = {"dan": (415, 384), "ange": (890, 432)}  # where the pursed lips' middle goes on the front face
pucker = {}
for who, (x0, y0, x1, y1) in CFACE.items():
    m = np.zeros(Fa.shape, bool); m[y0:y1, x0:x1] = True
    red = (Lf[..., 1] > 145) & (np.abs(F - Bc).max(2) > 4) & m
    n, cc, st, _ = cv2.connectedComponentsWithStats(red.astype(np.uint8), connectivity=8)
    lm = cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    lm = dil(cv2.morphologyEx(lm.astype(np.uint8), cv2.MORPH_CLOSE, disk(2)) > 0, 2)
    ys, xs = np.where(lm)
    cy0, cy1, cx0, cx1 = ys.min() - 3, ys.max() + 4, xs.min() - 3, xs.max() + 4
    rgb = F[cy0:cy1, cx0:cx1]
    a = cv2.GaussianBlur(lm[cy0:cy1, cx0:cx1].astype(np.float32), (0, 0), 0.7)
    # the dark middle (the opening): the even lips' middle line
    dark = lm[cy0:cy1, cx0:cx1] & (Lf[cy0:cy1, cx0:cx1, 0] < 90)
    mid = int(round(np.where(dark)[1].mean()))
    # the fuller half: the side whose lips reach further from the middle
    cols = np.where(lm[cy0:cy1, cx0:cx1].any(0))[0]
    left_full = mid - cols.min() >= cols.max() - mid
    half = (slice(None), slice(0, mid + 1)) if left_full else (slice(None), slice(mid, None))
    hr, ha = rgb[half], a[half]
    flip_r, flip_a = hr[:, ::-1], ha[:, ::-1]
    er = np.concatenate([hr, flip_r[:, 1:]], 1) if left_full else np.concatenate([flip_r[:, :-1], hr], 1)
    ea = np.concatenate([ha, flip_a[:, 1:]], 1) if left_full else np.concatenate([flip_a[:, :-1], ha], 1)
    size = (int(round(er.shape[1] * CS)), int(round(er.shape[0] * CS)))
    er = cv2.resize(er, size, interpolation=cv2.INTER_CUBIC)
    ea = np.clip(cv2.resize(ea, size, interpolation=cv2.INTER_CUBIC), 0, 1)
    # (placed with the opening's middle on the mouth's)
    dy = np.where(dark)[0].mean() * CS
    px, py = int(round(MOUTH[who][0] - er.shape[1] / 2)), int(round(MOUTH[who][1] - dy))
    pucker[who] = (er, ea, px, py)
    print(who, "lips", (cx0, cy0, cx1 - cx0, cy1 - cy0), "mid", mid, "fuller", "left" if left_full else "right", "->", (px, py) + size)

# --- Dan's turned head for the kiss: the candle picture's (cut from its own piece), its hair, face, ear and earring,
# and its neck: no jacket, shirt or tie (light and not pink, below the earring), nor what hangs below the jaw (a curl
# and the collar's lines: a dark band on his front collar), nor the jacket's outline under the curls at the back (a
# straight cut along the hair) ---
C, Ca = placed("cake-dan", CB["dan"], Fa.shape)
Lc = lab(C)
cy, cx = np.mgrid[0:Ca.shape[0], 0:Ca.shape[1]]
HEAD = [(230, 0), (720, 0), (720, 330), (600, 366), (480, 366), (446, 374), (430, 390), (380, 408), (300, 408), (230, 380)]
cloth = ((cy > 326) | ((cy > 280) & (cx < 360))) & (Lc[..., 0] > 140) & (Lc[..., 1] < 137)
cloth |= (cy > 280) & (cx < 380) & (Lc[..., 0] > 110) & (Lc[..., 2] - Lc[..., 1] > 25)  # (its gold embroidery)
hm = (Ca > 0.5) & poly(Ca.shape, HEAD) & ~cloth
hm = cv2.morphologyEx(hm.astype(np.uint8), cv2.MORPH_OPEN, disk(1)) > 0
n, cc, st, _ = cv2.connectedComponentsWithStats(hm.astype(np.uint8), connectivity=8)
hm = cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
inv = (~hm).astype(np.uint8)
n, cc = cv2.connectedComponents(inv, connectivity=4)
hm |= (cc != cc[0, 0]) & ~hm & ~cloth  # (no holes, but the jacket between his curls)
# (at the back, below the hair's line: only the curls' own thick ends, grown back to their edges; thin lines go)
low = (cy > 290) & (cx < 370)
hm &= ~(low & (Lc[..., 0] > 120))  # (and no light bits of jacket between them)
keep = cv2.morphologyEx(hm.astype(np.uint8), cv2.MORPH_OPEN, disk(3)) > 0
for _ in range(2):
    keep = dil(keep, 1) & hm
hm = np.where(low, keep, hm)
n, cc, st, _ = cv2.connectedComponentsWithStats(hm.astype(np.uint8), connectivity=8)
hm = cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
turn_a = Ca * np.clip(cv2.GaussianBlur(hm.astype(np.float32), (0, 0), 0.8) * 1.6 - 0.3, 0, 1)
# (its curls are a warmer, lighter brown than the toast's near-black ones: their darks matched to the toast head's, by
# the hair's own 10/50/90% points (measured: 10, 26, 44 there; 5, 18, 29 on the toast), fading out toward the light
# px, which aren't hair)
hair_w = ((Lc[..., 1] < 140) & hm) * np.clip((130 - Lc[..., 0]) / 40, 0, 1)
Lt = Lc.copy()
Lt[..., 0] = np.interp(Lc[..., 0], [0, 10, 26, 44, 130, 255], [0, 5, 18, 29, 82, 255])
Lt[..., 1:] = 128 + (Lc[..., 1:] - 128) * 0.4
Lt = Lc + (Lt - Lc) * hair_w[..., None]
C = cv2.cvtColor(np.clip(Lt, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32) * hm[..., None] + C * ~hm[..., None]
# (its curls at the back end in a straight line, where his shoulder hid them in that picture: under them, the toast
# head's own curl ends from the same side, at the candle picture's size)
# (its left curls hanging to his shoulder, clear of where the glass was: only the curls, one piece)
CURLS, CURLS_AT = (226, 380, 300, 472), (228, 262)  # toast px box -> where its top-left goes
hr_, ha_ = placed("dan-head", TB["dan.head"])
x0, y0, x1, y1 = CURLS
cm = (ha_[y0:y1, x0:x1] > 0.5) & (hr_[y0:y1, x0:x1].max(2) < 200)
n, cc, st, _ = cv2.connectedComponentsWithStats(cm.astype(np.uint8), connectivity=8)
cm = dil(cc == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])), 1)
sz = (round((x1 - x0) * 0.85), round((y1 - y0) * 0.85))
pr = cv2.resize(hr_[y0:y1, x0:x1], sz, interpolation=cv2.INTER_AREA)
pa = cv2.resize(ha_[y0:y1, x0:x1] * cm * (hr_[y0:y1, x0:x1].max(2) < 200), sz, interpolation=cv2.INTER_AREA)
PR, PA = np.zeros_like(C), np.zeros_like(Ca)
PR[CURLS_AT[1]:CURLS_AT[1] + sz[1], CURLS_AT[0]:CURLS_AT[0] + sz[0]] = pr
PA[CURLS_AT[1]:CURLS_AT[1] + sz[1], CURLS_AT[0]:CURLS_AT[0] + sz[0]] = pa
under_a = PA * (1 - turn_a)
C = (C * turn_a[..., None] + PR * under_a[..., None]) / np.maximum(turn_a + under_a, 1e-6)[..., None]
turn_a = turn_a + under_a
# the neck's foot (where it goes on his collar): its tip, at the back of the jaw
turn_neck = [440, 380]

# --- save ---
def save(name, rgb, a):
    ys, xs = np.where(a > 0.004)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    o = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), np.clip(a[y0:y1, x0:x1] * 255, 0, 255)]).astype(np.uint8)
    cv2.imwrite(f"{PD}/{name}.png", o, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
def check(name, rgb, a, scale=1):
    ys, xs = np.where(a > 0.004)
    y0, y1, x0, x1 = max(ys.min() - 10, 0), ys.max() + 11, max(xs.min() - 10, 0), xs.max() + 11
    bg = np.array([138, 74, 42], np.float32)
    o = rgb[y0:y1, x0:x1] * a[y0:y1, x0:x1, None] + bg * (1 - a[y0:y1, x0:x1, None])
    o = cv2.resize(np.clip(o, 0, 255).astype(np.uint8), None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    cv2.imwrite(f"{chk}/front-{name}.png", o)

out = {}
CUT = 860  # (below this the table hides them, however they lean)
for who, (R, A) in bases.items():
    A = A.copy(); A[CUT:] = 0
    out[f"{who}.base"] = save(f"front-{who}-base", R, A)
    check(f"{who}-base", R, A)
    f, a = bare[who]
    out[f"{who}.bare"] = save(f"front-{who}-bare", f, a * Ta)
    check(f"{who}-bare", f, np.maximum(a, 0.0) * 0 + Ta * dil(grin[who], 14), 4)
    er, ea, px, py = pucker[who]
    out[f"{who}.pucker"] = [px, py, er.shape[1], er.shape[0]]
    cv2.imwrite(f"{PD}/front-{who}-pucker.png", np.dstack([np.clip(er, 0, 255), np.clip(ea * 255, 0, 255)]).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    # (the bare face with the lips on, zoomed)
    face = f.copy()
    face[py:py + er.shape[0], px:px + er.shape[1]] = er * ea[..., None] + face[py:py + er.shape[0], px:px + er.shape[1]] * (1 - ea[..., None])
    check(f"{who}-pucker", face, Ta * dil(grin[who], 14), 4)
for (who, step), G in looks.items():
    ch = dil(np.abs(G - T).max(2) > 1.5, 2) & eye_oval[who]
    out[f"{who}.look{step}"] = save(f"front-{who}-look{step}", G, cv2.GaussianBlur(ch.astype(np.float32), (0, 0), 1.0) * Ta)
    check(f"{who}-look{step}", G, Ta * dil(ch, 12), 3)
out["dan.turn"] = save("front-dan-turn", C, turn_a)
check("dan-turn", C, turn_a, 2)

ts = ["// GENERATED by src/wedding/trace/front-cut.py: the candles facing the front (stage key 3, round 24), from the toast",
      "// picture's pieces (toast px, [x, y, w, h]): each base with the other arm mirrored into the glass arm's place (Dan's",
      "// without his head above the collar), each bare face (the grin painted out) and pursed lips (their middle on the",
      "// mouth's); and Dan's turned head for the kiss, in the candle picture's px (`dan.turn`, its neck's foot `turnNeck`).",
      "export const FRONT = {",
      f"  size: [{W}, {H}] as const,",
      "  boxes: {"]
ts += [f'    "{k}": {json.dumps(v)},' for k, v in out.items()]
ts += ["  } as Record<string, number[]>,",
       f"  mouth: {json.dumps(MOUTH)} as Record<string, number[]>,",
       f"  neck: {NECK},",
       f"  turnNeck: {json.dumps(turn_neck)},",
       "};", ""]
open(f"{PD}/frontParts.ts", "w").write("\n".join(ts))
print(json.dumps(out))
