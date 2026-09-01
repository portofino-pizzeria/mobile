# Portofino — menu re-derivation from the live site (2026-08-29)

> **Phase 1 output** for plan
> `2026-08-28-portofino-real-menu-domain-and-owner-editor`.
> Diffed against the 2026-06-28 harvest
> (`2026-06-28-portofino-menu-data.md`), which is the **baseline, not the
> source of truth**.
>
> **Dataset:** `D:/portofino-pizzeria/backend/data/menu.json`
> (138 items, 208 priced variants, 16 categories, 19 allergen codes).
> **Captured:** 2026-08-29 **00:01 UTC** = 02:01 German local — deliberately
> outside service hours (Mo, Mi–Fr 12:00–22:00; Sa/So 13:00–22:00; Di closed).
> **Load placed:** 39 sequential GETs, ~1.2 s apart, no parallelism, no writes,
> no cart interaction.

---

## Headline

**The plan's largest technical unknown is retired, and the 2026-06-28 diagnosis
of it was wrong.**

`portofino-essen.de` is **WordPress 6.8.8 + the WPPizza 3.17.4 plugin** (Astra
theme, Elementor page builder). The menu is rendered **server-side into the
category pages**. There is no JavaScript menu SPA. "Delivery Way" is the
footer branding of the hosting provider — not a client-side renderer.

So the harvest's conclusion that Hähnchenbrust, Rumpsteak and Dessert *"are
rendered by the Delivery Way SPA"* and therefore need browser comprehension is
**not what is happening**. Those three categories return nav-only to a static
fetch because **they contain zero published items**. A headless browser would
have rendered the same three empty pages. See "The three empty categories"
below for the four independent probes that establish this.

**Every price the harvest recorded is unchanged.** Zero price changes across
the harvest's 105 numbered items and 20 unnumbered drink/offer rows — 195
individual price points, compared mechanically in integer cents, not by eye.

**Allergen codes `d` and `i` are RESOLVED**, from the site's own markup:
**`d` = Senf** (mustard), **`i` = Erdnüsse** (peanuts). Nothing was guessed.

---

## 1. Per-category coverage

All 14 navigation categories were captured live by static HTML GET. **11 of 14
carry items; 3 are empty at source.**

| # | Category (nav) | Items | Method | Result |
|---|---|---:|---|---|
| 1 | Pizza | 29 | static-html | ✅ |
| 2 | Vorspeisen | 7 | static-html | ✅ |
| 3 | Nudeln | 17 | static-html | ✅ |
| 4 | Frisch aus dem Ofen | 7 | static-html | ✅ |
| 5 | Mexikanisch | 30 | static-html | ✅ (+5 cross-listed) |
| 6 | Salate | 6 | static-html | ✅ |
| 7 | Vegetarische Aufläufe | 3 | static-html | ✅ |
| 8 | Fisch | 1 | static-html | ✅ |
| 9 | Schweinefilet | 3 | static-html | ✅ |
| 10 | Schnitzel | 13 | static-html | ✅ |
| 11 | **Hähnchenbrust** | **0** | static-html | ⚠️ **empty at source** |
| 12 | **Rumpsteak** | **0** | static-html | ⚠️ **empty at source** |
| 13 | Getränke | 11 | static-html | ✅ |
| 14 | **Dessert** | **0** | static-html | ⚠️ **empty at source** |
| — | Angebote (offers block) | 9 | static-html | ✅ |
| — | **Antipasti Misto** (no nav page) | 2 | static-html (taxonomy archive) | ✅ **newly found** |

**Nothing failed to capture.** Every page returned HTTP 200 and parsed cleanly.
Zero items were carried over as `inferred` from the harvest — the dataset is
100 % `observed`.

### Completeness proof

The site publishes `wp-sitemap-posts-wppizza-1.xml`, which enumerates **every
published WPPizza post: 138 of them**. The dataset contains **exactly 138
unique items**. The catalogue is complete, not a best effort.

### The three empty categories — four independent probes

| Probe | Hähnchenbrust | Rumpsteak | Dessert |
|---|---|---|---|
| Nav page `/<slug>/` | 200, `entry-content` **literally empty** | same | same |
| WPPizza taxonomy archive `/wppizza_menu/<slug>/` | 200, term H1 renders, **0 posts** | same | same |
| Site search `/?s=<term>` | **no results** | no results | no results |
| Taxonomy sitemap `wp-sitemap-taxonomies-wppizza_menu-1.xml` | **term absent** (only non-empty terms are listed) | absent | absent |

The `entry-content` div on all three pages is empty whitespace — there is no
mount point for JavaScript to fill, and no menu JSON endpoint exists to fill it
from (`/wp-json/` exposes 10 namespaces, **none of them WPPizza**; the `wppizza`
post type is not REST-enabled).

**Supporting circumstantial evidence: the printed menu's number gaps.** Live
numbers run 1–144 with gaps at **54–71, 96–100, 103–105, 124–131, 136–138, 143**.
`124–131` is an unbroken run of eight, and `136–138` a run of three, sitting
exactly between Kinderteller (123) and Lachsfilet (132) / Schweinefilet
(133–135) and Pommes (139). That is consistent with Hähnchenbrust and Rumpsteak
having once occupied 124–131 and Dessert 136–138. **This is an inference from
numbering, not an observation** — the dishes and their prices are not recoverable
from it and none were invented.

---

## 2. Price changes

**Zero.** Verified by `diff_harvest.py`, which transcribes the harvest's 105
numbered items and 20 unnumbered drink/offer rows (195 individual price points)
and compares each against the live capture variant-by-variant, in integer cents:

```
=== A. NUMBERED HARVEST ITEMS: price comparison ===
  --> price changes: 0 ; harvest items no longer on the site: 0

=== B. UNNUMBERED HARVEST ROWS (drinks / offers) ===
  --> price changes: 0 ; unmatched: 0
```

Two months of drift produced **no price movement at all** — including the
klein/groß/Blech pizza triples, the Salate klein/groß pairs, the Schnitzel
Schwein/Pute pairs and every offer.

## 3. Items removed

**None.** Every item the harvest recorded is still published.

## 4. Items added (13)

| Number | Item | Category | Price |
|---|---|---|---|
| 139 | Pommes | Mexikanisch | 3,50 |
| 140 | Twister | Mexikanisch | 4,50 |
| 141 | Aglio Knoblauchbrot | Mexikanisch | 3,90 |
| 142 | Bruschetta | Mexikanisch | 7,50 |
| 144 | Folienkartoffel | Mexikanisch | 7,50 |
| — | Ketchup | Mexikanisch | 0,90 |
| — | Mayonnaise | Mexikanisch | 0,90 |
| — | Salsa | Mexikanisch | 1,20 |
| — | Sauerrahm | Mexikanisch | 1,20 |
| — | Aioli | Mexikanisch | 1,50 |
| — | Kräuterbutter | Mexikanisch | 1,50 |
| — | • für 1 Person Vorspeisenteller | **Antipasti Misto** | 9,90 |
| — | • für 2 Personen Vorspeisenteller | **Antipasti Misto** | 15,90 |

Most of these are not new *dishes* — they are things the harvest's small-model
extraction **did not see**. The harvest's own header called Mexikanisch "~20";
it is 30 unique items.

### ⚠️ Antipasti Misto is reachable only by URL

`wppizza_menu/antipasti-misto/` is a published category with two priced items
and **no entry in the site navigation**. A diner browsing `portofino-essen.de`
cannot find it. It is carried in the dataset as a 16th category with a `note`
recording that fact. **This is an operator question**, not a data question:
should the app surface a category the owner's own site hides?

## 5. Name divergences (7)

| Nr | Harvest | Live |
|---|---|---|
| 17 | Oceano | Pizza **Ozeano** |
| 21 | Sandro's Spezial | Pizza Sandro**`**s Spezial |
| 22 | Romino's | Pizza Romino**´**s |
| 47 | Lasagn**a** | Lasagn**e** |
| 76 | 6 **gefüllte** Pizzabrötchen | 6 **gef.** Pizzabrötchen |
| 109 | Onion Rings (10) | Onion Rings (10 **stk**) |
| 109a | Chilischoten (6) | Chilischoten (6 **Stk.**) |

Beyond those, three systematic differences the harvest normalised away and the
dataset does not:

- **Every pizza's rendered name carries the word "Pizza"** — `1. Pizza
  Margherita`, not `1 Margherita`. Item names are proper nouns (D3) and are
  stored as rendered.
- **Schnitzel names are full compounds** — `84. Jägerschnitzel`,
  `94. Parmachana-Schnitzel`, `83. Schnitzel „Wiener Art“` (with German
  typographic quotes) — not the harvest's clipped `Jäger` / `Parma` / `Wiener Art`.
- **The Schweinefilet trio are all named `Schweinefilet`**; what distinguishes
  133/134/135 is the *description* (`mit Jägersauce` / `mit Pfeffersauce` /
  `mit Tomaten, Sauce Bernaise, Mozzarella überbacken`).

## 6. Description changes

The site's own wording differs from the harvest's paraphrase throughout. The
most systematic one, and the one with legal weight:

- **The site writes `Pizzabelag-Vorderschinken`** wherever the harvest wrote
  `Vorderschinken`. This is a German food-labelling qualifier ("pizza-topping
  front-ham" — a formed meat preparation, not sliced ham) and it pairs with the
  `*` code, whose legend entry is literally `Vorderschinkenfleisch`. **Do not
  shorten it in the UI.**

Other examples: `27 de Pollo` gains `Sauce Hollandaise`; `46 Pollo al Curry`
says `Hähnchenfiletstreifen` and `Curry-Honig Sauce`; `122 Chicken Wings` adds
`Gerichte auf Wunsch mit Pommes+ 2,00`. All descriptions in the dataset are
byte-faithful to the rendered German.

---

## 7. The allergen legend as the site states it

The site emits its legend **twice** on every page that has items: as a `title=`
attribute on each code superscript beside the item, and as a
`<div class="wppizza-additives">` legend block at the foot of each item group
(15/15 pages with items carry at least one; the three empty pages carry none).
Both renderings agree, everywhere — the parser cross-checked every code against
both and raised no conflict.

| Code | German (verbatim, as the site renders it) | English | Status vs harvest |
|---|---|---|---|
| `*` | Vorderschinkenfleisch | — | unchanged |
| `V` | Vegetarisch | Vegetarian | unchanged |
| `a` | Gluten | Gluten | unchanged |
| `b` | Eier | Eggs | unchanged |
| `c` | Milch | Milk | unchanged |
| **`d`** | **Senf** | Mustard | ✅ **RESOLVED** (was `?`) |
| `e` | Sellerie | Celery | unchanged |
| **`i`** | **Erdnüsse** | Peanuts | ✅ **RESOLVED** (was `?`) |
| `j` | Krebstiere | Crustaceans | unchanged |
| `k` | Fisch | Fish | unchanged |
| `n` | Weichtiere | Molluscs | unchanged |
| `1` | Farbstoffe | — | unchanged |
| `2` | Konservierungsstoffe | — | unchanged |
| `3` | Antioxidationsmittel | — | unchanged |
| `4` | Stabilisatoren | — | unchanged |
| **`5`** | **Geschmacksverstärker** | — | 🆕 **new** (used by `85 Zigeunerschnitzel`) |
| `6` | Süßstoff | — | unchanged |
| **`7`** | **Koffeinhaltig** | — | 🆕 **new** (used by `Coca-Cola`) |
| `9` | **geschwärzt** | — | ⚠️ **harvest was wrong** — it read `9 = Coloring`. The site says `geschwärzt` (blackened — the olive treatment). |

**17 codes in the harvest → 19 live.** Every one of the 19 is in use by at least
one item, and every code appearing on an item has a legend row: `* 1 2 3 4 5 6 7
9 V a b c d e i j k n`. **Zero unresolved codes remain.**

Two notes for the model (D2):

- The English column is taken **only** from the site's own CSS semantic token
  (`wppizza-allergen-mustard`, `wppizza-allergen-peanuts`, …) — it is the
  plugin's own vocabulary, not a translation performed by this capture. Codes
  with no such token (`*` and the numeric additives) have `labelEn: null`.
- `d`/`i` being resolved does **not** retire D2's `text[]`-with-unknown-render
  requirement. The owner's editor (Phase 4) can enter any code, and the site's
  own history shows the legend growing (`5`, `7`) between captures. The render
  path still needs an honest *unbekannt*.

---

## 8. Does the site express availability?

**No — not per item.** There is no source at all, exactly as `domain_spec/menu`
(5) suspected.

- No item on any page carries a sold-out / unavailable / ausverkauft marker.
  Searching all 15 captured pages for `soldout`, `sold-out`, `unavailable`,
  `nicht verf`, `ausverkauft` returns **zero hits**.
- The only availability signal is **shop-level and clock-driven**: an opening
  hours widget (`Mo., Mi.-Fr. 12:00-22:00` / `Di. geschlossen` /
  `Sa., So. 13:00-22:00`) and a global closed message,
  `"Wir haben aktuell geschlossen"`.

The dataset therefore emits `available: true` on every item, with a top-level
`availability.expressedPerItem: false` and an explicit note that **this is the
absence of a source, not an observation that everything is in stock.** The
opening hours are carried in `openingHours` so the app can express the real
signal instead of faking the fake one.

This leaves the plan's Open Question 3 ("what does a stale availability flag
show?") **wide open and now sharper**: the answer cannot come from the site,
because the site has nothing to be stale about.

## 9. Does pickup (Abholung) pricing differ?

**Not on the menu.** Each item renders exactly one price set; no page carries a
second, pickup-specific price anywhere in the markup.

What *is* present:

- The WPPizza runtime config advertises **`compat.puDel: 1`** — the plugin's
  pickup/delivery compatibility flag. Pickup vs delivery is chosen in the AJAX
  cart (`admin-ajax.php`), not on the menu.
- **Two genuinely pickup-only products**, marked in their own German
  description as `(für Selbstabholer)`:
  - `Mittwochs-Angebot 1` — 8,90 — Pizza/Nudeln/Salat n. Wahl
    (ausgen. Nr. 26-29, 30, 31, 46, 81, 82)
  - `Mittwochs-Angebot 2` — 11,90 — Schnitzelgericht nach Wahl
    (ausgen. Nr. 26-29, 30, 31, 46)

So pickup is a **product distinction, not a price axis**, and the variant model
(D1) does not need a pickup dimension. Both facts are recorded in the dataset's
`pickup` block.

> **Not established:** whether the *checkout* applies a pickup discount, a
> delivery fee, or a minimum order value. Determining that requires putting
> items in the cart of a live business and driving its checkout, which this
> phase deliberately did not do. Plan Open Question 5 is unaffected.

---

## 10. Dataset shape notes for Phase 2/3

- **`id` is the PK and is a slug**: `<number>-<name>` where the site prints a
  number (`1-pizza-margherita`, `76a-salami-pizzabroetchen`,
  `133-schweinefilet`), `<category>-<name>` where it does not
  (`getraenke-coca-cola`, `angebote-kiddy-box`). Transliterated ä→ae, ö→oe,
  ü→ue, ß→ss; matches `^[a-z0-9]+(-[a-z0-9]+)*$`. 138/138 unique.
  One collision — the two `Wein Fl.` rows — is resolved **symmetrically** by
  appending each row's own volume: `getraenke-wein-fl-0-7-l` and
  `getraenke-wein-fl-2-0-l`. Neither id depends on document order.
- **208 variants, every one with an integer `priceCents` NOT NULL.** Labels are
  the site's own: `klein 22cm` / `groß 28cm` / `Blech 30x50cm` for pizza,
  bare `klein` / `groß` for Salate, `Schwein` / `Pute` for Schnitzel,
  `Schweinefilet` / `Hähnchenfilet` for 133–135, and `normal` for the
  single-price majority (the site renders those with an empty size div).
- **`sortOrder` is the site's own render order within the category, which is
  not numeric.** WPPizza emits Pizza as 6,5,4,3,2,1,7,8,… and Mexikanisch as
  101,102,108,107,106,111,…. The capture preserves what a diner sees;
  re-sorting by item number is a presentation choice for Phase 3, not a
  correction to the source.
- **5 items are cross-listed** in two categories (75, 76, 76a, 76b, 76c appear
  under both Vorspeisen and Mexikanisch). Each is stored once, under its first
  nav-order category, with `source.alsoListedIn` recording the other. If Phase 2
  wants true many-to-many category membership, this is the evidence for it.
- **`nameEn` / `descriptionEn` / category `labelEn` are null throughout.** The
  site publishes no English for any item or category. Inventing translations
  would violate D3; a missing translation renders the German.
- Each item carries `source.postId` and `source.renderedTitle` so any value can
  be traced back to the exact WordPress post it came from.

---

## 11. What I could NOT capture, and why

Blunt list. Nothing here is a "try harder" item except where marked.

1. **Hähnchenbrust, Rumpsteak and Dessert dishes — because they do not exist on
   the live site.** This is not a capture failure and no additional tooling
   (Playwright, the Qontinui collector, a real browser) would change it: four
   independent probes agree, and the site's own sitemap of 138 posts agrees.
   **If Portofino still sells these dishes, they are absent from their own
   website**, and the only source for them is the owner or a paper menu.
   → This is the operator decision in plan Open Question 1
   (`product_intent/open-questions` #4). **It is now a much smaller decision
   than the plan feared**: it is not "we cannot scrape three categories", it is
   "the owner's own site has three empty menu sections".
2. **Item numbers for 28 of 138 items** — the site prints none for the 11
   drinks, the 9 Angebote, the 6 Mexikanisch sauces and the 2 Vorspeisenteller.
   `number` is `null` for those. **No number was invented.** This is the second
   of the two gate assertions that fails, and it fails against the source, not
   against the capture.
3. **Whether checkout prices pickup differently** — see §9. Not attempted: it
   requires driving a live business's cart.
4. **Delivery fees, minimum order value, delivery-by-postcode rules** — the
   `wppizza-delivery-by-postcode` plugin is installed and its rules live behind
   the cart. Out of scope for a menu capture; relevant to the plan's Open
   Question 5 and to `backend/src/config.ts`'s flat €2.99.
5. **Item images** — WPPizza is configured without them on this site; nothing
   was skipped.
6. **English content** — none exists to capture.

---

## 12. Phase-1 gate verdict

Gate, verbatim from the plan:

> the dataset covers 14/14 categories, every item has a number and at least one
> priced variant, and every allergen code appearing on an item exists in the
> legend or is explicitly listed as unresolved.

Checked by `gate.js` (throwaway node script, 21 assertions). **19 pass, 2 fail.**

```
A. CATEGORY COVERAGE
  PASS  all 14 navigation categories are present as rows (missing: none)
  PASS  all 14 navigation categories were CAPTURED LIVE (provenance=observed, captureMethod set)
  PASS  no item was carried over as "inferred" from the 2026-06-28 harvest — 0 inferred
  FAIL  all 14 navigation categories carry >=1 item — EMPTY ON THE LIVE SITE: haehnchenbrust, rumpsteak, dessert
  PASS  Angebote present with items (9)
  PASS  Getraenke present with items (11)

B. PER-ITEM INVARIANTS
  FAIL  every item has a number — without one: 28
  PASS  every item has >=1 variant — without one: 0
  PASS  every variant has an integer priceCents > 0 — bad: 0
  PASS  every variant has a renderable label — without one: 0
  PASS  item ids are unique (138/138)
  PASS  item ids are lowercase ASCII kebab-case — bad: none
  PASS  variant ids are unique (208/208)
  PASS  variant ids are lowercase ASCII kebab-case — bad: 0
  PASS  every item points at a declared category — orphans: 0
  PASS  every item has provenance observed|inferred — bad: 0

C. ALLERGEN LEGEND
  PASS  every code used on an item has a legend row — unlisted: none
  PASS  every legend row is either resolved (labelDe + observed) or explicitly unresolved
  PASS  any legend row without a German label is flagged provenance=unresolved (0 such rows)
  PASS  the 2026-06-28 UNRESOLVED code 'd' is now resolved: "Senf"
  PASS  the 2026-06-28 UNRESOLVED code 'i' is now resolved: "Erdnüsse"

RESULT: 19 passed, 2 failed
GATE: NOT MET (2 assertion(s) failed)
```

**The gate is NOT MET as written**, and both failures are properties of the
source document rather than of the capture:

- **14/14 captured, 11/14 non-empty.** Under the reading "covers 14/14
  categories" = *every category was reached and its true contents recorded*, the
  clause is satisfied. Under the reading *every category yields items*, it is
  not, and cannot be by any method.
- **28 items have no number** because Portofino does not print one for drinks,
  offers, sauces or the Vorspeisenteller. The alternative — synthesising
  numbers — would put fabricated identity on the surface where
  `domain_spec/menu` (1) says number *is* identity.

The third clause — allergen completeness — passes outright, with both
previously-unresolved codes now resolved from the site's own legend.

**Escalated, not decided here:** whether Phase 2/3 proceed on 11 non-empty
categories, and whether the model should permit `number = NULL` or require a
synthetic identifier for unnumbered items. Per the plan, that is an operator
call, and the plan's own framing of it should be updated: the blocker is not
"we could not capture three categories", it is "three categories are empty on
the owner's website".

---

## Related

- `[[2026-06-28-portofino-menu-data]]` — the baseline this diffs against
- `[[2026-08-28-portofino-real-menu-domain-and-owner-editor]]` — the plan
- `[[2026-06-13-portofino-pizzeria-app-kickoff]]` — records the site's
  Lieferung/Abholung selector
