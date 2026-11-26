# The piggyback (key 2) as a rig of the approved picture's own pixels (round 19, 2026-10-27; the user, on the A/B run
# examples: "A or B is not good … for B do you think this is right? hahhahha twisted … do what are the best not for
# convience"). Moving a leg as one stiff piece (A) or mirroring it (B) can't run: a mirror bends the knee backwards and
# can't turn a shoe. So Dan's legs get joints: one leg (his near one, the whole trouser leg from the hip to the cuff)
# bends at the knee through a mesh (each vertex shared between the thigh and the shin, so the outline runs on round the
# knee, never a cut), and the shoe with the ankle turns at the ankle, behind the cuff. His far leg is the same two pieces,
# a shade darker, behind. Everything else (Ange, his body, the jacket) is the base, with his legs taken out below the
# jacket's hem; the base bends a little through its own mesh (her hair and dress, the bouquet arm, his curls and fist, her
# bounce on his back: weights here, the moves in PiggyRun.tsx).
#   .venv/bin/python -I src/wedding/trace/piggy-cut.py src/wedding/painted/piggy-faces.png <work dir> src/wedding/painted
#   -> <out>/piggy-{base,leg,foot}.png + <out>/piggyParts.ts; <work dir>/cut.png (base / leg / foot, the bones)
# Hand-measured on the 1122 x 1402 picture (picture px), zoomed with a grid (round 19).
import sys, os, json, cv2, numpy as np

src, wd, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(wd, exist_ok=True)
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
H, W = im.shape[:2]
bgr = im[..., :3].astype(np.float32)
alpha = im[..., 3].astype(np.float32) / 255
Lab = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1); return m > 0
def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def dil(m, r): return cv2.dilate(m.astype(np.uint8), disk(r)) > 0
def soft(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
def ramp(v, a, b): return np.clip((v - a) / (b - a), 0, 1)
def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

# --- measured lines ---
# the jacket's hem (the first pants row under its dark edge), back to front: the back tail, the front panel's corner,
# its bottom edge, the V by the vest, the vest's point
HEM = [(500, 945), (520, 945), (540, 943), (550, 943), (560, 948), (570, 951), (580, 951), (590, 937), (600, 922),
       (620, 929), (640, 937), (660, 945), (680, 953), (690, 957), (696, 957), (700, 952), (704, 945), (708, 939),
       (712, 934), (716, 938), (720, 942), (724, 946), (728, 950), (732, 955), (736, 959), (740, 964), (744, 968), (750, 974)]
# (the vest's point: the dark line under its lining ends there; past it the line is the leg's outline)
VEST_TIP = [(744, 968), (748, 966), (750, 961), (762, 957)]
# the near thigh's back edge over the far thigh (its dark line, 2 px on the far side so the line stays the near leg's)
EDGE = [(528, 968), (540, 987), (560, 998), (570, 1005), (580, 1012), (590, 1019), (600, 1026), (610, 1033), (620, 1040),
        (630, 1046), (640, 1054), (650, 1062), (660, 1068), (670, 1074), (680, 1081), (692, 1086)]
# the cuff's opening, where the ankle comes out (the cuff's edge stays the leg's), front to back, then the skin's back
CUFF = [(895, 1222), (880, 1224), (862, 1220), (850, 1206), (809, 1249), (816, 1262), (824, 1272), (829, 1276)]
# Ange's ruffle tip (grey-white, its shading too) where it meets his pants (cream, warmer) stays hers, with its outline
# (her ruffle ends at y ~1030 there; the white under it, x 480-530, is his far shin's highlight)
# (only the ruffle itself, its big pieces: grey shading on his pants on its own isn't hers)
ruffle = (Lab[..., 2] - 128 <= 5) & (Lab[..., 0] > 90) & (xx < 560) & (yy < 1040) & ~((xx > 480) & (xx < 530) & (yy > 1031))
# (its solid pixels: a line's soft edge, see-through, would chain a stray line on to it)
n_, cc_, st_, _ = cv2.connectedComponentsWithStats((ruffle & (alpha > 0.9)).astype(np.uint8), connectivity=4)
ruffle = dil(np.isin(cc_, [k for k in range(1, n_) if st_[k, cv2.CC_STAT_AREA] >= 400]), 1) & ruffle
ruffle |= (Lab[..., 0] < 90) & dil(ruffle, 2) & (xx < 545) & (yy < 1040)

# --- the bones (the near leg as drawn: the hip under the hem, the knee at the crease, the ankle inside the cuff) ---
HIP, KNEE, ANKLE = np.array([650.0, 930.0]), np.array([770.0, 1100.0]), np.array([850.0, 1236.0])
# the shoe's sole, its two ends (heel, toe), for standing it on the ground
HEEL, TOE = np.array([880.0, 1386.0]), np.array([1052.0, 1262.0])

# --- the near leg: below the hem, above-right of the edge, down to the cuff's opening; no skin ---
LEG = poly(HEM[::-1][:1] + [(800, 985), (935, 1060), (930, 1180)] + CUFF + [(790, 1290), (700, 1290)] + EDGE[::-1]
           + [(520, 955)] + HEM[1:])
skin = (Lab[..., 1] > 142) & (Lab[..., 0] > 150)
# (3 px under the hem dropped: its edge and shadow are the jacket's)
leg0 = LEG & (alpha > 0.01) & ~ruffle & ~skin
# above the hem (under the jacket, where the thigh turns): the pants carried on up the thigh, each pixel the pants 14 px
# under the hem along the thigh (clear of its shadow; both outlines run on up), up past the hip
u = (KNEE - HIP) / np.linalg.norm(KNEE - HIP)
hem_m = np.zeros((H, W), bool)
for (x0, y0), (x1, y1) in zip(HEM[:-1], HEM[1:]):
    for x in range(x0, x1 + 1):
        hem_m[: int(round(y0 + (y1 - y0) * (x - x0) / max(x1 - x0, 1))), x] = True
hem3 = dil(hem_m, 3) & (yy > hem_m.argmin(0)[None, :] - 40)
leg = leg0 & ~hem3
ext_zone = (hem_m | hem3) & (yy > HIP[1] - 150) & (xx > 470) & (xx < 790)
lrgb, lal = bgr * leg[..., None], alpha * leg
reach = np.full((H, W), -1, np.float32)
todo = ext_zone.copy()
for t in range(1, 260):
    sxi = np.clip(np.round(xx + u[0] * t).astype(int), 0, W - 1)
    syi = np.clip(np.round(yy + u[1] * t).astype(int), 0, H - 1)
    hit = todo & leg[syi, sxi]
    if not hit.any():
        continue
    # (the first pants along the thigh, then 14 px on)
    sxi2 = np.clip(np.round(xx + u[0] * (t + 14)).astype(int), 0, W - 1)
    syi2 = np.clip(np.round(yy + u[1] * (t + 14)).astype(int), 0, H - 1)
    ok2 = hit & leg[syi2, sxi2]
    reach[ok2], reach[hit & ~ok2] = t + 14, t
    todo &= ~hit
# (sampled smoothly, premultiplied: the front outline runs up across the thigh's line, and the nearest pixel drew it as
# dashes, round 19)
pre = cv2.remap(np.dstack([lrgb * lal[..., None], lal]).astype(np.float32), (xx + u[0] * reach).astype(np.float32),
                (yy + u[1] * reach).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
ext_al = pre[..., 3] * (reach > 0)
ext_rgb = pre[..., :3] / np.maximum(pre[..., 3:], 1e-4)
# (kept to a round hip: within HIP_R of the hip, the thigh's top as a ball, its back and top edge outlined like the rest
# of the leg; a leg swung far back shows that rounded seat under the jacket's back, not a flat cut, round 19)
HIP_R = 128
dist = np.hypot(xx - HIP[0], yy - HIP[1])
ext_al *= np.clip(HIP_R - dist, 0, 1)
ink = np.median(bgr[leg & (Lab[..., 0] < 60)], axis=0)
rim = np.clip(1 - np.abs(dist - (HIP_R - 2.5)) / 2.5, 0, 1) * (ext_al > 0) * ~dil(leg, 2)
ext_rgb = ext_rgb * (1 - rim[..., None]) + ink * rim[..., None]
leg_rgb = np.where((ext_al > 0)[..., None] & ~leg[..., None], ext_rgb, lrgb)
leg_al = np.where(ext_al > 0, np.maximum(ext_al, lal), lal)

# --- the foot: the ankle's skin and the shoe, below the cuff's opening; the skin carried on up into the cuff (hidden
# behind it, so it never shows a top edge as the foot turns) ---
FOOT = poly(CUFF[::-1][:0] + [(829, 1276), (824, 1300), (820, 1400), (1100, 1400), (1100, 1180)] + CUFF[:4] + CUFF[4:])
foot = FOOT & (alpha > 0.01) & (~LEG | skin)
frgb, fal = bgr * foot[..., None], alpha * foot
sk = foot & skin
skin_col = np.median(bgr[sk & (yy > 1225) & (yy < 1260)], axis=0)
us = (ANKLE - KNEE) / np.linalg.norm(ANKLE - KNEE)
# (a rounded stub up the shin's line from the ankle's skin, the skin's width, 35 px up: inside the cuff as the foot turns)
cx, cy = ANKLE
along = (xx - cx) * us[0] + (yy - cy) * us[1]
across = -(xx - cx) * us[1] + (yy - cy) * us[0]
stub = (((along + 15) / 22) ** 2 + (across / 22) ** 2 <= 1) & ~foot
frgb[stub], fal[stub] = skin_col, 1

# --- the base: his legs taken out below the hem (both legs, both shoes); her ruffle and shoes stay ---
LEGS_ALL = poly(HEM[1:-1] + VEST_TIP + [(800, 985), (1122, 1060), (1122, 1402), (200, 1402), (200, 1060), (250, 1035),
                                      (330, 1030), (380, 1035), (470, 1035), (492, 1036), (512, 992), (528, 968),
                                      (520, 950)])
gone = LEGS_ALL & ~ruffle
base_al = alpha * ~gone
# (and any speck the cut leaves by it, a few px of ruffle or pants on its own)
n_, cc_, st_, _ = cv2.connectedComponentsWithStats((base_al > 0.05).astype(np.uint8), connectivity=8)
specks = np.isin(cc_, [k for k in range(1, n_) if st_[k, cv2.CC_STAT_AREA] < 60]) & dil(gone, 4)
base_al[specks] = 0

# --- the base's moving parts, as weights (0 where each meets what holds it) ---
w = {
    # her bouquet arm, turning at the shoulder
    "bouquet": soft(poly([(470, 470), (505, 430), (365, 240), (425, 180), (425, 0), (100, 0), (100, 340), (300, 340),
                          (335, 300)]), 10) * ramp(np.hypot(xx - 470, yy - 445), 40, 220),
    # her hair, out to its ends on the left
    "hair": soft(poly([(470, 150), (470, 590), (210, 570), (170, 400), (250, 170)]), 18) * ramp(-xx, -470, -230),
    # her dress, out to its trailing edge
    "dress": soft(poly([(560, 570), (650, 620), (560, 1060), (20, 1060), (0, 700), (200, 570)]), 18) * ramp(-xx, -580, -60),
    # his curls, the top of his head
    "curls": soft(poly([(640, 280), (1110, 280), (1110, 600), (1000, 470), (760, 450), (640, 600)]), 14) * ramp(-yy, -480, -300),
    # his fist arm, turning at the shoulder
    "fist": soft(poly([(835, 690), (965, 700), (1105, 760), (1105, 905), (1000, 925), (895, 905), (825, 760)]), 8)
    * ramp(np.hypot(xx - 860, yy - 712), 40, 220),
    # all of her (riding on his back: she bounces a beat after him); his head, shoulders and the arm under her stay his
    "ange": soft(poly([(0, 0), (640, 0), (660, 300), (600, 560), (720, 640), (700, 700), (600, 760), (560, 1060),
                       (0, 1060)]), 30),
}
PIV = {"bouquet": [470, 445], "fist": [860, 712]}

def crop(rgb, a, pad=2):
    ys, xs = np.where(a > 0.004)
    x0, y0, x1, y1 = max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, W), min(ys.max() + pad + 1, H)
    o = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), np.clip(a[y0:y1, x0:x1] * 255, 0, 255)]).astype(np.uint8)
    return o, [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

boxes = {}
for name, rgb, a in (("base", bgr, base_al), ("leg", leg_rgb, leg_al), ("foot", frgb, fal)):
    o, boxes[name] = crop(rgb, a)
    cv2.imwrite(f"{out}/piggy-{name}.png", o)

# --- meshes: the leg's (each vertex's share of the shin: 0 the thigh, 1 the shin, eased across the knee) and the base's
# (each moving part's weight), vertices every ~MESH px over each box, row by row ---
def grid(box, step):
    x0, y0, bw, bh = box
    nx, ny = int(np.ceil(bw / step)) + 1, int(np.ceil(bh / step)) + 1
    gx = np.clip(np.round(np.linspace(x0, x0 + bw, nx)).astype(int), 0, W - 1)
    gy = np.clip(np.round(np.linspace(y0, y0 + bh, ny)).astype(int), 0, H - 1)
    return [nx, ny], np.ix_(gy, gx)
ut, ush = (KNEE - HIP) / np.linalg.norm(KNEE - HIP), (ANKLE - KNEE) / np.linalg.norm(ANKLE - KNEE)
bis = (ut + ush) / np.linalg.norm(ut + ush)
shin = smooth(-30, 30, (xx - KNEE[0]) * bis[0] + (yy - KNEE[1]) * bis[1])
n_leg, ix = grid(boxes["leg"], 10)
mesh = {"leg": dict(n=n_leg, w=[round(float(v), 3) for v in shin[ix].ravel()])}
n_base, ix = grid(boxes["base"], 24)
mesh["base"] = dict(n=n_base, **{k: [round(float(v), 2) for v in m[ix].ravel()] for k, m in w.items()})

ts = ["// GENERATED by src/wedding/trace/piggy-cut.py: the piggyback picture (the toast faces on it, approved round 17) cut",
      "// for the run (round 19): each piece's box in the picture ([x, y, w, h], picture px); Dan's near leg's bones as drawn",
      "// (hip, knee, ankle) and his shoe's sole (heel, toe); the leg's mesh (each vertex's share of the shin, 0..1) and the",
      "// base's (each moving part's weight; pivots for the turning ones), at n[0] x n[1] vertices over the box, row by row.",
      "export const PIGGY = {", f"  size: {json.dumps([W, H])},", "  boxes: {"]
ts += [f'    {k}: {json.dumps(v)},' for k, v in boxes.items()] + ["  },"]
ts += [f"  bones: {json.dumps(dict(hip=HIP.tolist(), knee=KNEE.tolist(), ankle=ANKLE.tolist(), heel=HEEL.tolist(), toe=TOE.tolist()))},"]
ts += [f"  pivots: {json.dumps(PIV)},", "  mesh: {"]
ts += [f'    {k}: {json.dumps(v, separators=(",", ":"))},' for k, v in mesh.items()] + ["  },", "} as const;", ""]
open(f"{out}/piggyParts.ts", "w").write("\n".join(ts))

# the check: base dimmed, the leg blue, the foot orange, the leg's shin share (red) and the bones
c = (bgr * alpha[..., None] * 0.35).astype(np.uint8)
lm, fm = leg_al > 0.3, fal > 0.3
c[lm] = (np.stack([255 * (1 - shin), 60 + 0 * shin, 255 * shin], -1)[lm] * 0.55 + leg_rgb[lm] * 0.45).astype(np.uint8)
c[fm] = (np.array([0, 140, 255]) * 0.5 + frgb[fm] * 0.5).astype(np.uint8)
for p, q in ((HIP, KNEE), (KNEE, ANKLE)):
    cv2.line(c, tuple(np.round(p).astype(int)), tuple(np.round(q).astype(int)), (255, 255, 255), 2, cv2.LINE_AA)
for p in (HIP, KNEE, ANKLE, HEEL, TOE):
    cv2.circle(c, tuple(np.round(p).astype(int)), 6, (0, 255, 255), -1, cv2.LINE_AA)
cv2.imwrite(f"{wd}/cut.png", c)
print(json.dumps(boxes))
