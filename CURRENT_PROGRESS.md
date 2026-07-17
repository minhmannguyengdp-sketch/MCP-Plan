# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **ROUTE -> ACTIVE SESSION HOTFIX IMPLEMENTED + DB VERIFIED — MERGE/DEPLOY/UI/VPS/F05 RUNTIME PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Review và merge PR #29 sau final docs CI xanh.
2. Xác nhận Vercel production deploy đúng merge SHA.
3. Chạy VPS pullmcp; không đụng milktea-backend port 3002.
4. Smoke Gateway route-customer add execute/replay/conflict.
5. Chuẩn hóa fixture hoặc session state để có đúng một active session rồi UI smoke cả hai lựa chọn.
6. Regression UI Thêm khách trong Phiên.
7. Chạy F05 runtime closure smoke => PASS + fixtureCleanup=PASS.

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

## 3. Hotfix route master -> active session explicit sync

```text
PR:                    #29 — OPEN
Branch:                hotfix/route-active-session-explicit-sync
Head with evidence:    d3a56dab6759b82b017d934c71ee638d00bb8efb
Final runtime CI:      Foundation F0.2 #313 — PASS
CI run ID:             29586400763
Scanner/backend/TS:    PASS
Next production build: PASS
Supabase migration:    APPLIED + VERIFIED
DB smoke:              ROUTE_ACTIVE_SESSION_DB_SMOKE=PASS
Fixture cleanup:       true
Merge:                 PENDING
Vercel:                PENDING
VPS pullmcp:           PENDING
UI functional smoke:   PENDING
Evidence:              docs/npp-plan/ROUTE_ACTIVE_SESSION_SYNC_RELEASE.md
```

### Hành vi đã triển khai

Khi thêm khách từ tuyến cố định:

```text
0 active session  -> thêm route master, không prompt
1 active session  -> hỏi hai lựa chọn
>1 active session -> từ chối vì session state mơ hồ
```

Prompt:

```text
Tuyến này đang có phiên hoạt động. Thêm khách vào phiên hiện tại luôn?
```

Hai lựa chọn:

```text
1. Thêm vào tuyến và phiên — mặc định.
2. Chỉ thêm vào tuyến — áp dụng từ phiên sau.
```

### Ownership và transaction

- `mcp_route_customers` là route master cho phiên tương lai.
- `mcp_session_customers` là snapshot vận hành của phiên hiện tại.
- Chỉ `includeActiveSession=true` mới thêm/resolve snapshot vào exact active session.
- UI dùng một `Idempotency-Key` cho một user intent qua prompt/retry.
- Foundation sở hữu typed operation `route-customer.add`.
- RPC khóa session trước rồi route, resolve duplicate và persist idempotency/audit trong cùng transaction.
- Không background/render/reload sync và không copy lại toàn tuyến.
- Existing visit status, check-in và operational links không bị rewrite.
- Session done/completed/cancelled/closed bị từ chối.

### DB evidence

```text
Applied:
- route_active_session_explicit_sync
- route_active_session_explicit_context_fix

Function security definer:       true
service_role execute:            true
anon/authenticated execute:      false
route/session duplicate smoke:   PASS
replay/conflict:                 PASS
state preservation:              PASS
closed session guard:            PASS
rollback cleanup:                PASS
```

Smoke đầu tiên bắt được thiếu explicit `session_id` trong snapshot `source=added`; trigger hiện hữu từ chối đúng. Không hạ guard. RPC, test và forward migration đã được sửa, CI #313 và DB smoke sau fix đều pass.

### Production data observation

Preflight không có duplicate `(session_id, route_customer_id)`. Tuy nhiên hiện không có route nào đúng một active session; các route có active đều mang nhiều row active cũ. UI cố ý chặn case mơ hồ. Hotfix không tự sửa hoặc tự đóng session lịch sử.

## 4. Hotfix Thêm khách trong Phiên

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
Vercel production:   READY — hotfix code đã deploy
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

Evidence: `docs/npp-plan/SESSION_ADD_CUSTOMER_IDEMPOTENCY_FIX.md`.

## 5. Vercel production đang phục vụ hotfix trước

```text
Project:       mcp-plan
Deployment:    dpl_5GigX6fwHF3FrNJi9zZNBL9rxKrZ
Target/state:  production / READY
Git SHA:       35883e87e3580bcf66be70951b49ce77d6e1fbc4
Domain:        https://mcp-plan.vercel.app
`/`:           HTTP 200
`/mcp`:        HTTP 200
```

Deployment này chưa chứa PR #29. HTTP smoke chưa thay thế thao tác Lưu khách thật trên trình duyệt.

## 6. Session UI + manual check-in

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
Vercel runtime:         READY — included in deployed SHA
VPS/Gateway:            PENDING
```

UI: nút hành động `3 × 2`, trạng thái góc phải, check-in thủ công, popup compact; popup tạo đơn giữ nguyên.

Evidence: `docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md`.

## 7. Repeatable F05 runtime smoke

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

## 8. A5.5.1 persisted idempotency

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

## 9. Runtime và local sync

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

## 10. Gate đóng F05

```text
Route master -> active session source + DB                    PASS
Route master -> active session merge/deploy/UI smoke          PENDING
UI Thêm khách trong Phiên lưu thành công                      PENDING
VPS pullmcp => F0.2_VPS_SMOKE=PASS                            PENDING
F05 runtime smoke                                             PENDING
fixtureCleanup                                                PENDING
Gateway replay/conflict/undo/audit                            PENDING
Progress + evidence cập nhật                                  PASS
```

Không chỉ ghi trạng thái trong chat.