## Placement in the v0 menu, and the first confirmations (2026-09-14)

Closes two `Declared UNKNOWN` entries: where the category icons appear, and whether
the dish illustrations fit the v0 design.

**DECLARATION — dish illustrations stay, beside the dish.** The watercolour set
fits the v0 menu. Each illustrated row shows its picture at 120 x 80 with rounded
8px corners, left of the dish's number, name and toppings. The allergens and the
add buttons run the full width underneath, so a picture never squeezes a price.
The rule for a row without a confirmed picture in an illustrated section is
unchanged: the space is kept, and nothing is drawn in it.

**DECLARATION — category icons are navigational marks in two places:** beside
each label in the category tab strip (22px tall, ink when active and muted when
not), and left of each section's serif heading (40px tall, in the gold text
colour `#826b4f`). The icons are alpha masks, so the colour always comes from the
surface. They are decorative: the label beside each one already names the
category.

**First confirmations.** On 2026-09-14 the operator reviewed a contact sheet
showing every picture beside its dish's number, name and toppings, and confirmed:

- **all 29 pizza illustrations**, keyed 1–29, with no mismatches found;
- **12 of the 13 category icons.**

`icons/category/angebote` (a gift box) stays `candidate`: it reads as *voucher*
rather than *offer*, the concern this document raised when the set was made. The
Angebote tab and heading show text only until a better icon is confirmed.

**Confirmation belongs to the bytes.** `scripts/derive-assets.py` keeps an entry's
status only while its derived file is byte-identical to the one reviewed. A
re-cropped or regenerated picture drops back to `candidate`. This was prompted by
re-cropping pizzas 1–6: their first derivation still carried the sheet's printed
caption under the art, against the "Crops exclude the caption" rule above.
