# Portofino backend — the payment result pages lead back to the diner's order, in German (2026-09-13)

> **Status: SHIPPED 2026-09-25** (Phases 1 and 2; optional Phase 3 DEFERRED until a native build reaches diners) — Phase 1 is MERGED AND LIVE
> ([backend#16](https://github.com/portofino-pizzeria/backend/pull/16),
> `ba1ea2d2`, observed on production 2026-09-25).
> `mobile#38` stamped "Phases 1 and 2 are MERGED AND LIVE", but Phase 2 has no
> code to merge and had never been run. **Phase 2 is now COMPLETE** (2026-09-25):
> one run passed steps 1–4 and was blocked at step 5, because the app's UI
> Bridge has no web transport; a second run reached step 5 through a disclosed
> scratch-only shim and `order.getOrderStatus` answered `shown` / `paid`; a
> third run reached it through the app's own dev-only web transport, with no
> shim (the follow-up to `mobile#40`). Phase 3 is DEFERRED until a native build
> reaches diners: none does today (below). The page's off-palette colours
> are fixed by [backend#30](https://github.com/portofino-pizzeria/backend/pull/30),
> which is merged and live (`db4223d`, observed 2026-09-25). A plan's own
> status line is not evidence of anything. See "Progress".
>
> Written from coord finding
> `7be3c0e5-a68b-4992-a64b-5fa87f50996b` (topic `portofino-checkout`), which the
> post-merge follow-up to `mobile#17` recorded instead of fixing, because the
> change is in another repo. That follow-up landed as
> [mobile#18](https://github.com/portofino-pizzeria/mobile/pull/18) (`c25c2d4`).
>
> **Repos:**
> - `portofino-pizzeria/backend` leads (Phase 1).
> - `.../mobile` is touched only in Phase 3, which is optional.
>
> **Why this file is in `mobile/plans`:** Portofino is its own tenant, and the
> operator moved its plans out of `qontinui-dev-notes/plans` for that reason
> (`c97dfc70`). The plan scanner cannot express tenancy, so a plan filed there
> is attributed to the wrong tenant. No coord work unit was created for this
> plan, because the authoring session's coord identity is the qontinui tenant.

## The defect

After a hosted checkout, the diner lands on a page the backend renders:
- `resultPage()` in `src/routes/payments.ts:17-48`;
- served by `GET /checkout/mock`, `/checkout/return` and `/checkout/cancel`.

What is wrong with that page, measured against backend `origin/master` `577f215`:

1. **Its only way back leads to the menu, not to the order.**
   - It renders `<a href="${config.publicWebUrl}">Return to Portofino</a>`.
   - In production `PUBLIC_WEB_URL` is `https://portofino-essen.com` (`infra/locals.tf:17`, wired in `infra/backend-service.tf:131`), which is the menu.
   - With `PUBLIC_WEB_URL` empty, the page says "You can close this window and return to the app."
2. **It is English on a German guest surface:** `<html lang="en">`, "Payment complete", "Checkout cancelled".
3. **`/checkout/cancel` ignores the `order_id`** that Stripe's `cancel_url` carries (`src/payments/stripe.ts:48`), so that page could not link to the order even if it wanted to.
4. **No test reaches any `/checkout/*` route.** `test/` covers admin, health, kitchen auth, menu and orders.

**Why it matters more since `mobile#18`.** The web checkout now opens inside the diner's tap. When no window can open (popups off), or the diner closes the blank one, the diner pays **in the same tab**. On that path this page *is* the app's tab:
- "Return to Portofino" drops the diner on the menu;
- the order they just paid for, and its "Zahlung erhalten" / "In Zubereitung" status, is lost unless they find the browser's Back button. `#18` rewrote that history entry to `/order/<id>`.

**It is what every production diner sees today.** Measured 2026-09-13:
- `api.portofino-essen.com/api/health` answers `"commit":"577f215…","stripe":"mock"`.
- `/api/payments/providers` answers `{"stripe":false,…,"mockFallback":true}`.

So every production checkout currently ends on `/checkout/mock`.

## Goals

- **G1:** every result page links to the order it concerns, whenever it can do so safely.
- **G2:** German copy in the app's *du* voice, `lang="de"`. Wording is shared with the app's order screen wherever the two say the same thing.
- **G3:** no reflected input. The order id is validated and encoded before it reaches the HTML. Today nothing from the query string is echoed; G1 must not change that.
- **G4:** the first route tests for `/checkout/*`. Each is shown red against current `master` before it goes green.

## Non-goals (recorded elsewhere, deliberately not here)

- **Paying an abandoned order again** from the order screen: finding `db61889b`. It is the other half of the cancel page (see "Coupling" below).
- **The unauthenticated order read** that returns the diner's name, phone and address: finding `bd868d61`.
- **No idempotency key on `POST /api/orders`:** finding `913c25df`.
- **A `GET` that marks an order paid.** `GET /checkout/mock?order_id=X` calls `markOrderPaid(X, 'mock', …)`, and in production the mock provider is the live one. So anyone holding an order id can mark that order paid by visiting a URL, and the kitchen then cooks it.
  - That is the designed test mode (the checkout says "läuft im Testmodus"). It must be closed before real payments go live.
  - It is out of scope here. Record it as its own finding when this plan is vetted, and do not fix it silently in Phase 1.

## Phase 1 — German result pages that link to the order (backend, one PR)

**Files:**
- `src/routes/payments.ts`
- `src/config.ts` (comment only)
- `README.md`
- `test/payments.test.ts` (new)
- `test/support/config.ts`

### 1.1 The link

Add a helper beside `resultPage()`:

```ts
/** The order ids the API issues: `randomUUID()` in order-service. */
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where "Zu deiner Bestellung" points, or null when there is no safe answer. */
function orderLink(orderId: string | undefined): string | null {
  const base = config.publicWebUrl.replace(/\/+$/, '');
  if (!base || !orderId || !ORDER_ID.test(orderId)) return null;
  return `${base}/order/${encodeURIComponent(orderId)}`;
}
```

- **The id shape is verified.** `createOrder` issues `randomUUID()` (`src/lib/order-service.ts:130` on `577f215`). If that ever changes, match whatever the service issues, and never loosen the pattern to "anything".
- **Why validate rather than only encode:** the id comes from the query string, so this is attacker-controlled text going into an HTML attribute. Encoding keeps it from breaking out of the `href`. The pattern keeps a well-formed but fake value from becoming a confident-looking link.
- **`/order/<id>` cold-loads on the web host.** CloudFront rewrites 403 and 404 to `/index.html` with 200 (`infra/web.tf:81-84`), which is the same mechanism every shared order link already relies on.

### 1.2 The page

`resultPage({ emoji, title, sub, orderId })`:
- `<html lang="de">`, and a German `<title>`.
- Every interpolated value goes through a small `escapeHtml()`. The copy is constant today, but the helper costs one line and makes a future dynamic string safe by default.
- **With a link:**
  - a primary button, **"Zu deiner Bestellung"**, pointing at `orderLink(orderId)`;
  - under it: **"Du kannst dieses Fenster auch schließen – deine Bestellung aktualisiert sich von selbst."**

  That hint is true for the web popup and for the native in-app browser: the app's order screen keeps polling. On the same-tab path the button is the way back.
- **Without a link** (`PUBLIC_WEB_URL` empty, or no valid id): only the hint, **"Du kannst dieses Fenster jetzt schließen."** Never an English fallback.

### 1.3 The copy

| Page | Title | Text |
|---|---|---|
| `/checkout/mock` | Testzahlung abgeschlossen | Es wurde kein Geld bewegt. Deine Bestellung ist bestätigt und geht in die Küche. |
| `/checkout/return`, paid | Zahlung erhalten | Deine Bestellung ist bestätigt und geht in die Küche. |
| `/checkout/return`, not yet confirmed | Zahlung wird bestätigt | Wir bestätigen gerade deine Zahlung. Deine Bestellung aktualisiert sich von selbst. |
| `/checkout/cancel` | Bezahlung abgebrochen | Es wurde nichts abgebucht. Deine Bestellung ist angelegt, aber noch nicht bezahlt, und wird erst nach der Bezahlung zubereitet. |

- "Zahlung erhalten" and "Deine Bestellung ist bestätigt und geht in die Küche." are the order screen's own words for `paid` (`mobile/src/app/order/[id].tsx`, `STATUS_COPY`). Keep them identical, so the page and the screen the diner lands on agree.
- The cancel text deliberately promises no retry. See "Coupling".

### 1.4 The routes

- **`/checkout/cancel`:** reads `order_id` from the query (`Querystring: { order_id?: string }`) and passes it on. A missing or malformed id renders the page without a link. Cancel stays a page that never fails.
- **`/checkout/mock` and `/checkout/return`:** pass the `order_id` they already read. Their `400` for a missing parameter is unchanged. A browser shows that 400 as JSON, which is pre-existing and not worth widening this PR for.
- **`config.ts` and `README.md`:** `PUBLIC_WEB_URL` becomes "the base of the order link on the payment result pages" rather than "back to app target".

### 1.5 Tests: `test/payments.test.ts`

These go through `app.inject()` against the real app and a real Postgres, as the rest of the suite does (`TESTING.md`).
- **Patching config:** extend `withConfig` in `test/support/config.ts` so it can patch and restore `publicWebUrl`. Rename `MutableCredentials` to `MutableConfig` if the name no longer fits.
- **Seeding:** place a real order through `POST /api/orders` using the existing fixtures (`seedCategory`, `seedItem`, `VALID_CUSTOMER`). Do not insert a row by hand.

| # | Request | Expect |
|---|---|---|
| 1 | `GET /checkout/mock?order_id=<id>`, `publicWebUrl` = `https://web.example` | 200 `text/html`; `lang="de"`; "Testzahlung abgeschlossen"; `href="https://web.example/order/<id>"`; the order now reads `paid` (existing behaviour, newly covered) |
| 2 | same, `publicWebUrl` = `''` | no `<a`; "Du kannst dieses Fenster jetzt schließen." |
| 3 | same, `publicWebUrl` = `https://web.example/` | exactly one slash before `order` |
| 4 | `GET /checkout/cancel?order_id=<id>` | 200; "Bezahlung abgebrochen"; link to `/order/<id>`; the order still reads `pending_payment` |
| 5 | `GET /checkout/cancel` (no id) | 200, no link |
| 6 | `GET /checkout/cancel?order_id=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E` | 200; the body contains neither `<script>` nor the raw value; no link (G3) |
| 7 | `GET /checkout/return?order_id=<id>&session_id=x` (Stripe disabled under test) | "Zahlung wird bestätigt"; link to the order; the order still `pending_payment` |

**Red first.** Run tests 1, 2, 4 and 6 against current `master` and record them failing (English copy, missing link, no cancel id). A test that was never red proves nothing about the change.

### Verification

1. `npm run typecheck` and `npm test` both exit 0, locally (`npm run db:up`) and in CI (`.github/workflows/ci.yml`).
2. **Landed ≠ live.** The backend deploy waits at a required reviewer gate (see `2026-09-10-automatic-deployment.md`). After it is approved:
   - `https://api.portofino-essen.com/api/health` reports the merge commit as `commit`.
   - `curl https://api.portofino-essen.com/checkout/cancel?order_id=<any uuid>` returns the German page, linking to `https://portofino-essen.com/order/<that uuid>`.
   - Verify with **`/checkout/cancel`, never `/checkout/mock`**: the mock route marks the order paid, and on production that means the kitchen cooks it.

## Phase 2 — the web round trip, verified once (no code)

This proves `mobile#18` and Phase 1 together, on a **local** stack: backend `npm run dev`, web `npx expo start --web` or an export. **Never on production**, where a placed mock order is a paid order the kitchen will cook. Drive it through the UI Bridge (a headless browser tab with popups blocked):
- place an order;
- the checkout pays in the same tab and lands on `/checkout/mock`;
- follow **"Zu deiner Bestellung"**;
- `order.getOrderStatus` reports `state: "shown"` with `status: "paid"`.

Record the exact steps and results in this file.

## Phase 3 — the native return path (optional; needs a decision and a device)

**The problem.** On iOS and Android the result page opens in the in-app browser (`WebBrowser.openBrowserAsync`). There, Phase 1's link opens the **web** app inside that browser, not the native app. The hint to close the window stays true: the native order screen polls behind it. So Phase 1 is correct on native, only not ideal.

**The fuller fix spans both repos:**
- The app sends `returnTo: 'app'` with `POST /api/payments/checkout`.
- The backend threads it into the mock, success and cancel URLs. The page's button then points at the app's scheme, `portofino-pizzeria://order/<id>` (`mobile/app.json` `scheme`).
- Native opens the checkout with `WebBrowser.openAuthSessionAsync(url, 'portofino-pizzeria://order/<id>')`, so the browser closes itself on that redirect.

**Decision needed before starting.** Is the extra round trip worth it for native diners, who can already close the browser? It cannot be verified without a device. Until someone decides it is worth doing, Phase 3 stays unstarted.

**Deferred 2026-09-25, until a native build reaches diners.** Distribution was decided as a native app under the owner's store accounts (`2026-06-13-portofino-functional-spec-starter.md`), but nothing ships one yet: the repo has no `eas.json` and no store build is recorded. Every diner today pays on the web, where Phases 1 and 2 are the whole path. Phase 3 would improve a return path no diner can take, and it could not be verified without a device. **Triggering event:** the first native build distributed to diners. At that point, decide the question above, with a device in hand.

## Coupling and risks

- **Cancel and `db61889b`.**
  - Today the cancel page's link leads to an order screen that says "Warten auf Zahlung" and offers no way to pay. The cart was emptied before the checkout opened, on the same-tab path in `#18`.
  - That is why the cancel copy above promises nothing about retrying.
  - When the "Jetzt bezahlen" button from `db61889b` lands, update the cancel text to point at it.
- **`backend#9` is open** and edits `test/support/fixtures.ts`, which Phase 1's tests import. Whichever lands second rebases; the conflict, if any, is confined to fixtures.
- **The reviewer gate** means the merge and the live change are separate events. Report each one only once it has been observed.

## Related

- Coord finding `7be3c0e5` is the source of this plan. Mark it resolved, citing the PR, when Phase 1 is live.
- Plan-library report `98fca4eb` (post-merge review of `mobile#17`) lists this item under "Recorded, not fixed here".
- `qontinui-dev-notes/plans/2026-09-13-portofino-order-screen-transient-error-and-payment-browser-reason.md` needs follow-up of its own:
  - its Defects 1 and 2 were delivered by `mobile#18`;
  - it is still marked PROPOSED;
  - it sits in the qontinui corpus, the tenancy problem described at the top of this file.

  Its author, or the operator, should mark it and move it.

## Progress

### Phase 1 — merged 2026-09-14 as `ba1ea2d2`, live (observed 2026-09-25)

[backend#16](https://github.com/portofino-pizzeria/backend/pull/16), branch `feat/payment-result-pages-link-to-order`.

- **Implemented as written**, with one deviation. The plan named `README.md`, but README never mentions `PUBLIC_WEB_URL`. The comment was updated in `.env.example`, where the variable is documented, and in `src/config.ts`.
- **Red first:** all 7 tests in the table were run against unchanged `master` `577f215`, and all 7 failed (English copy, no link). Green after the change: `npm run typecheck` is clean and `npm test` passes 140/140.
  - Two tests were added beyond the table: the missing-parameter 400s, and near-miss ids (UUID plus `x`, plus a newline, with a prefix).
- **Independent review:** a fresh-context code-reviewer, given the diff only, reported the change clean.
- **The GET-marks-paid non-goal is now recorded** as coord finding `0c586160`. It is worse than the plan says: `/checkout/mock` stays registered even when Stripe is enabled, so once real payments are live it would be a free way to skip paying.
- **Correction to "Verification" step 2:** the backend deploy no longer waits at a required reviewer gate. `72c56e9` on backend `master` ("remove the human approval gate on production deploys") removed it. So merge and live are still separate events, but no approval sits between them.
- **Observed live 2026-09-25**, which closes the "still owed" step this line
  used to carry. `GET https://api.portofino-essen.com/api/health` reports
  `commit: 0ebab8e8f962deb8babdd5ebceef82c3fa65a9fb`, which is backend
  `origin/master`'s head — so the deployed backend is current main, not merely
  past the merge. `GET /checkout/cancel?order_id=<a well-formed uuid>` returns
  `200 text/html` carrying `lang="de"`, "Bezahlung abgebrochen" and
  "Zu deiner Bestellung". Phase 1 is delivered.
- **Finding `7be3c0e5` is NOT resolved, and no session bound to the qontinui
  tenant can resolve it.** It belongs to the `pizzeria` tenant and coord lifts
  the tenant from the caller's own JWT, so the write is unreachable from here;
  the only pizzeria credential on the authoring box expired on 2026-07-17. It
  needs a session holding a pizzeria-bound credential — the operator mints a
  pair code, as `docs/intent-drafts/README.md` describes.
- **What the live page still gets wrong, and where it is fixed.** Its colours
  are `#faf7f2`, `#1c1917` and `#78716c`, none of them in the tenant's palette,
  and it declares `color-scheme: light dark` while the design is light-only.
  Confirmed on the live response above, not inferred from source. That is
  [backend#30](https://github.com/portofino-pizzeria/backend/pull/30), "fix(payments):
  the result page renders the declared brand, and is light-only" (opened
  2026-09-25 by the post-merge follow-up to `mobile#38`: until then the PR
  named here did not exist). It is a separate defect from this plan's, on the
  same page. **Merged and live 2026-09-25:** `/api/health` reports
  `commit: db4223ddc999a09c7bdb02e0fd23e98708be4556`, backend#30's merge commit.
  `GET /checkout/cancel?order_id=<a well-formed uuid>` now serves
  `color-scheme: light;` and `#d4a574`, and no longer serves `#faf7f2` or a
  `prefers-color-scheme` block.

### Phase 2 — run 2026-09-25: steps 1–4 PASS, step 5 BLOCKED (no UI Bridge on web)

Run locally only. No request went to either portofino-essen.com host.

**Setup.**
- Backend: branch of [backend#30](https://github.com/portofino-pizzeria/backend/pull/30) (`db4223d` on `0ebab8e`), served on `:4000`. It used a separate database, `portofino_phase2` (migrated and seeded; 15 categories, 136 items), with Stripe keys empty, so `/api/payments/providers` reported `{"stripe":false,"paypal":false,"mockFallback":true}`. `PUBLIC_WEB_URL=http://localhost:8081`.
- Web: `EXPO_PUBLIC_API_URL=http://localhost:4000 npx expo start --web --port 8081`.
- Browser: headless Chromium driven through the injected UI Bridge (`@qontinui/ui-bridge-wrapper` 0.7.2). Playwright always passes `--disable-popup-blocking`, so an init script made `window.open` return `null`, which is what a blocked popup returns.
- The run was at 09:24 on a Friday, before the shop opens, so Friday's opening time was moved to 08:00 in `portofino_phase2` only.

| # | Step | Result |
|---|---|---|
| 1 | Place an order (Pizza Margherita groß, Abholung) and tap pay | PASS. Order `21549c18-91c2-414c-8846-a230e13d006e` |
| 2 | The checkout pays in the same tab | PASS. No new page opened, and the tab went to `localhost:4000/checkout/mock?order_id=21549c18-…` |
| 3 | German result page | PASS. It showed "Testzahlung abgeschlossen", "Es wurde kein Geld bewegt. …" and "Zu deiner Bestellung", with the link `http://localhost:8081/order/21549c18-…`. The button read `#1a1a1a` on `#d4a574` with `colorScheme: light`, which is backend#30's palette |
| 4 | Follow "Zu deiner Bestellung" | PASS. It landed on `/order/21549c18-…`, and the screen reads "Zahlung erhalten … Deine Bestellung ist bestätigt und geht in die Küche." |
| 5 | `order.getOrderStatus` reports `state: "shown"`, `status: "paid"` | **BLOCKED** |

**Why step 5 is blocked.** `src/app/_layout.tsx` gives the app's UI Bridge server a transport only on native (`__DEV__ && Platform.OS !== 'web' ? createTcpServerAdapter() : undefined`). On web the console logs `[ui-bridge-native] HTTP server not available: no serverAdapter prop provided`, and `@qontinui/ui-bridge-native` 0.6.11 declares no web-capable server transport. The injected Bridge has a registry of its own, so it cannot see the app's registered components. Its answer, verbatim: `{"success":false,"error":"Component \"order\" not found. Available components: []. …"}`. The only way to observe the same-tab path is on web, and the only way to reach the app's actions is on native.

The API agrees: `GET :4000/api/orders/21549c18-…` returned `"status":"paid"`, provider `mock`. That is supporting evidence, not the UI check this phase asks for, so **Phase 2 stays open on step 5**. Closing it needs a web transport for the app's UI Bridge. That is a change to the ui-bridge library, not to this plan's repos. Re-run step 5 once one ships. *(Superseded by the next section: step 5 was reached, and the fix is app-side.)*

### Phase 2, step 5 — observed 2026-09-25 through a scratch-only shim: PASS

This is a second, independent local run, made by the post-merge follow-up to
backend#30. It is the only run that reached the app's own UI Bridge action.

**Setup.**
- backend `db4223d`, with its own throwaway database `portofino_phase2_test`. It was migrated, seeded, and dropped afterwards.
- mobile `9c4331e`, built with `npx expo export -p web --clear`.
- A static server that mirrors `infra/web.tf`'s fallback to `/index.html`.
- Headless Chromium, with `window.open` returning `null`.

The shop's Friday hours were widened in the throwaway database only.

**The shim, in a scratch clone and never committed.** A different `package.json` `main` entry ran before `expo-router/entry`. It exposed `@qontinui/ui-bridge-native`'s own `createNativeServer(getGlobalRegistry(), createNativeActionExecutor(registry)).handleRequest` as a `window` function. That is the same request handler the native TCP adapter routes to, so every `/ui-bridge/control/*` route answered in-page against the app's real registry. No app source was changed.

| Step | Observed |
|---|---|
| `menu.getMenuStatus` | `{"source":"live","categoryCount":15,"itemCount":136,"unresolvedAllergenCodes":[]}` |
| `menu.addToCart`, then `go-to-cart`, `cart.checkout`, pickup, name, phone | each `success:true` |
| Tap "Mit Karte bezahlen (Stripe)" | The same tab went `/checkout` → `/order/2ec9c4e2-…` (the `#18` history rewrite) → `:18080/checkout/mock?order_id=2ec9c4e2-543d-4331-b835-cb14e72066fa`, with 0 popups |
| Result page | `lang="de"`, "Testzahlung abgeschlossen", and "Zu deiner Bestellung" → `http://127.0.0.1:18081/order/2ec9c4e2-…`. Computed `.btn` background `rgb(212, 165, 116)` with an ink label, and `color-scheme: light` |
| Follow the link | The page cold-loaded through the fallback to `/index.html` |
| **`order.getOrderStatus`** | **`{"state":"shown","error":null,"refreshError":null,"orderId":"2ec9c4e2-543d-4331-b835-cb14e72066fa","status":"paid","fulfilment":"pickup",…}`** |

**What this changes.** Step 5's check is met, so Phase 2 is complete, with the shim disclosed as the one deviation. The run above says the web gap needs a `ui-bridge-native` library change. It does not: the library already ships a transport-free request handler. What is missing is an app-side web adapter in `src/app/_layout.tsx` that routes to that handler. It should be dev-only, never in a production export, because it would hand page scripts the app's actions.

That adapter is not built here. Its only consumer is verification tooling, and exposing a control surface on the web build is a security-surface decision. **Recommendation:** add it gated on `__DEV__`, so `expo start --web` is drivable and `expo export` is not. *(Built by the follow-up to `mobile#40`, as recommended; see the next section.)*

**One trap for anyone repeating the run.** The first export inlined `http://localhost:4000`, the fallback in `src/lib/config.ts`, even though `EXPO_PUBLIC_API_URL` was set. This was stale Metro transform-cache output. Export with `--clear`, and grep the bundle for the API URL before trusting a run.

### Phase 2, step 5 — re-run 2026-09-25 through the app's own web transport: PASS, no shim

The follow-up to `mobile#40` built the adapter the section above recommends. `src/lib/ui-bridge-web-adapter.ts` publishes the UI Bridge server's request handler on `window.__uiBridgeNative`, and `src/app/_layout.tsx` wires it on web, in `__DEV__` only. Every mention of that name sits inside `if (__DEV__)`, so a production export carries none of it. `scripts/check-web-export-has-no-control-surface.sh` proves that after every web export in CI, and after the deploy's export. Proven both ways locally: green on `npx expo export --platform web`, and red on the same export with `--dev`.

**Setup.** Run locally only; no request went to either portofino-essen.com host.
- Backend: `origin/master` `94f6731`, on `:18080`, against a throwaway database, `portofino_followup40`. It was migrated and seeded, then dropped afterwards. Stripe was unset, so providers read `{"stripe":false,"paypal":false,"mockFallback":true}`. `PUBLIC_WEB_URL=http://localhost:18081`.
- Web: this branch, `EXPO_PUBLIC_API_URL=http://localhost:18080 npx expo start --web --port 18081 --clear`.
- Headless Chromium, with `window.open` returning `null`. Every step went through `window.__uiBridgeNative.handleRequest` except the pay tap.

| Step | Observed |
|---|---|
| `menu.getMenuStatus` | `{"source":"live","categoryCount":15,"itemCount":136,…}` |
| `menu.addToCart` (`1-pizza-margherita`, `…-gross-28cm`), `go-to-cart`, `cart.checkout`, pickup, name, phone | each `success:true` |
| Tap `pay-stripe` at the centre of the `layout` that `GET /ui-bridge/control/element/pay-stripe` reported | The same tab went `/checkout` → `/order/d2081829-…` → `:18080/checkout/mock?order_id=d2081829-18ee-4745-b549-84e7876dbb05`, with no popup |
| Result page | `lang="de"`, "Testzahlung abgeschlossen", `colorScheme: light`, and one link, "Zu deiner Bestellung", to `http://localhost:18081/order/d2081829-…` |
| Follow the link | `/order/d2081829-…` |
| **`order.getOrderStatus`** | **`{"state":"shown","error":null,"refreshError":null,"orderId":"d2081829-18ee-4745-b549-84e7876dbb05","status":"paid","fulfilment":"pickup",…}`** |

**A trap this run hit, for anyone repeating it:** a Bridge press on `pay-stripe` is not a tap. `pay()` treats it as `viaBridge`, returns the checkout URL, and never leaves the page being driven (`checkout.tsx`, the `tapped` comment). So the same-tab path needs a real click. The first attempt pressed through the Bridge and stopped at `/order/<id>`, which is correct behaviour, not a defect.

