# Portofino mobile — the order screen gives up on one failed poll; a payment browser failure blames the server (2026-09-13)

> **Status: SHIPPED 2026-10-01 — delivered before vetting by portofino-pizzeria/mobile#18
> (`c25c2d4`, merged 2026-09-13T08:43Z), the peer follow-up this plan told readers to
> coordinate with.** Verified during a `/vet-imp` run (session 649522b8) against
> portofino-pizzeria/mobile `origin/main` `c52e40d`: both defects are fixed there (see
> "Delivered by #18" below), so no implementation PR was opened. Defects found in the plan: 1
> (Stale — the whole premise). Auto-fixed: 1. Surfaced for user: 0.
> History: authored `DRAFT — PROPOSED` 2026-09-13 as a deferral from the post-merge follow-up
> to portofino-pizzeria/mobile#16 (landed as #17, `baeee8a`); the peer session in worktree
> `agent-worktrees/01a097f0-…/mobile` landed the same fixes as #18 the same morning.

## Delivered by #18 (verified 2026-10-01)

| Plan fix | Where it is on `origin/main` `c52e40d` |
|---|---|
| D1: keep the last good order on screen when a later poll fails, show a German "may be out of date" line, retry with backoff | `src/app/order/[id].tsx:142-148` (`refreshError`, backoff doubling from the order's own pace up to `MAX_RETRY_MS` = 30 s, `:36`) and the polite live region at `:295-302` |
| D1: full error view only when no order was ever loaded | `src/app/order/[id].tsx:132-141` (`if (!shown)`), with a retry button when retryable (`:212-228`) |
| D1: stop retrying on a 404 | **Delivered differently, and accepted.** A 404 on the FIRST read is a non-retryable error view ("Diese Bestellung wurde nicht gefunden. Bitte prüfe den Link.", `:135-139`, `isRefusal` `:65-67`). Once an order has been shown, every failure — a 404 included — keeps it on screen and backs off (`:142-145`). **Resolved.** Keep #18's behaviour: an order that was read a moment ago and now 404s is far likelier a proxy/routing fault than a deleted order, and a bounded 30 s backoff costs nothing while giving up would freeze a paid order's status (robustness). |
| D2: the payment-browser failure gets its own German reason; the placed-order message is kept | `src/app/checkout.tsx:428-430` (`opening` flag), `:576-578`, `:586-591` ("Der Browser für die Bezahlung ließ sich nicht öffnen.") and `:598-599` ("Die Bestellung ist angelegt, aber noch nicht bezahlt …"). The wording differs from the plan's proposed sentence; the meaning is the same. |

## Defect 1 — one failed poll ends status updates for good

`src/app/order/[id].tsx`, `OrderScreen`'s `poll()`:
- **Symptom:** any rejection from `api.getOrder` calls `setError(...)`. The whole screen is replaced by "Bestellung konnte nicht geladen werden", and no further poll is scheduled.
- **Effect:** one transient network error while the order is `pending_payment` hides an order that exists. Even after payment succeeds, the diner never sees "Zahlung erhalten".

**Fix:**
- Keep the last good `order` on screen when a poll fails after one has succeeded, show a small German "Verbindung unterbrochen, versuche es erneut …" line, and retry with backoff.
- Show the full error view only when no order was ever loaded.
- Stop retrying on a 404 (`ApiError.status === 404`).

## Defect 2 — a payment browser that fails to open is reported as a server failure

`src/app/checkout.tsx`, `pay()`:
- **Symptom:** `WebBrowser.openBrowserAsync` sits in the same `try` as the API calls. When it rejects after the order was created, `errorReason(e)` returns "Keine verwertbare Antwort.", which makes the message say the server gave no usable answer.
- **What actually happened:** the server answered, and the browser did not open.

**Fix:**
- Wrap the browser call and give it its own German reason: "Der Browser für die Bezahlung konnte nicht geöffnet werden."
- Keep the placed-order message ("angelegt, aber noch nicht bezahlt").

## Out of scope, recorded elsewhere

- **Abandoned checkout keeps polling with no way to pay again:** coord finding `db61889b-cb43-4886-a4c8-cd5e96edfb42`.
- **The order read exposes customer PII:** coord memory `e66bacd4-2503-4541-b853-0da307873d03`, finding `bd868d61-c760-46f7-9e19-14a13ee3a936`. This is a security/product call and is not part of this plan.

## Verification

`npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`, and `python scripts/check-assets.py`. There is no unit-test runner in the repo. The UI Bridge `checkout.payWithStripe` action and the order screen cannot be exercised without a device or the emulator. Say so rather than claiming a device check.
