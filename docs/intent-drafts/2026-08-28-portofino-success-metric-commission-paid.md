---
metric: commission-paid-monthly
source_query: >-
  Not a database query — this number comes from a person, stated as such.
  Sum of (a) the Delivery Way commission line on the portofino-essen.de
  monthly statement and (b) the Lieferando monthly partner statement's
  commission line, for the same calendar month, in EUR.
  Collected by: the owner-operator, from the two statements.
  ALWAYS record gross order revenue for the same month alongside it —
  the metric is uninterpretable without it (see "what would make this
  misleading").
baseline: 2480
baseline_as_of: 2026-06-14
target: null
direction: decrease
unit: EUR of commission per calendar month
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**

# Commission paid per month

## Why this one

`product_intent/vision` says the product exists to change who gets paid. This
is that, as a number. A candidate claiming to serve the vision should be able
to say how it moves this — and most candidates cannot, which is the point.

## The baseline, and how solid it is

**€2,480 per month**, owner-provided 2026-06-14:

| channel | rate | monthly revenue | commission |
|---|---|---|---|
| own site (Delivery Way) | 14% | ~€2,000 | ~€280 |
| Lieferando | up to 22% | ~€10,000 | ~€2,200 |

**Treat this as an estimate, not a measurement.** The revenue figures were
given as approximations, Lieferando's rate was given as "up to" 22%, and
neither has been reconciled against a statement. The first month that real
statements are read, this baseline should be **replaced**, not adjusted — and
`baseline_as_of` moved with it.

## Target

**`null` — the owner's call, not the builder's.** It encodes how much order
volume they are willing to risk to move margin, and that is a business
judgement nobody else gets to make on their behalf.

Worth knowing when setting it: this number cannot go to zero without leaving
Lieferando entirely, which would cost most of the ~€10,000 in revenue it
carries. A sensible target is a *share shifted*, not an amount eliminated.

## What would make this metric misleading

1. **Commission falls when revenue falls, and that reads as success.** This is
   the dominant trap and it is severe: a bad month, a closure, a lost delivery
   radius — each drives this number down while the business gets worse. **The
   metric is invalid without gross revenue for the same month beside it.**
   Never report, cite or celebrate it alone.

2. **Shifting orders between platforms is not escaping them.** Moving volume
   from Lieferando (22%) to the own site (14%) lowers this number without
   creating any direct channel at all. It is a real saving and it is *not*
   progress toward the vision, which is about ownership rather than rate. Count
   direct-channel orders separately.

3. **Rates change without anyone telling you.** Both rates are set by the
   platforms. A commission drop caused by a Lieferando pricing change is not
   something the app did — record the rates alongside the amounts so a
   rate-driven move is distinguishable from a volume-driven one.

4. **The MVP is expected to move this by exactly zero.** The webview hand-off
   pays the same commission it always did — see
   `decision_record/webview-handoff-is-temporary`. A flat metric during the MVP
   window is the plan working, not the product failing, and reading it as
   failure would argue for abandoning the strategy at precisely the wrong
   moment.

5. **Cash pickup is invisible here.** Pickup is mostly cash and carries no
   commission at all, so it never appears in this number. A shift from delivery
   to pickup improves the business's economics while leaving this metric
   untouched.

## How to cite it

Say which **mechanism** a candidate moves — orders shifted to a direct channel,
diners retained after a first direct order, a reason-not-to-switch removed —
rather than asserting it reduces commission. And pair every figure with gross
revenue for the same month; a commission number quoted alone is not evidence of
anything.
