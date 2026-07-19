# MCP-Plan — Current Progress

> Đọc file này trước khi tiếp tục.  
> Cập nhật: **2026-07-19**  
> Phase: **A / NPP-F05 / A5.5.2**  
> Trạng thái: **SOURCE 28/30 — RUNTIME 14/30 — S2C ARCHIVE DESIGN NEXT**

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
PR #68 dead settings retirement:   +7
Source merged:                     28/30
Original routes remaining:         2
Runtime verified:                  14/30
```

## PR #68 — Route-settings mutation retirement

```text
PR:                    #68 MERGED / SOURCE PASS
Merge SHA:             2fea8a36e6c1305a8de499cc2e0b740a39a406d7
Foundation F0.2:       #564 PASS
Browser workflow:      NOT TRIGGERED — backend/audit-only path
Supabase migration:    NONE
VPS pullmcp:           NO
Vercel deploy:         NO
Production runtime:    UNCHANGED
```

A full-repository inventory found no live POST caller for seven legacy route-settings mutations. The current `/mcp-setting` screen uses `/api/mcp-report-settings`, already typed and persisted-idempotent. Live `session-status` references are GET reads only.

PR #68 removed seven legacy POST branches, seven save helpers and five private normalizers. Required GET readers remain. No RPC or schema was dropped.

Audit evidence:

- immutable baseline remains unchanged;
- exact retirement reclassification overlay contains seven fingerprints;
- owner and operation cannot change during reclassification;
- completion ledger phase is `A5.5.2`;
- scanner PASS with `legacy_debt=0`, `forbidden=0`, `unclassified=0`;
- 34 retired fingerprints total.

Decision document:

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

## Remaining original 2 — S2c cross-system archive

```text
POST /api/routes/:id/archive
POST /api/route-customers/:id/archive
```

Existing Foundation owner already has private R2 deletion lifecycle, parent delete jobs, retry/reclaim and guarded hard-delete. Missing piece is persisted replay/conflict/audit for the public intent across an asynchronous cross-system workflow.

Do not pretend PostgreSQL and R2 share one transaction. The final source slice must design:

```text
client intent claim
-> exact target/job linkage
-> resumable R2 deletion
-> cleanup-compatible finalizer
-> persisted terminal response/audit
```

## Production debt still pending

PR #64–#68 are not production runtime evidence. Required rollout includes migrations where applicable, `pullmcp`, `pm2 list`, health on `127.0.0.1:3001`, execute/replay/conflict/audit/context/invariant smoke and complete fixture cleanup.

MCP/R2/mobile test still pending: AppShell/feedback mobile, R2 create/view/delete, customer photo preview, standalone order, cleanup timer and UX issues found by the owner.

## Point to continue

1. Read the existing archive/delete-job transaction and retry owners.
2. Lock S2c intent/job/finalizer invariants before code.
3. Implement the two archive intents in one cross-system slice.
4. No production rollout unless explicitly requested.
