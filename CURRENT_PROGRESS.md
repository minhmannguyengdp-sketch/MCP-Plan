# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 / A5.5**  
> Trạng thái: **RUNTIME CLOSURE PASS + PRODUCTION-BUILD BROWSER SMOKE PASS — LIVE VERCEL UI SMOKE PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Chờ final CI của PR #35 sau commit evidence; chỉ merge khi xanh.
2. Deploy current main lên Vercel khi build-rate-limit cho phép.
3. Trên live production thao tác thật:
   - tuyến không có active session: lưu thẳng, không prompt;
   - tuyến có đúng một active session: thử cả hai lựa chọn;
   - regression Thêm khách trong Phiên;
   - manual check-in và undo.
4. Cập nhật live evidence.
5. Chỉ sau live UI gate mới bắt đầu A5.5.2.

KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

## 2. Vị trí master plan

```text
Plan:              ke-hoach-app-van-hanh-npp.md
Phase:             Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
Next subphase:     A5.5.2 — BLOCKED BY LIVE UI SMOKE
```

## 3. Gate NPP-F05

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
Live Vercel production click smoke                                  PENDING
Vercel current-main deployment                                      PENDING build quota
```

Automated browser smoke không được ghi thay cho live-production click smoke. Nó chứng minh UI/request contract trên Next production build bằng Chromium và stateful mock Gateway, không ghi dữ liệu production.

## 4. PR #35 — repeatable F05 UI browser smoke

```text
PR:                  #35 — OPEN
Branch:              test/f05-ui-browser-smoke
Code head:           9c88fa80cb9d4c4c2714f81c2841e8ad0a953bce
Browser workflow:    F05 UI Browser Smoke #6 — PASS
Browser run ID:      29600091655
Foundation workflow: Foundation F0.2 #338 — PASS
Foundation run ID:   29600091669
Evidence:            docs/npp-plan/F05_UI_BROWSER_SMOKE.md
```

Browser result:

```text
routeNoActive          PASS
routeActiveInclude     PASS
routeActiveRouteOnly   PASS
duplicateReuse         PASS
sessionAddCustomer     PASS
manualCheckin          PASS
F05_UI_BROWSER_SMOKE   PASS
```

Artifact:

```text
name:    f05-ui-browser-smoke-evidence
id:      8414656857
digest:  sha256:50660ac6c9cb53ba02d084b81fc6c546d6d53d721c31ba853c06299ea48d43b3
files:   result/state/logs + 8 screenshots + compiled CSS
```

### UI bug browser smoke bắt được và đã sửa

Popup route-active có hai nút nhưng câu hỏi trong body bị ẩn.

Root cause:

```text
mcp-popup-compact.css
-> selector structural nhận mọi sheet có đúng hai footer buttons
-> ẩn first visit-focus-card
-> prompt route-active chỉ có đúng card đó
-> body trắng, user không thấy câu hỏi
```

Fix:

```text
src/app/mcp-popup-content-ownership.css
-> single owned card (:first-child:last-child) luôn display:grid
-> action popup có decorative card + working content giữ compact behavior cũ
```

Contract test khóa thứ tự import và visibility ownership. Không đổi business mutation, schema hoặc idempotency requirement.

## 5. Route master -> active session explicit sync

```text
PR:                    #29 — MERGED
Merge SHA:             5276abc8abe1c860b9b13d83cc567a2483a47f60
Final CI:              Foundation F0.2 #315 — PASS
Supabase migrations:   APPLIED + VERIFIED
DB smoke:              ROUTE_ACTIVE_SESSION_DB_SMOKE=PASS
VPS Foundation:        F0.2_VPS_SMOKE=PASS
Production prompt:     DEPLOYED từ PR #29
Live functional smoke: PENDING
Evidence:              docs/npp-plan/ROUTE_ACTIVE_SESSION_SYNC_RELEASE.md
```

Hành vi:

```text
0 active session  -> thêm route master, không prompt
1 active session  -> hỏi hai lựa chọn
>1 active session -> từ chối trạng thái mơ hồ
```

Ownership:

- `mcp_route_customers`: route master cho phiên tương lai;
- `mcp_session_customers`: snapshot vận hành phiên hiện tại;
- chỉ `includeActiveSession=true` mới resolve/create snapshot;
- một user intent dùng một `Idempotency-Key`;
- typed operation `route-customer.add` khóa session trước rồi route;
- không background/render/reload sync;
- không rewrite visit/check-in/result/order/report/follow-up.

## 6. Single-active route-session lifecycle

```text
PR:                    #31 — MERGED
Merge SHA:             0fefd6e724bed25b829bbbaf61b81537bb4a5967
Final CI:              Foundation F0.2 #325 — PASS
Migration production:  APPLIED
DB invariant:          max_active_per_route=1 / ambiguous_routes=0
Typed rollback smoke:  PASS
Vercel PR #31 copy:    PENDING build-rate-limit
Evidence:              docs/npp-plan/SINGLE_ACTIVE_ROUTE_SESSION_HOTFIX.md
```

Production tuyến `Thứ 6` sau repair:

```text
17/07 active
10/07 cancelled
05/07 done
04/07 done
03/07 done
```

Dữ liệu visit, session customer, order và follow-up cũ được giữ nguyên.

## 7. Runtime closure và A5.5.1

```text
VPS ports:                 3001 LISTEN / 3102 LISTEN
F0.2_VPS_SMOKE:            PASS
F05_RUNTIME_CLOSURE_SMOKE: PASS
fixtureCleanup:            PASS
check-in execute/replay/conflict/undo/audit: PASS
outletGpsUnchanged:        true
visitStatusUnchanged:      true
Foundation result replay/conflict/audit: PASS
responsePreserved:         true
```

A5.5.1:

```text
PR:               #25 — MERGED
Scope:            9/30 Foundation mutation routes
Code/CI/DB/VPS:   PASS
Gateway runtime:  PASS
Full release:     VERIFIED
Legacy remaining: 21 — A5.5.2 NOT STARTED
```

Evidence:

```text
docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md
docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md
docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

## 8. Runtime và deploy

```text
VPS source:          /var/www/mcp-plan-source
VPS runtime:         /var/www/mcp-plan-backend
PM2:                 mcp-plan-backend
Gateway:             127.0.0.1:3001
Legacy internal:     127.0.0.1:3102
Milktea backend:     3002 — KHÔNG ĐỤNG
Vercel production:   đang ở SHA 54d4f4e0fdddbdacc0395e9ef094ff0f5b4318ae
Current-main deploy: PENDING build-rate-limit
```

PR #35 chỉ sửa UI CSS ownership, tests/workflow và evidence; không cần `pullmcp` cho backend. Sau merge cần Vercel deploy current `main` để nhận visibility fix và lifecycle/error copy mới nhất.

Không chỉ ghi trạng thái trong chat.
