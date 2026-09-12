#!/usr/bin/env python3
"""Fail when the asset manifest and reality have drifted apart.

Required by `policy/ux-priorities`, clause
`an-asset-the-machine-cannot-reach-does-not-exist`:

    The check runs in CI and fails on: a manifest entry whose file is absent, a
    manifest entry naming a menu `id` that no longer exists, and a menu item in
    an illustrated category with no manifest entry at all. The third is the one
    that catches drift the day the owner adds a dish.

A fourth check covers the app's side of the join: `src/lib/asset-registry.generated.ts`
is the manifest projected into the static `require()` calls Metro needs, and it
must match the manifest it was generated from (see `scripts/gen-asset-registry.py`).

The checks do not all have the same reach, and the difference is reported
rather than hidden. Manifest-vs-files and manifest-vs-registry run anywhere. The
two menu-join checks need the menu, which lives in the sibling `backend` repo —
CI checks that repo out beside this one for exactly this step; without `--menu`
they are reported **SKIPPED (UNKNOWN)**, never silently passed.

Usage:
    python scripts/check-assets.py
    python scripts/check-assets.py --menu ../backend/data/menu.json
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

MOBILE = Path(__file__).resolve().parent.parent
REGISTRY = MOBILE / "src" / "lib" / "asset-registry.generated.ts"
VALID_STATUS = {"confirmed", "candidate", "unmapped"}
ASSET_DIRS = ("assets/menu", "assets/icons")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--menu", default=None,
                    help="path to the backend's data/menu.json; without it the "
                         "menu-join checks are SKIPPED, not passed")
    args = ap.parse_args()

    mf = MOBILE / "assets" / "manifest.json"
    if not mf.exists():
        print(f"FAIL: no manifest at {mf}", file=sys.stderr)
        return 1
    m = json.loads(mf.read_text(encoding="utf-8"))
    entries = list(m.get("images", [])) + list(m.get("icons", []))
    fails: list[str] = []

    # --- 1. manifest vs files (always runnable) ------------------------------
    seen_keys: set[str] = set()
    declared: set[str] = set()
    for e in entries:
        key = e.get("key")
        if key in seen_keys:
            fails.append(f"duplicate manifest key: {key}")
        seen_keys.add(key)
        if e.get("status") not in VALID_STATUS:
            fails.append(f"{key}: invalid status {e.get('status')!r}")
        rel = e.get("file")
        if not rel:
            fails.append(f"{key}: no file")
            continue
        declared.add(rel)
        p = MOBILE / rel
        if not p.exists():
            fails.append(f"{key}: file missing -> {rel}")
            continue
        want = e.get("sha256")
        if want:
            got = hashlib.sha256(p.read_bytes()).hexdigest()
            if got != want:
                fails.append(f"{key}: {rel} changed since it was derived "
                             f"(sha256 {got[:12]} != {want[:12]}) — re-run "
                             f"scripts/derive-assets.py")

    for d in ASSET_DIRS:
        root = MOBILE / d
        if not root.exists():
            continue
        for p in root.rglob("*.png"):
            rel = p.relative_to(MOBILE).as_posix()
            if rel not in declared:
                fails.append(f"orphan asset not in the manifest: {rel}")

    print(f"manifest vs files : {len(entries)} entries checked")

    # --- 1b. manifest vs the app's generated registry (always runnable) ------
    # Same renderer the generator uses, so "in sync" means byte-identical to
    # what a re-run would write — not a looser structural comparison.
    sys.dont_write_bytecode = True  # a checker that leaves __pycache__ behind is a side effect
    spec = importlib.util.spec_from_file_location(
        "gen_asset_registry", Path(__file__).with_name("gen-asset-registry.py"))
    assert spec and spec.loader
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    have = REGISTRY.read_text(encoding="utf-8") if REGISTRY.exists() else None
    try:
        want = gen.render(m)
    except (SystemExit, KeyError) as exc:
        # The generator refuses a malformed manifest; recorded as one finding
        # among the others rather than cutting the report short at this line.
        fails.append(f"registry cannot be rendered from the manifest: {exc}")
        want = None
    in_sync = want is not None and have == want
    if want is not None and not in_sync:
        fails.append(f"{REGISTRY.relative_to(MOBILE).as_posix()} is stale against "
                     f"the manifest — re-run scripts/gen-asset-registry.py")
    print(f"manifest vs app   : {REGISTRY.relative_to(MOBILE).as_posix()} "
          f"{'matches' if in_sync else 'STALE'}")

    # --- 2 + 3. manifest vs menu (needs the menu) ----------------------------
    menu = None
    if args.menu is None:
        print("menu join         : SKIPPED — no --menu given. This is UNKNOWN, "
              "not a pass: an item the owner added today would not be detected.")
    elif not Path(args.menu).exists():
        # A named menu that is not there is a FAIL, not a skip: the caller
        # asserted the join could run, and CI relies on that assertion.
        fails.append(f"--menu {args.menu} does not exist")
        print("menu join         : FAILED — the named menu is not there")
    else:
        menu = json.loads(Path(args.menu).read_text(encoding="utf-8"))

    if menu is not None:
        ids = {i["id"] for i in menu["items"]}
        cat_ids = {c["id"] for c in menu["categories"]}
        mapped: set[str] = set()
        for e in entries:
            universe = cat_ids if e["key"].startswith("icons/") else ids
            for target in e.get("maps_to", []):
                if target not in universe:
                    fails.append(f"{e['key']}: maps_to {target!r}, which is not "
                                 f"in the menu any more")
                mapped.add(target)

        illustrated_cats = {i["categoryId"] for i in menu["items"]
                            if i["id"] in mapped}
        for i in menu["items"]:
            if i["categoryId"] in illustrated_cats and i["id"] not in mapped:
                if i["id"] not in set(m.get("unmapped_menu_items", [])):
                    fails.append(f"menu item {i['id']} is in an illustrated "
                                 f"category ({i['categoryId']}) with no manifest "
                                 f"entry and is not listed in "
                                 f"unmapped_menu_items")
        print(f"menu join         : {len(mapped)} bindings checked against "
              f"{len(ids)} items / {len(cat_ids)} categories")

    if fails:
        print(f"\nFAIL ({len(fails)}):", file=sys.stderr)
        for f in fails:
            print("  - " + f, file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
