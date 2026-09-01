# Plan: Portofino — Real Menu Domain and Owner Editor

> **Status: SHIPPED 2026-08-29.** All four phases are live in
> `/d/portofino-pizzeria`. **backend** (`master`, no remote): `8b64d20` variant /
> category / allergen domain model · `28afbc1` the captured menu · `e2a5363`
> vitest on real Postgres · `cf64126` the real-menu loader · `d1a3ee1` the
> owner's editor API · `74551c7` + `b3ef367` ordering fixes. **mobile**
> (`feat/kitchen-dashboard`, **not pushed**): `0af41b4` mirrored types ·
> `9e0490f` German-first variant client · `1ef5049` the editor UI · `7f6b74b`
> bridge text-input fix · `e61b9ea` German a11y labels. **qontinui-dev-notes**:
> `074fba02` the re-derivation report (pushed).
> The real menu is live — **138 items, 208 priced variants, 16 categories, 19
> allergen codes, 100% observed**. 85 backend tests green; both typechecks and
> mobile lint clean; all four phase gates verified on a native Android dev build
> driven over UI Bridge (a groß Margherita ordered through `addToCart` reached
> `paid` at 790 cents, not 490).
> **Phase 1 falsified the plan's central premise** — there is no SPA, and the
> three "uncapturable" categories are simply EMPTY on the owner's own site. See
> "Phase 1 falsified this plan's central premise" for that finding and the four
> coordinator decisions taken on it. **Open items are listed under "What did NOT
> ship"** below — coord was unreachable for this entire run, so no gate was
> registered and none of this is being watched.
> History: DRAFT 2026-08-28; VETTED 2026-08-29 (4 defects, 4 auto-fixed); that
> vet audited the code citations only — the intent-corpus citations remain
> unverified against coord, and this run did not clear that either.
> Resolved-Divergence: 2026-08-31 — folded 1 superseded copy at rung R1 (lineage). This body is `origin/main` blob `575310c0cdea9c00f150eea17d883de24a6c9bb7` at commit `6ad68deb`.
> Superseded bodies: `1374534e32924c9c1d3bf6b27a1993a608fc0d4a` (introduced 10d558e9; held by 28 checkouts).
> Recover any of them with `git cat-file -p <blob-sha>` in `qontinui-dev-notes`.
> Decided by: `git merge-base --is-ancestor <introducing-commit> 6ad68deb` holds for every superseded copy — same lineage, this body is the descendant. No content was read or weighed.

>
> ---
> **The `qontinui-dev-notes` copy of this stem is a RECONSTRUCTION, and its own
> stamp and provenance record are preserved below and in the section that
> follows this block.** It was re-derived on 2026-08-29 because the authoring
> session could not find this document — the very file you are reading. That
> makes it independent corroboration of
> `[[2026-08-21-consolidate-the-two-plan-corpora]]`'s thesis rather than a
> competing account, so it is kept rather than merged away. The body below is
> the original and is SHIPPED; the reconstruction's re-derived body is not
> reproduced, because a reconstruction of a document is superseded by the
> document.
>
> **Status: DRAFT (RECONSTRUCTED) 2026-08-29.** This document is a
> reconstruction, not the original. Coord holds work unit
> `2efc80ab-5604-4b3e-8de3-8bd4f7ec96c9` (slug
> `2026-08-28-portofino-real-menu-domain-and-owner-editor`, title "Portofino -
> Real Menu Domain and Owner Editor", created 2026-08-28T21:46Z, status
> `vetted_unattested` as of 22:39Z) — but **the plan body it refers to exists
> nowhere**. It was re-derived on 2026-08-29 from the operator-ratified
> Portofino intent corpus in `qontinui-dev-notes/prompts/` and from the actual
> `portofino-pizzeria/mobile` source. **Do not treat this body as vetted**: the
> vet that produced `vetted_unattested` was performed against a document no
> longer readable, so this text has not been reviewed by anyone. It needs a
> real `/vet-plan` pass by a peer session before implementation. See
> "Provenance — why this document is a reconstruction" below.
> **Phase 0 is a blocker and is unresolved.**

## Provenance — why this document is a reconstruction

`/implement-plan D:/qontinui-root/plans/2026-08-28-portofino-real-menu-domain-and-owner-editor.md`
was invoked on 2026-08-29 and the file did not exist. It exists in no readable
durable store:

| Store | Probe | Result |
|---|---|---|
| `$QONTINUI_PLANS_DIR` | env | **unset** |
| `<workspace-root>/plans` (the documented fallback) | `ls /d/qontinui-root/plans` | **directory does not exist** |
| `qontinui-dev-notes/plans/` | working tree + `git ls-tree -r origin/main` + `git log --all` | absent (only the three 2026-06 portofino plans) |
| Plan library (production, via runner `GET :9876/plan-library/search`) | `?kind=plan` | **2 artifacts total**, neither portofino — the body sync is off and the write door reports `writeEnabled: false` |
| Local plan cache `C:/claude/plan-corpus-cache/` | `ls` | only `PLANS-CACHE.state.json`; no index, no bodies → **UNKNOWN, not empty** |
| coord | `coord_work_unit_list`, `coord_work_unit_list_citations` | work unit present, 0 citations; coord never stores plan bodies |
| disk | `find` over `D:/qontinui-root`, `D:/pizzeria`, `D:/claude`, `D:/tmp`, `D:/qontinui_parent`, `D:/qontinui-worktrees`, `C:/Users/jspin/Documents` | no match |

**The defect this exposes.** A plan can reach `vetted` in coord with its body
persisted nowhere, silently. Both durable sinks were unavailable at the same
time and neither failure was surfaced to the authoring session:

1. `$QONTINUI_PLANS_DIR` is unset **and** the documented `<workspace-root>/plans`
   fallback directory does not exist on this machine, so a filesystem write had
   no target.
2. The runner's plan-library write door is disabled — `QONTINUI_PLAN_LIBRARY_WRITE`
   is not set, so `POST :9876/plan-library/artifacts` 403s. This is precisely
   the plan-capture protocol the session briefing instructs every session to
   use.

Coord's work-unit row survived because it goes over a different transport. The
result is a *bodyless vetted plan*: the operational layer says work is ready to
dispatch, and the document layer holds nothing. This should be fixed
independently of Portofino — see "Follow-up: close the durability hole".

---

## What did NOT ship (read before trusting the stamp)

1. **coord was unreachable for the whole run**, root-caused: the primary runner
   is down and the supervisor **refuses to restart it** — slot 0 holds an exe
   built from a foreign agent-worktree tree, and recovery needs
   `POST :9875/runner/fix-and-rebuild`, a full rebuild of the live tree into the
   managed slots. That is fleet-infra surgery and was deliberately not run as a
   side effect of this plan. Consequences: no phase claims, no `device_status`,
   no edit-effect loop, and **no gate registered for anything below** — nothing
   here is being watched. Re-register once the runner is rebuilt.
2. **`mobile` is committed but NOT pushed**, and it sits on the pre-existing
   `feat/kitchen-dashboard` branch rather than a branch of this plan's own.
   `backend` and `infra` still have **no git remote at all** — the plan's own
   first Risk, unchanged: the service holding payments and allergens exists on
   one disk. This should be fixed before the editor takes real traffic.
3. **The dataset is faithful to the site as of 2026-08-29, not to the site
   today.** The menu is somebody else's document and changes without telling us.
4. **Open questions 1–5 remain operator calls**, and #1 has been *dissolved
   rather than answered* (see the falsification section). The
   "Corrections to the intent corpus" section is still unactioned — an agent
   cannot write those documents.
5. **Phase 3's gate text is stale.** It asks for "the web build renders all 14
   categories" *and* "a UI-Bridge-driven order" — but this app's bridge server is
   gated `__DEV__ && Platform.OS !== 'web'`, so those are two different targets,
   and the API now serves **16** categories of which **13** render. Verification
   targeted native and checked the shipped behaviour, not the stale wording.

> **Repo(s):** `portofino-pizzeria` — `backend/`, `mobile/` (three sibling git
> repos under `/d/portofino-pizzeria`, no monorepo root; `infra/` is untouched
> by this plan)

## Intent sources — read this before trusting the citations

The `product_intent` / `audience_profile` / `success_metric` / `domain_spec` /
`decision_record` documents cited throughout belong to the **Portofino tenant**
(`7ac125b6-391b-4d64-8493-27305b25c5b9`). **This plan did not read them from
coord.** Three independent walls:

1. `coord-mcp` failed to connect this session (`AUTH_HEADER_REJECTED`, HTTP 401).
2. A device JWT minted from the local runner's UI Bridge binds to tenant
   `c231d9da-0ca8-4fe4-bd81-0e3d6c20339a` (`personal-jspinak`), whose
   `product_intent/*` rows are all still v1 skeletons.
3. The staged pizzeria credential `~/.qontinui/pizzeria_dev_jwt.txt` is
   **expired** — coord answers `{"error":"invalid token"}`. `?tenant_id=`,
   `?tenant=` and `X-Tenant-Id:` are all ignored; the bearer carries the tenant,
   exactly as `portofino-intent-to-publish/PUBLISH-ME.md` states.

The bodies were therefore read from the **authoring source**:
`D:/qontinui-root/portofino-intent-to-publish/*.md` (10 documents), mirrored in
`qontinui-dev-notes/prompts/2026-08-28-portofino-*.md`.

**Whether that corpus was ever published into the pizzeria tenant is UNKNOWN to
this plan.** `PUBLISH-ME.md` is a manual paste checklist dated 2026-08-28 and
nothing observable here says it was executed. A vetter with a pizzeria-bound
credential should re-read the citations against coord before this plan is
stamped VETTED. **Absence of a published document is not evidence the intent
changed.**

### What this vet could NOT check (2026-08-29)

The vetting session hit **the same three walls**, and did not clear any of them:
`coord-mcp` failed to connect again (`AUTH_HEADER_REJECTED`, HTTP 401), and the
session's coord identity resolves to device
`c79a07d5-7e40-49b4-87fa-554c749f9644` on tenant
`c231d9da-0ca8-4fe4-bd81-0e3d6c20339a` (`personal-jspinak`) — **not** the
Portofino tenant. So the `product_intent` / `audience_profile` /
`success_metric` / `domain_spec` / `decision_record` citations throughout this
plan are **still unverified against coord**, and this VETTED stamp does not
assert them.

What the vet DID verify is the other half, and it verified all of it: every
file path, line number, symbol, absence-claim and git-state claim about
`/d/portofino-pizzeria`. Read the stamp accordingly — **the code claims are
audited; the intent claims are carried forward at the author's word.**

## Why

### The architecture already matches the accepted decision

`decision_record/build-the-permanent-thing` (ACCEPTED 2026-08-28) supersedes
`webview-handoff-is-temporary` and names one first deliverable:

> The replacement website, with the owner-authored menu, taking orders
> **directly** — on the own-site channel only.

Two thirds of that exist and are sound. `/d/portofino-pizzeria` is a real
direct-ordering stack: Fastify + Drizzle + Postgres, Stripe hosted checkout with
a mock fallback (`backend/src/payments/`), the
`pending_payment → paid → preparing → ready` lifecycle
(`backend/src/lib/order-service.ts`), a kitchen dashboard
(`mobile/src/app/kitchen.tsx`), an Expo web/native customer app, and Terraform
for AWS. **The webview hand-off was never built**, so the superseded record needs
no unwinding — there is nothing to remove.

The superseded MVP roadmap
(`qontinui-dev-notes/plans/2026-06-13-portofino-pizzeria-app-kickoff.md:108`)
still records **"Backend | ❌ Not needed"**. That row is what
`build-the-permanent-thing` overrode, and the code has already moved past it.

### The gap is the menu, and it is a model gap, not a content gap

The database is seeded with **20 invented English items** —
`'San Marzano tomato, fior di latte, fresh basil, EVOO.'`
(`backend/src/db/seed.ts:19`),
`"Ask your server for today's flavours."` (`seed.ts:44`) — against Portofino's
real **14-category, ~130-item German** menu, harvested at
`qontinui-dev-notes/plans/2026-06-28-portofino-menu-data.md`.

Swapping the seed rows would not fix this. The schema cannot represent the real
menu. Measured against `domain_spec/menu`:

| Behaviour | Required | Actual |
|---|---|---|
| (1) item number is identity, not decoration | number per item | **absent** — slug PK only (`backend/src/db/schema.ts:13`). Real menu numbers items `1`…`135`, including `76a`, `76b`, `76c`, `109a` |
| (2) sizes are per-item, not global | klein/groß/Blech, groß-only, Schwein/Pute, single | **absent** — one `price: integer('price')` (`schema.ts:17`); `MenuItem.price: number` (`backend/src/types.ts:12`) |
| (3) allergen codes resolve to a legend; unresolved shows *unknown*, never omitted | codes + legend | **absent entirely** — `grep -rni allergen backend/src mobile/src infra` returns **zero hits**. Codes `d` and `i` are also still unresolved (`2026-06-28-portofino-menu-data.md:14-17`) |
| (4) German authoritative, English an addition | German first | **inverted** — all content English; UI labels hardcoded `'Sides'`, `'Drinks'` (`mobile/src/app/index.tsx:20-21`). `product_intent/non-goals` §5 forbids English-first |
| (6) menu reads without a network | cached read | **absent** — `api.getMenu()` on mount (`mobile/src/app/index.tsx:37-50`), hard error screen on failure (`:78-90`), spinner until it resolves (`:92-98`). The only storage in the app is the kitchen token (`mobile/src/lib/kitchen.ts:12-24`) |
| (8) owner can edit it; the editor is a safety surface | authenticated editor + validation | **absent entirely** — the only auth in the backend is a shared kitchen bearer token (`backend/src/routes/kitchen.ts:11-16`) |

`(2)` is the sharpest: **every pizza on the real menu has two or three prices**
(`1 Margherita 4.90/7.90/21.00`), some have exactly one
(`13 Calzone —/10.90/—`, `27 de Pollo`, `28 Portofino`, `29 de Parma`), Salate
are klein/groß, Schnitzel are Schwein/Pute and Schweinefilet is
Schwein/Hähnchen. A single-price column is wrong for the majority of the
catalogue, and `createOrder` prices lines straight off it
(`backend/src/lib/order-service.ts:99`, `unitPrice: m.price`) — so the pricing
path has to change with the model, not after it.

`MenuCategory` is a closed four-value union duplicated in
`backend/src/types.ts:5` and `mobile/src/lib/types.ts:4`, with the ordering
hardcoded again at `mobile/src/app/index.tsx:24`. Fourteen categories cannot be
expressed without touching all three.

### Why this is the work that moves the metric

`success_metric/commission-paid` is only moved by orders completing in a channel
Portofino owns. `build-the-permanent-thing` stages **traffic**, not the build:
day one serves the ~€2,000/month who already arrive at `portofino-essen.de`.
Those diners arrive expecting the menu they have always ordered from. A German
menu with the right numbers, the right sizes and correct allergens is not
polish — it is the precondition for the cutover that produces the first
commission event in the whole strategy.

And per `audience_profile/hungry-diner`, *"discovering an item is unavailable
after choosing it"* and a wrong price are named intolerances; per
`audience_profile/owner-operator`, *"a second menu that drifts from the real
one"* is **worse than having no app**.

## Design decisions

### D1 — How per-item sizes are modelled

| Option | For | Against |
|---|---|---|
| Three nullable price columns (`price_klein`, `price_gross`, `price_blech`) | smallest diff | encodes the pizza shape into every row; Schnitzel Schwein/Pute and Schweinefilet Schwein/Hähnchen do not fit it, and `domain_spec/menu` (2) explicitly warns *"a model assuming three sizes is wrong for real items on this menu today"* |
| JSON column of variants | flexible, one table | prices become unvalidatable by the DB, and the editor's *"validation refuses impossible states"* requirement (`domain_spec/menu` 8) then lives only in application code |
| **Child table `menu_item_variants`** — `(item_id, label, sort_order, price_cents)` | one row per real purchasable thing; a one-price item is one variant; NOT NULL price makes "a size with no price" unrepresentable; order lines reference a variant, so pricing stays server-side | one extra join |

**Resolved: child table.** Deciding priority — **robustness**: it makes the
malformed states `domain_spec/menu` (8) demands be refused, *unrepresentable*
rather than merely validated.

### D2 — How allergen codes are stored

Codes are stored **verbatim** as harvested, plus an `allergen_legend` table
mapping code → German label → optional English label. **A code with no legend
row renders as "unknown", never dropped.** `domain_spec/menu` (3) calls silent
omission *"the worst failure available here"*, and states plainly that unknown
is better than absent.

**Codes live in a `text[]` column on the item, NOT a join table with an FK to
`allergen_legend`.** The vet found this fork left open — the original wording
offered both — and the two options are not interchangeable here: an FK join
table makes a code with no legend row **unrepresentable**, so the Phase-3 loader
would be forced either to drop `d` and `i` or to invent legend rows for them.
Dropping is the exact silent omission (3) names as the worst failure available;
inventing is a fabricated legal label. A plain `text[]` stores what the site
said and lets the render path resolve — or fail honestly to *unbekannt*.

**Resolved: `text[]` on the item.** Deciding priority — **robustness**: it is
the only one of the two that keeps this decision's own core invariant
representable. Note this is the one place where the "make bad states
unrepresentable" instinct from D1 gives the WRONG answer, because here the
"bad" state (an unresolved code) is a real fact about the source document that
must survive into the UI.

Deciding priority for the surrounding rule — the **UX priority "honesty about
uncertainty"** on a legal/safety surface. It also means `d` and `i` staying
unresolved does not block shipping the model; it blocks shipping *to a diner*,
which is Phase 1's job.

### D3 — Where German lives

`name` / `description` are **German and authoritative**; `name_en` /
`description_en` are nullable additions. A missing translation renders the
German, never a gap (`domain_spec/menu` 4). Item names are proper nouns and are
never translated.

**Resolved.** Deciding priority — `product_intent/non-goals` §5 ("not
English-first") is a stated boundary, not a preference.

### D4 — Categories become data

Replace the `MenuCategory` union (`backend/src/types.ts:5`,
`mobile/src/lib/types.ts:4`) with a `menu_categories` table carrying `id`,
German `label`, optional `label_en` and `sort_order`; the API returns categories
with the menu and the app renders in the returned order, deleting the hardcoded
`CATEGORY_LABELS` / `CATEGORY_ORDER` (`mobile/src/app/index.tsx:18-24`).

**Resolved.** Deciding priority — **scalability**: the owner adds and reorders
categories in the editor (Phase 4); a union would put that behind a redeploy.

### D5 — The editor does NOT reuse `KITCHEN_TOKEN`

The kitchen guard is a single shared secret, skipped entirely when unset
(`backend/src/routes/kitchen.ts:12`), designed for a screen already behind the
counter. The menu editor writes allergens and prices that reach diners, from a
phone, after close. It gets its own credential and its own route namespace.

**Resolved.** Deciding priority — **robustness**; and `audience_profile/owner-operator`
names allergen loss as the failure with real-world consequences.

### D6 — Phase order is most-falsifiable-first

Phase 1 (re-derive from the live site) runs **before** the schema, not after,
for two reasons. It retires the largest unknown — whether the three JS-rendered
categories can be captured at all — and `domain_spec/menu` instructs that when
the divergence list is worked, the menu should be *"re-derive[d] against the
live site rather than against the harvest — the menu is somebody else's document
and it changes without telling us."* The harvest is two months old. Designing a
variant model against a stale partial harvest would be building on the thing the
spec says not to trust.

**Resolved.** Deciding priority — **implementation priority "early risk
retirement"**.

## Discovered prior art (verified 2026-08-28)

| Piece | Location | Notes |
|---|---|---|
| Menu harvest, 11 of 14 categories with numbers, sizes, prices | `qontinui-dev-notes/plans/2026-06-28-portofino-menu-data.md` | Phase 1's baseline to diff against, **not** its source of truth |
| Allergen legend, 17 codes, 2 unresolved | same, lines 14-17 | `d` and `i` unknown; codes *"rendered slightly inconsistently across pages"* |
| Server-side pricing, client prices never trusted | `backend/src/lib/order-service.ts:86-102` | Keep this property through the variant change — extend the lookup, do not relax it |
| Line-item snapshotting (name + unitPrice copied at order time) | `backend/src/db/schema.ts:53-62` | Historical orders already stable against menu edits; the editor in Phase 4 inherits this for free |
| `available` boolean already on items | `backend/src/db/schema.ts:21`, filtered at `backend/src/routes/menu.ts:14` | Partial credit for `domain_spec/menu` (5); what a *stale* flag shows is still undecided — see Open questions |
| Drizzle migration flow | `backend/drizzle/0000_parallel_preak.sql`, `npm run db:generate` / `db:migrate` | Schema changes go through generated SQL, not hand-edits |
| UI Bridge ids derived from menu slugs (`menu-add-<id>`) | `backend/src/db/seed.ts:5-6`, `mobile/src/app/index.tsx:52-65` | Slug ids must survive the re-model or the bridge action ids break |
| Category grouping + render loop | `mobile/src/app/index.tsx:68-131` | The surface D4 rewrites |
| **Cart state, keyed on `item.id`, subtotal computed off `item.price`** | `mobile/src/state/cart.tsx:12-60` | ⚠️ **Breaks under D1** — `add`/`setQuantity`/`remove` all dedupe by `item.id` alone (`:34,47,53`) and `subtotal` reads `l.item.price` (`:60`), a field D1 deletes. Two sizes of one pizza would collapse into one line. Added by vet — see Phase 2/3 inventories |
| **UI Bridge `addToCart` semantic action — takes only `itemId`** | `mobile/src/app/index.tsx:53-66` | ⚠️ **Breaks under D1**, and it is what Phase 3's gate drives. Distinct from the `menu-add-<id>` button `uiId` (`:119`), which the slug PK does protect. Added by vet |
| Order request shape, item-keyed on both sides | `mobile/src/lib/api.ts:34-35`, `backend/src/routes/orders.ts:7-11` | ⚠️ `{menuItemId, quantity}` and its zod validator must both carry a variant. Added by vet |
| Cart screen price rendering | `mobile/src/app/cart.tsx:57,80` | ⚠️ Two more `item.price` reads. Added by vet |
| Existing German source of truth incl. Lieferung/Abholung selector | `qontinui-dev-notes/plans/2026-06-13-portofino-pizzeria-app-kickoff.md:21-24` | Records that the live site offers **pickup**, which the current checkout does not |

## Phase 1 falsified this plan's central premise (implementation run, 2026-08-29)

Phase 1 ran first precisely so a wrong assumption would die cheaply (D6). It did.

**There is no SPA.** `portofino-essen.de` is WordPress 6.8.8 + WPPizza 3.17.4,
server-rendered throughout; "Delivery Way" is the host's footer branding, not a
front-end framework. No browser automation was needed and none would have
helped. Hähnchenbrust, Rumpsteak and Dessert return nav-only because their
`entry-content` is **literally empty** — four independent probes agree (nav page,
WPPizza taxonomy archive `0 posts`, site search no-results, term absent from the
taxonomy sitemap, which lists only non-empty terms).

So `open-questions` #4 as written — *harvest-first, or hand the owner the gap?* —
**is not a live choice.** It presumed the data existed behind JavaScript. It does
not exist at all: the owner's own website has three empty menu sections. There is
nothing to harvest, and no capture technique changes that. The only path to those
three categories is the owner typing them, which is exactly what Phase 4 builds.

Coverage is proven rather than asserted: the site publishes
`wp-sitemap-posts-wppizza-1.xml` listing **138** WPPizza posts, and the dataset
holds exactly 138 unique items.

### Coordinator decisions taken on that finding

1. **Proceed on the 13 non-empty categories.** The plan's "do not proceed on a
   partial capture without an operator decision" guard was written against a
   *capture failure*. This is not one — the capture is complete with respect to
   the source. Blocking on it would stall the plan behind data that does not
   exist anywhere.
2. **Load the three empty categories as rows anyway.** They are real headings on
   the owner's site and become the editor's first job. An empty category is not
   a validation failure; the client renders only non-empty ones.
3. **`number` stays nullable, and 28 numberless items ship.** Phase 1's own gate
   asserted "every item has a number" and that assertion is wrong about the
   source: Portofino prints no number for its 11 drinks, 9 Angebote, 6 sauces and
   2 Vorspeisenteller. Phase 2 had already made the column nullable for exactly
   this reason. Inventing identity is worse than absent identity.
4. **`Antipasti Misto` (2 priced items) ships.** A 16th category exists on the
   site with **no nav entry** — reachable only by direct URL. It is real,
   published, priced content; hiding it would be the drift
   `audience_profile/owner-operator` warns about, in the other direction. The
   owner can hide it from the editor once Phase 4 lands.

### What Phase 1 also settled

- **`d` = Senf, `i` = Erdnüsse** — resolved from the site's own `title=`
  attributes and on-page legend blocks. Nothing guessed. The legend grew 17 → 19
  codes, and the harvest's `9 = Coloring` was **wrong**: the site says
  `geschwärzt`.
- **Zero price drift** across 195 price points in two months. Zero removals, 13
  additions (mostly harvest extraction misses — Mexikanisch is 30 items, not ~20).
- **Open question 3 is unanswerable from the site.** There is no per-item
  availability source at all — no sold-out markers anywhere, only shop-level
  opening hours. `available: true` throughout records *absence of a source*, not
  stock knowledge.
- **Pickup is not a price axis.** One price set per item; `compat.puDel=1` moves
  the choice into the AJAX cart. Only the two Mittwochs-Angebote are
  pickup-differentiated (`für Selbstabholer`). Checkout-side pickup discounts
  remain unknown — a live business's checkout was deliberately not driven.

## Phases

**Phase 1 — Re-derive the menu from the live site (assumption-killer)**

- Capture all **14** categories from `https://portofino-essen.de/` with
  browser-based comprehension, not a static fetch. `2026-06-28-portofino-menu-data.md:149-152`
  records that **Hähnchenbrust, Rumpsteak and Dessert are rendered by the
  Delivery Way SPA** and return nav-only to a static fetch. Whether they can be
  captured is the open technical risk in this plan and it is retired here.
- Capture the site's **official allergen legend** and resolve `d` and `i`
  (`2026-06-28-portofino-menu-data.md:14-17`). If the site does not state them,
  stop and escalate — do not guess a legal label.
- **Diff the result against the 2026-06-28 harvest** and record every change:
  the menu has been free to move for two months and is somebody else's document.
- Record whether the site expresses **availability** at all
  (`domain_spec/menu` (5): *"has no source at all"*), and whether pickup
  (`Abholung`) pricing differs from delivery.
- Output: a machine-readable menu dataset (JSON) with provenance per item —
  `observed` vs `inferred` — checked in beside the harvest.
- **Do not proceed to Phase 2 on a partial capture without an operator
  decision.** `build-the-permanent-thing` makes the three missing categories
  blocking for cutover: shipping without them makes an incomplete menu
  authoritative and silently hands the owner the gap as data entry
  (`product_intent/open-questions` #4).
- Gate: the dataset covers 14/14 categories, every item has a number and at
  least one priced variant, and every allergen code appearing on an item exists
  in the legend or is explicitly listed as unresolved. Diff report reviewed.

**Phase 2 — Menu domain model**

- New tables in `backend/src/db/schema.ts`: `menu_categories` (D4),
  `menu_item_variants` (D1), `allergen_legend` (D2); `menu_items` gains
  `number` (text — `76a` is real), German-authoritative `name`/`description`
  plus nullable `name_en`/`description_en` (D3), and an allergen-code
  association. Drop `price` from `menu_items`; drop `vegetarian`/`spicy` in
  favour of the legend (`V` is already an allergen-key code in the harvest).
- Keep the slug `id` as PK so `menu-add-<id>` UI Bridge action ids survive
  (`backend/src/db/seed.ts:5-6`).
- `backend/src/types.ts`: replace the `MenuCategory` union (line 5) and
  `MenuItem.price` (line 12) with the category/variant/allergen shapes; mirror
  verbatim into `mobile/src/lib/types.ts` — that file's own header says it
  mirrors the backend, and nothing enforces it, so the two edits are one unit
  of work.
- `backend/src/routes/menu.ts`: return `{ categories, items, allergenLegend }`;
  items carry variants and codes. Unresolved codes are returned, flagged
  unresolved — never filtered out.
- `backend/src/lib/order-service.ts`: order lines reference a **variant**, not
  an item. Preserve the server-side price lookup (`:86-102`) and the
  `available` refusal (`:95`); extend the line snapshot to record the variant
  label so a historical order still reads "Margherita, groß". The lookup
  currently reads `unitPrice: m.price` straight off the item row (`:99`) — that
  is the line D1 invalidates, and it must resolve through the variant instead.
- **`backend/src/routes/orders.ts:7-11`** — the `createOrder` zod schema
  validates `{ menuItemId, quantity }`. It must carry a variant id, and reject a
  request that names an item without one; otherwise the API silently accepts an
  order that `order-service` can no longer price. *(Added by vet — the phase
  changed the pricing path without changing the door in front of it.)*
- `npm run db:generate` for the migration; hand-review the SQL.
- Gate: `cd backend && npm run typecheck` clean; `npm run db:migrate` applies on
  a fresh local Postgres; `GET /api/menu` returns the new shape; an order
  created against a groß variant prices at the groß price and rejects an
  unknown variant.

**Phase 3 — Load the real menu and render it German-first**

- Replace `backend/src/db/seed.ts:17-45` wholesale with a loader over Phase 1's
  dataset. The invented catalogue goes; nothing in it is Portofino's.
- `mobile/src/app/index.tsx`: delete `CATEGORY_LABELS`/`CATEGORY_ORDER`
  (`:18-24`) and render from the API's categories in the API's order; show item
  **number**, all **variants** with per-variant prices, and **allergen codes**
  resolved through the legend with unresolved codes shown as *unbekannt*.
  Add-to-cart selects a variant.
- **`mobile/src/state/cart.tsx` — a cart line becomes (item, variant), not
  item.** `add`/`setQuantity`/`remove` currently key on `item.id` alone
  (`:34,47,53`), so a klein and a groß Margherita would merge into one line at
  one price; and `subtotal` reads `l.item.price` (`:60`), which D1 deletes.
  Re-key every one of them on `(itemId, variantId)` and compute the subtotal off
  the variant. **`mobile/src/app/cart.tsx:57,80`** renders `item.price` twice and
  follows. *(Added by vet — the plan's file inventory did not name this module,
  and it is where the variant model actually lands in the client.)*
- **Extend the UI Bridge `addToCart` action to take a variant**
  (`mobile/src/app/index.tsx:53-66`). Today its handler destructures only
  `{ itemId }` and calls `cart.add(item)`. The prior-art note that "slug ids must
  survive or the bridge action ids break" covers the `menu-add-<id>` **button
  uiId** (`:119`) — the slug PK does protect that — but the semantic **action**
  is a separate surface and the slug does not save it: with two or three prices
  per item, `addToCart({itemId})` has no way to say *which*. Accept
  `{ itemId, variantId }` and refuse a multi-variant item with no `variantId`
  rather than silently picking the first. *(Added by vet.)*
- German throughout the customer-facing UI; `checkout.tsx:72,97` ("Delivery
  details", "Address") included.
- Prices render exactly as sourced — no rounding, no "ab €X"
  (`domain_spec/menu` (8), second one).
- Cache the last successful menu response and read it when the network fails,
  closing `domain_spec/menu` (6); show the cache's age rather than pretending
  it is live.
- Gate: `cd mobile && npm run lint` and `npx tsc --noEmit` clean; the web build
  renders all 14 categories in German with numbers, variants and allergens; a
  UI-Bridge-driven order of a groß pizza reaches `paid`; airplane-mode load
  shows the cached menu.
  > ⚠️ **The UI-Bridge half of this gate is unsatisfiable unless the `addToCart`
  > bullet above ships with it** — `addToCart` cannot currently express "groß",
  > so "a UI-Bridge-driven order of a groß pizza" has no way to be driven. On
  > this fleet UI Bridge is the mandated frontend verification path
  > (`knowledge-base/qontinui-specific/ui-bridge.md`), so an unsatisfiable
  > bridge gate does not degrade to a manual check — it blocks the phase exit.
  > *(Added by vet.)*

**Phase 4 — The owner's menu editor (safety surface)**

- Owner credential and `/api/admin/menu/*` routes, separate from
  `KITCHEN_TOKEN` (D5).
- Editor UI, **German-first, phone-first**, usable by someone who last saw it
  six months ago (`audience_profile/owner-operator`).
- The four safety properties from `domain_spec/menu` (8), each an explicit
  test: allergens cannot be lost silently — saving an item with no allergen
  data is a deliberate, confirmed act; validation refuses impossible states —
  a variant with no price, a price with no variant, an unknown allergen letter;
  an interrupted edit leaves the previous good version live; a half-saved item
  never reaches a diner.
- Gate: **this phase needs a test harness that does not exist yet** — see
  Risks. At minimum, an automated suite covering the four properties above must
  land with it; a typecheck is not a gate for a legal surface.

## Risks

- **The backend and infra repos have no git remote.** `git -C
  /d/portofino-pizzeria/backend remote -v` and the same for `infra/` return
  **nothing**; both sit on local `master`, `infra/` with uncommitted changes to
  `database.tf`. Only `mobile` has an origin
  (`github.com/portofino-pizzeria/mobile`), and it is on
  `feat/kitchen-dashboard`. The service that will hold payments and allergens,
  and the Terraform holding production state, exist on one disk. This is not
  caused by this plan and should be fixed before Phase 4 puts a safety surface
  in there.
- **There is no test framework in either repo.** `backend/package.json` has no
  `test` script and no test dependency (`@types/node`, `drizzle-kit`, `tsx`,
  `typescript`); `mobile` has only `expo lint`. Phases 1–3 can gate on
  typecheck plus manual/UI-Bridge verification, but Phase 4's allergen-loss
  properties cannot honestly be gated that way. Standing up a runner is
  in-scope for Phase 4 and is the reason Phase 4 is last.
- **Phase 1 may not be able to capture the three SPA categories.** That is the
  point of running it first. If it fails, `product_intent/open-questions` #4
  becomes an operator decision (harvest-first vs. hand the owner the gap) and
  Phases 2–3 can still proceed on 11 categories — but cutover cannot.
- **The live menu may have moved since 2026-06-28.** Expected, and why Phase 1
  diffs rather than assumes. A large diff is information, not a blocker.
- ~~**Dropping `vegetarian`/`spicy` in favour of legend codes** loses a filter
  the app currently renders.~~ **Corrected by vet (2026-08-29): there is no such
  filter, and nothing renders them.** `grep -rn 'vegetarian\|spicy' mobile/src/`
  returns exactly two hits, both type declarations
  (`mobile/src/lib/types.ts:13-14`). The backend seeds them
  (`backend/src/db/seed.ts:13-14`) and `GET /api/menu` returns them
  (`backend/src/routes/menu.ts:24-25`), but **no consumer reads either field** —
  the menu card renders name, description, price and an Add button and nothing
  else (`mobile/src/app/index.tsx:107-131`). So this is a dead-column deletion
  with zero user-visible effect, not a regression to weigh, and the "confirm the
  harvest's `V` code covers what the boolean did" step is unnecessary — delete
  the columns in Phase 2 and the two type fields with them.
- **`portofino-essen.de` is the live business.** Phase 1 reads it; nothing in
  this plan writes to it, and no capture should place load on it during service
  hours (Mo, Wed–Fri 12:00–22:00; Sat–Sun 13:00–22:00; closed Tuesdays).

## Corrections to the intent corpus (for the operator — an agent cannot write these)

`domain_spec/menu`'s "Known divergences" closes with:

> **Unrelated but adjacent:** the recorded phone number `0205415883` is
> suspect — Essen's area code is 0201, so `0201 5415883` is likelier.

**This is wrong. `0205415883` is correct** and is the number published on
`portofino-essen.de` (operator, 2026-08-28). Nothing in this plan changes a
phone number, and no future session should "fix" it.

The document should be corrected at the source. Prompt documents are
append-and-version-only and **tenant-bound to the bearer**, so no agent session
on this machine can edit it — the correction has to be made by the operator at
`/admin/coord/prompt-documents` with the tenant switcher on Portofino. The same
edit should carry the `repos: []` fill-in the document asks for: `repos: []` is
declared UNKNOWN, and the answer is now known — `portofino-pizzeria`
(`backend/`, `mobile/`).

## Open questions

Operator-only calls. None blocks Phases 1–3; #1 blocks cutover and #4 blocks
Phase 4 going live.

1. **`open-questions` #4 — harvest-first or hand the owner the gap?** If Phase 1
   cannot capture Hähnchenbrust, Rumpsteak and Dessert, does cutover wait, or
   does the owner type them as their first act in the editor?
   `build-the-permanent-thing` says capture first; the fallback is a decision,
   not a discovery.
2. **`open-questions` #7 — who runs the marketing, on what budget?** Unchanged
   by this plan and still the largest item in the corpus: ~€280/month is the
   ceiling on what the own-site channel can save, and everything above it
   arrives through a campaign with no owner named. This plan builds the thing
   the campaign would point at; it does not create the campaign.
3. **`domain_spec/menu` (5) — what does a stale availability flag show?** The
   site appears to express no availability at all, and per
   `audience_profile/owner-operator` nothing gets updated during service. The
   spec requires the model to say what a stale flag displays; nobody has
   decided.
4. **`open-questions` #6 — who is on the hook when ordering is down at 19:30 on
   a Saturday?** The editor in Phase 4 makes the owner responsible for menu
   correctness on a surface diners read. That responsibility should be accepted
   deliberately, before it is handed over.
5. **Pickup (`Abholung`).** The live site offers a Lieferung/Abholung selector
   (`2026-06-13-portofino-pizzeria-app-kickoff.md:21-22`) and the real menu has
   pickup-only offers (*"Mittwochs-Angebot 1a … nur Abholung"*). Our checkout is
   delivery-only with a flat €2.99 fee (`backend/src/config.ts:44`,
   `mobile/src/app/checkout.tsx:72`). Pickup is mostly cash and carries **no
   commission at all** (`success_metric/commission-paid`, trap 5), so it may be
   the cheapest channel to own — but adding it is scope beyond this plan and
   should be its own decision.

## Related

- `[[2026-06-13-portofino-pizzeria-app-kickoff]]` — the superseded MVP roadmap
  ("Backend ❌ Not needed"); this plan is downstream of its reversal.
- `[[2026-06-13-portofino-functional-spec-starter]]`
- `[[2026-06-28-portofino-menu-data]]` — the harvest Phase 1 re-derives and
  diffs against.
- Intent corpus staged at `D:/qontinui-root/portofino-intent-to-publish/`,
  mirrored in `qontinui-dev-notes/prompts/2026-08-28-portofino-*.md`.
