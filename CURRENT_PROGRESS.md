# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-18**  
> Master plan: **Phase A / NPP-F05 / A5.5**  
> Trạng thái: **NPP-F05 PASS — A5.5.2 BACKEND COVERAGE 13/30 PASS — FRONTEND REDEPLOY PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Merge evidence runtime của PR #41 vào main.
2. Commit evidence này dùng để kích lại Vercel production đúng một lần.
3. Chỉ khi current main deploy READY mới chạy live UI smoke cho:
   - tạo đơn;
   - lưu kết quả test;
   - lưu báo cáo thị trường;
   - tạo follow-up.
4. Xác nhận request có Idempotency-Key và UI không lỗi 400.
5. Sau frontend production PASS mới bắt đầu slice A5.5.2 kế tiếp:
   - open-session;
   - session-customer status;
   - PATCH/DELETE session;
   - destructive route/session mutations theo inventory.

KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

Lý do chưa chuyển ngay sang slice kế tiếp: backend PR #41 đã chạy production, nhưng Vercel status của merge SHA bị `build-rate-limit`. Frontend production cũ có thể chưa gửi stable `Idempotency-Key`, trong khi Gateway mới đã bắt buộc key cho bốn route.

## 2. Vị trí master plan

```text
Plan:              ke-hoach-app-van-hanh-npp.md
Phase:             Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
Current subphase:  A5.5.2 — IN PROGRESS
Verified coverage: 13/30
Remaining:         17 mutation routes
```

## 3. PR #41 — session action idempotency slice

```text
PR:                  #41 — MERGED
Branch:              feat/a5-5-2-session-actions
Final head:          709fdc8e1ea1d2d21594f8ba55d6eba7e49b2c8c
Merge SHA:           73d26b95d74b51627449d3bddb169114c097358e
Scope:               order / test / report / follow-up
Foundation workflow: #379 PASS
Browser workflow:    #31 PASS
Migration:           a5_5_2_session_action_idempotency — APPLIED
VPS pullmcp:         PASS
Backend runtime:     PASS
Frontend Vercel:     PENDING — build-rate-limit on merge SHA
Evidence:            docs/npp-plan/A5_5_2_SESSION_ACTION_RUNTIME_PASS.md
```

Kiến trúc:

```text
UI user intent
-> idempotentMutationFetch với stable key
-> Next backend proxy
-> Foundation Gateway typed owner
-> typed idempotent wrapper RPC
-> existing business RPC
-> mutation + audit + completed response trong cùng transaction
```

Bốn route đã retire khỏi legacy proxy ownership:

```text
POST /api/mcp-day/session-customer/order
POST /api/mcp-day/session-customer/test
POST /api/mcp-day/session-customer/report
POST /api/mcp-day/session-customer/followup
```

Operation inventory:

```text
session-customer.order.create
session-customer.test.create
session-customer.report.create
session-customer.followup.create
```

## 4. Production runtime evidence PR #41

```text
Runtime backup: /var/www/mcp-plan-backend.backup.20260718-121507
Gateway:        http://127.0.0.1:3001
Health:         PASS
Envelope:       PASS
Fixture cleanup PASS
```

```text
order     execute PASS / replay PASS / conflict PASS / audit PASS / context PASS
test      execute PASS / replay PASS / conflict PASS / audit PASS / context PASS
report    execute PASS / replay PASS / conflict PASS / audit PASS / context PASS
follow-up execute PASS / replay PASS / conflict PASS / audit PASS / context PASS
```

Aggregate smoke IDs đã được cleanup:

```text
order_4f5d32899bee497da60426d58e0be416
test_result_e8f2302328e74e24add0932b16bc4569
report_5030dc60f2d745a8926513682db58371
mcf_4a7f7e817c634d9a9377c601de171e21
```

Kết luận: backend coverage A5.5 tăng từ **9/30 lên 13/30**. Không còn điều kiện chờ migration/VPS/runtime cho bốn operation này.

## 5. Gate NPP-F05

```text
Route master -> active session source + DB                         PASS
Single-active session lifecycle migration + production verify      PASS
Typed route -> active session rollback smoke                       PASS
VPS pullmcp / F0.2 boundary                                        PASS
F05 runtime closure                                                 PASS
fixtureCleanup                                                      PASS
Gateway replay/conflict/undo/audit                                  PASS
Outlet GPS + visit-status preservation                              PASS
Next production build + Chromium browser smoke                      PASS
Browser route không active session                                  PASS
Browser route active / include current session                      PASS
Browser route active / route-only                                   PASS
Browser duplicate reuse                                             PASS
Browser Thêm khách trong Phiên                                      PASS
Browser manual check-in + undo                                      PASS
Unified mobile menu / triggerCount=1                                PASS
Standalone settings button removed                                 PASS
Standalone session menu button removed                             PASS
Menu report / export / close / settings                            PASS
PDF / Excel canonical links                                        PASS
Live Vercel production click smoke                                  PASS — user confirmed
```

NPP-F05 đã đóng. Không mở lại trừ regression có bằng chứng.

## 6. Mobile UI architecture đã khóa

```text
Bottom navigation = chuyển phân hệ
Mobile ☰         = một menu dùng chung toàn app
Screen feature   = đăng ký action vào menu chung
Settings         = một item trong menu chung
```

Không được khôi phục:

```text
nút bánh răng fixed riêng
nút ⋮ riêng của màn Phiên
cụm BC phiên / Xuất / Chốt phiên fixed
```

PR #39 merge SHA `72ab29e37f55d94545c80de0cb91b48ad1fdc543`; evidence `docs/npp-plan/SESSION_ACTION_MENU_UI_RELEASE.md`.

## 7. Foundation/A5.5 nền đã xác minh

```text
A5.5.1 PR:             #25 — MERGED
A5.5.1 coverage:       9/30
A5.5.2 first slice:    +4
Current verified:      13/30
Remaining:             17
Idempotency core DB:   PASS
Append-only audit:     PASS
Gateway runtime:       PASS
F05 runtime closure:   PASS
```

Route/customer active-session sync:

```text
0 active session  -> thêm route master, không prompt
1 active session  -> hỏi hai lựa chọn
>1 active session -> từ chối trạng thái mơ hồ
```

Single-active invariant production: `max_active_per_route=1`, `ambiguous_routes=0`.

## 8. Runtime và deploy

```text
VPS source:          /var/www/mcp-plan-source
VPS runtime:         /var/www/mcp-plan-backend
PM2:                 mcp-plan-backend
Gateway:             127.0.0.1:3001
Legacy internal:     127.0.0.1:3102
Milktea backend:     3002 — KHÔNG ĐỤNG
Frontend current UI: Vercel production
PR #41 frontend:     PENDING REDEPLOY due build-rate-limit
```

Không chỉ ghi trạng thái trong chat.
