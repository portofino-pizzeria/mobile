// Terms of sale (AGB) and the withdrawal notice for online orders.
//
// Every sentence here describes what the ordering flow ACTUALLY does today, so
// it must move with the code it describes:
// - the delivery fee is read from `DELIVERY_FEE_CENTS` (lib/fees.ts), which
//   mirrors the backend's `config.deliveryFeeCents`;
// - there is no minimum order; the delivery area is the owner's postcode list
//   (`deliveryPostcodes`, enforced by the order route), named here when set;
// - cancelling an order on /kitchen does NOT refund it: the owner refunds in
//   the Stripe dashboard. The refund promised below is the owner's to keep.
// The shop's identity (name, address, phone) comes from `GET /api/shop` like
// the Impressum; while it cannot be read the page points at the Impressum
// instead of showing guessed facts.
//
// The payment methods named in section 5 must match what is enabled in the
// owner's Stripe dashboard (Settings -> Payment methods); change both together.
//
// The withdrawal exclusion covers prepared food only (§ 312g Abs. 2 Nr. 1 und
// 2 BGB). The menu carries no alcohol, so no age-check clause is needed; add
// one before any is sold.

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useShop } from '@/hooks/use-shop';
import { DELIVERY_FEE_CENTS } from '@/lib/fees';
import { formatEUR } from '@/lib/format';
import { openLink } from '@/lib/links';

/** The date these terms were last changed. Update it with every wording change. */
const STAND = 'Oktober 2026';

export default function AgbScreen() {
  const router = useRouter();
  const { shop } = useShop();
  const fee = formatEUR(DELIVERY_FEE_CENTS);

  const impressumLink = (
    <BridgeButton
      uiId="agb-impressum"
      uiLabel="Impressum"
      role="link"
      style={styles.link}
      onPress={() => router.push('/impressum')}>
      <ThemedText type="small" themeColor="brandText" style={styles.linkText}>
        Impressum
      </ThemedText>
    </BridgeButton>
  );

  const phoneLink = shop ? (
    <BridgeButton
      uiId="agb-call"
      uiLabel={`Portofino anrufen: ${shop.phoneDisplay}`}
      role="link"
      style={styles.link}
      onPress={() => openLink(`tel:${shop.phoneE164}`)}>
      <ThemedText type="small" themeColor="brandText" style={styles.linkText}>
        {shop.phoneDisplay}
      </ThemedText>
    </BridgeButton>
  ) : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle">AGB & Widerruf</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Allgemeine Geschäftsbedingungen für Bestellungen über unsere Website und App. Stand:{' '}
          {STAND}.
        </ThemedText>

        <Section title="1. Anbieter">
          {shop && shop.legal?.ownerName ? (
            <ThemedText type="small">
              {shop.name},{' '}
              {shop.legal.legalForm
                ? `${shop.legal.ownerName} (${shop.legal.legalForm})`
                : `Inhaber ${shop.legal.ownerName}`}
              {'\n'}
              {shop.street}, {shop.postalCode} {shop.city}
            </ThemedText>
          ) : null}
          <View style={styles.line}>
            <ThemedText type="small">Alle Angaben zum Anbieter findest du im </ThemedText>
            {impressumLink}
            <ThemedText type="small">.</ThemedText>
          </View>
        </Section>

        <Section title="2. Bestellung und Vertragsschluss">
          <ThemedText type="small">
            Du wählst Gerichte aus der Speisekarte, legst sie in den Warenkorb und gibst an der
            Kasse an, ob du liefern lässt oder abholst, sowie deinen Namen, deine Telefonnummer
            und gegebenenfalls deine Lieferadresse. Vor dem Bezahlen siehst du unter „Deine
            Bestellung“ noch einmal alle Gerichte und den Gesamtpreis und kannst Eingabefehler
            über „Warenkorb ändern“ oder in den Eingabefeldern korrigieren.
          </ThemedText>
          <ThemedText type="small">
            Mit dem Tippen auf „Zahlungspflichtig bestellen“ gibst du eine verbindliche Bestellung
            ab und wirst zur Bezahlseite unseres Zahlungsdienstleisters Stripe weitergeleitet. Der
            Vertrag kommt mit der erfolgreichen Zahlung zustande; die Bestätigung siehst du sofort
            auf der Seite deiner Bestellung.
          </ThemedText>
          <ThemedText type="small">
            Bestellungen nehmen wir nur während unserer Öffnungszeiten an, Lieferungen bis zum
            täglichen Lieferschluss{shop ? ` (in der Regel ${shop.deliveryUntil} Uhr)` : ''}.
            Vertragssprache ist Deutsch.
          </ThemedText>
          <ThemedText type="small">
            Wir speichern deine Bestellung. Ihre Einzelheiten — Gerichte, Preise und Status —
            siehst du auf der Seite deiner Bestellung auf dem Gerät, mit dem du bestellt hast.
            Diese Bedingungen kannst du hier jederzeit abrufen.
          </ThemedText>
        </Section>

        <Section title="3. Preise und Lieferkosten">
          <ThemedText type="small">
            Alle Preise sind Endpreise in Euro und enthalten die gesetzliche Mehrwertsteuer. Für
            eine Lieferung berechnen wir {fee} pro Bestellung; die Abholung ist kostenlos. Einen
            Mindestbestellwert gibt es nicht.
          </ThemedText>
        </Section>

        <Section title="4. Lieferung und Abholung">
          {shop?.deliveryPostcodes && shop.deliveryPostcodes.length > 0 ? (
            <ThemedText type="small">
              Wir liefern in die Postleitzahlen {shop.deliveryPostcodes.join(', ')}. Eine
              Lieferung an eine Adresse außerhalb dieser Postleitzahlen kannst du nicht bestellen;
              Abholung ist immer möglich.
            </ThemedText>
          ) : null}
          <ThemedText type="small">
            Wir liefern an die Adresse, die du bei der Bestellung angibst. Können wir an sie doch
            nicht liefern, melden wir uns telefonisch bei dir; geht es nicht, stornieren wir die
            Bestellung und erstatten dir den vollen Betrag.
          </ThemedText>
          <ThemedText type="small">
            Angegebene Liefer- und Abholzeiten sind ungefähre Angaben. Bitte sei unter der
            angegebenen Adresse und Telefonnummer erreichbar.
          </ThemedText>
        </Section>

        <Section title="5. Bezahlung">
          <ThemedText type="small">
            Du bezahlst online über unseren Zahlungsdienstleister Stripe, per Kredit- oder
            Debitkarte und – je nach Gerät – mit Apple Pay oder Google Pay. Der Betrag wird mit dem
            Abschluss der Bezahlung belastet. Barzahlung bei Lieferung oder Abholung ist bei
            Online-Bestellungen nicht möglich.
          </ThemedText>
        </Section>

        <Section title="6. Änderung und Stornierung">
          <View style={styles.line}>
            <ThemedText type="small">
              Möchtest du eine Bestellung ändern oder stornieren, ruf uns bitte sofort an
              {phoneLink ? ': ' : '.'}
            </ThemedText>
            {phoneLink}
          </View>
          <ThemedText type="small">
            Solange wir mit der Zubereitung noch nicht begonnen haben, stornieren wir kostenlos.
            Können wir eine Bestellung nicht ausführen — etwa weil ein Gericht ausgegangen ist oder
            wir an die Adresse nicht liefern können —, stornieren wir sie ebenfalls.
          </ThemedText>
          <ThemedText type="small">
            In beiden Fällen erstatten wir den vollen Betrag auf das Zahlungsmittel, mit dem du
            bezahlt hast. Bis die Gutschrift auf deinem Konto erscheint, vergehen je nach Bank in
            der Regel 5 bis 10 Werktage.
          </ThemedText>
        </Section>

        <Section title="7. Kein Widerrufsrecht für zubereitete Speisen">
          <ThemedText type="small">
            Ein Widerrufsrecht besteht nicht bei Verträgen über die Lieferung von Waren, die nach
            deinen Wünschen zubereitet werden oder schnell verderben können (§ 312g Abs. 2 Nr. 1
            und 2 BGB). Das gilt für unsere Speisen. Deine gesetzlichen Rechte bei Mängeln bleiben
            davon unberührt.
          </ThemedText>
        </Section>

        <Section title="8. Reklamationen">
          <ThemedText type="small">
            Stimmt etwas mit deiner Bestellung nicht, ruf uns bitte direkt an — dann finden wir
            schnell eine Lösung. Es gelten die gesetzlichen Gewährleistungsrechte.
          </ThemedText>
        </Section>

        <Section title="9. Allergene und Zusatzstoffe">
          <ThemedText type="small">
            Allergenangaben stehen, soweit vorhanden, beim jeweiligen Gericht in der Speisekarte.
            Fragen zu Allergenen und Zusatzstoffen beantworten wir gern telefonisch, bevor du
            bestellst.
          </ThemedText>
        </Section>

        <Section title="10. Streitbeilegung">
          <ThemedText type="small">
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
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
});
