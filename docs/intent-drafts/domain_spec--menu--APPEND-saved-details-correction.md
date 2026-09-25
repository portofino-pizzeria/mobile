### CORRECTION (2026-09-20) — the saved-details declaration above was wrong in two ways

Applied to `domain_spec/menu` v5 → v6, announced by finding
`1a13c188-1387-4fdc-af58-9e63bc6badb1`. The served document carries the full
text; this is the working copy.

- **"Angaben merken" starts UNTICKED, not ticked** (`checkout.tsx:216`,
  `useState(false)`; the comment at `:212-215` says a pre-ticked box is not
  consent). The unticked default is what makes the § 25 (1) TDDDG basis hold.
  On a return visit with details already saved, the prefill effect re-ticks it
  (`checkout.tsx:268-286`).
- **The note is NOT stored.** Four values only — `fulfilment`, `name`, `phone`,
  `address` — under `checkout-details-v1` (`saved-details.ts:45-48`); the note
  belongs to one order (`saved-details.ts:10-12`). Web uses `localStorage`;
  native uses a per-key file in the app's document directory.
