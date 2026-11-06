---
audience: Hungry diner ordering from Portofino tonight
consumer_type: human
size: unknown as a count. Directionally, the ~€10,000/month of Lieferando revenue is mostly these people, and the returning share of them is the group this product depends on.
last_reviewed: 2026-08-28
---

> ⚠️ **TENANT: Portofino, NOT personal-jspinak.**

# Hungry diner

**This is the load-bearing audience, and the reason is worth stating first:**
the whole commission-escape strategy requires the diner to change how they
order, and **the diner does not care about Portofino's commission.** Nobody
switches apps to improve a restaurant's margins.

So every euro in `success_metric/commission-paid` depends on beating Lieferando
*on the diner's own terms*. If the app is merely as good, nothing moves.

## What they are trying to do

Eat, tonight, without thinking hard about it. Most of the time this is a repeat
order — the same two or three things, from the same place, on the same evening
of the week. It is a habit, not a decision.

## What stops them today

- **Lieferando is already installed, and already knows them.** Address saved,
  card saved, order history one tap away. That is the actual competitor — not
  its menu, not its brand, its *stored state*.
- **Switching has a first-order cost and a second-order risk.** Typing an
  address and a card again is the cost. The risk is worse: an unfamiliar
  channel where they are not sure the order arrived, and dinner is at stake.
- **They do not know the app exists.** There is no discovery surface for a
  single restaurant's app. Whatever brings them to it has to come from
  somewhere they already are — the box the food arrives in, the website, the
  shop counter.

## What they will not tolerate

- **Re-entering an address or a card they have already given.** Once is
  tolerable at signup. Twice ends it.
- **Uncertainty that the order landed.** Silence after tapping "Order" is worse
  than a slow app. They will phone, and having phoned, they will phone next
  time instead of opening the app at all.
- **Being slower than the platform.** They are hungry and it is 19:30. Any step
  the incumbent does not have is a step that has to earn itself.
- **Discovering an item is unavailable after choosing it.** The menu being
  correct is not a nicety; it is the app's one job during the MVP.

## What they do NOT need

- **Discovery and browsing.** They know what they want. Search, filters,
  recommendations and "you might also like" solve a problem this diner does not
  have. The menu is a *lookup*, not a catalogue.
- **Reviews, ratings, or anything social.** They have already chosen the
  restaurant — that is why they are in a single-restaurant app.
- **An account for its own sake.** An account is worth exactly what it removes:
  address and payment re-entry, and the reorder. Asking for one before it has
  earned that is a cost with no return, at the exact moment they are deciding
  whether to bother.
- **Loyalty schemes and gamification, at least not yet.** Nothing here suggests
  points would move this group. Cheaper or faster might; that is testable and
  should be tested rather than assumed.

## How we would know we served them

- **Repeat orders through the app** — the same diner, twice. This is the whole
  ballgame: one order is curiosity, two is a channel shift, and only the second
  one moves commission.
- **Time from opening the app to order placed**, for a returning diner. Should
  be well under a minute, and should be measurably faster than the incumbent
  rather than merely fine.
- **Order-start to order-completed drop-off**, especially at the hand-off into
  the webview — the one seam where the experience changes owner, and therefore
  the place a switch is most likely to fail.
- **Orders that were phoned after an app attempt.** A quiet signal that
  something in the flow did not inspire confidence, and one the pizzeria can
  actually observe from behind the counter.
