# MCP-Plan — Current Progress

> Đọc file này trước khi tiếp tục.  
> Cập nhật: **2026-07-19**  
> Phase: **A / NPP-F05 / A5.5.2**  
> Trạng thái: **SOURCE MERGED 21/30 — PR #68 RETIREMENT OPEN — RUNTIME 14/30**

## Quyết định hiện tại

- Tiếp tục master plan A5.5.2 trước.
- Hoãn mobile production test/fix MCP sang pass riêng.
- Không bắt đầu NPP-F06 hoặc Order Core.
- Không đụng `milktea-backend` hoặc port `3002`.
- Không ghi runtime PASS khi chưa rollout và có authenticated smoke/cleanup evidence.

## Coverage

Baseline cũ `13/30` thiếu `route-customer.add`; baseline đúng là `14/30`.

```text
PR #65 session lifecycle:          +4
PR #66 route create/update:        +2
PR #67 route-customer edit:        +1
Source merged before PR #68:       21/30
PR #68 retirement candidate:       +7
Projected after PR #68 merge:      28/30
Projected remaining original:      2
Runtime verified now:              14/30
```

## PR #68 — Retire dead route-settings POST mutations

A full-repository source inventory found no live POST caller for:

```text
POST /api/mcp-settings/order-template
POST /api/mcp-settings/test-template
POST /api/mcp-settings/report-template
POST /api/mcp-settings/followup-template
POST /api/mcp-settings/skip-reason-template
POST /api/mcp-settings/customer-add-rule
POST /api/mcp-settings/session-status
```

`/mcp-setting` uses the active `/api/mcp-report-settings` owner, already typed and persisted-idempotent. Live `session-status` references are GET reads only.

PR #68 removes the seven legacy POST branches, seven save helpers and five private normalizers used only by those mutations. It preserves required GET readers and does not drop RPC/schema.

```text
PR:                    #68 OPEN
Source transform:      PASS node --check
Supabase migration:    NONE
VPS pullmcp:           NO
Vercel deploy:         NO
Production runtime:    UNCHANGED
```

Evidence/decision:

```text
docs/npp-plan/A5_5_2_ROUTE_SETTINGS_SLICE.md
```

## Earlier merged source slices

```text
PR #67 route-customer.update
Merge: 39c3c77b1c3e4588c04faaf33c5a07c25b72f0fc
Migration: 20260719220000_a5_5_2_route_customer_update_idempotency.sql

PR #66 route.create / route.update
Merge: 5692e7592a94e51b6f41b88c8543156cc95c5dec
Migration: 20260719210000_a5_5_2_route_master_write_idempotency.sql

PR #65 session lifecycle x4
Merge: f8df14acd453e7452d3542eaff2618f964a034b6
Migration: 20260719200000_a5_5_2_session_lifecycle_idempotency.sql
```

## Remaining after PR #68 merge — S2c cross-system archive

```text
POST /api/routes/:id/archive
POST /api/route-customers/:id/archive
```

Existing Foundation owner already has private R2 deletion lifecycle, parent delete jobs, retry/reclaim and guarded hard-delete. Missing piece is persisted replay/conflict/audit for the public intent across an asynchronous cross-system workflow.

Do not pretend PostgreSQL and R2 share one transaction. Next slice must design intent claim + job linkage + cleanup-compatible finalizer before code.

## Production debt still pending

PR #64–#67 are source-only. PR #68 also changes production only after a future backend rollout. Required rollout evidence includes migration ordering where applicable, `pullmcp`, `pm2 list`, health on `127.0.0.1:3001`, execute/replay/conflict/audit/context/invariant smoke and complete fixture cleanup.

MCP/R2/mobile test still pending: AppShell/feedback mobile, R2 create/view/delete, customer photo preview, standalone order, cleanup timer and UX issues found by the owner.

## Point to continue

1. Finish PR #68 final Foundation + browser gates and merge only when green.
2. Record real merge SHA and source `28/30` on `main`.
3. Start S2c design from the existing delete-job lifecycle; no production rollout unless explicitly requested.
