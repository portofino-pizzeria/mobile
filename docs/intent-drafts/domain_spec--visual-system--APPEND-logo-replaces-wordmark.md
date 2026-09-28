### CORRECTION (2026-09-28) — the text wordmark the REPLACE body describes no longer exists in the app

**Not yet written to the served document.** This session has no verified
`pizzeria`-bound credential and coord's write door was unreachable at the time
of this commit (see the accompanying PR body). The served `domain_spec/visual-system`
still carries the text it read before PR
[#56](https://github.com/portofino-pizzeria/mobile/pull/56); a future session
holding a pizzeria-bound credential should paste this at
`/admin/coord/prompt-documents` (or the coord write route) and record the
applied version bump here, the way the 2026-09-20 saved-details correction did.

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
