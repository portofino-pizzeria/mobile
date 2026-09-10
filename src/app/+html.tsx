import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * The commit this bundle was exported from, published as a `build-sha` meta tag
 * so "is the live site current?" is answerable by fetching the page instead of
 * inferring it from `Last-Modified`.
 *
 * `EXPO_PUBLIC_*` is the only env prefix Expo inlines into the exported output —
 * anything else is stripped and would render as an empty string. The deploy
 * workflow sets it to the pushed commit SHA; a local `expo export` leaves it
 * unset, and `unknown` is the honest answer there rather than a build failure.
 * Metro caches the inlined value, which is why every export that must carry a
 * real SHA passes `--clear`.
 */
const BUILD_SHA = process.env.EXPO_PUBLIC_BUILD_SHA || 'unknown';

/**
 * Web-only root document. Configures the static `<head>` for every web page —
 * notably the browser-tab <title>. Native apps ignore this file.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="build-sha" content={BUILD_SHA} />
        <title>Portofino Pizzeria</title>
        <meta name="description" content="Pizza, Pasta und mehr — direkt bei Portofino in Essen bestellen." />
        {/* Disable body scrolling on web so ScrollView layouts behave like native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
