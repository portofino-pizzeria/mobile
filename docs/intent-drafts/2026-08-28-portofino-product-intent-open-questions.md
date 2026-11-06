---
subject: Portofino Essen — mobile app and website
last_reviewed: 2026-08-28
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**

# Open questions

Decisions nobody has taken. Listed so a session parks the fork here instead of
resolving it quietly in code, and so the answers arrive as decisions rather
than as things that turned out to be true.

**A question here is UNKNOWN, not "unconstrained".** Nothing below licenses an
assumption in either direction.

---

## 1. ~~Does the replacement website take orders directly, or hand off?~~ CLOSED

**ANSWERED 2026-08-28: directly.** See
`decision_record/build-the-permanent-thing` (accepted). The webview hand-off is
not being built; `decision_record/webview-handoff-is-temporary` is superseded.

Kept here rather than deleted so a reader who remembers the question finds the
answer instead of an absence. The original text follows.

<details>

**The biggest one, and the one that decides whether the strategy works.**

Our website replaces `portofino-essen.de`. The existing site's ordering is
Delivery Way's, at 14%. So at cutover either:

- **the new site takes orders itself** — the 14% ends, a direct channel exists,
  and we own payments, refunds and failed-transaction handling; or
- **the new site hands off to Delivery Way**, as the app's MVP does — cheap and
  safe, and it *inherits* the 14% onto a site we now control.

Both are defensible and they are different products.
`decision_record/webview-handoff-is-temporary` records why hand-off was right
for the app MVP, and its reopening condition is quantified — but it was written
about the app, before the website replacement was in scope. **It does not
decide this.**

Worth weighing: the own-site channel is only ~€280/month of commission, so
taking it directly is not where the money is. The money is the €2,200 on
Lieferando. But the own site is where a direct ordering capability can be built
and proven at low volume, with the owner's real customers, before anything
depends on it.

</details>

## 7. Who runs the marketing, and on what budget? — NEW, and now the biggest

Promoted to the top in substance even though it is numbered last, because it
is now the question the money depends on.

The decision to build direct ordering is made. But ~€280/month is the ceiling
on what the own-site channel can save; **everything above that arrives through
marketing** — telling Lieferando customers to order somewhere else. That is the
operator's own stated reason for skipping the MVP, and it is correct.

The problem is that `audience_profile/owner-operator` says, under *what stops
them today*, that the owner **cannot run a marketing channel**: it is work
nobody has hours for. So the plan's entire upside is currently gated on a
campaign with **no owner, no budget and no channel named.**

Unanswered, and each is cheap to answer now and expensive to discover late:

- **Who does it** — the owner, the advisor group, or somebody paid?
- **Through what channel** — the box the food arrives in, a flyer with every
  Lieferando order, the counter, the existing site, local social?
- **With what incentive, if any** — a direct-order discount is the obvious
  lever and it spends the very margin the strategy is recovering. Whether that
  trade is worth making is a business call nobody has taken.
- **Starting when, relative to go-live** — a campaign with lead time that
  begins after launch wastes the launch.

Note what this question is *not*: a reason to reconsider building the end
product. The sequencing holds either way. It is the reason a correctly-built
product might earn nothing.

## 2. What is the target for `commission-paid`?

`success_metric/commission-paid` ships with `target: null`. It encodes how much
order volume the owner is willing to risk to move margin — a business
judgement, and theirs.

Note the constraint recorded with the metric: this number cannot reach zero
without leaving Lieferando entirely, which costs most of the ~€10,000/month it
carries. A sensible target is a *share shifted*, not an amount eliminated.

## 3. Which platforms, and what is the budget?

iOS, Android, or both. Whether the website is responsive-first with the app
following, or the reverse. And what may be spent — on build, and on the
per-month running cost of anything we own.

`product_intent/non-goals` marks these UNKNOWN. They bound almost every
technical decision below them, so an early answer is worth more than a good
one.

## 4. When does cutover happen, relative to the menu being complete?

The harvested menu is **missing three of fourteen categories** (Hähnchenbrust,
Rumpsteak, Dessert — JS-rendered by the Delivery Way SPA and never captured).

Cutting over before they are captured makes an *incomplete* menu authoritative,
and silently transfers the job of typing the gap in to the owner. Either
finish the harvest first, or decide deliberately that the owner enters those
three categories as their first act — but it should be a decision, not a
discovery.

## 5. What happens to the existing site's SEO and links?

`portofino-essen.de` is what customers, Google and printed material point at.
Replacing it touches whatever ranking and inbound traffic exists today.
Nothing about this has been examined, and for a local business found by search
it could matter more than any feature in the app.

## 6. Who is on the hook when the site is down at 19:30 on a Saturday?

Today, ordering being up is Delivery Way's problem. If our site owns ordering,
it becomes ours — during exactly the hours nobody is at a keyboard, for a
business that cannot recover a lost Saturday.

This is not a technical question. It is about what the owner is being asked to
depend on, and it should be answered before they depend on it rather than
after.
