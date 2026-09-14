import {
  Pressable,
  TextInput,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { useUIElement } from '@qontinui/ui-bridge-native';

/**
 * Thin wrappers that register a control with UI Bridge so the Qontinui runner
 * can find and drive it semantically (by id/label, not by coordinates). Every
 * interactive control in the app should be a Bridge* component or call
 * `useUIElement` directly.
 */

type BridgeButtonProps = Omit<PressableProps, 'onPress'> & {
  /** Stable id the runner targets, e.g. "menu-add-margherita". */
  uiId: string;
  /** Human-readable label surfaced to the runner / accessibility. */
  uiLabel: string;
  /** Press handler — wired to BOTH the Pressable and the bridge `press` action. */
  onPress?: () => void;
};

export function BridgeButton({
  uiId,
  uiLabel,
  onPress,
  onLayout: callerOnLayout,
  children,
  ...rest
}: BridgeButtonProps) {
  const { ref, onLayout, bridgeProps } = useUIElement({
    id: uiId,
    type: 'button',
    label: uiLabel,
    // Required for 'button': UI Bridge invokes this when the runner dispatches
    // a `press` action, so automated presses run the same code as a real tap.
    // The Bridge calls this WITHOUT checking `disabled`, and a press that
    // returned quietly would be reported as a success that did nothing. A real
    // tap on a disabled Pressable does nothing, so an automated one fails
    // instead of pretending.
    //
    // `rest.disabled` is as of the last commit, because the Bridge swaps this
    // handler in an effect. A workflow that changes what `disabled` depends on
    // and presses in the next step, with nothing in between, is refused.
    // `waitOptions.enabled` cannot wait that out: ui-bridge-native never reads
    // `disabled`, and every state write it makes sets `enabled: true`.
    handlers: {
      onPress: () => {
        if (rest.disabled) throw new Error(`${uiLabel} ist gerade nicht verfügbar.`);
        onPress?.();
      },
    },
  });
  return (
    // The Bridge's `onLayout` is what records the element's rect, so a caller's
    // own `onLayout` runs beside it rather than replacing it.
    <Pressable
      ref={ref}
      {...bridgeProps}
      onPress={onPress}
      {...rest}
      onLayout={(e) => {
        onLayout(e);
        callerOnLayout?.(e);
      }}>
      {children}
    </Pressable>
  );
}

type BridgeInputProps = TextInputProps & {
  uiId: string;
  uiLabel: string;
};

export function BridgeInput({
  uiId,
  uiLabel,
  value,
  onChangeText,
  onLayout: callerOnLayout,
  ...rest
}: BridgeInputProps) {
  const { ref, onLayout, bridgeProps } = useUIElement({
    id: uiId,
    type: 'input',
    label: uiLabel,
    // Thread the controlled value so a bridge read reflects what the user sees.
    value: typeof value === 'string' ? value : undefined,
    // Register the text-change handler so the bridge's `type` / `setValue`
    // actions run exactly the code a real keystroke runs. Without it the
    // element still ADVERTISES those actions and then fails them with "No text
    // change handler found on element" — the field reads but cannot be driven,
    // which silently takes every form in the app off the UI Bridge path.
    handlers: { onChangeText: (next: string) => onChangeText?.(next) },
  });
  return (
    <TextInput
      ref={ref}
      {...bridgeProps}
      value={value}
      onChangeText={onChangeText}
      {...rest}
      onLayout={(e) => {
        onLayout(e);
        callerOnLayout?.(e);
      }}
    />
  );
}
