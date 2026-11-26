# The A♥J monogram redrawn as SVG + the pen paths that write it (LED stage, 2026-11-16; the user: "yung monogram is
# redraw sa svg tapos dahan dahan na yung pag fill ng logo").
#  - the ink: potrace of ~/wedding/monogram-no-heart.png (1670x941, cream on a baked-in checkerboard: the cream is split
#    off by its colour, R - B), traced at 2x for smooth curves; the heart: the stage's monogram.png (512x288, same framing,
#    x3.26), traced the same way. The viewBox is the PNG's own frame (0 0 1670 941), so the page's layout is unchanged.
#  - the pen: the ink's skeleton as a graph (11 nodes: the apex tip, the J's curl end, the crossings), walked in writing
#    order. The stage (round 28, approved 2026-11-17: "ayan goods apply it"): the infinity first as a thin line in one
#    sweep from up its left loop (the centre, round the right loop, back along the top through the J's top, the centre,
#    closing through the A's foot), a beat, then two pens at once: the A (the left leg from the tip down into its foot,
#    then the thick right leg sweeping through the centre and thinning out) and the J (top to the curl), ending together.
#    Round 27's letters-first order (the A, the J, a beat, the infinity) stays as --order=letters-first.
#    Each stroke is cut into ~110 px pieces; each piece is a round-capped mask stroke as wide as the ink under it
#    (the skeleton's distance x 2 + a margin), so the cap never runs far ahead of the pen. The pen slows on thick ink
#    (pressure) and eases in and out of every stroke.
#  - who reveals what (round 27, the crossings were "hindi maayos"): each stroke's own shape is a strip between its
#    measured edges (straight on through a crossing, the edges carried across from both sides); an ink pixel belongs to
#    the earliest strip over it (a letter keeps its whole body where the infinity crosses it), a fillet where two strands
#    meet goes to the later one (it fills in as that one arrives, never a bump on the letter before), the rest to the
#    nearest strip. Every piece that would show someone else's ink is clipped to its own.
# Usage: .venv/bin/python -I src/wedding/trace/monogram-svg.py [~/wedding] [out dir for the review] [--order=...] [--no-data]
#   -> src/wedding/stage/monogramData.ts + <review>/monogram-{timemap,write}.png
#   --order=infinity-first (the default, the stage since round 28; the user: "what if unahin yung infinity tapos sabay na
#     fifill yung A and J?"): the infinity first as a thin line (its thick parts are the letters': the J's swell round its
#     top, the A's sweep out of the centre), then the A and the J fill together, two pens at once, ending together
#   --order=letters-first (round 27): the A, the J, then the infinity
#   --no-data: the review pictures only (the stage's data stays as it is)
#   --outline-sigma=8 (the default since round 30, the user: "kapag malaki yung monogram kitang kita yung hindi smooth
#     strokes"): the drawn outline smoothed along its length by this many px (a pointed tip or an acute join kept sharp);
#     0 = the outline as traced before (bumps from the picture's noisy edge)
#   --pace=1.6 (the default since round 29, the user: "make the filling more fast"): the stage writes this many times
#     faster than the pen timing below (round 28: 5.5 s, now ~3.4 s); every time in the data and the review is divided by
#     it at the end, so the shapes and who reveals what stay exactly the approved ones (--pace=1 = round 28's speed)
# Checks (printed, exit 1 on a fail): every ink pixel is covered by the mask; how much ink a piece reveals ahead of the
# pen (> 0.25 s early) stays tiny; no tick (ink shown > 0.2 s before its owner writes it) bigger than 60 frame px.
import sys, os, subprocess, tempfile, re, json, collections, heapq
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
FLAGS = dict((a.split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
ORDER = FLAGS.get("--order", "infinity-first")
assert ORDER in ("letters-first", "infinity-first"), ORDER
PACE = float(FLAGS.get("--pace", 1.6))
WED = os.path.expanduser(ARGS[0] if len(ARGS) > 0 else "~/wedding")
REVIEW = ARGS[1] if len(ARGS) > 1 else os.path.join(ROOT, "out/wedding")
os.makedirs(REVIEW, exist_ok=True)
OUT_TS = os.path.join(ROOT, "src/wedding/stage/monogramData.ts")

# ---- the ink mask (1670x941) -----------------------------------------------------------------------------------
big = cv2.imread(os.path.join(WED, "monogram-no-heart.png"), cv2.IMREAD_UNCHANGED)[..., :3].astype(np.float32)
H, W = big.shape[:2]
cream = big[..., 2] - big[..., 0]  # R - B: the cream ~83, the grey checker ~0
soft = np.clip((cream - 8) / (83 - 8), 0, 1)  # coverage 0..1 (the anti-aliased edge kept)
small = cv2.imread(os.path.join(WED, "theweddingofangelicaandjordan/monogram.png"), cv2.IMREAD_UNCHANGED)
ha = cv2.resize(small[..., 3], (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255
ha = cv2.warpAffine(ha, np.float32([[1, 0, 0], [0, 1, -2]]), (W, H))  # measured: the small one sits 2 px low
# the heart = the small one's blob up-right, clear of the letters
n, lab, stats, cent = cv2.connectedComponentsWithStats((ha > 0.5).astype(np.uint8))
heart_id = min(range(1, n), key=lambda k: (cent[k][0] - 1290) ** 2 + (cent[k][1] - 310) ** 2)
heart = np.where(cv2.dilate((lab == heart_id).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0, ha, 0)
ink = (soft > 0.5).astype(np.uint8)
ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
print(f"ink {ink.sum()} px, heart {int((heart > 0.5).sum())} px, frame {W}x{H}")

# ---- potrace at 2x -> absolute path data in the frame's px -----------------------------------------------------
def trace(cov):
    up = cv2.resize(cov.astype(np.float32), (W * 2, H * 2), interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (0, 0), 0.8)
    return potrace_d((up > 0.5).astype(np.uint8), 2)

def potrace_d(bm, scale):  # a bitmap at `scale` x the frame -> path data in the frame's px
    with tempfile.TemporaryDirectory() as td:
        pbm = os.path.join(td, "m.pbm")
        with open(pbm, "wb") as f:
            f.write(b"P4\n%d %d\n" % (bm.shape[1], bm.shape[0]))
            f.write(np.packbits(bm, axis=1).tobytes())
        svg = os.path.join(td, "m.svg")
        subprocess.run(["potrace", pbm, "-s", "-o", svg, "--turdsize", str(int(30 * scale * scale / 4)), "--alphamax", "1.0", "--opttolerance", "0.2", "-u", "10"], check=True)
        txt = open(svg).read()
    m = re.search(r'translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+),([-\d.]+)\)', txt)
    tx, ty, sx, sy = map(float, m.groups())
    ds = re.findall(r'<path d="([^"]+)"', txt)
    out = []
    for d in ds:
        toks = re.findall(r'[MmCcLlZz]|-?\d+(?:\.\d+)?', d)
        i, cmd, cx, cy, sxp, syp, res = 0, None, 0.0, 0.0, 0.0, 0.0, []
        P = lambda x, y: f"{(tx + sx * x) / scale:.1f} {(ty + sy * y) / scale:.1f}"
        while i < len(toks):
            t = toks[i]
            if re.match(r'[MmCcLlZz]', t):
                cmd = t; i += 1
                if cmd in "Zz":
                    res.append("Z"); cx, cy = sxp, syp
                continue
            if cmd in "Mm":
                x, y = float(toks[i]), float(toks[i + 1]); i += 2
                if cmd == "m": x, y = cx + x, cy + y
                cx, cy, sxp, syp = x, y, x, y
                res.append("M" + P(x, y)); cmd = "l" if cmd == "m" else "L"
            elif cmd in "Ll":
                x, y = float(toks[i]), float(toks[i + 1]); i += 2
                if cmd == "l": x, y = cx + x, cy + y
                cx, cy = x, y; res.append("L" + P(x, y))
            elif cmd in "Cc":
                v = list(map(float, toks[i:i + 6])); i += 6
                if cmd == "c": v = [cx + v[0], cy + v[1], cx + v[2], cy + v[3], cx + v[4], cy + v[5]]
                res.append("C" + " ".join([P(v[0], v[1]), P(v[2], v[3]), P(v[4], v[5])]))
                cx, cy = v[4], v[5]
        out.append("".join(res))
    return "".join(out)

# ---- the outline, smoothed (round 30, 2026-11-25: "kapag malaki yung monogram kitang kita yung hindi smooth strokes") --
# The picture's cream edge is noisy (split off a baked-in checkerboard) and potrace followed its bumps; at the bigger size
# they showed. Now: the coverage at 4x, each contour smoothed along its length by a Gaussian of OUTLINE_SIGMA px (at a
# corner, a pointed tip or an acute join, almost none: they stay sharp), filled back (holes by depth) and traced. Only the
# DRAWN outline changes: the skeleton, the pen's paths and their timing come from the same ink as before; the checks and
# the clips below cover the new edge (inkm takes every pixel it touches)
OUTLINE_SIGMA = float(FLAGS.get("--outline-sigma", 8.0))
def smooth_outline(cov, sigma, up=4):
    big4 = cv2.GaussianBlur(cv2.resize(cov.astype(np.float32), (W * up, H * up), interpolation=cv2.INTER_CUBIC), (0, 0), 0.4 * up)
    bm = (big4 > 0.5).astype(np.uint8)
    cs, hier = cv2.findContours(bm, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    depth = []
    for i in range(len(cs)):
        d, p = 0, hier[0][i][3]
        while p >= 0: d += 1; p = hier[0][p][3]
        depth.append(d)
    def gs(A, sg):
        k = int(3 * sg) + 1
        if len(A) < 2 * k + 1: return A
        x = np.arange(-k, k + 1); g = np.exp(-0.5 * (x / sg) ** 2); g /= g.sum()
        Ap = np.vstack([A[-k:], A, A[:k]])
        return np.c_[np.convolve(Ap[:, 0], g, "valid"), np.convolve(Ap[:, 1], g, "valid")]
    out = np.zeros_like(bm)
    sg, sc = sigma * up, 0.6 * up
    for i in sorted(range(len(cs)), key=lambda i: depth[i]):
        P = cs[i][:, 0, :].astype(np.float64)
        seg = np.linalg.norm(np.diff(np.vstack([P, P[:1]]), axis=0), axis=1)
        L = float(seg.sum())
        if L < 8 * up:
            Q = P
        else:  # resampled at 1 px (at 4x), smoothed big and small, blended by how sharp the turn is there
            sa = np.r_[0, np.cumsum(seg)]; Pc = np.vstack([P, P[:1]])
            u = np.linspace(0, L, int(L), endpoint=False)
            R = np.c_[np.interp(u, sa, Pc[:, 0]), np.interp(u, sa, Pc[:, 1])]
            big_s, small_s = gs(R, sg), gs(R, sc)
            k = max(3, int(1.2 * sg))
            a = small_s - np.roll(small_s, k, axis=0); b = np.roll(small_s, -k, axis=0) - small_s
            ang = np.abs(np.arctan2(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0], (a * b).sum(1)))
            corner = np.clip((ang - np.radians(35)) / np.radians(40), 0, 1)
            kk = int(2 * sg) + 1
            g = np.exp(-0.5 * (np.arange(-kk, kk + 1) / max(1.0, sg)) ** 2)
            if len(corner) > 2 * kk:  # (a corner's weight spread along the contour, so the blend is smooth)
                cp = np.r_[corner[-kk:], corner, corner[:kk]]
                wc = (np.lib.stride_tricks.sliding_window_view(cp, 2 * kk + 1) * g[None, :]).max(1)
            else:
                wc = np.full(len(corner), corner.max())
            Q = wc[:, None] * small_s + (1 - wc[:, None]) * big_s
        cv2.fillPoly(out, [np.round(Q * 8).astype(np.int32)], 1 if depth[i] % 2 == 0 else 0, lineType=cv2.LINE_8, shift=3)
    return out
if OUTLINE_SIGMA > 0:
    ink4 = smooth_outline(soft, OUTLINE_SIGMA)
    ink_d = potrace_d(ink4, 4)
    heart_d = potrace_d(smooth_outline(heart, OUTLINE_SIGMA / 2), 4)
    ink_vis = cv2.resize(ink4.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.02  # every pixel it touches
    print(f"outline smoothed (sigma {OUTLINE_SIGMA}): {int((ink_vis & ~(ink > 0)).sum())} rim px added to the ink the checks cover")
else:
    ink_d, heart_d, ink_vis = trace(soft), trace(heart), None
print(f"ink path {len(ink_d)} chars, heart path {len(heart_d)} chars")

# ---- the skeleton graph ------------------------------------------------------------------------------------------
def thin(img):  # Zhang-Suen
    img = img.copy().astype(np.uint8)
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            B = sum(x.astype(int) for x in nb)
            seq = nb + [p2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(int) for i in range(8))
            c = ((p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)) if step == 0 else ((p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0))
            rm = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if rm.any(): img[rm] = 0; changed = True
        if not changed: return img

sk = thin(ink)
dt = cv2.distanceTransform(ink, cv2.DIST_L2, 5)
pts = set(map(tuple, np.argwhere(sk == 1)))
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
nbrs = lambda p: [(p[0] + a, p[1] + b) for a, b in N8 if (p[0] + a, p[1] + b) in pts]
RING = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
def crossings(p):
    v = [1 if (p[0] + a, p[1] + b) in pts else 0 for a, b in RING]
    return sum(1 for i in range(8) if v[i] == 0 and v[(i + 1) % 8] == 1)
special = [p for p in pts if crossings(p) != 2]

# the named nodes (measured on the skeleton, frame px): writing order below walks between them
NODES = {"tip": (952, 59), "apex": (852, 128), "xa": (530, 467), "xb": (504, 484), "bl": (323, 598), "c1": (816, 550),
         "c2": (849, 567), "j1": (1068, 648), "j2": (1103, 605), "jtop": (1182, 442), "curl": (870, 678)}
node_px = {}
for name, (x, y) in NODES.items():
    p = min(special, key=lambda q: (q[1] - x) ** 2 + (q[0] - y) ** 2)
    assert (p[1] - x) ** 2 + (p[0] - y) ** 2 < 20 ** 2, f"node {name} not found near {(x, y)}: nearest {p[::-1]}"
    node_px[name] = p

# a route along the skeleton from node a to node b, through a hint point (Dijkstra a -> hint -> b)
def route(a, b, via=None):
    def dj(s, goal):
        dist = {s: 0.0}; prev = {}; pq = [(0.0, s)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == goal: break
            if d > dist[u]: continue
            for v in nbrs(u):
                nd = d + (1.4142 if v[0] != u[0] and v[1] != u[1] else 1.0)
                if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
        path = [goal]
        while path[-1] != s: path.append(prev[path[-1]])
        return path[::-1]
    near = lambda p: min(pts, key=lambda q: (q[1] - p[0]) ** 2 + (q[0] - p[1]) ** 2)
    A, B = (node_px[n] if isinstance(n, str) else near(n) for n in (a, b))
    if via is None: return dj(A, B)
    V = near(via)
    return dj(A, V)[:-1] + dj(V, B)

# the strokes. Each leg: (from, to, a point on the way where two routes are possible | "cross" = smoothly through a
# crossing or a junction, not along the skeleton's jog there); from / to = a node's name or a frame point (the nearest
# skeleton px)
A_EXIT = (975, 626)  # the A's right leg sweeps through the centre and ends where its ink has thinned to the line (hw ~9)
J_ENTRY = (1300, 390)  # the J comes in along the infinity's top line from where it is thin (hw ~8), swelling into its top
BL_IN = (331, 606)  # the infinity closes here, just short of the A's foot: the junction is the A's and the loop's (its
                    # last pass running into it left a sliver between them, a jagged notch for 2.6 s)
A_LEFT = ("A, left leg", [("tip", "apex"), ("apex", "xa", (673, 274)), ("xa", "xb", "cross"), ("xb", "bl", (430, 570))])
A_RIGHT = ("A, right leg", [("apex", "c1", (765, 333)), ("c1", "c2", "cross"), ("c2", A_EXIT)])
J_STROKE = ("J", [(J_ENTRY, "jtop"), ("jtop", "jtop", "cross"), ("jtop", "j2", (1147, 528)), ("j2", "j1", "cross"), ("j1", "curl")])
INF_LEGS = [("bl", "xb", (352, 496)), ("xb", "xa", "cross"), ("xa", "c1", (680, 520)), ("c1", "c2", "cross"), ("c2", "j1", (949, 621)),
            ("j1", "j2", "cross"), ("j2", "jtop", (1390, 498)), ("jtop", "c2", (1003, 485)), ("c2", "c1", "cross")]
# when each stroke starts: (after / with, another stroke, a pause in s); without one, LIFT after the stroke before it
LEAD = {}  # a stroke that starts this far (px) before this node: the legs before only set the direction it starts in
           # (it starts inside the stroke before it, so its strip covers the whole junction: a gap there was split between
           # the two by nearness, a jagged edge)
if ORDER == "letters-first":  # one pen: "AJ", a beat, then the infinity
    STROKES = [A_LEFT, A_RIGHT, J_STROKE, ("infinity", INF_LEGS + [("c1", BL_IN, (583, 644))])]
    START, END_WITH = {"infinity": ("after", "J", 0.45)}, {}
else:  # the infinity, a beat, then two pens: the A (its left leg, then its right leg) and the J at once, ending together
    # (it starts a little up the left loop and closes through the A's foot, so its start never shows a stub of the
    # junction for the whole sweep; smoothly through the J's top, not dipping into it along the skeleton)
    INF_START = (291, 538)  # (far enough up the loop that it closes smoothly through the A's foot)
    INF_FIRST = ([(INF_START, "xb", (352, 496))] + INF_LEGS[1:6] + [("j2", "jtop", (1390, 498)), ("jtop", "jtop", "cross"), ("jtop", "c2", (1003, 485))]
                 + INF_LEGS[8:] + [("c1", "bl", (583, 644)), ("bl", "bl", "cross"), ("bl", INF_START)])
    # (the A's right leg comes in from the tip, so it leaves the top stroke on a smooth curve, but starts at the apex: a
    # strip of its own over the top stroke left a sliver of it along the top's edge, round 28)
    A_RIGHT = ("A, right leg", [("tip", "apex"), ("apex", "apex", "cross")] + A_RIGHT[1])
    # (and the left leg runs from the top stroke into the left leg on one curve, not through the junction's middle: the
    # skeleton's jog there made the edge under the apex scalloped)
    A_LEFT = (A_LEFT[0], [A_LEFT[1][0], ("apex", "apex", "cross")] + A_LEFT[1][1:])
    LEAD["A, right leg"] = ("apex", 46.0)
    STROKES = [("infinity", INF_FIRST), A_LEFT, A_RIGHT, J_STROKE]
    START, END_WITH = {"A, left leg": ("after", "infinity", 0.45), "J": ("with", "A, left leg", 0.0)}, {"J": "A, right leg"}
# infinity-first: the infinity is a thin line where it runs inside a letter's thick ink (the A's sweep out of the centre,
# the J's swell round its top: wider than THIN_W there), its edges carried across from both sides like a crossing's
THIN_W = 20.0
THIN_INF = ORDER == "infinity-first"
def bridge_thick(P, pad=8):
    # infinity-first: where the line runs inside a letter's thick ink (a crossing, the A's band and sweep, the J's swell,
    # the A's foot), its path is one smooth curve from the thin line before to the thin line after (a cubic Hermite on
    # the line's own directions), not the thick ink's middle: that wandered, and the line came out wavy (round 28)
    for _ in range(2):
        nrm, eP, eM, inside = edges(P)
        thick = np.convolve(((eP + eM > THIN_W) | ~inside).astype(float), np.ones(2 * pad + 1), "same") > 0
        out, i, n = [], 0, len(P)
        while i < n:
            if not thick[i]: out.append(P[i]); i += 1; continue
            j = i
            while j < n and thick[j]: j += 1
            a, b = i - 1, j
            if a < 6 or b > n - 7: out.extend(P[i:j]); i = j; continue  # (a stroke's own end stays)
            A, B = P[a], P[b]
            dA, dB = P[a] - P[a - 6], P[b + 6] - P[b]
            Lc = float(np.linalg.norm(B - A))
            dA = dA * Lc / (np.linalg.norm(dA) + 1e-9); dB = dB * Lc / (np.linalg.norm(dB) + 1e-9)
            for u in np.linspace(0, 1, max(3, int(Lc / 2)))[1:-1]:
                out.append((2 * u ** 3 - 3 * u ** 2 + 1) * A + (u ** 3 - 2 * u ** 2 + u) * dA + (3 * u ** 2 - 2 * u ** 3) * B + (u ** 3 - u ** 2) * dB)
            i = j
        P = smooth_path([(y, x) for x, y in out], sigma=2.0)
    return P

def smooth_path(raw, sigma=5.0, step=2.0):
    p = np.array([(x, y) for y, x in raw], np.float64)
    keep = np.r_[True, np.any(np.diff(p, axis=0) != 0, axis=1)]
    p = p[keep]
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1); s = np.r_[0, np.cumsum(seg)]
    ss = np.arange(0, s[-1], step); q = np.c_[np.interp(ss, s, p[:, 0]), np.interp(ss, s, p[:, 1])]
    k = int(3 * sigma / step); g = np.exp(-0.5 * (np.arange(-k, k + 1) * step / sigma) ** 2); g /= g.sum()
    pad = np.r_[np.repeat(q[:1], k, 0), q, np.repeat(q[-1:], k, 0)]
    sm = np.c_[np.convolve(pad[:, 0], g, "valid"), np.convolve(pad[:, 1], g, "valid")]
    sm[0], sm[-1] = q[0], q[-1]
    return sm

dtw = cv2.dilate(dt, np.ones((9, 9), np.uint8))  # the ink's half width near a point (the smoothed path drifts off the ridge)
# pen timing: px/s on a hairline, slower where the ink is thick; ease in/out over the first/last EASE px of a stroke
V_HAIR, V_THICK, EASE, LIFT = 1050.0, 520.0, 90.0, 0.16
PIECE = 110.0
NODE_R = 34.0  # a crossing's blob: this far round a node
CROSS_R = 40.0  # a hairline through a crossing runs straight from this far before the crossing to this far after
soft_f = soft.astype(np.float32)
def edges(P):
    # the ink's edges on each side of the path, measured along its normal (asymmetric: the smoothed path is never quite
    # on the ridge); returns the unit normals, the reach on the + side, on the - side, and whether the point is in the ink
    tg = np.gradient(P, axis=0); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
    nrm = np.c_[-tg[:, 1], tg[:, 0]]
    ss = np.arange(0, 90, 0.5, dtype=np.float32)
    reach = []
    for sg in (1, -1):
        mx = (P[:, :1] + sg * nrm[:, :1] * ss[None]).astype(np.float32)
        my = (P[:, 1:] + sg * nrm[:, 1:] * ss[None]).astype(np.float32)
        v = cv2.remap(soft_f, mx, my, cv2.INTER_LINEAR, borderValue=0) > 0.5
        reach.append((np.where(v.all(axis=1), ss[-1], ss[np.argmin(v, axis=1)]) - 0.25, v[:, 0]))
    return nrm, reach[0][0], reach[1][0], reach[0][1]
def gsmooth(a, sigma):
    k = int(3 * sigma); g = np.exp(-0.5 * (np.arange(-k, k + 1) / sigma) ** 2); g /= g.sum()
    return np.convolve(np.r_[np.repeat(a[:1], k), a, np.repeat(a[-1:], k)], g, "valid")

strokes_out, t, by_name = [], 0.0, {}
for si, (name, legs) in enumerate(STROKES):
    if name in START:
        kind, ref, extra = START[name]
        t = (float(by_name[ref]["T"][-1]) + LIFT if kind == "after" else float(by_name[ref]["T"][0])) + extra
    raw, crossing = [], False
    for leg in legs:
        if leg[2:] == ("cross",):  # the hairline goes straight through a crossing (the skeleton's link there runs along
            crossing = True        # the letter it crosses: the J, the A), so a letter's blob is never its ink
            continue
        r = route(*leg)
        if crossing:
            far_ = lambda q, o: (q[0] - o[0]) ** 2 + (q[1] - o[1]) ** 2 > CROSS_R ** 2
            end = raw[-1]
            while len(raw) > 1 and not far_(raw[-1], end): raw.pop()
            k = next(i for i, q in enumerate(r) if far_(q, r[0]))
            r = r[k:]
            # across: a cubic Hermite on the strand's own direction both sides, so it bends through the crossing as it
            # does either side of it (a straight chord cut the inside of the A's curve: its strip stuck out ~3 px there)
            A, B = np.array(raw[-1], float), np.array(r[0], float)
            dA = A - np.array(raw[max(0, len(raw) - 11)], float); dB = np.array(r[min(10, len(r) - 1)], float) - B
            Lc = float(np.linalg.norm(B - A))
            dA *= Lc / (np.linalg.norm(dA) + 1e-9); dB *= Lc / (np.linalg.norm(dB) + 1e-9)
            for u in np.linspace(0, 1, max(3, int(Lc / 2)))[1:-1]:
                raw.append(tuple((2 * u ** 3 - 3 * u ** 2 + 1) * A + (u ** 3 - 2 * u ** 2 + u) * dA + (3 * u ** 2 - 2 * u ** 3) * B + (u ** 3 - u ** 2) * dB))
            raw += r
            crossing = False
            continue
        raw += r if not raw else r[1:]
    P = smooth_path(raw)
    if THIN_INF and name == "infinity": P = bridge_thick(P)
    if name in LEAD:
        (lx, ly), back = NODES[LEAD[name][0]], LEAD[name][1]
        k = int(np.argmin((P[:, 0] - lx) ** 2 + (P[:, 1] - ly) ** 2))
        arc = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P[:k + 1], axis=0), axis=1))]
        P = P[int(np.searchsorted(arc, arc[-1] - back)):]
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1); S = np.r_[0, np.cumsum(seg)]; L = S[-1]
    hw = np.array([dtw[min(H - 1, int(round(y))), min(W - 1, int(round(x)))] for x, y in P])
    near_node = np.array([min((x - nx) ** 2 + (y - ny) ** 2 for nx, ny in NODES.values()) < NODE_R ** 2 for x, y in P], np.uint8)
    near_node[:3] = near_node[-3:] = 0  # a stroke's own ends keep their width
    hw_node = np.array([min((x - nx) ** 2 + (y - ny) ** 2 for nx, ny in NODES.values()) < (NODE_R + 6) ** 2 for x, y in P])
    nrm, eP, eM, inside = edges(P)
    rP, rM = eP.copy(), eM.copy()
    if THIN_INF and name == "infinity":  # (its thick stretches are a letter's: carried across like a crossing)
        hw_node = hw_node | (np.convolve((eP + eM > THIN_W).astype(float), np.ones(7), "same") > 0)
    # the strand's own half width at each point: the ink's (dt) away from the crossings; through a crossing, carried
    # across from both sides (the crossing's blob would make a hairline as fat as the letter it crosses)
    ok = ~hw_node
    hws = np.interp(np.arange(len(P)), np.nonzero(ok)[0], hw[ok]) if ok.any() else hw
    # its two edges, the same way: measured away from the crossings, carried straight across them
    ok = ~hw_node & inside & (eP <= hw + 8) & (eM <= hw + 8)
    if THIN_INF and name == "infinity" and ok.sum() > 31:
        # (a hairline: a point whose edge bulges past the line's own nearby (a letter's ink merging into it) is no anchor:
        # the line came out with a step there, round 28)
        for e in (eP, eM):
            idx = np.nonzero(ok)[0]
            med = np.array([np.median(e[idx[max(0, k - 15):k + 16]]) for k in range(len(idx))])
            ok[idx[e[idx] > med + 1.5]] = False
    if ok.sum() >= 2:
        idx = np.arange(len(P)); eP = np.interp(idx, idx[ok], eP[ok]); eM = np.interp(idx, idx[ok], eM[ok])
    if THIN_INF:
        # where ink runs a hair outside a strand's carried edge along it (a sliver that opens and closes again, never more
        # than 3.5 px: the A's sweep under the infinity, the A's top past its left leg's edge at the apex), the strand
        # takes it: a 1-2 px sliver left to another stroke read as a ragged edge. Where the other edge leaves the strand
        # (opening wider than that), it keeps its own edge: following it a little way made a bump (round 28)
        for e, r in ((eP, rP), (eM, rM)):
            gap = np.where(inside, r - e, 0.0)
            on = gap > 0.5
            i, n = 0, len(gap)
            while i < n:
                if not on[i]: i += 1; continue
                j = i
                while j < n and on[j]: j += 1
                if gap[i:j].max() <= 3.5 and i > 0 and j < n: e[i:j] += gap[i:j]
                i = j
    eP, eM = gsmooth(eP, 1.5), gsmooth(eM, 1.5)
    thick = np.clip((hws - 4) / (34 - 4), 0, 1)  # (the pen slows on its own strand's thickness, not a crossing's blob)
    v = V_HAIR + (V_THICK - V_HAIR) * thick
    ease = np.clip(np.minimum(S, L - S) / EASE, 0, 1)
    v = v * (0.35 + 0.65 * np.sin(ease * np.pi / 2))
    T = t + np.r_[0, np.cumsum(seg / ((v[1:] + v[:-1]) / 2))]
    if name in END_WITH:  # (a second pen, paced to end with the first)
        e = float(by_name[END_WITH[name]]["T"][-1])
        T = T[0] + (T - T[0]) * (e - T[0]) / (T[-1] - T[0])
    n_pieces = max(1, int(round(L / PIECE)))
    cuts = np.searchsorted(S, np.linspace(0, L, n_pieces + 1)); cuts[-1] = len(P) - 1
    pieces = []
    for k in range(n_pieces):
        a, b = cuts[k], cuts[k + 1]
        if b <= a: continue
        pp = P[a:b + 1]
        # the piece's width from the ink under it away from the crossings (a crossing's blob would widen a hairline's
        # mask enough to show a neighbour early: the J's curl under the flourish); the blobs are covered by the strand
        # that is thick there (checked below)
        far = near_node[a:b + 1] == 0
        # (a low percentile: where a hairline runs inside a letter's thick ink, the ink's distance is the letter's; what
        # the narrow mask misses, the widen pass below gives to the stroke that is thick there)
        w = float(2 * np.percentile(hw[a:b + 1][far] if far.any() else hw[a:b + 1], 40) + 5)
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pp)
        pieces.append({"d": d, "w": round(w, 1), "t0": round(float(T[a]), 4), "t1": round(float(T[b]), 4), "a": int(a), "b": int(b)})
    strokes_out.append({"name": name, "pieces": pieces, "t0": round(float(T[0]), 4), "t1": round(float(T[-1]), 4), "len": round(float(L), 1), "P": P, "T": T,
                        "cuts": cuts, "nrm": nrm, "eP": eP, "eM": eM})
    by_name[name] = strokes_out[-1]
    t = float(T[-1]) + LIFT
WRITE_END = max(float(s["T"][-1]) for s in strokes_out)
print(f"strokes (stage clock, pace {PACE}):", ", ".join(f"{s['name']} {s['len']:.0f} px {s['t0'] / PACE:.2f}-{s['t1'] / PACE:.2f} s ({len(s['pieces'])} pieces)" for s in strokes_out))

# ---- who reveals what: each stroke's strip, then every ink pixel's owner (stroke) and time -----------------------------
# A stroke's strip = its own shape: the quads between its measured edges, point to point (carried straight across a
# crossing). An ink pixel inside strips belongs to the EARLIEST of them (a letter keeps its whole body where the infinity
# crosses it later; the infinity's first pass keeps the centre over its second). A pixel in no strip is a fillet where
# strands meet (within FILLET_R of two or more): not the strand already there, the nearest of the ones that come later, so
# it fills in as that strand arrives instead of sticking out of the earlier one as a bump; anything else (a pointed tip
# past a path's end, a flare) goes to the nearest.
FILLET_R = 6.0
EDGE_M = 0.25  # px past the measured edge (the rim outside the ink is the clips' job, below)
inkm = (ink > 0) if ink_vis is None else ((ink > 0) | ink_vis)
strip_min = []
for s in strokes_out:
    P, T, nrm, eP, eM = s["P"], s["T"], s["nrm"], s["eP"], s["eM"]
    smin = np.full((H, W), np.inf, np.float32)
    for i in range(len(P) - 1):
        q = np.array([P[i] + nrm[i] * (eP[i] + EDGE_M), P[i + 1] + nrm[i + 1] * (eP[i + 1] + EDGE_M),
                      P[i + 1] - nrm[i + 1] * (eM[i + 1] + EDGE_M), P[i] - nrm[i] * (eM[i] + EDGE_M)])
        x0, y0 = np.maximum(np.floor(q.min(0)).astype(int) - 1, 0)
        x1, y1 = np.minimum(np.ceil(q.max(0)).astype(int) + 2, [W, H])
        if x1 <= x0 or y1 <= y0: continue
        m = np.zeros((y1 - y0, x1 - x0), np.uint8)
        cv2.fillPoly(m, [np.round((q - [x0, y0]) * 4).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=2)
        mm = m > 0
        sub = smin[y0:y1, x0:x1]; sub[mm] = np.minimum(sub[mm], T[i])
    strip_min.append(smin)
own_t = np.full((H, W), np.inf, np.float32); own_s = np.full((H, W), -1, np.int16)
for si, smin in enumerate(strip_min):
    m = smin < own_t; own_t[m] = smin[m]; own_s[m] = si
# each stroke's nearest strip pixel, and when that pixel is written (by whoever owns it: where the infinity runs over the
# J's entry, that is the J's time, so the J's own inner corner there stays the J's)
cand = []
for smin in strip_min:
    inside = np.isfinite(smin)
    d, lbl = cv2.distanceTransformWithLabels((~inside).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    zp = np.argwhere(inside)  # label k -> the k-th strip pixel in row-major order
    cand.append((d, np.r_[np.inf, own_t[zp[:, 0], zp[:, 1]]].astype(np.float32)[lbl], np.r_[-1, own_s[zp[:, 0], zp[:, 1]]].astype(np.int16)[lbl],
                 np.r_[np.inf, smin[zp[:, 0], zp[:, 1]]].astype(np.float32)[lbl]))
INF_I = [s["name"] for s in strokes_out].index("infinity")
LETTER_R = 40.0  # infinity-first: ink off the infinity's thin line (> 2 px out) and this near a letter is the letter's
rest = inkm & ~np.isfinite(own_t)
how = np.where(rest, 2, 0).astype(np.uint8)  # (debug: 0 = in a strip, 1 = a fillet, 2 = the nearest)
n_fil = n_oth = 0
for y, x in np.argwhere(rest):
    # each strip's (distance, when its nearest pixel is written by whoever owns it, that owner, the strip's own stroke,
    # when that stroke writes it)
    cs = sorted((float(d[y, x]), float(et[y, x]), int(es[y, x]), k, float(tk[y, x])) for k, (d, et, es, tk) in enumerate(cand))
    near = [c for c in cs if c[0] <= FILLET_R]
    if len(near) >= 2:  # a fillet: not the strand already there (the earliest), the nearest of the ones that come later
        base = min(near, key=lambda c: c[1])
        pick = min((c for c in near if c is not base), key=lambda c: c[0])
        n_fil += 1; how[y, x] = 1
    else:
        pick = cs[0]; n_oth += 1
        if THIN_INF:
            letters = [c for c in cs if c[3] != INF_I and c[0] <= LETTER_R]
            if float(cand[INF_I][0][y, x]) > 2 and letters: pick = letters[0]
    if THIN_INF and pick[3] != INF_I:  # (a letter's ink, written by the letter: where its nearest strip pixel lies on the
        own_t[y, x], own_s[y, x] = pick[4], pick[3]  # infinity's thin line, that pixel's owner is the infinity, not it)
    else:
        own_t[y, x], own_s[y, x] = pick[1], pick[2]
own_t[~inkm] = np.inf; own_s[~inkm] = -1
print(f"owners: {int((inkm & ~rest).sum())} px in a strip, {n_fil} fillet px to the strand that comes later, {n_oth} px to the nearest")

# ---- the pieces: each covers what it owns, and is clipped to it where it would show someone else's ink ----------------
DELTA = 0.15  # s: a piece also owns its neighbours' ink this close in time along its own stroke (no seams between pieces)
def window(si, pc, delta):
    return (own_s == si) & (own_t >= pc["t0"] - delta) & (own_t <= pc["t1"] + delta)
def stamp_disc(s, pc, r):
    m = np.zeros((H, W), np.uint8)
    for j in range(pc["a"], pc["b"] + 1):
        x, y = s["P"][j]
        cv2.circle(m, (int(round(x)), int(round(y))), int(np.ceil(r)), 1, -1)
    return m > 0
# (1) wide enough to reach all its own ink (a crossing's blob, a flare, a pointed tip past the path's end)
for si, s in enumerate(strokes_out):
    for k, pc in enumerate(s["pieces"]):
        last = k == len(s["pieces"]) - 1
        core = (own_s == si) & (own_t >= pc["t0"]) & ((own_t <= pc["t1"]) if last else (own_t < pc["t1"]))
        ys, xs = np.nonzero(core)
        pp = s["P"][pc["a"]:pc["b"] + 1]
        need = 0.0
        for c0 in range(0, len(ys), 3000):
            d2 = (xs[c0:c0 + 3000, None] - pp[None, :, 0]) ** 2 + (ys[c0:c0 + 3000, None] - pp[None, :, 1]) ** 2
            need = max(need, float(np.sqrt(d2.min(axis=1)).max()))
        pc["w"] = round(max(pc["w"], 2 * need + 2), 1)
# (2) clipped to its own ink where its round cap would show another strand's
smooth = lambda m: cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2.0) > 0.5  # no jagged clip edges
n_clipped = 0
for si, s in enumerate(strokes_out):
    for pc in s["pieces"]:
        mine = window(si, pc, DELTA)
        foreign = stamp_disc(s, pc, pc["w"] / 2) & inkm & ~mine
        if foreign.sum() > 6:  # (only round the piece itself: a short clip path)
            # a pixel past its own ink: the rim outside the ink, or ink already written (no seam with it), never a later
            # strand's (that would be a 1-2 px stub on the letter long before the infinity reaches it)
            later = inkm & ~mine & (own_t >= pc["t0"] - DELTA)
            pc["later"] = later
            pc["clip"] = smooth(cv2.dilate(mine.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~later & stamp_disc(s, pc, pc["w"] / 2 + 14)
            n_clipped += 1
print(f"  clipped {n_clipped} pieces to their own ink")

# ---- checks: coverage + early reveal + ticks ----------------------------------------------------------------------
# the reveal time per pixel under the mask (each path point stamps a disc of its piece's half width, earliest wins)
def simulate():
    st = np.full((H, W), np.inf, np.float32)
    for s in strokes_out:
        P, T = s["P"], s["T"]
        for pc in s["pieces"]:
            r = pc["w"] / 2
            for j in range(pc["b"], pc["a"] - 1, -1):
                x, y = P[j]
                x0, x1, y0, y1 = int(max(0, x - r - 1)), int(min(W, x + r + 2)), int(max(0, y - r - 1)), int(min(H, y + r + 2))
                yy, xx = np.mgrid[y0:y1, x0:x1]
                m = (xx - x) ** 2 + (yy - y) ** 2 <= r * r
                if "clip" in pc: m &= pc["clip"][y0:y1, x0:x1]
                sub = st[y0:y1, x0:x1]
                sub[m] = np.minimum(sub[m], T[j])
    return st
by_stroke = [[(pc, j) for pc in s["pieces"] for j in range(pc["a"], pc["b"] + 1)] for s in strokes_out]
for it in range(4):
    stamp = simulate()
    miss = np.argwhere(inkm & ~np.isfinite(stamp))
    if not len(miss): break
    for y, x in miss:  # the owner piece reaches a little further (inside its own clip)
        si, tt = int(own_s[y, x]), float(own_t[y, x])
        cand = [(pc, j) for pc, j in by_stroke[si] if pc["t0"] - DELTA <= tt <= pc["t1"] + DELTA]
        xy = np.array([strokes_out[si]["P"][j] for pc, j in cand])
        d2 = (xy[:, 0] - x) ** 2 + (xy[:, 1] - y) ** 2
        pc, j = cand[int(d2.argmin())]
        pc["w"] = round(max(pc["w"], 2 * float(np.sqrt(d2.min())) + 3), 1)
        if "clip" in pc:
            ys_, xs_ = slice(max(0, y - 2), y + 3), slice(max(0, x - 2), x + 3)
            pc["clip"][ys_, xs_] |= ~pc["later"][ys_, xs_]
            pc["clip"][y, x] = True
    print(f"  widen pass {it + 1}: {len(miss)} px were uncovered")

# the pen's time at an ink pixel = when the pen passes its nearest path point (for "ahead of the pen")
pen_img = np.full((H, W), np.inf, np.float32)
for s in strokes_out:
    for (x, y), tt in zip(s["P"], s["T"]):
        xi, yi = int(round(x)), int(round(y))
        if 0 <= xi < W and 0 <= yi < H: pen_img[yi, xi] = min(pen_img[yi, xi], tt)
seed = np.isfinite(pen_img)
dist, lbl = cv2.distanceTransformWithLabels((~seed).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
seed_pts = np.argwhere(seed)  # label k -> k-th zero pixel in row-major order
lut = np.zeros(lbl.max() + 1, np.float32); lut[1:] = pen_img[seed_pts[:, 0], seed_pts[:, 1]][: lbl.max()]
pen_t = lut[lbl]
uncovered = inkm & ~np.isfinite(stamp)
yy, xx = np.mgrid[0:H, 0:W]
at_node = np.zeros((H, W), bool)
for nx, ny in NODES.values(): at_node |= (xx - nx) ** 2 + (yy - ny) ** 2 < (NODE_R + 20) ** 2
early = inkm & np.isfinite(stamp) & (np.minimum(pen_t, own_t) - stamp > 0.25) & ~at_node  # (a pixel a letter owns is no lead)
# ticks: ink shown > 0.2 s before its owner writes it
ticks = inkm & (stamp < own_t - 0.2)
ticks = cv2.morphologyEx(ticks.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0  # (single AA pixels aside)
print(f"check: uncovered ink {uncovered.sum()} px ({100 * uncovered.mean() / max(inkm.mean(), 1e-9):.3f}% of ink), "
      f"revealed > 0.25 s ahead of the pen away from the crossings {early.sum()} px ({100 * early.sum() / inkm.sum():.2f}% of ink), "
      f"ticks {ticks.sum()} px")
_n, _lab, _st, _cen = cv2.connectedComponentsWithStats(ticks.astype(np.uint8))
if os.environ.get("MONO_DEBUG"):  # (the maps, for zoomed looks at the crossings)
    np.savez_compressed(os.path.join(REVIEW, "monogram-debug.npz"), stamp=stamp, own_t=own_t, own_s=own_s, how=how, soft=soft)
print("  ticks at (frame px, size):", ", ".join(f"({int(_cen[k][0])},{int(_cen[k][1])}) {_st[k, 4]}" for k in range(1, _n) if _st[k, 4] >= 3) or "none")

# ---- review pictures ---------------------------------------------------------------------------------------------
def colormap(tm, mask):
    v = np.where(mask, np.clip(tm / WRITE_END, 0, 1), 0)
    c = cv2.applyColorMap((v * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    c[~mask] = (24, 30, 22)
    return c
tm = colormap(stamp, inkm)
tm[uncovered] = (255, 0, 255)
tm[early | ticks] = (255, 255, 255)
for s in strokes_out:
    for (x, y) in s["P"][::6]: cv2.circle(tm, (int(x), int(y)), 1, (0, 0, 0), -1)
    x, y = s["P"][0]; cv2.putText(tm, s["name"], (int(x) + 8, int(y) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
cv2.putText(tm, f"reveal time 0 (blue) -> {WRITE_END / PACE:.1f} s (red); white = ahead of the pen; magenta = never covered", (20, 920), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (230, 230, 230), 1)
cv2.imwrite(os.path.join(REVIEW, "monogram-timemap.png"), tm)
frames = []
for tt in np.linspace(0.6, WRITE_END + 0.2, 8):
    f = np.full((H, W, 3), (16, 40, 22), np.uint8)
    shown = inkm & (stamp <= tt)
    f[shown] = (190, 236, 255)
    f[heart > 0.5] = (190, 236, 255) if tt > WRITE_END else (16, 40, 22)
    cv2.putText(f, f"{tt / PACE:.1f} s", (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (200, 220, 230), 3)
    frames.append(cv2.resize(f, (W // 2, H // 2), interpolation=cv2.INTER_AREA))
sheet = np.vstack([np.hstack(frames[i:i + 4]) for i in (0, 4)])
cv2.imwrite(os.path.join(REVIEW, "monogram-write.png"), sheet)

# ---- the data module ---------------------------------------------------------------------------------------------
data = {
    "w": W, "h": H, "ink": ink_d, "heart": heart_d,
    "heartBox": [int(v) for v in cv2.boundingRect((heart > 0.5).astype(np.uint8))],
    "writeEnd": round(WRITE_END / PACE, 3),
    "strokes": [{"name": s["name"], "t0": round(s["t0"] / PACE, 4), "t1": round(s["t1"] / PACE, 4), "pieces": [{**{k: pc[k] for k in ("d", "w")}, **{k: round(pc[k] / PACE, 4) for k in ("t0", "t1")}, **({"clip": trace(pc["clip"].astype(np.float32))} if "clip" in pc else {})} for pc in s["pieces"]]} for s in strokes_out],
}
if "--no-data" in FLAGS:
    print(f"review only ({ORDER}): {REVIEW}/monogram-{{timemap,write}}.png; the stage's data is unchanged")
    sys.exit(0)
with open(OUT_TS, "w") as f:
    f.write("// GENERATED by src/wedding/trace/monogram-svg.py (do not edit): the A♥J monogram as SVG + its pen strokes.\n")
    f.write("// ink / heart: path data in the frame's px (viewBox 0 0 w h, the old monogram.png's framing x3.26); strokes: the\n")
    f.write("// writing order, each cut into pieces (a round-capped mask stroke: d, width w, written from t0 to t1 s).\n")
    f.write("export type Piece = { d: string; w: number; t0: number; t1: number; clip?: string };\n")
    f.write("export type Stroke = { name: string; t0: number; t1: number; pieces: Piece[] };\n")
    f.write("export const MONOGRAM: { w: number; h: number; ink: string; heart: string; heartBox: [number, number, number, number]; writeEnd: number; strokes: Stroke[] } = ")
    f.write(json.dumps(data, separators=(",", ":")))
    f.write(";\n")
print(f"wrote {OUT_TS} ({os.path.getsize(OUT_TS) // 1024} KB), review {REVIEW}/monogram-{{timemap,write}}.png")
if uncovered.sum() > 0.0005 * inkm.sum() or early.sum() > 0.002 * inkm.sum() or max([_st[k, 4] for k in range(1, _n)] + [0]) > 60:  # (a tick > 60 frame px = over ~3 px on screen)
    print("CHECK FAILED"); sys.exit(1)
