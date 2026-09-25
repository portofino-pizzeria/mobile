import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deliveryFeeFor } from '@/lib/fees';
import { formatEUR } from '@/lib/format';
import type { Fulfilment, OrderLine } from '@/lib/types';
import { cartLineKey, type CartLine } from '@/state/cart';

/**
 * What the diner is buying, and what it adds up to.
 *
 * ONE COMPONENT FOR BOTH SCREENS, deliberately. The cart and the checkout both
 * have to state the same arithmetic, and a concept explained in two places is
 * a concept that will end up explained two different ways [policy:
 * ux-priorities `a-control-belongs-with-what-it-governs`, "THE DUPLICATION IS
 * THE TELL"]. The cart screen keeps its own per-line steppers — those are
 * controls, not a summary — and shares everything below.
 *
 * NEITHER TOTAL HERE IS AUTHORITATIVE. `totalsFor` computes from the menu the
 * device last loaded and from `deliveryFeeFor`, which only MIRRORS the
 * server's fee. The authoritative figures come back from `createOrder`, and
 * `checkout.tsx` will not start a payment that disagrees with them — that
 * check, not two renders of one client computation agreeing, is what makes
 * showing a number here honest.
 */
export interface Totals {
  subtotal: number;
  deliveryFee: number;
  total: number;
}

/**
 * One line as this summary draws it, from whichever side priced it.
 *
 * The two sources are the CART, which the device priced from the menu it last
 * loaded, and an ORDER, which the server priced. When they disagree the
 * screen must not mix them: per-line prices from one side under a
 * Zwischensumme from the other is a panel that contradicts itself, and the
 * diner has no way to tell which half is the real one.
 */
export interface SummaryLine {
  key: string;
  name: string;
  number?: string;
  unitPrice: number;
  quantity: number;
}

/** The cart's own lines. */
export function cartSummaryLines(lines: readonly CartLine[]): SummaryLine[] {
  return lines.map(({ item, variant, quantity }) => ({
    key: cartLineKey(item.id, variant.id),
    name: `${item.name}, ${variant.label}`,
    number: item.number,
    unitPrice: variant.price,
    quantity,
  }));
}

/**
 * A placed order's lines, as the server priced them. The order carries no
 * dish numbers, so those are looked up in the cart the order was placed from
 * — a number is the menu's label for the dish and does not change with price.
 */
export function orderSummaryLines(
  lines: readonly OrderLine[],
  from: readonly CartLine[],
): SummaryLine[] {
  const numbers = new Map(
    from.map(({ item, variant }) => [cartLineKey(item.id, variant.id), item.number]),
  );
  return lines.map((l) => ({
    key: cartLineKey(l.menuItemId, l.variantId),
    name: `${l.name}, ${l.variantLabel}`,
    number: numbers.get(cartLineKey(l.menuItemId, l.variantId)),
    unitPrice: l.unitPrice,
    quantity: l.quantity,
  }));
}

/** What this device believes an order of `subtotal` costs to receive. */
export function totalsFor(subtotal: number, fulfilment: Fulfilment): Totals {
  const deliveryFee = deliveryFeeFor(fulfilment);
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

/**
 * The secondary line of an order line: the dish's ordering number, and the
 * unit price.
 *
 * The NUMBER is kept off the quantity line on purpose: beside it, "1 × 1 Pizza
 * Margherita" puts two bare numerals over two different domains and the reader
 * cannot tell which is which [policy: ux-priorities
 * `a-label-names-one-referent-and-a-quantity-names-its-unit`]. Here it carries
 * its own label.
 *
 * `unitPrice` is the caller's, because the two screens legitimately differ:
 * the cart always shows it, since its stepper changes the quantity and the
 * per-unit price is what the diner is deciding about; the checkout omits it at
 * quantity 1, where the line total already is it. One rule, stated once, with
 * the difference passed in rather than written out twice.
 */
export function lineMeta(
  number: string | undefined,
  price: number,
  options: { unitPrice: boolean },
): string {
  return [number ? `Nr. ${number}` : null, options.unitPrice ? `${formatEUR(price)} pro Stück` : null]
    .filter(Boolean)
    .join(' · ');
}

/** One label/value line of the totals block. */
function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type={bold ? 'smallBold' : 'small'} themeColor={bold ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
      {/* Weight, not hue, marks the total — prices are ink in the design. */}
      <ThemedText type={bold ? 'price' : 'small'} themeColor={bold ? 'text' : 'textSecondary'}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Zwischensumme, the fulfilment fee, and the total — the composition of
 *  whatever number a pay button is about to charge. */
export function OrderTotals({ totals, fulfilment }: { totals: Totals; fulfilment: Fulfilment }) {
  return (
    <>
      <SummaryRow label="Zwischensumme" value={formatEUR(totals.subtotal)} />
      <SummaryRow
        label={fulfilment === 'pickup' ? 'Abholung' : 'Lieferung'}
        value={formatEUR(totals.deliveryFee)}
      />
      <SummaryRow label="Gesamt" value={formatEUR(totals.total)} bold />
    </>
  );
}

/**
 * The order's lines, read-only: quantity, what it is, and what that line costs.
 *
 * The checkout screen's job is to take payment, and a pay button whose subject
 * is on a different screen splits the control from what it governs. This is
 * that subject, rendered without controls so it cannot be mistaken for the
 * cart's editable list.
 */
export function OrderLines({ lines }: { lines: readonly SummaryLine[] }) {
  return (
    // `role="list"` and `role="listitem"` rather than `accessible` alone:
    // react-native-web's View forwards props through an allow-list that does
    // not include `accessible`, so on web the grouping would silently not
    // happen and each line would still be announced as four unrelated stops. A
    // bare div cannot be named by `aria-label` either — `generic` does not
    // support naming from author — so the role is what makes the label real.
    // `aria-hidden` on the leaves stops them being announced twice.
    <View role="list">
      {lines.map(({ key, name, number, unitPrice, quantity }) => {
        const meta = lineMeta(number, unitPrice, { unitPrice: quantity > 1 });
        return (
          <View
            key={key}
            role="listitem"
            accessible
            aria-label={[`${quantity} mal`, name, meta, formatEUR(unitPrice * quantity)]
              .filter(Boolean)
              .join(', ')}
            style={styles.line}>
            {/* The quantity is a quantity, so it names its unit: "2 ×". */}
            <ThemedText aria-hidden type="smallBold" style={styles.quantity}>
              {quantity} ×
            </ThemedText>
            <View aria-hidden style={styles.lineInfo}>
              <ThemedText type="small">{name}</ThemedText>
              {/* Rendered only when it says something. An unnumbered dish at
                  quantity 1 leaves both halves empty, and an empty `Text`
                  still reserves its `lineHeight` on Android, so the row would
                  stand taller than its numbered neighbours. */}
              {meta ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {meta}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText aria-hidden type="price" style={styles.lineTotal}>
              {formatEUR(unitPrice * quantity)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  // No rule between lines: a hairline in `backgroundSelected` measures 1.14:1
  // on the cream panel, which is a divider nobody can see. The padding does
  // the separating.
  line: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.md, gap: Spacing.sm },
  // Wide enough for "10 ×" so the dish names start on one column.
  quantity: { minWidth: 34 },
  lineInfo: { flex: 1, gap: Spacing.xs },
  // Wide enough for a three-digit total, right-aligned so the prices line up.
  lineTotal: { minWidth: 72, textAlign: 'right' },
});
