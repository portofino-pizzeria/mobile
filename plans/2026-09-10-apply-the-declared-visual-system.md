# Portofino — apply the declared visual system to the app (2026-09-10)

> **Status: SHIPPED 2026-09-10** — landed on `main` as
> [#5](https://github.com/portofino-pizzeria/mobile/pull/5) (`eb64260`).
> Findings that were *not* implemented are listed under "Not done, and why" —
> they are the output that compounds.
>
> **Post-merge follow-up, 2026-09-12** (one PR, reviewed against `main` after
> #5 and #8 landed). What #5 left unwired, and what changed under it:
>
> - `brandPressed` was declared with "no consumer yet". It is now read by
>   every brand-red control while pressed — a fill darkens; an outline's
>   border darkens and its ground lifts to `backgroundSelected`, because on
>   the dark card a darker red alone measures ~2.4:1 and reads as fading
>   rather than pressing. A pressed pill's LABEL does not move, because
>   `priceText` is ink in dark mode for AA and a swap to the pressed red
>   would drop it under 4.5:1 for the duration of the press. Hover on web is
>   not wired — the `Pressable` style callback types only `pressed`.
> - `Fonts.mono` and the `code` text role were kept in #5 on the grounds that
>   `web-badge` consumed them — but nothing rendered `web-badge`. It, `HintRow`,
>   `Collapsible`, `ExternalLink`, the dead `AnimatedIcon` export (Expo's logo
>   on Expo's gradient), the template's unreferenced images, and the
>   `reset-project` script that moves `app/` aside are removed, and with them
>   the last web font variable. Same finding class as S7.
> - `MaxContentWidth` was defined and never read; four screens hardcoded the
>   same 800. They read the token now.
> - **The v2 append to `domain_spec/visual-system` (#8, 2026-09-11) converted
>   two of the gaps below from `Declared UNKNOWN` to declared:** spacing
>   rhythm (4 / 8 / 12 / 16 / 24 / 32 / 48, section separation 48) and card
>   geometry (one radius for cards, one for pills). `Spacing` is re-keyed to
>   that ladder — the two off-ladder values the app carried, a 2px gap (eight
>   token sites and two literals) and a 64px end spacer, move to 4 and 48 —
>   and `Radius.card` / `Radius.pill` replace the spacing tokens that were
>   doubling as radii. Text inputs keep their 8 under `Radius.field`: a field
>   is neither a card nor a pill, so the declaration does not reach it, and
>   it is carried forward as the one radius the tenant has not spoken to.
>   Motion is declared now too (150 / 250 / 400 ms ceiling) and transcribed
>   as `Motion`; its only consumer is the template splash overlay at 600 ms,
>   a known violation that is S6's problem and not retimed here. Photography direction is closed by the companion
>   `domain_spec/imagery-and-iconography`; wiring the 29 illustrations into the
>   menu is #8's follow-up, not this one.
> - Still open, unchanged, and NOT resolved in code: S4 (order summary at
>   payment), S6 (the mark), the alert red, the type scale, the neutral ramp,
>   dark mode.
>
> Verified the way CI does — `tsc --noEmit`, `expo lint`, `expo export
> --platform web`, `check-assets.py` — and NOT on a device: the token
> re-keying preserves every value except the two ladder moves named above
> (2 → 4, 64 → 48), and no screen was re-rendered to confirm them. An
> independent review of the diff found three of its own — inputs silently
> reshaped to the card radius, two literal 2px gaps the re-key missed, and
> the dark-mode pressed outline fading — and all three are fixed above.
>
> **S1 closed, 2026-09-12:**
> [#15](https://github.com/portofino-pizzeria/mobile/pull/15) (`669ffa5`).
> Checkout used to accept an order with no contact details.
>
> - **What #15 does:** it disables payment until name, phone and address pass
>   the backend's cleaning, digit and length rules, and it shows the reason
>   while payment is disabled. It does not copy the backend's letter-or-digit
>   rule.
> - **Where the rule is enforced:** portofino-pizzeria/backend#9, where the API
>   refuses such an order. That PR was still OPEN when this was written, so
>   check its state rather than relying on this note.
> - **The follow-up to #15:**
>   - wires the optional delivery note the order contract already carried: a
>     field at checkout, shown on the kitchen card;
>   - makes `pay()` read each field as it was typed, so a UI Bridge workflow
>     that fills the fields and pays in one run gets the new values, not the
>     previous render's;
>   - stops copying the gap into the red error line, where it went stale once
>     the fields were filled in. The footer states it live instead. Editing a
>     field clears only a 4xx refusal of the order. An error after the order
>     was created, or one whose outcome is unknown, stays and says so;
>   - makes a UI Bridge `press` on a disabled button fail, instead of reporting
>     success when nothing happened.
> - **Verification:**
>   - #15: `tsc --noEmit` and `expo lint`.
>   - The follow-up: those two plus `expo export --platform web` and
>     `check-assets.py`.
>   - Neither was run on a device.
>
> **Oracle:** DECLARED INTENT, tenant `pizzeria`. Read live on 2026-09-10 —
> `domain_spec/visual-system` (v1), `policy/ux-priorities` (v3),
> `audience_profile/hungry-diner` (v3), `audience_profile/owner-operator` (v2),
> `initiative/current-initiative` (v5).
>
> **Instrument:** the app's own UI Bridge control server (`:8087`) on a Pixel 7
> API 34 emulator running the dev client against the local backend. Every
> finding below was reached by OPERATING the surface, not by reading a
> snapshot — except where marked UNTESTED.

---

## Headline

**The app shipped the stock Expo template's greyscale theme, and the tenant has
a visual system it does not use.**

`domain_spec/visual-system` declares a brand red (`#db052c`), a warm cream
panel ground (`#fffdee`), and a four-face typographic system. Measured on the
running app before this change, `src/constants/theme.ts` contained
`text: '#000000'`, `background: '#ffffff'`, `backgroundElement: '#F0F0F3'` and
a `--font-display` of `Spline Sans, Inter, …` — the Expo scaffold's own values,
unchanged since the project was generated. **The brand red appeared nowhere in
the app.** The only saturated colours on any customer screen were Stripe's
`#635bff` and PayPal's `#ffc439`.

The spec tells you what to do with that: "Read it to DIFF: every line of
spec-versus-reality is a candidate piece of work."

## Why this clears the initiative's bar

`initiative/current-initiative` sets `new_work_bar: 7` and says quality work
"qualifies on its merits by naming the mechanism it moves". This names #3,
**earns a recommendation**: "An app people like gets recommended. That is not a
marketing spend, it is a **product property**, and it is earned or lost in the
build" — and the initiative is explicit that word of mouth is one of only two
zero-cost acquisition channels available, the other being the shop counter.

It touches #2 as well — *removes a reason a diner would not switch* — via the
two defects below that were fixed on the way.

It does **not** claim to move commission directly. Per
`audience_profile/example-audience`, a candidate claiming the diner must "say
how it wins on the diner's own terms": a single-restaurant app that looks like
an unfinished scaffold, against an incumbent that does not, loses on
recognition before it loses on features.

---

## What was applied

Only what the spec DECLARES. Everything it files under `Declared UNKNOWN` was
left alone — see "Gaps".

| Spec line | Was | Now |
|---|---|---|
| Brand red `#db052c`, predominantly a FOREGROUND colour — "the colour of headings and prices" | absent | section headings, screen titles, dish prices, cart/order totals, nav header |
| Red pressed `#ba0425` | absent | `brandPressed` token |
| Ground `#ffffff` — "white, not cream" | `#ffffff` | unchanged |
| Warm ground `#fffdee` — "panels and bands that need to lift off white" | `#F0F0F3` (template grey) | every card and panel |
| Ink `#000000` — body text | `#000000` | unchanged |
| Headings, condensed: `League Gothic`, `Oswald` | Spline Sans / system | League Gothic for section headings, Oswald SemiBold for dish names and card titles |
| Text: `Jost` | Spline Sans / system | all body copy, descriptions, allergens, prices |
| "A design that turns [red] into a background wash … is a different palette" | n/a | repeated controls are red OUTLINE + red label; a red FILL is used for at most one action per guest screen |

### The one rule that is not in the spec

The spec's semantic contract says a hue is chosen "from what it OBLIGES A
READER TO DO", and separately that "the brand red is not the error colour …
alerts are UNDECLARED". Those two together create a problem the spec does not
resolve, because it does not yet reach controls: the owner surfaces already
spend a red on *careful* (`DANGER` in `admin-ui.tsx`), so a red "go" button
beside it collapses the distinction.

Resolved with one audience-scoped rule, written into `constants/theme.ts`:

- **Guest surfaces** (menu, cart, checkout, order) — the single primary action
  may be a red fill. Verified by operation: these screens carry **no
  destructive control at all**, so nothing competes.
- **Owner/staff surfaces** (kitchen, admin) — **no red fill.** The brand red
  appears in headings and prices only; the primary action stays ink.

This is owed back to the operator as a decision, not treated as settled.

---

## Findings

Ranked by audience impact. `OPERATED` = reached by driving the surface.

### S1 — An order can be placed with no name, no phone and no address `OPERATED`

Pressed `pay-stripe` with all three fields empty. The app created order
`#206b44f4`, opened the hosted checkout, and returned "Zahlung erhalten —
Deine Bestellung ist bestätigt und geht in die Küche." The kitchen screen then
showed that order with a blank customer block, indistinguishable from a pickup
order.

`ux-priorities`: predictability, and "honesty (never fabricate state)".
`audience_profile/owner-operator`: "Anything that risks order volume. A bad
week is not recoverable from."

**Closed in the app 2026-09-12 by
[#15](https://github.com/portofino-pizzeria/mobile/pull/15). Server enforcement
is pending in portofino-pizzeria/backend#9, which was OPEN as of 2026-09-12.**
Until it merges, a direct API call, or a build installed before #15, can still
place the order this finding describes.

- **2026-09-10:** the kitchen card started saying
  `Keine Kontaktdaten hinterlegt` instead of showing blank space, so the screen
  no longer invents a fact.
- **2026-09-12:** the checkout disables payment until name, phone and address
  are given.
- **Enforcement:** portofino-pizzeria/backend#9 makes the API refuse such an
  order, once it merges. See the S1 note in the status block at the top for
  what each change covers and where it was verified.

### S2 — The kitchen screen was entirely in English `OPERATED`

"Kitchen", "3 active orders · auto-refreshing", "New / Preparing / Ready",
"Start preparing", "Mark ready", "Cancel", "Nothing here.", "just now",
"290h 29m ago".

`audience_profile/owner-operator` is unambiguous: "**English-first anything** —
German is the working language and the customer base is local. English is an
addition, never the default." This is the owner's own screen, used during
service.

**Fixed.** All of it, plus `<html lang="en">` → `lang="de"` and the English
meta description on the web build.

### S3 — Elapsed time stopped being useful past a day `OPERATED`

Two live orders rendered as `290h 29m ago` / `290h 58m ago`. A cook cannot use
that figure for anything.

**Fixed** — the UNIT is capped (`vor N Tagen`) while the elapsed reading is
kept. An earlier draft of this fix replaced elapsed time with a wall-clock
stamp and had to be reverted; see the review section for why that was worse.

### S4 — The tenant's brand is absent at the moment of trust `OPERATED`

On `/checkout`, the two payment buttons are the only saturated colour on the
screen and both belong to third parties. `audience_profile/hungry-diner` names
"Uncertainty that the order landed" as the thing they will not tolerate, and
switching cost as second-order *risk* rather than effort.

**Partially addressed** — the screen heading and the total now carry the brand.
The pay buttons keep their vendor colours deliberately: a diner recognises
them, and that recognition is doing work. What is still missing is an order
summary at the point of payment; the screen shows a total and no lines.
**Reported, not implemented** — that is content, not styling.

### S5 — Repeated price pills clipped their own prices `OPERATED` — introduced and fixed IN this change

Worth recording because it was self-inflicted and invisible to both gates.
Switching body copy to Jost widened every label; two pills per row no longer
fit, flexbox compressed them, and React Native clipped the label with no
ellipsis — rendering `+ klein 22cm ·` with the price gone. `tsc` and
`expo lint` both passed on it.

**Fixed** with `flexShrink: 0` on the pill, so a row wraps instead of
compressing. Confirmed by re-capture: `+ klein 22cm · 4,90 €` renders whole.
That fix was itself incomplete — see review item 4.

The general lesson, which is why this is in the plan and not just in the diff:
**a font change is a layout change**, and neither type-checking nor linting can
see a clipped price.

### S6 — The app's icon and splash are still Expo's own artwork `INSPECTED`

`assets/images/splash-icon.png` is **byte-identical** to
`assets/images/expo-logo.png` (sha256 `27b060a757a29038…`; the duplicate was
removed as unreferenced by the 2026-09-12 follow-up — the digest still verifies
against `splash-icon.png`), and
`assets/images/icon.png` is the Expo chevron on Expo blue. `app.json` sets the
splash background to `#208AEF` and the adaptive-icon background to `#E6F4FE`.

So the first thing a diner sees when the app launches — and the tile sitting on
their home screen next to Lieferando's — is the Expo scaffold's logo. No
palette change reaches this; it needs a mark. `initiative/current-initiative`
mechanism #3 is *earns a recommendation*, and this is the single loudest signal
that the app is unfinished.

**Reported, not fixed.** `domain_spec/visual-system` declares a palette and a
type system and says nothing about a logo, and inventing one is authoring
brand. Recolouring the template artwork to brand red would be worse — it would
make Expo's chevron look deliberate.

### S7 — Two dead text roles carrying an undeclared colour `INSPECTED`

`ThemedText` shipped `link` and `linkPrimary`; `linkPrimary` hardcoded
`#3c87f7`, a blue that is in no palette. Neither type was used by any screen.
A feature that works perfectly and serves nothing is still a finding.

**Fixed** — both removed.

---

---

## Independent review, and what it changed

The diff went to a `code-reviewer` subagent that received the staged change and
**not** the reasoning above. It found five defects worth the pass; all five are
fixed in this branch. Recording them because two were regressions this change
introduced and neither `tsc` nor `expo lint` could see either.

1. **Every `lineHeight` was below its face's own metrics.** Verified
   independently by parsing the `hhea` table out of the shipped TTFs:
   Oswald_600SemiBold **1.482 em**, Jost **1.445 em**, League Gothic
   **1.200 em**. The `heading` role was set to 22px at fontSize 17 — 1.294 em,
   under the face. On Android that does not tighten the line, it truncates the
   ascent.

   **Scope, measured rather than assumed:** a mutation test (set it back to 22,
   re-render, capture) showed "Hühnersuppe (scharf)" with its diaeresis
   **intact** — lowercase umlauts and b/h/k/t ascenders fit inside the
   truncated ascent, so this was *not* a visible bug on today's menu. What was
   gone was the margin: a capital Ä/Ö/Ü reaches 1.042 em = 17.7px of ink
   against 17.1px of available ascent. The owner types dish names into the
   editor, so the content is not fixed. Every role now carries
   `lineHeight >= ceil(fontSize x ratio)` with the ratio in a comment.

2. **The nav header was pinned to literal white** — a regression introduced
   here. `headerStyle: { backgroundColor: Brand.ground }` put a white bar with
   a red title over a black body on every route in dark mode. Now read from
   the theme.

3. **Prices failed WCAG AA in dark mode.** `#db052c` on `#000000` is
   **4.04:1**, under the 4.5:1 threshold for 14px text (on white the same red
   is 5.20:1, which is why a light-theme review misses it). `price` now has its
   own colour role: the declared red on light, ink on dark. Not a design
   choice — dark mode is `Declared UNKNOWN`, so inventing a lightened red would
   be authoring intent, and shipping a known AA failure was not acceptable
   either.

4. **The `flexShrink: 0` fix moved the clipping rather than removing it.** With
   the shrink off, a pill wider than the column overflows and is cut by the
   card's `overflow: 'hidden'` — the same failure at a longer variant label.
   Bounded with `maxWidth: '100%'` so the label wraps inside the pill, plus
   `minHeight: 44` for the touch target.

5. **`minutesAgo` past 24h discarded the kitchen's only stuck-order signal.**
   The board loads *active* orders only, so an order still in a lane after a
   day **is** a stuck order and the elapsed figure is the alarm; a wall-clock
   stamp reads as ordinary, and without a date could not separate last Tuesday
   from this one. The right fix was capping the UNIT, not dropping elapsed
   time: it now reads `vor N Tagen`. Hand-formatted rather than
   `toLocaleString` with options — Intl option support on Android Hermes is
   partial and a silently ignored options object returns a full date string
   that would wrap the cell. Also fixed `vor 3 Std. 0 Min.` on the hour.

Two wording corrections from the same pass:

- `Keine Kontaktdaten — nicht lieferbar` → `Keine Kontaktdaten hinterlegt`. The
  first asserts a second fact the payload does not carry — an order with no
  contact block may be a walk-in — which is the same honesty error inverted.
- `Nichts offen.` → `Nichts vorhanden.` "Nothing open" is false in the
  **Fertig** lane, where a present order is finished rather than open.

Plus token-layer cleanup it caught: a hardcoded `'Oswald_600SemiBold'` in
`_layout.tsx`, `'#fff'` literals on the pay and danger buttons, two addresses
for the alert colour, `Oswald_500Medium` loaded and referenced by nothing, and
three dead web font variables (`--font-display` *read* like the heading stack
and changed nothing when edited — the headings come from expo-font's injected
`@font-face`).

---

## What the surface gets RIGHT, and must not be lost

Named so a later change does not delete them.

- **Allergens are never silently dropped.** `UNRESOLVED_ALLERGEN_LABEL`, the
  API's own flagged `unbekannt` entry, and an item with no priced variant still
  rendering as "Zurzeit nicht bestellbar" rather than being hidden. Three
  independent floors under one rule. `domain_spec/menu` treats menu
  correctness as the app's one job.
- **The offline menu cache states its own age** rather than passing a stale
  menu off as live.
- **The admin editor confirms inline** rather than through `Alert.alert` — the
  comment in `admin-ui.tsx` gives the reason, and it is a good one.
- **Every interactive control is a Bridge component.** That is why this pass
  could operate the app at all.
- **Variant-keyed cart lines** — two sizes of one pizza stay two addressable
  rows.

---

## Not done, and why

- ~~**Checkout validation (S1).**~~ No longer open. It was left out of this
  pass because requiring name/phone/address is behaviour, not styling, and it
  changes what the backend receives. The decision was taken on 2026-09-12; see
  "S1 closed" in the status block at the top.
- **An order summary on the checkout screen (S4).** Content, not styling.
- **The three kitchen lane accents** (`#f5a524`, `#635bff`, `#17c964`) and
  `admin-ui`'s `DANGER` / `WARNING` / `OK`. All UNDECLARED. Carried forward
  unchanged and marked in source; picking a status palette in code would be
  authoring intent. `DANGER` is now single-sourced from the token file so the
  gap has one address.

## Gaps — what blocked full application

Each is a `Declared UNKNOWN` in the spec, and each is now a live obstacle
rather than a theoretical one:

1. **The alert treatment.** The spec's load-bearing constraint is that the
   brand red cannot also mean "something is wrong". Now that headings and
   prices ARE `#db052c`, the app's existing `#e5484d` error red sits adjacent
   to it and the two do not read as different. This was tolerable while
   nothing else was red. **It is the highest-value decision the operator
   currently owes.**
2. **The type scale.** Two values in `themed-text.tsx` are marked `OPTICAL` —
   the smallest adjustments that let a condensed face sit beside a geometric
   one. The spec anticipates exactly this ("a condensed heading face and a
   geometric text face need different optical sizing to sit together") and
   leaves it open.
3. **The neutral ramp.** `textSecondary`, `backgroundSelected` and the input
   borders are still Expo-scaffold greys. The spec forbids copying the
   reference's Foundation-default greys but declares no replacement.
4. **The accents** (gold `#f9c741`, teal `#50b4b4`, warm beige `#f5ebe0`).
   Unused: "Give each a job here before using it, or drop it." No job was
   invented for them.
5. **The script and retro-display faces** (`Playwrite TZ`, `Bungee Inline`).
   Not loaded. The script is forbidden on "anything carrying a price, a time or
   an allergen", which is most of what this app renders, and no surface has a
   warmth accent to carry. Loading a face with no role would be authoring
   intent.
6. **Dark mode.** "Undeclared, not decided against." The dark palette maps the
   brand roles onto values the app already shipped, and is otherwise untouched.
7. **Photography direction.** The menu renders a thumbnail when `imageUrl` is
   present; the seed has none, so every card is text-only. The spec warns "a
   design that assumes it will fall flat without it" — currently the design
   does not assume it.

## Gaps in the tooling, not the intent

- **`GET /ui-bridge/design/element/:id/styles` and `POST /design/snapshot`
  return every style property as an empty string on the native adapter.** They
  are DOM-shaped. A styling audit that trusted them would conclude the app has
  no styles at all — an empty answer reading as a measurement. Style evidence
  here came from source plus bridge *geometry* (which is populated) plus
  screen capture.
- **`POST /ui-bridge/control/page/navigate` answers `NOT_SUPPORTED` on
  native**, and `control/screenshot` needs a `screenshotProvider` the app does
  not pass. Navigation between non-linked routes went through the app's own
  deep-link scheme instead.

## UNTESTED

- **The admin menu editor.** `OWNER_MENU_TOKEN` is unset on the local backend,
  so the gate refuses every request and the editor is unreachable. Only its
  locked state was operated. Its error text also names the environment variable
  to a reader who "runs the kitchen, not the software" — a finding in its own
  right, not fixed here.
- **iOS and web rendering.** Verified on Android only. The leading floors
  above are an Android concern specifically; iOS overlaps lines rather than
  clipping.
- **Dark mode.** The two dark-mode defects were found by review and reasoning,
  not by rendering — the emulator ran in light mode throughout.

## Verification

- `npx tsc --noEmit` — clean.
- `npx expo lint` — clean.
- Operated on-device after the change: menu, cart, checkout, order
  confirmation, kitchen, admin gate. Every action round-tripped through the UI
  Bridge with an observed DOM settle (208 → 209 elements on an add-to-cart,
  ≤750 ms), not a `success: true`.
