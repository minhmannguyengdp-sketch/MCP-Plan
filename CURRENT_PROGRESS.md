# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-18**  
> Master plan: **Phase A / NPP-F05 / A5.5**  
> Trạng thái: **NPP-F05 PASS — A5.5.2 BACKEND 13/30 PASS — APPSHELL/THEME/INTERACTION FEEDBACK DEPLOYED — LIVE PHONE SMOKE PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Trên mobile production chạy live smoke:
   - AppShell sticky top bar là phần tử đầu tiên;
   - Xuất tuyến nằm trong tool slot, không có card nổi phía trên;
   - menu ☰ đủ nhóm và tác vụ màn hình;
   - theme Tổng quan -> Tuyến -> Phiên -> form nghiệp vụ;
   - Cài đặt hiển thị toggle Phản hồi rung;
   - tắt rung -> bấm nút không rung;
   - bật rung -> thiết bị hỗ trợ rung phản hồi nhẹ;
   - reload vẫn giữ lựa chọn;
   - thiết bị không hỗ trợ rung vẫn thao tác bình thường;
   - order/test/report/follow-up lưu thành công trên production.
2. Ghi live evidence vào repo.
3. Native Capacitor haptic chỉ live-verify khi app đã được đóng gói; automated adapter-priority đã PASS.
4. Sau live production PASS mới tiếp A5.5.2 với open-session/status/PATCH/DELETE/destructive mutations.

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

## 3. PR #49 — interaction feedback + vibration setting

```text
PR:                         #49 — MERGED
Branch:                     ui/interaction-feedback-settings
Final head:                 065bb525578df3d603d3548154a51c480c97fa34
Merge SHA:                  528f7715cdc9a7186cc7f00f6af1bcdc9f6de759
Foundation F0.2:            #412 PASS
F05 UI Browser Smoke:       #48 PASS
Session Actions UI Smoke:   #15 PASS
Vercel production:          SUCCESS
Backend/schema change:      NONE
VPS pullmcp:                NOT REQUIRED
Release evidence:           docs/npp-plan/INTERACTION_FEEDBACK_RELEASE.md
```

Browser result:

```json
{
  "INTERACTION_FEEDBACK_BROWSER_SMOKE": "PASS",
  "settingsTopBar": "PASS",
  "webPreference": "PASS",
  "persistedSetting": "PASS",
  "capacitorPriority": "PASS"
}
```

Artifact:

```text
name:    f05-ui-browser-smoke-evidence
id:      8430775468
digest:  sha256:d8f5b0c649778eae1e23c031c06e293992f1abbaed77a90a0c3531663167eebb
```

Kiến trúc feedback:

```text
Intentional UI click
-> InteractionFeedbackProvider delegated listener
-> preference enabled?
-> Capacitor Plugins.Haptics nếu native
-> navigator.vibrate nếu web hỗ trợ
-> no-op an toàn nếu không hỗ trợ/chặn rung
```

Preference key duy nhất: `mcp-plan:interaction-feedback-enabled`.

## 4. PR #46 — AppShell top bar + menu mở rộng + ordered theme

```text
PR:                         #46 — MERGED
Final head:                 13500166b5a26a2e2ef695a268f28de77bcec515
Merge SHA:                  1c10990e728c793f7b7abe9d9bcf5493cbd1239c
Foundation F0.2:            #404 PASS
F05 UI Browser Smoke:       #45 PASS
Session Actions UI Smoke:   #12 PASS
Backend/schema change:      NONE
VPS pullmcp:                NOT REQUIRED
Release evidence:           docs/npp-plan/APPSHELL_TOPBAR_EXPANDED_MENU_RELEASE.md
```

PR #46 và carrier #47 từng bị `build-rate-limit` trước khi source build chạy. Block đã được giải tỏa khi PR #49 merge SHA nhận `Vercel: success`; production hiện chứa toàn bộ cây AppShell/theme/feedback mới.

## 5. Kiến trúc UI đã khóa

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

## 6. Theme ownership

Nguồn token duy nhất: `src/app/npp-theme.css`.

```text
1. Tổng quan
2. Tuyến
3. Phiên
4. Form nghiệp vụ: order / test / report / follow-up
```

```text
canvas   #F7F3ED
surface  #FFFFFF
header   #5A3A24
primary  #4F7A3A
accent   #C89B5B
text     #2B211B
border   #E8DED2
```

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
Frontend production: Vercel SUCCESS — release tree includes PR #46 and PR #49
```

Không chỉ ghi trạng thái trong chat.
