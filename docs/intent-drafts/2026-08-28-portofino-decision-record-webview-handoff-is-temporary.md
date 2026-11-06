---
decision: The MVP hands ordering off to Delivery Way in a webview — a stepping stone, not the ordering architecture.
status: superseded
decided_on: 2026-06-13
supersedes:
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**
>
> ## 🚫 SUPERSEDED 2026-08-28 by `decision_record/build-the-permanent-thing`
>
> **Do not implement anything below.** The webview hand-off is not being built.
>
> This record is kept, not deleted, because the successor's reasoning only
> makes sense against it. Its rationale was cost avoidance — *"near-zero
> backend and no payment integration"* — and it was voided twice over: an AWS
> backend now exists, and the hand-off was found to *block* the marketing
> effort that is the only route to the Lieferando volume, rather than merely
> postponing it.
>
> What remains useful here: the quantified reopening condition, and the record
> of why a hand-off looked right in June. If direct ordering is ever abandoned,
> this is the shape it would return in — as a permanent architecture with the
> commission accepted, not as a stepping stone.

# The webview hand-off is temporary

## Context

Ordering, cart and payments already exist on `portofino-essen.de`, provided by
Delivery Way. Rebuilding them is the expensive part of this product: a real
backend, a payment integration, PCI exposure, refunds, failed-payment handling,
and a support burden the pizzeria is not staffed for.

The MVP therefore ships the *ownable* half — a fast native menu, brand, hours,
allergens, tap-to-call, directions — and sends the actual order into Delivery
Way in an in-app webview. Near-zero backend. No payment integration. Weeks, not
quarters.

## Decision

**Ship the webview hand-off, and treat it as a stepping stone.**

The MVP is judged on whether it gets a good menu experience into diners' hands
quickly, not on whether it changes the economics — because it does not. An
order placed through the webview pays Delivery Way's 14% exactly as before.

## Consequences

- **The MVP moves no commission.** This is the whole reason the decision needs
  recording: it is a real, deliberate gap between what the app does and what
  the product is for, and it will look like failure to anyone reading
  `success_metric/commission-paid` during the MVP window. It is not failure. It
  is the plan.
- **Every webview affordance is a small bet against the goal.** Deep-linking
  into it, styling it, caching it, working around its quirks — each makes it
  more load-bearing and more expensive to remove later. Prefer the shallowest
  hand-off that works.
- **No customer identity flows through it.** Whatever the diner types into
  Delivery Way belongs to Delivery Way. Any direct relationship has to be built
  on this side of the boundary.

## What would reopen this

Reopen — that is, build direct ordering and payment — when **the commission
escapable through the app exceeds the cost of escaping it.** Concretely, either:

1. **App-originated order volume gets meaningful.** At current volumes,
   shifting half the Lieferando traffic to a direct channel is roughly
   **€1,100 a month**. A payment integration and a modest ordering backend do
   not cost €1,100 a month to run, so at that point the webview is costing more
   than it saves and should go.
2. **The cost side drops.** A payment provider whose per-transaction fee plus
   build and maintenance is clearly below 14% of the volume routed through it.
   Payment tooling moves quickly; this condition can become true without
   anything about Portofino changing.

**What would NOT reopen it:** the webview being ugly, awkward, or off-brand.
Those are arguments for a better hand-off, not for owning payments — and taking
on payment liability to fix a styling complaint is the expensive mistake this
record exists to prevent.

Equally, a proposal to make the webview *permanent* — to invest in it as the
ordering architecture — is a proposal to abandon `product_intent/vision`. It
may be the right call one day, but it must be argued as a change of product
intent, not slipped in as an improvement.
