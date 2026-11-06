---
decision: Skip the throwaway MVP — build the smallest PERMANENT direct-ordering channel, starting on the own-site volume.
status: accepted
decided_on: 2026-08-28
supersedes: webview-handoff-is-temporary
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**
>
> **Ratified by the operator 2026-08-28.** `webview-handoff-is-temporary` is
> now `superseded` and stays in the corpus — deleting it would lose the reason
> this record exists.

# Build the permanent thing, not the viable one

## Context

`decision_record/webview-handoff-is-temporary` chose an in-app webview
hand-off to Delivery Way. Its entire justification was cost avoidance:
*"near-zero backend and no payment integration"*. The 2026-06-13 kickoff states
it as a table row — **"Backend | ❌ Not needed"**.

**That premise is void.** An AWS backend now exists (operator, 2026-08-28), set
up deliberately and in the expectation of building direct ordering. A decision
whose sole rationale was "we would have to build a backend" cannot outlive the
backend.

There is a second reason, and it is the more general one. An MVP is a tool for
retiring **build risk** cheaply — it assumes engineering effort is the scarce
resource. On this fleet effort is not scarce; agent build capacity is
abundant and the operator's scarce resource is his own steering time. An MVP
justified by saving build effort is optimising a resource that is not binding.

**And a third, which is decisive and belongs to the operator (2026-08-28):
the MVP does not merely fail to move commission — it blocks the only thing
that can.**

Moving the ~€2,200/month on Lieferando is a *marketing* problem: customers have
to be told to order somewhere else. That effort cannot begin until there is a
real direct channel to send them to. An app that hands off to Delivery Way
gives you nothing to market — you would be asking a diner to switch to the same
checkout they already use.

So the MVP does not just delay the money. It delays the *start of the clock* on
the campaign that earns it, and marketing has a lead time of its own. Every
month spent on a hand-off is a month the pull from Lieferando has not begun.

## Decision

**Do not build the webview hand-off. Build the smallest PERMANENT thing.**

Concretely, the first deliverable is:

> The replacement website, with the owner-authored menu, taking orders
> **directly** — on the own-site channel only.

Nothing in it is intended to be thrown away.

**"Own-site channel only" stages TRAFFIC, not the BUILD.** This is the
sentence most likely to be misread, so it is stated plainly: the site is built
complete. What is staged is where the orders come from. On day one it serves
the diners who already arrive at the site — roughly €2,000/month of volume —
because that traffic exists without anyone doing anything. It is not a reduced
product, a pilot, or a phase-one subset, and nothing about it is built to be
replaced.

**Why that ordering, when own-site is only ~€280/month of commission:** because
the point of going first is bounded risk, not money. €2,000/month is small
enough that payment liability is survivable while the flow is proven, and it is
real customers placing real orders — the only way to learn whether a diner will
complete a direct order at all.

The ~€2,200/month on Lieferando is the actual prize, and it is reached second
because it is a **marketing** problem. The campaign runs against a channel that
is already live and already proven — which is exactly the sequencing the third
reason above demands, and the reason the build is not staged even though the
traffic is.

## What this decision does NOT claim

**It is not "skip staging".** Two risks the MVP was also covering do not
dissolve just because building got cheap, and both are staged for deliberately:

- **Demand risk is untested.** `product_intent/vision` rests on diners
  switching channels, and diners have no reason to care about the pizzeria's
  commission. Cheap construction does not make a wrong assumption cheaper — it
  makes the wrong thing arrive sooner. Own-site-first is how that assumption
  gets tested at a survivable size.
- **Payment liability is not a build problem.** Chargebacks, refunds, failed
  payments and being the party responsible at 19:30 on a Saturday are not made
  cheaper by agents. `audience_profile/owner-operator` names this as
  intolerable, and it is the one thing on this project that can damage a real
  business.

The staging axis therefore changes from *feature count* to **risk retired**.

## Consequences

- **The webview is not built.** Effort that would have gone to the hand-off,
  and to removing it later, goes to the permanent channel instead.
- **Payments arrive in scope now**, along with everything that implies:
  provider selection, refunds, failed-payment handling, and an answer to who is
  responsible when ordering is down during service
  (`product_intent/open-questions` #6, now urgent rather than theoretical).
- **`open-questions` #1 is answered — direct, not hand-off.** Close it when
  this record is accepted.
- **`open-questions` #4 becomes blocking.** Cutover is now the plan rather than
  a later step, so the three unharvested menu categories (Hähnchenbrust,
  Rumpsteak, Dessert) must be captured before the replacement site goes live —
  otherwise an incomplete menu becomes authoritative and the owner inherits the
  gap as data entry.
- **The first commission movement is small and that is expected.** ~€280/month
  is the ceiling on what own-site-direct can save. Reading a small number as
  failure would be the same misreading the superseded record warned about, one
  step along.

- **⚠️ The plan now depends on a capability the corpus says does not exist.**
  Everything above ~€280/month arrives through marketing, and
  `audience_profile/owner-operator` states plainly, under *what stops them
  today*, that the owner **cannot run a marketing channel** — it is work nobody
  has hours for.

  So the money in `product_intent/vision` is gated on a campaign with no owner
  and no budget. That is not an argument against this decision; the sequencing
  is right either way. It is the thing most likely to make a correctly-built
  product earn nothing, and it needs a name attached to it before the site goes
  live rather than after. Tracked as `product_intent/open-questions` #7.

## What would reopen this

1. **Payment liability turns out to be unacceptable to the owner.** If, having
   seen what direct ordering makes them responsible for, they decline it, the
   hand-off returns — and it returns as a permanent architecture with the
   commission accepted as a cost of doing business, not as a stepping stone.
2. **Diners do not complete direct orders on the own-site channel.** That is
   the demand assumption failing at the cheapest possible place. It would mean
   the commission thesis is wrong, and it should reopen
   `product_intent/vision`, not merely this record.
3. **Build effort stops being abundant.** The general argument above depends on
   agent capacity being cheap relative to the operator's time. If that inverts,
   the classic MVP calculus returns with it.

**What would NOT reopen it:** the direct channel being slower to build than
expected. That is effort, and effort is explicitly not what this decision was
optimising for.
