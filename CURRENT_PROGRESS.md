# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật gần nhất: **2026-07-17**  
> Phase hiện tại: **A5.5.1 — persisted idempotency core + Foundation mutation onboarding**  
> Trạng thái: **MERGED + DB VERIFIED + VERCEL READY — VPS/GATEWAY RUNTIME PENDING**

## 1. Điểm tiếp tục duy nhất

```text
KHÔNG bắt đầu A5.5.2.
KHÔNG bắt đầu Order Core.

Việc tiếp theo:
1. SSH VPS.
2. Chạy: pullmcp
3. Xác nhận F0.2_VPS_SMOKE=PASS.
4. Chạy authenticated Gateway replay/conflict/restore/audit smoke.
5. Cập nhật CURRENT_PROGRESS.md và A5_5_1_IDEMPOTENCY_RELEASE.md.
6. Chỉ khi đó mới đóng FULL RELEASE và bắt đầu A5.5.2.
```

VPS command:

```powershell
ssh -i "F:\1_A_Disk_D\khuong-binh\TK\DIGI-OCEAN\DO-backend-02\backend-DO-02" root@165.22.109.61
```

Sau khi vào VPS:

```bash
pullmcp
```

## 2. A5.5.1 — trạng thái chính thức

```text
AUDIT:                    COMPLETE
IMPLEMENTATION:           COMPLETE
SOURCE:                   VERIFIED
SCANNER:                  debt 0 / unclassified 0 / forbidden 0
CALLER CONTRACT:          VERIFIED — 9 Foundation routes + legacy negative guards
CI:                       PASS — Foundation F0.2 #237
PR:                       #25 — MERGED
MERGE SHA:                504c2e18453ad068fd2640a97d21154050602b81
SUPABASE:                 APPLIED + VERIFIED
DB CORE SMOKE:            PASS
DB TYPED WRAPPER SMOKE:   PASS
BUSINESS RESTORE:         rollbackEqual=true
VERCEL PROD:              READY — merge SHA — root HTTP 200
VPS:                      PENDING — no SSH connector in completing chat
GATEWAY REPLAY SMOKE:     PENDING
FULL RELEASE:             PENDING
SCOPE COMPLETE:           9/30 mutation route cases
LEGACY REMAINING:         21 — A5.5.2
```

Evidence:

- `docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md`
- `docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md`

## 3. Source / CI / merge

```text
PR:              #25
PR head SHA:     484b1f655c9383495e93bcd04637a773b3a09e67
Merge SHA:       504c2e18453ad068fd2640a97d21154050602b81
Final CI run:    Foundation F0.2 #237
CI run ID:       29557444713
CI conclusion:   success
```

Final CI PASS:

- runtime hardcode audit;
- mutation scanner + retirement tests;
- A5.5.1 caller contract;
- production hygiene;
- direct DB mutation audit;
- deploy/frontend auth contract;
- backend Foundation verify;
- TypeScript;
- Next production build.

## 4. Supabase production

Project:

```text
project id: noiadkpkvdohljgopgfb
status:     ACTIVE_HEALTHY
```

Migrations:

```text
20260717052137  idempotency_audit_core
20260717052340  foundation_idempotent_mutations
```

Source files:

```text
supabase/migrations/20260717090000_idempotency_audit_core.sql
supabase/migrations/20260717091000_foundation_idempotent_mutations.sql
```

Objects:

```text
mcp_idempotency_records
mcp_audit_events
mcp_idempotency_request_hash
mcp_idempotency_begin
mcp_idempotency_complete
mcp_append_audit_event
9 typed mcp_idempotent_* wrappers
```

Production verification:

```text
RLS on both new tables:         true
append-only trigger:            true
service_role SELECT:            true
browser SELECT denied:          true
wrapper count:                  9
service_role wrapper execute:   true
anon wrapper execute:           false
authenticated wrapper execute:  false
```

### Root-cause fix đã merge

Lần apply đầu fail vì production `pgcrypto` nằm trong schema `extensions`, trong khi source gọi `digest()` dưới `search_path=public`.

Sửa đúng source:

```text
create extension if not exists pgcrypto with schema extensions;
extensions.digest(...)
```

Có test khóa đúng 3 lời gọi schema-qualified. Lần apply lỗi rollback sạch; source sửa chạy CI lại rồi mới apply thành công.

## 5. Production DB smoke

### Core

```text
first execute:                 PASS
same key + same payload:       REPLAY PASS
same response preserved:       PASS
same key + different payload:  idempotency_key_conflict PASS
record completed:              PASS
attempt count = 2:             PASS
audit succeeded + replayed:    PASS
append-only UPDATE blocked:    PASS
```

### Typed wrapper

```text
wrapper:                       mcp_idempotent_update_report_setting_group
safe row:                      msg_0687516286014cc5b77cf667b6c9f349
first replayed=false:          PASS
second replayed=true:          PASS
key conflict:                  PASS
aggregate id recorded:         PASS
audit succeeded + replayed:    PASS
business restore:              rollbackEqual=true
```

Không còn fixture nghiệp vụ sau restore. Hai release-smoke idempotency/audit records được giữ làm evidence.

## 6. Vercel production

```text
project:        mcp-plan
project id:     prj_jbe4PGuBPwVZa71UNfra6wssc3gJ
deployment id:  dpl_6XpaVDosdXwrPk8cr6EtmNGaM76U
state:          READY
target:         production
git SHA:        504c2e18453ad068fd2640a97d21154050602b81
domain:         https://mcp-plan.vercel.app
root smoke:     HTTP 200
```

`/api/health` trên Vercel 404 là đúng vì Next app không có route đó. Gateway health nằm ở VPS port 3001.

## 7. VPS runtime hiện tại

VPS layout không đổi:

```text
source:             /var/www/mcp-plan-source
runtime:            /var/www/mcp-plan-backend
PM2:                mcp-plan-backend
Gateway:            127.0.0.1:3001
legacy internal:    127.0.0.1:3102
milktea-backend:    port 3002 — KHÔNG ĐỤNG
```

Phiên hoàn thiện A5.5.1 không có SSH connector/private-key mount nên chưa thể chạy `pullmcp`. Không được suy diễn VPS đã ở merge SHA mới.

`ops/pullmcp` đã được source/CI kiểm và sẽ:

- reset source về `origin/main`;
- chạy backend verify;
- stage runtime đầy đủ;
- atomic swap + backup;
- restart PM2;
- smoke health/auth/CORS;
- in `F0.2_VPS_SMOKE=PASS`.

## 8. Authenticated Gateway gate bắt buộc

Sau `pullmcp`, dùng một Foundation mutation an toàn và restore được:

```text
request 1: key K + payload P  => 200, meta.idempotency.replayed=false
request 2: key K + payload P  => 200, meta.idempotency.replayed=true
request 3: key K + payload P2 => 409 IDEMPOTENCY_KEY_CONFLICT
restore business row          => rollbackEqual=true
query audit ledger            => succeeded + replayed
```

Không đoán payload/token từ chat. Đọc runtime/repo hiện tại và dùng row an toàn; ưu tiên report-setting update hoặc field-check result hiện hữu.

## 9. Supabase advisors sau DDL

A5.5.1 không tạo public executable wrapper.

Hai bảng mới có advisor INFO `RLS enabled no policy`. Đây là deny-all có chủ đích; không thêm policy `USING (true)` chỉ để làm mất cảnh báo.

Các WARN khác về anon policies, mutable search path, security-definer RPC và duplicate/unindexed indexes là nợ schema cũ, ngoài A5.5.1. Phải audit riêng, không sửa chắp vá trong runtime closure này.

## 10. Phạm vi A5.5

```text
TOTAL:              30 mutation route cases
A5.5.1 FOUNDATION:   9 — implemented, merged, DB/Vercel verified
A5.5.2 LEGACY:      21 — NOT STARTED
```

A5.5.1 routes:

```text
POST  /api/mcp-day/session-customer/result
POST  /api/mcp-day/session-customer/add
POST  /api/mcp-session-report
POST  /api/mcp-session-report/ai-result
POST  /api/field-checks/result
POST  /api/mcp-report-setting-groups
PATCH /api/mcp-report-setting-groups
POST  /api/mcp-report-settings
PATCH /api/mcp-report-settings
```

Legacy follow-up, session edit/delete và các legacy route khác không bị helper retry bọc nhầm.

## 11. Các phase trước

### A5.4.3 — Report Settings ownership

```text
PR #23:         MERGED
VPS:            VERIFIED
GATEWAY SMOKE:  PASS
FULL RELEASE:   VERIFIED
SCANNER:        7 -> 3
```

### A5.4.4 — Field-check + market-report ownership

```text
PR #24:         MERGED
VPS:            VERIFIED
GATEWAY SMOKE:  PASS
FULL RELEASE:   VERIFIED
SCANNER:        3 -> 0
rollbackEqual:  true
fixture left:   false
```

## 12. Local workstation sync

Sau khi progress commit này lên `main`, local chỉ cần:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull origin main
npm run build
```

Không commit/push từ local nếu chỉ pull và build không tạo thay đổi source.

## 13. Quy tắc đóng phase

A5.5.1 chỉ chuyển thành:

```text
VPS:          DEPLOYED + VERIFIED
GATEWAY:      REPLAY/CONFLICT/RESTORE/AUDIT PASS
FULL RELEASE: VERIFIED
```

sau khi output thực tế đã được ghi vào:

```text
CURRENT_PROGRESS.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

Sau đó commit lên `main`. Không chỉ ghi trong chat.
