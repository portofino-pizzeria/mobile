## Category icons, second set (2026-09-14)

Supersedes the icon half of "First confirmations" above.

**Source.** The operator drew a new sheet, `design/sources/portofino-icons-3.png`,
with one captioned icon for every category in the site's navigation, and asked for
it to be used for the menu categories. It replaces `portofino-icons-2.png` for
every category.

**Confirmed: all 15 category icons.** That includes the three categories that
publish no dishes today (Hähnchenbrust, Rumpsteak, Dessert). Their icons are
bundled but not drawn, because the menu renders only sections that have dishes.
Each icon comes waiting for the owner's first dish in its category rather than
promising an empty room. The old gift box is gone; **Angebote is now a
chalkboard** reading "Angebote" and is confirmed.

**Not cut: HOME.** The sheet's first cell is a house for the site's Home link. It
is not a menu category, and nothing in the app has a Home destination. It stays
on the sheet unused.

**Antipasti Misto no longer exists.** The operator compared the website's
navigation and full menu, category by category, against `domain_spec/menu`'s data,
and ruled that the menu has no Antipasti Misto. The capture had found it as a
published archive page that no navigation links to. The category and its two
items were removed from `backend/data/menu.json`, and its icon from the manifest.
Every other item, allergen code, description and price matched that paste.

**How the sheet binds.** This sheet does not follow the menu's category order and
carries a non-category cell, so `scripts/derive-assets.py` writes the binding out
cell by cell (`ICON_CELLS`) and checks each printed caption against the
category's German label before cutting. Icons are extracted against the paper's
own measured tone, not an assumed white, so no faint rectangle is left behind
each one.
