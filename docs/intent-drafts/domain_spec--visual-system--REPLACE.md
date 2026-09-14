# Visual system

How Portofino looks: palette, type, spacing, shape, composition and motion.
Companion to `domain_spec/imagery-and-iconography`, which governs the pictures
placed inside this system. Read it to DIFF: every line of spec-versus-reality is
a candidate piece of work.

**Scope — deliberately not a repo list.** This governs every surface this tenant
ships to a guest or to the owner: today the Expo app in `portofino-pizzeria/mobile`
(native and its web export).

## Source: the operator's v0 design (2026-09-14)

**This document was REPLACED on 2026-09-14.** Its earlier versions (v1 and the
v2 append) declared a system measured from a reference site — a brand red
`#db052c` used as a foreground colour, a cream `#fffdee` panel ground, and the
condensed League Gothic / Oswald headings over Jost. **The operator discarded
that direction** and supplied a design made in v0. Nothing from the earlier
versions carries forward unless it is restated below; the version history keeps
them.

The design is a Next.js + Tailwind page, checked in at
**`design/sources/portofino-pizzeria/`** in the mobile repo. That directory is the
authority on anything this document does not state. Its load-bearing files:

- `app/globals.css` — the colour tokens, the radius and the `.portofino-*`
  utilities;
- `components/header.tsx`, `hero.tsx`, `menu.tsx`, `about.tsx`, `contact.tsx`,
  `footer.tsx` — the composition;
- `public/portofino-pizza.png` — the hero photograph.

The values below are transcribed from those files, not re-chosen. The app's
token layer is `src/constants/theme.ts`; when it and this document disagree, this
document wins and the token file is the bug.

## Character

Warm, quiet, editorial. White ground, a single warm gold as the brand colour, a
cream band to lift sections, a classic serif for the wordmark and every heading,
a plain sans for everything read at length. Generous whitespace; hairline
dividers instead of boxes; one rounded photograph as the only large image.

## Palette

| Role | Value | Design source | Use |
|---|---|---|---|
| Gold (brand) | `#d4a574` | `--primary`, `--accent`, `--ring` | fills of the primary action, the active-tab rule, the cart badge, the wordmark |
| Gold, pressed | `#c49464` | `.portofino-button:hover` | the pressed state of a gold fill |
| Cream | `#f7f3ed` | `bg-[#f7f3ed]` (hero, contact) | full-bleed bands, the ground of round add buttons, panels |
| Ground | `#ffffff` | `--background` | the page |
| Ink | `#1a1a1a` | `--foreground` | body text, headings, **prices** |
| Muted | `#666666` | `--muted-foreground` | descriptions, secondary lines |
| Hairline | `#e5e5e5` | `--border` | dividers between menu rows, input borders |
| Footer | `#111827` | `bg-gray-900` | the footer band; its secondary text is `#9ca3af` |
| Destructive | `#dc2626` | `--destructive` | errors and destructive actions |

**The gold is a FILL and a MARK colour, not a text colour.** Prices are ink
(`menu.tsx`: `text-gray-800 font-semibold`), headings are ink (`text-gray-900`),
and only the wordmark, eyebrows and one hero word are gold in the design.

**The destructive red is now DECLARED.** Earlier versions left the alert treatment
`Declared UNKNOWN` because the brand red could not also mean error. With a gold
brand there is no collision: `#dc2626` means error or destructive, nothing else.

## The contrast rule — where the app departs from the design's literal CSS

Measured (WCAG 2.x relative luminance):

| Pair | Ratio | Verdict |
|---|---|---|
| white on gold `#d4a574` | **2.23:1** | fails AA at every size |
| ink `#1a1a1a` on gold | 7.82:1 | passes |
| gold text on white | 2.23:1 | fails |
| muted `#666666` on white / on cream | 5.74 / 5.19:1 | passes |
| destructive `#dc2626` on white | 4.83:1 | passes |
| `#9ca3af` on footer `#111827` | 6.99:1 | passes |

**DECLARATION — AA is the floor, and the design yields to it in exactly two
places:**

1. **A label on a gold fill is ink, not white.** The design's
   `--primary-foreground: #ffffff` fails at 2.23:1.
2. **Gold TEXT (eyebrows, the hero's accent word) uses `#826b4f`**, which is the
   design's own `--chart-2` brown `#8b7355` darkened along its hue to the first
   value that clears 4.5:1 on the cream band (4.56:1 there, 5.04:1 on white).

The **wordmark keeps the true gold**: a logotype has no contrast requirement.
Nothing else in the palette needs adjusting.

## Type

The design names no web font: headings are Tailwind's `font-serif` and body is
`font-sans`. **DECLARATION — use each platform's own serif and sans**, which is
what the design renders in a browser: `Georgia` on iOS, `serif` (Noto Serif) on
Android, `ui-serif, Georgia, Cambria, "Times New Roman", serif` on web; the system
sans likewise. Do not add a font package to "improve" this — choosing a face is a
decision the design did not make.

| Role | Face | Size / leading (phone) | Design source |
|---|---|---|---|
| Wordmark `PORTOFINO.` | serif, bold, gold; the full stop ink | 22–24 | `header.tsx` |
| Hero headline | serif | 48, tight (`leading-[0.95]`) | `hero.tsx` `text-5xl` |
| Section heading | serif, ink | 36 | `text-4xl` |
| Dish name | serif, ink | 20 | `text-xl` |
| Eyebrow | sans semibold, UPPERCASE, tracking 0.25em | 12 | `text-xs tracking-[0.25em]` |
| Body | sans | 16 / 28 | `text-base leading-7` |
| Description, secondary | sans, muted | 14 / 24 | `text-sm leading-6` |
| Price | sans semibold, ink | 14 | `text-sm font-semibold` |

**Android floor.** On Android a line height below the face's own ascent+descent
clips the tops of capitals and umlauts. Serif line heights there are at least
`ceil(size x 1.362)`; iOS and web keep the design's leading.

## Spacing

Tailwind's 4px ladder, using the steps the design uses: **4 / 8 / 12 / 16 / 20 /
24 / 32 / 40 / 48 / 64**. Screen side padding **20** (`px-5`); the hero band's
vertical padding **48** (`py-12`); a section's **64** on phones (`py-16`), 96 on
wide screens (`md:py-24`); menu rows
**20** apart (`py-5`). The content column caps at **896** (`max-w-4xl`); the hero
at 1152 (`max-w-6xl`).

## Shape

One radius, `--radius: 0.5rem` = **8**: buttons, inputs, panels. The hero
photograph is **32** (`rounded-[2rem]`). Round add buttons, badges and chips are
fully round. Nothing else is rounded.

## Composition

The guest home screen is the design's single page, in order:

1. **Header** — white, sticky, a hairline underneath; the wordmark; the guest's
   cart on the right once it holds something.
2. **Hero** — cream band; the rounded photograph (above the copy on phones,
   beside it on wide screens); eyebrow, the serif `Buon appetito.` with the
   second word in the gold text colour, one line of lead copy, and one gold
   primary button that takes the guest to the menu.
3. **Menu** — white; eyebrow `La nostra cucina` and a serif heading; a row of
   category tabs, underlined in gold when active; then the dishes as a
   **hairline-divided list, not cards**: serif name, muted description, and a
   price with a round cream add button (gold `+`, filling gold when pressed).
4. **About** and **Contact** bands (gold and cream) — see "Content the design
   carries that is not the tenant's" below.
5. **Footer** — dark band; gold wordmark; muted copyright line.

**This settles the home-screen fork the previous version left OPEN** (a rail of
specialities versus the menu itself): **the menu itself**, led by one hero. There
is no rail and nothing auto-advances.

Adaptations the app makes, because the design is a four-item mock and the app
carries the real card — declared so they are not re-litigated:

- **Tabs scroll, they do not filter.** The design's tabs switch a four-item list.
  The real menu has fourteen categories and a hundred-odd dishes, and filtering
  would unmount the add buttons of every other category. A tab scrolls to its
  section, the tab strip sticks under the header, and the active tab follows the
  reading position.
- **One add button per size.** A dish with several sizes or meat choices shows
  one `label · price` button per variant, each with its own round `+`: a size is
  a price, and one `+` cannot say which.
- **Dish number and allergens** stay in every row, muted — the design has no slot
  for them and they are not optional. The allergen legend is a cream band between
  the menu and the footer, in the About/Contact bands' position.
- **Cart bar.** Once the cart holds something, a gold bar pinned to the bottom
  shows the count and subtotal. It is the screen's one gold fill besides the hero
  button.
- **Owner surfaces** (kitchen, menu editor) use the same palette: gold fill for the
  primary action, destructive red for the dangerous one, never adjacent in
  meaning.
- **Payment buttons keep their providers' colours** (Stripe, PayPal).

## Content the design carries that is not the tenant's

The v0 page is a mock, and several of its sentences are **facts nobody has
confirmed**: an address (`Rüttenscheider Straße 123`), a phone number
(`0201 412 345`), opening hours (`Mo–So 12:00–23:00`), a founding year (`1987`),
`48h Teigruhe`, a stone oven, homemade pasta, an Instagram link.

**DECLARATION — the design governs layout and style; it is not a source of
restaurant facts.** None of those strings may ship. A section whose only content
is an unconfirmed fact is omitted until the fact is supplied, and the About and
Contact bands are omitted today for that reason. Real facts come from the menu
data and from the operator. The capture of the restaurant's own site in
`backend/data/menu.json` carries opening hours; its address and phone number are
still unverified.

## Light only

The design declares `color-scheme: light`. **DECLARATION — there is no dark
mode.** The app does not follow the system setting. A dark palette would be a new
decision, not a derived one.

## Motion

The design uses one duration: `transition-colors`, **150 ms**, on state changes
of controls. Scrolling to a section is the platform's own smooth scroll. **Nothing
auto-advances**, and there is no entrance or scroll-triggered animation.

## Declared UNKNOWN

- **The About and Contact bands' content** — which facts, once confirmed.
- **Wide-screen typography** — the design's `md:` sizes (`text-7xl` hero,
  `text-6xl` about heading) are not yet applied; phones set the scale.
- **The app icon and splash mark.** The design has only placeholder icons; the
  splash is plain white until a mark exists.
- **A status colour set** for the kitchen lanes (new / preparing / ready). The
  design has none; the app carries its shipped values.
