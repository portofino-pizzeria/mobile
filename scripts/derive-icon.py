#!/usr/bin/env python3
"""Derive the app icon, the adaptive icon and the splash mark from the mascot sheet.

`domain_spec/imagery-and-iconography` (tenant `pizzeria`) states the rule this
script implements, the same one `derive-assets.py` implements for the menu:

    Sheets are SOURCES, not assets. Per-item files are derived from a sheet by a
    committed, re-runnable step that records the crop box for each cell. A
    hand-cropped image nobody can reproduce becomes unmaintainable the first
    time the menu changes.

WHAT IS DERIVED, AND FROM WHERE. `design/sources/pizza-character.png` is the
mascot concept sheet. Its top row carries five concepts; the operator chose
number 4, "Delivery Pizza" - the pizza wearing a cap and carrying a box. Its
crop box is recorded below and the sheet's digest is asserted, so a re-cut
sheet aborts this script instead of silently cutting a different character.

WHY THE BACKGROUND IS FLOOD-FILLED RATHER THAN COLOUR-KEYED. The gloves, the
pizza box and the eye whites are the same near-white as the sheet's paper, so
keying on colour punches holes through all three. The fill starts at the border
and may only travel through paper-like pixels, so it stops at the character's
dark outline and those three survive. Its passability test is deliberately
wider than "paper": it also admits the soft grey ground shadow, a
low-saturation light grey contiguous with the paper and fenced off from the
character by that same outline. An icon has no ground to cast a shadow on.

WHY THE ART IS UPSCALED RATHER THAN VECTORISED. The crop box is 230x266 px and
the character tight-crops to 230x256 within it, while the icon must be 1024. Tracing it to SVG first was tried and
MEASURED WORSE: vtracer 0.6.5, at native resolution and at 3x, loses the pupil
highlights, posterises the cheese and leaves stair-steps along the cap. Lanczos
keeps all three. The art is a rendered illustration with soft shading, which is
the content a curve tracer handles worst. Re-measure before reversing this.

EVERY SIZE HERE IS A RADIUS, NOT A HEIGHT. Android masks an adaptive icon to a
shape it chooses, and the splash icon to a circle. Fitting art to a circle by
making its HEIGHT equal the circle's DIAMETER is the obvious test and the wrong
one: it ignores everything off the vertical centre line, which on this
character is the cap's crown and both shoes. Every fit below scales by the
content's measured maximum radius from the canvas centre, and `main` re-asserts
the result against the real mask before writing.

Usage:
    python scripts/derive-icon.py --check     # verify the committed files match
    python scripts/derive-icon.py             # derive + write
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

MOBILE = Path(__file__).resolve().parent.parent
SHEET = MOBILE / "design" / "sources" / "pizza-character.png"

# The sheet this script was measured against. A different sheet is a different
# set of concepts, and cell 4 would no longer be the delivery character.
SHEET_SHA256 = "34109155b57f681414f03a74684b565cddc6241d408f6bf0d32c61f366fded5f"

# Concept 4 of the top row, "Delivery Pizza": (left, top, right, bottom) on the
# sheet. Measured from the sheet's own ink profile - the five character bands
# are (24,251) (253,515) (543,794) (805,1034) (1051,1272) and the captions
# beneath them read 1..5 in that same order.
DELIVERY_BOX = (805, 113, 1035, 379)

# --- the declared visual system -------------------------------------------
# `domain_spec/visual-system`, as `src/constants/theme.ts` transcribes it.
# These are COPIES: a .py file cannot import a .ts one, and `app.json` cannot
# import either. `check_colours_agree` asserts all three still say the same
# thing, because a comment claiming they are in sync is not a mechanism.
CREAM = (247, 243, 237)   # Brand.cream  #f7f3ed - the icon's ground
INK = (26, 26, 26)        # Brand.ink    #1a1a1a - the themed icon's lines

# Android's adaptive icon: a 108dp layer of which a launcher may mask away
# everything outside a central circle. 66dp is the diameter Android GUARANTEES
# is visible; 72dp is the largest any legal mask shows.
#
# THIS IS A PLATFORM FACT AND ONLY ASSERTIONS MAY READ IT. The fit fraction
# below is a knob someone will reach for to make the mark look bigger; this is
# not. They were one symbol until a review pointed out what that costs: the
# assertion then reads whatever the knob was set to, so editing it widens the
# art AND the limit together and the guard passes. Measured on that shape,
# 1345 foreground pixels landed outside the real circle with the check green.
ANDROID_GUARANTEED = 66 / 108

# The knob. `derive` fits the adaptive layers to this; `check_masks` asserts
# them against the fact above. The assert is what makes the two-symbol split
# load-bearing rather than a naming convention.
ADAPTIVE_FIT = 66 / 108

# Two checks, because the split alone is not enough. The first catches widening
# the KNOB, which is the one-token edit someone reaches for. The second catches
# widening the FACT to make room for it - the platform bound is spelled as a
# literal here so that editing the constant above cannot move the line it is
# measured against. Raised as an exit rather than an `assert`, so the message
# is the message and not a traceback, and so `-O` cannot strip it.
if ADAPTIVE_FIT > ANDROID_GUARANTEED:
    raise SystemExit(
        f"the adaptive fit {ADAPTIVE_FIT:.4f} is wider than the "
        f"{ANDROID_GUARANTEED:.4f} circle this file calls guaranteed; the cap and "
        "the shoes would be clipped on a circular launcher"
    )
if ANDROID_GUARANTEED > 66 / 108:
    raise SystemExit(
        f"ANDROID_GUARANTEED has been widened to {ANDROID_GUARANTEED:.4f}. It is a "
        "PLATFORM FACT - Android guarantees 66 of 108 dp - not a knob. Widening it "
        "moves the limit the art is checked against, which is how the clipping this "
        "guard exists for gets back in."
    )

# Headroom `circle_fit` aims inside the circle it is fitting, so the margin is a
# STATED quantity rather than wherever the shrink loop happened to stop.
#
# Without it the loop exits on the first factor that fits, which left the shipped
# foreground 0.43 px inside a 312.89 px allowance - 0.14%. That is correct today
# and fragile tomorrow: the realistic trigger is a Pillow bump changing Lanczos
# by a fraction of a pixel, and `check_masks` runs BEFORE the pixel comparison,
# so the first thing a developer would have seen is "your art would be clipped"
# when the truth was "your resampler moved". 0.5% is ~1.6 px at 1024, far more
# than any resampler will shift an edge and far less than any real widening.
FIT_MARGIN = 0.995
if not 0.9 <= FIT_MARGIN < 1.0:
    raise SystemExit(
        f"FIT_MARGIN is {FIT_MARGIN}, which is not a margin. Above 1.0 it pushes the "
        "art OUTWARD past the circle it is meant to fit inside, and `check_masks`' "
        "message would then report a percentage it aims 'inside' as a negative "
        "number. 1.0 is EXCLUDED because 1.0 is zero margin - it restores the "
        "0.43 px / 0.14% headroom this constant exists to replace, so admitting it "
        "would make the bound decoration. Below 0.9 the character is shrinking for "
        "no stated reason."
    )

# How much of the square canvas the character spans on the plain icon, which is
# masked to a rounded rectangle rather than a circle and so has no radius
# problem.
ICON_SPAN = 0.78

# The splash mark keeps a margin inside its own canvas's inscribed circle,
# which is what Android 12's splash API masks it to.
SPLASH_CIRCLE = 0.95


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def flood_background(a: np.ndarray) -> np.ndarray:
    """Pixels reachable from the border through paper-like pixels."""
    h, w, _ = a.shape
    mx, mn = a.max(axis=2), a.min(axis=2)
    passable = ((mx - mn) <= 20) & (mx >= 200)
    seen = np.zeros((h, w), bool)
    queue: deque = deque()

    def push(y: int, x: int) -> None:
        if passable[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w:
                push(ny, nx)
    return seen


def components(alpha: np.ndarray) -> list[list[tuple[int, int]]]:
    h, w = alpha.shape
    seen = np.zeros((h, w), bool)
    out: list[list[tuple[int, int]]] = []
    for sy in range(h):
        for sx in range(w):
            if not alpha[sy, sx] or seen[sy, sx]:
                continue
            comp: list[tuple[int, int]] = []
            queue = deque([(sy, sx)])
            seen[sy, sx] = True
            while queue:
                y, x = queue.popleft()
                comp.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
            out.append(comp)
    return out


# The paper-coloured pixels the character's outline fences off from the border:
# the pizza box's lid, the gloves and the eye whites. The fill must never reach
# them, and the shadow peel must not eat them either - so this is MEASURED ON
# THE FINISHED CUT-OUT (after both), which is the only number an assertion can
# honestly compare against. 1979 survive the fill; the peel takes 6 more at the
# box's outer edge.
INTERIOR_PAPER = 1973

# There is DELIBERATELY NO TOLERANCE CONSTANT beside this one. There used to be an
# `INTERIOR_PAPER_SLACK = 0` whose own comment argued at length that it had to stay
# zero - which makes it a knob that can only ever do harm, and nothing bounded it,
# so setting it to 200 blinded the assertion and passed. The reasoning it carried
# is worth keeping and belongs here: the count is bit-reproducible, because nothing
# upstream of it resamples (the crop is integer slicing, the fill and the component
# walk are BFS with a fixed neighbour order, and this runs on the cut-out BEFORE any
# scaling) and the one non-integer stage, the peel's float64 Rec.709 threshold, is
# separate exactly-rounded IEEE-754 ufuncs over integer inputs in a fixed order and
# so bit-identical on any platform. The regions it protects are 92 px and smaller,
# so a tolerance could only hide a real loss.

# The peel is unbounded by construction: it eats inward through anything
# connected to the silhouette edge that reads light-and-cool. It removes 135 px
# on this sheet. A cap turns a runaway on a re-cut sheet - a box lid exposed at
# the silhouette and reading a few points blue - into a loud failure instead of
# a hollowed-out icon nobody notices.
#
# 160 is chosen against the two measurements that bracket it, not by feel: the
# real peel is 135 px (18% headroom), and deleting the colour-temperature term
# - the most likely way this runs away - takes 189 px, which this REFUSES. At
# 200 that failure mode passed, and a cap that admits the runaway it names is
# decoration.
#
# THIS CAP IS THE ONLY GUARD FOR THAT RUNAWAY. An earlier version of this comment
# called it "a backstop, not the real guard" and credited `assert_interior_intact`.
# Measured: with the colour-temperature term deleted the peel removes 189 px and
# the interior paper count stays at exactly 1973, so that assertion is SILENT.
# The two guards cover different failures - this one bounds how much the peel
# eats from the silhouette inward, that one detects an enclosed region losing
# pixels - and neither substitutes for the other.
PEEL_MAX = 160


def keep_character(img: Image.Image) -> Image.Image:
    """Keep the one connected shape that is the character, drop the rest.

    MEASURED on this sheet: the character is a single component of 30,370 px at
    Rec.709 luma 130, and the largest detached fragment of the ground shadow's
    fringe is 57 px at 226. Three orders of magnitude apart in SIZE, which is
    what this function sorts on, so "the biggest shape" is not a heuristic here.
    (Rec.709 because that is the luma this file thresholds on everywhere else;
    the mean of R,G,B would read 127 and 228, close enough to mislead a reader
    into thinking either formula was meant.)

    THE LEAK THIS CANNOT SEE is checked separately, by `assert_interior_intact`
    on the FINISHED cut-out. Comparing the two largest shapes only catches a
    fragment growing into something real; the failure this fill can actually
    have is the opposite - leaking INWARD through a thin spot in the outline
    into an enclosed light region, which punches a hole while leaving one
    connected component. The fence is one pixel thick in ten places, so this is
    not theoretical.
    """
    alpha = np.asarray(img)[:, :, 3] > 0
    comps = components(alpha)
    if not comps:
        raise SystemExit("nothing survived the background fill")
    comps.sort(key=len, reverse=True)
    biggest = comps[0]
    runner_up = len(comps[1]) if len(comps) > 1 else 0
    if runner_up > len(biggest) // 100:
        raise SystemExit(
            "the cut-out is not one shape: the largest is "
            f"{len(biggest)} px and the next is {runner_up} px. "
            "Something other than the shadow's fringe is being dropped - "
            "look at the crop before re-running."
        )

    keep = np.zeros(alpha.shape, bool)
    for y, x in biggest:
        keep[y, x] = True

    out = np.asarray(img).copy()
    out[:, :, 3] = np.where(keep, out[:, :, 3], 0)
    return Image.fromarray(out, "RGBA")


def peel_shadow_fringe(img: Image.Image) -> Image.Image:
    """Erase the ground shadow's fringe where it touches the character.

    `keep_character` drops the fringe that broke off; the fringe that touches a
    shoe is part of the character's own component and survives it. It ships as
    a smudge of cool grey under the foot on a warm cream ground.

    It is separable by COLOUR TEMPERATURE, not by lightness: the shadow is a
    cool grey (blue above red), while every light thing on the character - the
    box lid, the gloves, the eye whites - is neutral or warm. Measured: 139 px
    are light-and-cool against 10,229 light-and-warm.

    Peeled from the OUTSIDE IN rather than by colour alone, so an interior
    highlight that happens to be cool is never touched: only a pixel already on
    the silhouette's edge can be removed, and removing it exposes its
    neighbour to the same test.
    """
    a = np.asarray(img).astype(int)
    rgb = a[:, :, :3]
    alpha = a[:, :, 3] > 0
    luma = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    shadowish = (luma > 185) & (rgb[:, :, 2] >= rgb[:, :, 0] + 4)

    h, w = alpha.shape
    keep = alpha.copy()
    queue: deque = deque()

    def exposed(y: int, x: int) -> bool:
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or nx < 0 or ny >= h or nx >= w or not keep[ny, nx]:
                return True
        return False

    for y in range(h):
        for x in range(w):
            if keep[y, x] and shadowish[y, x] and exposed(y, x):
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        if not keep[y, x]:
            continue
        keep[y, x] = False
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and keep[ny, nx] and shadowish[ny, nx]:
                queue.append((ny, nx))

    removed = int((alpha & ~keep).sum())
    if removed > PEEL_MAX:
        raise SystemExit(
            f"the shadow peel removed {removed} px, past the {PEEL_MAX} px cap. "
            "It eats inward from the silhouette through anything light and cool, "
            "so a runaway means a light region of the character - the box lid "
            "above all - is now exposed at the edge and reading blue. Look at "
            "the cut-out before raising the cap."
        )
    out = np.asarray(img).copy()
    out[:, :, 3] = np.where(keep, out[:, :, 3], 0)
    return Image.fromarray(out, "RGBA")


def assert_interior_intact(img: Image.Image) -> None:
    """The enclosed paper regions must survive BOTH the fill and the peel.

    Taken on the finished cut-out, because the peel runs after the fill and can
    eat the same regions from the other side.
    """
    a = np.asarray(img)
    alpha = a[:, :, 3] > 0
    rgb = a[:, :, :3].astype(int)
    interior = int((alpha & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 20) & (rgb.max(axis=2) >= 200)).sum())
    if interior < INTERIOR_PAPER:
        raise SystemExit(
            f"an enclosed light region of the character has been eaten: {interior} "
            f"paper-coloured pixels survive, against {INTERIOR_PAPER} expected. "
            "The box lid, a glove, an eye white or the smile's teeth has a hole "
            "in it - the fill leaked inward, or the peel ran in from the edge."
        )


def cut_character(sheet: Image.Image) -> Image.Image:
    """The delivery character on transparency, tight-cropped."""
    crop = sheet.crop(DELIVERY_BOX).convert("RGB")
    a = np.asarray(crop).astype(int)
    background = flood_background(a)
    rgba = np.dstack([a, np.where(background, 0, 255)]).astype(np.uint8)
    out = peel_shadow_fringe(keep_character(Image.fromarray(rgba, "RGBA")))
    assert_interior_intact(out)
    bbox = out.getbbox()
    if bbox is None:
        raise SystemExit("the crop is empty - the crop box or the sheet changed")
    return out.crop(bbox)


def max_radius(img: Image.Image) -> float:
    """The farthest any opaque pixel sits from the image's own centre.

    For FITTING, where the art is always on transparency. `content_radius`
    is the one to use for CHECKING a grounded asset.
    """
    ys, xs = np.nonzero(np.asarray(img)[:, :, 3])
    if len(ys) == 0:
        return 0.0
    cy, cx = (img.height - 1) / 2, (img.width - 1) / 2
    return float(np.sqrt((ys - cy) ** 2 + (xs - cx) ** 2).max())


def scaled(art: Image.Image, factor: float) -> Image.Image:
    size = (max(1, round(art.width * factor)), max(1, round(art.height * factor)))
    return art.resize(size, Image.LANCZOS)


def art_mask(img: Image.Image, ground=None) -> np.ndarray:
    """Which pixels are the character rather than the ground behind it."""
    a = np.asarray(img)
    if ground is None:
        return a[:, :, 3] > 0
    return (np.abs(a[:, :, :3].astype(int) - np.array(ground)).sum(axis=2) > 24) & (a[:, :, 3] > 0)


def on_canvas(art: Image.Image, canvas: int, ground=None) -> Image.Image:
    base = Image.new("RGBA", (canvas, canvas), (*ground, 255) if ground else (0, 0, 0, 0))
    base.alpha_composite(art, ((canvas - art.width) // 2, (canvas - art.height) // 2))
    # THE ART MUST FIT THE FILE IT IS WRITTEN INTO. Every `MASK_LIMITS` allowance
    # is derived from the same constant its fit is expressed in, and
    # `content_radius` saturates at the canvas half-diagonal, so a span or
    # diameter over 1.0 grows the allowance along with the art and clipping by the
    # CANVAS EDGE is invisible to all of them. Measured: `SPLASH_CIRCLE = 1.40`
    # trips the splash-mask guard, whose message says to lower `imageWidth` - and
    # doing exactly what it says returns exit 0 with 1123 opaque pixels on the
    # border, the cap's crown and both shoes cut off. The favicon had no geometry
    # assertion at all, so its span alone cropped it to a fragment.
    #
    # Asserted HERE because both fit functions end here, so it covers all five
    # assets and any added later without a second registration to forget.
    border = np.zeros((canvas, canvas), bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    touching = int((art_mask(base, ground) & border).sum())
    if touching:
        raise SystemExit(
            f"the fitted art touches its own {canvas}px canvas border at {touching} "
            "pixel(s), so the file itself crops it - the cap's crown and the shoes go "
            "first. A span or diameter above 1.0 does this, and no mask limit can see "
            "it because every allowance is derived from the same constant as the fit."
        )
    return base


def span_fit(art: Image.Image, canvas: int, span: float, ground=None) -> Image.Image:
    """Scaled so its longest side spans `span` of the canvas. For surfaces that
    are not masked to a circle."""
    return on_canvas(scaled(art, (canvas * span) / max(art.size)), canvas, ground)


def circle_fit(art: Image.Image, canvas: int, diameter: float, ground=None) -> Image.Image:
    """Scaled so every opaque pixel lands inside a centred circle of
    `diameter` x the canvas. The test is the content's RADIUS, which is the
    only one a circular mask respects.

    Scaling once and trusting the arithmetic is not enough: Lanczos leaves a
    faint halo beyond the original edge, so the result lands OUTSIDE the circle
    it was computed to fit - measured at 1.51% over on the first pass for the
    adaptive fit, and 1.60% for the splash. It is re-measured and shrunk until
    it actually fits. Not a rounding detail: 1.51% of the guaranteed circle is
    the band the cap and the shoes sit in.
    """
    target = canvas * diameter / 2 * FIT_MARGIN
    here = max_radius(art)
    if here <= 0:
        raise SystemExit("the art is empty")
    factor = target / here
    for _ in range(8):
        fitted = scaled(art, factor)
        got = max_radius(fitted)
        if got <= target:
            return on_canvas(fitted, canvas, ground)
        factor *= target / got * 0.999
    raise SystemExit("could not fit the art inside its mask circle")


# Everything lighter than this is knocked OUT of the themed icon, so the eye
# whites, the smile's teeth, the gloves and the box lid read as negative space.
#
# MEASURED over the fitted adaptive art, with the partitions STATED so the
# numbers are checkable - an earlier version of this comment gave figures by
# "hue" without saying which bands, which made it unfalsifiable, and two of the
# three did not survive being measured under any partition I could state:
#
#   red        r>150 and r>g+60 and r>b+60   50,814 px  mean luma 103.7  99.9% kept
#   near-white min(r,g,b) >= 225              9,633 px  mean luma 248.3   0.0% kept
#   warm mid   120<=luma<=235, r>b+20,       31,477 px  mean luma 205.9  23.2% kept
#              excluding the red band
#
# So: the red of the cap and shoes is kept almost entirely - 99.9%, not "entirely",
# the 0.06% removed being a few of the lightest highlight pixels and invisible at
# any launcher size. The near-whites go completely, which is the point. And the
# cheese and crust STRADDLE the line, which is not a side effect - it IS the
# speckled texture that reads as a pizza. Only the crust rim is reliably solid.
GLYPH_KNOCKOUT_LUMA = 200


def themed_glyph(art: Image.Image, canvas: int, diameter: float) -> Image.Image:
    """Android's themed ("monochrome") icon: one shape the system recolours.

    THREE TREATMENTS WERE RENDERED AT 72, 108 AND 192 dp - the sizes a launcher
    actually draws - before this one was chosen, because the obvious two both
    fail at opposite ends:

      * A SILHOUETTE fills the shape and erases the face, so it reads as an
        anonymous blob with the cap merged into the head at every size.
      * THE OUTLINES ALONE are legible at 192 dp and wash out to a few grey
        threads at 72, which is the size that matters most.

    So: solid, with the light areas knocked out. It keeps the weight that makes
    a tinted icon visible while the eyes, the smile and the box lid punch
    through as holes and carry the recognition. Same art; nothing invented.
    """
    fitted = circle_fit(art, canvas, diameter)
    a = np.asarray(fitted).astype(int)
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    luma = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    out = np.zeros(a.shape, np.uint8)
    out[:, :, 0], out[:, :, 1], out[:, :, 2] = INK
    out[:, :, 3] = np.where((alpha > 0) & (luma <= GLYPH_KNOCKOUT_LUMA), 255, 0)
    return Image.fromarray(out, "RGBA")


def derive(art: Image.Image) -> dict:
    # EVERY SURFACE GETS THE WHOLE CHARACTER. A head-and-cap crop was tried
    # first, to give the 48 px favicon and the themed icon more to read - and
    # there is no such crop. The pizza box overlaps the lower right of the
    # pizza circle, so a rectangle either slices the face (the first attempt
    # cut it at the mouth) or drags in a fragment of the box that reads as a
    # smear at 48 px. Measured at actual size, the whole character is legible
    # enough there, and it is the same mark on every surface.
    return {
        # The square icon: iOS, and Expo's general fallback. Masked to a
        # rounded rectangle, so it is fitted by span rather than by radius.
        "assets/images/icon.png": span_fit(art, 1024, ICON_SPAN, CREAM),
        # Android adaptive. Only the foreground is a file: the ground behind it
        # is `adaptiveIcon.backgroundColor` in `app.json`, and shipping a flat
        # PNG of the same colour as well would be the same fact in two places.
        "assets/images/android-icon-foreground.png": circle_fit(art, 1024, ADAPTIVE_FIT),
        "assets/images/android-icon-monochrome.png": themed_glyph(art, 1024, ADAPTIVE_FIT),
        # The web favicon, at the size a tab renders.
        "assets/images/favicon.png": span_fit(art, 48, 0.92, CREAM),
        # The splash mark. Derived at 1024 because Expo scales this file to
        # `imageWidth` per density, and at xxxhdpi it was being scaled UP from
        # 512 - a second upscale on top of the one from the sheet.
        "assets/images/splash-icon.png": circle_fit(art, 1024, SPLASH_CIRCLE),
    }


# What each asset must fit inside, and against what. Re-asserted on every run:
# the spans above are INPUTS, this is the property that must come out.
#
# `content` says how to find the art: `None` means "opaque alpha", a colour
# means "pixels that differ from this ground" - `icon.png` is fully opaque, so
# an alpha-based radius there would measure its corners and prove nothing.
# Derived from the constant, so widening the fact cannot leave the message
# claiming a circle nobody is asserting.
GUARANTEED_CIRCLE_WHY = (
    f"the {ANDROID_GUARANTEED * 108:.0f}dp circle Android GUARANTEES a launcher shows"
)

MASK_LIMITS = {
    "assets/images/android-icon-foreground.png": (
        ANDROID_GUARANTEED, None, GUARANTEED_CIRCLE_WHY, True,
    ),
    "assets/images/android-icon-monochrome.png": (
        ANDROID_GUARANTEED, None, GUARANTEED_CIRCLE_WHY, True,
    ),
    # prebuild renders `ic_launcher_round` from this file with
    # `borderRadiusRatio: 0.5` - a full circle crop - and the manifest sets
    # `android:roundIcon`. The adaptive icon wins on API 26+, so this is a
    # backstop rather than the main path, but without it `ICON_SPAN` can be
    # raised past ~0.855 and silently clip the round variant.
    # The fourth element says whether `circle_fit` produced this asset, and so
    # whether `FIT_MARGIN` applies to it. `icon.png` is `span_fit`, which the
    # margin never touches - the shared failure message used to assert the margin
    # for it anyway, claiming a 0.6 px overshoot could not be "a resampler moving
    # an edge by a fraction of a pixel" when that is exactly what it would be.
    "assets/images/icon.png": (
        1.0, CREAM, "prebuild's round-icon crop (generateRoundIconAsync)", False,
    ),
    # The splash mark had the doctrine's COMMENT and not its mechanism. Its fit
    # was asserted only by `check_splash_fits_its_mask`, which recomputes
    # `SPLASH_CIRCLE * imageWidth` from the CONSTANT and never looks at the
    # pixels - so editing `derive`'s call site to `circle_fit(art, 1024, 1.40)`,
    # one token with the constant untouched, put the mark 248.9dp across a 192dp
    # mask while `--check` stayed green and the splash check went on reporting
    # 171dp. That is exactly the one-symbol failure the ANDROID_GUARANTEED /
    # ADAPTIVE_FIT split above exists to prevent, and the fix is the same: a
    # limit measured against the OUTPUT.
    "assets/images/splash-icon.png": (
        SPLASH_CIRCLE, None, "Android's 192dp splash mask, at this asset's own canvas", True,
    ),
}


def content_radius(img: Image.Image, ground=None) -> float:
    """The farthest the ART sits from the image's centre.

    With a `ground`, "art" is what differs from it - the only meaningful
    measure on a fully opaque asset.
    """
    a = np.asarray(img)
    if ground is None:
        mask = a[:, :, 3] > 0
    else:
        mask = (np.abs(a[:, :, :3].astype(int) - np.array(ground)).sum(axis=2) > 24) & (a[:, :, 3] > 0)
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        return 0.0
    cy, cx = (img.height - 1) / 2, (img.width - 1) / 2
    return float(np.sqrt((ys - cy) ** 2 + (xs - cx) ** 2).max())


def check_masks(assets: dict) -> None:
    for rel, (limit, ground, why, circle_fitted) in MASK_LIMITS.items():
        if rel not in assets:
            raise SystemExit(
                f"MASK_LIMITS names {rel}, which `derive` does not produce - the two "
                "lists have drifted apart, so that asset is asserted against nothing"
            )
        img = assets[rel]
        allowed = img.width * limit / 2
        have = content_radius(img, ground)
        if have > allowed:
            raise SystemExit(
                f"{rel} would be clipped by {why}: its content reaches "
                f"{have:.1f} px from the centre, and only {allowed:.1f} px survives."
                + (
                    f" `circle_fit` aims {(1 - FIT_MARGIN) * 100:.1f}% inside that, so this is "
                    "a real widening and not a resampler moving an edge by a fraction of a "
                    "pixel." if circle_fitted else
                    " This asset is fitted by SPAN, so no `FIT_MARGIN` headroom applies - "
                    "check `ICON_SPAN` before suspecting the resampler."
                )
            )


# Android draws the splash icon on a 288dp canvas of which a 192dp circle
# survives when no icon background is set (the plugin exposes no prop for one).
# Expo scales THIS asset to `imageWidth` and centres it there, so the asset's
# own canvas says nothing - the constraint is a product of a number in this
# file and a number in `app.json`, and until both are read together nothing
# was checking it.
SPLASH_MASK_DP = 192
# Checked against a literal for the same reason `ANDROID_GUARANTEED` is: this is a
# PLATFORM FACT read by nothing but the assertion below, so widening it is a
# one-token way to silence a refusal instead of fixing the width. Measured: at
# `SPLASH_MASK_DP = 400` an `imageWidth` of 400 passed with exit 0.
if SPLASH_MASK_DP > 192:
    raise SystemExit(
        f"SPLASH_MASK_DP has been widened to {SPLASH_MASK_DP}. Android's splash mask "
        "keeps 192dp of a 288dp canvas when no icon background is set; that is a fact "
        "about the platform, not a knob. Lower `imageWidth` instead."
    )

# expo-splash-screen's own default when `imageWidth` is omitted
# (`getAndroidSplashConfig`: `root.imageWidth ?? 100`). An omitted width is a
# legal, comfortably-safe config, not a fault.
SPLASH_DEFAULT_WIDTH = 100


def as_dict(value: object) -> dict:
    """`value` if it is a mapping, otherwise an empty one.

    EVERY hop into `app.json` goes through this. `x.get(k, {})` defaults only on
    a MISSING key and `x.get(k) or {}` only on a FALSY one, so both still
    traceback on the shapes a hand-edited config really produces -
    `"android": "x"`, `"adaptiveIcon": [1]`, `"expo": null`. The round-4 fix used
    the second form and left eight such shapes raising, including `expo: null`
    one level above the three it closed.
    """
    return value if isinstance(value, dict) else {}


def load_app_config() -> tuple[dict, list[str]]:
    """`app.json`'s `expo` block, with any reason it could not be read.

    Read ONCE and passed to every check. It used to be parsed twice with two
    different error dispositions, which is how a MISSING app.json tracebacked
    out of the first reader while `main()` had a handler for it further down.
    """
    try:
        raw = json.loads((MOBILE / "app.json").read_text(encoding="utf-8"))
    except OSError as exc:
        return {}, [f"app.json could not be read: {exc}"]
    except ValueError as exc:
        return {}, [f"app.json is not valid JSON: {exc}"]
    expo = as_dict(raw).get("expo")
    if not isinstance(expo, dict):
        return {}, ["app.json carries no `expo` object"]
    return expo, []


def splash_plugin_props(app: dict) -> list[dict]:
    """Every expo-splash-screen entry's props, tolerating each legal shape.

    A plugin may be a bare string, a one-element array, or carry `null` or a
    non-object in the second slot. None of those is this script's business to
    refuse - it reports, it does not raise.
    """
    out: list[dict] = []
    for plugin in (app.get("plugins") if isinstance(app.get("plugins"), list) else []):
        if isinstance(plugin, str) and plugin == "expo-splash-screen":
            out.append({})
        elif isinstance(plugin, list) and plugin and plugin[0] == "expo-splash-screen":
            props = plugin[1] if len(plugin) > 1 else None
            out.append(props if isinstance(props, dict) else {})
    return out


def effective_splash_width(props: dict) -> float | None:
    """The width Android uses, or None if this config does not state one plainly.

    SIMPLER THAN MODELLING EXPO, and stricter. This used to reproduce JS
    `Number()` coercion so it could judge a width Expo might receive as a string,
    and that emulation was the single highest-defect-density thing in this file -
    four review rounds found divergences in it, in both directions, including one
    that let a config whose Android drawable Expo generates BROKEN pass by
    silence. The emulation existed to be faithful to inputs this project never
    needs to write.

    So the rule is now: `imageWidth` must be a plain JSON number, at the top
    level, positive and finite. `check_denied_keys` refuses every platform-nested
    splash key, so there is no `android.imageWidth` to resolve against, and a
    string, a bool, a list or a null is REFUSED rather than coerced. That is
    strictly stronger than the emulation - every input the emulation accepted and
    Expo honoured is still expressible as a number - and it cannot diverge from a
    language it no longer models.

    An ABSENT `imageWidth` still means 100: that is the plugin's documented
    default (`root.imageWidth ?? 100` in `getAndroidSplashConfig.js`), so it is a
    real width rather than a missing one.
    """
    if "imageWidth" not in props:
        return float(SPLASH_DEFAULT_WIDTH)
    width = props["imageWidth"]
    if isinstance(width, bool) or not isinstance(width, (int, float)):
        return None
    try:
        width = float(width)
    except OverflowError:
        # `json.loads` yields arbitrary-precision ints, so `float()` raises on a
        # 400-digit one. Validating the TYPE and then coercing before testing
        # finiteness reintroduced the traceback class this function was rewritten
        # to end - the third time in this one function.
        return None
    if not math.isfinite(width) or width <= 0:
        return None
    return width


def check_splash_fits_its_mask(app: dict) -> list[str]:
    """Every splash entry's mark must fit Android's circular splash mask."""
    problems: list[str] = []
    entries = splash_plugin_props(app)
    if not entries:
        return ["app.json declares no expo-splash-screen plugin"]
    for props in entries:
        width = effective_splash_width(props)
        if width is None:
            problems.append(
                f"app.json's splash imageWidth is {props.get('imageWidth')!r}, "
                "which is not a plain positive number. Expo multiplies it per "
                "density, so anything else generates a broken drawable"
            )
            continue
        reach = SPLASH_CIRCLE * width
        if reach > SPLASH_MASK_DP:
            problems.append(
                f"the splash mark reaches {reach:.0f}dp across, and Android's splash "
                f"mask keeps {SPLASH_MASK_DP}dp: lower imageWidth to "
                f"{int(SPLASH_MASK_DP / SPLASH_CIRCLE)} or less"
            )
    return problems


# Which `app.json` field points at each derived file, as a key path under `expo`.
# The splash mark is not here because it lives in the plugin's props, not under
# `expo` - `check_declared_paths` reads it from `splash_plugin_props`.
#
# WHY THIS EXISTS. The premise of the whole check is that an icon replaced BY
# HAND reds CI. The other way an icon gets replaced is by REPOINTING `app.json`,
# and nothing read the paths: setting all five fields to files that do not exist
# printed five `ok` and exited 0. Three of the five (`foregroundImage`,
# `monochromeImage`, the splash `image`) are reached by no CI step in either
# workflow, because neither runs `expo prebuild` - so nothing else would have
# caught them either, and a wrong-but-EXISTING path is invisible to every step
# regardless.
DECLARED_BY = {
    "assets/images/icon.png": ("icon",),
    "assets/images/favicon.png": ("web", "favicon"),
    "assets/images/android-icon-foreground.png": ("android", "adaptiveIcon", "foregroundImage"),
    "assets/images/android-icon-monochrome.png": ("android", "adaptiveIcon", "monochromeImage"),
}
SPLASH_ASSET = "assets/images/splash-icon.png"


def declared_path(app: dict, keys: tuple[str, ...]) -> object:
    """Walk a key path, tolerating any shape on the way down."""
    node: object = app
    for key in keys:
        node = as_dict(node).get(key)
    return node


def one_declared_path(rel: str, field: str, got: object) -> list[str]:
    """Compare one declared path against the file this script derives for it."""
    if got is None:
        return [f"app.json declares no `{field}`, so nothing points at {rel}"]
    if not isinstance(got, str):
        return [f"app.json's `{field}` is {got!r}, which is not a path"]
    norm = got[2:] if got.startswith("./") else got
    if norm != rel:
        return [
            f"app.json's `{field}` points at `{got}`, but this script derives "
            f"`{rel}` for that surface. Repointing the config is the other way an "
            "icon gets replaced, and comparing pixels cannot see it."
        ]
    if not (MOBILE / rel).exists():
        return [f"app.json's `{field}` points at `{got}`, which does not exist"]
    return []


# Keys SDK 56 honours that would override or bypass one of the five fields above.
# Checking the five was not enough: 14 repointings passed `--check` green, and the
# sharpest of them are keys THIS COMMIT DELETES - re-adding `ios.icon`,
# `adaptiveIcon.backgroundImage` or the splash `android: { image }` nesting
# restores the pre-commit asset with every path assertion still passing.
#
# A DENY-LIST rather than a mirror of Expo's resolution order, deliberately. This
# project derives exactly five files and wants none of these keys at all, so
# refusing their PRESENCE is both stronger than reproducing the precedence rules
# and immune to the plugin changing them. EVERY platform-nested splash key is
# refused, `android.imageWidth` included: it must be declared once, at the top
# level, as a plain JSON number. This comment used to say that key stayed legal
# because `effective_splash_width` modelled it faithfully; both halves stopped
# being true when that emulation was deleted.
DENIED_EXPO_KEYS = {
    ("ios", "icon"): "overrides the top-level `icon` this script derives",
    ("android", "icon"): "overrides the top-level `icon` this script derives",
    ("android", "adaptiveIcon", "backgroundImage"):
        "overrides `adaptiveIcon.backgroundColor`, and the flat background PNG was "
        "deleted in this change precisely because the colour is the single source",
}
# Inside the splash plugin's props: any asset or colour key, and anything nested
# under a platform or theme block except `imageWidth`.
DENIED_SPLASH_KEYS = {
    # `getIosSplashConfig` reads both of these from the plugin's TOP level, and
    # `withIosSplashAssets` emits `tablet_image.png` at 1x/2x with an `idiom: ipad`
    # entry - so they are a real iPad asset and a real iPad background, not inert.
    # The asymmetry that gave them away: `dark.tabletImage` WAS already refused by
    # the platform-block loop below, so the dark iPad variant was guarded while the
    # light one was not, and `tabletBackgroundColor: "#ffffff"` re-created on iPad
    # exactly the launch flash `animated-icon.tsx` names this check as preventing.
    "tabletImage": "is an iPad splash asset this script does not derive",
    "tabletBackgroundColor": "is an iPad splash background, and the ground colour has one home",
    "drawable": "bypasses `image` entirely - the plugin copies it verbatim with no resize",
    "mdpi": "is a per-density override of `image`",
    "hdpi": "is a per-density override of `image`",
    "xhdpi": "is a per-density override of `image`",
    "xxhdpi": "is a per-density override of `image`",
    "xxxhdpi": "is a per-density override of `image`",
}
SPLASH_PLATFORM_BLOCKS = ("android", "ios", "dark")


def check_denied_keys(app: dict) -> list[str]:
    """Refuse any key that would point a surface somewhere this script does not."""
    problems: list[str] = []
    for keys, why in DENIED_EXPO_KEYS.items():
        parent = app
        for key in keys[:-1]:
            parent = as_dict(parent).get(key)
        if keys[-1] in as_dict(parent):
            problems.append(f"app.json declares `expo.{'.'.join(keys)}`, which {why}")
    for props in splash_plugin_props(app):
        for key, why in DENIED_SPLASH_KEYS.items():
            if key in props:
                problems.append(f"the expo-splash-screen plugin declares `{key}`, which {why}")
        for block in SPLASH_PLATFORM_BLOCKS:
            for key in as_dict(props.get(block)):
                problems.append(
                    f"the expo-splash-screen plugin declares `{block}.{key}`; the plugin "
                    f"spreads that block over the top level, so it overrides `{key}` "
                    "invisibly. Declare it at the top level instead."
                )
    return problems


def check_declared_paths(app: dict) -> list[str]:
    """Every derived file must be the one `app.json` actually points at."""
    problems: list[str] = []
    for rel, keys in DECLARED_BY.items():
        problems += one_declared_path(rel, "expo." + ".".join(keys), declared_path(app, keys))
    entries = splash_plugin_props(app)
    if not entries:
        problems.append("app.json declares no expo-splash-screen plugin, so nothing points at " + SPLASH_ASSET)
    for props in entries:
        problems += one_declared_path(
            SPLASH_ASSET, "expo-splash-screen `image`", props.get("image")
        )
    problems += check_denied_keys(app)
    # Only `app.json` is read, and Expo PREFERS a dynamic config when one exists
    # (`@expo/config` Config.js), which would make every assertion above vacuous.
    # None exists here; this refuses one appearing unnoticed.
    # Every extension in `@expo/config`'s DYNAMIC_CONFIG_EXTS, plus .json. `.tsx`
    # is deliberately absent: Expo does not read one.
    for name in ("app.config.ts", "app.config.mts", "app.config.cts",
                 "app.config.js", "app.config.mjs", "app.config.cjs",
                 "app.config.json"):
        if (MOBILE / name).exists():
            problems.append(
                f"{name} exists, and Expo prefers a dynamic config over app.json - "
                "every path checked above may be overridden there. Teach this script "
                "to read it before shipping one."
            )
    return problems


def check_colours_agree(app: dict) -> list[str]:
    """`app.json`, `theme.ts` and this file each spell the palette out.

    None of the three can import another - `app.json` is JSON and will never
    import a token - so the only thing keeping them equal is that something
    checks. This is that something. It reports every disagreement it finds
    rather than raising on the first, and it treats a shape it does not
    recognise as a problem to NAME, never as a traceback.
    """
    problems: list[str] = []
    theme_path = MOBILE / "src" / "constants" / "theme.ts"
    if not theme_path.exists():
        return [f"theme.ts is missing at {theme_path}"]
    try:
        theme = theme_path.read_text(encoding="utf-8")
    except (OSError, ValueError) as exc:
        # The same guard `load_app_config` got in round 5, on the reader that
        # makes the same promise. A `theme.ts` saved as cp1252 (one em-dash typed
        # in the wrong editor) raised UnicodeDecodeError straight through the
        # docstring above.
        return [f"theme.ts could not be read: {exc}"]
    # Either quote style: a formatter changing them is not a palette change,
    # and reporting it as "no such token" would name the wrong cause.
    # Line-anchored and comment-skipping. An unanchored search takes the first
    # match anywhere, and this file already carries hexes in prose ("`bg-[#f7f3ed]`
    # - the warm cream"), so a note like `// cream: '#faf7f0' was rejected` would
    # red CI with a disagreement that does not exist.
    #
    # BOTH comment styles, and the block one is the one that mattered: `theme.ts`
    # contains ZERO `//` lines and comments exclusively in `/** */` blocks, so a
    # //-only filter was dead on the very file it guards. Measured: a commented-out
    # `/* cream: '#faf7f0', ink: '#000000', */` above the real declarations
    # produced two FALSE failures. Spans are stripped before the line split, so a
    # block opened and closed on different lines is covered.
    stripped = re.sub(r"/\*.*?\*/", "", theme, flags=re.S)
    lines = [ln for ln in stripped.splitlines() if not ln.lstrip().startswith("//")]
    for token, want in (("cream", CREAM), ("ink", INK)):
        hexed = "#%02x%02x%02x" % want
        # EVERY match, not the first. This is text matching, not parsing, so a
        # line inside a template literal or a string can look exactly like a
        # declaration - and stopping at the first one let a DECOY silence the
        # check: with `cream: '#ff0000'` as the real palette and a
        # correct-looking `cream: '#f7f3ed',` inside an exported template
        # literal above it, the guard whose only job is detecting divergence
        # exited 0. Collecting all of them and reporting if ANY disagrees fails
        # LOUD instead: a decoy now causes a false alarm someone reads, rather
        # than a true divergence nobody sees. That direction is the whole point.
        found = []
        unquoted = False
        for ln in lines:
            m = re.match(rf"""\s*\[?['"]?{token}['"]?\]?\s*:\s*['"]([^'"]+)['"]""", ln)
            if m:
                found.append(m.group(1))
                continue
            # The token is THERE but its value is not a quoted literal - a
            # reference (`cream: Brand.cream`) or a constant. Saying "declares no
            # token" would send the reader looking for a missing line.
            if re.match(rf"""\s*\[?['"]?{token}['"]?\]?\s*:""", ln):
                unquoted = True
        if len(set(d.lower() for d in found)) > 1:
            problems.append(
                f"theme.ts declares `{token}` more than once with different values "
                f"({', '.join(sorted(set(found)))}) - this script cannot tell which one "
                "the app reads, so make the others not look like declarations"
            )
            continue
        # Past that branch every collected value is equal, so the first is the one.
        declared = found[0] if found else None
        if declared is None and unquoted:
            problems.append(
                f"theme.ts declares `{token}` but not as a quoted hex literal, so "
                "this script cannot compare it"
            )
        elif declared is None:
            problems.append(f"theme.ts declares no `{token}` token")
        elif not re.fullmatch(r"#[0-9a-fA-F]{6}", declared):
            # The token EXISTS; saying it does not would name the wrong cause.
            problems.append(
                f"theme.ts {token} is `{declared}`, which this script cannot compare - "
                f"it expects a 6-digit hex like {hexed}"
            )
        elif declared.lower() != hexed:
            problems.append(f"theme.ts {token} is {declared}, this script's is {hexed}")

    cream = "#%02x%02x%02x" % CREAM
    # `as_dict` at every hop. Not because Expo tolerates these shapes - for the
    # ICON path it does optional-chain them, but `getAndroidSplashConfig` spreads
    # `...android.dark` and so THROWS outright on `"android": null`. The reason is
    # about THIS script: it runs FIRST in `main()`, so a traceback here is what a
    # developer hits instead of the report its docstring promises. Whether Expo
    # would also fail is a separate question from whether this reports honestly.
    adaptive = as_dict(as_dict(app.get("android")).get("adaptiveIcon")).get("backgroundColor")
    if not isinstance(adaptive, str):
        problems.append("app.json declares no android.adaptiveIcon.backgroundColor")
    elif adaptive.lower() != cream:
        problems.append(f"app.json adaptiveIcon.backgroundColor is {adaptive}, expected {cream}")

    splash_seen = False
    for plugin in (app.get("plugins") if isinstance(app.get("plugins"), list) else []):
        # A plugin may legally be a bare string; only the pair form carries props.
        if not (isinstance(plugin, list) and plugin and plugin[0] == "expo-splash-screen"):
            continue
        splash_seen = True
        props = plugin[1] if len(plugin) > 1 and isinstance(plugin[1], dict) else {}
        splash = props.get("backgroundColor")
        if not isinstance(splash, str):
            problems.append("app.json's splash plugin declares no backgroundColor")
        elif splash.lower() != cream:
            problems.append(f"app.json splash backgroundColor is {splash}, expected {cream}")
    if not splash_seen:
        problems.append("app.json declares no expo-splash-screen plugin with props")

    return problems


def same_pixels(path: Path, img: Image.Image) -> bool:
    """Whether the committed file RENDERS as this image.

    Alpha, and colour only where the pixel is visible. A comparison that
    included the colour under a fully transparent pixel would report drift for
    any PNG optimiser that normalises it - a change nothing can see.

    BUT an EMBEDDED ICC PROFILE is a change something can see: it re-maps every
    colour on a colour-managed surface while leaving the raw samples identical,
    so a pixel comparison passes it. So the profile and the pixel format are
    compared too. That is the boundary of this function: it pins what RENDERS,
    which is deliberately weaker than byte-identity (nothing in CI asserts the
    committed bytes) and no longer weaker than the profile.
    """
    opened = Image.open(path)
    # The PROFILE, not the mode. An embedded ICC profile re-maps every colour on a
    # colour-managed surface while leaving the samples identical, so a pixel
    # comparison passes it - that is a real rendering change and is compared. The
    # MODE is not: `icon.png` and `favicon.png` are fully opaque, so oxipng and
    # pngcrush reduce them RGBA -> RGB by default and the result renders
    # byte-identically once converted back. Comparing mode rejected exactly the
    # "any PNG optimiser" re-encode this docstring claims immunity to.
    if opened.info.get("icc_profile") != img.info.get("icc_profile"):
        return False
    have = opened.convert("RGBA")
    if have.size != img.size:
        return False
    a, b = np.asarray(have).astype(int), np.asarray(img.convert("RGBA")).astype(int)
    if not np.array_equal(a[:, :, 3], b[:, :, 3]):
        return False
    visible = a[:, :, 3] > 0
    return bool(np.array_equal(a[:, :, :3][visible], b[:, :, :3][visible]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify without writing")
    args = ap.parse_args()

    if not SHEET.exists():
        print("FAIL: the mascot sheet is missing: " + str(SHEET), file=sys.stderr)
        return 1
    digest = sha256(SHEET)
    if digest != SHEET_SHA256:
        print(
            "FAIL: the mascot sheet is not the one the crop box was measured on.\n"
            "  expected " + SHEET_SHA256 + "\n  found    " + digest + "\n"
            "  Re-measure DELIVERY_BOX against the new sheet before re-running.",
            file=sys.stderr,
        )
        return 1

    # ONE read, handed to every check below. Parsing it twice is what gave the
    # missing-file case two different dispositions, so it tracebacked out of the
    # first reader while the handler for it sat further down.
    app_config, unreadable = load_app_config()
    if unreadable:
        print("FAIL: app.json could not be read as an Expo config:", file=sys.stderr)
        for p in unreadable:
            print("  " + p, file=sys.stderr)
        return 1

    problems = check_colours_agree(app_config)
    if problems:
        print("FAIL: the ground colour is spelled differently in different places:", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        return 1

    # Its own header: comparing PIXELS cannot see a repointed path, so this is a
    # different failure from drift and reads as one.
    pointing = check_declared_paths(app_config)
    if pointing:
        print("FAIL: app.json does not point at the files this script derives:", file=sys.stderr)
        for p in pointing:
            print("  " + p, file=sys.stderr)
        return 1

    # Its own header: a geometry failure printed under a colour heading sends
    # the reader to look at the wrong thing.
    geometry = check_splash_fits_its_mask(app_config)
    if geometry:
        print("FAIL: the splash mark does not fit Android's splash mask:", file=sys.stderr)
        for p in geometry:
            print("  " + p, file=sys.stderr)
        return 1

    assets = derive(cut_character(Image.open(SHEET)))
    check_masks(assets)

    drift = 0
    for rel, img in assets.items():
        path = MOBILE / rel

        if args.check:
            if not path.exists():
                print("MISSING " + rel)
                drift += 1
                continue
            same = same_pixels(path, img)
            print(("ok      " if same else "DRIFT   ") + rel)
            drift += 0 if same else 1
        else:
            # Encoded HERE, not above: `--check` compares pixels, never bytes, so
            # encoding for it burnt four 1024-square `optimize=True` passes per run
            # (every asset but the 48 px favicon) and threw every byte away.
            buf = io.BytesIO()
            img.save(buf, "PNG", optimize=True)
            new = buf.getvalue()
            path.parent.mkdir(parents=True, exist_ok=True)
            unchanged = path.exists() and path.read_bytes() == new
            path.write_bytes(new)
            verb = "unchanged" if unchanged else "wrote    "
            print(f"{verb} {rel}  {img.size[0]}x{img.size[1]}  {len(new)}B")
    if args.check and drift:
        print(
            f"\n{drift} file(s) differ from what this script derives. "
            "Re-run `python scripts/derive-icon.py` and commit the result.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
