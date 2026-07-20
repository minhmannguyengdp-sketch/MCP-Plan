# MCP-Plan — Current Progress

> Đọc file này trước khi tiếp tục.  
> Cập nhật: **2026-07-20**  
> Phase: **A / NPP-F05 / A5.5.2**  
> Trạng thái: **SOURCE 30/30 — RUNTIME 14/30 — PRODUCTION ROLLOUT PENDING**

## Quyết định hiện tại

- NPP-F05/A5.5.2 đã khép đủ original source inventory `30/30`.
- Không ghi runtime PASS cho PR #64–#70 khi chưa rollout migration/backend và có authenticated smoke/cleanup evidence.
- Chưa bắt đầu NPP-F06 hoặc Order Core trước khi chốt lượt rollout Foundation đang nợ.
- Hoãn mobile production test/fix MCP sang pass riêng; không hủy các live-smoke gate.
- Không đụng `milktea-backend` hoặc port `3002`.

## Coverage

Baseline cũ `13/30` thiếu `route-customer.add`; baseline đúng là `14/30`.

```text
PR #65 session lifecycle:          +4
PR #66 route create/update:        +2
PR #67 route-customer edit:        +1
PR #68 dead settings retirement:   +7
PR #70 archive intents:            +2
Source merged:                     30/30
Original routes remaining:          0
Runtime verified:                  14/30
```

## PR #70 — S2c cross-system archive intents

```text
PR:                    #70 MERGED / SOURCE PASS
Merge SHA:             a0de1b15eeb84b12d1fcb5f7bc1f3ce789a40cc0
Foundation F0.2:       #592 PASS
F05 Browser Smoke:     #156 PASS
Supabase migrations:   20260720223000_add_archive_intents.sql
                       20260720223500_link_archive_intent_delete_job_terminal.sql
Migration applied:     NO
VPS pullmcp:           NO
Production smoke:      NO
Vercel deploy:         NO
```

Public operations closed:

```text
POST /api/routes/:id/archive           route.archive
POST /api/route-customers/:id/archive  route-customer.archive
```

Root boundary:

```text
persisted user intent
-> exact target/storage-delete-job linkage
-> existing resumable private R2 lifecycle
-> guarded parent hard-delete
-> cleanup-compatible terminal finalizer
-> persisted response + append-only Foundation audit
```

Guarantees:

- same key/same payload replays one persisted terminal result;
- same key with another target or payload conflicts;
- one target cannot create competing storage-delete jobs;
- intent and newly claimed delete job are linked in the same PostgreSQL job transaction;
- the archive owner reuses `outlet-media.js`; it does not duplicate R2 deletion logic;
- R2 failure blocks parent hard-delete and leaves work reclaimable;
- a cleanup-completed job finalizes its linked intent and audit;
- browser roles cannot mutate intent/job persistence directly;
- no PostgreSQL/R2 fake transaction and no object key/provider detail in the public result.

Decision document:

```text
docs/npp-plan/A5_5_2_S2C_ARCHIVE_INTENTS.md
```

## Earlier merged A5.5.2 source slices

```text
PR #68 route-settings retirement
Merge: 2fea8a36e6c1305a8de499cc2e0b740a39a406d7
Migration: none

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

## Production debt still pending

PR #64–#70 source PASS is not production runtime evidence. The rollout must use temporary guarded fixtures only and include:

```text
ordered pending migrations
-> pullmcp
-> pm2 list
-> health http://127.0.0.1:3001/health
-> authenticated execute/replay/conflict smoke
-> audit + trusted request/installation/actor context
-> lifecycle/business invariants
-> R2 archive retry/reclaim/finalizer
-> complete database and R2 fixture cleanup
```

Do not use real production route/customer/session data for destructive smoke.

MCP/R2/mobile test still pending: AppShell/feedback mobile, R2 create/view/delete, customer photo preview, standalone order, cleanup timer and UX issues found by the owner.

## Point to continue

1. Do not deploy automatically; wait for explicit production rollout approval.
2. On approval, apply all pending migrations in repository order.
3. Run `pullmcp`, verify PM2 and Foundation health on port `3001`.
4. Run guarded authenticated smoke for the 16 pending original operations, including both archive intents and complete cleanup.
5. Only after evidence passes, update runtime coverage from `14/30` to `30/30`.
6. Then begin NPP-F06: production DB versus repository migrations/functions/policies/grants reconciliation.
