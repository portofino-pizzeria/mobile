// The owner's data-subject surface (decision D5): answering an Art. 15
// (Auskunft) or Art. 17 (Löschung) request that arrives by phone, without
// asking a developer to run SQL.
//
// Same owner credential as the menu editor and the restaurant editor —
// `adminPrivacyApi` shares `admin.ts`'s cached token, so a device already
// signed in to either does not sign in again here.

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AdminButton, AdminField, ConfirmAction, Notice } from '@/components/admin-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { AdminApiError, adminPrivacyApi, loadOwnerToken, setOwnerToken } from '@/lib/admin';
import { errorReason } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { formatTimestamp } from '@/lib/shop-dates';
import type { OrderSearchHit, PersonalDataExtract } from '@/lib/types';

/** The orders `forget` refuses (D5): food is still being prepared or
 *  delivered. Kept here only to grey the button before a 409 round-trip;
 *  the server's own German message is what is shown on a refusal. */
const FORGET_REFUSED = new Set(['paid', 'preparing']);

export default function AdminPrivacyScreen() {
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<OrderSearchHit[] | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extract, setExtract] = useState<PersonalDataExtract | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractBusy, setExtractBusy] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [forgetMessage, setForgetMessage] = useState<string | null>(null);

  const extractRef = useRef<PersonalDataExtract | null>(null);
  const resultsRef = useRef<OrderSearchHit[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const first = setTimeout(async () => {
        const token = await loadOwnerToken();
        if (!active) return;
        setNeedsToken(!token);
      }, 0);
      return () => {
        active = false;
        clearTimeout(first);
      };
    }, []),
  );

  async function search() {
    setSearching(true);
    setSearchError(null);
    setSelectedId(null);
    setExtract(null);
    extractRef.current = null;
    setForgetMessage(null);
    try {
      const hits = await adminPrivacyApi.searchByPhone(phone.trim());
      resultsRef.current = hits;
      setResults(hits);
      if (hits.length === 0) setSearchError('Keine Bestellung mit dieser Telefonnummer gefunden.');
    } catch (e) {
      handle401(e, setSearchError);
    } finally {
      setSearching(false);
    }
  }

  /** A stored token that has stopped working: send the owner back to the
   *  credential screen, the same convention every other admin/* screen
   *  follows, instead of showing a generic error with no way on. */
  function handle401(e: unknown, otherwise: (reason: string) => void) {
    if (e instanceof AdminApiError && e.status === 401) {
      setNeedsToken(true);
      setTokenError(e.message);
      return;
    }
    otherwise(errorReason(e));
  }

  async function openExtract(id: string, keepForgetMessage = false) {
    setSelectedId(id);
    setExtract(null);
    extractRef.current = null;
    setExtractError(null);
    if (!keepForgetMessage) setForgetMessage(null);
    setExtractBusy(true);
    try {
      const next = await adminPrivacyApi.personalData(id);
      extractRef.current = next;
      setExtract(next);
    } catch (e) {
      handle401(e, setExtractError);
    } finally {
      setExtractBusy(false);
    }
  }

  async function forget(id: string) {
    setForgetBusy(true);
    setExtractError(null);
    try {
      const result = await adminPrivacyApi.forget(id);
      // Both the extract and the search row must reflect the erasure — the
      // extract because it is on screen, the row because it drives the
      // button state on the next visit to this list. Reload the extract
      // FIRST: it resets `forgetMessage` to null as part of its own state
      // reset, so setting the server's `meldung` has to come after, or the
      // owner never sees the one place erasure's limits (Stripe, backups,
      // the diner's device) are explained.
      await openExtract(id, true);
      setForgetMessage(result.meldung);
      resultsRef.current =
        resultsRef.current?.map((hit) =>
          hit.id === id
            ? { ...hit, name: null, phone: null, address: null, personalDataErasedAt: result.personalDataErasedAt }
            : hit,
        ) ?? null;
      setResults(resultsRef.current);
    } catch (e) {
      handle401(e, setExtractError);
    } finally {
      setForgetBusy(false);
    }
  }

  useUIComponent({
    id: 'admin-privacy',
    name: 'Datenauskunft',
    actions: [
      {
        id: 'signIn',
        label: 'Sign the owner in to the privacy admin screen',
        description: 'Params: { token: string }. Stores the owner credential.',
        handler: async (params) => {
          const { token } = (params ?? {}) as { token?: string };
          if (!token) throw new Error('signIn: token is required.');
          await setOwnerToken(token);
          setNeedsToken(false);
          return { signedIn: true };
        },
      },
      {
        id: 'searchByPhone',
        label: "Search a diner's orders by phone number",
        description:
          'Params: { phone: string }. Returns { count, orders: [{ id, createdAt, status, total }] }.',
        handler: async (params) => {
          const { phone: p } = (params ?? {}) as { phone?: string };
          if (!p) throw new Error('searchByPhone: phone is required.');
          const hits = await adminPrivacyApi.searchByPhone(p);
          resultsRef.current = hits;
          setResults(hits);
          setPhone(p);
          return {
            count: hits.length,
            orders: hits.map((h) => ({ id: h.id, createdAt: h.createdAt, status: h.status, total: h.total })),
          };
        },
      },
      {
        id: 'openExtract',
        label: 'Open the Art. 15 extract for one order',
        description: 'Params: { orderId: string }. Returns the extract, or throws on failure.',
        handler: async (params) => {
          const { orderId } = (params ?? {}) as { orderId?: string };
          if (!orderId) throw new Error('openExtract: orderId is required.');
          await openExtract(orderId);
          return extractRef.current;
        },
      },
      {
        id: 'forget',
        label: 'Erase the customer block of one order (Art. 17)',
        description:
          'Params: { orderId: string }. Refused (throws) while the order is paid or preparing.',
        handler: async (params) => {
          const { orderId } = (params ?? {}) as { orderId?: string };
          if (!orderId) throw new Error('forget: orderId is required.');
          await forget(orderId);
          return { erased: true };
        },
      },
    ],
  });

  if (needsToken) {
    return (
      <ThemedView style={styles.center}>
        <View style={styles.tokenCard}>
          <ThemedText type="subtitle">Datenauskunft / Löschung</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bitte das Kennwort der Verwaltung eingeben (dasselbe wie für die Speisekarte).
          </ThemedText>
          {tokenError ? (
            <Notice tone="error" title="Zugang nicht möglich">
              <ThemedText type="small" themeColor="textSecondary">
                {tokenError}
              </ThemedText>
            </Notice>
          ) : null}
          <AdminField
            uiId="privacy-token"
            label="Kennwort"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Kennwort…"
            autoCapitalize="none"
          />
          <AdminButton
            uiId="privacy-token-submit"
            title="Anmelden"
            tone="primary"
            busy={tokenBusy}
            onPress={async () => {
              setTokenBusy(true);
              try {
                await setOwnerToken(tokenInput.trim());
                setTokenInput('');
                setNeedsToken(false);
                setTokenError(null);
              } finally {
                setTokenBusy(false);
              }
            }}
          />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle">Datenauskunft / Löschung</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Wenn jemand anruft und Auskunft über die eigenen Daten möchte oder deren Löschung
          verlangt: Telefonnummer eingeben, Bestellung öffnen.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <AdminField
            uiId="privacy-phone"
            label="Telefonnummer"
            value={phone}
            onChangeText={setPhone}
            placeholder="z. B. 0201 5415883"
            keyboardType="default"
          />
          <AdminButton
            uiId="privacy-search"
            title="Suchen"
            tone="primary"
            busy={searching}
            disabled={phone.trim().length === 0}
            onPress={() => void search()}
          />
          {searchError ? (
            <Notice tone="warning" title="Suche">
              <ThemedText type="small" themeColor="textSecondary">
                {searchError}
              </ThemedText>
            </Notice>
          ) : null}
        </ThemedView>

        {results && results.length > 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              {results.length} {results.length === 1 ? 'Bestellung' : 'Bestellungen'} gefunden
            </ThemedText>
            {results.map((hit) => (
              <View key={hit.id} style={styles.row}>
                <View style={styles.grow}>
                  <ThemedText type="small">
                    {formatTimestamp(hit.createdAt)} · {formatEUR(hit.total)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {hit.status}
                    {hit.personalDataErasedAt ? ' · Kontaktdaten gelöscht' : ''}
                  </ThemedText>
                </View>
                <AdminButton
                  uiId={`privacy-open-${hit.id}`}
                  uiLabel={`Bestellung vom ${formatTimestamp(hit.createdAt)} öffnen`}
                  title="Öffnen"
                  busy={extractBusy && selectedId === hit.id}
                  onPress={() => void openExtract(hit.id)}
                />
              </View>
            ))}
          </ThemedView>
        ) : null}

        {selectedId ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Bestellung #{selectedId.slice(0, 8)}</ThemedText>
            {extractError ? (
              <Notice tone="error" title="Nicht möglich">
                <ThemedText type="small" themeColor="textSecondary">
                  {extractError}
                </ThemedText>
              </Notice>
            ) : null}
            {forgetMessage ? (
              <Notice tone="ok" title="Erledigt">
                <ThemedText type="small" themeColor="textSecondary">
                  {forgetMessage}
                </ThemedText>
              </Notice>
            ) : null}
            {extract ? (
              <>
                <ThemedText type="small">
                  Name: {extract.customer.name ?? '—'}
                  {'\n'}
                  Telefon: {extract.customer.phone ?? '—'}
                  {'\n'}
                  Adresse: {extract.customer.address ?? '—'}
                  {'\n'}
                  Notiz: {extract.customer.notes ?? '—'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {extract.order.lines.map((l) => `${l.quantity}× ${l.name}, ${l.variantLabel}`).join('\n')}
                  {'\n'}Gesamt: {formatEUR(extract.order.total)}
                </ThemedText>
                {extract.personalDataErasedAt ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Kontaktdaten gelöscht: {formatTimestamp(extract.personalDataErasedAt)}
                  </ThemedText>
                ) : null}
                <View style={styles.stack}>
                  {extract.hinweise.map((h, i) => (
                    <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.gap}>
                      {h}
                    </ThemedText>
                  ))}
                </View>
                {!extract.personalDataErasedAt ? (
                  <ConfirmAction
                    uiId={`privacy-forget-${selectedId}`}
                    title={
                      FORGET_REFUSED.has(extract.status)
                        ? 'Kontaktdaten löschen (Bestellung läuft noch)'
                        : 'Kontaktdaten löschen'
                    }
                    question={`Name, Telefonnummer, Adresse und Notiz dieser Bestellung werden gelöscht. Die Bestellung selbst bleibt erhalten. Das kann nicht rückgängig gemacht werden.`}
                    confirmTitle="Ja, löschen"
                    busy={forgetBusy}
                    onConfirm={() => void forget(selectedId)}
                  />
                ) : null}
              </>
            ) : null}
          </ThemedView>
        ) : null}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  tokenCard: { width: '100%', maxWidth: 420, gap: Spacing.lg },
  card: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  grow: { flex: 1 },
  stack: { gap: Spacing.xs },
  gap: { fontStyle: 'italic' },
});
