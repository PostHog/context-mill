---
next_step: 4-sources.md
---

# Step 3b — Enable products

This is distinct from step 4: here you turn the *products* on; step 4 wires up the *signal sources* that consume them. **A rejection here does not block the next step** — enabling a product (this step) and enabling its signal source (step 4) are independent calls, so step 4 still switches the sources on. They simply sit idle until the products are on, then pick up data with no re-setup.

## Status

Emit:

```
[STATUS] Enabling products
```

## Do

{{> enable-products}}

Step 7's report lists the per-product result and every follow-up, so record them as you go. Then continue to the next step.
