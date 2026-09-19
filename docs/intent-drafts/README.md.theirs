# Intent drafts — pizzeria tenant

Working copies of what was written to the served coord prompt documents for
tenant `pizzeria`. **The served document is the authority, not this folder.** If
they disagree, the served one wins and this copy is stale. Read it with
`/policy get domain_spec visual-system` from a session bound to the `pizzeria`
tenant, or at `/admin/coord/prompt-documents`.

## 2026-09-19 — the pizza mascot and the Kettwig hero (NOT YET APPLIED)

| File | Document | Operation |
|---|---|---|
| `domain_spec--visual-system--APPEND-mascot.md` | `domain_spec/visual-system` | append (owner-ordered mascot exception to `## Motion`), **not yet written** |
| `domain_spec--imagery-and-iconography--APPEND-4.md` | `domain_spec/imagery-and-iconography` | append (hero photograph replaced by the Kettwig mascot illustration), **not yet written** |

The app already ships both. Until they are written to the served documents, the
served `## Motion` ("nothing auto-advances") and hero section disagree with the
app, and the served documents win.

## 2026-09-14 — the v0 design replaces the visual system

| File | Document | Operation |
|---|---|---|
| `domain_spec--visual-system--REPLACE.md` | `domain_spec/visual-system` | **replace** (whole body) |
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
