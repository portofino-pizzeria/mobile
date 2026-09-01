# Portofino Pizzeria Mobile App — Kickoff Roadmap

> **Status: DRAFT 2026-06-13 — working roadmap for the shared-account team
> (you + 3 business advisors), starting 2026-06-14.** Goal: build a mobile app for
> Portofino (Essen) — an existing pizzeria with a website
> (`https://portofino-essen.de/pizza/`) that needs a mobile companion. This is the
> first real dogfood of Qontinui by the advisor group; it is **not** a critical
> product deliverable. We build the **core-to-Qontinui components** properly and use
> them (plus direct agent work) to ship one real app. Companion artifact: the starter
> functional model in `2026-06-13-portofino-functional-spec-starter.md`.

## The site, as observed (2026-06-13)

A first comprehension pass (WebFetch) of `portofino-essen.de/pizza/` found:

- **Large structured menu** — ~15 categories (Pizza ~29 items, Vorspeisen, Nudeln,
  Frisch aus dem Ofen, Mexikanisch, Salate, Vegetarische Aufläufe, Fisch,
  Schweinefilet, Schnitzel, Hähnchenbrust, Rumpsteak, Getränke, Dessert, Angebote).
  Each item: number, name, ingredient description, **three sizes** (klein 22cm,
  groß 28cm, Blech 30×50cm) with per-size price, and **allergen codes**.
- **Ordering exists but is third-party** — a cart ("Warenkorb") and a
  Lieferung/Abholung (delivery/pickup) selector, **"Powered by Delivery Way."** The
  transaction + payment layer is an external SaaS, **not** the cousin's own backend.
- **Hours:** Mo, Mi–Fr 12:00–22:00; Di closed; Sa–So 13:00–22:00.
- **Language:** German only.
- **No visible user login/accounts.**

### Why this is good news for scope

The hard, expensive parts (ordering engine, payments) are **already solved by
Delivery Way**. The app's job is the *ownable, high-value* experience: a fast,
beautiful native **menu + info**, with a clean **hand-off to Delivery Way** for the
actual order. This means **near-zero backend and no payment integration** — the MVP
is squarely achievable.

## Recommended MVP

A native mobile app that is the best possible *menu + brand + order-starter*:

- **Home** — brand, hero, hours/open-now, quick actions (Order, Call, Directions).
- **Menu** — categories → items with the three sizes, prices, ingredients, allergens.
  (This is the centerpiece; the data is rich and structured.)
- **Item detail** — sizes/prices, allergen legend, add-to-order.
- **Order** — **LOCKED: webview hand-off.** The Order button opens Farid's existing
  ordering URL in an in-app webview (no API keys, no backend, no payments to build).
  See the "Decision fork" below — this is the right *MVP* approach for speed, but it
  does **not** by itself escape the order commission Farid pays today.
- **Info** — hours, address, phone (tap-to-call), map/directions, delivery/pickup.

Out of MVP: user accounts, in-app payments, loyalty — all deferrable, none core.

### Farid's answers (2026-06-14)

- **Address:** Hauptstraße 108, 45219 Essen. **Tel:** 0205415883 *(verify formatting —
  Essen landline area code is 0201; likely `0201 5415883`)*. **Email:** sajad-1@hotmail.de
- **Languages:** German **+ English** ("noch besser").
- **Commission — own site (portofino-essen.de):** **14%** of sales.
- **Commission — Lieferando:** **up to 22%** of sales.
- **Revenue:** own site ~**2.000 €/month**; Lieferando up to ~**10.000 €/month**.
- **Payment:** pickup mostly **cash** ("zum Glück"); card payment also available.
- **Still open:** Apple Developer / Google Play accounts (Q4 — unanswered; chase early).

### Decision fork — the commission math (now with real numbers)

The numbers reframe everything: **Lieferando is the cost leak, not his own site.**

| Channel | Revenue/mo | Commission | Cost/mo | Cost/yr |
|---|---|---|---|---|
| Own site (14%) | ~2.000 € | 14% | ~**280 €** | ~3.360 € |
| Lieferando (22%) | ~10.000 € | up to 22% | up to ~**2.200 €** | ~26.400 € |
| **Total** | ~12.000 € | — | ~**2.480 €** | ~**29.760 €** |

**~88% of Farid's commission outflow is Lieferando.** Two levers, in priority order:

1. **Channel shift (the app's core value — needs NO custom checkout).** Every euro moved
   from Lieferando (22%) to his own direct channel (14%) saves 8 points. Shifting the
   full ~10.000 € → ~**800 €/month saved** (2.200 → 1.400). The branded app — push
   "bestell direkt", loyalty, "order again" — is exactly the tool to pull customers off
   Lieferando. **The locked webview MVP already enables this**, because it routes orders
   to the 14% own site instead of the 22% marketplace.
2. **Custom in-app checkout (follow-on — escapes the 14% too).** Replaces 14% with a
   payment processor (~1.5–2.9% on card; ~**0%** on cash-on-pickup).
   - On current direct ~2.000 €: 14% (280 €) → ~2.5% (~50 €) ≈ **save ~230 €/mo (~2.760 €/yr)** —
     and *more* of it if much is cash-pickup (then the 14% is pure software rent).
   - **Jackpot:** shift Lieferando's ~10.000 € to a custom checkout at ~2.5% ≈ 250 € vs
     2.200 € → **save ~1.950 €/mo**.

**So:** ship the webview MVP now — it already captures **lever 1** (the bigger,
no-build win). Treat the custom checkout (**lever 2**) as the deliberate Phase-2+
decision; with 14%/22% confirmed, it's now clearly worth costing out (Qontinui agents
keep the build cost low; the real scope is payments + PCI/GDPR + kitchen order routing +
maintenance).

**New question for Farid (gates lever 2):** does the **14% apply to cash-on-pickup
orders too**, or only card orders? If it applies to cash pickups, he's paying 14% purely
for ordering software on zero-payment-cost orders — which makes a custom checkout far
more attractive.

## Core-to-Qontinui vs. pragmatic app work

This is the lens that decides where we invest properly vs. move fast:

| Work | Core to Qontinui? | How we treat it |
|---|---|---|
| **Comprehend the site → structured functional model** | ✅ **Core** (perception/discovery/Spec-Check/Digital-Twin lineage) | Build/strengthen it properly. It's also the **best advisor demo** and it produces the menu model the app needs. |
| **The functional-model spec format** | ✅ Core-ish | Use the starter spec as the first real instance; refine the format from this real case. |
| **Build the Expo app from the model** | 🟡 Pragmatic | Direct agent work in the runner, reusing `qontinui-mobile`'s stack. **No app-generator** for one app. |
| **Backend** | ❌ Not needed | None for MVP. Menu is static/CMS-able data; ordering = Delivery Way. |
| **Ship pipeline (EAS/AAB/TestFlight)** | ➖ Existing | Reuse `qontinui-mobile`'s EAS config + `build-mobile-aab`. |

## The roadmap (phases the team works through)

### Phase 0 — Setup & orient (tomorrow, together)
- Create the shared Qontinui account; everyone signs into the runner + web dashboard.
- 15-min orientation: the runner, the Terminal, how agents do work, the UI Bridge.
- **Confirm the unknowns with the cousin** (these gate later phases — see below).

### Phase 1 — Comprehend the site (CORE — the showpiece demo)
- Drive Qontinui's discovery/vision/web-extraction at `portofino-essen.de` to extend
  the starter functional model into the complete menu + info model.
- **Demo moment:** advisors watch the product *understand a real website* and emit a
  structured spec. This is the single most compelling thing to show.
- Output: the completed `portofino-functional-spec` (the menu is the bulk of it).

### Phase 2 — Design the app (together — advisors add the most value here)
- Lock MVP scope (above), branding, screen list, German-first (English later?).
- Business advisors weigh in on what matters to *pizzeria customers* (ordering
  friction, menu clarity, open-now, call/directions).

### Phase 3 — Build (pragmatic, agent-assisted)
- Claude Code agents in the runner build the Expo app from the model, reusing
  `qontinui-mobile` patterns. Menu data from the spec; order = Delivery Way hand-off.
- Iterate with `/manual-test`, `/visual-audit`, `page-health` on the live app.

### Phase 4 — Ship to the cousin
- EAS preview/AAB → TestFlight / Play internal track so the cousin can try it on a
  real phone and give feedback.

## Decisions to confirm with Farid (Phase 0)

**Ordering URL — already known, not a question.** The page Farid gave us
(`portofino-essen.de/pizza/`) already contains the cart + delivery/pickup flow, so the
webview hand-off opens *that* page directly. No API keys, no separate ordering link.

**App-build inputs (gate the MVP build):**
1. **Contact facts** — exact address, phone, email (the fetch didn't surface these).
2. **Branding** — logo, colors, photos. (Advisors can help source these.)
3. **Languages** — German only, or add English?
4. **App-store accounts — DECIDED 2026-06-14: Farid gets his own accounts (you help
   set up).** Best outcome — the app lives under his own identity, he owns it long-term.
   **Native Expo app, published under Farid's Apple + Google accounts.** Building +
   demoing still needs no account (sideload Android APK / Expo dev builds), but the
   accounts are now on the **critical path with real lead times — start this week:**
   - **Apple Developer ($99/yr).** *Individual* account = fast (Apple ID + payment +
     ID check, ~1–2 days); seller shows as Farid's name. *Organization* account (seller
     shows "Portofino") requires a **D-U-N-S number** — free but **days to ~2 weeks** to
     obtain/verify → if he wants the business name as seller, **start the D-U-N-S now**
     (it's the long pole). No banking/tax forms needed: the app is **free, no in-app
     purchases**.
   - **Google Play ($25 one-time).** Identity verification (a few days). **Gotcha:**
     new *personal* developer accounts must run a **closed test with ≥12 testers for 14
     days** before production release — so this 14-day clock should start as soon as
     there's a testable build. Start the account + verification now.
   - **Action:** kick off both enrollments this week so they're cleared before the app
     is ready; decide individual-vs-organization for Apple (drives the D-U-N-S timing).

**Cost / build-vs-buy inputs (gate the LATER custom-checkout decision, not the MVP):**
6. **Current ordering cost** — Farid believes ~15–20% of sales. Confirm: flat fee,
   one-time, and/or **percent of sales**? Paid to **whom exactly** (website builder vs
   Delivery Way / deliveryway.de — these may differ), and on **which orders** (web only,
   or all)?
7. **Volume** — orders/month and average order value.
8. **Marketplaces** — is he also on Lieferando/Uber Eats, and at what commission? (Often
   the bigger cost leak than the direct-ordering tool.)
9. **Payment methods** — what customers actually use; cash-on-pickup/delivery avoids
   processor fees entirely.

## What "tomorrow" produces (the agreed win = a clear plan)

- This roadmap, walked through with the advisors.
- The shared account live, everyone oriented.
- Phase 1 **kicked off live** (comprehension) as the demo — and ideally the starter
  spec extended into the full menu model.
- The five cousin-questions sent.

The app is **not** expected to be done tomorrow; the win is a grounded, exciting plan
the four of you can execute together — and a real taste of Qontinui working on a real
site.

## Appendix A — Message to Farid (German, ready to send)

> Hallo Farid,
>
> wir möchten für dein Restaurant eine eigene App fürs Handy bauen – sie zeigt deine
> Speisekarte schön übersichtlich. Zum Bestellen öffnet die App einfach deine
> bestehende Bestellseite (portofino-essen.de) – da müssen wir nichts ändern. Dafür
> hätten wir ein paar Fragen an dich:
>
> **Zur App:**
> 1. Welche genaue Adresse, Telefonnummer und E-Mail-Adresse sollen in der App stehen?
> 2. Hast du ein Logo, Markenfarben und vielleicht Fotos von den Gerichten, die wir
>    verwenden dürfen?
> 3. Soll die App nur auf Deutsch sein oder auch auf Englisch?
> 4. Hast du schon ein Apple-Developer- und/oder Google-Play-Konto? (Das brauchen wir,
>    um die App in die App-Stores zu stellen.)
>
> **Zu den Kosten (damit wir sehen, ob die App dir später sogar Geld sparen kann):**
> 5. Was zahlst du aktuell für die Online-Bestellungen – eine feste monatliche Gebühr,
>    eine einmalige Gebühr, oder einen Prozentsatz pro Bestellung? Du hattest ~15–20 %
>    erwähnt – an wen genau, und für welche Bestellungen (nur über die Website oder
>    alle)?
> 6. Wie viele Online-Bestellungen hast du ungefähr pro Monat, und wie hoch ist der
>    durchschnittliche Bestellwert?
> 7. Bist du auch bei Lieferando / Uber Eats gelistet, und was berechnen die dir?
> 8. Wie bezahlen deine Gäste meistens – bar bei Abholung/Lieferung oder per Karte
>    online?
>
> Vielen Dank dir! Mit diesen Infos können wir die App passend bauen und schauen, ob
> wir dir langfristig Kosten sparen können.

## Appendix B — Advisor orientation (15 minutes, for tomorrow)

Audience: you + 3 business advisors on the shared account. They're business people,
not engineers — so keep it about *what they see* and *where they add value*, not
internals.

| Time | Segment | What to say / do |
|---|---|---|
| 0:00–2:00 | **What Qontinui is** | One line: "AI agents that build and run real software, coordinated so many can work at once." The coordination layer is the actual product; today we use it to build a real app for Farid. |
| 2:00–5:00 | **Tour the runner** | Show the Terminal page and the dashboard. Point out: agents working in visible terminal windows, the live status. Don't explain plumbing — just "this is the product doing work, and you can watch it." |
| 5:00–8:00 | **Live demo (the wow)** | Point Qontinui at `portofino-essen.de` and let it **comprehend the site** → produce the structured menu/info model (extends the starter spec). Narrate: "it's reading a real website and turning it into a model we can build from." |
| 8:00–11:00 | **The plan** | Walk the MVP (Menu + Brand + Info + webview Order hand-off) and the **core-vs-glue** table — what advances Qontinui vs. what we just build. Show the Decision fork (the 15–20% commission) as the strategic question. |
| 11:00–13:00 | **Where advisors add value** | Phase 2 design (what matters to pizzeria customers), branding/photos sourcing, sending Farid the Appendix-A questions, and the **build-vs-buy** call on the custom checkout once Farid's numbers come back. |
| 13:00–15:00 | **Today's actions** | Send Farid the questions; lock the MVP scope together; kick off the comprehension run; agree who chases branding and the app-store accounts. |

**One-line framing for the advisors:** *the app's business value is a direct-order
and retention channel that can pull orders off high-commission marketplaces — and,
if the numbers justify it, eventually carry its own low-fee checkout to save Farid the
15–20%.*
