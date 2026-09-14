import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Text roles from the v0 design (`domain_spec/visual-system`): the serif for
 * the wordmark and every heading, the sans for everything a guest reads. Sizes
 * are the design's Tailwind classes at phone width.
 *
 * EVERY SERIF `lineHeight` ON ANDROID IS A FLOOR, NOT A TASTE. On Android a
 * `lineHeight` shorter than the face's own ascent+descent does not tighten the
 * line — RN's `CustomLineHeightSpan` truncates the ascent, shaving the tops off
 * capitals and umlauts (Ä, Ö, Ü in dish names the owner types). Android's
 * `serif` is Noto Serif at 1.362 em, so its line heights are
 * `ceil(fontSize x 1.362)`; iOS and web overlap rather than clip, so they keep
 * the design's tighter leading.
 */
export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'eyebrow'
    | 'small'
    | 'smallBold'
    | 'price';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  const defaultColor: ThemeColor =
    type === 'price'
      ? 'priceText'
      : type === 'eyebrow'
        ? 'brandText'
        : 'text';

  return (
    <Text
      style={[
        { color: theme[themeColor ?? defaultColor] },
        styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

/** Serif line height: the design's leading, raised to the Android floor. */
function serifLine(fontSize: number, leading: number): number {
  return Platform.OS === 'android' ? Math.ceil(fontSize * 1.362) : Math.round(fontSize * leading);
}

const styles = StyleSheet.create({
  // --- serif (`font-serif`) -------------------------------------------------
  /** The hero headline — `text-5xl leading-[0.95] tracking-tight`. */
  title: {
    fontFamily: Type.serif,
    fontSize: 48,
    lineHeight: serifLine(48, 1.05),
    letterSpacing: -0.5,
  },
  /** A section heading — `text-4xl`. */
  subtitle: {
    fontFamily: Type.serif,
    fontSize: 36,
    lineHeight: serifLine(36, 1.2),
  },
  /** A dish name or card title — `text-xl`. */
  heading: {
    fontFamily: Type.serif,
    fontSize: 20,
    lineHeight: serifLine(20, 1.4),
  },

  // --- sans (`font-sans`) ---------------------------------------------------
  /** The small tracked capital above a heading — `text-xs font-semibold
   *  uppercase tracking-[0.25em]`. */
  eyebrow: {
    fontFamily: Type.sans,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  /** Body copy — `text-base leading-7`. */
  default: {
    fontFamily: Type.sans,
    fontSize: 16,
    lineHeight: 28,
  },
  /** Descriptions and secondary lines — `text-sm leading-6`. */
  small: {
    fontFamily: Type.sans,
    fontSize: 14,
    lineHeight: 24,
  },
  smallBold: {
    fontFamily: Type.sans,
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '600',
  },
  /** A price — `text-sm font-semibold`. */
  price: {
    fontFamily: Type.sans,
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '600',
  },
});
