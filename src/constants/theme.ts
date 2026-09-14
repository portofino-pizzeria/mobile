/**
 * Portofino's visual system, as declared by the tenant.
 *
 * SOURCE OF TRUTH: coord prompt document `domain_spec/visual-system`
 * (tenant `pizzeria`), which since 2026-09-14 declares the v0 design whose
 * source is checked in at `design/sources/portofino-pizzeria/` — its
 * `app/globals.css` tokens and the utilities its components use. Every value
 * below is transcribed from that design. When the spec and this file disagree,
 * the spec wins and this file is the bug.
 *
 * The one place this file departs from the design's literal CSS is contrast,
 * and the spec records that departure as its own rule: the design sets white
 * text on the gold (`--primary-foreground: #ffffff`), which measures 2.23:1 and
 * fails WCAG AA at every size. So a label on a gold fill is ink, not white.
 */

import { Platform } from 'react-native';

import '@/global.css';

/**
 * The v0 palette. Roles, not hexes, are what the rest of the app names.
 */
export const Brand = {
  /** `--primary` / `--accent` — the Portofino gold. Fills, rules, marks. */
  gold: '#d4a574',
  /** `.portofino-button:hover` — the pressed state of a gold fill. */
  goldPressed: '#c49464',
  /** `bg-[#f7f3ed]` — the warm cream of the hero and contact bands, and the
   *  ground of the round add buttons. */
  cream: '#f7f3ed',
  /** `--background` — the page ground. */
  ground: '#ffffff',
  /** `--foreground` — body text and headings. */
  ink: '#1a1a1a',
  /** `--muted-foreground` — descriptions and secondary text. 5.74:1 on white. */
  muted: '#666666',
  /** `--border` — hairlines between menu rows and around inputs. */
  border: '#e5e5e5',
  /** `bg-gray-900` — the footer. */
  footer: '#111827',
  /** `--destructive`. Declared by the design, so the alert colour is no
   *  longer undeclared. 4.83:1 on white. */
  destructive: '#dc2626',
} as const;

/**
 * One palette. The design is light-only — `color-scheme: light` in its CSS and
 * `colorScheme: 'light'` in its viewport — so the app no longer follows the
 * system dark mode.
 */
export const Colors = {
  text: Brand.ink,
  textSecondary: Brand.muted,
  background: Brand.ground,
  /** Panels and bands that lift off the page ground. */
  backgroundElement: Brand.cream,
  /** A pressed neutral control, and the hairline colour. */
  backgroundSelected: Brand.border,
  /** The gold, as a fill, a rule or a border — never as small text: gold on
   *  white is 2.23:1. */
  brand: Brand.gold,
  brandPressed: Brand.goldPressed,
  /**
   * The gold as TEXT — eyebrows and the hero's accent word, which the design
   * sets in `#d4a574`. That fails AA (2.23:1), so this is the design's own
   * `--chart-2` brown (`#8b7355`) darkened along its hue to the first value
   * that clears 4.5:1 on the cream band: 4.56:1 there, 5.04:1 on white. The
   * wordmark keeps the true gold — a logotype has no contrast requirement.
   */
  brandText: '#826b4f',
  /** Text ON a gold fill. Ink rather than the design's white — see the header. */
  onBrand: Brand.ink,
  /** A price. Ink, as in the design (`text-gray-800 font-semibold`). */
  priceText: Brand.ink,
  destructive: Brand.destructive,
  /** Text on a destructive fill. */
  onDestructive: '#ffffff',
  footer: Brand.footer,
  /** The footer's secondary text (`text-gray-400`). */
  onFooterMuted: '#9ca3af',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * The design's two families are Tailwind's defaults: `font-serif` for the
 * wordmark and every heading, `font-sans` for everything else. Neither names a
 * web font, so the app uses each platform's own serif and sans — what the
 * design renders in a browser — rather than choosing a face the design did not.
 */
export const Type = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  }),
} as const;

/**
 * Tailwind's 4px spacing ladder, the steps the design uses: `gap-1` 4, `gap-2`
 * 8, `gap-3` 12, `px-5` 20 (screen side padding), `gap-6` 24, `mt-8` 32,
 * `mb-10` 40, `py-12` 48 (the hero band), `py-16` 64 (section padding on
 * phones).
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** `px-5` — the screen's side padding. */
  gutter: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  /** `py-12` — the hero band's vertical padding. */
  band: 48,
  /** `py-16` — a section's vertical padding. */
  section: 64,
} as const;

/**
 * Radii from `--radius: 0.5rem`: buttons, inputs and panels are `rounded-lg`
 * (8), the hero photograph is `rounded-[2rem]` (32), and the round add buttons
 * are `rounded-full`.
 */
export const Radius = {
  card: 8,
  field: 8,
  image: 32,
  pill: 999,
} as const;

/** `transition-colors` — Tailwind's 150 ms. The one duration the design uses. */
export const Motion = {
  control: 150,
} as const;

/** `max-w-4xl` — the content column cap on wide screens (tablet, web). The
 *  kitchen board is a lane layout and does not cap. */
export const MaxContentWidth = 896;
