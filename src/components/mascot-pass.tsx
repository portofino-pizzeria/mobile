import { useFocusEffect } from 'expo-router';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BridgeButton } from '@/components/bridge';
import { Mascot } from '@/constants/theme';

/**
 * The pizza mascot's pass across a screen: it walks in from the left, stops,
 * plays its gag, and walks off to the right. Built from the Lotties in
 * `assets/lottie` (see `design/lottie/build_pizza_mascot.py`), which walk in
 * place; this component does the travelling, so the stop lands on the same
 * spot on every screen width.
 *
 * The rules come from the `Mascot` exception in the motion spec: repeats on
 * the `Mascot` cadence only while the screen is focused, a tap hides it for
 * the rest of the session, and with reduced motion it stands still at its
 * stop instead of walking.
 */

export type MascotAnimation = {
  source: AnimationObject;
  /** Canvas size of the Lottie, for the aspect ratio. */
  width: number;
  height: number;
  /** Frame ranges of the Lottie's `walk` marker and its gag marker. */
  walk: [number, number];
  gag: [number, number];
  /** Frame shown when reduced motion is on (native only; web shows frame 0). */
  stillFrame: number;
  /** Horizontal position of the body centre inside the canvas, 0..1. */
  bodyX: number;
};

type Props = {
  /** Stable id: the UI Bridge id of the hide control and the session-hide key. */
  id: string;
  animation: MascotAnimation;
  /** Where the body centre stops, as a fraction of the screen width. */
  stopAt: number;
  /** Distance of the mascot's feet from the bottom of the screen. */
  bottom: number;
};

/** Mascots the guest tapped away. Kept for the app session, not persisted. */
const hiddenThisSession = new Set<string>();

type Cue = { segment: [number, number]; loop: boolean };

export function MascotPass({ id, animation, stopAt, bottom }: Props) {
  const reduceMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(Mascot.width, screenWidth * 0.45);
  const height = (width * animation.height) / animation.width;
  const stopX = screenWidth * stopAt - width * animation.bodyX;
  const offLeft = -width;

  const lottie = useRef<LottieView>(null);
  const x = useSharedValue(offLeft);
  const phase = useRef<'idle' | 'in' | 'gag' | 'out'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cue, setCue] = useState<Cue | null>(null);
  const [hidden, setHidden] = useState(() => hiddenThisSession.has(id));
  // The web player can fire its load event before `onAnimationLoaded` is
  // subscribed, so on web the first pass relies on its start delay instead.
  const ready = loaded || Platform.OS === 'web';

  // Play whatever the pass asked for once the view has rendered with the
  // matching `loop` prop. On web the player's `play(start, end)` only selects
  // the segment, so it also needs a `resume()` to start.
  useEffect(() => {
    if (!cue || !ready) return;
    lottie.current?.play(cue.segment[0], cue.segment[1]);
    if (Platform.OS === 'web') lottie.current?.resume();
  }, [cue, ready]);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(x);
    phase.current = 'idle';
    lottie.current?.pause();
    setCue(null);
  }, [x]);

  const walkDuration = useCallback(
    (distance: number) => (distance / (width * Mascot.walkSpeedPerWidth)) * 1000,
    [width],
  );

  const schedule = useRef<(delayMs: number) => void>(() => {});

  const walkOff = useCallback(() => {
    phase.current = 'out';
    setCue({ segment: animation.walk, loop: true });
    const done = () => {
      phase.current = 'idle';
      lottie.current?.pause();
      setCue(null);
      schedule.current(Mascot.repeatMinMs + Math.random() * (Mascot.repeatMaxMs - Mascot.repeatMinMs));
    };
    x.set(withTiming(
      screenWidth + 10,
      { duration: walkDuration(screenWidth + 10 - x.get()), easing: Easing.linear },
      (finished) => {
        'worklet';
        if (finished) scheduleOnRN(done);
      },
    ));
  }, [animation.walk, screenWidth, walkDuration, x]);

  const startGag = useCallback(() => {
    phase.current = 'gag';
    setCue({ segment: animation.gag, loop: false });
  }, [animation.gag]);

  const pass = useCallback(() => {
    phase.current = 'in';
    x.set(offLeft);
    setCue({ segment: animation.walk, loop: true });
    x.set(withTiming(
      stopX,
      { duration: walkDuration(stopX - offLeft), easing: Easing.linear },
      (finished) => {
        'worklet';
        if (finished) scheduleOnRN(startGag);
      },
    ));
  }, [animation.walk, offLeft, startGag, stopX, walkDuration, x]);

  useEffect(() => {
    schedule.current = (delayMs: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(pass, delayMs);
    };
  }, [pass]);

  const onFinish = useCallback(
    (isCancelled: boolean) => {
      // Switching segments reports the old one as cancelled; only a gag that
      // ran to its end sends the mascot on its way.
      if (!isCancelled && phase.current === 'gag') walkOff();
    },
    [walkOff],
  );

  useFocusEffect(
    useCallback(() => {
      if (hidden || !ready) return undefined;
      if (reduceMotion) {
        x.set(stopX);
        return undefined;
      }
      schedule.current(Mascot.firstPassDelayMs);
      return stop;
    }, [hidden, ready, reduceMotion, stop, stopX, x]),
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.mascot, { width, height, bottom }, style]}>
        <BridgeButton
          uiId={`${id}-hide`}
          uiLabel="Pizza-Maskottchen ausblenden"
          accessibilityRole="button"
          accessibilityHint="Blendet das Maskottchen bis zum nächsten App-Start aus."
          style={styles.fill}
          onPress={() => {
            stop();
            hiddenThisSession.add(id);
            setHidden(true);
          }}>
          <LottieView
            ref={lottie}
            source={animation.source}
            style={styles.fill}
            webStyle={{ width: '100%', height: '100%' }}
            autoPlay={false}
            loop={cue?.loop ?? false}
            progress={reduceMotion && Platform.OS !== 'web' ? animation.stillFrame / animation.gag[1] : undefined}
            onAnimationLoaded={() => setLoaded(true)}
            onAnimationFinish={onFinish}
          />
        </BridgeButton>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mascot: { position: 'absolute', left: 0 },
  fill: { width: '100%', height: '100%' },
});
