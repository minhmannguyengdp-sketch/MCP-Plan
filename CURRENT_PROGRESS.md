# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-18**  
> Master plan: **Phase A / NPP-F05 / A5.5**  
> Trạng thái: **NPP-F05 PASS — A5.5.2 BACKEND 13/30 PASS — PR #44 WARM THEME + SESSION ACTION CALLERS DEPLOYED — LIVE PHONE ACTION SMOKE PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Trên mobile production chạy bốn thao tác thật từ màn Phiên:
   - tạo đơn hàng;
   - lưu kết quả test;
   - lưu quan sát thị trường;
   - tạo follow-up.
2. Xác nhận cả bốn thao tác lưu thành công, không có:
   - unsupported_mutation_operation;
   - idempotency_key_required;
   - lỗi 400 do caller path/key.
3. Ghi live evidence vào repo.
4. Sau live production UI PASS mới tiếp A5.5.2 với:
   - open-session;
   - session-customer status;
   - PATCH/DELETE session;
   - destructive route/session mutations theo inventory.

KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

Automated Chromium đã click đủ bốn action trên Next production build và stateful mock, nhưng không được ghi thay cho lượt click dữ liệu production bằng điện thoại thật.

## 2. Vị trí master plan

```text
Plan:              ke-hoach-app-van-hanh-npp.md
Phase:             Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
Current subphase:  A5.5.2 — IN PROGRESS
Verified coverage: 13/30
Remaining:         17 mutation routes
```

## 3. PR #44 — session action UI caller gate + warm theme foundation

```text
PR:                         #44 — MERGED
Branch:                     ui/mcp-warm-theme-live-actions
Final head:                 8d64301f63e43c7be36526b9700d011f044e32e7
Merge SHA:                  86bc600be9fe4bb33d437121627692a3172a9a9a
Foundation F0.2:            #394 PASS
F05 UI Browser Smoke:       #38 PASS
Session Actions UI Smoke:   #5 PASS
Vercel production:          SUCCESS
Backend/schema change:      NONE
VPS pullmcp:                NOT REQUIRED
Evidence:                   docs/npp-plan/MCP_WARM_THEME_AND_SESSION_ACTION_UI_GATE.md
```

### Root cause đã sửa

Backend typed owner/runtime của order/test/report/follow-up đã PASS nhưng UI dùng đường dẫn không đồng nhất với `mutationOperation()`. Operation được resolve trước `fetch`, nên UI có thể ném `unsupported_mutation_operation` mà chưa gửi request.

Bốn caller đã khóa về cùng canonical frontend proxy:

```text
/api/backend/mcp-day/session-customer/order
/api/backend/mcp-day/session-customer/test
/api/backend/mcp-day/session-customer/report
/api/backend/mcp-day/session-customer/followup
```

Browser evidence:

```text
MCP_SESSION_ACTION_UI_SMOKE  PASS
actions                      order / test / report / followup
Idempotency-Key              PASS cho cả bốn request
aggregate count              1 / 1 / 1 / 1
```

Artifact:

```text
name:    mcp-session-actions-browser-evidence
id:      8430119462
digest:  sha256:ad0afb3a69ee1aca22f0ca8ef4b923efca4dd99d758e36979548ae6f49a7f49f
```

### Warm theme foundation

```text
canvas         #F7F3ED  kem nhẹ
surface        #FFFFFF  trắng
surface soft   #FBF8F4
header         #5A3A24  nâu
primary        #4F7A3A  xanh olive
accent         #C89B5B  vàng đất
text           #2B211B
border         #E8DED2
```

Token ownership nằm tại `src/app/npp-theme.css`, import cuối và map về alias CSS cũ. Không rải màu theo từng màn hình. Chưa mở rộng menu ☰ và chưa thêm haptic/rung trong slice này.

## 4. PR #41 — A5.5.2 backend session-action slice

```text
PR:                  #41 — MERGED
Final head:          709fdc8e1ea1d2d21594f8ba55d6eba7e49b2c8c
Merge SHA:           73d26b95d74b51627449d3bddb169114c097358e
Scope:               order / test / report / follow-up
Foundation workflow: #379 PASS
Browser workflow:    #31 PASS
Migration:           a5_5_2_session_action_idempotency — APPLIED
VPS pullmcp:         PASS
Backend runtime:     PASS
Coverage:            9/30 -> 13/30
Evidence:            docs/npp-plan/A5_5_2_SESSION_ACTION_RUNTIME_PASS.md
```

Production runtime:

```text
order     execute/replay/conflict/audit/context PASS
test      execute/replay/conflict/audit/context PASS
report    execute/replay/conflict/audit/context PASS
follow-up execute/replay/conflict/audit/context PASS
fixture cleanup                              PASS
```

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
Bottom navigation = shortcut cho các phân hệ dùng thường xuyên
Mobile ☰         = một menu dùng chung toàn app, có thể mở rộng
Screen feature   = đăng ký action ngữ cảnh vào menu chung
Settings         = một item trong menu chung
```

Không được khôi phục:

```text
nút bánh răng fixed riêng
nút ⋮ riêng của màn Phiên
cụm BC phiên / Xuất / Chốt phiên fixed
```

PR #39 merge SHA `72ab29e37f55d94545c80de0cb91b48ad1fdc543`; evidence `docs/npp-plan/SESSION_ACTION_MENU_UI_RELEASE.md`.

## 7. App surfaces/subdomain đã khóa

```text
sales.<domain>       Sale mobile / MCP
admin.<domain>       Điều hành và cấu hình
operations.<domain>  Kho + giao nhận
accounting.<domain>  Kế toán + công nợ
portal.<domain>      Cổng khách hàng — làm sau
api.<domain>         Backend — không tính giao diện
```

Kho và giao nhận chung app nhưng tách domain/quyền/nguồn sự thật. Kế toán là app riêng. Evidence `docs/npp-plan/APP_SURFACE_SUBDOMAIN_DECISION.md`.

## 8. Runtime và deploy

```text
VPS source:             /var/www/mcp-plan-source
VPS runtime:            /var/www/mcp-plan-backend
PM2:                    mcp-plan-backend
Gateway:                127.0.0.1:3001
Legacy internal:        127.0.0.1:3102
Milktea backend:        3002 — KHÔNG ĐỤNG
Frontend production:    Vercel SUCCESS
Current frontend SHA:   86bc600be9fe4bb33d437121627692a3172a9a9a
```

Không chỉ ghi trạng thái trong chat.
