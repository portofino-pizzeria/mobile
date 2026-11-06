---
audience: Portofino's owner-operator — runs the kitchen, not the software
consumer_type: human
size: one, plus whoever is behind the counter during service
last_reviewed: 2026-08-28
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**

# Owner-operator

The person whose economics this product changes, and the person least able to
spend time on it. Both halves matter.

## Who this is

A working restaurateur. During opening hours — Mo and Wed–Fri 12:00–22:00,
Sat–Sun 13:00–22:00, closed Tuesdays — they are cooking, taking calls and
running a counter. Software attention is available before service or after
close, in small amounts, and essentially never between 18:00 and 21:00 when it
would be most needed.

German is the working language; English is welcome but second. They have
already made the key business facts available (commission rates, revenue split,
payment mix), which means the constraint is time, not willingness.

## What they are trying to do

**Keep more of each order without losing orders.**

Both halves are load-bearing. Commission is painful — roughly €2,480 a month —
but it buys demand. Lieferando's 22% is the price of being found by people who
have never heard of Portofino. Trading volume for margin is not a win, and any
proposal that quietly does so has misunderstood the business.

## What stops them today

- **The platform owns the demand.** Walking away from Lieferando means walking
  away from ~€10,000 a month in orders. The commission is not a fee they can
  simply refuse.
- **They cannot run a marketing channel.** Building a direct relationship with
  regulars is the obvious answer and it is work nobody has hours for.
- **Menu changes are rare, and that cuts both ways.** Little maintenance
  burden — but also no habit or tooling for keeping a second copy of the menu
  correct. Any system requiring the menu to be updated in two places will drift
  and be wrong in the customer-facing one.
- **Cash is the norm for pickup.** Payment infrastructure is not somewhere they
  have existing capability or appetite for risk.

## What they DO need — the menu editor (added 2026-08-28)

Once our website replaces the existing one, the owner becomes its **content
maintainer**. This is a second, distinct relationship with the product, and the
demands it makes are unusual enough to state separately.

They will use this editor **a handful of times a year**, in German, with no
training and no memory of the last session, most likely after close. That
combination — rare, untrained, unsupervised, and touching a **safety
surface** — is what makes it hard:

- **It has to be obvious to someone who last used it six months ago.** Anything
  needing relearning gets used wrong or avoided, and avoided means the menu
  goes stale in the one place customers read it.
- **It must make a dangerous mistake hard.** They will be typing prices and
  **allergen codes**. Losing an allergen in an edit is the failure mode with
  real-world consequences, and it must not be reachable by accident or by a
  half-finished edit.
- **It must never leave a customer-facing half-state.** An interrupted edit
  leaves the last good menu live.
- **It should be usable from a phone.** The realistic moment is standing in the
  shop after close, not at a desk.

Note the trade this closes: pre-cutover, the menu exists in two places and can
drift. Post-cutover there is one copy — but its correctness now depends on a
busy person's data entry. The drift risk becomes an input-validation risk, and
the editor is where that risk is either handled or realised.

## What they will not tolerate

- **Anything that risks order volume.** A bad week is not recoverable from; a
  restaurant's costs do not pause.
- **Software attention during service.** If it needs a person at a screen
  between 18:00 and 21:00, it will not happen and will silently degrade.
- **Being on the hook for money that has not arrived.** Failed payments,
  chargebacks and refunds are a category of problem a kitchen cannot absorb.
  This is the real weight behind
  `decision_record/webview-handoff-is-temporary` — the cost of owning payments
  is not only the build.
- **A second menu that drifts from the real one.** Wrong prices or a sold-out
  item reaching a customer is worse than having no app.

## What they do NOT need

- **Analytics dashboards.** Two numbers matter — orders, and commission paid —
  and both already arrive on statements. A dashboard is a thing to check, and
  there is no slot in the day to check it.
- ~~**A CMS or admin app to maintain.**~~ **CORRECTED 2026-08-28 — this was
  wrong.** When our website replaces `portofino-essen.de`, the owner logs in
  and maintains the menu themselves. They *are* an admin user, and this profile
  said the opposite. See the new need below; the reasoning behind the original
  entry survives as a constraint on that admin, not as a reason to skip it.
- **Customer-relationship tooling, yet.** It is the right ambition and the
  wrong ask today; nobody has hours to run a campaign.
- **English-first anything.** German is the working language and the customer
  base is local. English is an addition, never the default.

## How we would know we served them

- **Commission paid per month**, falling — with **order volume held**. Either
  number alone is misleading; see `success_metric/commission-paid`, where a
  fall caused by lost revenue is the trap the metric names.
- **Minutes of software attention per week.** Should be near zero, and should
  never be required during service.
- **Menu correctness incidents** — a customer meeting a wrong price or an
  unavailable item. Should be zero, and each one traces back to the two-copies
  problem above.
- **Whether they would recommend it to another restaurant owner.** The blunt
  proxy for whether the thing is actually worth its trouble, and one that costs
  nothing to ask.
