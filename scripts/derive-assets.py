#!/usr/bin/env python3
"""Derive per-item image assets from the generated contact sheets.

`domain_spec/imagery-and-iconography` (tenant `pizzeria`) states the rule this
script implements:

    Sheets are SOURCES, not assets. Per-item files are derived from a sheet by a
    committed, re-runnable step that records the crop box for each cell. A
    hand-cropped image nobody can reproduce becomes unmaintainable the first
    time the menu changes.

So: sheets in `design/sources/` go in, per-item files under `assets/menu/` and
`assets/icons/` come out, and `assets/manifest.json` records every crop box,
every binding and every status.

WHAT THIS SCRIPT WILL NOT DO, because the spec forbids it:

  * guess a binding by name similarity. The sheet order IS the binding — cell N
    of the pizza sheet is the menu item whose `number` is N — and the printed
    caption is used only to VERIFY that, never to search with. A caption that
    disagrees with the menu aborts the run.
  * mark anything `confirmed`. That status means a human looked at the picture
    beside the dish. This script writes `candidate`; a person promotes it, and
    a re-run keeps that promotion only while the file's bytes are unchanged.

Usage:
    python scripts/derive-assets.py --dry-run     # print the plan, write nothing
    python scripts/derive-assets.py               # derive + write the manifest
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

MOBILE = Path(__file__).resolve().parent.parent
SOURCES = MOBILE / "design" / "sources"
MENU_JSON = MOBILE.parent / "backend" / "data" / "menu.json"

# The captions printed on each sheet, in sheet order. These are the VERIFICATION
# oracle, not the lookup key: the run aborts if they disagree with the menu.
PIZZA_CAPTIONS = [
    "MARGHERITA", "CIPOLLA", "NAPOLI", "DIAVOLO", "SALAMI", "QUATTRO FORMAGGI",
    "PROSCIUTTO", "FUNGHI", "TOSCANA", "HAWAII", "MARINARA", "MIMMO",
    "CALZONE", "DON CAMILLO", "QUATTRO STAGIONI", "CAPRICCIOSA", "OZEANO",
    "MAMMA MIA", "GAMBERETTI", "PEPONE", "SANDRO`S SPEZIAL", "ROMINO`S",
    "SICILIANO", "VENEZIA", "FIRENZE", "SPAGHETTI", "DE POLLO", "PORTOFINO",
    "DE PARMA",
]
ICON_CAPTIONS = [
    "PIZZA", "VORSPEISEN", "ANTIPASTI MISTO", "NUDELN", "FRISCH AUS DEM OFEN",
    "MEXIKANISCH", "SALATE", "VEGETARISCHE AUFLÄUFE", "FISCH", "SCHWEINEFILET",
    "SCHNITZEL", "GETRÄNKE", "ANGEBOTE",
]


def norm(s: str) -> str:
    """Fold a name to the form the captions are printed in."""
    s = s.upper().strip()
    for a, b in (("`", "'"), ("’", "'"), ("´", "'")):
        s = s.replace(a, b)
    if s.startswith("PIZZA "):
        s = s[len("PIZZA "):]
    return " ".join(s.split())


def runs(flags: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    out: list[list[int]] = []
    start = None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i])
            start = None
    if start is not None:
        out.append([start, len(flags)])
    merged: list[list[int]] = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [(a, b) for a, b in merged]


def ink_mask(img: Image.Image, tol: int = 28) -> tuple[np.ndarray, np.ndarray]:
    a = np.asarray(img.convert("RGB")).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    return (np.abs(a - bg).sum(axis=2) > tol), bg


def cells_from_sheet(img: Image.Image, kind: str) -> list[tuple[int, int, int, int]]:
    """Return one (l, t, r, b) per illustration, in reading order, captions excluded."""
    mask, _ = ink_mask(img)
    boxes: list[tuple[int, int, int, int]] = []
    for top, bot in runs(mask.any(axis=1), min_gap=10):
        band = mask[top:bot]
        if kind == "icons":
            # Icon sheets separate art and caption into their own row bands;
            # the caption bands are short. Skip them.
            if (bot - top) < 100:
                continue
            art_t, art_b = top, bot
        else:
            # Pizza sheets merge art + caption into one band. Split inside it
            # and keep the TALL sub-band; the short trailing one is the caption.
            sub = runs(band.any(axis=1), min_gap=3)
            if not sub:
                continue
            tall = max(sub, key=lambda s: s[1] - s[0])
            art_t, art_b = top + tall[0], top + tall[1]
        art = mask[art_t:art_b]
        for left, right in runs(art.any(axis=0), min_gap=10):
            sl = art[:, left:right]
            ys = np.where(sl.any(axis=1))[0]
            xs = np.where(sl.any(axis=0))[0]
            if len(ys) == 0 or len(xs) == 0:
                continue
            box = (left + int(xs[0]), art_t + int(ys[0]),
                   left + int(xs[-1]) + 1, art_t + int(ys[-1]) + 1)
            if kind != "icons":
                box = trim_caption(mask, box)
            boxes.append(box)
    return boxes


def trim_caption(mask: np.ndarray, box: tuple[int, int, int, int],
                 max_caption: int = 25) -> tuple[int, int, int, int]:
    """Cut a caption still attached to the bottom of one cell.

    The band split above works per sheet ROW, so when a garnish in one cell hangs
    down to within a few pixels of the caption line, the whole row keeps its
    captions. Measured on `pizzas-2.png`: cells 1-6 shipped with "1. MARGHERITA"
    through "6. QUATTRO FORMAGGI" printed under the art. This looks inside the
    single cell instead: the last gap of blank rows in its bottom 40%, with no
    more than `max_caption` rows of ink below it, is the caption boundary.
    """
    l, t, r, b = box
    rows = mask[t:b, l:r].any(axis=1)
    h = b - t
    y = h - 1
    while y > h * 0.6 and rows[y]:
        y -= 1
    if y <= h * 0.6 or h - 1 - y > max_caption:
        return box
    caption_top = t + y + 1
    while y > 0 and not rows[y]:
        y -= 1
    # `pad` later grows every box by 6px; the gap above a caption can be as
    # narrow as 2px, so the padded edge must stop at the caption, not cross it.
    return (l, t, r, min(t + y + 1, caption_top - 6))


def pad(box, img, px=6):
    l, t, r, b = box
    return (max(0, l - px), max(0, t - px),
            min(img.width, r + px), min(img.height, b + px))


def to_tintable(img: Image.Image) -> Image.Image:
    """Line art on white -> RGBA alpha mask, so the app can tint it."""
    g = np.asarray(img.convert("L")).astype(int)
    alpha = np.clip(255 - g, 0, 255).astype(np.uint8)
    rgb = np.zeros(g.shape + (3,), dtype=np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--menu", default=str(MENU_JSON))
    ap.add_argument("--pizza-sheet", default="pizzas-2.png")
    ap.add_argument("--icon-sheet", default="portofino-icons-2.png")
    args = ap.parse_args()

    menu_path = Path(args.menu)
    if not menu_path.exists():
        print(f"menu not found: {menu_path}\n"
              f"  pass --menu, or check out the sibling backend repo", file=sys.stderr)
        return 2
    menu = json.loads(menu_path.read_text(encoding="utf-8"))

    by_number = {str(i.get("number")): i for i in menu["items"]
                 if i.get("categoryId") == "pizza"}
    populated = [c for c in sorted(menu["categories"], key=lambda c: c["sortOrder"])
                 if c.get("itemCount", 0) > 0]

    images: list[dict] = []
    icons: list[dict] = []
    problems: list[str] = []

    # ---- dish illustrations -------------------------------------------------
    sheet_path = SOURCES / args.pizza_sheet
    sheet = Image.open(sheet_path)
    boxes = cells_from_sheet(sheet, "pizzas")
    if len(boxes) != len(PIZZA_CAPTIONS):
        problems.append(f"{args.pizza_sheet}: found {len(boxes)} cells, "
                        f"expected {len(PIZZA_CAPTIONS)}")
    for idx, (box, caption) in enumerate(zip(boxes, PIZZA_CAPTIONS), start=1):
        item = by_number.get(str(idx))
        if item is None:
            problems.append(f"cell {idx} ({caption}): no pizza with number {idx}")
            continue
        if norm(item["name"]) != norm(caption):
            problems.append(f"cell {idx}: sheet says {caption!r}, "
                            f"menu item {idx} is {item['name']!r} — ABORT, "
                            f"the sheet order and the menu disagree")
            continue
        desc = (item.get("description") or "").strip()
        images.append({
            "key": f"menu/pizza/{item['id']}",
            "file": f"assets/menu/pizza/{item['id']}.png",
            "source": {"sheet": f"design/sources/{args.pizza_sheet}",
                       "cell": idx, "crop": list(pad(box, sheet))},
            "alt_de": (f"Illustration: {item['name']} mit {desc}" if desc
                       else f"Illustration: {item['name']}"),
            "maps_to": [item["id"]],
            "status": "candidate",
            "provenance": "ai-generated",
        })

    # ---- category icons -----------------------------------------------------
    icon_path = SOURCES / args.icon_sheet
    isheet = Image.open(icon_path)
    iboxes = cells_from_sheet(isheet, "icons")
    if len(iboxes) != len(ICON_CAPTIONS):
        problems.append(f"{args.icon_sheet}: found {len(iboxes)} cells, "
                        f"expected {len(ICON_CAPTIONS)}")
    if len(populated) != len(ICON_CAPTIONS):
        problems.append(f"menu has {len(populated)} populated categories, "
                        f"sheet has {len(ICON_CAPTIONS)} icons")
    for (box, caption, cat) in zip(iboxes, ICON_CAPTIONS, populated):
        if norm(cat["labelDe"]) != norm(caption):
            problems.append(f"icon {caption!r} does not match category "
                            f"{cat['labelDe']!r} ({cat['id']}) — ABORT")
            continue
        icons.append({
            "key": f"icons/category/{cat['id']}",
            "file": f"assets/icons/category/{cat['id']}.png",
            "source": {"sheet": f"design/sources/{args.icon_sheet}",
                       "crop": list(pad(box, isheet))},
            "alt_de": cat["labelDe"],
            "maps_to": [cat["id"]],
            "status": "candidate",
            "provenance": "ai-generated",
            "render": "tintable-alpha",
        })

    if problems:
        print("REFUSING TO DERIVE:", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        return 1

    illustrated = {m for e in images for m in e["maps_to"]}
    uncovered = [i["id"] for i in menu["items"] if i["id"] not in illustrated]
    empty_cats = [c["id"] for c in menu["categories"] if c.get("itemCount", 0) == 0]

    manifest = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generated_by": "scripts/derive-assets.py",
        "spec": "coord domain_spec/imagery-and-iconography (tenant pizzeria)",
        "join_keys": {"images": "menu item id", "icons": "category id"},
        "images": images,
        "icons": icons,
        "unmapped_menu_items": uncovered,
        "categories_without_icon": empty_cats,
        "notes": [
            "status is 'candidate' for every entry: a human must confirm that "
            "each picture is that dish before it renders. See the clause "
            "an-image-beside-a-price-is-a-claim in policy/ux-priorities.",
            "categories_without_icon are the categories publishing zero items; "
            "an icon for them would be a navigational promise to an empty room.",
        ],
    }

    print(f"dish illustrations : {len(images)} / {len(by_number)} pizzas")
    print(f"category icons     : {len(icons)} / {len(populated)} populated categories")
    print(f"uncovered items    : {len(uncovered)}")
    print(f"empty categories   : {len(empty_cats)} {empty_cats}")
    sizes = [(e['source']['crop'][2]-e['source']['crop'][0],
              e['source']['crop'][3]-e['source']['crop'][1]) for e in images]
    print(f"illustration size  : min {min(sizes)}  max {max(sizes)}")
    if args.dry_run:
        print("\n--dry-run: nothing written")
        return 0

    # A person's review is kept only for the exact bytes they saw. An entry
    # whose derived file is byte-identical to the previous run keeps its
    # status and review note; a re-cropped or regenerated picture drops back to
    # `candidate`, because nobody has looked at THAT picture yet.
    mf_prev = MOBILE / "assets" / "manifest.json"
    previous = {}
    if mf_prev.exists():
        prev = json.loads(mf_prev.read_text(encoding="utf-8"))
        previous = {e["key"]: e for e in prev.get("images", []) + prev.get("icons", [])}
        manifest["notes"] = list(dict.fromkeys(manifest["notes"] + prev.get("notes", [])))

    def carry_review(entry: dict) -> None:
        old = previous.get(entry["key"])
        if old and old.get("sha256") == entry["sha256"]:
            entry["status"] = old.get("status", entry["status"])
            if "review_note" in old:
                entry["review_note"] = old["review_note"]

    for entry in images:
        out = MOBILE / entry["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        sheet.crop(tuple(entry["source"]["crop"])).save(out)
        entry["sha256"] = sha256(out)
        carry_review(entry)
    for entry in icons:
        out = MOBILE / entry["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        to_tintable(isheet.crop(tuple(entry["source"]["crop"]))).save(out)
        entry["sha256"] = sha256(out)
        carry_review(entry)

    manifest["sources"] = {
        f"design/sources/{args.pizza_sheet}": {
            "sha256": sha256(sheet_path), "size": list(sheet.size)},
        f"design/sources/{args.icon_sheet}": {
            "sha256": sha256(icon_path), "size": list(isheet.size)},
    }
    mf = MOBILE / "assets" / "manifest.json"
    mf.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                  encoding="utf-8")
    print(f"\nwrote {len(images)} illustrations, {len(icons)} icons, and {mf.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
