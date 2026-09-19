## Exception: the mascots (owner-ordered, 2026-09-19)

`## Motion` above says the design uses one duration (150 ms) and that
**nothing auto-advances**. The owner ordered humorous walking mascots — a pizza
for the home screen and the cart, a taco for the Mexican part of the menu — and
they cannot meet either rule: a pass lasts about 10 s and comes back. They are
declared as the **one exception**, and only on these terms:

- **Where.** Home screen: the chef pizza walks in, tosses a pepperoni, catches
  it in its mouth, gives a thumbs up and walks off. Cart: the pizza walks in,
  stops on the "Zur Kasse" button, points along it and walks off. Mexikanisch:
  the taco walks in wearing a sombrero, tips it, dances and throws an olé.
  Nowhere else, and never on owner or staff screens.
- **Cadence.** The pizza's first pass starts shortly after the screen opens,
  and the next comes after a random 30–60 s, only while that screen is in
  front. The taco keeps no cadence at all: it walks on when the guest reaches
  the Mexican section, once per arrival there. Neither plays over a screen the
  guest has left.
- **One at a time.** Two mascots never share the screen. Whichever is walking
  holds it until it has walked off; the other waits or lets its moment pass.
- **Pause, Stop, Hide (WCAG 2.2.2).** Tapping the mascot hides it for the rest
  of the app session. It is decorative: it never covers a control for longer
  than one pass, and nothing depends on watching it.
- **Reduced motion.** With reduced motion on, it does not walk or repeat; it
  stands still at its stop.
- **A mascot belongs to its section.** A category's own mascot may greet the
  guest who reaches that category. This is the rule the taco follows, and it is
  what a later mascot for another section would have to follow too.

Every other animation keeps the rules above. The values live in `Mascot` in
`src/constants/theme.ts`; the artwork is built by
`design/lottie/build_pizza_mascot.py` from the operator's character sheets in
`design/sources/`.
