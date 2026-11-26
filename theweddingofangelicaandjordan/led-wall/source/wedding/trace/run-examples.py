# Rough examples for the piggyback scene (key 2), A vs B, made straight from the approved picture (no Remotion yet):
#   A = one picture: the body bobs and leans, hair, dress, bouquet arm and Dan's fist move, legs stay put
#   B = the same, plus a second pose made in code: Dan's legs mirrored at the hip (front leg back, back leg front),
#       swapped every step like a 2-frame run (a stand-in for a 2nd AI picture with the legs swapped)
# usage: .venv/bin/python -I src/wedding/trace/run-examples.py <piggy-faces.png> <out dir> [poses]  (round 18, 2026-10-27;
#   "poses" = only <out>/piggy-run-B-poses.png, the two leg poses side by side)
import sys, os, subprocess, cv2, numpy as np

src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED).astype(np.float32)
H, W = im.shape[:2]
rgb, al = im[..., :3], im[..., 3] / 255
FPS, STEP, N = 30, 8, 30 * 4  # 8 frames a step (~3.7 steps a second), 4 s

def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m > 0
def soft(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def ramp(v, a, b): return np.clip((v - a) / (b - a), 0, 1)

# --- B's second pose: the legs mirrored about the hip, below a straight cut across the hips (y 975, under the jacket's
# hem), where the pants run 536..755 wide: mirrored about their middle, the two spans meet exactly; the cut fades over
# 6 px above it (gone by the cut, so neither pair's outline shows past the other). Ange's shoes and ruffle stay in front. ---
CUT = 975
LEGS = poly([(536, CUT - 6), (800, CUT - 6), (800, 1010), (1122, 1010), (1122, 1402), (200, 1402), (200, 1060),
             (250, 1035), (330, 1030), (380, 1035), (470, 1035), (505, 1028), (535, 995)])
XM2 = 536 + 755  # x -> XM2 - x
# (her ruffle's tip, grey-white, where it meets his pants (cream, warmer), stays hers)
LAB = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
ruffle = (LAB[..., 2] - 128 <= 5) & (LAB[..., 0] > 150) & (xx < 560) & (yy < 1040)
n_, cc_, st_, _ = cv2.connectedComponentsWithStats((LEGS & (al > 0.01) & ~ruffle).astype(np.uint8), connectivity=8)
legs = np.isin(cc_, [k for k in range(1, n_) if st_[k, cv2.CC_STAT_AREA] >= 500])
def mirror_x(a):
    o = np.zeros_like(a)
    xs = np.arange(W); sx = XM2 - xs; ok = (sx >= 0) & (sx < W)
    o[:, xs[ok]] = a[:, sx[ok]]
    return o
fade = np.clip((yy - (CUT - 6)) / 6, 0, 1)
lrgb, lal = rgb * legs[..., None], al * legs
mrgb, mal = mirror_x(lrgb), mirror_x(lal)
# the rest drawn over the mirrored legs (the jacket, Ange's dress and shoes stay in front; the old legs fade out at the cut)
rest_al = al * (1 - legs * fade)
a2 = rest_al + mal * (1 - rest_al)
rgb2 = (rgb * rest_al[..., None] + mrgb * (mal * (1 - rest_al))[..., None]) / np.maximum(a2, 1e-4)[..., None]
POSES = [(rgb, al), (rgb2, a2)]

# --- what moves on top (soft regions; each weight 0 where it joins the body) ---
w_bq = soft(poly([(470, 470), (505, 430), (365, 240), (425, 180), (425, 0), (100, 0), (100, 340), (300, 340), (335, 300)]), 10) \
    * ramp(np.hypot(xx - 470, yy - 445), 40, 220)
w_hair = soft(poly([(470, 150), (470, 590), (210, 570), (170, 400), (250, 170)]), 18) * ramp(-xx, -470, -230)
w_dress = soft(poly([(560, 570), (650, 620), (560, 1060), (20, 1060), (0, 700), (200, 570)]), 18) * ramp(-xx, -580, -60)
w_curl = soft(poly([(640, 280), (1110, 280), (1110, 600), (1000, 470), (760, 450), (640, 600)]), 14) * ramp(-yy, -480, -300)
w_arm = soft(poly([(835, 690), (965, 700), (1105, 760), (1105, 905), (1000, 925), (895, 905), (825, 760)]), 8) \
    * ramp(np.hypot(xx - 860, yy - 712), 40, 220)

def twist(mx, my, w, px, py, deg):
    # each point turned about (px, py) by its share w of deg (sampled backwards)
    t = -np.radians(deg) * w
    c, s = np.cos(t), np.sin(t)
    dx, dy = mx - px, my - py
    return px + c * dx - s * dy, py + s * dx + c * dy

def frame(t, two):
    pose = POSES[(int((t + STEP / 2) // STEP) % 2) if two else 0]
    ph = 2 * np.pi * t / STEP          # one cycle a step
    st = 2 * np.pi * t / (2 * STEP)    # one cycle a stride (two steps)
    mx, my = xx.copy(), yy.copy()
    # hair and dress: waves running out to their ends, a little after each step
    hx = 4 * np.cos(ph - (470 - xx) / 90); hy = 9 * np.sin(ph - (470 - xx) / 90)
    dx_ = 5 * np.sin(ph - 0.6 - (600 - xx) / 110); dy_ = 12 * np.sin(ph - 0.3 - (600 - xx) / 110)
    mx -= hx * w_hair + dx_ * w_dress; my -= hy * w_hair + dy_ * w_dress
    my -= 6 * np.sin(ph - 1.2) * w_curl
    mx, my = twist(mx, my, w_bq, 470, 445, 6 * np.sin(st - 0.8))
    mx, my = twist(mx, my, w_arm, 860, 712, 8 * np.sin(st + np.pi))
    pr, pa = pose
    img = np.dstack([pr * pa[..., None], pa])
    return cv2.remap(img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

OW, OH, SC = 960, 720, 0.45
BG = np.array([24, 40, 13], np.float32)
FEET_Y = 1390  # the planted shoe's sole, picture px

def render(t, two, label):
    f = frame(t, two)
    bob = abs(np.sin(np.pi * t / STEP))            # 0 on a footfall, 1 mid-air
    lift = 34 * bob
    sq = 1 - 0.025 * (1 - bob) ** 6                # a little squash as a foot lands
    lean = 1.5 * np.sin(2 * np.pi * t / (2 * STEP))
    cx, cy = OW / 2 + 10, 690
    A = cv2.getRotationMatrix2D((W / 2, FEET_Y), -lean, 1)
    A = np.vstack([A, [0, 0, 1]])
    S = np.array([[SC / sq ** 0.5, 0, cx - SC * W / 2], [0, SC * sq, cy - SC * FEET_Y * sq - lift], [0, 0, 1]])
    M = (S @ A)[:2]
    o = cv2.warpAffine(f, M.astype(np.float32), (OW, OH), flags=cv2.INTER_AREA if SC < 1 else cv2.INTER_LINEAR)
    bg = np.ones((OH, OW, 3), np.float32) * BG
    # ground: a soft shadow that shrinks as they rise, dashes running back
    sh = np.zeros((OH, OW), np.float32)
    cv2.ellipse(sh, (int(cx + 20), cy + 4), (int(190 - 40 * bob), int(16 - 4 * bob)), 0, 0, 360, 1, -1)
    sh = cv2.GaussianBlur(sh, (0, 0), 6) * 0.45
    bg *= (1 - sh)[..., None]
    for k in range(8):
        x = int((k * 160 - t * 22) % (OW + 200)) - 100
        cv2.line(bg, (x, cy + 18), (x + 60, cy + 18), (60, 92, 52), 3, cv2.LINE_AA)
    res = o[..., :3] + bg * (1 - o[..., 3:4])
    res = np.clip(res, 0, 255).astype(np.uint8)
    cv2.putText(res, label, (24, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (160, 207, 232), 2, cv2.LINE_AA)
    return res

os.makedirs(out, exist_ok=True)
# B's two poses side by side, for checking the legs
p2 = rgb2 * a2[..., None] + BG * (1 - a2[..., None])
p1 = rgb * al[..., None] + BG * (1 - al[..., None])
cv2.imwrite(f"{out}/piggy-run-B-poses.png", np.clip(np.hstack([p1, p2]), 0, 255).astype(np.uint8))
if sys.argv[3:] == ["poses"]:
    sys.exit()
for name, two, label in (("A", False, "A: one picture (legs stay put)"), ("B", True, "B: legs swap every step")):
    d = f"{out}/frames-{name}"; os.makedirs(d, exist_ok=True)
    for t in range(N):
        cv2.imwrite(f"{d}/{t:04d}.png", render(t, two, label))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{d}/%04d.png", "-c:v", "libx264",
                    "-pix_fmt", "yuv420p", "-crf", "18", f"{out}/piggy-run-{name}.mp4"], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{out}/piggy-run-A.mp4", "-i", f"{out}/piggy-run-B.mp4",
                "-filter_complex", "[0:v][1:v]hstack=inputs=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
                f"{out}/piggy-run-AB.mp4"], check=True)
