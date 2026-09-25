#!/usr/bin/env bash
# A production web export must not carry the dev-only UI Bridge web transport.
#
# In dev, src/lib/ui-bridge-web-adapter.ts publishes the app's UI Bridge request
# handler on `window.__uiBridgeNative`, which hands every script on the page the
# app's actions. Every spelling of that name sits inside an `if (__DEV__)` block,
# which a production export compiles away. This proves it did: run it after
# `npx expo export --platform web`, against the directory the export wrote.
set -euo pipefail

DIST="${1:-dist}"
BUNDLES=("$DIST"/_expo/static/js/web/*.js)

if [ ! -e "${BUNDLES[0]}" ]; then
  echo "::error::no web bundle under $DIST/_expo/static/js/web/ — run the export first"
  exit 1
fi

# grep: 0 = a match, 1 = no match, 2 = a read error. Only 1 passes: an
# unreadable bundle proves nothing about what it carries.
rc=0
grep -lF -- '__uiBridgeNative' "${BUNDLES[@]}" || rc=$?
if [ "$rc" -eq 0 ]; then
  echo "::error::the production web bundle above carries the dev-only UI Bridge control surface (__uiBridgeNative)"
  exit 1
elif [ "$rc" -ne 1 ]; then
  echo "::error::could not read the web bundle under $DIST (grep exit $rc)"
  exit 1
fi
echo "No UI Bridge control surface in the ${#BUNDLES[@]} web bundle file(s) under $DIST."
