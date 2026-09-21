# Portofino — the owner edits the restaurant's facts (hours, special days, address, legal notice), and their edits survive a deploy (2026-09-19)

> **Status: DRAFT 2026-09-19.** Not vetted.
>
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

- `seedMenu()` inserts only when `menu_items` is empty (a fresh database). If
  any row exists, it returns without writing and logs
  `Menu already present (N items) — not reseeding`.
- The full reset stays available as an explicit, local-only command:
  `npm run db:reseed -- --force`. It refuses to run when `NODE_ENV=production`
  unless `--i-know-this-erases-owner-edits` is passed.
- **The replacement for "edit menu.json and redeploy":**
  - Before cutover, a dataset correction ships as a **data migration**. That is
    an idempotent SQL file under `drizzle/`, reviewed like any other migration,
    and it runs once.
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

The migration creates the tables and inserts **exactly today's constants**, so
that on the day this deploys, `GET /api/shop` returns byte-for-byte what it
returns now. The values come from the footer of `portofino-essen.de`
(2026-09-14), which `domain_spec/menu` v4 names as the authority. They do not
come from `menu.json` `openingHours`, which that spec marks as superseded.

| Table | Columns |
|---|---|
| `shop_profile` (one row, `id = 1`, `CHECK (id = 1)`) | `name`, `street`, `postal_code`, `city`, `phone_display`, `phone_e164`, `email` (nullable), `delivery_until` (`HH:MM`), `holiday_open`, `holiday_close`, `ruhetag_beats_holiday` (bool), and the legal fields from D6, plus `version` (int) and `updated_at` |
| `shop_weekly_hours` | `weekday` 1–7 (PK); `open` and `close`, both NULL together meaning Ruhetag, enforced by a `CHECK` |
| `shop_special_days` | `id`; exactly one of `date` (a one-off date, `YYYY-MM-DD`) or `month_day` (`MM-DD`, recurring every year); `closed` (bool); `open`, `close` and `delivery_until` (nullable, required when not `closed`); `note` (German, shown to diners) |

- `shop.ts` keeps its exported functions: `shopStatus`, `refusalFor`, `hoursOn`,
  `berlinTime` and `nrwHolidays`. Instead of constants, they read a
  `ShopRules` value that is loaded from the tables.
- The rules are loaded once per request, in the route. The pure functions stay
  pure and take the rules as an argument. That keeps `shop.test.ts`
  table-driven and free of database access.
- **Order of resolution for a date:**
  1. a dated special day;
  2. a recurring special day;
  3. a public holiday, which follows `ruhetag_beats_holiday`;
  4. the weekday.
- **The Ruhetag rule applies to special days too.** A recurring special day that
  falls on a Tuesday leaves the Ruhetag in place. Only a *dated* special day,
  which the owner typed for that specific date, can open a Tuesday. Priority:
  the side that cannot leave food uncooked, the same reasoning
  `domain_spec/menu` v4 gives for holidays.

### D3 — What diners are shown and what the server enforces come from the same rows

Today `HOURS_DISPLAY` (`:272`) is hand-written text sitting beside `WEEKLY`, the
table the server enforces. The two can disagree. It becomes a function,
`displayHours(rules)`:
- it groups weekdays with identical windows ("Montag, Mittwoch – Freitag");
- it appends the public-holiday row;
- it lists Ruhetage.

A test asserts that, with the seeded rules, its output equals today's constant.

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
   week half-updated.
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
   The reason: a wrong number is *"a silent, total failure"* of tap-to-call
   (`domain_spec/menu`).
5. **Optimistic concurrency.** Every write carries the `version` it was read at.
   A mismatch answers **409** in German ("Inzwischen hat jemand anderes
   gespeichert – bitte neu laden").
6. **One transaction per write, plus a history row.** Each write adds a row to
   `admin_changes` (`entity`, `before` jsonb, `after` jsonb, `at`) inside the
   same transaction. `POST /api/admin/shop/undo` restores the most recent
   `before` value, through the same validation.
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
    from checkout.
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
    missing fields. The deploy pipeline logs a warning; it does not fail the
    deploy.
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
PUT    /api/admin/shop/profile             { …profile, version }
PUT    /api/admin/shop/hours               { weekly[7], deliveryUntil, holidayOpen, holidayClose,
                                             ruhetagBeatsHoliday, confirmAllClosed?, version }
PUT    /api/admin/shop/legal               { legalOwnerName, legalForm, email, vatId?, …, version }
POST   /api/admin/shop/special-days        { date | monthDay, closed | open/close/deliveryUntil, note, version }
PATCH  /api/admin/shop/special-days/:id    { …, version }
DELETE /api/admin/shop/special-days/:id    ?version=
POST   /api/admin/shop/preview             draft → { display, days[8]: ShopStatus-shaped }
POST   /api/admin/shop/undo                { version }
```

- `version` is a single counter on `shop_profile`. Every shop write increases
  it, including writes to hours and special days.
- `GET /api/shop` keeps every field it returns today. It **adds**:
  - `specialDays`, meaning special days in the next 30 days, so the menu can
    say "Silvester: geöffnet bis 18:00 Uhr" ahead of time;
  - `legal`.
- `mobile/src/lib/types.ts` `ShopInfo` gets the same additions, as optional
  fields, so that an older app keeps working against the newer API.

## Phases

The riskiest phase comes first. Each phase ships as its own PR.

### Phase 0 — Stop the reseed at boot (backend)

- `seedMenu()`: insert only when the menu table is empty (D1).
- Add `npm run db:reseed` with its guards.
- Add the header note to `data/menu.json` or its loader.
- Update `README.md` and `TESTING.md` wherever they say that boot reseeds.
- **Gate:**
  - a new test in `test/seed.test.ts`: edit an item through
    `PATCH /api/admin/menu/items/:id`, call `seedMenu()` again as a boot would,
    and check that the edit is still there;
  - a second test: on an empty database, the seed still loads the full
    dataset;
  - `npm test` and `npm run typecheck` are green.

### Phase 1 — Shop tables, read from the database, nothing changes for diners (backend)

- Add the migration: the tables from D2, the seed values from today's
  constants, and the two D4 rows.
- Make `shop.ts` take its rules as an argument (`ShopRules`).
- Load the rules in `routes/shop.ts`, `routes/orders.ts` and
  `routes/payments.ts`. The re-check when payment starts (`bdaaeac`) must read
  the same rules.
- Add `displayHours()`.
- **Gate:**
  - `test/shop.test.ts`, `test/fulfilment.test.ts`, `test/orders.test.ts` and
    `test/payments.test.ts` pass **unchanged**, which shows diners see no
    difference;
  - a snapshot test shows that `GET /api/shop` at a pinned time returns the
    same body before and after;
  - new tests: Heiligabend on a Wednesday refuses delivery at 13:31 and pickup
    at 14:00; Heiligabend on a Tuesday stays a Ruhetag; a dated special day
    that opens a Tuesday takes orders.

### Phase 2 — The owner's shop API (backend)

- Add the routes above, with every rule from D5 and the `admin_changes` history.
- **Gate:** `test/admin-shop.test.ts`, with one test per D5 rule, plus:
  - the guard fails closed when the token is unset;
  - a special day marked closed makes `POST /api/orders` return the German
    refusal on that date;
  - the preview's `days[0]` equals `GET /api/shop` `status` after saving the
    same draft;
  - a save followed by `undo` returns exactly the state before the save.

### Phase 3 — Impressum data and health reporting (backend)

- Add the legal columns (in the Phase 1 migration if Phase 1 has not merged
  yet, otherwise in their own migration).
- Add `PUT /api/admin/shop/legal`, `GET /api/shop` `legal`, and `/api/health`
  `legal`.
- Make the deploy workflow log a warning on `incomplete`.
- **Gate:** tests for the health field in both states, and for the `vat_id` and
  register fields that are omitted when unset.

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
     pickers (no free-text times), plus "Lieferung bis" and the holiday
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
    see the change in the preview and in `GET /api/shop`, undo it.

### Phase 5 — The Impressum page, and the special-day line for diners (mobile)

- Add `src/app/impressum.tsx`, the footer link and the checkout link.
- The menu's status line shows the next special day within 7 days.
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
