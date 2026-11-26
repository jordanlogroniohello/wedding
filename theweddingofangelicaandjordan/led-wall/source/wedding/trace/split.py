# Dan & Ange (wedding test, 2026-10-25): split the remapped picture (remap.py) into rig parts and trace them.
# Usage (after remap.py): python3 -I src/wedding/trace/split.py <work dir> src/wedding
#   -> <work>/<name>_parts/*.pbm|svg (one mask per part x colour), <out>/moreDetailedCute<Name>Parts.ts
# The picture has soft shading, so each part is a stack of colour layers, lightest first: layer k holds every pixel of
# the part whose colour is k or darker, so the layers never leave gaps between colours (the darker ones paint over).
# Hand-measured on the 1216x1294 picture (same steps as scripts/trace/more-detailed-cute-kukki-split.py).
import sys, os, re, json, subprocess, cv2, numpy as np

wd, tsdir = sys.argv[1], sys.argv[2]

def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
def dil(m, r): return cv2.dilate(m.astype(np.uint8), disk(r)) > 0
def ero(m, r): return cv2.erode(m.astype(np.uint8), disk(r)) > 0
def close(m, r): return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, disk(r)) > 0
def opn(m, r): return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, disk(r)) > 0
def fill_holes(m):
    inv = (~m).astype(np.uint8); ff = np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8)
    cv2.floodFill(inv, ff, (0, 0), 2)
    return m | (inv == 1)
def poly(shape, pts):
    m = np.zeros(shape, np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m > 0
def line(shape, pts, w):
    m = np.zeros(shape, np.uint8); cv2.polylines(m, [np.array(pts, np.int32)], False, 1, w); return m > 0
def ellipse(shape, c, r):
    m = np.zeros(shape, np.uint8); cv2.ellipse(m, c, r, 0, 0, 360, 1, -1); return m > 0
def nearest_fill(idx, region, source):
    """every pixel of region takes the colour of its nearest source pixel"""
    out = idx.copy()
    if not region.any(): return out
    src = source & ~region
    d, lab = cv2.distanceTransformWithLabels((~src).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.where(src)
    col = np.zeros(lab.max() + 1, np.uint8); col[lab[ys, xs]] = idx[ys, xs]
    out[region] = col[lab[region]]
    return out

# Ange's eyes: the lashes and the white up to her hair's edge (screen-left eye, then screen-right)
# (the lash tips past the outlines lie on the hair: they stay in the head)
# (the outer edges cross the lashes over skin, a few px inside the hair's edge: the cut never touches the hair)
EYE_A = {-1: [(790, 315), (800, 311), (822, 315), (836, 329), (841, 346), (832, 365), (800, 369), (774, 365), (768, 358), (765, 350), (766, 340), (771, 330), (782, 322)],
         1: [(886, 316), (900, 311), (918, 311), (930, 314), (937, 322), (944, 331), (947, 340), (948, 350), (944, 362), (918, 369), (888, 365), (879, 348), (880, 332)]}
# Ange's forearms under the bouquet: between the top edges (their outlines carried on down to the wrists) and the
# picture's lower edges
FORE_L = [(770, 676), (794, 685), (804, 696), (812, 707), (818, 716), (821, 723), (812, 735), (803, 733), (776, 718), (770, 712)]
FORE_R = [(944, 676), (922, 680), (918, 684), (911, 688), (907, 693), (903, 700), (899, 706), (902, 716), (913, 728), (946, 712), (950, 700)]

# the palettes come from remap.py (lightest first)
PAL = {n: json.load(open(f"{wd}/{n}_pal.json")) for n in ("dan", "ange")}
CFG = {
    "dan": dict(
        dark=(16, 17), ink=(16, 17), skin=(4, 5, 7), face=(315, 300), ylim=433, hairy=470,
        # under the chin the neck continues straight up (in the shade colour), so a tilting head never shows a hole
        neck=dict(x=(276, 354), y=(372, 446), col=5),
        # face features, redrawn in code: eyes (lash line, white, iris, crease) + brows, and the mouth with the moustache
        cut=[[(198, 222), (296, 226), (298, 294), (196, 294)], [(334, 226), (434, 222), (436, 294), (332, 294)],
             [(236, 334), (392, 334), (392, 372), (370, 396), (330, 400), (300, 400), (256, 396), (236, 372)]],
        # ...the moustache comes back as its own traced layer over the code mouth: its greys, above the lips
        stache=dict(box=(236, 330, 392, 366), cols=(8, 9, 10, 11, 12, 13, 14), mouth=(262, 364), lip=343),
        # the eyes themselves come back traced (eye_art): screen-left eye, then screen-right (mirrored about x 315.5)
        eyes={-1: [(203, 282), (205, 270), (222, 255), (250, 249), (274, 251), (291, 266), (293, 286), (272, 297), (230, 297), (210, 290)],
              1: [(428, 282), (426, 270), (409, 255), (381, 249), (357, 251), (340, 266), (338, 286), (359, 297), (401, 297), (421, 290)]},
        # each sleeve + hand is cut off along its inner seam (barrier line), then flooded from a seed; the hand = the rows
        # from `hand` down (under the cuff's outline)
        arms={
            "armL": dict(seed=(110, 650), hand=789, bar=[(40, 466), (141, 466), (144, 500), (151, 560), (158, 600), (161, 650), (153, 700),
                                                (145, 750), (139, 780), (139, 790), (139, 800), (139, 820), (140, 836), (152, 880)]),
            "armR": dict(seed=(505, 650), hand=790, bar=[(580, 466), (478, 466), (474, 520), (466, 560), (460, 600), (458, 650), (461, 700),
                                                (470, 750), (474, 780), (474, 790), (473, 800), (471, 820), (467, 830), (461, 840), (458, 880)]),
        },
        # the shoes, over the ankles: below `top`, not the ankles' skin, split at his middle
        feet=dict(top=1096, mid=306, skin=(4, 5, 7)),
        # the hair, its own part (round 6): under it the face carries on out to `face` (measured: round past the curls to
        # the forehead's top), outlined from `line` down; the cross earring hangs over the curls (its own part)
        # (the jaw: the picture's, carried on up round the cheeks under the curls)
        hairCut=dict(face=[(315, 140), (270, 145), (230, 160), (200, 185), (185, 215), (180, 250), (178, 290), (182, 320), (188, 345), (198, 370),
                           (215, 390), (235, 405), (258, 417), (290, 428), (315, 431), (340, 429), (368, 418), (392, 405), (412, 390), (430, 370),
                           (442, 345), (448, 320), (452, 290), (450, 250), (445, 215), (430, 185), (400, 160), (360, 145)],
                     line=200, earring=dict(box=(440, 338, 471, 399), cols=(2, 5, 7, 9, 11, 13, 15))),
        # the round upper sleeves (S = the shoulder joint; MoreDetailedCuteDan.tsx's ARM_RIG turns the arm about it)
        shoulders={"L": dict(S=(130, 500), E=(121, 640), r=31, len=110, side=-1, prof=(85, 130)),
                   "R": dict(S=(488, 500), E=(495, 640), r=31, len=110, side=1, prof=(85, 130))},
        hidden=[
            # under the curls: the jacket below its shoulder line, which carries on up to the collar
            dict(part="body", under="head", col=0, poly=[(150, 464), (181, 450), (215, 438), (256, 422), (262, 405), (278, 398), (278, 472), (150, 472)]),
            dict(part="body", under="head", col=0, poly=[(480, 464), (450, 454), (410, 439), (368, 422), (360, 405), (352, 398), (352, 472), (480, 472)]),
            dict(part="body", under="head", ink=16, w=3, line=[(165, 457), (181, 450), (215, 438), (256, 422)]),
            dict(part="body", under="head", ink=16, w=3, line=[(462, 458), (450, 454), (410, 439), (368, 422)]),
            # under each sleeve: the jacket's side, out to a straight side from the armpit to the hem, and its outline
            dict(part="body", under="armL", col=0, poly=[(141, 470), (141, 515), (139, 583), (138, 651), (139, 720), (140, 790), (168, 790), (168, 470)]),
            dict(part="body", under="armR", col=0, poly=[(477, 470), (477, 515), (479, 583), (478, 651), (477, 720), (473, 790), (452, 790), (452, 470)]),
            dict(part="body", under="armL", ink=16, w=3, line=[(141, 515), (139, 583), (138, 651), (139, 720), (140, 790)]),
            dict(part="body", under="armR", ink=16, w=3, line=[(477, 515), (479, 583), (478, 651), (477, 720), (473, 790)]),
        ],
    ),
    "ange": dict(
        dark=(15, 16, 17), ink=(17,), skin=(2, 4, 6), face=(860, 380), ylim=478, hairy=640,
        neck=dict(x=(820, 900), y=(410, 496), col=2),
        # (round 2: the eye cuts follow her hair's edge at the outer lashes; inside the cuts the hair mask doesn't count,
        # featNoHair: her lashes join the eyes and brows to the hair mass, so the old cuts left the traced eyes and brows
        # under the code ones)
        cut=[EYE_A[-1], EYE_A[1],
             [(791, 290), (838, 292), (838, 316), (789, 316)], [(880, 294), (918, 290), (928, 305), (932, 318), (880, 318)],
             [(812, 400), (906, 400), (910, 416), (884, 446), (836, 446), (808, 416)]],
        eyes=EYE_A, featNoHair=True,
        # arms + bouquet: one group (it lifts in code); the dress panels around it are big light areas, the roses small
        group=dict(poly=[(690, 575), (775, 548), (790, 600), (930, 600), (948, 548), (1032, 575), (1032, 705), (965, 765),
                         (905, 790), (880, 815), (835, 815), (812, 790), (755, 765), (690, 705)],
                   light=(0, 1, 3, 5), big=4000, shoulders=610,
                   # its parts: skin (+ its outline) = arms and hands, split at `mid`; the hands by their outlines (the
                   # screen-right hand wraps the stems over the screen-left one, which wears the ring); the bouquet = the rest
                   skin=(2, 4, 6, 8), mid=860,
                   # the whole bouquet: inside this outline, its ring of leaves, stems and outlines closed and filled (the
                   # white roses are one big light area, which the panel rule above drops: they stayed on the dress in
                   # the round 1-4 lift, only the leaves and stems rising)
                   bouquet=dict(poly=[(776, 600), (850, 592), (935, 606), (940, 662), (910, 706), (885, 764), (886, 806), (826, 806), (828, 764), (798, 706), (772, 662)],
                                ring=(7, 9, 10, 11, 13, 14, 15, 16, 17), close=6,
                                # the bodice's side outlines beside it (the closing joins them to the sprigs): they stay
                                # on the dress
                                sides=[[(768, 612), (772, 622), (775, 630), (778, 640), (780, 650), (780, 665)],
                                       [(946, 616), (942, 624), (939, 632), (937, 640), (935, 648), (934, 656), (934, 664)]]),
                   hands={"handR": [(826, 735), (845, 733), (870, 728), (885, 716), (908, 703), (916, 725), (912, 742), (895, 753), (872, 761), (845, 763), (824, 761), (820, 748)],
                          "handL": [(800, 722), (820, 721), (840, 714), (864, 714), (868, 729), (845, 734), (826, 736), (820, 748), (824, 763), (808, 764), (798, 750)]}),
        # the shoes, under the dress's hem: flooded from a seed in the toe and one in the opening, plus their rim
        feet=dict(hem=[(780, 1129), (800, 1123), (820, 1122), (840, 1126), (853, 1131), (862, 1128), (880, 1121), (900, 1118), (918, 1117), (932, 1121)],
                  seeds={"footL": [(820, 1212), (818, 1155)], "footR": [(895, 1212), (893, 1155)]},
                  rim=(8, 12, 15, 16, 17)),  # (the outlines and the sole's brown edge round them)
        # the hair's shadow along its edges on her skin (it moves with the hair; not the chin's shadow on the neck, `keep`:
        # split between the two, that band showed light seams)
        hairShade=dict(cols=(4, 6, 8), d=16, ymin=470, base=2, keep=[(814, 400), (906, 400), (906, 508), (814, 508)]),
        # the hair, its own part (round 6): under it the face carries on out to `face` (measured: the cheeks round up under
        # the curtain bangs to the parting), outlined from `line` down
        hairCut=dict(face=[(860, 200), (820, 205), (790, 220), (770, 245), (757, 275), (750, 305), (746, 335), (745, 365), (748, 395), (757, 420),
                           (775, 442), (800, 460), (830, 472), (860, 477), (890, 472), (920, 460), (945, 442), (963, 420), (972, 395), (975, 365),
                           (974, 335), (970, 305), (963, 275), (950, 245), (930, 220), (900, 205)],
                     line=280),
        hidden=[
            # under her hair: her shoulders from the neck round to the arms (the caps, outside the bodice's sides, go with
            # the arms), the bodice's top corners, and their outlines
            dict(part="body", under="head", col=2, poly=[(824, 466), (800, 500), (775, 520), (750, 540), (730, 560), (717, 585), (712, 612), (711, 626)] + [(840, 626), (840, 466)]),
            dict(part="body", under="head", col=2, poly=[(896, 466), (920, 500), (945, 520), (968, 540), (985, 560), (995, 585), (999, 612), (1001, 626)] + [(880, 626), (880, 466)]),
            dict(part="body", under="head", col=0, poly=[(787, 546), (770, 556), (764, 580), (764, 626), (800, 626), (800, 546)]),
            dict(part="body", under="head", col=0, poly=[(933, 546), (947, 560), (952, 580), (953, 626), (920, 626), (920, 546)]),
            dict(part="body", under="head", ink=16, w=3, line=[(824, 466), (800, 500), (775, 520), (750, 540), (730, 560), (717, 585), (712, 612), (711, 626)]),
            dict(part="body", under="head", ink=16, w=3, line=[(896, 466), (920, 500), (945, 520), (968, 540), (985, 560), (995, 585), (999, 612), (1001, 626)]),
            dict(part="body", under="head", ink=16, w=3, line=[(790, 546), (775, 553), (767, 565), (765, 590)]),
            dict(part="body", under="head", ink=16, w=3, line=[(930, 546), (945, 556), (951, 570), (952, 590)]),
            dict(part="armL", under="head", col=2, clip=[(690, 500), (765, 500), (765, 630), (690, 630)], poly=[(824, 466), (800, 500), (775, 520), (750, 540), (730, 560), (717, 585), (712, 612), (711, 626)] + [(840, 626), (840, 466)]),
            dict(part="armR", under="head", col=2, clip=[(954, 500), (1040, 500), (1040, 630), (954, 630)], poly=[(896, 466), (920, 500), (945, 520), (968, 540), (985, 560), (995, 585), (999, 612), (1001, 626)] + [(880, 626), (880, 466)]),
            dict(part="armL", under="head", ink=16, w=3, clip=[(690, 500), (765, 500), (765, 630), (690, 630)], line=[(824, 466), (800, 500), (775, 520), (750, 540), (730, 560), (717, 585), (712, 612), (711, 626)]),
            dict(part="armR", under="head", ink=16, w=3, clip=[(954, 500), (1040, 500), (1040, 630), (954, 630)], line=[(896, 466), (920, 500), (945, 520), (968, 540), (985, 560), (995, 585), (999, 612), (1001, 626)]),
            # under the bouquet and her hands (the toast swaps the bouquet for a glass): the skirt's white with two soft
            # folds from the waist, the bodice down to a slightly dipped waist seam, its side outlines carried on down
            dict(part="body", under="lifting", col=0, poly=[(760, 690), (956, 690), (956, 830), (760, 830)]),
            dict(part="body", under="lifting", col=3, w=3, line=[(842, 714), (834, 760), (822, 812)]),
            dict(part="body", under="lifting", col=3, w=3, line=[(878, 714), (888, 760), (900, 812)]),
            dict(part="body", under="lifting", col=0, poly=[(768, 590), (772, 622), (778, 640), (780, 665), (784, 685), (790, 700), (858, 712), (926, 700),
                                                             (930, 685), (934, 664), (937, 640), (942, 624), (946, 610), (946, 590)]),
            dict(part="body", under="lifting", col=3, w=3, line=[(790, 700), (824, 708), (858, 712), (892, 708), (926, 700)]),
            dict(part="body", under="lifting", ink=17, w=3, line=[(768, 612), (772, 622), (775, 630), (778, 640), (780, 650), (780, 660)]),
            dict(part="body", under="lifting", ink=17, w=3, line=[(946, 616), (942, 624), (939, 632), (937, 640), (935, 648), (934, 656), (934, 660)]),
            # (tapering out under the forearms: round 11, ending at the waist, a lifted glass showed their tips as dark
            # slivers under the forearms)
            dict(part="body", under="lifting", ink=17, w=2, line=[(780, 660), (781, 667)]),
            dict(part="body", under="lifting", ink=17, w=1, line=[(781, 667), (782, 673)]),
            dict(part="body", under="lifting", ink=17, w=2, line=[(934, 660), (933, 667)]),
            dict(part="body", under="lifting", ink=17, w=1, line=[(933, 667), (932, 673)]),
            # (her hands with the glass are drawn in code: MoreDetailedCuteAnge's GLASS_HANDS)
        ],
        # after the parts carry on under each other: the bouquet's leaves and outlines that lay over the forearms go into
        # the bouquet (so it's the picture with it, plain arms without), the arms' skin under them; past the forearms' top
        # edges (their outlines carried on down to the wrists) the arm is cut away
        late=[
            dict(part="armL", move="bouquet", col=2, poly=[(776, 680), (794, 685), (804, 696), (812, 707), (818, 716), (821, 723), (821, 740), (776, 740)]),
            dict(part="armL", move="bouquet", cut=True, poly=[(796, 680), (840, 680), (840, 720), (821, 723), (818, 716), (812, 707), (804, 696)]),
            dict(part="armL", ink=17, w=2, line=[(792, 683), (798, 690), (804, 696), (812, 707), (818, 716), (821, 723)]),
            dict(part="armR", move="bouquet", col=2, poly=[(920, 682), (944, 682), (944, 722), (897, 722), (899, 706), (903, 700), (907, 693), (911, 688)]),
            dict(part="armR", move="bouquet", cut=True, poly=[(922, 678), (880, 678), (880, 712), (899, 712), (899, 706), (903, 700), (907, 693), (911, 688), (918, 684)]),
            dict(part="armR", ink=17, w=2, line=[(922, 680), (918, 684), (911, 688), (907, 693), (903, 700), (899, 706)]),
            # the leaves' soft shadows on the forearms go into the bouquet too, and under it the forearms are whole plain
            # skin (the leaves left holes): with the glass, clean arms; with the bouquet, the picture
            dict(part="armL", move="bouquet", col=2, cols=(3, 4, 5, 6, 7, 8, 10), near=8, poly=FORE_L),
            dict(part="armR", move="bouquet", col=2, cols=(3, 4, 5, 6, 7, 8, 10), near=8, poly=FORE_R),
            dict(part="armL", paint=2, under="bouquet", keep=(15, 16, 17), poly=FORE_L),
            dict(part="armR", paint=2, under="bouquet", keep=(15, 16, 17), poly=FORE_R),
        ],
    ),
}

summary = {}
for name, c in CFG.items():
    idx = np.load(f"{wd}/{name}_idx.npy"); H, W = idx.shape
    pic = cv2.imread(f"{tsdir}/dan-ange-ref.png")
    sil = idx != 255
    yy, xx = np.mgrid[0:H, 0:W]
    pal = PAL[name]
    L = np.array([cv2.cvtColor(np.uint8([[[int(h[5:7], 16), int(h[3:5], 16), int(h[1:3], 16)]]]), cv2.COLOR_BGR2LAB)[0, 0, 0] for h in pal])
    rank = np.argsort(np.argsort(-L))  # 0 = lightest
    dark = sil & np.isin(idx, c["dark"])
    ink = sil & np.isin(idx, c["ink"])
    skin = sil & np.isin(idx, c["skin"])

    # ---- head: the hair mass (dark, opened so the outlines drop out), the face (non-dark flooded from the nose, above
    # the jaw) and every dark pixel near them, holes filled (ears, earring, eyes)
    mass = opn(dark, 3) & (yy < c["hairy"])
    n, lab, st, _ = cv2.connectedComponentsWithStats(mass.astype(np.uint8), connectivity=8)
    hair = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 400])
    hair = dil(close(hair, 6), 2) & sil
    n, lab = cv2.connectedComponents((sil & ~dark & (yy < c["ylim"])).astype(np.uint8), connectivity=4)
    face = lab == lab[c["face"][1], c["face"][0]]
    head = fill_holes(hair | face | ((dil(face, 4) | dil(hair, 10)) & dark & (yy < c["hairy"]))) & sil

    # ---- the parts (round 5, the user: "head, body, shoulder + arms, hands, feet"): every part but the head and body
    # goes in `pieces` (name -> [mask, colour map]); what each one hides is traced into the parts under it (below)
    pieces = {}
    def piece(nm, m): pieces[nm] = [m, idx.copy()]
    # shoulder + arms, hands: each sleeve is cut off along its inner seam (barrier line) and flooded from a seed; its hand
    # (the rows under the cuff's outline) is its own part
    for an, a in c.get("arms", {}).items():
        bar = line((H, W), a["bar"], 3)
        n, lab = cv2.connectedComponents((sil & ~bar & ~head).astype(np.uint8), connectivity=4)
        m = lab == lab[a["seed"][1], a["seed"][0]]
        hn = "hand" + an[-1]
        piece(an, m & (yy < a["hand"]))
        piece(hn, m & (yy >= a["hand"]))
        print(name, an, "px", pieces[an][0].sum(), hn, pieces[hn][0].sum())
    group = None
    if "group" in c:
        # Ange's arms, hands and bouquet lift together (one weight field, LIFT_GRID): found as one group first
        g = c["group"]
        P = poly((H, W), g["poly"]) & sil & ~head
        light = P & np.isin(idx, g["light"])
        n, lab, st, _ = cv2.connectedComponentsWithStats(light.astype(np.uint8), connectivity=4)
        bigl = np.isin(lab, [i for i in range(1, n) if st[i, 4] > g["big"]])
        grp = P & ~bigl
        # drop the dress's own fold lines (thin, along the big panels) and keep what's connected to the arms/bouquet
        grp = opn(grp, 2) | (grp & dil(opn(grp, 2), 2))
        n, lab, st, _ = cv2.connectedComponentsWithStats(grp.astype(np.uint8), connectivity=8)
        grp = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 3000])
        grp = fill_holes(grp) & sil & ~head
        group = grp
        print(name, "group px", grp.sum())
        # ...then split: skin and its outline = arms + hands (the hands by their outlines, the screen-right one over the
        # other), the arms either side of the middle, the bouquet = the rest
        flesh = fill_holes(close(grp & np.isin(idx, g["skin"]), 2)) & grp
        flesh |= dil(flesh, 3) & grp & np.isin(idx, c["dark"])
        bq = g["bouquet"]
        B = poly((H, W), bq["poly"]) & sil & ~head
        blob = fill_holes(close(B & np.isin(idx, bq["ring"]), bq["close"])) & B
        for sd_ in bq.get("sides", []): blob &= ~line((H, W), sd_, 4)
        taken = np.zeros((H, W), bool)
        for hn in ("handR", "handL"):
            hp = poly((H, W), g["hands"][hn]) & grp & ~taken
            hm = fill_holes(close(hp & flesh, 3)) & hp
            piece(hn, hm); taken |= hm
        # (the arms keep their outline's soft edge, whatever its colour, outside the bouquet: left to the bouquet, those
        # specks were too small to trace, and the background showed through the outline)
        arm = (flesh | (dil(flesh, 4) & grp & ~blob)) & ~taken
        for an, sd in (("armL", xx < g["mid"]), ("armR", xx >= g["mid"])):
            m = arm & sd
            n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
            piece(an, np.isin(lab, [i for i in range(1, n) if st[i, 4] > 200]))
            taken |= pieces[an][0]
        # the bouquet: its blob, plus the group's leftovers along the hands (their outline's soft edge, which lifts with
        # them). The other leftovers are the bodice's sides between the arms and the bouquet, with its side outline: they
        # stay on the dress (lifted with the bouquet, they floated on the bodice as stray strokes)
        hands = pieces["handL"][0] | pieces["handR"][0]
        bm = (blob | (grp & dil(hands, 6))) & ~taken
        # (and the sprig specks left outside those outlines)
        n, lab, st, _ = cv2.connectedComponentsWithStats(bm.astype(np.uint8), connectivity=8)
        piece("bouquet", bm & ~(np.isin(lab, [i for i in range(1, n) if st[i, 4] < 60]) & ~dil(hands, 6)))
        for k in ("armL", "armR", "handL", "handR", "bouquet"): print(name, k, "px", pieces[k][0].sum())
    # feet: shoes over the ankles (Dan: below `top`, not the ankles' skin, joined to the soles), or shoes under a hem
    # (Ange: flooded from seeds inside them, bounded by their outlines and the hem line, plus those outlines)
    if "feet" in c:
        f = c["feet"]
        if "top" in f:
            sh = sil & ~head & (yy >= f["top"]) & ~np.isin(idx, f["skin"])
            n, lab, st, _ = cv2.connectedComponentsWithStats(sh.astype(np.uint8), connectivity=8)
            sh = fill_holes(np.isin(lab, [i for i in range(1, n) if st[i, 4] > 2000 and st[i, 1] + st[i, 3] >= H - 80]))
            piece("footL", sh & (xx < f["mid"])); piece("footR", sh & (xx >= f["mid"]))
        else:
            hem = f["hem"]
            below = poly((H, W), hem + [(hem[-1][0], H), (hem[0][0], H)])
            bar = line((H, W), hem, 3) | dil(sil & np.isin(idx, c["dark"]), 1)
            n, lab = cv2.connectedComponents((sil & ~bar).astype(np.uint8), connectivity=4)
            for fn, seeds in f["seeds"].items():
                inside = np.isin(lab, [lab[y_, x_] for x_, y_ in seeds])
                shoe = fill_holes(inside | (dil(inside, 8) & sil & np.isin(idx, f["rim"]))) & below & sil
                piece(fn, shoe)
        for k in ("footL", "footR"): print(name, k, "px", pieces[k][0].sum())
    limbs = np.zeros((H, W), bool)
    for m, _ in pieces.values(): limbs |= m

    # ---- body: the rest, plus what the other parts hide (the neck carried straight up under the chin; the hidden
    # shapes below; for Ange, under the lifting forearms and bouquet)
    body = sil & ~head & ~limbs
    # stray specks (thin curl ends the hair mass missed) join the head
    n, lab, st, _ = cv2.connectedComponentsWithStats(body.astype(np.uint8), connectivity=8)
    stray = np.isin(lab, [i for i in range(1, n) if st[i, 4] < 2000]) & (yy < c["hairy"])
    head |= stray; body &= ~stray
    bidx = idx.copy()
    nk = c["neck"]
    neckR = (xx >= nk["x"][0]) & (xx <= nk["x"][1]) & (yy >= nk["y"][0]) & (yy <= nk["y"][1])
    under = head & neckR
    bidx[under] = nk["col"]
    pts = np.column_stack(np.where(body | limbs))[:, ::-1].astype(np.int32)
    hull = poly((H, W), cv2.convexHull(pts).reshape(-1, 2))
    if group is not None:
        # under the lifting forearms and bouquet: the dress's commonest colour around them (a nearest fill streaks)
        lifting = np.zeros((H, W), bool)
        for k in ("armL", "armR", "handL", "handR", "bouquet"): lifting |= pieces[k][0]
        gu = (lifting & hull & (yy > c["group"]["shoulders"])) | pieces["bouquet"][0]
        ring = dil(gu, 10) & body & ~ink
        bidx[gu] = np.bincount(idx[ring], minlength=len(PAL[name])).argmax()
        under |= gu
    # outline the neck's sides (they show when the head tilts)
    U = body | under
    edge = U & ~ero(U, 2) & neckR & ~dil(body, 2)
    bidx[edge] = c["ink"][-1]
    body = U
    # the hidden shapes (measured on the picture): a fill or an outline, painted only where `under` (head or a part)
    # hides it, into the body or a part. Under the hair (round 5, the circled shoulders: a head tilt showed a smeared
    # band, the shoulder's outline stopping at the old hair edge): the shoulders and their outlines carried on.
    # Under Dan's sleeves: the jacket's side, so a lifted arm leaves his body whole
    cover = {"head": head}
    for k, (m, _) in pieces.items(): cover[k] = m
    if group is not None: cover["lifting"] = gu
    for hd in c.get("hidden", []):
        z = (poly((H, W), hd["poly"]) if "poly" in hd else line((H, W), hd["line"], hd["w"])) & cover[hd["under"]]
        if "clip" in hd: z &= poly((H, W), hd["clip"])
        if hd["part"] not in pieces and hd["part"] != "body": pieces[hd["part"]] = [np.zeros((H, W), bool), idx.copy()]
        if hd["part"] == "body":
            body |= z; bidx[z] = hd.get("col", hd.get("ink"))
        else:
            pieces[hd["part"]][0] |= z; pieces[hd["part"]][1][z] = hd.get("col", hd.get("ink"))
    # the hand carries on up under its cuff, and the ankle down under its shoe (so a turned wrist or a lifted foot never
    # shows a gap): the nearest colour of each
    for hn in ("handL", "handR"):
        if hn in pieces and "arms" in c:
            hm, hix = pieces[hn]; sl = pieces["arm" + hn[-1]][0]
            ext = np.zeros((H, W), bool)
            for k in range(1, 15): ext |= np.roll(hm, -k, axis=0)
            ext &= sl & ~hm
            pieces[hn][1] = nearest_fill(hix, ext, hm & ~np.isin(idx, c["dark"]))
            pieces[hn][0] = hm | ext
    if "feet" in c and "top" in c["feet"]:
        ank = body & np.isin(idx, c["feet"]["skin"]) & (yy > c["feet"]["top"] - 10)
        ext = np.zeros((H, W), bool)
        for k in range(1, 26): ext |= np.roll(ank, k, axis=0)
        ext &= (pieces["footL"][0] | pieces["footR"][0]) & ~body
        bidx = nearest_fill(bidx, ext, ank)
        body |= ext
    # Ange's group: each part carries on 3px under the ones drawn over it (arms < bouquet < hands), so no seam shows
    # between them
    if group is not None:
        for lo, hi in (("armL", ("bouquet", "handL", "handR")), ("armR", ("bouquet", "handL", "handR")), ("bouquet", ("handL", "handR"))):
            over = np.zeros((H, W), bool)
            for h_ in hi: over |= pieces[h_][0]
            m, ix = pieces[lo]
            ext = dil(m, 3) & over & ~m
            pieces[lo] = [m | ext, nearest_fill(ix, ext, m)]
        for hd in c.get("late", []):
            z = poly((H, W), hd["poly"]) if "poly" in hd else line((H, W), hd["line"], hd["w"])
            m, ix = pieces[hd["part"]]
            if "move" in hd:
                to = pieces[hd["move"]]
                if "cols" in hd: z &= np.isin(ix, hd["cols"]) & dil(to[0], hd["near"])
                elif not hd.get("cut"): z &= ~np.isin(idx, c["group"]["skin"])
                z &= m
                mv = z & ~to[0]
                to[0] |= mv; to[1][mv] = ix[mv]
                if hd.get("cut"): m &= ~z
                else: ix[z] = hd["col"]
            elif "paint" in hd:
                z &= fill_holes(pieces[hd["under"]][0]) & ~(m & np.isin(ix, hd.get("keep", ())))
                m |= z; ix[z] = hd["paint"]
            else:
                m |= z; ix[z] = hd["ink"]
        group = np.zeros((H, W), bool)
        for k in ("armL", "armR", "handL", "handR", "bouquet"): group |= pieces[k][0]

    # ---- face features: cut out of the head, filled with the nearest skin around them
    # (one flat colour per feature, the commonest skin colour around it: a nearest-pixel fill streaks)
    # (never into the hair: the main hair mass and a px around it stay)
    # (opened harder first, so the eyes' outer lashes, which touch Ange's hair, still count as the eye)
    n, lab, st, _ = cv2.connectedComponentsWithStats(opn(hair, 4).astype(np.uint8), connectivity=8)
    mainHair = dil(lab == 1 + np.argmax(st[1:, 4]), 1)
    if c.get("featNoHair"):
        for p in c["cut"] + list(c.get("eyes", {}).values()): mainHair &= ~poly((H, W), p)
    cut = np.zeros((H, W), bool)
    hidx = idx.copy()
    for p in c["cut"]:
        z = poly((H, W), p) & head & ~mainHair
        ring = dil(z, 8) & ~z & skin
        hidx[z] = np.bincount(idx[ring], minlength=len(PAL[name])).argmax()
        cut |= z
    # ---- the eyes, traced (2026-10-25, round 2: the code-drawn eyes didn't match the picture: "eye is wrong"). Each eye is
    # the picture's own: its non-skin pixels (ΔE from the skin around it) in its own palette (k-means over both eyes, so
    # the iris keeps its shading), split into the opening (the hull of the whites), the iris (inside the opening, not
    # the white: it slides there to look) and the liner (lashes, wing, crease, lower lid: outside the opening, fixed).
    # Traced at 4x from a smoothed mask, so the small shapes keep their curves.
    eyes = {}
    if "eyes" in c:
        lab = cv2.cvtColor(pic, cv2.COLOR_BGR2LAB).astype(np.float32)
        lab[..., 0] *= 100 / 255; lab[..., 1:] -= 128
        chroma = np.hypot(lab[..., 1], lab[..., 2])
        E, O, SC, sk = {}, {}, {}, {}
        for side, p in c["eyes"].items():
            P = poly((H, W), p) & head & ~mainHair
            ring = dil(P, 4) & ~P & head & ~mainHair
            ref = np.median(lab[ring], axis=0)
            dE = np.linalg.norm(lab - ref, axis=2)
            e = P & (dE > 9)
            n, lb, st, _ = cv2.connectedComponentsWithStats(e.astype(np.uint8), connectivity=8)
            e = np.isin(lb, [i for i in range(1, n) if st[i, 4] >= 4])
            wh = e & (lab[..., 0] > 80) & (chroma < 12)
            n, lb, st, _ = cv2.connectedComponentsWithStats(wh.astype(np.uint8), connectivity=8)
            wh = np.isin(lb, [i for i in range(1, n) if st[i, 4] >= 6])
            ys, xs = np.where(wh)
            o = poly((H, W), cv2.convexHull(np.column_stack([xs, ys]).astype(np.int32)).reshape(-1, 2)) & e
            # the whites touching the opening's edge are the eye's white; the ones inside it are the iris's shines
            rim = o & ~ero(o, 1)
            n, lb = cv2.connectedComponents(wh.astype(np.uint8), connectivity=8)
            SC[side] = np.isin(lb, [i for i in np.unique(lb[rim & wh]) if i])
            E[side], O[side] = e, o
            sk[side] = PAL[name][np.bincount(idx[ring], minlength=len(PAL[name])).argmax()]
            print(name, "eye", side, "px", e.sum(), "opening", o.sum(), "white", SC[side].sum())
        allE = np.concatenate([lab[E[s]] for s in E])
        K = 12
        _, _, centers = cv2.kmeans(allE.astype(np.float32), K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.2), 4, cv2.KMEANS_PP_CENTERS)
        order = np.argsort(-centers[:, 0])  # lightest first
        centers = centers[order]
        def hexof(cl):
            v = np.array([cl[0] * 255 / 100, cl[1] + 128, cl[2] + 128], np.float32).clip(0, 255).astype(np.uint8)
            b, g, r = cv2.cvtColor(v.reshape(1, 1, 3), cv2.COLOR_LAB2BGR)[0, 0]
            return f"#{r:02X}{g:02X}{b:02X}"
        epal = [hexof(cl) for cl in centers]
        pd = f"{wd}/{name}_eyes"; os.makedirs(pd, exist_ok=True)
        Z = 4
        for side in E:
            e = E[side]
            ys, xs = np.where(e)
            x0, y0, x1, y1 = xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4
            crop = lab[y0:y1, x0:x1].reshape(-1, 3)
            lbl = np.argmin(((crop[:, None, :] - centers[None]) ** 2).sum(2), axis=1).reshape(y1 - y0, x1 - x0)
            def trace(m, k, tag):
                fm = cv2.resize(m.astype(np.float32), None, fx=Z, fy=Z, interpolation=cv2.INTER_LINEAR)
                fm = cv2.GaussianBlur(fm, (0, 0), Z * 0.35) > 0.5
                fn = f"{pd}/{side}_{tag}_{k:02d}"
                cv2.imwrite(fn + ".pgm", np.where(fm, 0, 255).astype(np.uint8))
                subprocess.run(["potrace", fn + ".pgm", "-s", "--flat", "-t", "6", "-O", "0.4", "-o", fn + ".svg"], check=True)
                return " ".join(" ".join(x.split()) for x in re.findall(r'<path d="([^"]*)"', open(fn + ".svg").read(), re.S))
            def stack(m, tag, lb=None):
                # the darker layers carry on 3px past the piece's edge (each pixel there takes the nearest piece pixel's
                # colour) and the piece is drawn clipped to its first layer, so every layer ends on the same edge (a
                # lighter layer poking out from under the darker ones drew a light line along the liner's edge)
                lb = lbl if lb is None else lb
                ext = dil(m, 3)
                lx = nearest_fill(lb.astype(np.uint8), ext & ~m, m)
                layers = []
                for k in range(K):
                    if k > 0 and (m & (lb == k)).sum() < 3: continue
                    d = trace(ext & (lx >= k) if k > 0 else m, k, tag)
                    if d: layers.append((epal[k], d))
                return layers
            cr = lambda a: a[y0:y1, x0:x1]
            o, sc, ec = cr(O[side]), cr(SC[side]), cr(E[side])
            # the pieces overlap 3px under the liner (abutting edges leave a light seam): the white under it all reaches
            # past the opening, and the iris carries on under the lid above and below, across its own columns
            ox = dil(o, 3) & ec
            core = o & ~sc
            # only the iris slides (round 7, "double eyes?": the lid's shadow and the grey shading on the white slid with
            # it, a second dark shape on the white when looking aside): the core's one thick blob (opened, so the thin
            # strips along the lid drop out), its shines filled, its outline back on; the rest stays on the white
            n, lb_, st_, _ = cv2.connectedComponentsWithStats(opn(core, 2).astype(np.uint8), connectivity=8)
            blob = fill_holes(lb_ == 1 + np.argmax(st_[1:, 4]))
            irisM = dil(blob, 2) & core
            # (with the lid's shadow on it: above its middle, across its own columns)
            bx, by = np.where(blob.any(0))[0], np.where(blob.any(1))[0]
            xg_, yg_ = np.arange(core.shape[1])[None, :], np.arange(core.shape[0])[:, None]
            irisM |= core & (xg_ >= bx.min()) & (xg_ <= bx.max()) & (yg_ < (by.min() + by.max()) / 2)
            onWhite = core & ~irisM
            core = irisM
            cols = np.where(core.any(0))[0]
            xg = np.arange(ec.shape[1])[None, :]
            band = ox & ~o & (xg >= cols.min() + 2) & (xg <= cols.max() - 2)
            # (and its shines: those touching the lid counted as the white and stayed put; with the iris carried on
            # under the lid they're enclosed)
            irisP = fill_holes(core | band)
            sc, onWhite = sc & ~irisP, onWhite & ~irisP
            # the liner's pale edge along the opening (the soft edge of the shines and whites touching the lid) takes the
            # liner's own colour: left there, it showed as light dashes where the shines had been once the iris slid
            ln = ec & ~o
            pale = np.isin(lbl, np.where(centers[:, 0] > 70)[0])
            lnl = nearest_fill(lbl.astype(np.uint8), ln & pale & dil(o, 2), ln & ~pale)
            eyes[side] = dict(
                t=f"translate({x0} {y1}) scale({0.1 / Z} {-0.1 / Z})",
                open=trace(ox, 0, "open"),
                white=epal[np.bincount(lbl[sc], minlength=K).argmax()],
                skin=sk[side],
                sclera=stack(sc | onWhite, "sclera"),
                iris=stack(irisP, "iris"),
                liner=stack(ln, "liner", lnl),
            )
            print(name, "eye", side, {k: len(v) for k, v in eyes[side].items() if isinstance(v, list)})
        # under the traced eyes, the head is plain skin (the whole eye goes, so a blink shows clean skin)
        for side in E:
            z = E[side] & ~cut
            if z.any():
                hidx[dil(z, 1) & head & ~mainHair & ~cut] = np.bincount(idx[dil(z, 6) & ~dil(z, 1) & skin], minlength=len(PAL[name])).argmax()

    stache = None
    if "stache" in c:
        x0, y0, x1, y1 = c["stache"]["box"]
        m0, m1 = c["stache"]["mouth"]
        s = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1) & np.isin(idx, c["stache"]["cols"])
        s &= ~((xx >= m0) & (xx <= m1) & (yy >= c["stache"]["lip"]))  # not the mouth's own lines below the lip
        n, lab, st, _ = cv2.connectedComponentsWithStats(s.astype(np.uint8), connectivity=8)
        stache = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 30])
        print(name, "stache px", stache.sum())

    # ---- the hair's shadow on the skin (Ange): the darker skin along her hair's edges moves with the hair (its own
    # layer, drawn with the head, clipped to the body and arms), and under it the skin is plain, so a tilt never leaves a
    # dark band where the hair was
    if "hairShade" in c:
        hs = c["hairShade"]
        shade = dil(mainHair, hs["d"]) & ~head & (yy > hs["ymin"]) & np.isin(idx, hs["cols"])
        shade &= (body | limbs) & ~poly((H, W), hs["keep"])
        bidx[shade & body] = hs["base"]
        for k, (m, ix) in pieces.items(): ix[shade & m] = hs["base"]
        piece("shade", shade)
        print(name, "hair shade px", shade.sum())

    # ---- the hair (round 6, the user: "what if we also consider hair? can you trace it?"): its own part over the face,
    # so it can sway. Hair = the head minus the face side: the face's skin and the outline round it, the features' cuts
    # and eyes, the ears with their outlines. Under it the face carries on (its skin out to the measured face shape, that
    # shape's outline from `line` down; behind everything the puppets draw the hair again, shaded, as the back hair, so
    # hair swinging off the face or a shoulder never leaves a hole). An earring over the hair is its own part, with hair
    # under it.
    if "hairCut" in c:
        hc = c["hairCut"]
        fp = np.zeros((H, W), bool)
        for p in c["cut"] + list(c.get("eyes", {}).values()): fp |= poly((H, W), p)
        side = face | (fp & head & ~mainHair) | (dil(face, 4) & head & ~hair)
        fshape = poly((H, W), hc["face"])
        # the ears: skin off the face, beside the face shape (not skin the hair's tips enclose), with their outlines; and
        # what the face side encloses (the ears' inner folds)
        n, lab, st, _ = cv2.connectedComponentsWithStats((head & skin & ~face).astype(np.uint8), connectivity=8)
        ears = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 150]) & ~fshape
        n, lab = cv2.connectedComponents(ears.astype(np.uint8), connectivity=8)
        ears = np.isin(lab, [i for i in np.unique(lab[ears & dil(fshape, 12)]) if i])
        side = fill_holes(side | ears | (dil(ears, 3) & dark)) & head
        earring = np.zeros((H, W), bool)
        if "earring" in hc:
            x0, y0, x1, y1 = hc["earring"]["box"]
            e = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1) & np.isin(idx, hc["earring"]["cols"]) & head & ~ears
            n, lab, st, _ = cv2.connectedComponentsWithStats(e.astype(np.uint8), connectivity=8)
            earring = fill_holes(np.isin(lab, [i for i in range(1, n) if st[i, 4] > 20]))
            side &= ~earring
        hairP = head & ~side
        # (specks along the face stay with it)
        n, lab, st, _ = cv2.connectedComponentsWithStats(hairP.astype(np.uint8), connectivity=8)
        hairP &= ~np.isin(lab, [i for i in np.unique(lab[hairP & dil(side, 2)]) if i and st[i, 4] < 40])
        hix = nearest_fill(idx.copy(), earring, hairP & ~earring) if earring.any() else idx.copy()
        under = fshape & hairP
        hidx[under] = np.bincount(idx[face & skin], minlength=len(pal)).argmax()
        hidx[fshape & ~ero(fshape, 3) & hairP & (yy > hc["line"])] = c["ink"][-1]
        head = (head & ~hairP) | under
        piece("hair", hairP)
        pieces["hair"][1] = hix
        if earring.any(): piece("earring", earring)
        print(name, "hair px", hairP.sum(), "face under it", under.sum(), "earring", earring.sum())

    # ---- the round upper sleeve a lifted arm shows (Dan; round 4, "like a wing": the hanging sleeve's top is a narrow
    # wedge under the shoulder): a capsule about the shoulder joint S, along S->E for `len`, `r` either side, in the
    # sleeve's own colours: its profile across (the interior, outline left out, over the stretch `prof` along it where
    # it's full width; the commonest colour in each bin across) swept along it and round its ends. No outline of its own:
    # the puppet draws one where it sticks out past the body (MoreDetailedCuteDan.tsx)
    shoulders = {}
    for sn, sh in c.get("shoulders", {}).items():
        S_, E_ = np.array(sh["S"], float), np.array(sh["E"], float)
        u = (E_ - S_) / np.linalg.norm(E_ - S_)
        v = sh["side"] * np.array([u[1], -u[0]])  # across, + = the arm's outer side
        a_ = (xx - S_[0]) * u[0] + (yy - S_[1]) * u[1]
        c_ = (xx - S_[0]) * v[0] + (yy - S_[1]) * v[1]
        A0, A1 = sh["prof"]
        band = pieces["arm" + sn][0] & (a_ >= A0) & (a_ <= A1) & (L[np.minimum(idx, len(pal) - 1)] >= 150)
        ai, cv, iv = np.round(a_[band]).astype(int), c_[band], idx[band]
        tv = np.zeros_like(cv)
        for A in np.unique(ai):
            k = ai == A
            tv[k & (cv > 0)] = cv[k & (cv > 0)] / max(cv[k].max(), 1)
            tv[k & (cv <= 0)] = cv[k & (cv <= 0)] / max(-cv[k].min(), 1)
        NB = 24
        bins = np.clip(((tv + 1) / 2 * NB).astype(int), 0, NB - 1)
        prof = np.array([np.bincount(iv[bins == i], minlength=len(pal)).argmax() if (bins == i).any() else 0 for i in range(NB)])
        r_, ln = sh["r"], sh["len"]
        al = np.clip(a_, 0, ln)
        d = np.hypot(xx - (S_[0] + u[0] * al), yy - (S_[1] + u[1] * al))
        capm = d <= r_
        cc = np.where((a_ >= 0) & (a_ <= ln), c_, np.sign(c_) * d)
        six = idx.copy()
        six[capm] = prof[np.clip(((np.clip(cc / r_, -1, 1) + 1) / 2 * NB).astype(int), 0, NB - 1)][capm]
        piece("shoulder" + sn, capm)
        pieces["shoulder" + sn][1] = six
        shoulders[sh["side"]] = sh
        print(name, "shoulder", sn, "profile", [pal[i] for i in prof])

    parts = {"head": (head, hidx), "body": (body, bidx)}
    for k, (m, ix) in pieces.items(): parts[k] = (m, ix)
    if stache is not None: parts["stache"] = (stache, idx)

    # ---- layers + potrace
    pd = f"{wd}/{name}_parts"; os.makedirs(pd, exist_ok=True)
    out = {}
    for pn, (m, ix) in parts.items():
        r = np.where(m, rank[np.minimum(ix, len(pal) - 1)], -1)
        layers = []
        order = np.argsort(rank)
        for k in range(len(pal)):
            col = order[k]
            if k > 0 and (m & (ix == col)).sum() < 40: continue
            lm = m & (r >= k) if k > 0 else m
            fn = f"{pd}/{pn}_{k:02d}"
            img = np.where(lm, 0, 255).astype(np.uint8)
            cv2.imwrite(fn + ".pgm", img)
            subprocess.run(["potrace", fn + ".pgm", "-s", "--flat", "-t", "25", "-O", "0.6", "-o", fn + ".svg"], check=True)
            svg = open(fn + ".svg").read()
            d = " ".join(" ".join(x.split()) for x in re.findall(r'<path d="([^"]*)"', svg, re.S))
            if d: layers.append((pal[col], d))
        out[pn] = layers
        print(name, pn, "layers", len(layers), "chars", sum(len(d) for _, d in layers))
    np.savez_compressed(f"{wd}/{name}_parts_masks.npz", **{k: parts[k][0] for k in parts})
    summary[name] = (H, out)

    N = name[0].upper() + name[1:]
    ts = [f"// GENERATED by src/wedding/trace/split.py: traced from the user's own Dan & Ange picture (wedding test, 2026-10-25),",
          f"// one potrace path per part x colour layer (stacked, lightest first), in the picture's pixel space (1216x{H}; draw inside POTRACE_T).",
          f"// The face's brows and mouth are left out here and drawn in code by MoreDetailedCute{N}.tsx; the eyes are EYES below.",
          f"// Parts (round 5): head, body (with what the others hide traced in), shoulder + arms, hands, feet; round 6: the hair",
          f"// (the head = the face, carried on under it), an earring: {', '.join(out)}.",
          'import type { EyeArt } from "./tracedFace";',
          f'export const POTRACE_T = "translate(0 {H}) scale(0.1 -0.1)";',
          f"export const PIC_H = {H};",
          "export const PARTS: Record<string, [string, string][]> = {"]
    for pn, layers in out.items():
        ts.append(f"  {pn}: [")
        for col, d in layers: ts.append(f'    ["{col}", "{d}"],')
        ts.append("  ],")
    ts.append("};")
    if shoulders:
        ts.append("// the round upper sleeves (shoulderL / shoulderR): capsules about the shoulder joint S, along S->E for len, r either side")
        ts.append("export const SHOULDER: Record<-1 | 1, { S: [number, number]; E: [number, number]; r: number; len: number }> = {")
        for sd, sh in shoulders.items(): ts.append(f"  [{sd}]: {{ S: [{sh['S'][0]}, {sh['S'][1]}], E: [{sh['E'][0]}, {sh['E'][1]}], r: {sh['r']}, len: {sh['len']} }},")
        ts.append("};")
    if eyes:
        ts.append("// the eyes, traced (drawn by tracedFace.tsx's Eye inside `t`): the opening, its white, the iris (slides inside the")
        ts.append("// opening to look) and the liner (lashes, wing, crease, lower lid); `skin` = the face around it (for a lowered lid)")
        ts.append("export const EYES: Record<-1 | 1, EyeArt> = {")
        for side, e in eyes.items():
            ts.append(f"  [{side}]: {{")
            for k in ("t", "open", "white", "skin"): ts.append(f'    {k}: "{e[k]}",')
            for k in ("sclera", "iris", "liner"):
                ts.append(f"    {k}: [")
                for col, d in e[k]: ts.append(f'      ["{col}", "{d}"],')
                ts.append("    ],")
            ts.append("  },")
        ts.append("};")
    if group is not None:
        # the bouquet lift's weight field: 0 at the shoulders, 1 at the hands, by the distance travelled inside the arms
        # from the shoulders (the arms and hands only: the bouquet moves whole with the hands, MoreDetailedCuteAnge.tsx;
        # through it, the field took short cuts and squashed it)
        reach = pieces["armL"][0] | pieces["armR"][0] | pieces["handL"][0] | pieces["handR"][0]
        g = reach.astype(np.uint8)
        seeds = reach & (yy <= c["group"]["shoulders"] + 6)
        dist = np.full((H, W), 1e9)
        from collections import deque
        q = deque()
        for y_, x_ in zip(*np.where(seeds)): dist[y_, x_] = 0; q.append((y_, x_))
        while q:
            y_, x_ = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y_ + dy, x_ + dx
                if 0 <= ny < H and 0 <= nx < W and g[ny, nx] and dist[ny, nx] > dist[y_, x_] + 1:
                    dist[ny, nx] = dist[y_, x_] + 1; q.append((ny, nx))
        ys, xs = np.where(reach)
        bx0, by0, bx1, by1 = xs.min() - 8, ys.min() - 8, xs.max() + 8, ys.max() + 8
        STEP = 6
        gw = []
        for gy in range(by0, by1 + 1, STEP):
            row = []
            for gx in range(bx0, bx1 + 1, STEP):
                win = dist[max(0, gy - 4):gy + 5, max(0, gx - 4):gx + 5]
                v = win[win < 1e9]
                row.append(int(round(v.min())) if v.size else -1)
            gw.append(row)
        print(name, "lift field", len(gw), "x", len(gw[0]), "max dist", int(dist[dist < 1e9].max()))
        ts.append(f"// distance (px) from the shoulders inside the arms, every {STEP}px from ({bx0}, {by0}); -1 = outside")
        ts.append(f"export const LIFT_GRID = {{ x0: {bx0}, y0: {by0}, step: {STEP}, d: {gw} }};")
    open(f"{tsdir}/moreDetailedCute{N}Parts.ts", "w").write("\n".join(ts) + "\n")
    print(name, "ts bytes", os.path.getsize(f"{tsdir}/moreDetailedCute{N}Parts.ts"))
