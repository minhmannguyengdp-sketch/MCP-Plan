# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật gần nhất: **2026-07-17**  
> Công việc hiện tại: **Session UI + manual sales check-in**  
> Trạng thái: **SOURCE/CI/DB VERIFIED — PR #26 READY TO MERGE — VPS/GATEWAY PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Merge PR #26 sau final docs CI.
2. Xác nhận Vercel production READY đúng merge SHA và root HTTP 200.
3. SSH VPS, chạy pullmcp.
4. Xác nhận F0.2_VPS_SMOKE=PASS.
5. Chạy authenticated Gateway check-in/replay/conflict/undo smoke.
6. Cập nhật CURRENT_PROGRESS.md và SESSION_UI_CHECKIN_RELEASE.md.
7. Sau đó mới quay lại gate VPS/Gateway còn thiếu của A5.5.1.

KHÔNG bắt đầu A5.5.2.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

SSH:

```powershell
ssh -i "F:\1_A_Disk_D\khuong-binh\TK\DIGI-OCEAN\DO-backend-02\backend-DO-02" root@165.22.109.61
```

Trên VPS:

```bash
pullmcp
```

## 2. Session UI + manual check-in

```text
SOURCE:                    VERIFIED
CI:                        PASS — Foundation F0.2 #269
CI RUN ID:                 29561052313
SCANNER:                   debt 0 / unclassified 0 / forbidden 0
PR:                        #26 — READY TO MERGE
PR HEAD:                   6c759d1a620d6ab75fd33887dac32a304823864a
SUPABASE:                  APPLIED + VERIFIED
DB CHECK-IN SMOKE:         PASS
DB REPLAY:                 PASS
DB CONFLICT:               PASS
DB SECOND-CLICK UNDO:      PASS
BUSINESS RESTORE:          rollbackEqual=true
OUTLET GPS UNCHANGED:      true
VISIT STATUS UNCHANGED:    true
VERCEL PROD:               PENDING MERGE
VPS/GATEWAY:               PENDING
```

Evidence:

```text
docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md
```

### UI đã triển khai

Tab Phiên:

- sáu nút `Chỉ đường / Đơn / Test / Quan sát / Theo dõi / Bỏ qua` nằm trong lưới `3 × 2`;
- trạng thái xử lý nằm góc phải trên đối xứng tên khách;
- nút check-in là ô vuông bên phải, cao bằng hai hàng hành động;
- bấm lần đầu mới lấy GPS hiện tại;
- bấm lần hai bỏ check-in;
- không tự lấy GPS khi mở tab/render/refresh.

Popup:

- popup tạo đơn giữ nguyên workspace hiện tại;
- Test / Quan sát / Theo dõi / Bỏ qua và thông tin khách dùng variant compact;
- viền 1px, nút nhỏ, padding gọn, vùng nhập liệu rộng hơn.

### Check-in ownership

Source migration:

```text
supabase/migrations/20260717124500_session_customer_checkin.sql
```

Production migration:

```text
20260717065144  session_customer_checkin
```

Dedicated sales-location columns:

```text
mcp_session_customers.checkin_lat
mcp_session_customers.checkin_lng
mcp_session_customers.checkin_accuracy
mcp_session_customers.checkin_at
mcp_session_customers.checkin_source
```

Không dùng các cột GPS của điểm bán. Check-in không thay đổi `visit_status`.

RPC:

```text
mcp_set_session_customer_checkin
mcp_idempotent_set_session_customer_checkin
```

Permission:

```text
base RPC external execute:           denied
typed wrapper service_role execute:  true
anon/authenticated execute:          false
```

Operation:

```text
session-customer.checkin.set
```

Typed owner fingerprint:

```text
fdb8534a5fa190e47190a2be
owner: session-customer-checkin-idempotent-use-case
```

### Production smoke

Safe row:

```text
msc_87f01a38604942969a9a8c45eb6c83e3 — Sinh Đôi
```

```text
first check-in:                  replayed=false
same key + same payload:         replayed=true
same key + changed accuracy:     idempotency_key_conflict
second-click undo:               checkedIn=false, no coordinates
restore:                         rollbackEqual=true
visit_status after restore:      pending
outlet GPS hash before/after:     identical
```

Audit:

```text
checkin        succeeded
checkin        replayed
remove_checkin succeeded
```

## 3. A5.5.1 — persisted idempotency core

```text
AUDIT:                    COMPLETE
IMPLEMENTATION:           COMPLETE
SOURCE:                   VERIFIED
SCANNER:                  debt 0 / unclassified 0 / forbidden 0
CALLER CONTRACT:          9 Foundation routes + legacy negative guards
CI:                       PASS — Foundation F0.2 #237
PR:                       #25 — MERGED
MERGE SHA:                504c2e18453ad068fd2640a97d21154050602b81
SUPABASE:                 APPLIED + VERIFIED
DB CORE SMOKE:            PASS
DB TYPED WRAPPER SMOKE:   PASS
BUSINESS RESTORE:         rollbackEqual=true
VERCEL PROD:              READY — root HTTP 200
VPS:                      PENDING
GATEWAY REPLAY SMOKE:     PENDING
FULL RELEASE:             PENDING
SCOPE COMPLETE:           9/30 mutation route cases
LEGACY REMAINING:         21 — A5.5.2 NOT STARTED
```

Evidence:

- `docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md`
- `docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md`

Migrations:

```text
20260717052137  idempotency_audit_core
20260717052340  foundation_idempotent_mutations
```

Core objects:

```text
mcp_idempotency_records
mcp_audit_events
mcp_idempotency_request_hash
mcp_idempotency_begin
mcp_idempotency_complete
mcp_append_audit_event
9 typed mcp_idempotent_* wrappers
```

A5.5.1 chỉ chuyển `FULL RELEASE VERIFIED` sau `pullmcp` và authenticated Gateway replay/conflict/restore/audit smoke.

## 4. VPS runtime

```text
source:             /var/www/mcp-plan-source
runtime:            /var/www/mcp-plan-backend
PM2:                mcp-plan-backend
Gateway:            127.0.0.1:3001
legacy internal:    127.0.0.1:3102
milktea-backend:    port 3002 — KHÔNG ĐỤNG
```

Không được suy diễn VPS đã chạy source mới nếu chưa có output thực tế của `pullmcp`.

`pullmcp` phải:

- reset source về `origin/main`;
- chạy backend verify;
- stage runtime đầy đủ;
- atomic swap + backup;
- restart PM2;
- smoke health/auth/CORS;
- in `F0.2_VPS_SMOKE=PASS`.

## 5. Authenticated Gateway smoke cần chạy

### Session check-in

```text
request 1: key K + checkedIn=true + GPS => 200, replayed=false
request 2: key K + cùng payload          => 200, replayed=true
request 3: key K + đổi accuracy          => 409 IDEMPOTENCY_KEY_CONFLICT
request 4: key K2 + checkedIn=false      => 200, checkedIn=false
restore row                              => rollbackEqual=true
GPS điểm bán                             => không đổi
visit_status                             => không đổi
query audit                              => succeeded + replayed + remove_checkin succeeded
```

### A5.5.1 core

Vẫn cần authenticated Gateway replay/conflict/restore/audit smoke trên một Foundation mutation an toàn.

Không đoán token hoặc payload từ chat; đọc runtime/repo và snapshot row trước khi thử.

## 6. Vercel

Project:

```text
mcp-plan
project id: prj_jbe4PGuBPwVZa71UNfra6wssc3gJ
domain:     https://mcp-plan.vercel.app
```

Sau merge PR #26 phải xác nhận deployment production có đúng merge SHA và root trả HTTP 200.

## 7. Các phase trước

```text
A5.4.3 PR #23: FULL RELEASE VERIFIED, scanner 7 -> 3
A5.4.4 PR #24: FULL RELEASE VERIFIED, scanner 3 -> 0, rollbackEqual=true
A5.5.1 PR #25: code/DB/Vercel verified, VPS/Gateway pending
```

## 8. Local workstation sync

Sau khi merge/progress lên `main`:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull origin main
npm run build
```

Không commit/push từ local nếu chỉ pull và build không tạo thay đổi source.

## 9. Quy tắc tiến độ

Mọi phase/release chỉ được đóng khi source, CI, Supabase, Vercel, VPS/Gateway, smoke, SHA/PR, blocker và bước tiếp theo đã ghi vào:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi trạng thái trong chat.
