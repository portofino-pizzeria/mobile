import type { ImageSource } from 'expo-image';

import {
  CATEGORY_ICONS,
  DISH_ILLUSTRATIONS,
  type AssetStatus,
  type RegisteredAsset,
} from './asset-registry.generated';
import type { MenuItem } from './types';

// Resolves the picture for a menu item or a category. This is the one place
// the app decides what may be drawn beside a price, and it implements two
// declarations verbatim:
//
// `domain_spec/imagery-and-iconography`, "What the app loads, and when it has
// nothing": `image_url` is the runtime path, bundled files are the seeded
// default, and the resolver prefers the stored value — so the owner can add a
// dish and its picture without an app release.
//
// `policy/ux-priorities`, clause `an-image-beside-a-price-is-a-claim`: dish
// imagery is resolved from the manifest BY THE ITEM'S OWN ID and by nothing
// else, and a `candidate` binding never reaches the surface. Nothing here
// matches on names, substitutes a category icon or a generic dish, or fills a
// gap. When nothing resolves, the surface renders the no-image treatment, and
// that is the finished outcome rather than a degraded one.

/** Where a resolved picture came from. `stored` is the backend's `imageUrl`;
 *  `bundled` is a `confirmed` manifest binding shipped with the app. */
export type ArtOrigin = 'stored' | 'bundled';

export interface ResolvedArt {
  source: ImageSource | number;
  /** German alt text — the manifest's `alt_de`, or the item's own name for a
   *  stored URL, which carries no alt text of its own. */
  alt: string;
  origin: ArtOrigin;
  /** The manifest key, when the picture is a bundled one. */
  key?: string;
}

/** How one menu item resolved, in the form the policy clause's VERIFICATION
 *  section asks for: "naming, per item touched, which manifest key was
 *  resolved and what its status was". Exposed through the menu screen's UI
 *  Bridge so a verifier can read it off the running app. */
export interface ArtResolution {
  itemId: string;
  /** What the surface shows: a picture from where, or nothing. */
  rendered: ArtOrigin | 'none';
  /** The manifest binding for this id, whether or not it rendered. Absent when
   *  the manifest has no entry for the id at all. */
  manifestKey?: string;
  manifestStatus?: AssetStatus;
}

function bundled(table: Readonly<Record<string, RegisteredAsset>>, id: string): ResolvedArt | null {
  const entry = table[id];
  // The generator leaves `source` null for anything but `confirmed`, so the
  // last test is the same rule read from the bundle's side.
  if (!entry || entry.status !== 'confirmed' || entry.source === null) return null;
  return { source: entry.source, alt: entry.altDe, origin: 'bundled', key: entry.key };
}

/** The picture for a dish, or `null` when the surface must show none.
 *
 *  A stored `imageUrl` wins over a bundled binding. The spec's own open
 *  question — a stored photograph beside bundled illustrations is the "mixed
 *  state" its no-mixing rule has no clause for — is deferred here, not
 *  overlooked: today no item carries an `imageUrl`, and the rule for that
 *  state is the operator's to declare. */
export function resolveDishArt(item: MenuItem): ResolvedArt | null {
  if (item.imageUrl) return { source: { uri: item.imageUrl }, alt: item.name, origin: 'stored' };
  return bundled(DISH_ILLUSTRATIONS, item.id);
}

/** The line-art icon for a category, or `null` when it has no `confirmed`
 *  icon. The menu places icons in the category tabs and beside each section
 *  heading (`imagery-and-iconography`, "Placement in the v0 menu"). */
export function resolveCategoryIcon(categoryId: string): ResolvedArt | null {
  return bundled(CATEGORY_ICONS, categoryId);
}

/** Every item's resolution, for the verification door. */
export function describeArtResolution(items: readonly MenuItem[]): ArtResolution[] {
  return items.map((item) => {
    const art = resolveDishArt(item);
    const entry = DISH_ILLUSTRATIONS[item.id];
    return {
      itemId: item.id,
      rendered: art ? art.origin : 'none',
      ...(entry ? { manifestKey: entry.key, manifestStatus: entry.status } : {}),
    };
  });
}
