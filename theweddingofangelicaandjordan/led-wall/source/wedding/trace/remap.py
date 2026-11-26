# Dan & Ange (wedding test, 2026-10-25): cut each character out of the picture and remap it to its own palette.
# Usage: python3 -I src/wedding/trace/remap.py src/wedding/dan-ange-ref.png <work dir>
#   -> <work>/<name>_idx.npy (palette index per px, 255 = outside) + <name>_pal.json; then split.py
# The background is near white, like the suit and the dress, so it's a flood from the border that stops at the outlines.
import sys, json, cv2, numpy as np
pic, wd = sys.argv[1], sys.argv[2]
im = cv2.imread(pic)
H, W = im.shape[:2]
# palettes: weighted k-means of each character's colours (18 each), lightest first (that's also the stacking order)
PAL = {
    "dan": ["#F7F3EC", "#F1E1CA", "#F7D081", "#DBCEBF", "#F2C6A2", "#E6A984", "#BCB1A6", "#E08B68", "#A59383",
            "#B37353", "#847568", "#8A563E", "#62574D", "#6A3C26", "#433932", "#472417", "#241F1C", "#130E0D"],
    "ange": ["#F9F6F0", "#EBE2D6", "#FACBAA", "#D2C7B8", "#ECAB89", "#B3AB94", "#E08C6D", "#978E7B", "#AF7054",
             "#708843", "#786C5D", "#556431", "#834C38", "#574B41", "#36401B", "#49342C", "#2E2520", "#17110D"],
}
m = np.zeros((H + 2, W + 2), np.uint8)
flags = 4 | cv2.FLOODFILL_FIXED_RANGE | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
for seed in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (W // 2, H - 1), (600, 640)):
    if not m[seed[1] + 1, seed[0] + 1]:
        cv2.floodFill(im, m, seed, 0, (8, 8, 8), (8, 8, 8), flags)
fg = m[1:-1, 1:-1] == 0
# then the light fringe outside the outline joins the background
cand = ((im.min(2) >= 225) | ~fg).astype(np.uint8)
n, lab = cv2.connectedComponents(cand, connectivity=4)
bg = np.isin(lab, np.unique(lab[~fg])) & (cand > 0)
n, lab, st, _ = cv2.connectedComponentsWithStats((~bg).astype(np.uint8), connectivity=4)
two = sorted(range(1, n), key=lambda i: -st[i, cv2.CC_STAT_AREA])[:2]
two.sort(key=lambda i: st[i, cv2.CC_STAT_LEFT])
Lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
for name, ci in zip(("dan", "ange"), two):
    sil = lab == ci
    hexes = PAL[name]
    rgb = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in hexes], np.uint8)
    pl = cv2.cvtColor(rgb[None, :, ::-1], cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    idx = np.full((H, W), 255, np.uint8)
    px = Lab[sil]
    idx[sil] = np.argmin(((px[:, None] - pl[None]) ** 2).sum(2), 1)
    np.save(f"{wd}/{name}_idx.npy", idx)
    json.dump(hexes, open(f"{wd}/{name}_pal.json", "w"))
    q = np.full((H, W, 3), 255, np.uint8); q[sil] = rgb[idx[sil]][:, ::-1]
    cv2.imwrite(f"{wd}/{name}_q.png", q)
    print(name, "px", sil.sum(), "bbox", st[ci, :4])
