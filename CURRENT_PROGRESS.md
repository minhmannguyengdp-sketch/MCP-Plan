# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-18**  
> Master plan: **Phase A / NPP-F05 / A5.5**  
> Trạng thái: **NPP-F05 PASS — A5.5.2 BACKEND 13/30 PASS — PR #46 APPSHELL UI MERGED/CI PASS — PRODUCTION DEPLOY BLOCKED BY VERCEL BUILD RATE LIMIT**

## 1. Điểm tiếp tục duy nhất

```text
1. Không sửa thêm UI và không tạo commit rỗng để retry.
2. Mở lại quota Vercel hoặc redeploy production đúng cây main có PR #46:
   - UI merge SHA:       1c10990e728c793f7b7abe9d9bcf5493cbd1239c
   - latest main/docs:   11c6c09a1745952c765452c8b7237475a224b8c3
3. Chỉ khi GitHub commit status trả `Vercel: success`, chạy mobile production smoke:
   - thanh trên AppShell là phần tử đầu tiên;
   - Xuất tuyến nằm trong tool slot, không có card nổi phía trên;
   - menu ☰ đủ nhóm và tác vụ màn hình;
   - theme Tổng quan -> Tuyến -> Phiên -> một form nghiệp vụ;
   - order/test/report/follow-up lưu thành công trên production.
4. Ghi live evidence vào repo.
5. Sau live production PASS mới tiếp A5.5.2 với open-session/status/PATCH/DELETE/destructive mutations.

KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

Không được ghi Chromium smoke thay cho lượt kiểm tra điện thoại production.

## 2. Vị trí master plan

```text
Plan:              ke-hoach-app-van-hanh-npp.md
Phase:             Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
Current subphase:  A5.5.2 — IN PROGRESS
Verified coverage: 13/30
Remaining:         17 mutation routes
```

## 3. PR #46 — AppShell top bar + menu mở rộng + ordered theme

```text
PR:                         #46 — MERGED
Branch:                     ui/appshell-topbar-expanded-menu-theme-sequence
Final head:                 13500166b5a26a2e2ef695a268f28de77bcec515
Merge SHA:                  1c10990e728c793f7b7abe9d9bcf5493cbd1239c
Foundation F0.2:            #404 PASS
F05 UI Browser Smoke:       #45 PASS
Session Actions UI Smoke:   #12 PASS
Backend/schema change:      NONE
VPS pullmcp:                NOT REQUIRED
Release evidence:           docs/npp-plan/APPSHELL_TOPBAR_EXPANDED_MENU_RELEASE.md
```

Browser result:

```json
{
  "F05_APP_SHELL_THEME_SMOKE": "PASS",
  "sections": ["routes", "business", "session"],
  "topBar": "PASS",
  "routeExportOwnership": "PASS",
  "expandedMenu": "PASS",
  "businessFormTheme": "PASS"
}
```

Artifact:

```text
name:    f05-ui-browser-smoke-evidence
id:      8430490109
digest:  sha256:e55369cbc2c748197d768c3449d3e905f05d97fbcb5ab9202713a70b3b57c9bc
```

## 4. Kiến trúc UI đã khóa

```text
AppShell sticky top bar
├─ nhận diện + tên phân hệ
├─ tool slot do AppShell sở hữu
│  └─ Xuất tuyến portal vào slot
└─ một nút ☰

Menu ☰
├─ tác vụ màn hình hiện tại
├─ Vận hành hôm nay
├─ Quản lý MCP
├─ Thiết lập nghiệp vụ
└─ Cài đặt ứng dụng

Bottom navigation = shortcut phân hệ thường dùng
Desktop sidebar  = inventory đầy đủ trên màn rộng
```

Không được khôi phục control fixed riêng, card export nằm ngoài AppShell, nút bánh răng riêng hoặc nút ⋮ riêng của Phiên.

## 5. Theme ownership

Nguồn token duy nhất: `src/app/npp-theme.css`.

```text
1. Tổng quan
2. Tuyến
3. Phiên
4. Form nghiệp vụ: order / test / report / follow-up
```

Palette:

```text
canvas   #F7F3ED
surface  #FFFFFF
header   #5A3A24
primary  #4F7A3A
accent   #C89B5B
text     #2B211B
border   #E8DED2
```

## 6. Production deploy block

```text
PR #46 merge SHA Vercel: failure — build-rate-limit, source build did not run
PR #47 carrier SHA Vercel: failure — build-rate-limit, source build did not run
Last confirmed production SHA: 33f6bc77ed6afddd2ad420043b77269223190b7a
```

Đây là quota/platform block, không phải lỗi TypeScript, Next build hoặc browser regression. Dừng retry tự động cho tới khi quota/deploy được mở lại.

## 7. Backend/session-action nền

```text
PR #41 backend runtime:        PASS
PR #44 UI caller + warm theme: DEPLOYED
A5.5 verified operations:      13/30
Remaining:                     17
order/test/report/follow-up:   execute/replay/conflict/audit/context PASS
```

## 8. Runtime

```text
VPS source:          /var/www/mcp-plan-source
VPS runtime:         /var/www/mcp-plan-backend
PM2:                 mcp-plan-backend
Gateway:             127.0.0.1:3001
Legacy internal:     127.0.0.1:3102
Milktea backend:     3002 — KHÔNG ĐỤNG
Frontend production: Vercel — currently previous successful UI
```

Không chỉ ghi trạng thái trong chat.
