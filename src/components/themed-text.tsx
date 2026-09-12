import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Text roles, faced per `domain_spec/visual-system`: a tall condensed sans for
 * headings, a geometric sans (Jost) for anything a guest has to read
 * carefully. The SIZES are the ones this app already shipped — the spec lists
 * the type scale under `Declared UNKNOWN`, so nothing here invents one.
 *
 * `price` is a role rather than a colour applied at each call site, because
 * the spec makes the brand red "the colour of headings and prices" and a rule
 * restated in twelve places stops being a rule.
 *
 * SOME VALUES BELOW ARE NOT THE TENANT'S, and are marked `OPTICAL` where they
 * appear: the condensed faces need one step more size than the geometric ones
 * to sit beside them, and the spec files exactly that under `Declared UNKNOWN`
 * — "a condensed heading face and a geometric text face need different optical
 * sizing to sit together." These are the smallest adjustments that let the
 * DECLARED faces render, and they are owed back to the operator as a type-scale
 * decision. They must not be read as the tenant having chosen a scale.
 *
 * EVERY `lineHeight` HERE IS A FLOOR, NOT A TASTE. On Android, a `lineHeight`
 * shorter than the face's own ascent+descent does not tighten the line — RN's
 * `CustomLineHeightSpan` truncates the ascent instead, and the tops of tall
 * glyphs are shaved off. iOS overlaps lines rather than clipping, so it never
 * reproduces in the simulator.
 *
 * Scope of what was actually observed, so the next reader does not over- or
 * under-trust this: with `heading` at the old 22 (= 1.294 em, under the face),
 * "Hühnersuppe (scharf)" rendered with its diaeresis INTACT on a Pixel 7 API
 * 34 — lowercase umlauts and b/h/k/t ascenders fit inside the truncated
 * ascent. The margin is what is gone, not the glyph: a CAPITAL Ä/Ö/Ü reaches
 * 1.042 em, which at 17px is 17.7px of ink against 17.1px of available ascent.
 * No dish name in the current menu is capitalised that way — but the owner
 * types dish names into the editor, so the content is not fixed and the floor
 * is what makes it safe. Restoring a value below the ratio is a regression
 * even though today's menu would not show it.
 *
 * Measured from the shipped TTFs (`hhea` ascender − descender ÷ unitsPerEm):
 *
 *     Oswald_600SemiBold   1.482 em
 *     Jost_*               1.445 em
 *     LeagueGothic_400     1.200 em
 *
 * So `lineHeight >= ceil(fontSize x that ratio)` for every role below. Change a
 * `fontSize` and you must re-derive its `lineHeight`.
 */
export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'small'
    | 'smallBold'
    | 'price';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // Headings and prices carry the brand red unless the call site says
  // otherwise; everything else defaults to ink.
  const defaultColor: ThemeColor =
    type === 'price' ? 'priceText' : type === 'title' || type === 'subtitle' ? 'brand' : 'text';

  return (
    <Text
      style={[
        { color: theme[themeColor ?? defaultColor] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'heading' && styles.heading,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'price' && styles.price,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // --- condensed display role (League Gothic / Oswald) ---------------------
  title: {
    fontFamily: Type.display,
    fontSize: 48,
    lineHeight: 58, // floor: ceil(48 x 1.200) = 58
  },
  subtitle: {
    fontFamily: Type.display,
    fontSize: 32,
    lineHeight: 40, // floor: ceil(32 x 1.200) = 39; 40 leaves one px of air
    letterSpacing: 0.5, // OPTICAL
  },
  /** A smaller condensed heading — a dish name, a card title. */
  heading: {
    fontFamily: Type.displayBold,
    fontSize: 17, // OPTICAL — a condensed face reads ~1 step smaller than Jost at the same size.
    lineHeight: 26, // floor: ceil(17 x 1.482) = 26 (was 22, i.e. 1.294 em — under the face)
    letterSpacing: 0.2, // OPTICAL
  },

  // --- geometric text role (Jost) ------------------------------------------
  default: {
    fontFamily: Type.textMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: Type.text,
    fontSize: 14,
    lineHeight: 21, // floor: ceil(14 x 1.445) = 21
  },
  smallBold: {
    fontFamily: Type.textBold,
    fontSize: 14,
    lineHeight: 21, // floor: ceil(14 x 1.445) = 21
  },
  /** A price. Jost, not the condensed face: a guest reads these carefully. */
  price: {
    fontFamily: Type.textBold,
    fontSize: 14,
    lineHeight: 21, // floor: ceil(14 x 1.445) = 21
  },
});
