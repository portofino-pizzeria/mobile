# Imagery and iconography

What Portofino's pictures are FOR, where they come from, and how a reader — human
or agent — resolves one. Companion to `domain_spec/visual-system`: that document
governs colour, type and composition; this one governs the pictures placed inside
them. Read it to DIFF, like its sibling.

It is a separate document for one reason: this is the only part of the visual
system with a **machine-readable join to product data**. Colour does not have to
agree with the menu. A picture does. The product data it joins against is
`domain_spec/menu`, which stays the authority on what is on the menu; nothing
here restates an item, a price or a category.

**Scope — deliberately not a repo list**, for the reasons
`domain_spec/visual-system` gives under its own scope section: an enumerated
`repos:` list drifts under-inclusively and an empty one reads as UNKNOWN. This
governs every surface this tenant ships that renders a picture of food.

**This document closes `domain_spec/visual-system`'s `Declared UNKNOWN` entry
"Photography direction"**, which reads: *"The reference leans hard on food
photography as its primary visual weight; whether this tenant has that asset
library is undeclared, and a design that assumes it will fall flat without it."*
The answer is that this tenant has an **illustration** library rather than a
photographic one, and — per the next section — that is a positive choice rather
than a budget substitute.

## The subject: a dish is a product for sale

This is not decoration, and that is the whole reason this document exists.

A picture next to a priced item is a **claim about what arrives**. A diner
ordering `Pizza Ozeano` because the picture showed salmon has been misled, and
neither "it was close enough" nor "an agent picked it" is a defence. Every rule
below follows from that sentence.

**PROPOSED DECLARATION — illustration, never photography, and legibly so.**
Portofino's dish imagery is stylised watercolour illustration in one consistent
hand. The style is the honesty mechanism: a photograph asserts *this is the plate
you get*, an illustration asserts *this is the dish*. Mixing the two on one
surface makes the illustrations read as failed photographs and the photographs as
a guarantee. **Do not mix.**

Category iconography is monochrome line art in one consistent hand, used as a
navigational mark at small size — never as a picture of food.

## The source of truth is the manifest, not this document

Named, not restated — the same discipline `domain_spec/visual-system` applies to
the palette. The bindings live in **`assets/manifest.json`** in the repo that owns
the bytes, and this document never carries a mapping table. A mapping copied here
would become the copy that is edited.

The manifest is authoritative for: which file, which menu item or category it
depicts, its German alt text, its provenance, and its status
(`confirmed` / `candidate` / `unmapped`).

## Join keys — stated once, because everything depends on them

- **Dish illustrations join on the menu item's own `id`** (`data/menu.json`, e.g.
  `17-pizza-ozeano`), whose leading integer is the number printed on the
  restaurant's own menu. That number is the customer-facing identity and the
  illustration set is keyed to it.
- **Category icons join on the category `id`** (`pizza`, `nudeln`,
  `vegetarische-auflaeufe`, ...), never on the German label. Labels are display
  text and the owner can edit them; ids are identity.

## Coverage, measured 2026-09-11

State it, because a coverage claim ages and the next reader must be able to tell
whether it still holds.

- **Dish illustrations: 29 of 29 pizzas.** The set is keyed 1-29 and matches the
  menu's own numbering item for item, including the ones a generic Italian set
  would never contain — `21 Sandro's Spezial`, `22 Romino's`, `26 Spaghetti`
  (a pizza topped with spaghetti bolognese), `28 Portofino`.
- **Category icons: 13 of 13 populated categories**, in `sortOrder` order.
- **Three categories have no icon and correctly so**: `haehnchenbrust`,
  `rumpsteak`, `dessert` publish **zero items** — the menu capture confirms they
  are empty on the restaurant's own server, not withheld. An icon for a category
  with nothing in it would be a navigational promise to an empty room.
- **Uncovered: the other 109 menu items.** Only `pizza` is illustrated. The
  remaining twelve populated categories — `mexikanisch` (30 items), `nudeln`
  (17), `schnitzel` (13), `getraenke` (11) — have category icons and no dish
  illustrations. **That is the current state, not a decision**, and it is the
  next candidate work item this document produces.

**One binding to confirm by eye before it ships:** the `angebote` (offers) icon is
a gift box, which reads as *voucher*, not *offer*. It is the only icon in the set
whose subject does not obviously name its category.

## Sheets are sources; per-item files are assets

The generated sheets are **inputs**, and they are not what the app loads.

- Sheets live under `design/sources/` and are committed. They sit OUTSIDE `assets/` on purpose: `assets/` is what the app bundles, and a multi-megabyte sheet has no business shipping to a phone. They are kept because
  they are the only record of the style, and a later regeneration must match it.
- Per-item files are **derived** from a sheet by a committed, re-runnable step
  that records the crop box for each cell. A hand-cropped image nobody can
  reproduce becomes unmaintainable the first time the menu changes.
- **Crops exclude the caption printed on the sheet.** The sheet's label is a
  proof-reading aid for the generation pass; the app renders the name from the
  menu in German. Two sources of a dish's name is how they diverge.

## What the app loads, and when it has nothing

`menu_items.image_url` exists in the backend schema and is **NULL for every item
today**. Two shapes are possible — bundle the derived files with the app and
resolve by key, or upload them and populate `image_url` — and they differ in one
way that matters to the owner: only the second lets the menu editor attach a
picture to a dish the owner adds later.

**PROPOSED DECLARATION.** The owner must be able to add a dish *and its picture*
without an app release. So `image_url` is the runtime path, bundled files are the
seeded default, and the resolver prefers the stored value.

**When there is no picture, the surface says so by omission**, with a declared
no-image treatment that keeps the row's geometry. It never falls back to a
category icon standing in for a dish, a generic pizza, or a blurred placeholder
that reads as a loading state. The conduct rule that binds an agent here is
`policy/ux-priorities` — a spec cannot govern behaviour.

## Provenance and rights

**PROPOSED DECLARATION.** Every asset records in the manifest how it was made.
The current sets are **AI-generated** (2026-09-11) and that is recorded rather
than hidden: it bears on rights, on regeneration, and on what a reviewer should
check. An AI-generated illustration has no photographer to credit and no licence
to honour, but it also carries no guarantee that it depicts the dish correctly —
which is why the `confirmed` status in the manifest means *a human looked at this
picture beside this dish*, and nothing else.

## Declared UNKNOWN

- **Dish illustrations outside `pizza`.** 109 items, twelve categories. Whether
  they get illustrations at all is an open decision, not a backlog item.
- **The no-image treatment.** Its visual form is undeclared; only the rule that
  one must exist is stated here.
- **Where the icons appear.** Category navigation, section headings, both, or
  neither is undeclared. Thirteen line-art icons could equally be a grid, a rail,
  or unused.
- **Retina/density variants and target pixel sizes.** Undeclared.
- **Whether the owner may upload their own photographs** through the menu editor.
  If yes, the no-mixing declaration above needs a rule for the mixed state, and
  it does not have one.
