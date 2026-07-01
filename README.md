# Portofino Pizzeria — Mobile App

The customer-facing mobile app for **Portofino Pizzeria**, built with
[Expo](https://expo.dev) (React Native) + TypeScript + Expo Router — iOS,
Android, and web from a single codebase.

## Features (planned)

- Browse the menu
- Customize & order pizzas
- Cart and checkout
- Order tracking

## Stack

- Expo SDK 56 · React Native · TypeScript (strict)
- Expo Router (file-based routing)
- `react-native-web` (shared web target for the future website)

## Get started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   npm start        # Expo dev server + QR for Expo Go
   npm run ios      # iOS simulator (needs a Mac)
   npm run android  # Android emulator/device
   npm run web      # browser
   ```

App source lives in `src/app/` (screens & routes) and `src/components/`
(shared UI). Adding a file under `src/app/` adds a route.

## Quality

- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
