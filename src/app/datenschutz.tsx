// The privacy policy (Datenschutzerklärung), Art. 13 DSGVO.
//
// Unlike `impressum.tsx`, this page does NOT gate its whole body on
// `shop.legal` being present. Retention periods, data-subject rights, the
// recipients and the supervisory authority are all facts of the app itself,
// not facts of one restaurant, and hiding them behind a four-state loading
// machine would make them unreachable exactly when `/api/shop` is down or the
// owner's legal facts are still missing — i.e. right now. So the page renders
// its full static text unconditionally, and degrades only the Verantwortlicher
// block (the controller's identity), which is the one section this app cannot
// state without the owner's facts.
//
// This is not legal advice. It is the mechanics — a page that renders text
// from the repository, with retention periods as config values and an erasure
// endpoint that does not care what article is cited — plus a German draft for
// a lawyer or the owner's tax advisor to review.
//
// Deliberately left out for now: the § 25 TDDDG sentence about "Angaben
// merken" (plan 2026-09-20-portofino-privacy-policy-and-the-data-it-describes,
// D2 §2 and its BLOCKER note). The served `domain_spec/menu` still declares the
// pre-D3 (wrong) default, and correcting it needs a pizzeria-bound credential
// this session does not hold. Until that append lands, this page states the
// data categories from D2 §2 without the device-storage legal-basis paragraph.

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
  | { kind: 'ready'; shop: ShopInfo };

/** The mark for a fact the owner has not entered yet, or a value this page
 *  cannot show right now — the same marker `impressum.tsx` uses. */
const GAP = 'wird ergänzt';

/** D4's periods. Config values on the server (`src/config.ts`), not facts of
 *  any one restaurant, so they are stated here rather than fetched — there is
 *  no route that serves them and the defaults are what the shipped retention
 *  sweep and log serializer actually enforce. */
const RETENTION = {
  contactMonths: 6,
  orderYears: 10,
  logDays: 14,
};

/** Updated with the text — D1. */
const STAND = '24. September 2026';

export default function DatenschutzScreen() {
  const theme = useTheme();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const stateRef = useRef<LoadState>(state);

  const load = useCallback(async (): Promise<LoadState> => {
    setState({ kind: 'loading' });
    let next: LoadState;
    try {
      next = { kind: 'ready', shop: await api.getShop() };
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

  const describe = (s: LoadState) => ({
    state: s.kind,
    controllerKnown: s.kind === 'ready' && Boolean(s.shop.legal?.ownerName && s.shop.legal.email),
    ...(s.kind === 'failed' ? { reason: s.reason } : {}),
  });

  useUIComponent({
    id: 'datenschutz',
    name: 'Datenschutz',
    actions: [
      {
        id: 'getDatenschutzStatus',
        label: 'Report what the privacy policy page shows',
        description:
          'No params. Returns { state: "loading" | "failed" | "ready", controllerKnown, reason? }. ' +
          'The page body renders unconditionally once loading finishes; only the ' +
          'Verantwortlicher block depends on controllerKnown.',
        handler: async () => describe(stateRef.current),
      },
      {
        id: 'reload',
        label: 'Read the shop facts for the Verantwortlicher block again',
        description: 'No params. Returns the same shape as getDatenschutzStatus.',
        handler: async () => describe(await load()),
      },
    ],
  });

  const legal = state.kind === 'ready' ? state.shop.legal : undefined;
  const shop = state.kind === 'ready' ? state.shop : undefined;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle">Datenschutzerklärung</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Stand: {STAND}
        </ThemedText>

        <Section title="1. Verantwortlicher">
          {state.kind === 'loading' ? (
            <ActivityIndicator color={theme.brand} />
          ) : shop ? (
            <>
              <Line label="Inhaber" value={legal?.ownerName ?? null} />
              <Line label="Rechtsform" value={legal?.legalForm ?? null} />
              <ThemedText type="small">
                {shop.name}
                {'\n'}
                {shop.street}
                {'\n'}
                {shop.postalCode} {shop.city}
              </ThemedText>
              <View style={styles.line}>
                <ThemedText type="small">Telefon: </ThemedText>
                <BridgeButton
                  uiId="datenschutz-call"
                  uiLabel={`Portofino anrufen: ${shop.phoneDisplay}`}
                  role="link"
                  style={styles.link}
                  onPress={() => openLink(`tel:${shop.phoneE164}`)}>
                  <ThemedText type="small" themeColor="brandText" style={styles.linkText}>
                    {shop.phoneDisplay}
                  </ThemedText>
                </BridgeButton>
              </View>
              {legal?.email ? (
                <View style={styles.line}>
                  <ThemedText type="small">E-Mail: </ThemedText>
                  <BridgeButton
                    uiId="datenschutz-email"
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
            </>
          ) : (
            <>
              <ThemedText type="small" style={[styles.gap, { color: theme.textSecondary }]}>
                {GAP} — die Angaben zum Verantwortlichen konnten gerade nicht geladen werden.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.kind === 'failed' ? state.reason : ''}
              </ThemedText>
              <BridgeButton
                uiId="datenschutz-retry"
                uiLabel="Erneut versuchen"
                style={({ pressed }) => [
                  styles.retryBtn,
                  { backgroundColor: pressed ? theme.brandPressed : theme.brand },
                ]}
                onPress={() => void load()}>
                <ThemedText type="smallBold" themeColor="onBrand">
                  Erneut versuchen
                </ThemedText>
              </BridgeButton>
            </>
          )}
        </Section>

        <Section title="2. Welche Daten wir verarbeiten, wofür und auf welcher Rechtsgrundlage">
          <ThemedText type="small">
            Bei einer Bestellung verarbeiten wir Name, Telefonnummer, bei einer Lieferung die
            Adresse, und optional eine Notiz, um deine Bestellung entgegenzunehmen und
            auszuliefern (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO).
          </ThemedText>
          <ThemedText type="small">
            Die Zahlung wickeln wir über unseren Zahlungsdienstleister Stripe ab; dazu übermitteln
            wir die Bestellsumme und eine Bestellnummer (ebenfalls Vertragserfüllung, Art. 6 Abs. 1
            lit. b DSGVO).
          </ThemedText>
          <ThemedText type="small">
            Name und Bestelldaten bewahren wir zur Erfüllung steuer- und handelsrechtlicher
            Aufbewahrungspflichten auf (§ 147 AO, § 257 HGB; rechtliche Verpflichtung, Art. 6 Abs. 1
            lit. c DSGVO).
          </ThemedText>
          <ThemedText type="small">
            Server-Protokolle (u. a. IP-Adresse) verarbeiten wir, um den Betrieb und die Sicherheit
            unseres Dienstes zu gewährleisten (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO).
            IP-Adressen werden nur bei fehlgeschlagenen Anfragen protokolliert.
          </ThemedText>
        </Section>

        <Section title="3. Empfänger">
          <ThemedText type="small">
            Stripe (Zahlungsabwicklung) und Amazon Web Services (Hosting, Frankfurt). Darüber
            hinaus geben wir deine Daten an niemanden weiter.
          </ThemedText>
        </Section>

        <Section title="4. Übermittlung in Drittländer">
          <ThemedText type="small">
            Stripe verarbeitet Zahlungsdaten teilweise in den USA.{' '}
            <ThemedText type="small" style={[styles.gap, { color: theme.textSecondary }]}>
              {GAP}
            </ThemedText>{' '}
            (die genaue Rechtsgrundlage für diese Übermittlung, z. B. EU-Standardvertragsklauseln,
            wird vom Betreiber bestätigt).
          </ThemedText>
        </Section>

        <Section title="5. Speicherdauer">
          <ThemedText type="small">
            Telefonnummer, Adresse und eine Bestellnotiz löschen wir {RETENTION.contactMonths}{' '}
            Monate nach der Bestellung automatisch. Name, Bestellung und Rechnungsdaten bewahren
            wir {RETENTION.orderYears} Jahre lang auf (steuer- und handelsrechtliche
            Aufbewahrungspflicht). Gelöschte Daten können bis zu 7 Tage lang noch in einer
            automatischen Datenbank-Sicherung enthalten sein. Server-Protokolle bewahren wir{' '}
            {RETENTION.logDays} Tage lang auf.
          </ThemedText>
        </Section>

        <Section title="6. Deine Rechte">
          <ThemedText type="small">
            Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art.
            17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
            Widerspruch (Art. 21). Wende dich dazu telefonisch oder per E-Mail an uns — die
            Kontaktdaten findest du im{' '}
            <ThemedText type="small" themeColor="brandText">
              Impressum
            </ThemedText>
            .
          </ThemedText>
        </Section>

        <Section title="7. Beschwerderecht">
          <ThemedText type="small">
            Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig für uns
            ist die Landesbeauftragte für Datenschutz und Informationsfreiheit
            Nordrhein-Westfalen (LDI NRW), Kavalleriestr. 2-4, 40213 Düsseldorf.
          </ThemedText>
        </Section>

        <Section title="8. Keine Profilbildung, kein Tracking">
          <ThemedText type="small">
            Wir betreiben kein Tracking, keine Werbung und keine Profilbildung. Es gibt keine
            Analyse-Software, keine Werbe-SDKs und keine Cookies außer den technisch notwendigen
            Angaben, die du selbst in der App speicherst.
          </ThemedText>
        </Section>

        <Section title="9. Bereitstellung der Daten">
          <ThemedText type="small">
            Die Angabe von Name, Telefonnummer und, bei einer Lieferung, der Adresse ist für die
            Ausführung deiner Bestellung erforderlich. Ohne diese Angaben können wir deine
            Bestellung nicht bearbeiten.
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
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
});
