import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { extrasOffered } from '@/lib/extras';
import { formatEUR } from '@/lib/format';
import type { Menu, MenuItem, MenuVariant } from '@/lib/types';
import type { CartExtra } from '@/state/cart';

/**
 * The diner's ingredient picker for one dish: choose the size, tick the extras,
 * read the price move, add to the cart.
 *
 * The price shown on the button is the size's price plus every ticked extra
 * AT THAT SIZE — a Blech pays the Blech price for its cheese — and it is the
 * same sum the cart and the server compute. An extra with no price for the
 * chosen size is not listed at all: offering it would mean either charging an
 * invented price or letting the server refuse it at checkout.
 *
 * An extra carries allergens of its own (cheese is milk), so each row states
 * them in the same words the dish rows use.
 */
export function ExtrasSheet(props: {
  menu: Menu;
  /** The dish being configured; `null` hides the sheet. */
  item: MenuItem | null;
  allergenText: (codes: { allergenCodes: string[] }) => string;
  onClose: () => void;
  onAdd: (item: MenuItem, variant: MenuVariant, extras: CartExtra[]) => void;
}) {
  if (!props.item) return null;
  // Keyed by the dish, so every opening starts from its own fresh state.
  return <SheetBody key={props.item.id} {...props} item={props.item} />;
}

function SheetBody({
  menu,
  item,
  allergenText,
  onClose,
  onAdd,
}: {
  menu: Menu;
  item: MenuItem;
  allergenText: (codes: { allergenCodes: string[] }) => string;
  onClose: () => void;
  onAdd: (item: MenuItem, variant: MenuVariant, extras: CartExtra[]) => void;
}) {
  const theme = useTheme();
  // Opens on the dish's first size that takes extras, with nothing ticked.
  const [variantId, setVariantId] = useState<string | null>(
    () =>
      (item.variants.find((v) => extrasOffered(menu, item, v).length > 0) ?? item.variants[0])
        ?.id ?? null,
  );
  const [selected, setSelected] = useState<string[]>([]);

  const variant = item.variants.find((v) => v.id === variantId) ?? null;
  const offered = useMemo(
    () => (variant ? extrasOffered(menu, item, variant) : []),
    [menu, item, variant],
  );

  // In the menu's order, whatever order they were ticked in, so the cart line
  // and the kitchen card read the same way every time.
  const chosen: CartExtra[] = offered
    .filter((o) => selected.includes(o.extra.id))
    .map((o) => ({ id: o.extra.id, name: o.extra.name, price: o.price }));
  const unit = (variant?.price ?? 0) + chosen.reduce((sum, e) => sum + e.price, 0);

  /** Changing the size drops any ticked extra that size does not offer, so the
   *  total never includes something the diner can no longer see. */
  function chooseSize(next: MenuVariant) {
    const ids = new Set(extrasOffered(menu, item, next).map((o) => o.extra.id));
    setVariantId(next.id);
    setSelected((prev) => prev.filter((id) => ids.has(id)));
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <ThemedView style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.body}>
            <ThemedText type="eyebrow">Extra-Zutaten</ThemedText>
            <ThemedText type="subtitle">
              {item.number ? `${item.number}  ` : ''}
              {item.name}
            </ThemedText>

            {item.variants.length > 1 ? (
              <>
                <ThemedText type="smallBold">Größe</ThemedText>
                <View style={styles.chips} role="radiogroup">
                  {item.variants.map((v) => {
                    const active = v.id === variantId;
                    return (
                      <BridgeButton
                        key={v.id}
                        uiId={`extras-size-${v.id}`}
                        uiLabel={`Größe ${v.label}, ${formatEUR(v.price)}`}
                        role="radio"
                        aria-checked={active}
                        style={[
                          styles.chip,
                          {
                            borderColor: active ? theme.brandText : theme.backgroundSelected,
                            backgroundColor: active ? theme.backgroundElement : 'transparent',
                          },
                        ]}
                        onPress={() => chooseSize(v)}>
                        <ThemedText type={active ? 'smallBold' : 'small'}>
                          {v.label} · {formatEUR(v.price)}
                        </ThemedText>
                      </BridgeButton>
                    );
                  })}
                </View>
              </>
            ) : null}

            <ThemedText type="smallBold">Zutaten</ThemedText>
            {offered.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Für diese Größe gibt es keine Extra-Zutaten.
              </ThemedText>
            ) : (
              <View role="list">
                {offered.map(({ extra, price }) => {
                  const on = selected.includes(extra.id);
                  return (
                    <BridgeButton
                      key={extra.id}
                      uiId={`extras-toggle-${extra.id}`}
                      uiLabel={`${extra.name}, plus ${formatEUR(price)}${on ? ', ausgewählt' : ''}`}
                      role="checkbox"
                      aria-checked={on}
                      style={[styles.extraRow, { borderBottomColor: theme.backgroundSelected }]}
                      onPress={() => toggle(extra.id)}>
                      <View
                        style={[
                          styles.box,
                          {
                            borderColor: on ? theme.brand : theme.textSecondary,
                            backgroundColor: on ? theme.brand : 'transparent',
                          },
                        ]}>
                        {on ? (
                          <ThemedText type="smallBold" themeColor="onBrand" style={styles.tick}>
                            ✓
                          </ThemedText>
                        ) : null}
                      </View>
                      <View style={styles.extraInfo}>
                        <ThemedText type="small">{extra.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {allergenText(extra)}
                        </ThemedText>
                      </View>
                      <ThemedText type="price">+ {formatEUR(price)}</ThemedText>
                    </BridgeButton>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.backgroundSelected }]}>
            <BridgeButton
              uiId="extras-cancel"
              uiLabel="Abbrechen"
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
              onPress={onClose}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Abbrechen
              </ThemedText>
            </BridgeButton>
            <BridgeButton
              uiId="extras-add"
              uiLabel={`In den Warenkorb, ${formatEUR(unit)}`}
              disabled={!variant}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: pressed ? theme.brandPressed : theme.brand },
              ]}
              onPress={() => {
                if (!variant) return;
                onAdd(item, variant, chosen);
                onClose();
              }}>
              <ThemedText type="smallBold" themeColor="onBrand">
                In den Warenkorb · {formatEUR(unit)}
              </ThemedText>
            </BridgeButton>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '85%',
    borderTopLeftRadius: Radius.card * 2,
    borderTopRightRadius: Radius.card * 2,
    overflow: 'hidden',
  },
  body: { padding: Spacing.gutter, gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { lineHeight: 18 },
  extraInfo: { flex: 1, gap: Spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 44, justifyContent: 'center' },
  primaryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
    minHeight: 44,
    justifyContent: 'center',
  },
});
