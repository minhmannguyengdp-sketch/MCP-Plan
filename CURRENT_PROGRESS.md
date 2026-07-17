# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật gần nhất: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **PR #28 HOTFIX MERGED + SOURCE/CI/DB VERIFIED — VERCEL RATE-LIMIT + VPS RUNTIME PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Chờ/gỡ Vercel account build-rate-limit và deploy current main.
2. Xác nhận Vercel / và /mcp trả HTTP 200.
3. Smoke UI: mở Phiên -> Thêm khách -> Lưu; phải thành công, không còn thiếu Idempotency-Key.
4. SSH VPS và chạy pullmcp.
5. Xác nhận F0.2_VPS_SMOKE=PASS.
6. Chạy smoke runtime chính thức:
   cd /var/www/mcp-plan-source
   node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
7. Chỉ khi JSON có F05_RUNTIME_CLOSURE_SMOKE=PASS mới đóng runtime gate.
8. Cập nhật CURRENT_PROGRESS.md + evidence release trên main.

KHÔNG bắt đầu A5.5.2.
KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

SSH:

```powershell
ssh -i "F:\1_A_Disk_D\khuong-binh\TK\DIGI-OCEAN\DO-backend-02\backend-DO-02" root@165.22.109.61
```

## 2. Master plan position

Active master plan:

```text
ke-hoach-app-van-hanh-npp.md
Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
```

Master plan bắt buộc hoàn thành F05 runtime trước khi mở:

```text
NPP-F06 — production DB vs migrations/functions/policies/grants
A5.5.2 — 21 legacy mutation route cases
Order Core / NPP-03
```

## 3. Hotfix Thêm khách trong Phiên

```text
PR:             #28 — MERGED
FINAL HEAD SHA: 1ee7e93722ec0f500ccc864ba513d1a8fd0ec95c
MERGE SHA:      dc000bd9b6e1ead9d4ae40eca429fd94d9c9cbad
CI:             PASS — Foundation F0.2 #294
CI RUN ID:      29571820520
TYPECHECK:      PASS
NEXT BUILD:     PASS
DB/MIGRATION:   NOT CHANGED
VPS BACKEND:    NOT CHANGED BY THIS HOTFIX
VERCEL:         PENDING — ACCOUNT BUILD-RATE-LIMIT
```

Root cause:

- `McpSessionAddCustomerButton` gọi raw `fetch()` trực tiếp;
- typed backend `session-customer.add` bắt buộc `Idempotency-Key` đúng theo A5.5.1;
- API client chuẩn có helper nhưng component live bypass helper;
- key bị rơi ở caller UI, không phải DB/RPC/proxy.

Fix:

- component dùng `idempotentMutationFetch`;
- operation cố định `session-customer.add`;
- helper giữ cùng key qua retry mạng;
- proxy chỉ forward key;
- backend vẫn từ chối request thiếu key;
- test cấm component quay lại raw `fetch()` cho route add-customer.

Evidence:

```text
docs/npp-plan/SESSION_ADD_CUSTOMER_IDEMPOTENCY_FIX.md
```

## 4. Session UI + manual sales check-in

```text
PR:                        #26 — MERGED
MERGE SHA:                 6c1a3b8e9d74489abb4d3a1409faeb812543a105
CI:                        PASS — Foundation F0.2 #271
SCANNER:                   debt 0 / unclassified 0 / forbidden 0
SUPABASE:                  APPLIED + VERIFIED
DB CHECK-IN SMOKE:         PASS
DB REPLAY:                 PASS
DB CONFLICT:               PASS
DB SECOND-CLICK UNDO:      PASS
BUSINESS RESTORE:          rollbackEqual=true
OUTLET GPS UNCHANGED:      true
VISIT STATUS UNCHANGED:    true
VERCEL PROD:               BLOCKED — ACCOUNT BUILD-RATE-LIMIT
VPS/GATEWAY:               PENDING
FULL RUNTIME RELEASE:      PENDING
```

UI đã merge:

- sáu nút hành động ở lưới `3 × 2`;
- trạng thái xử lý ở góc phải trên;
- check-in ô vuông bên phải, chỉ lấy GPS khi bấm;
- bấm lần hai bỏ check-in và không gọi GPS;
- popup tạo đơn giữ nguyên;
- popup Test / Quan sát / Theo dõi / Bỏ qua dùng variant compact.

Evidence:

```text
docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md
```

## 5. PR #27 — repeatable F05 runtime smoke

```text
PR:             #27 — MERGED
FINAL HEAD SHA: 6afc741c6a1b407d88781be4e70b69157019e8cb
MERGE SHA:      a59dfdc01c6755ef426753c3c8216cc460b747d2
FINAL CI:       PASS — Foundation F0.2 #286
CI RUN ID:      29563734574
SCANNER:        PASS — không thêm baseline/exception
TYPECHECK:      PASS
NEXT BUILD:     PASS
```

Files:

```text
test/runtime/smoke-f05-runtime-closure.mjs
test/f05-runtime-smoke-script.test.mjs
package.json -> smoke:f05-runtime
```

Lý do đặt script trong `test/runtime`:

- script là operational verification tooling, không phải application consumer;
- script cần service-role read-only để xác minh audit/idempotency/GPS;
- `src`, `apps/backend`, `scripts` và runtime app không import script;
- scanner application boundary vẫn giữ sạch, không đăng ký ngoại lệ.

Smoke tự thực hiện:

```text
1. health/auth/canonical envelope
2. tạo route + khách + session tạm có smoke guard
3. check-in lần đầu => replayed=false
4. cùng key + cùng payload => replayed=true
5. cùng key + payload khác => 409 idempotency conflict
6. bấm lần hai => checkedIn=false, không gửi GPS
7. xác minh visit status không đổi
8. xác minh GPS điểm bán không đổi
9. xác minh audit succeeded/replayed/remove_checkin
10. xác minh idempotency record completed + attempt_count=2
11. chạy A5.5.1 result mutation execute/replay/conflict/audit
12. cleanup toàn bộ fixture bằng guarded route cleanup
```

Expected output:

```text
F05_RUNTIME_CLOSURE_SMOKE=PASS
fixtureCleanup=PASS
```

Evidence:

```text
docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md
```

## 6. A5.5.1 — persisted idempotency core

```text
PR:                       #25 — MERGED
MERGE SHA:                504c2e18453ad068fd2640a97d21154050602b81
CI:                       PASS — Foundation F0.2 #237
SUPABASE:                 APPLIED + VERIFIED
DB CORE SMOKE:            PASS
DB TYPED WRAPPER SMOKE:   PASS
BUSINESS RESTORE:         rollbackEqual=true
SCOPE COMPLETE:           9/30 mutation route cases
LEGACY REMAINING:         21 — NOT STARTED
VPS/GATEWAY REPLAY:       PENDING
FULL RELEASE:             PENDING
```

Evidence:

```text
docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

## 7. Vercel blocker

Empty trigger commit gần nhất trước hotfix:

```text
285b0391f4032242b33c9abbfef9cfc82150e784
chore: trigger Vercel production deploy
```

GitHub/Vercel vẫn trả:

```text
context: Vercel
state:   failure
reason:  build-rate-limit
```

Không retry liên tục. Khi quota/build window mở lại, deploy current `main` và smoke `/` + `/mcp`, sau đó test lưu khách trong Phiên.

## 8. VPS runtime

```text
source:             /var/www/mcp-plan-source
runtime:            /var/www/mcp-plan-backend
PM2:                mcp-plan-backend
Gateway:            127.0.0.1:3001
legacy internal:    127.0.0.1:3102
milktea-backend:    port 3002 — KHÔNG ĐỤNG
```

Deploy:

```bash
pullmcp
```

Runtime smoke sau deploy:

```bash
cd /var/www/mcp-plan-source
node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
```

Không được suy diễn VPS đã chạy source mới nếu chưa có output thực tế của `pullmcp`.

## 9. Local workstation sync

PR #28 đã merge, local cần:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull --ff-only origin main
npm run build
```

Không commit/push nếu chỉ pull và build không tạo thay đổi source.

## 10. Quy tắc đóng F05

Chỉ đóng NPP-F05/A5.5.1 runtime khi có đủ:

```text
Vercel current main READY + / + /mcp HTTP 200
UI thêm khách trong Phiên lưu thành công
VPS pullmcp => F0.2_VPS_SMOKE=PASS
F05 runtime smoke => PASS
fixtureCleanup => PASS
Gateway replay/conflict/undo/audit => PASS
CURRENT_PROGRESS.md + evidence cập nhật trên main
```

Không chỉ ghi trạng thái trong chat.
