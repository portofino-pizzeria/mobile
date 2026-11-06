// The delivery area: the postcodes the shop delivers to, set by the owner on
// the restaurant page and served as `ShopInfo.deliveryPostcodes`.
//
// MIRRORS the backend's `lib/delivery-area.ts`, which is the enforcement: the
// order route refuses a delivery outside the area whatever this copy says.
// This one only stops a diner from pressing pay into that refusal, and shows
// them the same German sentence the server would. Keep the wording identical.
//
// An empty or absent list means no restriction (an older API, or an owner who
// has not entered an area yet).

/** MIRRORS the backend's limit on naming the area in the refusal. */
const MAX_NAMED_POSTCODES = 12;

/** Every postcode-shaped number in a free-text address, in order: a run of
 *  exactly five digits. Runs of digits are taken whole and filtered by length,
 *  which matches the backend's lookbehind pattern without depending on
 *  lookbehind support in the app's JS engines. */
export function postcodesIn(address: string): string[] {
  return (address.match(/\d+/g) ?? []).filter((run) => run.length === 5);
}

/** The refusal for a delivery to this address, or null when it is taken. */
export function deliveryAreaGap(area: readonly string[] | undefined, address: string): string | null {
  if (!area || area.length === 0) return null;
  const found = postcodesIn(address);
  if (found.length === 0) {
    return 'Bitte gib in der Lieferadresse auch die Postleitzahl an, z. B. „Hauptstr. 1, 45219 Essen“.';
  }
  if (found.some((code) => area.includes(code))) return null;
  // The area is named only while it is short enough to read in one banner.
  const named =
    area.length <= MAX_NAMED_POSTCODES ? `Wir liefern in die Postleitzahlen ${area.join(', ')}. ` : '';
  return (
    `Nach ${found[found.length - 1]} liefern wir leider nicht. ` +
    `${named}Abholung ist natürlich möglich.`
  );
}
