# Portofino — the privacy policy (Datenschutzerklärung), and fixing the four things it would otherwise have to confess (2026-09-20)

> **Status: IN PROGRESS 2026-09-24 — Phases 1-4 MERGED; Phase 1's mobile half,**
> **5 and 6 MERGED via [mobile#35](https://github.com/portofino-pizzeria/mobile/pull/35)**
> **(admin/privacy.tsx bugfixed by an independent review in**
> **[mobile#36](https://github.com/portofino-pizzeria/mobile/pull/36));**
> **one deliverable of Phase 5 stays owed (below) — everything else buildable**
> **by an agent has landed.**
>
> | Phase | State | Where |
> |---|---|---|
> | 1 — the order read stops leaking (backend half) | **MERGED** | backend#23 superseded by [backend#26](https://github.com/portofino-pizzeria/backend/pull/26), `9fd5c98` |
> | 1 — the thin mobile half (`my-orders.ts`) | **MERGED** | [mobile#35](https://github.com/portofino-pizzeria/mobile/pull/35) — `src/lib/my-orders.ts`, `api.ts` (token round-trip), `checkout.tsx`, `order/[id].tsx` (the `customerRedacted` third branch) |
> | 2 — retention and erasure mechanics | **MERGED** | backend#26 |
> | 3 — log minimisation (backend half) | **MERGED** | backend#26 |
> | 3 — log retention (infra half) | **MERGED** | [infra#10](https://github.com/portofino-pizzeria/infra/pull/10), `4d03a15` |
> | 4 — the data-subject endpoints | **MERGED** | backend#26 — `src/routes/admin-privacy.ts`, `src/lib/personal-data.ts` |
> | 5 — the page, its text, the intent correction | **MERGED except the intent correction** | [mobile#35](https://github.com/portofino-pizzeria/mobile/pull/35) — `mobile/src/app/datenschutz.tsx`; see "Owed", below |
> | 6 — the admin section | **MERGED** | [mobile#35](https://github.com/portofino-pizzeria/mobile/pull/35) — `mobile/src/app/admin/privacy.tsx`, `adminPrivacyApi` in `lib/admin.ts`; two bugs (a lost erasure message, a 401 not re-prompting for the owner password) fixed by [mobile#36](https://github.com/portofino-pizzeria/mobile/pull/36) |
>
> This document is [mobile#33](https://github.com/portofino-pizzeria/mobile/pull/33) (merged).
>
> **Why Phase 1's mobile half stopped being optional.** Once backend#26 merged
> (2026-09-21) and deployed, `GET /api/orders/:id` started returning
> `customerRedacted: true` to every caller that sends no token — which was
> every mobile build, since nothing wrote or sent one. The order-status screen
> (`order/[id].tsx`) could not tell that apart from a delivery order with a
> genuinely missing address, so it rendered the red "Keine Lieferadresse
> hinterlegt" error on **every** delivery order's own confirmation screen,
> including the one the diner who just placed it is looking at. This was a
> live regression, not a cosmetic gap, discovered by mobile#32's post-merge
> follow-up while checking `Order.customerRedacted` for callers — it had none —
> and fixed in the same session rather than filed for later.
>
> **What Phase 5 still owes.** D2 §2's sentence about "Angaben merken" being
> § 25 (1) TDDDG consent is **not** in the shipped page: it depends on an
> APPEND to `domain_spec/menu` correcting the stale pre-D3 default, which needs
> a pizzeria-bound credential this session's device JWT does not carry (acting
> tenant resolves to `qontinui`, not `pizzeria` — the same limitation this
> plan's own VETTED status recorded). D2 §4's exact Stripe transfer mechanism
> (which SCCs or equivalent apply) is marked `wird ergänzt` on the page for the
> same reason it was marked owed here: it is the operator's fact to confirm,
> not one this session can derive. Both are named on the page or in this
> document rather than guessed.
>
> **Pre-PR review.** An independent agent read the whole backend diff before
> backend#23 opened and raised **13 findings**; all are closed in `a59fee1`.
> Four mattered: the journal `when` hazard below (high); missing
> `drizzle/meta/` snapshots, which would have made the next `drizzle-kit
> generate` emit a migration that fails on apply; the phone number in the
> request log, below; and a TOCTOU in `forget` that could have erased the
> address of a delivery the kitchen had just started. It found nothing in four
> categories it probed specifically — SQL injection in the phone search, any
> unauthorised path to the token or the customer block, the advisory-lock and
> marker logic, and the month/year arithmetic.
>
> **Gates run 2026-09-20, on a real local Postgres (`backend-db-1`, postgres:16):**
> `npm test` **247 passed / 15 files** (baseline at `a81da55` was 185/11), and
> `npx tsc --noEmit` clean, after each of the four phases. Infra:
> `terraform fmt -check -recursive -diff` exit 0 and `terraform validate`
> *Success* on Terraform **1.15.8** — the version `infra/.github/workflows/ci.yml`
> pins; the box's own 1.9.8 is below the repo's `>= 1.10` floor and cannot even
> init. **Not run, and not claimed:** `terraform plan` / `apply` (CI holds no
> AWS credentials and an operator applies), and every Phase 5/6 gate.
>
> **Deviations from the plan as vetted, each deliberate:**
> - **Phase 1's mobile half was NOT built.** `mobile/src/lib/my-orders.ts`, the
>   write at `checkout.tsx:352` and the read at `order/[id].tsx:112` are still
>   owed. It is *not* blocked by mobile#32 — those three files exist on
>   `origin/main` — it was simply out of this run's commissioned scope. **Until
>   it lands, every diner's order screen shows the redacted shape**, because no
>   client sends the token. `customerRedacted: true` is what keeps that a
>   degradation rather than the red *"Keine Lieferadresse hinterlegt"* error;
>   the third branch that renders it is Phase 5's. Ship the mobile half with,
>   or before, the backend PR.
> - **A wrong token is `401`, not the redacted shape.** The Phase 1 gate lists
>   "a wrong token is refused" as an outcome distinct from the tokenless read,
>   so it is one. A malformed or empty `Authorization` header is treated as *no*
>   token, so a proxy that mangles it degrades rather than 401s.
> - **`requireOwnerAuth` was extracted into `src/lib/owner-auth.ts` on this
>   branch too**, byte-identical to backend#22's copy, because `owner-auth.ts`
>   does not exist on `origin/master` — it is part of #22. Identical content
>   means the two land without conflicting.
> - **The phone search is `POST /api/admin/orders/search` with the number in the
>   BODY**, not D5's `GET …?phone=…`. The request logger keeps `url` on every
>   incoming request, so a query parameter would write a diner's phone number
>   into the very CloudWatch logs D4 exists to minimise — on the request whose
>   whole purpose is to honour that diner's privacy rights. It is D3's own
>   argument about the order token, applied to the same data one surface over.
>   **D5's wording should be corrected to match.**
> - ⚠️ **Migration numbering, and a real hazard D3 did not see.**
>   `0006_order_access_token.sql` and `0007_retention.sql`, leaving `0005` free
>   for backend#22 as D3 says. But **"the gap is inert" is only half true.**
>   drizzle's migrator reads the NEWEST applied row and applies every journal
>   entry whose `when` is strictly greater
>   (`drizzle-orm/pg-core/dialect.js`). backend#22's `0005_shop_facts` carries
>   `when: 1789855087555`, **below** this branch's — so on a database that has
>   applied 0006/0007, #22's 0005 is **silently skipped**, with no error, and
>   `shop_profile`'s legal columns never appear. No choice of `when` survives
>   both merge orders. **Whichever of the two branches merges SECOND must
>   renumber its migration and re-stamp its `when` above everything already in
>   the journal.** Written into the 0006 header; a test asserts the journal's
>   `when` values are sorted and that tags and files correspond.
> - **Phase 3's infra probe found SIX log groups, not two.** See the Phase 3
>   note below; four are orphans Terraform cannot reach, and they are an
>   operator item.
>
> **Coord: no work unit exists, and none was created.** The only live
> credential on this box is bound to tenant `c231d9da-…`
> (`~/.qontinui/machine.json`), not Portofino `7ac125b6-391b-4d64-8493-27305b25c5b9`.
> `GET /coord/work-units?slug=…` answers `tenant_not_resolved` and
> `coord-agent-refresh.sh` answers `NO_TOKEN`, so the work-unit transition, the
> gate attestations and the findings write were all **skipped, not done**. The
> plan reserve itself succeeded — `/claims/acquire` is unauthenticated.
> Previously: VETTED 2026-09-20.
>
> **Status: VETTED 2026-09-20, against backend `origin/master` `a81da55`**
> (mobile `origin/main` `5b88428`, infra `c2ade6b`, backend PR#22 head
> `5ac7046`, mobile PR#32 head `7fd27d2`). The data inventory survives almost
> intact; the four defects it names are real and correctly cited. What did not
> survive: `infra` **does** have a git remote; mobile#32 has **not** merged;
> Phase 3's log-redaction gate is unimplementable as written; the retention
> job's "one instance" premise is unfounded; the `access_token` query parameter
> would be logged; and the served `domain_spec/menu` contradicts the consent
> default the German text is built on. Defects found: 21. Auto-fixed: 21.
> Surfaced for the operator/owner: 4 (see "Owed"). Previously: DRAFT 2026-09-20.
>
> **Repos:**
> - `portofino-pizzeria/backend` leads (Phases 1–4).
> - `portofino-pizzeria/mobile` follows (Phases 5–6).
> - `infra` is touched in Phase 3. ~~It has no git remote — that change is
>   committed locally only.~~ **Corrected 2026-09-20:** `infra` **has** a
>   working remote (`origin` → `https://github.com/portofino-pizzeria/infra.git`;
>   9 remote heads; the checkout's branch tracks `origin/…` and is 0/0 with it;
>   CI at `.github/workflows/ci.yml` runs `fmt`/`validate` with no AWS
>   credentials). Phase 3's infra change ships as an ordinary PR, reviewed like
>   any other. There is no automated `terraform apply` — an operator applies.
>
> **Base:** backend `origin/master` `a81da55` plus open PR
> [backend#22](https://github.com/portofino-pizzeria/backend/pull/22) (head
> `5ac7046`), whose `shop_profile` legal columns (`5ac7046:src/db/schema.ts`
> `shopProfile`, `legal_owner_name` / `legal_form` / `vat_id` /
> `register_court` / `register_number` / `legal_confirmed_at`, lines 213-222,
> migration `drizzle/0005_shop_facts.sql`) this plan extends; mobile
> `origin/main` `5b88428`.
>
> **Two open PRs are hard dependencies, not context.**
> - **backend#22** (`5ac7046`) — the `legal` block on `GET /api/shop` that D1
>   renders from. Also open: **backend#21** (`a1d6448`, deploy warns on an
>   incomplete Impressum) — this plan does not touch it and does not conflict.
> - **mobile#32** (`7fd27d2`) — `src/app/impressum.tsx` **does not exist on
>   `origin/main`**; it exists only on that branch, and so does `ShopInfo.legal`
>   in `src/lib/types.ts`. Phases 5-6 cannot start before mobile#32 merges.
>   Nothing in this plan conflicts with its diff: it adds `datenschutz.tsx` and
>   an admin section beside, not over, its files — but both plans edit
>   `src/app/index.tsx`'s footer and `src/app/_layout.tsx`'s screen list, so the
>   later one rebases.
>
> Line references marked `pr22:` are against that PR head; everything else is
> against `a81da55`. **Note `src/routes/orders.ts`, `src/db/schema.ts`'s
> `orders` table and `src/payments/stripe.ts` are byte-identical at `a81da55`
> and `5ac7046`** — PR#22 does not touch them, so the `pr22:` prefix on those
> three is cosmetic.
>
> **Follows:** `2026-09-19-portofino-owner-edits-shop-info-and-legal-notice.md`,
> which added the Impressum and named the privacy policy as out of scope and
> blocking cutover.
>
> **This plan is not legal advice, and it does not pretend to be.** It builds
> the page, the mechanics behind it, and a German draft text for a lawyer or the
> owner's tax advisor to review. Every point where the answer is a legal
> judgement is marked as owed rather than guessed.

## Why

- **It is legally required, and it is missing.** Art. 13 DSGVO requires the
  information to be given at the moment data is collected. Checkout collects a
  name, a phone number, a delivery address and a free-text note, and no privacy
  page exists in either repo.
- **The initiative's two in-scope milestones both need it.** `initiative/current-initiative`
  v5 puts the app on real devices and our own website in scope. An app store
  submission needs a privacy policy URL, and the website cutover replaces a site
  that has one.
- **The Impressum work already blocks on the owner's facts.** The controller
  identity a privacy policy must state is the same set of facts
  (`legal_owner_name`, `email`), so both pages become complete at the same
  moment.

## Discovered prior art (added by the vet 2026-09-20)

Every mechanic this plan proposes has a template already in these repos. Use
them rather than inventing a parallel one.

| Piece | Location | Notes |
|---|---|---|
| Owner-token guard for the D5 routes | `5ac7046:src/lib/owner-auth.ts:32-48` | Already shared by `admin-menu.ts` and `admin-shop.ts`; fails closed. Do not write a third guard. |
| Constant-time secret compare | `src/lib/secrets.ts`, `secretsMatch` | Use it for the D3 `access_token` check too — a `===` there is a timing oracle on a capability. |
| Pinned clock for the D4 tests | `src/lib/clock.ts`, `now()` | The retention tests' "pinned clock" already exists; `order-service.ts:90` and `payments/stripe.ts:56` both go through it. |
| "This ran once" marker table | `src/db/schema.ts:157-162`, `dataset_seeds` | The shape D4's last-run marker should copy — *that* and *when*, never a version. Copy the shape, not the row. |
| Device key/value storage | `mobile/src/lib/storage.ts` / `storage.web.ts` (`readStoredText` / `writeStoredText` / `removeStoredText`) | The trio D3's order-token store uses. `saved-details.ts` and `kitchen.ts` are the two working callers. |
| Bearer header on a client call | `mobile/src/lib/kitchen.ts:56-65` | The exact pattern D3's tokenised `api.getOrder` needs; `api.ts:40-56` already spreads `init.headers`. |
| A legal page with a graceful gap | `7fd27d2:src/app/impressum.tsx` (`GAP` `:34`, `Line` `:236-250`, states `:27-31`) | Copy the gap markers and the retry button; **do not** copy the whole-page gate (D1). |
| Redacting a field from a response | `5ac7046:src/routes/shop.ts:16-29`, `publicLegal()` | Already builds a public projection that omits unset fields deliberately — the template for D3's redacted order shape. |

## What is actually true about the data (verified 2026-09-20)

This section is the plan's real content. A privacy policy is only as good as
the inventory behind it.

| Question | Answer, with evidence |
|---|---|
| What personal data is stored on our servers | `orders.customer_name`, `customer_phone`, `customer_address`, `customer_notes` (`pr22:src/db/schema.ts` `orders`), the order lines, the fulfilment type, and `payment_provider` / `payment_reference` / `paid_at`. No account, no password, no email address. |
| Where | Aurora Postgres in **eu-central-1, Frankfurt** (`infra/variables.tf:4`), private subnets; the API runs on App Runner in the same region. |
| What the diner's device stores | ~~Name, phone, address, note and the last fulfilment choice, in `localStorage` (web) or `AsyncStorage` (native)~~ **Corrected 2026-09-20.** Exactly four values — `fulfilment`, `name`, `phone`, `address` — under the key `checkout-details-v1` (`mobile/src/lib/saved-details.ts:14`, `:45-48`). **The note is deliberately NOT stored** (`saved-details.ts:10-12`: "it belongs to one order"). Storage is `localStorage` on web (`src/lib/storage.web.ts:15-39`) and a per-key JSON file in the app's document directory via `expo-file-system` on native (`src/lib/storage.ts:14-47`) — **not AsyncStorage**. Written only while "Angaben merken" is ticked, **and it starts UNTICKED** (`mobile/src/app/checkout.tsx:212-216` — the comment is `:212-215`, the `useState(false)` is `:216`); on a return visit with details already saved the prefill effect re-ticks it (`checkout.tsx:268-286`, specifically `:273-274`). "Gespeicherte Angaben löschen" (`checkout.tsx:627-638`) unticks and erases. Nothing is sent anywhere. |
| Payment | Stripe hosted checkout. We send line-item names, amounts and `metadata.orderId` (`pr22:src/payments/stripe.ts:35-55`). **Card data never reaches our servers.** Stripe acts as its own controller for the payment and is a recipient, not merely a processor. |
| Who can see order data | The kitchen dashboard (`/api/kitchen/*`), behind a shared token that fails closed (`src/config.ts:59-77`, `routes/kitchen.ts:25-38`), and the owner. `mobile/src/app/kitchen.tsx:448-466` is the **only** screen in either repo that renders `customer_phone`. |
| Analytics, tracking, ads, cookies | **None.** No analytics SDK, no ad SDK, no tracking pixel, and no cookie beyond the device storage above. This is worth stating in the policy, because it is unusual and it is the honest answer. |
| Server logs | Fastify's default logger is on (`src/app.ts:33` at `5ac7046`, `:31` at `a81da55` — **not `:30`**). ~~Pino's default request serializer~~ **Corrected: it is *Fastify's* own `req` serializer**, which replaces pino's — `node_modules/fastify/lib/logger-pino.js:46-56` returns `remoteAddress: req.ip` and `remotePort`, and `lib/log-controller.js:50` writes it as `{ req }` on the `'incoming request'` line. Installed: `fastify@5.10.0`, `pino@10.3.1`. So the claim is true, but the thing Phase 3 must override is Fastify's serializer, not pino's. Those logs go to CloudWatch through App Runner, and **no retention is configured anywhere in `infra/`** — `aws_cloudwatch_log_group` and `retention_in_days` appear nowhere in the directory; the only retention setting is the database's 7-day backup window (`infra/database.tf:36`). |
| CloudFront / S3 access logs | Not configured. Nothing in `infra/web.tf` sets `logging_config`; there is no `aws_s3_bucket_logging` resource and no VPC flow logs anywhere in `infra/`. |
| **Database backups and snapshots** *(added by the vet — the inventory missed them, and they are where D4 leaks)* | Aurora automated backups run with `backup_retention_period = 7` (`infra/database.tf:36`), so for **up to seven days** a NULLed phone number or a deleted order is still recoverable from a backup. Separately, `infra` `c2ade6b` (*"feat(iam): let the backend deploy take a pre-migration DB snapshot"*) adds the IAM and the wiring values (`infra/outputs.tf` `db_cluster_identifier`, `db_pre_deploy_snapshot_prefix`) for a **manual cluster snapshot on every deploy**. Manual snapshots do not expire, and nothing in either repo prunes them. No such step exists in `backend/.github/workflows/deploy.yml` yet — its "snapshot" steps are App Runner *operation* snapshots, not DB ones — so this is in flight, not live. See D4. |

### Four things the policy would otherwise have to confess

Each is a defect this plan fixes rather than describes.

1. **`GET /api/orders/:id` is unauthenticated and returns the full customer
   block** — name, phone and address (`src/routes/orders.ts:155-160`, identical
   at `a81da55` and `5ac7046`; the handler takes no guard and returns whatever
   `getOrder` produced, and `serializeOrder` attaches `order.customer` with
   `name` / `phone` / `address` / `notes` —
   `src/lib/order-service.ts:27-63`, `:69-73`). **Verified 2026-09-20: both
   halves of the claim are true.** The id is a UUID, so it is unguessable, but
   it is also permanent, it is carried in the payment return URL, and it ends
   up in browser history. A policy honest about today's code would have to say
   "anyone who obtains the link can read your address". The app already says so
   in a comment: `mobile/src/app/order/[id].tsx:44-47` — *"It is not protected:
   the order read has no authentication and returns it to anyone holding the
   order link"*. This is coord finding `bd868d61`, recorded 2026-09-13 and
   still open.
2. **IP addresses are logged with no retention limit.** "We keep your IP
   address forever" is not a sentence anyone wants to publish, and it is not
   what anybody intended.
3. **Order data has no deletion path at all.** Nothing ever removes a name,
   phone number or address, so the policy could only promise retention
   "indefinitely".
4. **There is no way to answer a data-subject request.** Art. 15 (access) and
   Art. 17 (erasure) requests arrive by phone or email, and today the owner
   would have to ask a developer to run SQL.

## Decisions

### D1 — The page

- `mobile/src/app/datenschutz.tsx`, served at `/datenschutz` on web and as the
  same screen on native, built like `impressum.tsx` (mobile#32, file at
  `7fd27d2:src/app/impressum.tsx`) — **with one deliberate difference, below**.
  Register the screen in `src/app/_layout.tsx` beside `impressum` (`:58` on
  that branch).
- Linked next to the Impressum, from the menu footer (`index.tsx:749-763`, the
  `ImpressumLink` block) and from checkout (`checkout.tsx:656-666`), and
  **outside the `if (shop)` branch** (the contact band's guard is
  `index.tsx:687`) so the link survives an API outage — the same defect the
  Impressum vet caught. The menu's error screen (`index.tsx:389`) carries it
  too.
- **Do NOT copy `impressum.tsx`'s gate.** That page is a four-state machine
  (`impressum.tsx:27-31`) whose `ready` state is entered only when
  `shop.legal` is present (`:46`), and every other state renders a bare
  "konnte gerade nicht geladen werden" / "noch nicht verfügbar" page with no
  facts at all (`:101-131`). Applied to a privacy policy that would make the
  retention periods, the data-subject rights, the recipients and the
  supervisory authority unreachable whenever `/api/shop` is down or the
  owner's legal facts are still missing — i.e. exactly now.
  **Resolved:** the Datenschutz page renders its whole body unconditionally and
  degrades **only the Verantwortlicher block**, showing the same italic
  `GAP = 'wird ergänzt'` marker `impressum.tsx:34`/`:236-250` already uses, with
  the retry button beside it. Priority: robustness — a page whose static
  two-thirds is withheld because a dynamic third failed has a worse failure mode
  than one that is partly incomplete, and the UX gate *honesty about
  uncertainty* prefers a named gap to a blank page.
- The controller block is rendered from `GET /api/shop`. ~~(name, legal form,
  address, phone, email) from `legal`~~ **Precisely:** `ownerName`,
  `legalForm` and `email` come from the `legal` block
  (`ShopLegal`, `7fd27d2:src/lib/types.ts:177-191`; built server-side by
  `publicLegal()` in `5ac7046:src/routes/shop.ts:16-29`); the **address and
  phone come from the top-level shop fields** — `shop.street`,
  `shop.postalCode`, `shop.city`, `shop.phoneDisplay` / `shop.phoneE164`
  (`impressum.tsx:142-185`). So the two legal pages cannot disagree, but they
  read two parts of one payload, not one field.
- The page carries **"Stand: <date>"** from a constant that is updated with the
  text.

### D2 — What the text says, section by section

German, addressed to the diner, in the plain register the rest of the app uses.
The draft is written in Phase 5 and lives in the repository as the single
source of the page's text.

> ⚠️ **Every legal characterisation in this section is OWED, not decided
> (added by the vet 2026-09-20).** The status block promises that "every point
> where the answer is a legal judgement is marked as owed rather than guessed",
> and D2 did not keep that promise: only item 4 carried the marker. The
> following are **drafting positions for the reviewer named in "Owed" to
> confirm or replace**, not findings — the Art. 6 (1) (b) / (c) / (f)
> assignments in item 2, the § 25 (1) TDDDG characterisation of the device
> storage and the claim that the unticked default is what makes that consent
> valid, the "Stripe is its own controller and a recipient, not merely a
> processor" line in the table above, the competence of LDI NRW in item 7, and
> the periods in D4. The **mechanics** this plan builds are independent of how
> each is finally worded: the page renders text from the repository, the
> retention periods are config values, and the erasure endpoint does not care
> what article is cited. **This plan is not legal advice.**

1. **Verantwortlicher** — the controller's identity and contact details, from
   D1. The same missing owner facts block this page and the Impressum.
2. **Welche Daten, wofür, auf welcher Rechtsgrundlage**
   - Order data → performing the contract, **Art. 6 (1) (b)**.
   - Payment → contract, Art. 6 (1) (b), through Stripe.
   - Tax and commercial retention → legal obligation, **Art. 6 (1) (c)**.
   - Server logs → legitimate interest in operating and securing the service,
     **Art. 6 (1) (f)**, with the retention from D4.
   - The device's remembered details → **§ 25 (1) TDDDG consent**, given by
     ticking "Angaben merken", withdrawable with "Gespeicherte Angaben
     löschen". The unticked default is what makes this consent valid, so the
     text states it. The text must be accurate about two things the inventory
     above corrects: the note is **not** among the stored values, and on a
     return visit the box renders already ticked because the diner ticked it
     before (`checkout.tsx:268-286`) — not because it is pre-ticked.

     > ⛔ **BLOCKER — this contradicts served intent, and the served document
     > wins.** The applied `domain_spec/menu` append declares: *"Checkout saves
     > name, phone, address, note and the last choice **on the device only**,
     > while 'Angaben merken' is ticked **(the default)**."*
     > (`mobile/docs/intent-drafts/domain_spec--menu--APPEND-ordering-hours-and-pickup.md:44-46`,
     > applied v3 → v4 and carried into v5.) The code is the opposite
     > (`checkout.tsx:216`, `useState(false)`), and this section builds the
     > whole § 25 TDDDG argument on the unticked default. The served spec is
     > also wrong about the note. `mobile/docs/intent-drafts/README.md` states
     > the rule: *"The served document is the authority... If they disagree, the
     > served one wins and this copy is stale."* So as it stands, Phase 5 would
     > publish German text asserting a fact the tenant's own served intent
     > denies.
     >
     > **Resolved:** the code is right and the declaration is stale — a
     > pre-ticked box is not consent, which is precisely why `checkout.tsx:212-215`
     > says so. **Phase 5 therefore carries a fifth deliverable: an APPEND to
     > `domain_spec/menu` correcting the default to UNTICKED and the stored
     > field list to `fulfilment, name, phone, address`,** drafted into
     > `mobile/docs/intent-drafts/` and written to the served document. Writing
     > it needs a **pizzeria-bound credential**, which an agent cannot mint —
     > the operator mints a pair code (see "Owed"). Until that append lands, the
     > page's § 25 sentence is blocked; the rest of the page is not.
3. **Empfänger** — Stripe (payment), AWS (hosting, Frankfurt), and nobody
   else. Named explicitly, with what each one receives.
4. **Drittlandübermittlung** — Stripe processes in the USA; the legal basis for
   that transfer is stated (see the operator's item in "Owed").
5. **Speicherdauer** — the periods from D4.
6. **Betroffenenrechte** — Art. 15 to 21, and how to exercise them (the
   Impressum's email and phone, and what the owner then does, from D5).
7. **Beschwerderecht** — the competent supervisory authority for a business in
   Essen: **Landesbeauftragte für Datenschutz und Informationsfreiheit
   Nordrhein-Westfalen (LDI NRW), Kavalleriestr. 2-4, 40213 Düsseldorf.**
8. **Keine Profilbildung, kein Tracking, keine Weitergabe zu Werbezwecken** —
   the true statement from the table above.
9. **Keine Pflicht zur Bereitstellung, aber** — without a name, phone number
   and (for delivery) an address, an order cannot be performed.

### D3 — The order read stops handing out personal data (defect 1)

`orders` gains `access_token text NOT NULL` — 32 bytes of CSPRNG randomness,
base64url, generated at creation and **returned once, in the `POST /api/orders`
response**. New migration `drizzle/0006_order_access_token.sql` (the journal is
at `0005` on `5ac7046`).

- `GET /api/orders/:id` **without** a valid token returns the non-personal part
  of the order: status, line items, totals, fulfilment, timestamps.
- **With** the token, it returns the customer block as well.
- **The token travels in an `Authorization: Bearer` header, NOT a query
  parameter.** ~~a valid `access_token` query parameter~~ **Corrected by the
  vet.** Fastify's `req` serializer logs `url` on every request
  (`fastify/lib/logger-pino.js:46-56`), so a token in the query string would be
  written into the same CloudWatch logs D4 is trying to minimise, and — via the
  web same-tab path's `router.replace('/order/<id>')` and
  `window.history.replaceState` (`checkout.tsx:383-384`) — into browser history
  and the `Referer` header, which is the exact leak D3 exists to close. The
  header costs nothing: `mobile/src/lib/api.ts:40-56`'s `request()` already
  spreads `init.headers`, and `src/lib/kitchen.ts:56-65` is the working
  precedent. Priority: robustness.
- ~~The app stores the token beside the order id on the device~~ **The app
  stores no order id today** — it lives only in the route param
  (`checkout.tsx:383-398` → `order/[id].tsx:83`); grep finds no
  `writeStoredText` of an order id anywhere. So Phase 1's mobile half adds a
  **new** device store, e.g. `src/lib/my-orders.ts` keyed `orders-v1`, over the
  same `readStoredText`/`writeStoredText` trio (`src/lib/storage.ts`,
  `storage.web.ts`). It **must not** live in `checkout-details-v1`: that blob
  is written only when "Angaben merken" is ticked and is erased by
  "Gespeicherte Angaben löschen" (`saved-details.ts:45-52`), whereas the order
  token is necessary for the service the diner asked for and is not
  consent-gated. Written at `checkout.tsx:352` beside the existing
  `saveDetails` branch (`:356-360`); read in the poll at `order/[id].tsx:110-112`.
- ~~The payment return URL (`src/payments/stripe.ts`) carries the token, so the
  page a diner lands on after paying still shows their own details.~~
  **Struck. The return URL must NOT carry the token.** Stripe's `success_url`
  points at the **backend's** `/checkout/return`
  (`src/payments/stripe.ts:57`), which renders a static German HTML card with
  **no order data at all** (`src/routes/payments.ts:44-79`, `:129-160`); its
  only link is `${publicWebUrl}/order/<id>`, built by `orderLink()`
  (`:26-30`). Putting the token there would hand the capability to Stripe, to
  the backend's own access log and to browser history — recreating the leak.
  The diner's device already holds the token from the `POST /api/orders`
  response, so the page it lands on can read its own details without help.
  Priority: robustness.
- **Who actually calls `GET /api/orders/:id`** — ~~the payment result page and
  the kitchen wait screen~~ neither. Verified 2026-09-20, the complete caller
  set is:
  | Caller | Where | Effect of the split read |
  |---|---|---|
  | the order status screen | `mobile/src/app/order/[id].tsx:112` via `src/lib/api.ts:103-109` | **the only real consumer.** It renders `customer.name`, `customer.address` and `customer.notes` (`:48-55`, `:328-351`) and deliberately never renders `customer.phone` (`:44-47`) |
  | the UI Bridge action `order.getOrderStatus` | `order/[id].tsx:160-189` | returns `delivery: { name, address, note }`; Phase 5/6's Bridge runs assert on it |
  | backend tests | `test/orders.test.ts:63`, `:455-480`; `test/payments.test.ts:48`; `test/admin-menu.test.ts:732`, `:770` | must be updated in Phase 1 |
  | the payment result pages | — | do **not** call it; they call `getOrder` in-process (`routes/payments.ts:90`, `:114`, `:139`) |
  | the kitchen dashboard | `mobile/src/app/kitchen.tsx` via `src/lib/kitchen.ts:84` | calls `/api/kitchen/orders` behind its own Bearer token; unaffected |
- **The tokenless response must be distinguishable from a missing address.**
  `deliveryDetails()` (`order/[id].tsx:48-55`) renders a red *"Keine
  Lieferadresse hinterlegt"* when a delivery order has no address
  (`:339-345`), so simply omitting the block turns a privacy improvement into a
  visible error on every un-tokened read. Phase 1 therefore returns an explicit
  `customerRedacted: true` on the tokenless shape, and Phase 5 gives the screen
  a third branch — "nur auf deinem Gerät sichtbar" — distinct from both
  "present" and "missing". Priority: robustness, and the UX gate *honesty about
  uncertainty*.
- **Why a separate token rather than reusing the id:** the id is already
  distributed — it is in Stripe metadata and `client_reference_id`
  (`payments/stripe.ts:54-55`), in the return and cancel URLs (`:57-58`), in
  browser history and in the kitchen. A capability that leaks through five
  surfaces is not a capability. Priority: robustness; the id keeps being an
  identifier and the token becomes the secret.
- **Accepted cost, stated:** the order link stops working on a second device or
  after the diner clears site data — they would see the order without their own
  details. That is the intended trade (a link that works anywhere is the defect),
  it loses nothing they did not type themselves, and the page says so.
- Existing rows get a generated token in the migration, so nothing breaks
  server-side; existing *clients* hold no token and fall to the redacted shape.

### D4 — Retention, and a job that enforces it (defects 2 and 3)

| Data | Kept | Why |
|---|---|---|
| `customer_phone`, `customer_address`, `customer_notes` | **6 months**, then overwritten with NULL | Long enough for a delivery dispute or a chargeback; none of it belongs in a tax record. |
| `customer_name`, the order, its lines and totals | **10 years**, then deleted | `§ 147 AO` / `§ 257 HGB`. **The exact period is the owner's tax advisor's call** — the shortening some records got in 2025 may apply. Implemented as a config value, defaulting to the longer period, because keeping a record too long is recoverable and deleting it early is not. |
| Server logs, including IP addresses | **14 days** | Pino's IP logging is also switched off for successful requests in the same phase, so the 14 days mostly covers errors. |

- ~~A daily job (`src/lib/retention.ts`), leader-agnostic because there is one
  instance~~ **Both premises of that sentence are false, and the fix is
  specified here rather than left to the implementer.**
  - **There is not one instance.** `infra/backend-service.tf:111-168` sets no
    `auto_scaling_configuration_arn`, and no
    `aws_apprunner_auto_scaling_configuration_version` resource exists anywhere
    in `infra/` — so the service runs on App Runner's `DefaultConfiguration`,
    **MinSize 1, MaxSize 25**. A naive per-process timer fires on every
    instance.
  - **A daily timer is not a daily run.** `backend-service.tf:115` sets
    `auto_deployments_enabled = true` against `:latest`, and
    `backend/.github/workflows/deploy.yml` pushes on every merge to `master`, so
    the process restarts often and resets any interval; App Runner also does not
    guarantee background work on an idle instance.
  - **Resolved.** `src/lib/retention.ts` exposes one idempotent
    `runRetentionSweep()` that (a) takes a Postgres advisory lock
    (`pg_try_advisory_lock`) and returns immediately if another instance holds
    it, and (b) reads and writes a **last-run marker row**, in the shape
    `dataset_seeds` already established for "this ran once"
    (`src/db/schema.ts:157-162`), so "daily" means *at most once per period*,
    not *once per timer tick*. It is triggered **on boot if overdue** and then
    on an interval, so a restart-heavy deploy model makes the sweep run more
    often rather than never. Priority: robustness, then scalability — the lock
    is what stays correct at MaxSize 25, and the marker is what stays correct
    across restarts.
  - **Where it must NOT go:** inside `initDatabase()`'s retry loop
    (`src/index.ts:57-89`), which retries up to 20 times and serves anyway on
    total failure — a delete sweep in that loop could run 20 times per boot.
    Call it after `initDatabase()` returns.
  - **No conflict with the seed-once marker from backend#19.** That marker is
    `dataset_seeds` (`name`, `seeded_at` — `src/db/schema.ts:157-162`), read by
    `seedMenu()`/`seedShop()` and scoped to the menu and shop tables; the sweep
    touches `orders` and `order_lines` only. Verified 2026-09-20. The retention
    marker is a **separate row or table** — do not overload `dataset_seeds`,
    whose contract is deliberately "that, and when, never a version".
  - Each period is a config value in `src/config.ts` with the defaults above.
- Log retention is set in `infra/` on the App Runner log group. ~~**`infra` has
  no git remote**, so that commit stays on this machine~~ **False — see the
  status block.** `infra` has a working remote and CI; the change ships as an
  ordinary PR.
- ⚠️ **The log group is not a Terraform resource today, and creating one will
  fail.** `aws_cloudwatch_log_group` and `retention_in_days` appear **nowhere**
  in `infra/`; App Runner creates
  `/aws/apprunner/<service-name>/<service-id>/application` and `.../service`
  implicitly, and they already exist with *Never expire*. A plain `create` gets
  `ResourceAlreadyExistsException`. Phase 3 therefore either `terraform import`s
  the two groups before applying, or sets retention out of band with
  `aws logs put-retention-policy`. The name is constructible in Terraform with
  no data source — `aws_apprunner_service.backend.service_name` and
  `.service_id` — but neither is referenced or output today
  (`infra/outputs.tf` exposes only `service_url`), so Phase 3 adds the output.
- ⚠️ **Probed 2026-09-20 (`aws logs describe-log-groups`, eu-central-1): there
  are SIX groups, not two.** `/aws/apprunner/portofino-production-api/` carries
  groups for **four** service ids — the live `454cad91…` plus three left behind
  by earlier, destroyed App Runner services — and **every one reads *Never
  expire***. The live `application` group alone holds **~199 MB**. Terraform can
  manage only the current service's two, because the other four correspond to
  no resource in this state. **The four orphans are an operator item**
  (`aws logs put-retention-policy`, or delete them outright — the commands are
  in `infra/README.md`). Left undone, the retention policy is decorative: the
  IP addresses are still there, in groups nothing expires. The same import is
  needed again whenever the App Runner service is replaced, since the service id
  is part of the group name. A declarative Terraform `import` block was
  rejected: its `for_each` would derive from `aws_apprunner_service.backend`,
  which is not plan-time-known on a green-field stand-up, and `terraform
  validate` — all CI runs — would not catch that.
- ⚠️ **Deleting a column is not deleting the data (added by the vet).** Aurora
  automated backups retain **7 days** (`infra/database.tf:36`), so a NULLed
  phone number or a deleted order remains recoverable from a backup for up to a
  week after the sweep. That is ordinary and defensible, but the policy's
  Speicherdauer section must **say** it rather than imply an instant deletion.
  Separately, if the pre-migration DB snapshot that `infra` `c2ade6b` prepares
  is wired into the deploy, every deploy will leave a **non-expiring** manual
  cluster snapshot containing the full customer table — which defeats D4
  entirely. It is not wired yet. **Owed to the operator:** a retention/prune
  rule for those snapshots before that step lands, or an explicit decision not
  to take them.

### D5 — Answering a data-subject request (defect 4)

Two owner-facing endpoints behind the existing owner token, plus a short
section in the admin area:

- `GET /api/admin/orders/search?phone=…` — finds a diner's orders by phone
  number, which is the only identifier a caller can give over the phone.
- `GET /api/admin/orders/:id/personal-data` — the Art. 15 extract for one
  order, as JSON.
- `POST /api/admin/orders/:id/forget` — Art. 17. It NULLs the customer columns
  and stamps `personal_data_erased_at`, keeping the order, its lines and its
  totals so the books stay intact. **Verified this is sound:** `order_lines`
  carries no personal data and references `orders.id` with
  `onDelete: 'cascade'` (`src/db/schema.ts:135-146`), and `serializeOrder`
  simply omits `order.customer` when all four columns are empty
  (`src/lib/order-service.ts:28-32`, `:54`) — so the kitchen card degrades to
  its existing "Keine Kontaktdaten hinterlegt" state
  (`mobile/src/app/kitchen.tsx:473-477`) with totals, lines and history intact.
  It refuses while the order is not in a terminal state, because erasing an
  in-flight order's address would strand the food.
  - **The terminal states are `ready` and `cancelled`** — the only two with no
    successors in `NEXT` (`src/lib/order-service.ts:209-215`). There is no
    `completed` or `delivered` status.
  - ⚠️ **`pending_payment` is a hole.** An abandoned unpaid order never leaves
    it except by a kitchen cancel, so a terminal-state-only refusal would make
    those orders permanently un-erasable on request. **Resolved:** `forget`
    also accepts `pending_payment`, since an unpaid order strands no food; only
    `paid` and `preparing` are refused, with the reason named in the German
    response. Priority: robustness — the refusal exists to protect a delivery
    in flight, and an unpaid order is not one.
  - ⚠️ **`forget` does not reach Stripe, and the plan must say so.** Stripe
    holds its own record of the payment — the session, the diner's email and
    card details, `metadata.orderId` and `client_reference_id`
    (`src/payments/stripe.ts:54-55`) — and `orders.payment_reference` remains
    as a link into it for the full 10 years. D2's Betroffenenrechte and
    Speicherdauer sections must name Stripe as a second place to address an
    Art. 15/17 request, and the admin screen's German must not promise more
    than the endpoint delivers. Nor does it reach the 7-day backup window or
    the diner's own device (that is what "Gespeicherte Angaben löschen" is
    for).
- The admin screen gets a "Datenauskunft / Löschung" section that does these
  three things in German, because the person answering the phone is the owner,
  not a developer.

## Phases

> **Sequencing note (vet).** Phase 3 carries this plan's only genuinely
> unknown mechanic — whether the App Runner log groups can be brought under
> Terraform at all. Run its **infra probe first** (`terraform import` of one
> group into a scratch state, or a read-only `aws logs describe-log-groups`),
> before building the rest of Phase 3, so an assumption-killer lands early
> rather than at the gate. Phases 1, 2 and 4 are low-risk builds and their
> order is unconstrained. Phases 5-6 cannot start before mobile#32 merges.

### Phase 1 — The order read stops leaking (backend + a thin mobile half)

D3: migration `drizzle/0006_order_access_token.sql`, token generation in
`createOrder` (`src/lib/order-service.ts:146-173`), the split read with the
`Authorization: Bearer` check and the `customerRedacted` flag
(`src/routes/orders.ts:155-160`, `serializeOrder` at `:27-63`), the device
token store (`mobile/src/lib/my-orders.ts`, written at `checkout.tsx:352`, read
at `order/[id].tsx:112`), tests.
- **Gate:** `npm test`, including: a read without the token has no customer
  block and carries `customerRedacted: true`; with the token it does; a wrong
  token is refused; the migration backfills existing rows; **the Stripe return
  URL is unchanged and carries no token** (the inverse of the original gate —
  see D3); the five existing tests that read `/api/orders/:id`
  (`test/orders.test.ts:63`, `:455-480`; `test/payments.test.ts:48`;
  `test/admin-menu.test.ts:732`, `:770`) are updated and green.

### Phase 2 — Retention and erasure mechanics (backend)

D4's job and its configuration, plus `personal_data_erased_at`.
- **Gate:** tests with a pinned clock (`src/lib/clock.ts`) — a 7-month-old
  order keeps its name and loses phone, address and notes; a 5-month-old order
  keeps everything; an 11-year-old order is gone; the job is idempotent; **a
  second concurrent `runRetentionSweep()` is a no-op** (the advisory lock); **a
  sweep inside the configured period is a no-op** (the last-run marker); the
  sweep is invoked after `initDatabase()` returns, not inside its retry loop.

### Phase 3 — Log minimisation (backend + an infra PR)

Drop the client IP from the request log; set the App Runner log groups'
retention to 14 days in `infra/`.
- ⚠️ **The original shape does not work.** *"Redact the client IP from
  successful request logs"* and *"a test asserting the serializer drops
  `remoteAddress` on 2xx"* are not implementable: Fastify emits
  `request.log.info({ req: request }, 'incoming request')` at request
  **receipt** (`fastify/lib/log-controller.js:47-51`), so the `req` serializer
  (`lib/logger-pino.js:46-56`) runs before any status code exists; the
  completion line carries only `{ statusCode }` (`log-controller.js:62-70`).
  pino's `redact` has the same blindness. `disableRequestLogging` takes a
  function of `req`, also status-free — and it is deprecated in 5.10 and
  removed in Fastify 6 (`fastify/lib/warnings.js:56`).
- **Resolved shape:** in `buildApp()` (`src/app.ts:33`) pass a `serializers.req`
  that returns Fastify's fields **minus `remoteAddress` and `remotePort`**, so
  the IP never reaches the `'incoming request'` line at all; then add an
  `onResponse` hook that logs `{ ip: request.ip, statusCode, url }` **only when
  `reply.statusCode >= 400`**. That delivers what D4 assumes — "the 14 days
  mostly covers errors" — while keeping the IP off every successful request.
  Priority: robustness, and it deletes rather than adds a code path on the hot
  side.
- **Gate:** a test that `app.inject()`s a 2xx and a 4xx against a captured log
  stream and asserts **no `remoteAddress` on either `'incoming request'` line**
  and **an `ip` on the 4xx `onResponse` line only**; the D3 token never appears
  in any logged `url`; `terraform fmt -check` + `terraform validate` (what
  `infra/.github/workflows/ci.yml` runs — it has no AWS credentials, so there
  is no `plan` in CI). An operator runs `terraform plan`/`apply`; the PR body
  records the import of the two existing log groups, since a bare create fails
  `ResourceAlreadyExistsException`.

### Phase 4 — The data-subject endpoints (backend)

D5's three routes behind the owner guard — `requireOwnerAuth`
(`5ac7046:src/lib/owner-auth.ts:32-48`), the same guard `admin-shop.ts` and
`admin-menu.ts` use; it fails closed on an unset `OWNER_MENU_TOKEN`.
- **Gate:** tests for each, including: the refusal on a `paid` or `preparing`
  order; **acceptance on `pending_payment`, `ready` and `cancelled`** (the
  states settled in D5); that `forget` leaves `subtotal`, `deliveryFee`,
  `total` and every `order_lines` row intact and the order still visible to
  `GET /api/kitchen/orders?scope=all`; that an unauthenticated call is 401.

### Phase 5 — The page, its text, and the intent correction (mobile)

D1 and D2, with the German draft. **Depends on mobile#32 having merged** —
`src/app/impressum.tsx` and `ShopInfo.legal` do not exist on `origin/main`.
Carries D2's fifth deliverable: the `domain_spec/menu` APPEND correcting the
"Angaben merken" default and the stored-field list, drafted into
`mobile/docs/intent-drafts/` and written to the served document from a
pizzeria-bound credential.
- **Gate:** lint and typecheck clean; `/datenschutz` in the web export; a UI
  Bridge run showing the page reachable in one tap from the menu and from
  checkout, and **still reachable, with its full body, when `/api/shop` fails**
  — only the Verantwortlicher block shows the `wird ergänzt` gap (D1). The
  intent APPEND is applied and its new version number recorded here; until it
  is, the § 25 sentence stays out of the shipped text.

### Phase 6 — The admin section (mobile)

D5's screen. **Also depends on mobile#32.**
- **Gate:** lint and typecheck; a UI Bridge run: search by phone, open the
  extract, run "forget" on a **`ready` or `cancelled`** order (there is no
  `completed` status — `src/lib/order-service.ts:209-215`), and see the
  customer block replaced by the existing "Keine Kontaktdaten hinterlegt" state
  on the kitchen card (`mobile/src/app/kitchen.tsx:473-477`) with the total and
  lines still shown.

## Owed by other people, and by when

**By the owner** (the same list the Impressum needs, plus one):
- legal name, legal form, email address, and the VAT ID and register entry if
  they exist;
- the retention period for order records, confirmed with their tax advisor.

**By the operator** (not the owner):
- **A processing agreement (AVV, Art. 28 DSGVO) between Qontinui and Portofino.**
  Portofino is the controller; Qontinui runs the servers on their behalf, which
  makes Qontinui a processor. This is needed before real diners' data is
  processed, and it is not something an agent can write.
- **Accept the AWS and Stripe data processing addenda** on the accounts the
  production environment runs in, and record which Stripe transfer mechanism
  applies so D2 section 4 can name it.
- **A lawyer's or a service's review of the German text** before cutover, and of
  every characterisation D2's warning block lists as owed.
- **A pizzeria-tenant credential, for coord as well as for intent.** Attempted
  2026-09-20 and refused: the device JWT on this box carries
  `active_tenant_id: c231d9da-…`, not Portofino
  `7ac125b6-391b-4d64-8493-27305b25c5b9`, so `GET /coord/work-units?slug=…`
  answers `tenant_not_resolved` and `coord-agent-refresh.sh` answers
  `NO_TOKEN`. No work unit was created, no gate attestation was written and no
  finding was filed — **not done, rather than done elsewhere**. Writing
  pizzeria rows into `personal-jspinak` would be worse than writing none.
- **A pizzeria-tenant pair code**, so Phase 5 can write the `domain_spec/menu`
  APPEND that corrects the "Angaben merken" default (D2 §2). An agent cannot
  mint one — the tenant is burned into the device JWT at mint; the operator
  mints the code in the dashboard and the agent redeems it at
  `POST /api/v1/devices/pair-codes/{code}/redeem`
  (`mobile/docs/intent-drafts/README.md`, "How to edit these next").
- **A decision on the pre-migration DB snapshots** that `infra` `c2ade6b`
  prepares: either a prune/retention rule before that step is wired into
  `backend/.github/workflows/deploy.yml`, or a decision not to take them.
  Without one, every deploy would leave a non-expiring copy of the customer
  table and D4's periods would be decorative. This is an infrastructure
  decision, not a legal one.

## Risks

- **The text will be wrong in detail until a lawyer reads it.** The mechanics
  are the durable part; the wording is replaceable and is versioned in the
  repository.
- **D3 changes a public API shape.** ~~The old app build would show an order
  screen without the customer block. That is a degradation, not a break~~
  **Sharper, after the vet:** an old build would render the red *"Keine
  Lieferadresse hinterlegt"* on every delivery order
  (`order/[id].tsx:339-345`), because it cannot tell "redacted" from
  "missing" — a visible error, not a quiet omission. The `customerRedacted`
  flag in D3 is what makes it a degradation; Phase 1 must ship it, and Phase 5
  must render the third branch. Old builds still in the wild keep the error
  state until they update; the web build updates on reload.
- **The 10-year default keeps names longer than many restaurants would.** It is
  configurable, and the owner's advisor decides.
- ~~**Phase 3's infra commit cannot be reviewed in a PR**, because `infra` has
  no remote.~~ **Struck — the premise was false.** `infra` has a remote and CI;
  the change is an ordinary PR. The real Phase 3 risk is different: the App
  Runner log groups already exist outside Terraform, so the change needs an
  `import` (or an out-of-band `put-retention-policy`), and `infra` CI runs with
  no AWS credentials, so nothing verifies the `plan` before an operator
  applies it.
- **The two mobile phases are blocked on an open PR.** mobile#32 has not
  merged; `impressum.tsx` and `ShopInfo.legal` exist only on its branch. Both
  plans also edit `src/app/index.tsx`'s footer and `src/app/_layout.tsx`'s
  screen list, so whichever lands second rebases.
- **The § 25 sentence is blocked on an operator action.** Correcting
  `domain_spec/menu` needs a pizzeria-bound credential the agent cannot mint.
  The rest of the page is not blocked.

## Related

- `[[2026-09-19-portofino-owner-edits-shop-info-and-legal-notice]]` — the
  Impressum, which named this plan as its missing half. Proposed as
  **mobile#30**; its code is backend#22 / backend#21 / mobile#32, all open.
- coord finding `bd868d61` — the unauthenticated order read, closed by Phase 1.
- ~~**Publication state (vet, 2026-09-20):** this plan file is **untracked in
  `mobile`** and carries no PR…~~ **Resolved 2026-09-20.** Committed and pushed
  from a fresh worktree off `origin/main` as its own docs-only PR
  (`docs/plan-privacy-policy`), carrying the line-anchored marker. It was
  deliberately **not** added to mobile#30: that branch belongs to another
  session's open PR, and pushing this file onto it would have edited work this
  run does not own. A docs-only PR is the cheaper and safer half of the same
  outcome.
