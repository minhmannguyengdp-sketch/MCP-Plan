# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **HOTFIX THÊM KHÁCH DEPLOYED — VERCEL READY — UI SMOKE + VPS/F05 RUNTIME PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Mở một Phiên active -> Thêm khách -> nhập khách thử -> Lưu.
2. Xác nhận không còn lỗi thiếu Idempotency-Key.
3. Xác nhận khách xuất hiện đúng trong phiên và tuyến gốc; dọn khách thử nếu chỉ dùng smoke.
4. VPS chạy pullmcp và yêu cầu F0.2_VPS_SMOKE=PASS.
5. Chạy:
   cd /var/www/mcp-plan-source
   node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
6. Chỉ đóng F05 khi có F05_RUNTIME_CLOSURE_SMOKE=PASS và fixtureCleanup=PASS.
7. Cập nhật file này cùng các evidence release.

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

## 3. Hotfix Thêm khách trong Phiên

```text
PR:                  #28 — MERGED
Final head:          1ee7e93722ec0f500ccc864ba513d1a8fd0ec95c
Merge SHA:           dc000bd9b6e1ead9d4ae40eca429fd94d9c9cbad
CI:                  Foundation F0.2 #294 — PASS
CI run ID:           29571820520
Scanner/backend/TS:  PASS
Next build:          PASS
DB/migration:        không thay đổi
Backend runtime:     không thay đổi bởi hotfix này
Vercel production:   READY
Deployed main SHA:   35883e87e3580bcf66be70951b49ce77d6e1fbc4
Root `/`:            HTTP 200
MCP `/mcp`:          HTTP 200
UI functional smoke: PENDING
```

### Root cause

- `McpSessionAddCustomerButton` gọi raw `fetch()` tới route add-customer.
- Backend đúng khi bắt buộc `Idempotency-Key` cho operation `session-customer.add`.
- API client chuẩn có helper nhưng component live bypass helper.
- Key bị rơi tại caller UI, không phải DB, RPC hay proxy.

### Fix đúng logic

- component dùng `idempotentMutationFetch`;
- operation cố định `session-customer.add`;
- một key cho một lần submit, giữ nguyên qua retry mạng;
- proxy chỉ forward key;
- backend vẫn từ chối request thiếu key;
- test cấm quay lại raw `fetch()` cho route này.

Không thay check-in, field-check, report settings, RPC, schema hay 21 legacy routes.

Evidence:

```text
docs/npp-plan/SESSION_ADD_CUSTOMER_IDEMPOTENCY_FIX.md
```

## 4. Vercel production hiện tại

```text
Project:       mcp-plan
Deployment:    dpl_5GigX6fwHF3FrNJi9zZNBL9rxKrZ
Target/state:  production / READY
Git SHA:       35883e87e3580bcf66be70951b49ce77d6e1fbc4
Domain:        https://mcp-plan.vercel.app
`/`:           HTTP 200
`/mcp`:        HTTP 200
```

Build-rate-limit trước đó đã hết. HTTP smoke chưa thay thế thao tác Lưu khách thật trên trình duyệt.

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
Vercel:                 READY — current main
VPS/Gateway:            PENDING
```

UI: nút hành động `3 × 2`, trạng thái góc phải, check-in thủ công, popup compact; popup tạo đơn giữ nguyên.

Evidence: `docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md`.

## 6. Repeatable F05 runtime smoke

```text
PR:          #27 — MERGED
Merge SHA:   a59dfdc01c6755ef426753c3c8216cc460b747d2
Final CI:    Foundation F0.2 #286 — PASS
Smoke file:  test/runtime/smoke-f05-runtime-closure.mjs
```

Smoke kiểm health/canonical envelope, check-in execute/replay/conflict/undo, GPS điểm bán, visit status, audit, idempotency record, Foundation result mutation và guarded cleanup.

Expected:

```text
F05_RUNTIME_CLOSURE_SMOKE=PASS
fixtureCleanup=PASS
```

Evidence: `docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md`.

## 7. A5.5.1 persisted idempotency

```text
PR:                    #25 — MERGED
Merge SHA:             504c2e18453ad068fd2640a97d21154050602b81
CI/DB smoke:           PASS
Scope complete:        9/30 mutation route cases
Legacy remaining:      21 — NOT STARTED
VPS/Gateway replay:    PENDING
Full runtime release:  PENDING
```

Evidence:

```text
docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

## 8. Runtime và local sync

VPS runtime:

```text
source:          /var/www/mcp-plan-source
runtime:         /var/www/mcp-plan-backend
PM2:             mcp-plan-backend
Gateway:         127.0.0.1:3001
legacy internal: 127.0.0.1:3102
milktea:         3002 — KHÔNG ĐỤNG
```

Local:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull --ff-only origin main
npm run build
```

## 9. Gate đóng F05

```text
Vercel current main READY + `/` + `/mcp` HTTP 200       PASS
UI Thêm khách lưu thành công                            PENDING
VPS pullmcp => F0.2_VPS_SMOKE=PASS                      PENDING
F05 runtime smoke                                       PENDING
fixtureCleanup                                          PENDING
Gateway replay/conflict/undo/audit                      PENDING
Progress + evidence cập nhật                            PARTIAL
```

Không chỉ ghi trạng thái trong chat.
