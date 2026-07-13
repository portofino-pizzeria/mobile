/** Format an integer number of cents as EUR, e.g. 1090 -> "€10.90". */
export function formatEUR(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}
