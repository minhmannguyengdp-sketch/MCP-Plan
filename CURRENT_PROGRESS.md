# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **ROUTE -> ACTIVE SESSION DEPLOYED + DB VERIFIED — VPS BOUNDARY PASS — F05 RUNTIME RERUN + UI SMOKE PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Trên VPS chạy `pullmcp` để nhận fix PR #30.
2. Chạy lại test/runtime/smoke-f05-runtime-closure.mjs.
3. Chỉ khi có F05_RUNTIME_CLOSURE_SMOKE=PASS + fixtureCleanup=PASS mới đóng runtime gate.
4. Smoke Gateway route-customer add execute/replay/conflict/audit.
5. Chuẩn hóa fixture hoặc session state để có đúng một active session rồi UI smoke cả hai lựa chọn.
6. Regression UI Thêm khách trong Phiên.

KHÔNG bắt đầu A5.5.2.
KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

## 2. Vị trí master plan

```text
Plan:              ke-hoach-app-van-hanh-npp.md
Phase:             Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
```

F05 runtime phải hoàn tất trước A5.5.2, NPP-F06 và Order Core.

## 3. Hotfix route master -> active session explicit sync

```text
PR:                    #29 — MERGED
Branch head:           d5cda4aab4be655717f03560a7d985177bce41be
Merge SHA:             5276abc8abe1c860b9b13d83cc567a2483a47f60
Final CI:              Foundation F0.2 #315 — PASS
CI run ID:             29586644169
Scanner/backend/TS:    PASS
Next production build: PASS
Supabase migrations:   APPLIED + VERIFIED
DB smoke:              ROUTE_ACTIVE_SESSION_DB_SMOKE=PASS
Fixture cleanup:       true
Vercel production:     READY — main SHA 46e55c0f32d4533785326ac752f95230b9e50e8b
VPS Foundation:        F0.2_VPS_SMOKE=PASS
UI functional smoke:   PENDING
Evidence:              docs/npp-plan/ROUTE_ACTIVE_SESSION_SYNC_RELEASE.md
```

### Hành vi đã triển khai

```text
0 active session  -> thêm route master, không prompt
1 active session  -> hỏi hai lựa chọn
>1 active session -> từ chối vì session state mơ hồ
```

Prompt:

```text
Tuyến này đang có phiên hoạt động. Thêm khách vào phiên hiện tại luôn?
```

Hai lựa chọn:

```text
1. Thêm vào tuyến và phiên — mặc định.
2. Chỉ thêm vào tuyến — áp dụng từ phiên sau.
```

### Ownership và transaction

- `mcp_route_customers` là route master cho phiên tương lai.
- `mcp_session_customers` là snapshot vận hành của phiên hiện tại.
- Chỉ `includeActiveSession=true` mới thêm/resolve snapshot vào exact active session.
- UI dùng một `Idempotency-Key` cho một user intent qua prompt/retry.
- Foundation sở hữu typed operation `route-customer.add`.
- RPC khóa session trước rồi route, resolve duplicate và persist idempotency/audit trong cùng transaction.
- Không background/render/reload sync và không copy lại toàn tuyến.
- Existing visit status, check-in và operational links không bị rewrite.
- Session done/completed/cancelled/closed bị từ chối.

### DB evidence

```text
Applied:
- route_active_session_explicit_sync
- route_active_session_explicit_context_fix

Function security definer:       true
service_role execute:            true
anon/authenticated execute:      false
route/session duplicate smoke:   PASS
replay/conflict:                 PASS
state preservation:              PASS
closed session guard:            PASS
rollback cleanup:                PASS
```

Smoke đầu tiên bắt được thiếu explicit `session_id` trong snapshot `source=added`; trigger hiện hữu từ chối đúng. Không hạ guard. RPC, regression test và forward migration đã được sửa; CI #315 và DB smoke sau fix đều pass.

### Production data observation

Preflight không có duplicate `(session_id, route_customer_id)`. Tuy nhiên hiện không có route nào đúng một active session; các route có active đều mang nhiều row active cũ. UI cố ý chặn case mơ hồ. Hotfix không tự sửa hoặc tự đóng session lịch sử.

## 4. Hotfix Thêm khách trong Phiên

```text
PR:                  #28 — MERGED
Merge SHA:           dc000bd9b6e1ead9d4ae40eca429fd94d9c9cbad
CI:                  Foundation F0.2 #294 — PASS
Vercel production:   READY
VPS Foundation:      DEPLOYED
UI functional smoke: PENDING
```

Root cause đã sửa: caller UI dùng `idempotentMutationFetch` với operation `session-customer.add`, giữ một key qua retry; backend vẫn bắt buộc key.

Evidence: `docs/npp-plan/SESSION_ADD_CUSTOMER_IDEMPOTENCY_FIX.md`.

## 5. Session UI + manual check-in

```text
PR:                     #26 — MERGED
Merge SHA:              6c1a3b8e9d74489abb4d3a1409faeb812543a105
CI:                     Foundation F0.2 #271 — PASS
Supabase:               APPLIED + VERIFIED
DB check-in/replay:     PASS
DB conflict/undo:       PASS
Business restore:       rollbackEqual=true
Outlet GPS unchanged:   true
Visit status unchanged: true
VPS/Gateway boundary:   PASS
Runtime flow:           RERUN PENDING
```

Evidence: `docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md`.

## 6. Repeatable F05 runtime smoke

```text
Original PR:       #27 — MERGED
Original merge:    a59dfdc01c6755ef426753c3c8216cc460b747d2
Fix PR:            #30 — MERGED AFTER CI PASS
Fix head:          3875aef1565134d7b38b395c720fa0ce97c2b6ca
Fix CI:            Foundation F0.2 #320 — PASS
Fix CI run ID:     29593856963
Smoke file:        test/runtime/smoke-f05-runtime-closure.mjs
Expected:          F05_RUNTIME_CLOSURE_SMOKE=PASS + fixtureCleanup=PASS
Runtime rerun:     PENDING
```

### VPS evidence hiện có

```text
pullmcp:                       PASS
F0.2_VPS_SMOKE:                PASS
Gateway port 3001:             LISTEN
Legacy internal port 3102:     LISTEN
Initial F05 runtime attempt:   FAIL
Initial error:                 outlet_before_missing
Initial cleanup report:        f05_runtime_cleanup_failed
Production fixture leak:       NONE
```

Root cause của lần FAIL không phải deployer hay check-in mutation:

- smoke cũ gọi typed `POST /api/route-customers` nhưng thiếu `Idempotency-Key`;
- metadata fixture F05 không khớp guarded hard-delete contract hiện hữu, nên route được xóa nhưng response có `smokeCleanup=false`;
- nested `AggregateError` che mất cleanup error con.

PR #30 sửa smoke tooling theo đúng owner và guard hiện hữu; không mở rộng production hard-delete guard, không đổi schema/business mutation và không đụng port 3002.

Evidence: `docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md`.

## 7. A5.5.1 persisted idempotency

```text
PR:                    #25 — MERGED
Merge SHA:             504c2e18453ad068fd2640a97d21154050602b81
CI/DB smoke:           PASS
Scope complete:        9/30 mutation route cases
Legacy remaining:      21 — NOT STARTED
VPS boundary:          PASS
Full runtime release:  PENDING F05 rerun
```

Evidence:

```text
docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

## 8. Runtime và local sync

```text
VPS source:      /var/www/mcp-plan-source
VPS runtime:     /var/www/mcp-plan-backend
PM2:             mcp-plan-backend
Gateway:         127.0.0.1:3001
legacy internal: 127.0.0.1:3102
milktea:         3002 — KHÔNG ĐỤNG
```

Lệnh rerun sau khi PR #30 có trên `main`:

```bash
pullmcp
cd /var/www/mcp-plan-source
node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
```

## 9. Gate đóng F05

```text
Route master -> active session source + DB + merge + deploy      PASS
VPS pullmcp => F0.2_VPS_SMOKE=PASS                               PASS
F05 smoke tooling drift fix / CI                                 PASS
F05 runtime smoke rerun                                           PENDING
fixtureCleanup                                                    PENDING
Gateway replay/conflict/undo/audit                                PENDING runtime evidence
UI route -> active session cả hai lựa chọn                         PENDING
UI Thêm khách trong Phiên lưu thành công                          PENDING
Progress + evidence cập nhật                                      PASS
```

Không chỉ ghi trạng thái trong chat.
