# Production deploy marker — Order create UX

- Latest PR: `#77`
- Merge SHA: `f457419a523fd6d41ce9e283bda7484f11ca86f8`
- Scope: frontend-only order catalog business priority
- Filter order: tea-milk materials → spicy food → packaging → remaining groups
- Catalog order: tea-milk products first, spicy noodles next, then frozen/food/packaging
- Card flow: suppress meaningless default variants; show selling unit, size, SKU, price and selected quantity
- Backend category values: unchanged
- Validation: Foundation F0.2 PASS; Order Create Browser Smoke PASS
- Database migration: not required
- VPS pull: not required
- Triggered: 2026-07-21
