/**
 * Portofino's visual system, as declared by the tenant.
 *
 * SOURCE OF TRUTH: coord prompt document `domain_spec/visual-system`
 * (tenant `pizzeria`, v2 — v1 declared the palette and the faces, the
 * 2026-09-11 append declared spacing, motion and card geometry; the working
 * copy of that append is `docs/intent-drafts/domain_spec--visual-system--APPEND.md`).
 * Every value below is transcribed from it — nothing here is a design
 * decision made in code. That document says of itself:
 *
 *   "Declared here because this tenant has no token package yet. The moment
 *    one exists, this section becomes a pointer to it and the values move
 *    out — a palette restated in two places diverges, and the code copy is
 *    the one that gets edited."
 *
 * This file is that token layer. When the spec and this file disagree, the
 * spec wins and this file is the bug.
 *
 * WHAT THE SPEC STILL LEAVES UNDECLARED — do not invent it here (see the
 * `Declared UNKNOWN` section of the document, as the v2 append leaves it):
 * the type scale, the ALERT TREATMENT, the neutral ramp, dark mode, and
 * density. The neutral and size values below are the ones this app already
 * shipped; they are carried forward unchanged rather than re-derived,
 * precisely so that nothing here reads as a decision the tenant has not made.
 * Spacing and card geometry WERE on that list until v2 declared them —
 * `Spacing` and `Radius` below are now transcriptions, not carry-overs.
 */

import '@/global.css';

/**
 * The brand palette. Roles, not hexes, are what the rest of the app names.
 *
 * The load-bearing property, quoted from the spec: "The red is predominantly a
 * FOREGROUND colour, and that is the distinctive choice. Of its 112
 * role-assigned uses on the reference, 78 are `color` and only 25 are a fill.
 * It is the colour of headings and prices, not primarily of buttons and bars.
 * A design that turns it into a background wash is not this palette used
 * differently — it is a different palette."
 *
 * So `brand` is a TEXT colour by default: headings, prices, and the outline of
 * a repeated control.
 *
 * WHERE A RED FILL IS ALLOWED — one rule, scoped by audience, because the
 * spec's semantic contract turns on what a hue "OBLIGES A READER TO DO" and
 * the two audiences are obliged to do different things:
 *
 * - GUEST surfaces (menu, cart, checkout, order) — the single primary action
 *   on the screen may be a red fill: the 25-of-112 case. There is no
 *   destructive control anywhere on these screens, so nothing competes.
 * - OWNER / STAFF surfaces (kitchen, admin) — NO red fill. Those screens
 *   already spend a red on "careful" (`alertUndeclared` / `DANGER`), and a
 *   second adjacent red for "go" would collapse the one distinction the
 *   contract insists on. The brand red appears there in headings and prices
 *   only; the primary action stays ink.
 *
 * This scoping is not in the spec, which does not yet reach controls. It is
 * the minimum rule that keeps the spec's own constraint true on both
 * audiences, and it is owed back to the operator alongside the alert
 * treatment.
 */
export const Brand = {
  /** Headings and prices. 153 occurrences on the reference — the dominant colour. */
  red: '#db052c',
  /** The measured darker variant, for hover and active states. */
  redPressed: '#ba0425',
  /** The page ground. The reference's `body` rule is `background:#fff`. */
  ground: '#ffffff',
  /** A warm cream for panels and bands that need to lift off white. NOT the page ground. */
  groundWarm: '#fffdee',
  /** Body text. */
  ink: '#000000',
} as const;

export const Colors = {
  light: {
    text: Brand.ink,
    background: Brand.ground,
    /** Cards and panels that lift off the page ground. */
    backgroundElement: Brand.groundWarm,
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    /** Headings and prices — the brand red as a foreground colour. */
    brand: Brand.red,
    /** Declared for "hover and active states". Read by every brand-red
     *  control while it is pressed — a red fill darkens to it, an outlined
     *  control's border darkens to it (with the ground lifting to
     *  `backgroundSelected`, since on a dark card a darker red alone reads as
     *  fading). Only the SURFACE moves: a pressed pill's label keeps its
     *  `priceText` colour, because in dark mode that role is ink for contrast
     *  and a pressed swap to this red would drop it below AA for the duration
     *  of the press. Hover on web is not wired — RN's `Pressable` style
     *  callback types only `pressed`. */
    brandPressed: Brand.redPressed,
    /** A price. Its own role, not an alias of `brand`, because the two schemes
     *  cannot answer the same way — see the dark entry below. */
    priceText: Brand.red,
    /** Text that sits ON a brand-red fill. */
    onBrand: '#ffffff',
    /**
     * UNDECLARED by `domain_spec/visual-system`, and knowingly so. The spec:
     * "The brand red is not the error colour ... Until then, alerts are
     * UNDECLARED, not 'use the brand red'." This is the value the app already
     * used, hoisted here so there is exactly one of it and so the gap is
     * visible rather than scattered. It reads adjacent to `brand` — which is
     * the reason the tenant owes this decision. Do not resolve it in code.
     */
    alertUndeclared: '#e5484d',
  },
  dark: {
    // Dark mode is `Declared UNKNOWN` in the spec ("Undeclared, not decided
    // against"), so these stay the values the app already shipped, with the
    // brand roles mapped to the one palette that IS declared.
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    brand: Brand.red,
    brandPressed: Brand.redPressed,
    onBrand: '#ffffff',
    /**
     * NOT the brand red, and this is an accessibility floor rather than a
     * design choice. `#db052c` on `#000000` measures **4.04:1** — below the
     * 4.5:1 WCAG AA threshold for the 14px text the `price` role renders. (On
     * white the same red is 5.20:1 and passes, which is why this shows up only
     * in dark mode.) Dark mode is `Declared UNKNOWN` in the spec, so inventing
     * a lightened red here would be authoring intent; the price keeps the ink
     * colour until the tenant declares a dark palette. Headings are unaffected
     * — `subtitle` is 32px and clears the 3:1 large-text threshold.
     */
    priceText: '#ffffff',
    alertUndeclared: '#e5484d',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * The type system's SHAPE, quoted from the spec, "which matters more than the
 * specific faces: tall condensed sans for headings, a geometric sans for
 * anything a guest has to read carefully, and a script reserved for warmth."
 *
 * - `display` — the condensed heading role. The spec names `League Gothic`
 *   and `Oswald` for it. Both are loaded: League Gothic carries the large
 *   section headings (one weight, display use), Oswald carries the smaller
 *   headings and labels where the app's existing weight contrast is doing
 *   work. Choosing between them by size rather than adding a size scale keeps
 *   this inside the declaration.
 * - `text` — Jost, the spec's substitution for the reference's commercial
 *   NeutraText. "It sets text at length, which is what this role is for."
 * - The script (`Playwrite TZ`) and retro display (`Bungee Inline`) faces are
 *   declared but NOT loaded here: no surface in this app has a warmth accent
 *   to carry, and the spec forbids the script on "anything carrying a price, a
 *   time or an allergen" — which is most of what this app renders. Giving one
 *   a job would be authoring intent. See GAPS in the plan.
 */
export const Type = {
  /** Large condensed section headings. */
  display: 'LeagueGothic_400Regular',
  /** Condensed headings/labels that need weight. */
  displayBold: 'Oswald_600SemiBold',
  /** Body copy — anything a guest has to read carefully. */
  text: 'Jost_400Regular',
  textMedium: 'Jost_500Medium',
  textBold: 'Jost_600SemiBold',
} as const;

/**
 * The spacing ladder, declared by the v2 append: "4 / 8 / 12 / 16 / 24 / 32 /
 * 48, on a 4px base ... Section separation 48; screen side padding 16 on
 * phones. The ladder is the declaration — a value off it is a bug, not a
 * judgement call."
 *
 * Keyed by step rather than by value so that a value off the ladder has no
 * name to be reached by. The two values the app used to carry that are NOT on
 * it — a 2px gap and a 64px end-of-list spacer — were moved to the nearest
 * step (4 and 48) rather than kept under a name of their own.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Section separation. */
  xxxl: 48,
} as const;

/**
 * Card geometry, from the same append: "One radius token for content cards,
 * one for pills, nothing in between." The reference's own radii cluster at 0
 * (Foundation's default, so not a choice), circles and pills — roundness is
 * reserved for avatars and buttons.
 *
 * `card` keeps the 16 the app already shipped; the append declares the SHAPE
 * of the system (two tokens) and not the card value, so that value is a
 * carry-over rather than a transcription. Rectangular buttons share it.
 *
 * `field` is NOT one of the two declared tokens. A text input is neither a
 * content card nor a pill, so the declaration does not reach it, and the 8 the
 * app already shipped is carried forward under its own name rather than
 * silently reshaped to the card radius or hidden inside a spacing step. It is
 * a carry-over, and it is the one radius the tenant has not spoken to.
 */
export const Radius = {
  card: 16,
  pill: 999,
  field: 8,
} as const;

/**
 * Motion, declared by the v2 append: "150 ms for a state change on a control,
 * 250 ms for a transition that moves content, 400 ms ceiling. Ease-out for
 * entrances, ease-in-out for movement." Plus two rules with no number to hold:
 * nothing auto-advances, and every animation over 150 ms honours
 * `prefers-reduced-motion: reduce` by becoming an instant state change.
 *
 * One consumer today, and it is a KNOWN violation rather than a transcription:
 * the template splash overlay (`components/animated-icon.tsx`) runs 600 ms,
 * over the ceiling. It is not retimed here because it is the Expo template's
 * splash, and the plan's S6 says it needs a mark before it needs a timing.
 */
export const Motion = {
  /** A state change on a control. */
  control: 150,
  /** A transition that moves content. */
  move: 250,
  /** No animation runs longer than this. */
  ceiling: 400,
} as const;

/** Content column cap on wide screens (tablet, web) for the guest screens; the kitchen board is a lane layout and does not cap. */
export const MaxContentWidth = 800;
