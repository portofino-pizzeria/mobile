import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only root document. Configures the static `<head>` for every web page —
 * notably the browser-tab <title>. Native apps ignore this file.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>Portofino Pizzeria</title>
        <meta name="description" content="Order authentic wood-fired pizza from Portofino Pizzeria." />
        {/* Disable body scrolling on web so ScrollView layouts behave like native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
