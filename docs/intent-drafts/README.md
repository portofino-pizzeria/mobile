# Intent drafts — pizzeria tenant

**APPLIED 2026-09-11.** These are no longer drafts: all three were written to
the served coord prompt documents for tenant `pizzeria` and verified by read-back.
They are kept as the reviewable source of what was written, and as the working
copy for the next edit.

| File | Document | Operation | Result |
|---|---|---|---|
| `domain_spec--visual-system--APPEND.md` | `domain_spec/visual-system` | append | **v1 → v2** |
| `domain_spec--imagery-and-iconography.md` | `domain_spec/imagery-and-iconography` | create | **v1** |
| `policy--ux-priorities--APPEND.md` | `policy/ux-priorities` | append | **v3 → v4**, classified `tightening` |

Announced by coord finding `8d3f2cdf-f3c1-42ce-8a9f-e8e19bfc0623` (topic
`visual-system`), which carries the reasoning the operator's review feed links to.

**The served document is the authority, not this folder.** If they disagree, the
served one wins and this copy is stale. Read it with `/policy get domain_spec
visual-system` from a session bound to the `pizzeria` tenant, or at
`/admin/coord/prompt-documents`.

## How to edit these next

Either paste at `/admin/coord/prompt-documents` with the `pizzeria` tenant
selected, or use `coord_write_prompt_document` from a session **bound to the
`pizzeria` tenant**. A session bound to another tenant cannot: the tenant is
burned into the device JWT at mint, and every document read and write resolves
the caller's own tenant server-side. On 2026-09-11 that binding had to be
obtained with a single-use pair code redeemed at
`POST /api/v1/devices/pair-codes/{code}/redeem`, because this machine's runner
pins one tenant at a time.

## What is still the operator's to settle

Every declaration in the two specs is marked **PROPOSED**, and the genuine fork
is marked **OPEN**: whether the home screen leads with a rail of specialities
(the reference's shape) or with the menu itself (the ordering-app shape). The
reference cannot settle that one — it is a chain's reservation-and-brand site,
and this is one restaurant's ordering surface.

Still `Declared UNKNOWN` after this pass: the type scale, **the alert
treatment** (the highest-value one owed — the brand red cannot also mean error),
dark mode, the neutral ramp, density, the no-image treatment's visual form, and
whether the twelve non-pizza categories get dish illustrations at all.

## Measurement provenance

The composition, spacing and motion figures were measured on **2026-09-11** from
L'Osteria's own served assets, not from a rendering or a description of the page:

- `https://www.losteria.net/de/` (HTTP 200, 69 930 bytes)
- `.../typo3temp/assets/compressed/merged-bfd8...9942.css` (1 156 915 bytes)
- `.../typo3temp/assets/compressed/merged-06d3...1cda2f.js` (341 358 bytes)

**The same artifact the existing spec was measured from, and the prior
measurement reproduces.** `#db052c` occurs **153** times in that stylesheet, and
its role split is **25 fills** against **77 `color`** — against the 78/25 the
served document records. The red-is-a-foreground constraint is confirmed.

⚠️ **Foundation caveat, inherited from the served document's own Provenance
section and extended to these figures.** The reference is Zurb Foundation 6 on
the float grid. Its breakpoints (40em/64em/75em) are Foundation's, its dominant
`1.25rem` spacing value is Foundation's default gutter, and its `0` radius is
Foundation's `$global-radius`. Those are framework defaults, not brand
decisions, and the append labels every measured value **brand** or **framework**
for exactly that reason. The hand-authored Slick presets, fade-in delay tiers
and autoplay intervals are the ones that carry intent.
