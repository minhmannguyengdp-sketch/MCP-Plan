# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-18**  
> Master plan: **Phase A / NPP-F05 / A5.5**  
> Trạng thái: **NPP-F05 LIVE UI PASS — A5.5.2 SESSION ACTION SLICE IN PROGRESS**
> Production UI: **PR #39 / merge SHA `72ab29e37f55d94545c80de0cb91b48ad1fdc543` / Vercel SUCCESS.**

## 1. Điểm tiếp tục duy nhất

```text
1. Hoàn tất PR #41 — A5.5.2 slice order/test/report/follow-up:
   - stable Idempotency-Key từ caller;
   - Foundation typed owner;
   - persisted replay/conflict/audit;
   - migration + contract/runtime tests.
2. Chỉ merge khi Foundation CI + browser smoke PASS.
3. Apply migration production từ source main.
4. VPS pullmcp và chạy authenticated Gateway smoke execute/replay/conflict/audit/cleanup cho 4 operation.
5. Cập nhật coverage từ 9/30 lên 13/30 khi runtime evidence PASS.
6. Tiếp A5.5.2 với open-session/status và destructive route/session mutations.

KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

## 2. Vị trí master plan

```text
Plan:              ke-hoach-app-van-hanh-npp.md
Phase:             Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
Current subphase:  A5.5.2 — IN PROGRESS (first slice targets 13/30)
```

UI architecture được ưu tiên hoàn thiện trước A5.5.2 để nghiệp vụ mới đăng ký vào một action surface duy nhất, có thể test lặp lại và không tiếp tục sinh nút riêng trên mobile.

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
Unified mobile menu / triggerCount=1                                PASS
Standalone settings button removed                                 PASS
Standalone session menu button removed                             PASS
Menu report / export / close / settings                            PASS
PDF / Excel canonical links                                        PASS
Vercel deployment / PR #39 merge SHA                               PASS
Live Vercel production click smoke                                  PASS — user confirmed
```

Automated browser smoke không được ghi thay cho live-production click smoke. Nó chứng minh UI/request contract trên Next production build bằng Chromium và stateful mock Gateway, không ghi dữ liệu production.

## 4. PR #41 — A5.5.2 session action slice

```text
PR:                  #41 — DRAFT / IN PROGRESS
Branch:              feat/a5-5-2-session-actions
Scope:               order / test / report / follow-up
Coverage before:     9/30
Coverage target:     13/30 after production runtime smoke
Migration:           20260718120000_a5_5_2_session_action_idempotency.sql
Runtime deploy:      PENDING
```

Kiến trúc: bốn route được Foundation Gateway intercept trước legacy proxy và gọi typed RPC trực tiếp. Không thêm trusted-header parsing vào `server.js` cho route đã được retire khỏi legacy ownership. Existing business RPC vẫn là owner của mutation; wrapper chỉ sở hữu canonical payload hash, replay/conflict, append-only audit và trusted context persistence.

## 5. PR #39 — unified mobile app menu

```text
PR:                  #39 — MERGED
Branch:              fix/unified-mobile-app-menu
Final head:          6b571cd904703603db946a63e8ed53079e6a56e6
Merge SHA:           72ab29e37f55d94545c80de0cb91b48ad1fdc543
Foundation workflow: Foundation F0.2 #355 — PASS
Foundation run ID:   29627650211
Browser workflow:    F05 UI Browser Smoke #16 — PASS
Browser run ID:      29627650225
Vercel commit status: SUCCESS
Evidence:            docs/npp-plan/SESSION_ACTION_MENU_UI_RELEASE.md
```

Browser result:

```text
F05_UI_BROWSER_SMOKE             PASS
F05_UNIFIED_MOBILE_MENU_SMOKE    PASS
viewport                         390x844
triggerCount                     1
standaloneSettingsButton         false
standaloneSessionButton          false
actions                          report / export / close / settings
exportLinks                      PASS
```

Artifact:

```text
name:    f05-ui-browser-smoke-evidence
id:      8424388479
digest:  sha256:a0e4766310a18d77f3eff84a281baada45abfe141f30ad69c14a0d45797bce8f
files:   result/state/logs + F05 screenshots + unified-menu screenshots + compiled CSS
```

Ảnh chính:

```text
12-unified-menu-trigger-mobile.png
13-unified-app-menu-mobile.png
14-unified-export-menu-mobile.png
```

Kiến trúc chính thức:

```text
Bottom navigation = chuyển phân hệ
Mobile ☰         = một menu dùng chung toàn app
Screen feature   = đăng ký action vào menu chung
Settings         = một item trong menu chung
```

Không còn:

```text
nút bánh răng fixed riêng
nút ⋮ riêng của màn Phiên
cụm BC phiên / Xuất / Chốt phiên fixed
```

`AppShell` sở hữu một `MobileAppMenuProvider`. Màn Phiên chỉ đăng ký report/export/close vào provider. Provider lồng nhau tái sử dụng parent nên không thể render trigger thứ hai.

### Root cause PR #37 bị supersede

PR #37 đã bỏ cụm ba nút fixed nhưng vẫn giữ hai trigger độc lập:

```text
Settings gear + session ⋮
```

Thiết kế đó không đạt mục tiêu một action surface. PR #39 supersede kiến trúc PR #37; không được khôi phục gear hoặc session `⋮` riêng.

### Lỗi browser bắt trong lúc sửa

Lượt đầu, `VisitsSessionReportPanel` đăng ký action ngoài provider nên trang Phiên crash. Fix đúng boundary:

```text
McpSessionCompactView bọc owner trong MobileAppMenuProvider
AppShell lồng bên trong tái sử dụng provider hiện có
=> một context, một trigger
```

Lượt sau, smoke tổng đã PASS nhưng dedicated regression cũ vẫn tìm hai nút cũ. Regression được cập nhật sang contract một nút thay vì xóa gate.

## 6. PR #35 — repeatable F05 UI browser smoke

```text
PR:                  #35 — MERGED
Merge SHA:           059e969c0904c908d4927ee8f23522559ab0248b
Browser workflow:    F05 UI Browser Smoke #8 — PASS
Foundation workflow: Foundation F0.2 #340 — PASS
Evidence:            docs/npp-plan/F05_UI_BROWSER_SMOKE.md
```

Các case nền vẫn PASS trong browser run #16:

```text
routeNoActive
routeActiveInclude
routeActiveRouteOnly
duplicateReuse
sessionAddCustomer
manualCheckin
```

## 7. Route master -> active session explicit sync

```text
PR:                    #29 — MERGED
Merge SHA:             5276abc8abe1c860b9b13d83cc567a2483a47f60
Supabase migrations:   APPLIED + VERIFIED
DB smoke:              ROUTE_ACTIVE_SESSION_DB_SMOKE=PASS
VPS Foundation:        F0.2_VPS_SMOKE=PASS
Live functional smoke: PASS — user confirmed
Evidence:              docs/npp-plan/ROUTE_ACTIVE_SESSION_SYNC_RELEASE.md
```

Hành vi:

```text
0 active session  -> thêm route master, không prompt
1 active session  -> hỏi hai lựa chọn
>1 active session -> từ chối trạng thái mơ hồ
```

## 8. Single-active route-session lifecycle

```text
PR:                    #31 — MERGED
Merge SHA:             0fefd6e724bed25b829bbbaf61b81537bb4a5967
Migration production:  APPLIED
DB invariant:          max_active_per_route=1 / ambiguous_routes=0
Typed rollback smoke:  PASS
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

## 9. Runtime closure và A5.5.1

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
PR:                #25 — MERGED
Scope:             9/30 Foundation mutation routes
Code/CI/DB/VPS:    PASS
Gateway runtime:   PASS
Full release:      VERIFIED
Legacy remaining: 21 — A5.5.2 IN PROGRESS
```

## 10. Runtime và deploy

```text
VPS source:          /var/www/mcp-plan-source
VPS runtime:         /var/www/mcp-plan-backend
PM2:                 mcp-plan-backend
Gateway:             127.0.0.1:3001
Legacy internal:     127.0.0.1:3102
Milktea backend:     3002 — KHÔNG ĐỤNG
Vercel production:   merge SHA 72ab29e37f55d94545c80de0cb91b48ad1fdc543
Vercel status:       SUCCESS
```

PR #39 chỉ đổi frontend UI architecture và tests; không cần `pullmcp`. Live mobile click confirmation đã PASS; A5.5.2 đang triển khai theo vertical slice.

Không chỉ ghi trạng thái trong chat.
