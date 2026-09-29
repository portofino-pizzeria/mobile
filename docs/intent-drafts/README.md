# Intent drafts — pizzeria tenant

Working copies of what was written to the served coord prompt documents for
tenant `pizzeria`. **The served document is the authority, not this folder.** If
they disagree, the served one wins and this copy is stale. Read it with
`/policy get domain_spec visual-system` from a session bound to the `pizzeria`
tenant, or at `/admin/coord/prompt-documents`.

## 2026-09-29 — the wordmark is now a logo image, not text (APPLIED)

| File | Document | Operation |
|---|---|---|
| `domain_spec--visual-system--APPEND-logo-replaces-wordmark.md` | `domain_spec/visual-system` | correction (the v0-design section's text wordmark is stale after PR #56), applied v3 → v4, announced by finding `94870bab-7f0b-413d-8f88-05fb9f36d5fa` |

Post-merge follow-up for PR [#56](https://github.com/portofino-pizzeria/mobile/pull/56),
which swapped the gold serif `Wordmark` component for a real logo image. No
plan file drove #56. Drafted 2026-09-28 by a session with no `pizzeria`-bound
credential (coord's write door was down); applied 2026-09-29 by a session that
minted one via `POST /agents/credential {device_id, tenant_id}` and confirmed
it with `coord_query_identity` before writing — see the 2026-09-14 entry below
for why the document needed a bigger catch-up first.

## 2026-09-20 — the saved-details declaration was wrong in two ways (APPLIED)

| File | Document | Operation |
|---|---|---|
| `domain_spec--menu--APPEND-saved-details-correction.md` | `domain_spec/menu` | append (correction to the 2026-09-14 saved-details paragraph), applied v5 → v6, announced by finding `1a13c188-1387-4fdc-af58-9e63bc6badb1` |

Written from a pizzeria-bound device credential, for plan
`plans/2026-09-20-portofino-privacy-policy-and-the-data-it-describes.md`. The
served document was corrected on 2026-09-20; this working copy is only now
committed, so until this commit the repo's record of the folder was one append
short of what the tenant is actually served. Its inline `checkout.tsx:NNN`
citations are as written on the day and drift with the file — the standing rule
at the top of this file applies: read the served document, not this copy.

## 2026-09-19 — owner-authored shop facts, special days, Impressum (APPLIED)

| File | Document | Operation |
|---|---|---|
| `domain_spec--menu--APPEND-owner-shop-facts.md` | `domain_spec/menu` | append, applied v4 → v5, announced by finding `5d247a1e-df90-4500-a36c-b569ed2af0f4` |

Written from a pizzeria-bound device credential (paired from an operator code),
for plan `plans/2026-09-19-portofino-owner-edits-shop-info-and-legal-notice.md`.

## 2026-09-19 — the pizza mascot and the Kettwig hero (visual-system half APPLIED 2026-09-29; imagery half still NOT YET APPLIED)

| File | Document | Operation |
|---|---|---|
| `domain_spec--visual-system--APPEND-mascot.md` | `domain_spec/visual-system` | append (owner-ordered mascot exception to `## Motion`; covers the pizza and the taco), applied v2 → v3 (folded into the 2026-09-29 catch-up below), announced by finding `94870bab-7f0b-413d-8f88-05fb9f36d5fa` |
| `domain_spec--imagery-and-iconography--APPEND-4.md` | `domain_spec/imagery-and-iconography` | append (hero photograph replaced by the Kettwig mascot illustration), **not yet written** |

The app already ships both. The mascot exception is now served; the Kettwig
hero append is a separate document this pass did not touch, so the served
hero section still disagrees with the app until someone writes it too.

## 2026-09-14 — the v0 design replaces the visual system (visual-system row APPLIED 2026-09-29, as an append rather than a literal replace)

| File | Document | Operation |
|---|---|---|
| `domain_spec--visual-system--REPLACE.md` | `domain_spec/visual-system` | drafted as a **replace** (whole body), but **coord refuses a destructive whole-body replace from an unidentified bootstrap-agent credential** (`unidentified_caller`) — landed 2026-09-29 instead as an **append**: a `# SUPERSESSION (2026-09-14)` heading voiding everything above it, followed by this file's content verbatim, v2 → v3 (folded into the same write as the mascot append above), announced by finding `94870bab-7f0b-413d-8f88-05fb9f36d5fa`. The pre-2026-09-14 losteria.net-measured body is still physically present ABOVE the supersession heading — read the served document past that heading, not from the top |
| `domain_spec--imagery-and-iconography--APPEND.md` | `domain_spec/imagery-and-iconography` | append (hero photograph), applied v1 → v2 |
| `domain_spec--imagery-and-iconography--APPEND-2.md` | `domain_spec/imagery-and-iconography` | append (icon and illustration placement, first confirmations), applied v2 → v3 |
| `domain_spec--imagery-and-iconography--APPEND-3.md` | `domain_spec/imagery-and-iconography` | append (second icon set, Antipasti Misto removed), applied v3 → v4 |
| `domain_spec--menu--APPEND-ordering-hours-and-pickup.md` | `domain_spec/menu` | append (opening hours, Abholung, device-only saved details), applied v3 → v4 |

The operator supplied a design made in v0 (source in `design/sources/portofino-pizzeria/`)
to replace the previous visual system. The replace discards the reference-site
system — brand red, League Gothic / Oswald / Jost, the spacing and motion append —
so that append's draft was deleted from this folder; git history and the served
document's version history keep it. The imagery append admits the v0 hero
photograph without loosening the dish-imagery rules.

**The `domain_spec/visual-system` row above sat unwritten for 15 days** (drafted
2026-09-14, discovered still at `current_version: 2` on 2026-09-29 — the served
body was still the pre-replace losteria.net spec the whole time) because
writing it needs a `pizzeria`-bound credential and the sessions that drafted it
apparently never held one long enough to also confirm the write landed. Its
sibling rows in this same table (imagery-and-iconography, menu) already carried
version-transition annotations and were not re-verified by this pass — the
warning below applied to exactly one row here, until it didn't.

Check the table's "applied" state against the served versions rather than this
file: a draft here is not evidence it was written.

## 2026-09-11 — earlier writes (still served unless replaced above)

| File | Document | Operation | Result |
|---|---|---|---|
| (deleted — superseded by the replace) | `domain_spec/visual-system` | append | v1 → v2 |
| `domain_spec--imagery-and-iconography.md` | `domain_spec/imagery-and-iconography` | create | v1 |
| `policy--ux-priorities--APPEND.md` | `policy/ux-priorities` | append | v3 → v4, `tightening` |

## How to edit these next

Either paste at `/admin/coord/prompt-documents` with the `pizzeria` tenant
selected, or use the coord write route from a session holding a
**pizzeria-bound** credential. A session bound to another tenant cannot: the
tenant is burned into the device JWT at mint, and every document read and write
resolves the caller's own tenant server-side. An agent cannot mint one itself —
the operator mints a pair code for `pizzeria` in the dashboard, and the agent
redeems it at `POST /api/v1/devices/pair-codes/{code}/redeem`.
