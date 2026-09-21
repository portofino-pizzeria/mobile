## The restaurant's facts become owner-authored; special days; the Impressum (2026-09-19)

Decided by the operator on 2026-09-19. Plan:
`mobile/plans/2026-09-19-portofino-owner-edits-shop-info-and-legal-notice.md`.

### Decided (closes "Decided in code, owed back to the owner" above)

- **A public holiday that falls on a Tuesday stays a Ruhetag.** This is now the
  owner's answer, not a guess. It is stored as a setting the owner can change.
- **Each day has one opening window, with no shop-wide lunch break.** Several
  employees cover the day. A model or editor that offers split windows is wrong
  for this shop.
- **Heiligabend and Silvester have default short hours that the owner can
  edit.**
  - Both days open at that weekday's normal time.
  - Heiligabend closes at 14:00, with the last delivery at 13:30.
  - Silvester closes at 18:00, with the last delivery at 17:30.
  - These are typical hours, **not observed ones**. The editor shows them as
    unconfirmed until the owner saves them.
  - A recurring special day never opens a Ruhetag. Only a special day the owner
    enters for one specific date can do that.

### DECLARATION: after the plan above ships, the owner authors the restaurant's facts

- The owner's editor holds the address, phone, email, weekly hours, last
  delivery time, public-holiday hours and special days (closures and different
  hours). Code constants stop being the source.
- Each value is stored in one place, and both the diners' view and the order
  refusal read it. The printed hours are derived from the enforced hours, so
  the two cannot disagree.
- The footer values of 2026-09-14 above are the seed. On the day this ships,
  diners see exactly what they see today.
- The restaurant editor has the same safety bar as the menu editor (behaviour
  (8)):
  - it refuses impossible times;
  - it saves the week as a whole;
  - closing every day needs an explicit confirmation;
  - it shows a preview before saving;
  - the last change can be undone.

### DECLARATION: the owner's edits survive a deploy

Before this, every server start deleted the menu and reloaded it from
`data/menu.json`. Every deploy therefore erased every edit made in the owner's
editor. That contradicts (7): *"truth becomes authored"*.

- From now on, the seed runs only on an empty database.
- A dataset correction before cutover ships as a reviewed data migration.
  Editing `data/menu.json` no longer changes production.

### DECLARATION: the site and app carry a legal notice (Impressum, § 5 DDG)

- It is reachable in at most two taps from any screen. It contains:
  - the owner's legal name and legal form;
  - the address;
  - the phone number and an email address;
  - the VAT ID and commercial register entry, where they exist;
  - the § 36 VSBG statement that the shop takes no part in consumer dispute
    resolution.
- It carries no EU online dispute resolution (OS) platform link, because that
  platform closed on 2025-07-20.
- **Missing owner facts are left missing, never invented:** the legal name,
  legal form, email and VAT ID. The server reports the notice as incomplete
  while they are missing. **An incomplete Impressum blocks app store
  submission and the website cutover.**

### Declared UNKNOWN, updated

- **Special closures: no longer unknown as a capability.** The owner can record
  them. The actual Heiligabend and Silvester hours remain unconfirmed until the
  owner saves them.
- **Added: the Impressum facts** listed above.
- **Added: a privacy policy (Datenschutzerklärung) is required and does not
  exist.** Checkout collects name, phone and address, and payments go through
  Stripe. Like the Impressum, it blocks cutover.
