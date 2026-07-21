# Production deploy marker — Orders Control Center

- Latest PR: `#78`
- Merge SHA: `9322cdf6a0d3ced2a3e35c3d239390fe654a9900`
- Scope: frontend-only professional order analytics and operations workspace
- Semantics: current total is labeled `Doanh số đặt hàng`, not delivered revenue or collected cash
- Filters: period, search, route, owner, status, source and operational attention
- KPIs: order sales, orders, customers, average order, sales/customer, quantity, SKU/order and pending orders
- Analysis: daily trend plus customer, route, owner and source drill-down
- Alerts: stale pending, possible duplicates, drafts, cancellations, zero-value orders and customer concentration
- Export: CSV follows the active filter population
- Validation: Foundation F0.2 PASS; Order Create Browser Smoke PASS
- Database migration: not required
- VPS pull: not required
- Triggered: 2026-07-21
