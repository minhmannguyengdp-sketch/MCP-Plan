# MCP-Plan — Current Progress

> Đọc file này trước khi tiếp tục.  
> Cập nhật: **2026-07-20**  
> Phase: **A / NPP-F05 / A5.5.2**  
> Trạng thái: **SOURCE 30/30 — RUNTIME BACKEND DEPLOYED — GUARDED LIVE SMOKE PENDING — VERCEL UI DEPLOY TRIGGERED**

## Quyết định hiện tại

- NPP-F05/A5.5.2 đã khép đủ original source inventory `30/30`.
- Chín migration production từ `20260719190000` đến `20260720224600` đã được áp dụng theo đúng version/tên file trong repository.
- Backend Foundation đã rollout bằng `pullmcp`; `178/178` tests PASS, environment validation PASS và `F0.2_VPS_SMOKE=PASS` trên port `3001`.
- Không ghi runtime `30/30` cho đến khi có guarded authenticated execute/replay/conflict/audit smoke và cleanup evidence.
- Commit này phê duyệt riêng Vercel rollout cho PR #73; không mở rộng phạm vi sang thay đổi backend/database mới.
- Không bắt đầu NPP-F06 hoặc Order Core trước khi chốt lượt production smoke Foundation đang nợ.
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
Runtime formally verified:         14/30
Backend source deployed:           30/30
Guarded runtime evidence pending:  16 operations
```

## PR #73 — fullscreen mobile order flow

```text
PR:                    #73 MERGED / CI PASS
Merge SHA:             c3601db38b286c6171035062dd30bfa2a5793e1c
Foundation F0.2:       #603 PASS
Backend/schema change: NONE
VPS dependency:        SATISFIED BY APPROVED BACKEND ROLLOUT
Vercel deploy:         TRIGGERED BY THIS COMMIT
```

UX boundary:

```text
true 100vw × 100dvh order workspace
-> no drag handle / top border / inherited outer padding
-> fixed header and footer with safe-area ownership
-> mobile panels: Khách / Sản phẩm / Đơn
-> only one active business panel and one scroll owner on mobile
-> whole product row is a touch target
-> immediate add confirmation + visible selected quantity
-> persistent Xem đơn action
-> primary action routes to missing prerequisite before submit
-> desktop two-column catalog + live cart retained
```

## PR #72 — large searchable order workspace

```text
PR:                    #72 MERGED / CI PASS
Merge SHA:             757cab25c5348bf96a2cc1410ca0a0677c454970
Foundation F0.2:       #600 PASS
Backend/schema change: NONE
Previous Vercel deploy: READY
```

UX boundary:

```text
desktop two-column catalog + live cart
-> realtime product search after 250ms
-> category and brand filters
-> no 30-row UI cap
-> compact text with touchable controls
```

## Production migration/backend rollout — COMPLETE

Applied migration history:

```text
20260719190000_add_standalone_order_create
20260719200000_a5_5_2_session_lifecycle_idempotency
20260719210000_a5_5_2_route_master_write_idempotency
20260719220000_a5_5_2_route_customer_update_idempotency
20260720210000_allow_route_customer_profile_media
20260720223000_add_archive_intents
20260720223500_link_archive_intent_delete_job_terminal
20260720224500_lock_archive_intent_claims
20260720224600_preserve_archive_terminal_failure
```

Database verification:

```text
migration version/name alignment: PASS
required owner/RPC existence: PASS
service-role-only mutation grants: PASS
archive advisory lock order: key -> target PASS
archive terminal-failure guard: PASS
archive delete-job triggers: PASS
fixed-route outlet media nullable session boundary: PASS
```

VPS verification:

```text
backend tests:          178/178 PASS
runtime env:            public=127.0.0.1:3001 legacy=127.0.0.1:3102
mcp-plan-backend:       online / restart 0
health:                 200
without token:          401
with token:             200
blocked origin:         403
F0.2_VPS_SMOKE:         PASS
runtime backup:         /var/www/mcp-plan-backend.backup.20260720-143750
milktea-backend/3002:   untouched
```

## PR #70/#71 — S2c cross-system archive intents

```text
PR #70:                MERGED / SOURCE PASS
PR #70 merge SHA:      a0de1b15eeb84b12d1fcb5f7bc1f3ce789a40cc0
PR #71 concurrency:    MERGED / SOURCE PASS
PR #71 merge SHA:      ec355b7118aca66d086d68a0b3b0326b4f26ba06
Supabase migrations:   APPLIED
VPS pullmcp:           PASS
Guarded live smoke:    PENDING
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

## Guarded production evidence still pending

Use temporary guarded fixtures only. Do not use real production route/customer/session data for destructive smoke.

Required evidence:

```text
standalone order create execute/replay/conflict
session lifecycle execute/replay/conflict
route create/update execute/replay/conflict
route-customer update execute/replay/conflict
trusted request/installation/actor context
append-only audit rows
business/lifecycle invariants
R2 archive retry/reclaim/finalizer
complete database and R2 fixture cleanup
```

## Point to continue

1. Verify the production Vercel deployment created by this `deploy:` commit.
2. Smoke `/orders` on mobile: fullscreen geometry, one scroll owner, customer selection, product-row tap, immediate quantity/cart feedback and final create action.
3. Check Vercel runtime logs for the exact order request and verify the backend returns the canonical create result.
4. Run standalone order replay/conflict smoke with guarded fixture cleanup.
5. Run the remaining guarded authenticated smoke inventory and archive lifecycle evidence.
6. Only after all evidence passes, update runtime coverage from `14/30` to `30/30`.
7. Then begin NPP-F06: production DB versus repository migrations/functions/policies/grants reconciliation.
