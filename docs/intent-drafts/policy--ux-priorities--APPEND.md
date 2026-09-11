## clause: an-image-beside-a-price-is-a-claim (authored 2026-09-11)

A picture rendered next to a priced menu item asserts what the diner will
receive. It is therefore governed like a price or an allergen, not like styling.

An agent placing dish imagery resolves it from the asset manifest
(`domain_spec/imagery-and-iconography` names the file) by the menu item's own
`id`, and by nothing else. Specifically it must NOT:

- pick an image by **name similarity**, in either language. The near-misses are
  the dangerous ones and they look reasonable in isolation: `Pepperoni` is not
  German `Salami`, `Tonno` is not `Ozeano`, `Marinara` on this menu is tuna and
  onion rather than the Neapolitan dish of that name;
- **stand a category icon in for a dish**, or a generic pizza in for a specific
  one;
- **generate** an image, or fetch one from anywhere, to fill a gap;
- carry a `candidate` binding to the surface. `candidate` means a human has not
  yet confirmed that this picture is that dish, and rendering it is precisely the
  act being deferred.

When no `confirmed` binding exists, the surface renders the declared no-image
treatment. That is the correct, finished outcome — not a degraded one, and not a
reason to hold the work.

WHY THIS IS A POLICY CLAUSE AND NOT A LINE IN THE SPEC. A domain spec states what
a surface should look like; it cannot bind what an agent does when reality does
not match it. The failure this closes is not a designer choosing badly — it is an
autonomous session, acting correctly on every instruction it was given, resolving
an unmapped dish to the visually closest available picture because nothing told
it that "closest" is the wrong operation. Measured on the first asset set for this
tenant: 12 illustrations against 29 pizzas, of which 6 matched by name and the
rest offered exactly those tempting near-misses.

Tier: proceed. Rendering the no-image treatment, and recording an unmapped item
as unmapped, are ordinary work and need no operator. Escalate ONLY where the
operator has already asked for a specific dish to be pictured and no binding
exists — that is a content decision, and the recommendation accompanies it.

VERIFICATION. A change that adds or re-binds imagery is verified by naming, per
item touched, which manifest key was resolved and what its status was. A
screenshot showing a picture is not verification: it shows that *an* image
rendered, which is true in the failure case too. An item's binding is `confirmed`
only when a human has seen that picture beside that dish's name and price.

## clause: an-asset-the-machine-cannot-reach-does-not-exist (authored 2026-09-11)

Assets that are not in a repository are unavailable to every agent except one
running on the machine that happens to hold them, and unavailable to CI entirely.
An asset referenced by a spec, a manifest, or a plan must live in a checkout that
the referencing repo can resolve.

An agent that finds a referenced asset missing reports it missing. It does not
substitute, does not regenerate, and does not silently drop the reference — a
manifest entry pointing at nothing is a defect that fails the build, not a
condition to work around.

Tier: proceed. Moving an asset into the repository that references it, and adding
the check that fails when a manifest names a file or a menu id that does not
exist, are ordinary work.

VERIFICATION. The check runs in CI and fails on: a manifest entry whose file is
absent, a manifest entry naming a menu `id` that no longer exists, and a menu item
in an illustrated category with no manifest entry at all. The third is the one
that catches drift the day the owner adds a dish — without it the manifest decays
silently and every agent inherits the decay.
