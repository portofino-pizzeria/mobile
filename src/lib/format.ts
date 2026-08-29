/** Format an integer number of cents as EUR in German notation, e.g. 1090 ->
 *  "10,90 €". Exact: every price is printed as sourced, never rounded and never
 *  summarised as "ab €X". */
export function formatEUR(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
