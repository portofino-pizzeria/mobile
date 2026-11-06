---
subsystem: Menu — the catalogue the app is built around
repos: []
last_reviewed: 2026-08-28
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**
>
> `repos: []` is **UNKNOWN, not "none"** — the app's repository was not
> identified when this was written. Fill it with the slug work items use, or a
> spec-versus-reality diff cannot be pointed at a checkout.

# Menu

## Purpose

Hold the truth about what Portofino sells, at what price, in what sizes, and
containing what allergens — and make it correct at the moment a diner reads it.

During the MVP this is the app's *only* job. Ordering belongs to Delivery Way
(`decision_record/webview-handoff-is-temporary`), so a menu error is not one
defect among many: it is the product being wrong.

## Behaviour it must have

1. **Every item carries its number, name, ingredient description, category, and
   its full size/price set.** The numbering is how customers and staff refer to
   items on the phone; it is identity, not decoration.

2. **Sizes are per-item, not global.** `klein 22cm` / `groß 28cm` /
   `Blech 30×50cm` applies to most pizzas, but items exist with only one size
   (Calzone: groß only; de Pollo, Portofino, de Parma: groß only) and non-pizza
   items have a single price or their own variants (Schwein/Pute,
   Schwein/Hähnchen). A model assuming three sizes is wrong for real items on
   this menu today.

3. **Allergen codes resolve to a legend, and an unresolved code is shown as
   unknown — never omitted.** This is a legal and safety surface. Silently
   dropping a code a diner needs is the worst failure available here, and it is
   worse than showing "unknown".

4. **German and English, with German authoritative.** Item names are proper
   nouns and stay untranslated; descriptions and the allergen legend are
   translated. Where a translation is missing, show the German rather than a
   gap.

5. **Availability is representable.** A sold-out item must be markable, because
   discovering unavailability after choosing is the diner's named intolerance.
   If it cannot be updated during service — and per
   `audience_profile/owner-operator` it cannot — the spec must say what a stale
   availability flag shows.

6. **The menu reads without a network.** A diner in a building with poor signal
   still gets the menu. This is a lookup of near-static data; requiring
   connectivity to read it is a defect.

7. **One source of truth, and it MOVES — this subsystem has two phases and a
   cutover.**

   - **Before cutover**, ground truth is the existing site,
     `https://portofino-essen.de/`. The app derives from it. Truth is
     *observed*, the pizzeria maintains nothing new, and the standing risk is
     that a derived copy goes stale against a source we do not control.
   - **After cutover**, our website replaces that site and **the owner logs in
     and maintains the menu directly.** Truth becomes *authored*, held by us,
     and the website and the app read the same store.

   The cutover is what removes the drift risk — one copy instead of two — and
   it is also the moment the failure mode inverts. Before it, the menu can be
   wrong because the source moved. After it, the menu can be wrong because a
   person typed it wrong at 23:00 with the shop closing. Design for the second
   failure, not only the first.

8. **The owner must be able to edit it, and the editor is a safety surface.**
   Post-cutover the person entering prices and **allergen codes** is a
   restaurateur, in German, editing a few times a year, with no training and no
   memory of last time. That has consequences the editor must carry:

   - **Allergens cannot be silently lost.** Saving an item with no allergen
     data must be a deliberate, visible act, never a default or a side effect
     of a partial edit. A code dropped in an edit is the failure behaviour (3)
     exists to prevent, arriving through the front door.
   - **Validation refuses impossible states** rather than storing them — a size
     with no price, a price with no size, an unknown allergen letter.
   - **Nothing half-saved reaches a diner.** An interrupted edit leaves the
     previous good version live.
   - **German-first, and it survives being used once every six months.** If it
     needs relearning, it will be used wrong or not at all.

8. **Prices display exactly as the source states them.** No rounding, no
   currency inference, no "from €X". A wrong price is a dispute at the counter.

## Known divergences from reality

Sourced from the 2026-06-28 harvest (`2026-06-28-portofino-menu-data.md`), not
from a code audit — there was no app to audit when this was written.

- **(1) is incomplete: 3 of 14 categories were never harvested.**
  Hähnchenbrust, Rumpsteak and Dessert are **not in static HTML** — they are
  rendered by the Delivery Way SPA, so a static fetch returns navigation only.
  This is the largest gap and it is a *capability* gap: closing it needs
  browser-based comprehension rather than a fetch.
- **(3) is blocked on unresolved codes.** The harvested legend has two unknown
  entries — `d` and `i` — and the harvest notes codes were "rendered slightly
  inconsistently across pages". Both must be resolved against the site's
  official legend before anything ships to a diner.
- **(5) has no source at all.** Nothing observed provides availability; the
  site does not appear to express it. Decide what the app shows in its absence
  before building the field.
- **(7) is now decided but unbuilt.** The two phases and the cutover are
  settled (operator, 2026-08-28); what does not exist is the authored store, or
  any migration of the harvested menu into it. Note the sequencing trap: the
  harvest is still missing three categories, so cutting over today would make
  an *incomplete* menu authoritative and hand the owner the job of typing the
  gap in by hand.
- **(8) does not exist at all.** No editor, no login, no validation. It is the
  largest single piece of unbuilt work in this spec, and it is the one with a
  safety surface inside it.
- **Unrelated but adjacent:** the recorded phone number `0205415883` is
  suspect — Essen's area code is 0201, so `0201 5415883` is likelier. A
  tap-to-call button on a wrong number is a silent, total failure of the Info
  screen. Verify with the owner.

## How to use this document

Each numbered behaviour is an address; a candidate touching the menu should
cite the number it closes. When the divergence list empties, re-derive it
against the live site rather than against the harvest — the menu is somebody
else's document and it changes without telling us.
