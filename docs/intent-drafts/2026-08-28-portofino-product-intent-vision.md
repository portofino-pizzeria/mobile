---
subject: Portofino Essen — mobile app
last_reviewed: 2026-08-28
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.** These documents describe a
> pizzeria's product. Publishing them into the qontinui tenant would corrupt
> that tenant's ranking — a selection loop would score qontinui work against a
> pizzeria's goals. Check the tenant before publishing.

# Vision — own the transaction

## What this is for

Portofino Essen is a real pizzeria on Hauptstraße 108 with a rich menu, a
website, and a problem it did not choose: **on roughly €12,000 of monthly
online revenue it pays about €2,480 in commission** — 14% on its own site
(Delivery Way) and up to 22% on Lieferando. On a pizzeria's margins that is not
a line item. It is most of the profit on every order that goes through a
platform.

The app exists to **move orders into a channel Portofino owns.** Not to be a
nicer menu — to change who gets paid.

The arithmetic is what makes this worth building rather than a nice-to-have: at
22%, a single €30 Lieferando order carries about €6.60 of commission. Shifting
even a fifth of the platform volume to a direct channel is roughly €440 a
month, every month, on an app that is built once.

## The scope is a website AND an app

Clarified 2026-08-28: **our website replaces `portofino-essen.de`.** The mobile
app is one surface of the product, not the whole of it.

That matters more than it sounds, because the existing site *is* the 14%
channel — the ordering on it is Delivery Way's. Replacing it is therefore the
**first real commission event in this plan**, and the first moment the strategy
stops being theoretical. It is also when the menu changes hands: the owner logs
into our site and maintains it directly, so truth stops being scraped from
somebody else's page and starts being authored on ours.

One thing that replacement does not settle by itself: whether the new site
takes orders directly or hands them to Delivery Way as the app's MVP does. That
is the decision that determines whether the 14% dies or is merely inherited,
and it is open — see `product_intent/open-questions`.

## Where it ends up

A regular opens the Portofino app, reorders their usual in under a minute, and
pays directly. No platform takes a cut of that order. Lieferando keeps its
place as a way *new* customers discover Portofino — but it stops owning the
relationship with the ones who come back.

## What "better" means

**Euros of commission not paid.** That is the axis to trade the others against
— polish, feature count, and technical elegance included.

A candidate is good to the degree that it moves an order from a commissioned
channel into a direct one, or removes a reason a diner would not switch. A
change that improves the app without touching that is not bad work; it is
simply not this product's purpose, and the ranking should say so.

## How it gets built — decided 2026-08-28

**No MVP. Build the end product.** `decision_record/build-the-permanent-thing`
(accepted) supersedes the earlier webview hand-off: an AWS backend exists, so
its cost-avoidance rationale is void — and more importantly, a hand-off *blocks*
the only mechanism that reaches the money.

That mechanism is **marketing**, and it has a hard prerequisite: you cannot ask
a diner to order somewhere else until somewhere else exists. An app that hands
off to Delivery Way gives you nothing to point them at — you would be asking
them to switch to the checkout they already use. So the hand-off would not have
postponed the earnings; it would have postponed the *start of the campaign that
produces them*.

The build is not staged. The **traffic** is: the site launches complete and
first serves the diners who already arrive at it (~€2,000/month), which is the
low-risk place to prove that a diner will complete a direct order at all.

## The thing most likely to go wrong

**The site gets built correctly and nothing happens.**

~€280/month is the ceiling on what the own-site channel can save. Every euro
above that arrives through a campaign that pulls customers off Lieferando — and
`audience_profile/owner-operator` says plainly that the owner **cannot run a
marketing channel**; it is work nobody has hours for.

So the upside of this entire vision currently rests on a campaign with no
owner, no budget and no channel named. That is not a reason to build
differently — the sequencing is right regardless. It is the reason a
correctly-built product could earn nothing, and it wants a name attached to it
**before** go-live, not after. `product_intent/open-questions` #7.

Second, smaller: the assumption below has still never been tested.

## The one thing that has to be true

**The diner has to switch, and the diner does not care about Portofino's
commission.** Nobody changes how they order dinner to improve a restaurant's
margins.

Which means the app cannot win on the pizzeria's economics — it has to win on
the diner's own terms, against an incumbent that already has their address and
card saved and is one tap away. Every commission euro in this document depends
on that, and it is the assumption most likely to be false. See
`audience_profile/hungry-diner`.

## What this is not trying to be

Not a delivery platform. Not a Lieferando competitor. Not a point-of-sale or
kitchen system. Detail, with reasons, in `product_intent/non-goals`.
