# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **F05 RUNTIME CLOSURE PASS — UI FUNCTIONAL SMOKE PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. UI smoke tuyến không có active session: thêm route master bình thường, không prompt.
2. UI smoke tuyến Thứ 6 có đúng một active session:
   - Thêm vào tuyến và phiên hiện tại.
   - Chỉ thêm vào tuyến cố định.
3. Regression UI Thêm khách trong Phiên lưu thành công.
4. Manual check-in thao tác thật trên UI.
5. Deploy lại Vercel current main khi build-rate-limit cho phép để nhận copy lỗi/lifecycle mới nhất.
6. Chỉ sau khi các UI gate PASS mới bắt đầu A5.5.2.

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

F05 runtime đã đóng. UI functional smoke vẫn phải hoàn tất trước A5.5.2, NPP-F06 và Order Core.

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

Frontend production hiện tại đã có prompt từ PR #29. DB repair đưa preflight về đúng một active session nên nút có thể đi tiếp tới prompt/mutation; phần copy lỗi rõ hơn của PR #31 chờ Vercel quota.

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
Runtime flow:           PASS
UI functional smoke:    PENDING
```

Authenticated runtime evidence:

```text
check-in first:          PASS
check-in replay:         PASS
check-in conflict:       PASS
second-click undo:       PASS
audit:                   PASS
outletGpsUnchanged:      true
visitStatusUnchanged:    true
fixtureCleanup:          PASS
```

Evidence: `docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md`.

## 7. Repeatable F05 runtime closure

```text
Original PR:       #27 — MERGED
Route-owner fix:   #30 — MERGED
Parser fix:        #33 — MERGED
Parser merge SHA:  6020c2f8b5783241ecbb2c3b1b28be577cbb941b
Final parser CI:   Foundation F0.2 #329 — PASS
CI run ID:         29596820247
Smoke file:        test/runtime/smoke-f05-runtime-closure.mjs
Runtime rerun:     PASS
fixtureCleanup:    PASS
```

Root cause của lần `outlet_before_missing` cuối:

- Supabase PostgREST trả row array;
- smoke parser cũ ép array thành object rỗng;
- `db()` diễn giải thành `[]` và báo false negative;
- PR #33 giữ nguyên JSON type, normalize object chỉ tại Gateway envelope, DB read bắt buộc array.

VPS evidence:

```text
127.0.0.1:3001 LISTEN
127.0.0.1:3102 LISTEN
F0.2_VPS_SMOKE=PASS
Previous runtime backup: /var/www/mcp-plan-backend.backup.20260717-164200
```

Output thật:

```text
F05_RUNTIME_CLOSURE_SMOKE=PASS
health=PASS
canonicalEnvelope=PASS
checkin first/replay/conflict/undo/audit=PASS
outletGpsUnchanged=true
visitStatusUnchanged=true
foundationResult first/replay/conflict/audit=PASS
responsePreserved=true
fixtureCleanup=PASS
```

Evidence: `docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md`.

## 8. A5.5.1 persisted idempotency

```text
PR:                    #25 — MERGED
CI/DB smoke:           PASS
Scope complete:        9/30 mutation route cases
Legacy remaining:      21 — NOT STARTED
VPS boundary:          PASS
Gateway runtime:       PASS
Full release:          VERIFIED
```

Runtime Foundation result mutation đã chứng minh:

```text
first execute:                PASS
same key + payload replay:    PASS
same key + changed payload:   conflict PASS
persisted response preserved: true
audit succeeded + replayed:   PASS
fixture cleanup:              PASS
```

Evidence:

```text
docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

## 9. Runtime

```text
VPS source:      /var/www/mcp-plan-source
VPS runtime:     /var/www/mcp-plan-backend
PM2:             mcp-plan-backend
Gateway:         127.0.0.1:3001
legacy internal: 127.0.0.1:3102
milktea:         3002 — KHÔNG ĐỤNG
```

## 10. Gate đóng NPP-F05

```text
Route master -> active session source + DB + deploy              PASS
Single-active session lifecycle migration + DB verification      PASS
Typed route -> active session rollback smoke                      PASS
VPS pullmcp => F0.2_VPS_SMOKE=PASS                               PASS
F05 smoke tooling fixes / CI                                      PASS
F05 runtime smoke rerun                                           PASS
fixtureCleanup                                                    PASS
Gateway replay/conflict/undo/audit                                PASS
Outlet GPS + visit status preservation                            PASS
UI route không active session                                     PENDING
UI route -> active session cả hai lựa chọn                         PENDING
UI Thêm khách trong Phiên lưu thành công                          PENDING
UI manual check-in thao tác thật                                  PENDING
Vercel PR #31 copy deployment                                     PENDING build quota
Progress + runtime evidence cập nhật                              PASS
```

Chưa chuyển sang A5.5.2 chỉ vì UI functional smoke còn thiếu. Không chỉ ghi trạng thái trong chat.