// Building blocks for the owner's menu editor.
//
// The audience is one person who may not have opened this screen for six
// months, on a phone, probably after close. So: German labels that say what
// will happen, touch targets big enough for a thumb, and no destructive action
// that happens on a single tap.
//
// Confirmation is rendered INLINE rather than through `Alert.alert` — a native
// alert does not exist on web, cannot be driven through UI Bridge, and is the
// kind of dialog people dismiss without reading. An inline question that stays
// on screen until it is answered is both testable and harder to tab past.

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// DANGER is the design's declared `--destructive`, single-sourced from the
// token file. WARNING and OK are not in the design: they are the values this
// editor already shipped, kept literal so they do not read as declared.
//
// With the palette now gold, the primary action here is a gold fill like on
// the guest screens: gold and the destructive red no longer sit adjacent, so
// "save" and "careful" stay distinct without keeping the primary ink.
export const DANGER = Colors.destructive;
export const WARNING = '#b25e00';
export const OK = '#177245';

export type ButtonTone = 'primary' | 'secondary' | 'danger';

export function AdminButton({
  uiId,
  uiLabel,
  title,
  tone = 'secondary',
  onPress,
  disabled,
  busy,
}: {
  uiId: string;
  uiLabel?: string;
  title: string;
  tone?: ButtonTone;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const background =
    tone === 'primary' ? theme.brand : tone === 'danger' ? DANGER : 'transparent';
  const color =
    tone === 'primary' ? theme.onBrand : tone === 'danger' ? theme.onDestructive : theme.text;

  return (
    <BridgeButton
      uiId={uiId}
      uiLabel={uiLabel ?? title}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: background,
          borderColor: tone === 'secondary' ? theme.backgroundSelected : background,
          opacity: disabled || busy ? 0.45 : 1,
        },
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {title}
        </ThemedText>
      )}
    </BridgeButton>
  );
}

export function AdminField({
  uiId,
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  invalid,
}: {
  uiId: string;
  label: string;
  hint?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences';
  invalid?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      <BridgeInput
        uiId={uiId}
        uiLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: invalid ? DANGER : theme.backgroundSelected,
            backgroundColor: theme.background,
          },
        ]}
      />
    </View>
  );
}

/**
 * A destructive action that takes two taps: the first asks the question in
 * German and names what will be lost, the second does it. There is no timer
 * and no auto-dismiss.
 */
export function ConfirmAction({
  uiId,
  title,
  question,
  confirmTitle,
  onConfirm,
  busy,
}: {
  uiId: string;
  title: string;
  question: string;
  confirmTitle: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <AdminButton
        uiId={uiId}
        title={title}
        tone="danger"
        busy={busy}
        onPress={() => setAsking(true)}
      />
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.confirm}>
      <ThemedText type="small">{question}</ThemedText>
      <View style={styles.row}>
        <View style={styles.grow}>
          <AdminButton
            uiId={`${uiId}-confirm`}
            title={confirmTitle}
            tone="danger"
            busy={busy}
            onPress={() => {
              setAsking(false);
              onConfirm();
            }}
          />
        </View>
        <View style={styles.grow}>
          <AdminButton
            uiId={`${uiId}-cancel`}
            title="Abbrechen"
            onPress={() => setAsking(false)}
          />
        </View>
      </View>
    </ThemedView>
  );
}

export function Notice({
  tone,
  title,
  children,
}: {
  tone: 'error' | 'warning' | 'ok';
  title?: string;
  children?: React.ReactNode;
}) {
  const color = tone === 'error' ? DANGER : tone === 'warning' ? WARNING : OK;
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      {title ? (
        <ThemedText type="smallBold" style={{ color }}>
          {title}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: Spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
    fontSize: 17,
  },
  confirm: { padding: Spacing.lg, borderRadius: Radius.card, gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
  notice: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
});
