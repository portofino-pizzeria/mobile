// The legal notice (Impressum), § 5 DDG.
//
// Every owner fact on this page comes from `GET /api/shop` — the `legal`
// object plus the restaurant's address and phone. Nothing is filled in here:
// a fact the owner has not entered yet is shown as a marked gap, and when the
// API cannot be reached, or is too old to carry `legal`, the page says so and
// shows no facts at all rather than guessed ones.
//
// Deliberately absent: the EU online dispute resolution (OS) platform link
// (the platform closed on 20 July 2025, and the duty to link to it with it),
// and a V.i.S.d.P. / § 18 MStV line (a menu and ordering site is not
// journalistic or editorial content).

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorReason } from '@/lib/api';
import { openLink } from '@/lib/links';
import type { ShopInfo } from '@/lib/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'failed'; reason: string }
  | { kind: 'no-legal' }
  | { kind: 'ready'; shop: ShopInfo & { legal: NonNullable<ShopInfo['legal']> } };

/** The mark for a fact the owner has not entered yet. */
const GAP = 'wird ergänzt';

export default function ImpressumScreen() {
  const theme = useTheme();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const stateRef = useRef<LoadState>(state);

  const load = useCallback(async (): Promise<LoadState> => {
    setState({ kind: 'loading' });
    let next: LoadState;
    try {
      const shop = await api.getShop();
      next = shop.legal ? { kind: 'ready', shop: { ...shop, legal: shop.legal } } : { kind: 'no-legal' };
    } catch (e) {
      next = { kind: 'failed', reason: errorReason(e) };
    }
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  const describe = (s: LoadState) =>
    s.kind === 'ready'
      ? {
          state: 'ready',
          complete: s.shop.legal.complete,
          missing: s.shop.legal.missing,
          ownerName: s.shop.legal.ownerName,
          legalForm: s.shop.legal.legalForm,
          email: s.shop.legal.email,
        }
      : { state: s.kind, ...(s.kind === 'failed' ? { reason: s.reason } : {}) };

  useUIComponent({
    id: 'impressum',
    name: 'Impressum',
    actions: [
      {
        id: 'getImpressumStatus',
        label: 'Report what the legal notice shows',
        description:
          'No params. Returns { state: "loading" | "failed" | "no-legal" | "ready", ' +
          'complete?, missing?, ownerName?, legalForm?, email?, reason? }.',
        handler: async () => describe(stateRef.current),
      },
      {
        id: 'reload',
        label: 'Read the legal notice from the server again',
        description: 'No params. Returns the same shape as getImpressumStatus.',
        handler: async () => describe(await load()),
      },
    ],
  });

  if (state.kind === 'loading') {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  if (state.kind !== 'ready') {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.centerText}>
          Impressum
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {state.kind === 'failed'
            ? 'Das Impressum konnte gerade nicht geladen werden.'
            : 'Das Impressum ist auf dem Server noch nicht verfügbar.'}
        </ThemedText>
        {state.kind === 'failed' ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {state.reason}
          </ThemedText>
        ) : null}
        <BridgeButton
          uiId="impressum-retry"
          uiLabel="Erneut versuchen"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => void load()}>
          <ThemedText type="smallBold" themeColor="onBrand">
            Erneut versuchen
          </ThemedText>
        </BridgeButton>
      </ThemedView>
    );
  }

  const { shop } = state;
  const { legal } = shop;
  const hasRegister = Boolean(legal.registerCourt || legal.registerNumber);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle">Impressum</ThemedText>

        <Section title="Angaben gemäß § 5 DDG">
          <Line label="Inhaber" value={legal.ownerName} />
          <Line label="Rechtsform" value={legal.legalForm} />
          <ThemedText type="small">
            {shop.name}
            {'\n'}
            {shop.street}
            {'\n'}
            {shop.postalCode} {shop.city}
          </ThemedText>
        </Section>

        <Section title="Kontakt">
          <View style={styles.line}>
            <ThemedText type="small">Telefon: </ThemedText>
            <BridgeButton
              uiId="impressum-call"
              uiLabel={`Portofino anrufen: ${shop.phoneDisplay}`}
              role="link"
              style={styles.link}
              onPress={() => openLink(`tel:${shop.phoneE164}`)}>
              <ThemedText type="small" themeColor="brandText" style={styles.linkText}>
                {shop.phoneDisplay}
              </ThemedText>
            </BridgeButton>
          </View>
          {legal.email ? (
            <View style={styles.line}>
              <ThemedText type="small">E-Mail: </ThemedText>
              <BridgeButton
                uiId="impressum-email"
                uiLabel={`E-Mail an Portofino: ${legal.email}`}
                role="link"
                style={styles.link}
                onPress={() => openLink(`mailto:${legal.email}`)}>
                <ThemedText type="small" themeColor="brandText" style={styles.linkText}>
                  {legal.email}
                </ThemedText>
              </BridgeButton>
            </View>
          ) : (
            <Line label="E-Mail" value={null} />
          )}
        </Section>

        {legal.vatId ? (
          <Section title="Umsatzsteuer-ID">
            <ThemedText type="small">
              Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
              {'\n'}
              {legal.vatId}
            </ThemedText>
          </Section>
        ) : null}

        {hasRegister ? (
          <Section title="Handelsregister">
            {legal.registerCourt ? <Line label="Registergericht" value={legal.registerCourt} /> : null}
            {legal.registerNumber ? <Line label="Registernummer" value={legal.registerNumber} /> : null}
          </Section>
        ) : null}

        <Section title="Verbraucherstreitbeilegung">
          <ThemedText type="small">
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor
            einer Verbraucherschlichtungsstelle teilzunehmen.
          </ThemedText>
        </Section>

        <Section title="Lebensmittelinformationen">
          <ThemedText type="small">
            Angaben zu Allergenen und Zusatzstoffen finden Sie bei jedem Gericht in unserer
            Speisekarte. Fragen dazu beantworten wir Ihnen gern telefonisch.
          </ThemedText>
        </Section>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle} role="heading">
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

/** "Label: value", or "Label: wird ergänzt" in a marked style for a gap. */
function Line({ label, value }: { label: string; value: string | null | undefined }) {
  const theme = useTheme();
  return (
    <ThemedText type="small">
      {label}:{' '}
      {value ? (
        value
      ) : (
        <ThemedText type="small" style={[styles.gap, { color: theme.textSecondary }]}>
          {GAP}
        </ThemedText>
      )}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.xl,
  },
  centerText: { textAlign: 'center' },
  scroll: {
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { fontSize: 17 },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { textDecorationLine: 'underline' },
  gap: { fontStyle: 'italic' },
  primaryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: Spacing.sm,
  },
});
