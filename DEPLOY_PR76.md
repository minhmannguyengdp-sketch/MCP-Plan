# Production deploy marker — Orders Control Center

- Latest PRs: `#78`, `#79`
- Latest merge SHA: `5847db60f24994a8d9e83ee385f3ca6f97a1f8e3`
- Scope: frontend-only professional order analytics and operations workspace
- Semantics: current total is labeled `Doanh số đặt hàng`, not delivered revenue or collected cash
- Lifecycle rule: only draft orders are pending or stale; confirmed orders are not inferred as delivery backlog
- Filters: period, search, route, owner, status, source and operational attention
- KPIs: order sales, orders, customers, average order, sales/customer, quantity, SKU/order and draft orders
- Analysis: daily trend plus customer, route, owner and source drill-down
- Alerts: stale drafts, possible duplicates, cancellations, zero-value orders and customer concentration
- Export: CSV follows the active filter population
- Validation: Foundation F0.2 PASS; Order Create Browser Smoke PASS
- Database migration: not required
- VPS pull: not required
- Triggered: 2026-07-21
