## Exception: the pizza mascot (owner-ordered, 2026-09-19)

`## Motion` above says the design uses one duration (150 ms) and that
**nothing auto-advances**. The owner ordered a humorous walking pizza mascot for
the home screen and the cart, and it cannot meet either rule: a pass lasts about
10 s and repeats. It is declared as the **one exception**, and only on these
terms:

- **Where.** Home screen: the chef mascot walks in, tosses a pepperoni, catches
  it in its mouth, gives a thumbs up and walks off. Cart: the mascot walks in,
  stops on the "Zur Kasse" button, points along it and walks off. Nowhere else,
  and never on owner or staff screens.
- **Cadence.** The first pass starts shortly after the screen opens, and the
  next comes after a random 30–60 s, only while that screen is in front. It
  never plays over a screen the guest has left.
- **Pause, Stop, Hide (WCAG 2.2.2).** Tapping the mascot hides it for the rest
  of the app session. It is decorative: it never covers a control for longer
  than one pass, and nothing depends on watching it.
- **Reduced motion.** With reduced motion on, it does not walk or repeat; it
  stands still at its stop.

Every other animation keeps the rules above. The values live in `Mascot` in
`src/constants/theme.ts`; the artwork is built by
`design/lottie/build_pizza_mascot.py`.
