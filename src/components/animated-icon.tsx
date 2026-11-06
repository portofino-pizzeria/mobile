import { useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Brand } from '@/constants/theme';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
// Over `Motion.ceiling` (400) — a known violation, see the `Motion` token.
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.backgroundSolidColor}
    />
  );
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    // The native splash's own background (`app.json` -> expo-splash-screen),
    // continued for one animation frame so the hand-off is seamless. IT HAS TO
    // BE THE SAME COLOUR AS THAT ONE, and a mismatch is a visible flash on
    // every launch.
    //
    // This side reads the token. THE OTHER SIDE CANNOT: `app.json` is JSON and
    // cannot import TypeScript, so it carries the literal and always will.
    // What keeps them equal is therefore not this line but a check -
    // `scripts/derive-icon.py --check`, which CI runs, fails when `app.json`,
    // `theme.ts` and the derivation disagree about this colour.
    backgroundColor: Brand.cream,
    zIndex: 1000,
  },
});
