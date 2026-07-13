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

export function BridgeButton({ uiId, uiLabel, onPress, children, ...rest }: BridgeButtonProps) {
  const { ref, onLayout, bridgeProps } = useUIElement({
    id: uiId,
    type: 'button',
    label: uiLabel,
    // Required for 'button': UI Bridge invokes this when the runner dispatches
    // a `press` action, so automated presses run the same code as a real tap.
    handlers: { onPress: () => onPress?.() },
  });
  return (
    <Pressable ref={ref} onLayout={onLayout} {...bridgeProps} onPress={onPress} {...rest}>
      {children}
    </Pressable>
  );
}

type BridgeInputProps = TextInputProps & {
  uiId: string;
  uiLabel: string;
};

export function BridgeInput({ uiId, uiLabel, value, ...rest }: BridgeInputProps) {
  const { ref, onLayout, bridgeProps } = useUIElement({
    id: uiId,
    type: 'input',
    label: uiLabel,
    // Thread the controlled value so a bridge read reflects what the user sees.
    value: typeof value === 'string' ? value : undefined,
  });
  return <TextInput ref={ref} onLayout={onLayout} {...bridgeProps} value={value} {...rest} />;
}
