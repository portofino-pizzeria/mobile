# Portofino — Functional Spec (starter)

> **Status: DRAFT 2026-06-13 — partial, from one WebFetch comprehension pass.** The
> first real instance of the Functional Spec format
> (`2026-06-13-functional-spec-contract.md`). Phase 1 of the kickoff
> (`2026-06-13-portofino-pizzeria-app-kickoff.md`) extends this into the complete
> menu + info model by driving Qontinui's discovery/vision/web-extraction at
> `https://portofino-essen.de/pizza/`. Confidence vocabulary: `observed` (directly
> seen) / `inferred` (deduced) / `assumed` (frontend silent → best-practice default).
> Per the contract, this artifact is **durable-on-disk and re-derivable** — it is the
> hand-off between build steps, not state held in any session.

```jsonc
{
  "spec_version": "0",
  "target": { "source_url": "https://portofino-essen.de/pizza/", "observed_at": "2026-06-13" },
  "business_info": {
    "name": "Portofino Essen",
    "address": "Hauptstraße 108, 45219 Essen",
    "phone": "0205415883",                 // confirm formatting; Essen area code is 0201
    "email": "sajad-1@hotmail.de",
    "languages": ["de", "en"],             // de observed on site; en requested by owner 2026-06-14
    "confidence": "observed", "provenance": "owner-provided 2026-06-14"
  },

  // 1. DOMAIN
  "entities": [
    {
      "name": "MenuCategory",
      "fields": [
        { "name": "name", "type": "string", "confidence": "observed",
          "provenance": "nav: Pizza, Vorspeisen, Nudeln, Frisch aus dem Ofen, Mexikanisch, Salate, Vegetarische Aufläufe, Fisch, Schweinefilet, Schnitzel, Hähnchenbrust, Rumpsteak, Getränke, Dessert, Angebote" }
      ],
      "confidence": "observed"
    },
    {
      "name": "MenuItem",
      "fields": [
        { "name": "number", "type": "string", "confidence": "observed", "provenance": "item rows numbered" },
        { "name": "name", "type": "string", "confidence": "observed" },
        { "name": "description", "type": "string", "confidence": "observed", "provenance": "ingredient text per item" },
        { "name": "sizes", "type": "array<Size>", "confidence": "observed",
          "provenance": "klein 22cm / groß 28cm / Blech 30x50cm, price per size" },
        { "name": "allergens", "type": "array<enum>", "confidence": "observed",
          "provenance": "allergen codes (gluten, eggs, milk, mustard, shellfish, fish, mollusks, dyes, preservatives, antioxidants, stabilizers, sweetener, coloring)" },
        { "name": "category", "type": "ref<MenuCategory>", "confidence": "observed" }
      ],
      "confidence": "observed"
    },
    {
      "name": "Size",
      "fields": [
        { "name": "label", "type": "enum", "values": ["klein 22cm","groß 28cm","Blech 30x50cm"], "confidence": "observed" },
        { "name": "price", "type": "money", "confidence": "observed" }
      ],
      "confidence": "observed"
    },
    {
      "name": "Order",
      "fields": [
        { "name": "fulfillment", "type": "enum", "values": ["Lieferung","Abholung"], "confidence": "observed",
          "provenance": "delivery/pickup selector" },
        { "name": "lines", "type": "array<{item,size,qty}>", "confidence": "inferred",
          "provenance": "cart ('Warenkorb') present; line shape inferred" }
      ],
      "confidence": "inferred",
      "note": "Order/payment is handled by the third-party 'Delivery Way' platform, NOT a Portofino backend. See operations.placeOrder."
    }
  ],

  // 2. CAPABILITIES
  "operations": [
    { "name": "browseMenu", "verb": "read", "entity": "MenuItem", "confidence": "observed" },
    { "name": "filterByAllergen", "verb": "read", "entity": "MenuItem", "confidence": "inferred",
      "provenance": "allergen codes present; filtering UI not confirmed" },
    { "name": "addToCart", "verb": "create", "entity": "Order", "confidence": "observed",
      "provenance": "Warenkorb cart present" },
    { "name": "placeOrder", "verb": "create", "entity": "Order",
      "effect": { "confidence": "observed",
                  "assumption": "DELEGATED to Delivery Way (third-party). The app hands off; it does not process payment.",
                  "provenance": "footer 'Powered by Delivery Way'" },
      "confidence": "observed" }
  ],

  // 3. UI STATES + NAVIGATION (superset of UI Bridge IR — round-trips to app-gen)
  "ui_states": [
    { "id": "home", "provenance": "landing page", "confidence": "observed" },
    { "id": "menu-category", "provenance": "per-category listing", "confidence": "observed" },
    { "id": "item-detail", "confidence": "inferred", "note": "sizes/allergens detail; existence inferred" },
    { "id": "cart", "provenance": "Warenkorb", "confidence": "observed" },
    { "id": "info", "confidence": "observed", "note": "hours observed on site; address/phone/email owner-provided 2026-06-14" }
  ],
  "navigation": [
    { "from": "home", "to": "menu-category", "trigger": "tap category", "confidence": "observed" },
    { "from": "menu-category", "to": "item-detail", "trigger": "tap item", "confidence": "inferred" },
    { "from": "cart", "to": "external:DeliveryWay", "trigger": "checkout", "confidence": "observed" }
  ],

  // 4. AUTH
  "auth": { "model": "none", "confidence": "inferred", "provenance": "no login/registration seen; ordering via Delivery Way" },

  // 5. ASSUMPTIONS LEDGER
  "assumptions": [
    { "ref": "operations.placeOrder.effect", "default_applied": "hand off to Delivery Way (deep link or webview)", "overridable": true,
      "open_question": "Does Delivery Way expose an API/deep-link, or must we embed a webview? (cousin Q1)" },
    { "ref": "entities.MenuItem.allergens", "default_applied": "render allergen legend; no filtering UI in MVP", "overridable": true }
  ],

  // GAPS for the Phase-1 comprehension session to fill
  "gaps": [
    "Menu HARVESTED 2026-06-28 → see 2026-06-28-portofino-menu-data.md (11/14 categories, full items+prices+allergens). REMAINING: Hähnchenbrust, Rumpsteak, Dessert are JS-rendered (not in static HTML) — need the browser-based comprehension path. Verify allergen key against the site's official legend.",
    "Whether allergen filtering / search UI exists.",
    "Branding assets (logo, colors, photos) — owner to provide.",
    "Distribution DECIDED 2026-06-14: native app under Farid's own Apple + Google accounts (you help set up) — start enrollment this week (lead times).",
    "Does the 14% own-site commission apply to cash-on-pickup orders, or only card?"
  ]
}
```

## Coverage note (the honest completeness statement)

This starter covers **frontend-observable** structure only. The menu *schema* is
high-confidence; **per-item data** is a gap to be harvested in Phase 1. Ordering is
`observed` to exist but is **delegated to Delivery Way** — so the app's completeness
is measured against "surfaces the menu + starts an order," not "processes payments,"
which is correctly out of the app's scope.
