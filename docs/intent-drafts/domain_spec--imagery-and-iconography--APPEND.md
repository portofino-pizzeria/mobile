## The hero photograph — amended for the v0 design (2026-09-14)

`domain_spec/visual-system` was replaced on 2026-09-14 with the operator's v0
design, and that design leads the home screen with **one photograph**
(`design/sources/portofino-pizzeria/public/portofino-pizza.png`, shipped as
`assets/images/hero-pizza.jpg`). This section says how that photograph fits the
rules above, which were written before it existed.

**DECLARATION — the hero photograph is ATMOSPHERE, not a dish.** It shows a
pizza on a table in a restaurant. It is not joined to any menu item, carries no
name and no price, and sits in its own band above the menu. It therefore makes
no claim about what a guest receives, and the dish rules above do not govern it:
it is not in `assets/manifest.json`, and it has no `confirmed` status to earn.

**What keeps it honest:**

- **It never appears next to a price, a dish name or an add button**, and never
  inside the menu list. Moving it there turns it into the claim this document
  exists to prevent.
- **Its alt text describes the image, not the restaurant:** "Pizza Margherita auf
  einem Holztisch" — not "unsere Pizza aus dem Steinofen". The v0 design's own
  alt text asserted a stone oven, which is an unconfirmed fact and is not used.
- **Provenance: AI-generated** (made with the v0 design, 2026-09). It is not a
  photograph of Portofino's food or dining room, and nothing on the surface says
  it is.

**The no-mixing rule above is narrowed, not dropped.** It still holds for DISH
imagery: on the menu list, pictures of dishes are illustrations, never
photographs. The hero band is a different kind of picture in a different place,
and the two never share a row.

**Replacing it.** A real photograph of Portofino's own food or room may replace
the AI image at any time, and is preferred. It stays under the same rules: one
image, hero band only, alt text that describes what is shown.

### Declared UNKNOWN, added

- **Whether dish illustrations fit the v0 design at all.** The watercolour set
  was chosen for the previous visual system. The v0 menu is a text list with no
  image slot; the app keeps the illustration column only for items with a
  `confirmed` binding, and today there are none. Whether to keep, restyle or
  retire the set is the operator's decision.
