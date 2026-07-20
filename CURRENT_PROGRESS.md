# MCP-Plan — Current Progress

> Đọc file này trước khi tiếp tục.  
> Cập nhật: **2026-07-20**  
> Phase: **A / NPP-F05 / A5.5.2**  
> Trạng thái: **SOURCE 30/30 — RUNTIME 14/30 — VERCEL UI DEPLOY TRIGGERED — BACKEND ROLLOUT PENDING**

## Quyết định hiện tại

- NPP-F05/A5.5.2 đã khép đủ original source inventory `30/30`.
- Không ghi runtime PASS cho PR #64–#71 khi chưa rollout migration/backend và có authenticated smoke/cleanup evidence.
- Đã có phê duyệt riêng cho Vercel frontend-only rollout của PR #72; không suy diễn thành phê duyệt migration hoặc VPS `pullmcp`.
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

## PR #72 — large searchable order workspace

```text
PR:                    #72 MERGED / CI PASS
Merge SHA:             757cab25c5348bf96a2cc1410ca0a0677c454970
Foundation F0.2:       #600 PASS
Backend/schema change: NONE
VPS pullmcp:           NOT REQUIRED FOR THIS UI SLICE
Vercel deploy:         TRIGGERED BY THIS COMMIT
```

UX boundary:

```text
workspace sheet up to 1180px / 94dvh
-> desktop two-column catalog + live cart
-> realtime product search after 250ms
-> category and brand filters
-> no 30-row UI cap
-> compact text with touchable controls
-> near-full-screen single-column mobile fallback
```

## PR #70/#71 — S2c cross-system archive intents

```text
PR #70:                MERGED / SOURCE PASS
PR #70 merge SHA:      a0de1b15eeb84b12d1fcb5f7bc1f3ce789a40cc0
PR #71 concurrency:    MERGED / SOURCE PASS
PR #71 merge SHA:      ec355b7118aca66d086d68a0b3b0326b4f26ba06
Foundation F0.2:       PASS
Supabase migrations:   20260720223000_add_archive_intents.sql
                       20260720223500_link_archive_intent_delete_job_terminal.sql
                       20260720224500_lock_archive_intent_claims.sql
                       20260720224600_preserve_archive_terminal_failure.sql
Migration applied:     NO
VPS pullmcp:           NO
Production smoke:      NO
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
- claim races are serialized by idempotency key then target;
- intent and delete-job claims remain separate RPC transactions, with persisted re-read across the gap;
- the archive owner reuses `outlet-media.js`; it does not duplicate R2 deletion logic;
- R2 failure blocks parent hard-delete and leaves work reclaimable;
- a cleanup-completed job finalizes its linked intent and audit;
- failed terminal state remains stable until an explicit retry claim;
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

PR #64–#71 source PASS is not production runtime evidence. The rollout must use temporary guarded fixtures only and include:

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

1. Verify the Vercel production deployment created by this `deploy:` commit and smoke the large order workspace.
2. Do not apply pending migrations or run `pullmcp` without separate production backend approval.
3. On backend approval, apply all pending migrations in repository order.
4. Run `pullmcp`, verify PM2 and Foundation health on port `3001`.
5. Run guarded authenticated smoke for the 16 pending original operations, including both archive intents and complete cleanup.
6. Only after evidence passes, update runtime coverage from `14/30` to `30/30`.
7. Then begin NPP-F06: production DB versus repository migrations/functions/policies/grants reconciliation.
