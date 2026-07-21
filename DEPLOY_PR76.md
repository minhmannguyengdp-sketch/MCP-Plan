# Production deploy marker — Orders Control Center

- Latest PRs: `#78`, `#79`, `#80`
- Latest merge SHA: `ef49cf066c9d4b21aa3fe315cbae0f57f8bfec3b`
- Scope: frontend-only professional order analytics, operations workspace and routed order detail surface
- Semantics: current total is labeled `Doanh số đặt hàng`, not delivered revenue or collected cash
- Lifecycle rule: only draft orders are pending or stale; confirmed orders are not inferred as delivery backlog
- Detail ownership: URL query `detail=ORDER_ID` is the single source of truth
- Detail UX: bounded right drawer on desktop; full-screen detail surface on mobile/PWA
- Navigation: browser Back, Escape, backdrop and close preserve filters, list scroll and trigger focus
- Data boundary: aggregate order fields only; product lines, prices and discounts are not fabricated when the API does not provide them
- Filters: period, search, route, owner, status, source and operational attention
- KPIs: order sales, orders, customers, average order, sales/customer, quantity, SKU/order and draft orders
- Analysis: daily trend plus customer, route, owner and source drill-down
- Alerts: stale drafts, possible duplicates, cancellations, zero-value orders and customer concentration
- Export: CSV follows the active filter population; individual order export remains explicit
- Validation: Foundation F0.2 PASS; Order Create Browser Smoke PASS on mobile and desktop
- Database migration: not required
- VPS pull: not required
- Triggered: 2026-07-21
