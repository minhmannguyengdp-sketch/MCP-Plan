# A5.5.2 — Route Settings Slice

## Scope

Seven original mutation routes share one closed PostgreSQL-only settings boundary:

```text
POST /api/mcp-settings/order-template
POST /api/mcp-settings/test-template
POST /api/mcp-settings/report-template
POST /api/mcp-settings/followup-template
POST /api/mcp-settings/skip-reason-template
POST /api/mcp-settings/customer-add-rule
POST /api/mcp-settings/session-status
```

## Why this slice precedes archive/R2

All seven operations delegate to one canonical PostgreSQL RPC each and have no external side effect. The remaining archive routes span PostgreSQL, private R2 and resumable delete jobs, so they require a separate cross-system intent/finalizer design.

## Canonical owners

```text
mcp_save_route_order_template
mcp_save_route_test_template
mcp_save_route_report_template
mcp_save_route_followup_template
mcp_save_route_skip_reason_template
mcp_save_route_customer_add_rule
mcp_set_route_session_status
```

Each wrapper must call exactly one literal owner and use its own exact public operation, method and route.

## Invariants

- route must exist;
- order/test/skip templates replace child rows atomically inside the canonical RPC transaction;
- item arrays and item-level validation remain canonical-owner responsibilities;
- follow-up priority and due-days validation remain unchanged;
- customer-add mode remains one of `session_only`, `route_only`, `both`;
- session-status remains an admin/settings intent and delegates to the canonical locked session lifecycle owner;
- trusted Foundation context is persisted on the surviving settings/session aggregate;
- same key and same payload replays the persisted response;
- same key and different payload conflicts;
- no wildcard or dynamic provider target is allowed.

## Test plan

1. Discover every browser caller before changing source.
2. Add seven service-role-only persisted-idempotent wrappers.
3. Add one typed Foundation settings owner with seven literal RPC calls.
4. Intercept all seven exact POST routes before legacy fallback.
5. Convert every real browser caller to a stable operation key.
6. Lock migration, owner, route, caller and scanner contracts.
7. Run Foundation, typecheck, production build and browser smoke.

## Non-scope

- no Supabase migration apply;
- no VPS pull;
- no Vercel deploy;
- no archive/R2 change;
- no NPP-F06 or Order Core;
- no MCP mobile fix pass.
