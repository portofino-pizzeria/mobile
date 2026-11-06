---
subject: Portofino Essen — mobile app
last_reviewed: 2026-08-28
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**

# Non-goals

What this app will not be, and why. Read it to **rule a candidate out**.

## 1. Not a delivery platform, and not a Lieferando competitor

This is one restaurant's app. Multi-restaurant listings, courier dispatch,
rider tracking and marketplace mechanics are a different business with a
different cost base.

Note the deliberate asymmetry: the strategy takes *orders* off Lieferando while
leaving it in place as a discovery channel for people who have never heard of
Portofino. That is not competing with it — it is declining to pay it for
customers it did not find.

## 2. Not a point-of-sale or kitchen system

No till, no shift management, no inventory, no kitchen display. The pizzeria
already runs; this app is not where it gets re-tooled, and anything requiring
staff attention during service will not be used
(`audience_profile/owner-operator`).

## 3. Not a discovery or browsing experience

The diner has already chosen the restaurant — that is why they opened a
single-restaurant app. Search, filters, recommendations, cross-sell and
"popular near you" solve a problem this audience does not have and add steps
to a flow whose whole job is to be fast.

## 4. Not accounts for their own sake

An account is worth precisely what it removes — saved address, saved payment,
one-tap reorder. Until it delivers those, asking for one is a cost at the exact
moment the diner is deciding whether to bother, and the MVP cannot deliver them
because payment lives with Delivery Way.

## 5. Not English-first

German is the working language of the business and the customer base is local.
English is an addition and is welcome; it is never the default, and no flow
should read as translated-from-English.

## 6. Not a permanent webview wrapper

Shipping the hand-off is right; *settling* on it is not. Investing in the
webview as the ordering architecture abandons the point of the product. That is
a change of intent and must be argued as one —
`decision_record/webview-handoff-is-temporary` records what would legitimately
reopen it.

## 7. Not a loyalty or gamification product, yet

"Not yet" rather than "never" — owning the customer relationship is a real
ambition. But nothing observed suggests points or badges would move this
audience, and the owner has no hours to run a scheme. If it returns, it returns
as a tested hypothesis, not as a feature.

---

## Boundaries not yet stated

The `non-goals` kind also expects hard constraints — **budget, supported
platforms (iOS/Android/both), licensing, and offline requirements**. None has
been stated by the owner or the build team.

These are **UNKNOWN, not "unconstrained".** Do not conclude from this document
that the project has no budget ceiling or no platform decision — only that this
document does not know one. A candidate turning on such a constraint should ask
rather than assume; `product_intent/open-questions` is where the question
belongs.
