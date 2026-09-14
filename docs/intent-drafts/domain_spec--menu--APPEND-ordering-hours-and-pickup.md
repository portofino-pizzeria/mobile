## Opening hours, Abholung, and the shop's contact facts (2026-09-14)

Closes `(5)` above, "no source at all" for availability, at the shop level.
Item-level availability is still undeclared.

**Source.** The footer of `portofino-essen.de`, copied by the operator on
2026-09-14:

- Hauptstr. 108, 45219 Essen
- Telefon 02054 – 15 88 3. The area code is Essen-Kettwig's, which settles the
  doubt recorded above about `0205415883`.
- Dienstag Ruhetag
- Mo – Fr 12:00 – 22:30
- Sa, So und Feiertage 13:00 – 22:30
- Lieferzeit bis 22:00

The WPPizza widget captured in `data/menu.json` `openingHours` closes at 22:00,
and so does `audience_profile/owner-operator`. **Both are superseded by the
footer**, which separates the shop closing (22:30) from the last delivery
(22:00).

**DECLARATION — the order API enforces the hours, and the app shows them.**
- The backend computes, in Europe/Berlin time, whether a delivery (until 22:00)
  and a pickup (until 22:30) are taken right now. It uses the NRW statutory
  public holidays for "Feiertage".
- An order of a kind not taken now is refused in German, and the refusal says
  when ordering reopens.
- The app renders the same status from `GET /api/shop`: a status line on the
  menu and a disabled pay button with the reason. A failed status read blocks
  nothing, because the server is the enforcement.

**DECLARATION — Lieferung and Abholung, as the site offers.** An order is one or
the other.
- **Pickup:** needs a name and phone number, no address; pays no delivery fee;
  stores no address.
- **Delivery:** needs the address and pays the fee.
- The kitchen card and the diner's order screen say which it is.

**DECLARATION — the Mittwochs-Angebote are pickup-only.** Their descriptions say
"für Selbstabholer". `data/menu.json` `pickup.pickupOnlyOffers` names them by
item id, the menu shows "Nur zur Abholung", and a delivery containing one is
refused.

**DECLARATION — a diner's details stay on their device.**
- Checkout saves name, phone, address, note and the last choice **on the device
  only**, while "Angaben merken" is ticked (the default).
- Checkout prefills them next time and offers "Gespeicherte Angaben löschen".
- No account and no server copy. This serves `audience_profile/hungry-diner`:
  re-entering an address a second time is what ends the switch.

### Decided in code, owed back to the owner

- **A public holiday on a Tuesday stays a Ruhetag.** The footer does not say. The
  app refuses orders on such a day, which is the side that cannot leave food
  uncooked. The next one is 1. Weihnachtstag 2029.

### Declared UNKNOWN, added

- **Whether the Mittwochs-Angebote are Wednesday-only.** Their names say so, but
  nothing on the menu data does. They can be ordered (for pickup) on any open day.
- **Special closures:** holidays the shop takes, Heiligabend or Silvester hours.
  Nothing records them, and the app would take orders.
- **Delivery area and minimum order value.** The site's cart may enforce either;
  the app enforces neither.
- **How far ahead a pickup may be scheduled.** Orders are for now; the note field
  is the only way to name a time.
