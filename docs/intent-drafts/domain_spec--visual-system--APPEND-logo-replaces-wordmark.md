### CORRECTION (2026-09-28, applied 2026-09-29) — the text wordmark the REPLACE body describes no longer exists in the app

**Applied to `domain_spec/visual-system` v3 → v4, announced by finding
`94870bab-7f0b-413d-8f88-05fb9f36d5fa`.** Drafted 2026-09-28 with no verified
`pizzeria`-bound credential (coord's write door was down); applied 2026-09-29
from a session that minted one via `POST /agents/credential
{device_id, tenant_id}` and confirmed the acting tenant with
`coord_query_identity` first. Landed as a plain append below the
`# SUPERSESSION (2026-09-14)` heading a peer wrote the same day — see this
folder's `README.md` 2026-09-14 entry for why that whole-body replace also
turned out to be unwritten, and why it landed as an append instead of a
literal replace. The served document carries the full text; this is the
working copy.

`domain_spec--visual-system--REPLACE.md` (the current served body, as far as
this repo's copy of it is concerned) describes the wordmark as **text**:

- "a classic serif for the wordmark and every heading" (Character)
- the palette table's Gold row lists "the wordmark" as a gold-fill consumer
- "only the wordmark, eyebrows and one hero word are gold in the design"
- "The wordmark keeps the true gold: a logotype has no contrast requirement"
- the Type table: `Wordmark 'PORTOFINO.' | serif, bold, gold; the full stop ink | 22–24 | header.tsx`
- the page-order section: "Header — ...the wordmark..." and "Footer — dark
  band; gold wordmark; muted copyright line"

PR #56 (`5526e64`, `226b94e5`) replaced all of that: `Wordmark` (a styled
`Text` component) was renamed to `Logo` and now renders
`assets/images/logo.png` — an 800×358 image rendered from
`assets/sources/Logo.pdf` — in both the header (40px) and the footer (64px).
The image is not gold-tinted; it carries its own colour and a white halo that
works on both the white header and the `#111827` footer (`index.tsx` around
the `Logo` function and the `logoHeader`/`logoFooter` styles). The gold
brand colour is no longer used for the mark at all — only for fills, the
active-tab rule and the cart badge, as the palette table's other rows already
say.

The correction, once applied, is: drop "the wordmark" as a gold/serif
consumer everywhere above, and replace the Type table's `Wordmark` row and the
Character-section mention with something like "the header/footer mark is the
restaurant's own logo image (`assets/images/logo.png`), not typeset — no font
or colour declaration applies to it."
