# NPP-F05 — Session action menu UI release

> Cập nhật: **2026-07-18**  
> PR: **#37**  
> Phạm vi: **mobile session header + scalable page action surface**  
> Trạng thái: **CODE / CI / PRODUCTION DEPLOY PASS — LIVE MOBILE CLICK CONFIRMATION PENDING**

## 1. Vấn đề

Màn Phiên từng đặt ba điều khiển `BC phiên / Xuất / Chốt phiên` trong một cụm `position: fixed` tại góc trên bên phải. Trên mobile, cụm này tranh cùng vùng với nút Cài đặt toàn ứng dụng, gây đè nút và không có khả năng mở rộng khi nghiệp vụ tăng.

Đây không phải lỗi khoảng cách đơn lẻ. Root cause là chưa tách ownership giữa:

```text
điều hướng phân hệ
cài đặt toàn ứng dụng
tác vụ của phiên hiện tại
```

## 2. Kiến trúc đã chốt

```text
Bottom navigation  = chuyển phân hệ
Settings gear      = cài đặt toàn ứng dụng
Page-header ⋮      = tác vụ của phiên hiện tại
```

PageHeader cung cấp một action slot rõ ràng. Màn Phiên portal trạng thái và nút `⋮` vào slot đó; không còn feature control dùng fixed positioning.

Bottom sheet `Tác vụ phiên` gồm:

```text
Xem báo cáo phiên
Xuất dữ liệu
────────────────
Chốt phiên
```

`Chốt phiên` giữ destructive styling và bước xác nhận hiện hữu. `Xuất dữ liệu` mở sheet con gồm PDF và Excel checklist. Business mutation, schema, Gateway owner và idempotency contract không thay đổi.

## 3. Source ownership

```text
src/ui/layout/PageHeader.tsx
src/ui/layout/PageHeaderActionsPortal.tsx
src/features/mcp/VisitsSessionReportPanel.tsx
src/features/mcp/VisitsSessionActionMenu.module.css
src/features/mcp/McpSessionCompactView.tsx
```

Contract test:

```text
test/session-action-menu-ui-contract.test.mjs
```

Contract khóa:

- PageHeader có một owned action slot;
- màn Phiên dùng portal vào đúng slot;
- report/export/close thuộc một action menu;
- không quay lại fixed feature controls;
- không render lại legacy inline `VisitsExportMenu`;
- mobile header dành cột riêng cho action trigger;
- trigger mobile thu gọn thành một nút `⋮`;
- menu item dùng layout icon / copy / chevron có thể mở rộng.

## 4. Browser smoke

```text
viewport                       390x844
F05_SESSION_ACTION_MENU_SMOKE  PASS
headerCollision                false
actions                        report / export / close
exportLinks                    PASS
```

Browser đo bounding box thật của:

```text
button Cài đặt
button Mở menu tác vụ phiên
```

Assertion fail nếu hai hình chữ nhật giao nhau. Sau đó browser mở menu, kiểm ba tác vụ, destructive close styling, mở export sheet và xác minh href PDF/Excel.

Ảnh evidence:

```text
09-session-action-menu-mobile.png
10-session-export-menu-mobile.png
```

## 5. CI và artifact

```text
PR:                  #37 — MERGED
Final head:          8587a424ac6790d07a0b334a33d965c591d508e9
Merge SHA:           bd358393fee6e7382ccba5e80b3a5839f88e30e5
Foundation workflow: Foundation F0.2 #347 — PASS
Foundation run ID:   29626239076
Browser workflow:    F05 UI Browser Smoke #11 — PASS
Browser run ID:      29626239091
```

Artifact:

```text
name:    f05-ui-browser-smoke-evidence
id:      8423968722
digest:  sha256:6a7c6521ba57b291b7cdea215084ade8a79529a79eb273a4f38156ebeb60dfa5
```

## 6. Production deploy

GitHub commit status cho merge SHA:

```text
context: Vercel
state:   success
```

Frontend current main đã deploy. Không cần `pullmcp`, vì PR #37 không thay backend runtime, Supabase schema hay process ports.

## 7. Gate còn lại

Automated production-build browser smoke không thay cho thao tác live trên thiết bị thật. Trước A5.5.2 cần xác nhận trên mobile production:

1. Cài đặt và `⋮` không đè nhau;
2. menu mở và đóng đúng;
3. báo cáo và export truy cập đúng;
4. chốt phiên vẫn xác nhận trước mutation;
5. hoàn tất các live F05 route/customer/check-in cases còn lại.

Không đụng `milktea-backend` port `3002`.
