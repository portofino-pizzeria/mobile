## Re-measurement, and three more axes (2026-09-11)

The Provenance section above measured the palette and typography from
`losteria.net`'s merged stylesheet on 2026-09-10. This section re-measures the
same artifact and extends it to the axes that section did not cover:
**composition, spacing rhythm and motion** — three of the entries under
`Declared UNKNOWN`.

**The palette measurement reproduces.** Independently re-measured 2026-09-11
against the same served stylesheet (1 156 915 bytes) and the site's JavaScript
(341 358 bytes): `#db052c` occurs **153** times, and of its role-assigned uses
exactly **25 are a fill** against **77 `color`**. v1 states 78 `color` and 25
fills. The red-is-a-foreground-colour constraint is sound and unchanged.

> ⚠️ **The Foundation warning in Provenance applies to this section too, and it
> bites harder here than it did on the palette.** The reference is Zurb
> Foundation 6 on the float grid (`foundation-mq` present; `.row`/`.columns` in
> the markup; no `.grid-x`/`.cell`). Its breakpoints — 40em / 64em / 75em, 223
> and 166 and 41 uses — are **Foundation's own**, and the dominant spacing value
> `1.25rem` (79 uses) is **Foundation's default float-grid gutter**. A spacing
> scale or a breakpoint set copied from this reference would be copying a
> framework default and recording it here as a decision, which Provenance
> already names as the specific error to avoid. So below, measured values are
> reported with a verdict on whether they are **brand** (hand-authored site
> config) or **framework** (a Foundation default), and only the brand ones are
> treated as evidence about the reference's taste.

## Composition: the horizontal rail

**Measured — and this is BRAND, not framework.** The sliders are Slick Carousel
with hand-written per-preset options, so they say what the reference chose:

| Property | Measured | Verdict |
|---|---|---|
| Slides visible | 2 / 3 / 4 by preset, collapsing to **1 or 2 at <=640px** | brand |
| Peek of the next card | **none** — no `centerMode`, no `variableWidth`, no `swipeToSlide` | brand |
| Arrows | disabled below **1440px** on every preset — a phone never sees one | brand |
| Dots | on the column presets; **off** on the menu teaser | brand |
| Autoplay | menu teaser **6 s**, stage **9 s**, both `pauseOnHover: false` | brand |
| Drag | `touch-action: pan-y` — horizontal owned by the rail, vertical scroll preserved | framework (Slick) |
| Slide gutter | 5px each side below 640px, 20px above | framework (Foundation) |

Two findings that invert what the page *looks* like:

1. **The restaurant-menu teaser is not a sliding window at all.** Its preset is
   `fade: true, cssEase: "linear"` — a cross-fading single image, one at a time.
   The sliding windows on that page are the column sliders, and they carry
   campaigns and content teasers, not menu items. A design brief that says "a
   sliding window like the reference's menu section" is describing a fade.
2. **At phone width the reference's rail has no affordance whatsoever.** Arrows
   are off below 1440 and the menu teaser has no dots either. It advances itself
   with nothing on screen saying it can be advanced, and nothing saying where in
   the set you are.

**PROPOSED DECLARATION — a rail is an accent, never the path to the menu.**
A horizontal rail may carry a bounded, curated set (today's offers, house
specialities). The full menu is reached by a vertical list. The reasoning is the
audience's rather than the reference's: `domain_spec/menu` carries 29 pizzas and
30 items under `mexikanisch`; a rail showing one or two at a time puts the 27th
pizza behind 26 swipes, and `audience_profile/hungry-diner` names finding the
thing you came for as the job.

**PROPOSED DECLARATION — every rail states its extent and its position**, with a
visible affordance, and its items reachable without it.

**OPEN — the operator's call, and the one genuine fork here.** Whether the home
screen leads with a rail of *specialities* (the reference's shape: atmosphere
first, menu second) or with the *menu itself* (the ordering-app shape: the job
first). The reference cannot settle it — it is a reservation-and-brand site for a
chain, and this is one restaurant's ordering surface.

## Spacing rhythm — converts a `Declared UNKNOWN`

**Measured, and the measurement is mostly framework.** The reference's spacing
sits on a 5px base — 5 / 10 / 15 / 20 / 25 / 40 — dominated by 20px (79 uses)
and 5px (36). Section padding is `35px 15px` on phones and `55px 60px` above,
sections separated by `60px`, container capped at `93.75rem` (1500px). **The
20px is Foundation's default gutter**, so the ladder is the framework's, not a
brand rhythm. What is genuinely authored is the section padding and the 60px
separation.

**PROPOSED DECLARATION.** Portofino declares its own scale on its own terms
rather than inheriting one:
**4 / 8 / 12 / 16 / 24 / 32 / 48**, on a 4px base, because the platform is React
Native rather than a rem-based stylesheet and 4 is the base the surrounding
ecosystem uses. Section separation 48; screen side padding 16 on phones. The
ladder is the declaration — a value off it is a bug, not a judgement call.

## Motion — converts a `Declared UNKNOWN`

**Measured, and mostly as a warning.** Scroll-triggered fade-ins with delay tiers
of **100 / 200 / 300 / 400 ms** (brand — hand-written); anchor scrolling at
**600 ms** (brand); autoplay at 6 s and 9 s that cannot be paused (brand);
`adaptiveHeight` animating container height as content changes.

**`prefers-reduced-motion` appears ZERO times in 1 156 915 bytes of that
stylesheet.** Combined with autoplay that cannot be paused, the reference fails
WCAG 2.2.2 (Pause, Stop, Hide) on its own home page. **This is not inherited.**
It is the clearest case for why this document records measured properties rather
than "look like the reference": an instruction to resemble the page would have
imported an accessibility failure nobody ever typed.

**PROPOSED DECLARATION.**

- Durations: **150 ms** for a state change on a control, **250 ms** for a
  transition that moves content, **400 ms** ceiling. Ease-out for entrances,
  ease-in-out for movement.
- **Nothing auto-advances.** No carousel autoplay anywhere. The guest controls
  what is on screen.
- Every animation over 150 ms honours `prefers-reduced-motion: reduce` by
  becoming an instant state change, never by being dropped silently — the
  content still arrives.
- Entrance animation is for content that just arrived, never for content the
  guest scrolled to. Scroll-triggered fade-in is not adopted: it delays the menu
  in order to decorate the act of reading it.

## Card geometry

**Measured.** The reference has no soft-radius card system: radii cluster at `0`
(12 uses), `100%` / `50%` (19, circles) and `50-100px` (6, pills). **`0` is
Foundation's `$global-radius` default**, so "square corners" is the framework
speaking, not a choice. The circles and pills are authored and therefore real:
roundness is reserved for avatars and buttons.

**PROPOSED DECLARATION.** One radius token for content cards, one for pills,
nothing in between. Illustration bleeds to the card's top edge — the
watercolour's own cream ground reads as the panel, which is why `groundWarm` is
a panel colour and not a page ground.

## `Declared UNKNOWN` — what this append closes and what it leaves

**Closed by this append:** spacing rhythm (the "Spacing and density" entry, in
part — density is still open), motion.

**Closed by the companion document `domain_spec/imagery-and-iconography`:**
"Photography direction". The answer is that this tenant has an illustration
library rather than a photography one — 29 watercolour dish illustrations
covering every pizza on the menu, and 13 line-art category icons — and that the
distinction is load-bearing rather than a budget substitute. That entry can be
struck from the list above and replaced with a pointer.

**Still open, unchanged:** type scale (both entries), the alert treatment, dark
mode, the neutral ramp, density.

**Newly opened by this append:** the home-screen lead — a rail of specialities
versus the menu itself.
