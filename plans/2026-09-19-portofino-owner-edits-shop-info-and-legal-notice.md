# Portofino — the owner edits the restaurant's facts (hours, special days, address, legal notice), and their edits survive a deploy (2026-09-19)

> **Status: SHIPPED 2026-09-20.** All six phases are live. backend
> `origin/master`: `a81da55` (Phase 0, seed once — `#19`), `51cf227` + `5ac7046`
> (Phases 1–3, the shop tables, the owner's API and the Impressum data — `#22`,
> which replaced `#20`). mobile `origin/main`: `09ea669`, `d0b771f`, `e86dd7b`
> (Phases 4–5, the restaurant editor and the Impressum page — `#32`, landed by
> coord as a rebase fast-forward, which is why GitHub shows it Closed rather
> than Merged). Vetted 2026-09-19 against backend `bdaaeac` / mobile `d64d05d`
> (11 defects found, 11 auto-fixed, 0 surfaced); implemented by session
> da329290 (`/vet-imp`).
>
> **One residual, and it is the only thing still open:**
> `portofino-pizzeria/backend#21` — the deploy workflow's `::warning::` when
> `/api/health` reports `legal: incomplete`. `.github/workflows/**` is a tenant
> escalate path, so coord answers `block_hard / awaiting_operator_override` and
> it needs an operator to land. Nothing else depends on it: it only warns, and
> it can never fail a deploy.
>
> **Verified before it shipped:** backend `npm run typecheck` clean and
> `npm test` 245 tests green (175 at the base); mobile `npx tsc --noEmit`,
> `npm run lint` and `npx expo export -p web` (`dist/impressum.html`) clean;
> and a live run on an Android emulator over the UI Bridge — one tap from the
> menu opened the Impressum with the served data, and the owner's editor set
> Silvester to close at 17:00, saw it in the preview and in `GET /api/shop`,
> and undid it. That run found the one defect this implementation shipped a fix
> for: a special day stored its own sentence („Silvester: geöffnet bis 18:00
> Uhr“), so moving the closing time left the app promising the old one. The row
> now carries a label and the server composes the sentence from the hours it
> enforces (D3).
>
> **Still owed by the owner** (nothing in code can supply it): the real
> Heiligabend and Silvester hours, and the five Impressum facts. Store
> submission and the website cutover stay blocked while `/api/health` reports
> `legal: incomplete`. The Datenschutzerklärung remains out of scope and blocks
> cutover the same way.
> **Repos:**
> - `portofino-pizzeria/backend` leads (Phases 0–3).
> - `portofino-pizzeria/mobile` follows (Phases 4–5).
>
> **Base:** backend `origin/master` `bdaaeac` (includes backend#18, hours and
> pickup). Mobile `origin/main` `d64d05d`. Every `file:line` below is against
> those two commits.
>
> **Intent read from the served store**, pizzeria tenant
> `7ac125b6-391b-4d64-8493-27305b25c5b9`, on 2026-09-19. The session paired
> with operator code `7LRDAY`. Documents read:
> - `domain_spec/menu` v4;
> - `audience_profile/owner-operator` v2;
> - `initiative/current-initiative` v5;
> - `policy/plan-discipline`, `policy/planning-and-scope`,
>   `policy/escalation-bar`, `policy/ux-priorities` v4;
> - `decision_record/notification-not-permission`.
>
> **Why this file is in `mobile/plans`:** Portofino plans live here, not in
> `qontinui-dev-notes/plans` (`c97dfc70`), because the plan scanner cannot
> express tenancy.

## Discovered prior art and vet corrections (2026-09-19)

Every `file:line` in the plan was re-read at backend `bdaaeac` and mobile
`d64d05d`. The `shop.ts` line numbers, `index.ts:59`, `seed.ts:122` /
`:130-133`, the `index.tsx:678-718` footer, `PATCH /api/admin/menu/items/:id`
(`admin-menu.ts:191`), `confirmNoAllergens` and `requireOwnerAuth` are all
correct. What the vet changed, and why:

| Piece | Location | What it means for this plan |
|---|---|---|
| The test harness truncates **every** public table before **every** test | backend `test/support/setup.ts:36-67` (`truncateAll`, derived from `pg_tables`) | Rows a migration inserts are gone before the first test runs. So the shop defaults cannot live only in a migration; they are seeded from code (`seedShop()`), and the harness calls it after the truncate. See D2. |
| The order-time refusal is in the **service**, not the route | backend `src/lib/order-service.ts:90` (`createOrder`) | Phase 1 loads the rules there. `routes/orders.ts` never calls `shopStatus`. |
| `payments.ts` re-check | backend `src/routes/payments.ts:98` | Correct as written; it reads the same loader. |
| `/api/health` is App Runner's health check and must not touch the DB | backend `src/app.ts:56-61`, `src/index.ts:11-13`, `test/health.test.ts:1-4, 29-34` | D6's `legal` field is served from an in-process cache, never from a query in the request path. See D6. |
| The Ruhetag is hard-coded as **Tuesday** | backend `src/lib/shop.ts:193` (`weekday === 2`) | Once the owner edits the week, "Ruhetag" means "a weekday the weekly hours close", not "Tuesday". See D2. |
| The delivery refusal prints the constant `DELIVERY_UNTIL` | backend `src/lib/shop.ts:266`; mobile `src/hooks/use-shop.ts` `closedReason` (same sentence, from `shop.deliveryUntil`) | With special days, the last delivery differs per day. Both sentences must use the day's delivery close. |
| `npm run db:seed` already exists | backend `package.json` `scripts.db:seed` | After D1 it is the insert-if-never-seeded path; `db:reseed` is added beside it. |
| The shop footer only renders when `/api/shop` answered | mobile `src/app/index.tsx` (`if (shop) { … }` around the contact band) | The Impressum link must sit **outside** that branch, so it is reachable when the API is down. |
| `@expo/ui` and no time-picker dependency | mobile `package.json` | The editor's times are chosen from a fixed list in 15-minute steps, built from `AdminButton`; no new dependency, identical on web and native. |
| The repo is landed by coord (`app/qontinui-merge-orchestrator`), linear history | both repos' merged PRs | Stacked PRs lose checks (`knowledge-base/qontinui-specific/stacked-prs.md`). The PR split under "Phases" is changed to avoid stacking. |

## Why

`domain_spec/menu` (7) and (8) describe the cutover this way: the owner logs into
our site and maintains its content. `audience_profile/owner-operator` calls the
owner the site's **content maintainer**. The menu half of that exists: the
editor API is `/api/admin/menu/*` and the screens are `mobile/src/app/admin/`.
The restaurant half does not exist.

- **Every restaurant fact is a code constant.** They all sit in backend
  `src/lib/shop.ts`:
  - `SHOP` (`:23`) — name, street, postal code, city, phone;
  - `WEEKLY` (`:43`) — the weekly hours;
  - `HOLIDAY_WINDOW` (`:54`) — the public-holiday hours;
  - `DELIVERY_UNTIL` (`:57`) — the delivery cut-off;
  - `RUHETAG_BEATS_HOLIDAY` (`:67`);
  - `HOURS_DISPLAY` (`:272`) — the printed table.

  Changing any of them takes a developer, a PR and a deploy.
- **Special closures are a declared UNKNOWN** in `domain_spec/menu` v4:
  *"holidays the shop takes, Heiligabend or Silvester hours. Nothing records
  them, and the app would take orders."* Today, an order placed while the shop
  is on holiday is accepted and paid.
- **There is no legal notice (Impressum) anywhere.** Grepping both repos for
  `Impressum` finds nothing. A German business website or app must carry one
  (§ 5 DDG). The initiative puts two things in scope: the app on real devices,
  and our own website.

### 🔴 The blocker: every server start erases the owner's edits

On every boot, `src/index.ts:59` calls `seedMenu()`. In one transaction,
`seedMenu()` (`src/db/seed.ts:122`) deletes all variants, items, categories and
legend rows (`:130-133`) and re-inserts them from `data/menu.json`.

This means every deploy, and every App Runner restart or scale event, silently
throws away everything the owner typed into the existing menu editor. That
violates `domain_spec/menu` (7): after cutover, *"truth becomes authored"*. It is
also the failure `audience_profile/owner-operator` rules out: *"a second menu
that drifts from the real one"*. In this case the second menu is our own seed
file.

It must be fixed before the owner makes a single edit, and before shop facts
move into the database. Otherwise they would inherit the same erasure.

**A process currently depends on the reseed.** backend#17 removed Antipasti Misto
by editing `data/menu.json` and letting the next boot reseed. Phase 0 removes
that path, so it has to provide a replacement (D1).

## Decisions

### Decided by the operator (2026-09-19)

These four decisions were given in the authoring conversation. They are
decisions, not assumptions, and each is also written into `domain_spec/menu`
(see "Intent writes").

1. **A public holiday that falls on a Tuesday stays a Ruhetag.** This closes the
   "owed back to the owner" item in `domain_spec/menu` v4. It remains a stored,
   owner-editable setting (`ruhetag_beats_holiday`, default `true`) rather than
   hard-coded, so the owner can change it later without a developer.
2. **There is no shop-wide lunch break**, because several employees cover the
   day. **Each day has one opening window.** The model does not support split
   windows, and the editor does not offer them.
3. **Heiligabend and Silvester get typical short hours by default, and the owner
   can edit them** (D4).
4. **The site and app carry the standard legal notice of a German restaurant**
   (D6).

### D1 — Seed once. After that the database is the source of truth.

- `seedMenu()` seeds **once per database**. A new table
  `dataset_seeds (name text primary key, seeded_at timestamptz not null)`
  records it:
  - no `menu` row and `menu_items` empty → load `data/menu.json` and insert the
    `menu` row, in one transaction;
  - no `menu` row but `menu_items` has rows (every database that exists today)
    → insert the `menu` row only, and log
    `Menu already present (N items) — not reseeding`;
  - a `menu` row exists → return without writing, even if the owner has since
    deleted every item.
  **Resolved (robustness):** "insert when `menu_items` is empty" alone would
  resurrect the whole captured menu on the next deploy after an owner empties
  it. The marker says "seeded once" and never compares datasets, so it cannot
  bring the erasure back the way a dataset-version marker would.
- The full reset stays available as an explicit, local-only command:
  `npm run db:reseed -- --force`. It deletes the four menu tables, reloads them
  and rewrites the `menu` marker. It refuses to run without `--force`, and when
  `NODE_ENV=production` unless `--i-know-this-erases-owner-edits` is also
  passed. The existing `npm run db:seed` stays and runs the seed-once path.
- **The replacement for "edit menu.json and redeploy":**
  - Before cutover, a dataset correction ships as a **data migration**. That is
    an idempotent SQL file under `drizzle/` (created with
    `npx drizzle-kit generate --custom --name=<what>` so it is in the journal),
    reviewed like any other migration, and it runs once. **The same PR edits
    `data/menu.json` the same way**: on a fresh database the migrations run
    before the seed, so a data migration alone would act on an empty table and
    the seed would then bring the old row back.
  - After cutover, the owner makes such corrections in the editor.
  - `data/menu.json` stays in the repository as the fresh-database bootstrap
    and as the test fixture. Its header note (`data/README` or the loader
    comment) says in plain words that editing it changes nothing in
    production.
- **Priority: robustness.** Of the options considered, only "insert when empty"
  makes owner data impossible to lose on a deploy. A "dataset version" marker
  that reseeds when it changes would bring the erasure back on the first
  dataset edit.

### D2 — Restaurant facts move to tables, seeded once from today's constants

The migration creates the tables. **The values are seeded from code, not by
the migration** (vet correction): the constants move into
`src/lib/shop-defaults.ts` as `DEFAULT_SHOP_RULES`, and `seedShop()` inserts
them — the profile row, the 7 weekdays and the two D4 rows, in one
transaction — only when the `shop_profile` row is absent. `initDatabase`
(`src/index.ts:53`) calls it after `seedMenu()`, and the test harness calls it
after its per-test truncate (`test/support/setup.ts:63-67`). **Resolved
(robustness):** the harness truncates every public table before every test, so
migration-inserted rows would never be seen by a test, and a fresh database and
a test database now reach the same state by the same code path.

The seeded values are **exactly today's constants**, so that on the day this
deploys, `GET /api/shop` returns every field it returns now with the same
value. The values come from the footer of `portofino-essen.de`
(2026-09-14), which `domain_spec/menu` v4 names as the authority. They do not
come from `menu.json` `openingHours`, which that spec marks as superseded.

**If the rules cannot be loaded** (no `shop_profile` row, or the database is
unreachable), the loader throws a 503 with a German message. Orders and the
payment re-check are then refused: the side that cannot take an order for a
closed kitchen.

| Table | Columns |
|---|---|
| `shop_profile` (one row, `id = 1`, `CHECK (id = 1)`) | `name`, `street`, `postal_code`, `city`, `phone_display`, `phone_e164`, `email` (nullable), `delivery_until` (`HH:MM`), `holiday_open`, `holiday_close`, `ruhetag_beats_holiday` (bool), and the legal fields from D6 (`legal_owner_name`, `legal_form`, `vat_id`, `register_court`, `register_number`, all nullable, and `legal_confirmed_at` timestamptz nullable), plus `version` (int) and `updated_at` |
| `shop_weekly_hours` | `weekday` 1–7 (PK); `open` and `close`, both NULL together meaning Ruhetag, enforced by a `CHECK` |
| `shop_special_days` | `id`; exactly one of `date` (a one-off date, `YYYY-MM-DD`) or `month_day` (`MM-DD`, recurring every year); `closed` (bool); `open`, `close` and `delivery_until` (nullable, required when not `closed`, except the recurring `open = NULL` case in D4); `note` (German, shown to diners); `confirmed` (bool, default `true`; the two D4 rows are seeded `false` and any owner save sets it `true`). Partial unique indexes on `date` and on `month_day` enforce D5 rule 2's "no two rows for the same day". |
| `admin_changes` | `id`, `entity` (`'shop'`), `before` jsonb, `after` jsonb, `at`. `before`/`after` are **whole-shop snapshots** (profile, weekly, special days); see D5 rule 6. |

- `shop.ts` keeps its exported functions: `shopStatus`, `refusalFor`, `hoursOn`,
  `berlinTime` and `nrwHolidays`. Instead of constants, they read a
  `ShopRules` value that is loaded from the tables.
- The rules are loaded once per request, by `loadShopRules()` in a new
  `src/lib/shop-rules.ts`, called from `routes/shop.ts`,
  `lib/order-service.ts:90` and `routes/payments.ts:98`. The pure functions
  stay pure and take the rules as a **required** argument (no default: a
  default would be a second source of truth). `shop.test.ts` stays
  table-driven and free of database access by passing `DEFAULT_SHOP_RULES`.
- **Order of resolution for a date:**
  1. a dated special day;
  2. a recurring special day;
  3. a public holiday, which follows `ruhetag_beats_holiday`;
  4. the weekday.
- **"Ruhetag" means a weekday the weekly hours close, not "Tuesday".** Today's
  code tests `weekday === 2` (`shop.ts:193`); once the owner edits the week,
  that is derived from `shop_weekly_hours`.
- **The Ruhetag rule applies to special days too, under the same setting.**
  While `ruhetag_beats_holiday` is `true`, neither a public holiday nor a
  recurring special day opens a Ruhetag. Only a *dated* special day, which the
  owner typed for that specific date, can open one. Priority: the side that
  cannot leave food uncooked, the same reasoning `domain_spec/menu` v4 gives
  for holidays. **Resolved (clean code):** one setting governs both, rather
  than a second flag nobody would find.
- A recurring special day whose resolved window is empty (its `close` is at or
  before the weekday's normal opening) is a closed day, and the preview says
  so.
- `refusalFor()` names the **day's** delivery close, not the constant
  `DELIVERY_UNTIL`, so "Lieferungen nehmen wir heute nur bis 13:30 Uhr an"
  is right on Heiligabend.

### D3 — What diners are shown and what the server enforces come from the same rows

Today `HOURS_DISPLAY` (`:272`) is hand-written text sitting beside `WEEKLY`, the
table the server enforces. The two can disagree. It becomes a function,
`displayHours(rules)`:
- it groups weekdays with identical windows. A run of three or more
  consecutive weekdays is written as a range ("Mittwoch – Freitag"); anything
  else is joined with ", " ("Montag, Mittwoch – Freitag"; "Samstag, Sonntag");
- the public-holiday window is **merged into the group with the same window**
  as " und Feiertage" ("Samstag, Sonntag und Feiertage", which is what today's
  constant prints); only when no group matches does it get its own
  "Feiertage" row;
- it lists Ruhetage last.

A test asserts that, with `DEFAULT_SHOP_RULES`, its output deep-equals today's
`HOURS_DISPLAY` (`shop.ts:272-276`), which the test keeps as a literal.

The owner edits **times, never sentences**, so the printed hours cannot drift
from the enforced ones.

### D4 — Heiligabend and Silvester: the default hours

Seeded as **recurring** `shop_special_days` rows, labelled in the editor as
*"Vorbelegt – bitte prüfen"* until the owner saves them once:

| Day | Opens | Closes | Last delivery | Note shown to diners |
|---|---|---|---|---|
| `12-24` Heiligabend | the weekday's normal opening (12:00, or 13:00 on Sat/Sun) | **14:00** | **13:30** | "Heiligabend: geöffnet bis 14:00 Uhr" |
| `12-31` Silvester | the weekday's normal opening | **18:00** | **17:30** | "Silvester: geöffnet bis 18:00 Uhr" |

- Early closing on both evenings is the common pattern for German restaurants.
- The 30-minute gap between closing and last delivery copies the footer's
  22:30/22:00 gap.
- `open = NULL` on a recurring row means "the weekday's normal opening". That
  is the only nullable-open case, and the `CHECK` allows it only when
  `closed = false` and `close` is set.
- **Both rows are defaults, and the vet should not treat them as facts.** No
  source states Portofino's actual hours on these days. Until the owner saves
  them, `GET /api/admin/shop` returns `confirmed: false` for them, and the
  editor highlights them. Neujahr (1 January) is a statutory holiday and
  already gets holiday hours; it needs no row.

### D5 — The editor's safety rules

The shop editor gets the same safety bar as the menu editor. Each rule is
enforced on the server and pinned by a test.

1. **Each part is saved whole.** One request sends all 7 weekdays, or all the
   profile fields. There are no per-field writes, so no request can leave the
   week half-updated. **"Urlaub eintragen" is one request too:**
   `POST /special-days` takes `days: [...]` (1–62 entries) and writes them in
   one transaction, so a holiday is never half-entered and bumps `version`
   once.
2. **Impossible states are refused:**
   - a time that is not `HH:MM`;
   - `close <= open` (a window across midnight is refused);
   - `delivery_until` after `close` (it may be earlier than `open`, which means
     no delivery that day, and the preview says so);
   - a dated special day in the past;
   - a special day where both `date` and `month_day` are set, or neither;
   - two special days for the same date or the same `month_day`.
3. **Closing all 7 weekdays needs `confirmAllClosed: true`**, the same pattern as
   `confirmNoAllergens`.
4. **The phone number must parse to a dialable German number.** `phone_e164` is
   derived on the server from `phone_display`; the client does not send it.
   A small local normaliser (no new dependency) strips spaces, `-`, `–`, `/`
   and brackets, turns a leading `0` or `0049` into `+49`, and requires 6–13
   digits after `+49` with no leading `0`. It must map `02054 – 15 88 3` to
   `+49205415883` (today's constant).
   The reason: a wrong number is *"a silent, total failure"* of tap-to-call
   (`domain_spec/menu`).
5. **Optimistic concurrency.** Every write carries the `version` it was read at.
   A mismatch answers **409** in German ("Inzwischen hat jemand anderes
   gespeichert – bitte neu laden").
6. **One transaction per write, plus a history row.** Each write adds a row to
   `admin_changes` (`entity`, `before` jsonb, `after` jsonb, `at`) inside the
   same transaction. `before` and `after` are whole-shop snapshots, so one
   undo reverses any kind of write (a special day created, a week changed).
   `POST /api/admin/shop/undo { version }` restores the most recent `before`
   in one transaction and records the undo as a change of its own (so a second
   undo is a redo). It checks the structural invariants (times, windows,
   uniqueness), but not the "no dated day in the past" rule, which applies to
   new entries only; otherwise undo would fail after midnight.
7. **A preview before saving.** `POST /api/admin/shop/preview` runs a draft
   through `shopStatus()` and `displayHours()` without writing anything. It
   returns what a diner would see today and on the next 7 days.

**Priority for 5–7:** `audience_profile/owner-operator` says the editor must be
*"obvious to someone who last used it six months ago"* and must *"make a
dangerous mistake hard"*. For that user, the preview and the undo are how a
mistake is found and fixed.

### D6 — The legal notice (Impressum)

- **Route and reachability.** `mobile/src/app/impressum.tsx` serves `/impressum`
  on web, and the same screen on native.
  - It is linked from the menu's shop footer (`src/app/index.tsx:678-718`) and
    from checkout. The menu link sits **outside** the `if (shop)` branch that
    renders the contact band, so it is there even when `/api/shop` fails.
  - When the API has no `legal` object (an older backend) or cannot be
    reached, the page says so in German and offers a retry; it never shows
    invented facts.
  - The law requires the notice to be *"leicht erkennbar, unmittelbar
    erreichbar"*: at most two taps from any screen, with the word
    "Impressum" as the link text.
- **Content.** The page renders these sections from `GET /api/shop` `legal`:
  - **Angaben gemäß § 5 DDG**
    - Inhaber: legal name of the owner (`legal_owner_name`);
    - Rechtsform (`legal_form`, default `Einzelunternehmen`);
    - Restaurant name, street, postal code and city from the profile.
  - **Kontakt:** Telefon from the profile; E-Mail (`email`).
  - **Umsatzsteuer-ID** according to § 27a UStG (`vat_id`), shown only when set.
  - **Handelsregister** (`register_court`, `register_number`), shown only when
    set. For an Einzelunternehmen it normally does not apply.
  - **Verbraucherstreitbeilegung**, fixed text: *"Wir sind nicht bereit und nicht
    verpflichtet, an Streitbeilegungsverfahren vor einer
    Verbraucherschlichtungsstelle teilzunehmen."* (§ 36 VSBG).
  - **Lebensmittelinformationen**, fixed text: allergen and additive
    information is listed with each dish, and questions are answered by
    phone.
- **Deliberately left out:**
  - the EU online dispute resolution (OS) platform link, because the platform
    was shut down on 20 July 2025 and the duty to link to it ended with it;
  - a "V.i.S.d.P." or § 18 MStV line, because a menu and ordering site is not
    journalistic or editorial content.
- **The owner's own facts are unknown, and none of them may be invented.** The
  legal name, legal form, email address and VAT ID appear in no document or
  footer this plan can read. The description of `audience_profile/owner-operator`
  gives a first name, not a legal name. The seed therefore leaves them NULL.
  - The owner fills them in on the editor's "Impressum" section. That section
    has its own confirmation: "Diese Angaben sind korrekt und vollständig".
  - While `legal_owner_name` or `email` is NULL, the page still renders what is
    known, **and** `/api/health` reports `legal: "incomplete"` with the list of
    missing fields (`legalMissing`). The deploy pipeline logs a warning; it
    does not fail the deploy.
  - **`/api/health` must not query the database** (it is App Runner's health
    check and answers before the DB is up: `src/index.ts:11-13`). So `legal` is
    read from an in-process cache: filled at the end of `initDatabase`,
    updated by every profile/legal write on this instance, and refreshed in the
    background at most once a minute when a health read finds it older than
    that (the refresh never blocks or fails the health response). Before the
    first load it reads `legal: "unknown"`. **Resolved (robustness):** a health
    check that can fail on the database would take the service out of
    rotation for a legal-notice gap.
  - **Store submission and the website cutover are blocked** while it reads
    `incomplete`. A public app without a complete Impressum can draw a
    warning letter from competitors (*Abmahnung*). That risk falls on the
    owner, so the gate sits before the public release, not before
    development deploys.

## API

All admin routes go through the existing owner guard, which fails closed
(`requireOwnerAuth`, backend `src/routes/admin-menu.ts`), moved to
`src/lib/owner-auth.ts` so both route files share it. It keeps
`OWNER_MENU_TOKEN`. Renaming the variable is not worth the infrastructure
change. Decision D5 of the menu editor plan (owner and kitchen use different
tokens) is unchanged.

```
GET    /api/admin/shop                     → { profile, weekly[7], specialDays[], version }
PUT    /api/admin/shop/profile             { name, street, postalCode, city, phoneDisplay, version }
PUT    /api/admin/shop/hours               { weekly[7], deliveryUntil, holidayOpen, holidayClose,
                                             ruhetagBeatsHoliday, confirmAllClosed?, version }
PUT    /api/admin/shop/legal               { legalOwnerName, legalForm, email, vatId?, registerCourt?,
                                             registerNumber?, confirmed: true, version }
POST   /api/admin/shop/special-days        { days: [{ date | monthDay, closed | open/close/deliveryUntil, note }], version }
PATCH  /api/admin/shop/special-days/:id    { …, version }
DELETE /api/admin/shop/special-days/:id    ?version=
POST   /api/admin/shop/preview             draft → { display, days[8]: ShopStatus-shaped }
POST   /api/admin/shop/undo                { version }
```

- `version` is a single counter on `shop_profile`. Every shop write increases
  it, including writes to hours and special days.
- `email` has one writer, `PUT /legal` (it is an Impressum fact); the profile
  write does not carry it. `PUT /legal` requires `confirmed: true` (the
  "Diese Angaben sind korrekt und vollständig" box) and stamps
  `legal_confirmed_at`.
- `GET /api/shop` keeps every field it returns today. It **adds**:
  - `specialDays`, meaning special days in the next 30 days, so the menu can
    say "Silvester: geöffnet bis 18:00 Uhr" ahead of time;
  - `legal`.
- `mobile/src/lib/types.ts` `ShopInfo` gets the same additions, as optional
  fields, so that an older app keeps working against the newer API.

### The response shapes, fixed at implementation start

Both repos were built against one written contract so the mobile client could
be implemented in parallel with the API:

- `GET /api/shop` keeps every field it serves today and adds `specialDays:
  DayHours[]` (every date in the next 30 days whose hours a special day
  decided, each carrying its `special` note) and `legal: { ownerName,
  legalForm, email, vatId?, registerCourt?, registerNumber?, complete,
  missing[] }`.
- Every admin route answers the whole `AdminShop` object —
  `{ version, canUndo, profile, legal, weekly[7], specialDays[] }` — so the
  editor never has to merge a partial response.
- `POST /preview` answers `{ display, status, days: DayHours[8] }` and writes
  nothing.
- On an open special day, `deliveryUntil: null` means "no own value": the
  profile-wide `deliveryUntil` applies, clamped to that day's `close`.
- `/api/health` adds `legal: "complete" | "incomplete" | "unknown"` and
  `legalMissing[]`.

## Phases

The riskiest phase comes first.

**PR split (vet correction).** The plan said "each phase ships as its own PR".
Both repos are landed by coord, and a PR stacked on another PR's branch loses
checks (`knowledge-base/qontinui-specific/stacked-prs.md`). Phases 1–3 cannot
compile without each other's migration and loader, and Phases 4–5 edit the same
`types.ts` / `api.ts`. **Resolved (robustness):** three PRs, each based on the
default branch, none stacked:

| PR | Repo | Phases | Waits for |
|---|---|---|---|
| A | backend | 0 | nothing (independent, riskiest) |
| B | backend | 1, 2, 3, with one migration (`0005`) for all shop tables including the legal columns | A: A's migration is `0004` (`dataset_seeds`) and the drizzle journal is linear, so B is branched from A's head, based on `master`, and labelled `coord:downstream-of=backend#<A>` (full checks, landing order enforced) |
| C | mobile | 4, 5 | B (label `coord:downstream-of=backend#<B>`), so the web never calls routes the API does not have |

Each PR body carries `Plan: <stem> phases: <n,…>`.

### Phase 0 — Stop the reseed at boot (backend)

- `seedMenu()`: seed once per database, recorded in `dataset_seeds` (D1).
- Add `npm run db:reseed` with its guards; keep `npm run db:seed`.
- Add the header note to the loader (`src/db/menu-dataset.ts`) and a
  `data/README.md`: editing `menu.json` changes nothing in a database that has
  been seeded.
- Update `README.md` wherever it says that boot reseeds (`:246-252`,
  `:274-284`, the "Owner menu edits are not protected" limit). `TESTING.md`
  does not mention boot reseeding; leave it unless the harness changes.
- **Gate:**
  - a new test in `test/seed.test.ts` (new file): seed, edit an item through
    `PATCH /api/admin/menu/items/:id`, call `seedMenu()` again as a boot would,
    and check that the edit is still there;
  - on an empty database, the seed still loads the full dataset and writes the
    marker;
  - a database with items but no marker (today's production) gets the marker
    and no rewrite;
  - after the owner deletes every item, `seedMenu()` does not bring them back;
  - `db:reseed` without `--force` refuses;
  - `npm test` and `npm run typecheck` are green.

### Phase 1 — Shop tables, read from the database, nothing changes for diners (backend)

- Add the migration: the tables from D2 (DDL only).
- Add `src/lib/shop-defaults.ts` (`DEFAULT_SHOP_RULES`: today's constants plus
  the two D4 rows) and `seedShop()`; call it from `initDatabase` and from the
  test harness after the truncate (`test/support/setup.ts`).
- Make `shop.ts` take its rules as a required argument (`ShopRules`), derive
  the Ruhetag from the weekly hours, and make `refusalFor` name the day's
  delivery close.
- Load the rules (`loadShopRules()`) in `routes/shop.ts`,
  `lib/order-service.ts:90` and `routes/payments.ts:98`. The re-check when
  payment starts (`bdaaeac`) must read the same rules.
- Add `displayHours()` and remove the `HOURS_DISPLAY` constant.
- `GET /api/shop` adds `specialDays` (the next 30 days).
- **Gate:**
  - `test/fulfilment.test.ts`, `test/orders.test.ts` and
    `test/payments.test.ts` pass **unchanged**, which shows diners see no
    difference;
  - `test/shop.test.ts` keeps every expectation; its only change is passing
    `DEFAULT_SHOP_RULES` to the pure functions (they cannot pass unchanged once
    the rules are an argument);
  - a snapshot test pins the `GET /api/shop` body at a pinned time as a
    literal captured from `bdaaeac`, and asserts every field in it is
    unchanged (only `specialDays`, and in Phase 3 `legal`, are added);
  - new tests: Heiligabend on a Wednesday refuses delivery at 13:31 and pickup
    at 14:00, and the delivery refusal names 13:30; Heiligabend on a Tuesday
    stays a Ruhetag; a dated special day that opens a Tuesday takes orders;
    moving the Ruhetag to Monday makes Monday refuse and Tuesday take orders;
    with no `shop_profile` row, `POST /api/orders` is refused with 503.

### Phase 2 — The owner's shop API (backend)

- Add the routes above, with every rule from D5 and the `admin_changes` history.
- Move `requireOwnerAuth` from `routes/admin-menu.ts:43` to
  `src/lib/owner-auth.ts`; both route files import it. Its German messages
  name the editor generically ("Der Inhaber-Editor …") since it now guards
  two surfaces.
- **Gate:** `test/admin-shop.test.ts`, with one test per D5 rule, plus:
  - the guard fails closed when the token is unset;
  - a special day marked closed makes `POST /api/orders` return the German
    refusal on that date;
  - the preview's `days[0]` equals `GET /api/shop` `status` after saving the
    same draft;
  - a save followed by `undo` returns exactly the state before the save.

### Phase 3 — Impressum data and health reporting (backend)

- The legal columns are in the Phase 1 migration (same PR B).
- Add `PUT /api/admin/shop/legal`, `GET /api/shop` `legal`, and `/api/health`
  `legal` / `legalMissing` from the in-process cache (D6).
- Make the deploy workflow (`.github/workflows/deploy.yml`, beside the
  kitchen-guard assertion) log a `::warning::` on `incomplete` and on
  `unknown`; it never fails the deploy on this field.
- **Gate:** tests for the health field in all three states (`unknown` before
  the cache loads, `incomplete` with the missing list, `complete`), that
  `/api/health` issues no query (it still answers with the pool pointed at an
  unreachable host, or with the loader stubbed to throw), and for the `vat_id`
  and register fields that are omitted when unset.

### Phase 4 — Admin UI (mobile)

- `src/app/admin/index.tsx` gets two entries at the top: **Speisekarte** (the
  existing overview) and **Restaurant & Öffnungszeiten** (a new screen,
  `src/app/admin/restaurant.tsx`).
- The new screen has these sections, in this order:
  1. **Sondertage & Urlaub** comes first, because it is the most common task.
     - "Urlaub eintragen" takes a date range and adds one dated row per day.
     - "Andere Zeiten an einem Tag" edits a single date.
     - The Heiligabend and Silvester rows are shown with their *Vorbelegt*
       badge until confirmed.
  2. **Öffnungszeiten:** 7 rows, each with a Geöffnet/Ruhetag switch and time
     pickers (no free-text times: a fixed list in 15-minute steps built from
     `AdminButton`, no new dependency), plus "Lieferung bis" and the holiday
     hours. Above the save button sits "So sehen es Ihre Gäste", fed by
     `/preview`.
  3. **Adresse & Telefon:** a confirmation step before saving, and a
     "Test: anrufen" link.
  4. **Impressum:** the legal fields and their confirmation.
- After every save, show "Rückgängig" for 30 seconds, which calls
  `POST /undo`.
- Reuse `src/components/admin-ui.tsx` (`AdminButton`, `AdminField`,
  `ConfirmAction`, `Notice`) and extend `src/lib/admin.ts`.
- Everything is in German, phone-first, and uses the same saved owner token.
- **Gate:**
  - `npm run lint` and `npx tsc --noEmit` are clean;
  - a UI Bridge-driven run on native: set Silvester to close at 17:00, save,
    see the change in the preview and in `GET /api/shop`, undo it. This needs
    a device or emulator with the dev build and a backend carrying PR B; where
    neither is available the gate is reported **not run**, with the reason,
    never as passed.

### Phase 5 — The Impressum page, and the special-day line for diners (mobile)

- Add `src/app/impressum.tsx`, the footer link (outside the `if (shop)`
  branch) and the checkout link.
- The menu's status line shows the next special day within 7 days.
- `closedReason` (`src/hooks/use-shop.ts`) names the day's delivery close
  (`status.today.delivery?.close`, falling back to `deliveryUntil`), matching
  the server's `refusalFor`.
- **Gate:**
  - lint and typecheck are clean;
  - the web export contains `/impressum`;
  - UI Bridge: from the menu, the Impressum opens with one tap.

## Out of scope, named so that nobody assumes they are covered

- **Datenschutzerklärung (privacy policy).** It is required as well (Art. 13
  DSGVO), because checkout collects name, phone and address and payment goes
  through Stripe. Its content depends on processors and retention periods,
  which is a separate plan. It **blocks cutover in the same way the
  incomplete Impressum does.**
- **Gaps in the product editor:**
  - `pickupOnly` can't be edited;
  - there is no "Ausverkauft – nur heute" that resets at closing, which is the
    stale-availability question in `domain_spec/menu` (5);
  - `check-assets.py` only sees `data/menu.json`, so after D1 it misses dishes
    the owner adds.

  Each belongs in its own follow-up plan. The third is recorded here because
  D1 is what makes that check go blind.
- **Scheduled pickup, delivery area and minimum order value.** These are still
  declared UNKNOWN in `domain_spec/menu` v4.

## Intent writes

`domain_spec/menu` gets an append. It is announced with a coord finding, as the
tier `allow_with_notification` requires, and it:
- records the four operator decisions above;
- declares that restaurant facts are owner-authored after this plan ships;
- moves "Special closures" and the Tuesday-holiday item out of UNKNOWN and "owed
  back";
- declares that the Impressum is required, with the owner facts it is missing.

The draft is kept at
`mobile/docs/intent-drafts/domain_spec--menu--APPEND-owner-shop-facts.md`.

**Done before the vet:** applied as `domain_spec/menu` v4 → v5 and announced by
finding `5d247a1e-df90-4500-a36c-b569ed2af0f4`. Implementation must not append
it again.

## Risks

- **D1 changes how a menu correction reaches production before cutover.**
  Anyone used to "edit menu.json and redeploy" will see nothing happen. The
  README change, the loader comment and the boot log line are the mitigation.
  Not reseeding is the safe failure: nothing gets erased.
- **The D4 defaults may be wrong for Portofino.** They are marked unconfirmed in
  the editor, and the first real Heiligabend under this code is 2026-12-24.
  The owner is asked before then (Open questions).
- **The Impressum ships incomplete** until the owner supplies the four facts. It
  is reported, not hidden, and it blocks store submission and cutover.

## Open questions (owner)

1. What are the actual hours on Heiligabend and Silvester? The D4 values are
   defaults.
2. The Impressum facts:
   - the legal name of the business owner;
   - the legal form (Einzelunternehmen, GbR or GmbH);
   - a contact email address;
   - the VAT ID, if there is one;
   - the commercial register entry, if there is one.
