"""Build the two mascot Lotties from the traced part SVGs in ../svg/parts.

    python design/lottie/build_pizza_mascot.py

The parts were traced from design/sources/pizza-character.png (the
"Animation-Ready Assets" row) with image2svg at 4x, so they share one
coordinate scale. The rig works in that part space; a root null scales the
whole character into the canvas.

Both files run at 60 fps and share the `walk` segment (0-144: four steps,
one blink, loops seamlessly). Each then has one gag segment that ends on walk
frame 0, so the app goes straight back to looping `walk`:

  assets/lottie/pizza-cart.json  `point` 144-330: skid stop + dust, lean in, point at the
                                 checkout button + finger jabs, wink + sparkles, happy hop.
  assets/lottie/taco-mexican.json `ole` 144-340: the taco, traced from
                                 design/sources/taco-character.jpg, tips its
                                 sombrero, dances two sways and throws an ole.
                                 It plays when the guest reaches Mexikanisch.
  assets/lottie/pizza-home.json  `toss`  144-360: chef hat and scarf on. Tosses a
                                 pepperoni out of frame, shuffles under it, catches it in
                                 its mouth (gulp, hat pops, blush), thumbs up + wink.

The character never travels inside the comp; the app moves the view
horizontally, so it stops where the screen needs it on any screen size.
"""
import colorsys
import json
import math
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARTS = HERE.parent / "svg" / "parts"
OUT_DIR = HERE.parents[1] / "assets" / "lottie"  # bundled by the app

FPS = 60
WALK_END = 144
CYCLE = 36  # frames per full step cycle (left + right)
END, W, H = 0, 0, 0  # set per build by begin()

OUTLINE = "#1F1413"
FACE = "#FDD252"


# --- SVG -> Lottie shapes -------------------------------------------------

def hex_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def clean_fill(h, limb):
    """Tracing turns the thin dark outline of the limbs into grey fringe
    paths. Snap those to the outline colour; keep glove shading."""
    if not limb:
        return h
    r, g, b = hex_rgb(h)
    _, l, s = colorsys.rgb_to_hls(r, g, b)
    if s < 0.25 and l < 0.53:
        return OUTLINE
    return h


def parse_path(d, dx, dy):
    toks = re.findall(r"[MCLZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    subs, cur, i, cmd = [], None, 0, None
    while i < len(toks):
        t = toks[i]
        if t in "MCLZ":
            cmd = t
            i += 1
            if cmd == "Z":
                subs.append(cur)
                cur = None
            continue
        n = lambda k: float(toks[i + k])
        if cmd == "M":
            cur = {"v": [[n(0) + dx, n(1) + dy]], "i": [[0, 0]], "o": [[0, 0]]}
            i += 2
        elif cmd == "L":
            cur["v"].append([n(0) + dx, n(1) + dy]); cur["i"].append([0, 0]); cur["o"].append([0, 0])
            i += 2
        elif cmd == "C":
            c1, c2, p = (n(0) + dx, n(1) + dy), (n(2) + dx, n(3) + dy), [n(4) + dx, n(5) + dy]
            pv = cur["v"][-1]
            cur["o"][-1] = [c1[0] - pv[0], c1[1] - pv[1]]
            cur["v"].append(p); cur["i"].append([c2[0] - p[0], c2[1] - p[1]]); cur["o"].append([0, 0])
            i += 6
    if cur:
        subs.append(cur)
    out = []
    for s in subs:
        v, ii, oo = s["v"], s["i"], s["o"]
        if len(v) > 1 and abs(v[0][0] - v[-1][0]) < 1e-6 and abs(v[0][1] - v[-1][1]) < 1e-6:
            ii[0] = ii[-1]
            v, ii, oo = v[:-1], ii[:-1], oo[:-1]
        r2 = lambda a: [[round(x, 1), round(y, 1)] for x, y in a]
        out.append({"ty": "sh", "ks": {"a": 0, "k": {"v": r2(v), "i": r2(ii), "o": r2(oo), "c": True}}})
    return out


def svg_shapes(name, limb):
    svg = (PARTS / name).read_text()
    groups = []
    for tag in re.findall(r"<path [^>]*>", svg):
        d = re.search(r'd="([^"]*)"', tag).group(1)
        fill = clean_fill(re.search(r'fill="([^"]*)"', tag).group(1), limb)
        m = re.search(r"translate\(([-\d.]+),([-\d.]+)\)", tag)
        dx, dy = (float(m.group(1)), float(m.group(2))) if m else (0, 0)
        groups.append(group(parse_path(d, dx, dy) + [fill_item(fill)]))
    return groups[::-1]  # SVG paints first-to-last; Lottie lists top-first


def fill_item(h, a=100):
    return {"ty": "fl", "c": {"a": 0, "k": hex_rgb(h) + [1]}, "o": st(a), "r": 1}


def stroke_item(h, w):
    return {"ty": "st", "c": {"a": 0, "k": hex_rgb(h) + [1]}, "o": st(100), "w": st(w), "lc": 2, "lj": 2}


def tr_item():
    return {"ty": "tr", "p": st([0, 0]), "a": st([0, 0]), "s": st([100, 100]), "r": st(0), "o": st(100)}


def group(items):
    return {"ty": "gr", "it": items + [tr_item()]}


def ellipse(cx, cy, w, h):
    return {"ty": "el", "p": st([cx, cy]), "s": st([w, h])}


def path_item(pts, closed=False):
    """pts: list of (vertex, in, out)."""
    return {"ty": "sh", "ks": {"a": 0, "k": {
        "v": [p[0] for p in pts], "i": [p[1] for p in pts], "o": [p[2] for p in pts], "c": closed}}}


# --- keyframes --------------------------------------------------------------

def st(v):
    return {"a": 0, "k": v}


EASES = {  # (out x, out y, in x, in y)
    "io": (0.42, 0, 0.58, 1),     # ease in-out
    "lin": (0.33, 0.33, 0.67, 0.67),
    "out": (0.2, 0.6, 0.4, 1),    # decelerate: a throw rising to its apex
    "in": (0.6, 0, 0.8, 0.4),     # accelerate: falling back down
}


def anim(keys):
    """keys: [(frame, value, ease)] where ease is a key of EASES (default
    'io') or 'hold'. Values may be scalars or lists."""
    keys = sorted(keys, key=lambda k: k[0])
    out = []
    for n, key in enumerate(keys):
        t, v = key[0], key[1]
        ease = key[2] if len(key) > 2 else "io"
        v = v if isinstance(v, list) else [v]
        k = {"t": t, "s": v}
        if n < len(keys) - 1:
            if ease == "hold":
                k["h"] = 1
            else:
                d = len(v)
                ox, oy, ix, iy = EASES[ease]
                k["o"] = {"x": [ox] * d, "y": [oy] * d}
                k["i"] = {"x": [ix] * d, "y": [iy] * d}
        out.append(k)
    return {"a": 1, "k": out}


def walk(values, extra=(), start=0, end=WALK_END):
    """Repeat one cycle's keys [(t, v)] across the walk segment, then append
    the gag-segment keys."""
    keys = []
    for c in range(start, end, CYCLE):
        keys += [(c + t, v) for t, v in values if c + t <= end]
    seen = {}
    for k in list(keys) + list(extra):
        seen[k[0]] = k
    return anim(list(seen.values()))


def xyz(v):
    return list(v) + [0] if len(v) == 2 else v


def ks(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    f = lambda v, conv: v if isinstance(v, dict) and "a" in v else st(conv(v))
    return {
        "p": f(p, lambda v: xyz(list(v))),
        "a": st(xyz(list(a))),
        "s": f(s, lambda v: xyz(list(v))),
        "r": f(r, lambda v: v),
        "o": f(o, lambda v: v),
    }


def vec3(keys):
    return anim([(k[0], xyz(list(k[1]))) + tuple(k[2:]) for k in keys])


layers = []


def begin(end, w, h):
    global END, W, H
    END, W, H = end, w, h
    layers.clear()


def layer(name, ind, parent=None, shapes=None, **tf):
    l = {"ddd": 0, "ind": ind, "ty": 3 if shapes is None else 4, "nm": name, "sr": 1,
         "ks": ks(**tf), "ao": 0, "ip": 0, "op": END + 1, "st": 0, "bm": 0}
    if parent:
        l["parent"] = parent
    if shapes is not None:
        l["shapes"] = shapes
    layers.append(l)


def write(filename, name, gag, order):
    layers.sort(key=lambda l: order.index(l["nm"]))
    lottie = {
        "v": "5.7.4", "fr": FPS, "ip": 0, "op": END, "w": W, "h": H, "nm": name, "ddd": 0,
        "assets": [], "layers": layers,
        "markers": [{"tm": 0, "cm": "walk", "dr": WALK_END}, {"tm": WALK_END, "cm": gag, "dr": END - WALK_END}],
    }
    OUT_DIR.mkdir(exist_ok=True)
    path = OUT_DIR / filename
    path.write_text(json.dumps(lottie, separators=(",", ":")))
    print(f"wrote {filename} ({path.stat().st_size // 1024} KB, {len(layers)} layers)")


# --- rig --------------------------------------------------------------------
# Part-space landmarks (from the 4x traces)
BODY_ANCHOR = (412, 828)          # bottom of the crust: squash/rock pivot
BODY_CENTER = (412, 426)
HIP_L, HIP_R = (-110, 330), (110, 330)  # in MOVE space (body centre = 0,0)
LEG_PIVOT = (132, 30)
ARM_PIVOT = (140, 36)
HAND = (85, 300)                  # glove centre in arm-SVG space
POINT_PIVOT = (40, 40)
FINGERTIP = (392, 72)             # in arm-point-SVG space
THUMB_PIVOT = (48, 236)           # shoulder end of the thumbs-up arm
THUMB_TIP = (232, 40)
HAT_BRIM = (185, 318)             # bottom centre of the hat's band
SCARF_KNOT = (178, 112)
SHOULDER_L, SHOULDER_R = (60, 470), (764, 470)   # in body-SVG space
EYE_L, EYE_R = (374, 362), (526, 358)
MOUTH = (430, 505)

ROOT, MOVE, BODY = 1, 2, 3

# Walk cycle keys (t within a 36-frame cycle). Contact at 0/18, passing at 9/27.
# The body faces the viewer, so each leg swings around its own outward offset
# (wide stride at 0, feet together at 18) instead of scissoring across.
bounce = [(0, [0, 34]), (9, [0, 0]), (18, [0, 22]), (27, [0, 0]), (36, [0, 34])]
rock = [(0, -3), (18, 3), (36, -3)]
leg_l = [(0, 30), (18, -6), (36, 30)]
leg_r = [(0, -30), (18, 6), (36, -30)]
lift_l = [(0, [100, 100, 100]), (18, [100, 100, 100]), (27, [100, 86, 100]), (36, [100, 100, 100])]
lift_r = [(0, [100, 100, 100]), (9, [100, 86, 100]), (18, [100, 100, 100]), (36, [100, 100, 100])]
arm_l = [(0, 20), (18, -20), (36, 20)]
arm_r = [(0, -20), (18, 20), (36, -20)]
BLINK = (100, 106)


def eyelid(name, ind, eye, size, shut_ranges, face=FACE):
    """A face-coloured cover that scales shut, plus a closed-eye curve that is
    shown only while the cover is fully shut."""
    cx, cy = eye
    cover = group([ellipse(cx, cy, *size), fill_item(face)])
    curve = group([path_item([([cx - 44, cy + 4], [0, 0], [18, 20]),
                              ([cx + 44, cy + 4], [-18, 20], [0, 0])]), stroke_item(OUTLINE, 11)])
    sy, op = [(0, [100, 0, 100])], [(0, 0, "hold")]
    for a, b in shut_ranges:
        sy += [(a, [100, 0, 100]), (a + 4, [100, 100, 100]), (b, [100, 100, 100]), (b + 4, [100, 0, 100])]
        op += [(a + 4, 100, "hold"), (b, 0, "hold")]
    sy.append((END, [100, 0, 100]))
    op.append((END, 0, "hold"))
    layer(name + " line", ind, BODY, shapes=[curve], o=anim(op))
    layer(name, ind + 1, BODY, shapes=[cover], a=eye, p=eye, s=anim(sy))


def sparkle(cx, cy, r):
    k = 0.28 * r
    pts = [([cx + dx, cy + dy], [0, 0], [0, 0])
           for dx, dy in [(0, -r), (k, -k), (r, 0), (k, k), (0, r), (-k, k), (-r, 0), (-k, -k)]]
    return group([path_item(pts, closed=True), fill_item("#FFE45C"), stroke_item(OUTLINE, 6)])


def sparkles(parent, tip, beats, first_ind):
    for n, (dx, dy, r, t0) in enumerate(beats):
        cx, cy = tip[0] + dx, tip[1] + dy
        layer(f"sparkle {n + 1}", first_ind + n, parent, shapes=[sparkle(cx, cy, r)], a=(cx, cy), p=(cx, cy),
              s=anim([(0, [0, 0, 100]), (t0, [0, 0, 100]), (t0 + 8, [120, 120, 100]), (t0 + 20, [90, 90, 100]),
                      (t0 + 30, [0, 0, 100]), (END, [0, 0, 100])]),
              r=anim([(0, 0), (t0, 0), (t0 + 30, 90), (END, 90)]))


def legs(extra_l, extra_r, extra_s=(), part="pizza-leg.svg", pivot=LEG_PIVOT,
         hips=(HIP_L, HIP_R)):
    """Legs hang off MOVE, not the body, so they do not rock with it."""
    shapes = svg_shapes(part, limb=True)
    for name, ind, hip, rot, lift, extra in (("leg L", 50, hips[0], leg_l, lift_l, extra_l),
                                             ("leg R", 51, hips[1], leg_r, lift_r, extra_r)):
        layer(name, ind, MOVE, shapes=shapes, a=pivot, p=hip,
              r=walk(rot, extra=extra), s=walk(lift, extra=list(extra_s) + [(END, [100, 100, 100])]))


def body_to_root(pt, body_scale, move_pos):
    """Where a point in body-SVG space lands in ROOT space, for a frame where
    the body and MOVE have no rotation."""
    sx, sy = body_scale[0] / 100, body_scale[1] / 100
    return [(pt[0] - BODY_ANCHOR[0]) * sx + move_pos[0],
            (pt[1] - BODY_ANCHOR[1]) * sy + (BODY_ANCHOR[1] - BODY_CENTER[1]) + move_pos[1]]


def arm_to_body(pt, pivot, shoulder, rot, mirror=False):
    x, y = pt[0] - pivot[0], pt[1] - pivot[1]
    if mirror:
        x = -x
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return (x * c - y * s + shoulder[0], x * s + y * c + shoulder[1])


# --- cart: walk in, point at the checkout button ------------------------------

def build_cart():
    begin(330, 700, 600)
    SKID, SETTLE, LEAN, POINT, JAB, WINK, LOWER, SWAP_BACK, CROUCH, JUMP, LAND = (
        156, 172, 186, 190, 226, 214, 262, 282, 292, 304, 316)

    layer("root", ROOT, p=(290, 300), s=(42, 42))
    layer("move", MOVE, ROOT,
          p=walk([(t, xyz(v)) for t, v in bounce], extra=[
              (SKID, [0, 20, 0]), (SETTLE, [0, 0, 0]), (CROUCH, [0, 34, 0]),
              (JUMP, [0, -150, 0]), (LAND, [0, 26, 0]), (324, [0, 6, 0]), (END, [0, 34, 0])]),
          r=anim([(0, 0), (WALK_END, 0), (SKID, -10), (SETTLE, 2), (LEAN, 6), (LOWER, 6),
                  (SWAP_BACK, 0), (END, 0)]))

    body_s = anim([(0, [100, 100, 100]), (WALK_END, [100, 100, 100]), (SKID - 6, [96, 104, 100]),
                   (SETTLE, [100, 100, 100]), (WINK - 4, [100, 100, 100]), (WINK, [106, 94, 100]),
                   (WINK + 8, [100, 100, 100]), (CROUCH, [110, 90, 100]), (JUMP, [94, 106, 100]),
                   (LAND, [112, 88, 100]), (324, [98, 102, 100]), (END, [100, 100, 100])])
    layer("body", BODY, MOVE, shapes=svg_shapes("pizza-body.svg", limb=False),
          a=BODY_ANCHOR, p=(0, BODY_ANCHOR[1] - BODY_CENTER[1]), s=body_s,
          r=walk(rock, extra=[(SKID, -4), (SETTLE, 0), (CROUCH, 0), (END, -3)]))

    eyelid("eyelid L", 10, EYE_L, (132, 166), [BLINK])
    eyelid("eyelid R", 12, EYE_R, (124, 166), [BLINK, (WINK, WINK + 16)])

    POINT_ARM = 20
    sparkles(POINT_ARM, FINGERTIP, [(80, -50, 60, WINK), (20, -120, 44, WINK + 8), (130, 20, 38, WINK + 16)], 30)

    arm_shapes = svg_shapes("pizza-arm.svg", limb=True)
    jabs = [(POINT, 40), (POINT + 14, -30), (POINT + 22, -18), (JAB, -24), (JAB + 6, -15), (JAB + 12, -24),
            (JAB + 18, -15), (LOWER, -18), (SWAP_BACK - 4, 40), (END, 40)]
    layer("point arm", POINT_ARM, BODY, shapes=svg_shapes("pizza-arm-point.svg", limb=True),
          a=POINT_PIVOT, p=SHOULDER_R, r=anim(jabs),
          o=anim([(0, 0, "hold"), (POINT, 100, "hold"), (SWAP_BACK, 0, "hold"), (END, 0)]))
    layer("arm R", 21, BODY, shapes=arm_shapes, a=ARM_PIVOT, p=SHOULDER_R, s=(-100, 100),
          r=walk(arm_r, extra=[(SKID, -35), (SETTLE, -6), (POINT - 2, -6), (SWAP_BACK, 6), (CROUCH, 10),
                               (JUMP, -60), (LAND, -10), (END, -20)]),
          o=anim([(0, 100, "hold"), (POINT, 0, "hold"), (SWAP_BACK, 100, "hold"), (END, 100)]))
    layer("arm L", 22, BODY, shapes=arm_shapes, a=ARM_PIVOT, p=SHOULDER_L,
          r=walk(arm_l, extra=[(SKID, -30), (SETTLE, 6), (LEAN, 10), (CROUCH, -10),
                               (JUMP, 60), (LAND, 10), (END, 20)]))

    # Dust puffs from the skid, on the ground in front of the braced foot.
    for n, (x, dx, size, delay) in enumerate([(170, 70, 130, 0), (250, 150, 160, 3), (90, -30, 110, 6)]):
        t0 = WALK_END + 2 + delay
        layer(f"dust {n + 1}", 40 + n, ROOT,
              shapes=[group([ellipse(0, 0, size, size * 0.7), fill_item("#D8C3A0")])],
              p=vec3([(0, [x, 620]), (t0, [x, 620]), (t0 + 26, [x + dx, 560]), (END, [x + dx, 560])]),
              s=anim([(0, [0, 0, 100]), (t0, [0, 0, 100]), (t0 + 10, [110, 110, 100]),
                      (t0 + 26, [150, 150, 100]), (END, [150, 150, 100])]),
              o=anim([(0, 0, "hold"), (t0, 90), (t0 + 26, 0), (END, 0)]))

    tuck = [(SKID, [100, 100, 100]), (SETTLE, [100, 100, 100]), (CROUCH, [100, 92, 100]),
            (JUMP, [100, 80, 100]), (LAND, [100, 94, 100])]
    legs([(SKID, 14), (SETTLE, 6), (CROUCH, 8), (JUMP, 22), (LAND, 6), (END, 30)],
         [(SKID, -34), (SETTLE, -6), (CROUCH, -8), (JUMP, -22), (LAND, -6), (END, -30)], tuck)

    write("pizza-cart.json", "Pizza mascot (cart)", "point", [
        "sparkle 1", "sparkle 2", "sparkle 3", "point arm", "arm R", "arm L",
        "eyelid L line", "eyelid L", "eyelid R line", "eyelid R", "body",
        "leg L", "leg R", "dust 1", "dust 2", "dust 3", "move", "root"])


# --- home: chef pizza tosses a pepperoni and catches it in its mouth ----------

def pepperoni(r=55):
    spots = [group([ellipse(dx, dy, 16, 12), fill_item("#A3221A")]) for dx, dy in ((-18, -14), (16, -6), (-4, 20))]
    return spots + [group([ellipse(0, 0, 2 * r, 2 * r), fill_item("#D83A2A"), stroke_item("#7A1710", 9)])]


def build_home():
    begin(360, 700, 640)
    STOP, WIND, THROW, APEX, CATCH, GULP, THUMB, WINK, THUMB_DOWN, SWAP_BACK = (
        158, 178, 190, 222, 250, 252, 280, 292, 334, 344)
    HAT_AT, HAT_ROT = (480, 64), 14
    THROW_ROT = -165
    THROW_SCALE = [95, 105]
    MOVE_AT_THROW, MOVE_AT_CATCH = [0, -12], [0, 6]

    layer("root", ROOT, p=(300, 340), s=(42, 42))
    layer("move", MOVE, ROOT,
          p=walk([(t, xyz(v)) for t, v in bounce], extra=[
              (STOP, [0, 0, 0]), (WIND, [0, 12, 0]), (THROW, xyz(MOVE_AT_THROW)), (200, [0, 0, 0]),
              # shuffle left and right to get under the falling pepperoni
              (210, [-40, 0, 0]), (222, [30, 0, 0]), (234, [-14, 0, 0]), (242, [0, 0, 0]),
              (CATCH, xyz(MOVE_AT_CATCH)), (GULP + 4, [0, 18, 0]), (268, [0, 0, 0]),
              (THUMB + 10, [0, -20, 0]), (THUMB + 20, [0, 0, 0]), (END, [0, 34, 0])]),
          r=anim([(0, 0), (WALK_END, 0), (THROW, 0), (198, -6), (208, -12), (238, -12),
                  (CATCH - 2, 0), (END, 0)]))

    body_s = [(0, [100, 100, 100]), (WALK_END, [100, 100, 100]), (STOP, [100, 100, 100]),
              (WIND, [104, 96, 100]), (THROW, xyz(THROW_SCALE)), (200, [100, 100, 100]),
              (CATCH, [100, 100, 100]), (GULP + 2, [90, 112, 100]), (GULP + 8, [110, 92, 100]),
              (268, [100, 100, 100]), (THUMB + 8, [104, 96, 100]), (THUMB + 16, [100, 100, 100]),
              (END, [100, 100, 100])]
    layer("body", BODY, MOVE, shapes=svg_shapes("pizza-body.svg", limb=False),
          a=BODY_ANCHOR, p=(0, BODY_ANCHOR[1] - BODY_CENTER[1]), s=anim(body_s),
          r=walk(rock, extra=[(STOP, 0), (268, 0), (END, -3)]))

    # Chef hat: jiggles a beat behind the walk, pops off on the gulp and lands.
    hat_x, hat_y = HAT_AT
    layer("hat", 5, BODY, shapes=svg_shapes("pizza-hat.svg", limb=False), a=HAT_BRIM,
          p=vec3([(0, HAT_AT), (GULP, HAT_AT), (GULP + 8, (hat_x - 20, hat_y - 190)),
                  (GULP + 20, HAT_AT), (GULP + 26, (hat_x, hat_y - 24)), (GULP + 32, HAT_AT), (END, HAT_AT)]),
          r=walk([(0, HAT_ROT + 1), (4, HAT_ROT + 3), (22, HAT_ROT - 3), (36, HAT_ROT + 1)], extra=[
              (STOP, HAT_ROT), (GULP, HAT_ROT), (GULP + 8, -12), (GULP + 20, HAT_ROT + 10),
              (GULP + 32, HAT_ROT), (END, HAT_ROT + 1)]),
          s=(90, 90))
    layer("scarf", 6, BODY, shapes=svg_shapes("pizza-scarf.svg", limb=False), a=SCARF_KNOT, p=(412, 676), s=(86, 86),
          r=walk([(0, -4), (18, 4), (36, -4)], extra=[(STOP, 0), (GULP + 4, 8), (268, 0), (END, -4)]))

    # Blush after the gulp, like the Kettwig artwork.
    layer("blush", 7, BODY,
          shapes=[group([ellipse(292, 462, 96, 56), ellipse(604, 456, 96, 56), fill_item("#F2856F")])],
          o=anim([(0, 0), (GULP + 4, 0), (GULP + 16, 70), (SWAP_BACK, 70), (END, 0)]))

    eyelid("eyelid L", 10, EYE_L, (132, 166), [BLINK])
    eyelid("eyelid R", 12, EYE_R, (124, 166), [BLINK, (WINK, WINK + 16)])

    # Pepperoni: held in the right hand, then a separate flight layer from the
    # release point, out of the top of the frame and down into the mouth.
    ARM_R = 21
    layer("pepperoni held", 25, ARM_R, shapes=pepperoni(), p=HAND, s=anim([
        (0, [0, 0, 100]), (STOP - 8, [0, 0, 100]), (STOP, [110, 110, 100]), (STOP + 6, [100, 100, 100]),
        (THROW - 1, [100, 100, 100], "hold"), (THROW, [0, 0, 100]), (END, [0, 0, 100])]))
    release = body_to_root(arm_to_body(HAND, ARM_PIVOT, SHOULDER_R, THROW_ROT, mirror=True),
                           THROW_SCALE, MOVE_AT_THROW)
    mouth = body_to_root(MOUTH, [100, 100], MOVE_AT_CATCH)
    layer("pepperoni", 26, ROOT, shapes=pepperoni(),
          p=vec3([(0, release), (THROW, release, "out"), (APEX, [(release[0] + mouth[0]) / 2, -1150], "in"),
                  (CATCH, mouth), (END, mouth)]),
          r=anim([(0, 0), (THROW, 0, "lin"), (CATCH, 1080), (END, 1080)]),
          s=anim([(0, [0, 0, 100], "hold"), (THROW, [100, 100, 100]), (CATCH - 2, [100, 100, 100]),
                  (CATCH + 1, [0, 0, 100]), (END, [0, 0, 100])]))

    THUMB_ARM = 20
    sparkles(THUMB_ARM, THUMB_TIP, [(70, -40, 60, WINK), (-20, -110, 44, WINK + 8), (120, 30, 38, WINK + 16)], 30)
    layer("thumb arm", THUMB_ARM, BODY, shapes=svg_shapes("pizza-arm-thumb.svg", limb=True),
          a=THUMB_PIVOT, p=SHOULDER_R, s=(125, 125),
          r=anim([(THUMB, 70), (THUMB + 10, -2), (THUMB + 16, 12), (300, 4), (306, 16), (312, 6),
                  (THUMB_DOWN - 8, 10), (SWAP_BACK - 1, 70), (END, 70)]),
          o=anim([(0, 0, "hold"), (THUMB, 100, "hold"), (SWAP_BACK, 0, "hold"), (END, 0)]))

    arm_shapes = svg_shapes("pizza-arm.svg", limb=True)
    layer("arm R", ARM_R, BODY, shapes=arm_shapes, a=ARM_PIVOT, p=SHOULDER_R, s=(-100, 100),
          r=walk(arm_r, extra=[(STOP, -10), (WIND, 28), (THROW, THROW_ROT), (200, -150), (214, -30),
                               (234, 10), (CATCH, 0), (GULP + 6, -50), (THUMB - 2, 0), (SWAP_BACK, 10),
                               (END, -20)]),
          o=anim([(0, 100, "hold"), (THUMB, 0, "hold"), (SWAP_BACK, 100, "hold"), (END, 100)]))
    layer("arm L", 22, BODY, shapes=arm_shapes, a=ARM_PIVOT, p=SHOULDER_L,
          r=walk(arm_l, extra=[(STOP, 8), (WIND, -8), (THROW, 24), (210, 50), (222, -20), (234, 40),
                               (CATCH, 10), (GULP + 6, 60), (270, 8), (END, 20)]))

    legs([(STOP, 6), (210, -6), (216, 14), (222, 20), (228, 4), (242, 6), (GULP + 4, 12), (268, 6), (END, 30)],
         [(STOP, -6), (210, -20), (216, -4), (222, 6), (228, -14), (242, -6), (GULP + 4, -12), (268, -6),
          (END, -30)],
         [(STOP, [100, 100, 100]), (213, [100, 90, 100]), (219, [100, 100, 100]), (225, [100, 90, 100]),
          (231, [100, 100, 100])])

    write("pizza-home.json", "Pizza mascot (home)", "toss", [
        "pepperoni", "sparkle 1", "sparkle 2", "sparkle 3", "thumb arm", "pepperoni held", "arm R", "arm L",
        "hat", "eyelid L line", "eyelid L", "eyelid R line", "eyelid R", "blush", "scarf", "body",
        "leg L", "leg R", "move", "root"])


# --- taco: sombrero, hat tip, a little dance, ole ----------------------------
# Landmarks of the taco traces (5x), measured the way the pizza's were.
T_BODY_ANCHOR, T_BODY_CENTRE = (455, 645), (455, 335)
T_HIP_L, T_HIP_R = (-125, 265), (105, 265)
T_LEG_PIVOT = (95, 15)
T_ARM_PIVOT = (30, 195)
T_THUMB_PIVOT, T_THUMB_TIP = (30, 250), (230, 35)
T_HAT_ANCHOR = (307, 300)          # centre of the sombrero's brim
T_SHOULDER_L, T_SHOULDER_R = (140, 350), (755, 350)
T_EYE_L, T_EYE_R = (437, 300), (585, 295)
T_SHELL = "#F9C233"                # the shell, for the eyelids
# The arm art lies diagonally, so hanging it down needs a base angle; the
# mirrored left arm turns the other way.
T_ARM_BASE_L, T_ARM_BASE_R = -75, 75


def build_taco():
    begin(340, 700, 560)
    STOP, TIP, TIP_BACK, DANCE, OLE, WINK, SETTLE = 158, 178, 196, 200, 292, 300, 320
    HAT_AT, HAT_ROT = (470, 150), -8
    SWAY = 30  # frames per sway of the dance

    layer("root", ROOT, p=(300, 290), s=(42, 42))

    sway_p = [(DANCE + n * SWAY, [(-38 if n % 2 == 0 else 38), 6, 0]) for n in range(4)]
    layer("move", MOVE, ROOT,
          p=walk([(t, xyz(v)) for t, v in bounce], extra=[
              (STOP, [0, 0, 0]), (TIP, [0, 8, 0]), (TIP_BACK, [0, 0, 0])] + sway_p + [
              (OLE - 8, [0, 10, 0]), (OLE, [0, -26, 0]), (OLE + 12, [0, 0, 0]),
              (SETTLE, [0, 0, 0]), (END, [0, 34, 0])]),
          r=anim([(0, 0), (WALK_END, 0), (STOP, 0), (TIP, 7), (TIP_BACK, 0)]
                 + [(DANCE + n * SWAY, (-7 if n % 2 == 0 else 7)) for n in range(4)]
                 + [(OLE, 0), (END, 0)]))

    layer("body", BODY, MOVE, shapes=svg_shapes("taco-body.svg", limb=False),
          a=T_BODY_ANCHOR, p=(0, T_BODY_ANCHOR[1] - T_BODY_CENTRE[1]),
          s=anim([(0, [100, 100, 100]), (WALK_END, [100, 100, 100]), (STOP, [100, 100, 100]),
                  (TIP, [102, 98, 100]), (TIP_BACK, [100, 100, 100]), (OLE - 8, [106, 94, 100]),
                  (OLE, [94, 108, 100]), (OLE + 12, [100, 100, 100]), (END, [100, 100, 100])]),
          r=walk(rock, extra=[(STOP, 0), (TIP, 4), (TIP_BACK, 0), (OLE, 0), (END, -3)]))

    # The sombrero rides along, lifts for the hat tip, and leans against the sways.
    hat_x, hat_y = HAT_AT
    layer("hat", 5, BODY, shapes=svg_shapes("taco-hat.svg", limb=False), a=T_HAT_ANCHOR, s=(96, 96),
          p=vec3([(0, HAT_AT), (STOP, HAT_AT), (TIP, (hat_x + 70, hat_y - 210)),
                  (TIP_BACK, HAT_AT), (OLE - 8, HAT_AT), (OLE, (hat_x, hat_y - 60)),
                  (OLE + 12, HAT_AT), (END, HAT_AT)]),
          r=walk([(0, HAT_ROT + 1), (6, HAT_ROT + 4), (24, HAT_ROT - 4), (36, HAT_ROT + 1)], extra=[
              (STOP, HAT_ROT), (TIP, HAT_ROT - 26), (TIP_BACK, HAT_ROT)]
              + [(DANCE + n * SWAY, HAT_ROT + (5 if n % 2 == 0 else -5)) for n in range(4)]
              + [(OLE, HAT_ROT), (END, HAT_ROT + 1)]))

    eyelid("eyelid L", 10, T_EYE_L, (104, 150), [BLINK], face=T_SHELL)
    eyelid("eyelid R", 12, T_EYE_R, (98, 150), [BLINK, (WINK, WINK + 16)], face=T_SHELL)

    THUMB_ARM = 20
    sparkles(THUMB_ARM, T_THUMB_TIP, [(60, -40, 58, WINK), (-30, -100, 42, WINK + 8),
                                      (110, 20, 36, WINK + 16)], 30)
    layer("thumb arm", THUMB_ARM, BODY, shapes=svg_shapes("taco-arm-thumb.svg", limb=True),
          a=T_THUMB_PIVOT, p=T_SHOULDER_R, s=(118, 118),
          r=anim([(OLE, 40), (OLE + 10, -18), (OLE + 18, -4), (WINK + 20, -10),
                  (SETTLE - 4, 40), (END, 40)]),
          o=anim([(0, 0, "hold"), (OLE, 100, "hold"), (SETTLE, 0, "hold"), (END, 0)]))

    # Arms: the right one lifts the hat, then both swing out through the dance.
    arm_shapes = svg_shapes("taco-arm.svg", limb=True)
    dance_r = [(DANCE + n * SWAY, T_ARM_BASE_R - (70 if n % 2 == 0 else 20)) for n in range(4)]
    dance_l = [(DANCE + n * SWAY, T_ARM_BASE_L + (20 if n % 2 == 0 else 70)) for n in range(4)]
    layer("arm R", 21, BODY, shapes=arm_shapes, a=T_ARM_PIVOT, p=T_SHOULDER_R,
          r=walk([(t, T_ARM_BASE_R + v) for t, v in arm_r], extra=[
              (STOP, T_ARM_BASE_R), (TIP, T_ARM_BASE_R - 120), (TIP_BACK, T_ARM_BASE_R)] + dance_r
              + [(OLE - 4, T_ARM_BASE_R - 110), (SETTLE, T_ARM_BASE_R), (END, T_ARM_BASE_R - 20)]),
          o=anim([(0, 100, "hold"), (OLE, 0, "hold"), (SETTLE, 100, "hold"), (END, 100)]))
    layer("arm L", 22, BODY, shapes=arm_shapes, a=T_ARM_PIVOT, p=T_SHOULDER_L, s=(-100, 100),
          r=walk([(t, T_ARM_BASE_L - v) for t, v in arm_l], extra=[
              (STOP, T_ARM_BASE_L), (TIP, T_ARM_BASE_L + 30), (TIP_BACK, T_ARM_BASE_L)] + dance_l
              + [(OLE - 4, T_ARM_BASE_L + 110), (SETTLE, T_ARM_BASE_L), (END, T_ARM_BASE_L + 20)]))

    # Feet keep the beat: a lift on each sway, and a two-footed hop on the ole.
    dance_leg_l = [(DANCE + n * SWAY, (14 if n % 2 == 0 else -2)) for n in range(4)]
    dance_leg_r = [(DANCE + n * SWAY, (2 if n % 2 == 0 else -14)) for n in range(4)]
    dance_lift = [(DANCE + n * SWAY - 8, [100, (88 if n % 2 else 100), 100]) for n in range(1, 4)]
    legs([(STOP, 6), (TIP, 6), (TIP_BACK, 6)] + dance_leg_l + [(OLE, 16), (SETTLE, 6), (END, 30)],
         [(STOP, -6), (TIP, -6), (TIP_BACK, -6)] + dance_leg_r + [(OLE, -16), (SETTLE, -6), (END, -30)],
         [(STOP, [100, 100, 100])] + dance_lift + [(OLE, [100, 92, 100]), (OLE + 12, [100, 100, 100])],
         part="taco-leg.svg", pivot=T_LEG_PIVOT, hips=(T_HIP_L, T_HIP_R))

    write("taco-mexican.json", "Taco mascot (Mexican menu)", "ole", [
        "sparkle 1", "sparkle 2", "sparkle 3", "thumb arm", "arm R", "arm L", "hat",
        "eyelid L line", "eyelid L", "eyelid R line", "eyelid R", "body",
        "leg L", "leg R", "move", "root"])


if __name__ == "__main__":
    build_cart()
    build_home()
    build_taco()
