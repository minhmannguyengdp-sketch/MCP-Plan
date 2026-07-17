# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **ROUTE -> ACTIVE SESSION + SINGLE-ACTIVE LIFECYCLE DB VERIFIED — F05 RUNTIME RERUN + UI SMOKE PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Trên VPS chạy `pullmcp` để nhận source fix PR #30/#31.
2. Chạy lại test/runtime/smoke-f05-runtime-closure.mjs.
3. Chỉ khi có F05_RUNTIME_CLOSURE_SMOKE=PASS + fixtureCleanup=PASS mới đóng runtime gate.
4. Trên UI tuyến Thứ 6 thử thêm điểm bán với cả hai lựa chọn prompt.
5. Regression UI Thêm khách trong Phiên.
6. Deploy lại Vercel merge SHA PR #31 khi build-rate-limit cho phép để nhận copy lỗi rõ hơn.

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

F05 runtime và UI smoke phải hoàn tất trước A5.5.2, NPP-F06 và Order Core.

## 3. Hotfix route master -> active session explicit sync

```text
PR:                    #29 — MERGED
Merge SHA:             5276abc8abe1c860b9b13d83cc567a2483a47f60
Final CI:              Foundation F0.2 #315 — PASS
Supabase migrations:   APPLIED + VERIFIED
DB smoke:              ROUTE_ACTIVE_SESSION_DB_SMOKE=PASS
Vercel production:     READY — source prompt đã deploy
VPS Foundation:        F0.2_VPS_SMOKE=PASS
UI functional smoke:   PENDING
Evidence:              docs/npp-plan/ROUTE_ACTIVE_SESSION_SYNC_RELEASE.md
```

Hành vi:

```text
0 active session  -> thêm route master, không prompt
1 active session  -> hỏi hai lựa chọn
>1 active session -> từ chối vì session state mơ hồ
```

Ownership:

- `mcp_route_customers`: route master cho phiên tương lai;
- `mcp_session_customers`: snapshot vận hành phiên hiện tại;
- chỉ `includeActiveSession=true` mới thêm/resolve exact active snapshot;
- một user intent giữ một `Idempotency-Key`;
- typed operation `route-customer.add` khóa session trước rồi route;
- không background/render/reload sync, không copy lại toàn tuyến;
- existing visit/check-in/result/order/report/follow-up không bị rewrite.

## 4. Incident nút Thêm điểm bán và single-active lifecycle

```text
PR:                    #31 — MERGED
Merge SHA:             0fefd6e724bed25b829bbbaf61b81537bb4a5967
Final head CI:         Foundation F0.2 #325 — PASS
CI run ID:             29595626624
Migration:             single_active_route_session — APPLIED
Production DB verify:  PASS
Typed rollback smoke:  PASS
Vercel merge deploy:   BLOCKED — build-rate-limit
UI retry:              PENDING
Evidence:              docs/npp-plan/SINGLE_ACTIVE_ROUTE_SESSION_HOTFIX.md
```

### Root cause

Nút không hỏng ở GPS hoặc `route-customer.add`. UI dừng ở preflight vì tuyến `Thứ 6` có năm phiên cùng `active`; request tạo điểm bán chưa được gửi. Error mapper cũ biến nguyên nhân thành câu chung chung.

DB trước hotfix chỉ unique `(route_id, session_date)` và cho phép mở ngày mới khi ngày cũ vẫn active.

### Sửa đúng lifecycle

- repair historical duplicate active sessions;
- newest giữ `active`;
- phiên cũ có hoạt động đi qua canonical close path thành `done`;
- phiên cũ không hoạt động thành `cancelled`;
- partial unique index đảm bảo tối đa một active session mỗi route;
- `mcp_open_route_session` finalize phiên active cũ hơn trước khi mở ngày mới;
- lock order `session -> route`, tránh deadlock với add-customer;
- không xóa hoặc rewrite operational rows;
- UI map rõ lỗi active-session lifecycle.

### Production evidence

Invariant toàn DB:

```text
max_active_per_route = 1
ambiguous_routes     = 0
```

Tuyến `Thứ 6`:

```text
17/07 active
10/07 cancelled
05/07 done
04/07 done
03/07 done
```

Dữ liệu visit, session customers và follow-up cũ còn nguyên; các phiên `done` có close report snapshot.

DB objects:

```text
mcp_route_sessions_one_active_per_route_uidx: EXISTS
mcp_open_route_session security definer:       true
session/route row locks:                       true
older-session finalization:                    true
new-session snapshot-once path:                true
```

Typed rollback smoke trên route `Thứ 6` + phiên 17/07:

```text
route customer create:   PASS
session customer create: PASS
visit_status=pending
operational links untouched
route/session/idempotency/audit leaks after rollback: 0
```

Frontend production hiện tại đã có prompt từ PR #29. DB repair đưa preflight về đúng một active session nên nút có thể đi tiếp tới prompt/mutation ngay; phần copy lỗi rõ hơn của PR #31 chờ Vercel quota.

## 5. Hotfix Thêm khách trong Phiên

```text
PR:                  #28 — MERGED
Merge SHA:           dc000bd9b6e1ead9d4ae40eca429fd94d9c9cbad
CI:                  Foundation F0.2 #294 — PASS
Vercel production:   READY
VPS Foundation:      DEPLOYED
UI functional smoke: PENDING
```

Caller UI dùng `idempotentMutationFetch` với operation `session-customer.add`, giữ một key qua retry; backend vẫn bắt buộc key.

Evidence: `docs/npp-plan/SESSION_ADD_CUSTOMER_IDEMPOTENCY_FIX.md`.

## 6. Session UI + manual check-in

```text
PR:                     #26 — MERGED
CI:                     Foundation F0.2 #271 — PASS
Supabase:               APPLIED + VERIFIED
DB check-in/replay:     PASS
DB conflict/undo:       PASS
Outlet GPS unchanged:   true
Visit status unchanged: true
VPS/Gateway boundary:   PASS
Runtime flow:           RERUN PENDING
```

Evidence: `docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md`.

## 7. Repeatable F05 runtime smoke

```text
Original PR:       #27 — MERGED
Fix PR:            #30 — MERGED
Fix CI:            Foundation F0.2 #320 — PASS
Smoke file:        test/runtime/smoke-f05-runtime-closure.mjs
Expected:          F05_RUNTIME_CLOSURE_SMOKE=PASS + fixtureCleanup=PASS
Runtime rerun:     PENDING
```

VPS evidence hiện có:

```text
pullmcp:                       PASS
F0.2_VPS_SMOKE:                PASS
Gateway port 3001:             LISTEN
Legacy internal port 3102:     LISTEN
Initial F05 runtime attempt:   FAIL — tooling drift
Production fixture leak:       NONE
```

PR #30 sửa fixture idempotency/cleanup contract; cần `pullmcp` lại rồi rerun.

Evidence: `docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md`.

## 8. A5.5.1 persisted idempotency

```text
PR:                    #25 — MERGED
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

## 9. Runtime và lệnh tiếp tục

```text
VPS source:      /var/www/mcp-plan-source
VPS runtime:     /var/www/mcp-plan-backend
PM2:             mcp-plan-backend
Gateway:         127.0.0.1:3001
legacy internal: 127.0.0.1:3102
milktea:         3002 — KHÔNG ĐỤNG
```

```bash
pullmcp
cd /var/www/mcp-plan-source
node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
```

## 10. Gate đóng F05

```text
Route master -> active session source + DB + merge + deploy      PASS
Single-active session lifecycle migration + DB verification      PASS
Typed route -> active session rollback smoke                      PASS
VPS pullmcp => F0.2_VPS_SMOKE=PASS                               PASS
F05 smoke tooling drift fix / CI                                 PASS
F05 runtime smoke rerun                                           PENDING
fixtureCleanup                                                    PENDING
Gateway replay/conflict/undo/audit                                PENDING runtime evidence
UI route -> active session cả hai lựa chọn                         PENDING
UI Thêm khách trong Phiên lưu thành công                          PENDING
Vercel PR #31 copy deployment                                     PENDING build quota
Progress + evidence cập nhật                                      PASS
```

Không chỉ ghi trạng thái trong chat.
