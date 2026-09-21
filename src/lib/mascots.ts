import type { MascotAnimation } from '@/components/mascot-pass';

/**
 * The two mascot Lotties. Frame numbers are the markers written by
 * `design/lottie/build_pizza_mascot.py`; rebuild there, never edit the JSON.
 */

/** Home (menu): the chef mascot tosses a pepperoni and catches it in its mouth. */
export const homeMascot: MascotAnimation = {
  source: require('../../assets/lottie/pizza-home.json'),
  width: 700,
  height: 640,
  walk: [0, 144],
  gag: [144, 360],
  stillFrame: 300, // thumbs up, winking
  bodyX: 300 / 700,
};

/** Mexikanisch section: the taco tips its sombrero, dances and throws an olé. */
export const tacoMascot: MascotAnimation = {
  source: require('../../assets/lottie/taco-mexican.json'),
  width: 700,
  height: 560,
  walk: [0, 144],
  gag: [144, 340],
  stillFrame: 302, // thumbs up under the sombrero
  bodyX: 300 / 700,
};

/** Cart: the mascot stops at the checkout button and points at it. */
export const cartMascot: MascotAnimation = {
  source: require('../../assets/lottie/pizza-cart.json'),
  width: 700,
  height: 600,
  walk: [0, 144],
  gag: [144, 330],
  stillFrame: 236, // pointing, winking
  bodyX: 290 / 700,
};
