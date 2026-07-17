# A5.5.1 — Persisted idempotency core + Foundation mutation onboarding

> Cập nhật: **2026-07-17**  
> Phạm vi: **9/30 mutation route cases — Foundation-owned routes**  
> Trạng thái release: **MERGED + SUPABASE VERIFIED + VERCEL READY — VPS/GATEWAY RUNTIME PENDING**

## 1. Trạng thái chính thức

```text
AUDIT:                    COMPLETE
IMPLEMENTATION:           COMPLETE
SOURCE:                   VERIFIED
SCANNER:                  debt 0 / unclassified 0 / forbidden 0
CALLER CONTRACT:          9 Foundation routes covered; legacy negative guards present
CI:                       PASS — Foundation F0.2 #237
PR:                       #25 — MERGED
MERGE SHA:                504c2e18453ad068fd2640a97d21154050602b81
SUPABASE:                 APPLIED + VERIFIED
DB REPLAY/CONFLICT:       PASS
APPEND-ONLY AUDIT:        PASS
TYPED WRAPPER SMOKE:      PASS
BUSINESS ROW RESTORE:     rollbackEqual=true
VERCEL PRODUCTION:        READY + root HTTP 200
VPS RUNTIME:              PENDING — chưa có SSH connector trong phiên thực hiện
GATEWAY REPLAY SMOKE:     PENDING — chạy sau pullmcp
FULL RELEASE:             PENDING
```

A5.5.1 chưa được gọi là `FULL RELEASE VERIFIED` cho đến khi VPS chạy merge SHA và authenticated Gateway smoke chứng minh replay/conflict qua runtime thật.

## 2. Source và CI

### PR / merge

```text
PR:        #25
Head SHA:  484b1f655c9383495e93bcd04637a773b3a09e67
Merge SHA: 504c2e18453ad068fd2640a97d21154050602b81
```

### Final CI

```text
Workflow:    Foundation F0.2
Run:         #237
Run ID:      29557444713
Conclusion:  success
```

Các gate đều PASS:

- runtime hardcode audit;
- direct mutation scanner + retirement policy;
- A5.5.1 caller contract;
- production hygiene;
- direct DB mutation audit;
- deploy/frontend Gateway auth contracts;
- backend Foundation verify;
- TypeScript;
- Next production build.

### Mutation scanner

```text
legacy debt:  0
unclassified: 0
forbidden:    0
```

## 3. Database ownership được triển khai

### Persisted state

```text
public.mcp_idempotency_records
```

Đây là mutable state machine cho:

- claim;
- request hash;
- processing lease;
- completed response;
- attempt count;
- replay;
- conflict;
- expiry.

Unique boundary:

```text
(installation_id, operation, idempotency_key)
```

### Append-only ledger

```text
public.mcp_audit_events
```

Ledger lưu request/actor/operation/aggregate/outcome/hash/metadata đã redact. Trigger `mcp_audit_events_append_only` từ chối mọi `UPDATE` và `DELETE`.

### Internal helpers

```text
mcp_idempotency_request_hash
mcp_idempotency_begin
mcp_idempotency_complete
mcp_append_audit_event
```

Các helper generic bị revoke `EXECUTE` khỏi `public`, `anon`, `authenticated` và `service_role`; chúng chỉ được typed SECURITY DEFINER wrappers gọi nội bộ.

### Chín typed wrappers

```text
mcp_idempotent_record_session_customer_result
mcp_idempotent_add_session_customer
mcp_idempotent_create_session_report_snapshot
mcp_idempotent_save_session_report_ai_result
mcp_idempotent_update_field_check_result
mcp_idempotent_create_report_setting_group
mcp_idempotent_update_report_setting_group
mcp_idempotent_create_report_setting_item
mcp_idempotent_update_report_setting_item
```

Quyền production đã verify:

```text
wrapper count:               9
service_role executable:     true
anon executable:             false
authenticated executable:    false
```

## 4. Production migrations

Source files:

```text
supabase/migrations/20260717090000_idempotency_audit_core.sql
supabase/migrations/20260717091000_foundation_idempotent_mutations.sql
```

Production migration history:

```text
20260717052137  idempotency_audit_core
20260717052340  foundation_idempotent_mutations
```

### Root-cause correction khi apply

Lần apply core đầu tiên fail trước commit:

```text
ERROR 42883: function digest(bytea, unknown) does not exist
```

Nguyên nhân thật:

- production cài `pgcrypto` trong schema `extensions`;
- helper có `search_path=public`;
- source gọi `digest(...)` không schema-qualified.

Sửa đúng source và test:

```text
create extension if not exists pgcrypto with schema extensions;
extensions.digest(...)
```

Có đúng 3 lời gọi `extensions.digest(...)`. Lần apply lỗi rollback sạch; kiểm tra sau lỗi cho thấy hai bảng chưa tồn tại. Source sửa đã chạy CI lại trước khi apply production lần hai.

## 5. Supabase verification

```text
mcp_idempotency_records exists: true
mcp_audit_events exists:        true
RLS idempotency:                true
RLS audit:                      true
helper count:                   4
append-only trigger:            true
service_role SELECT:            true
authenticated SELECT denied:    true
```

Supabase advisor báo `RLS enabled, no policy` ở hai bảng mới ở mức `INFO`. Đây là deny-all có chủ đích: browser roles không được đọc/ghi; service role chỉ có SELECT và typed wrappers thực hiện mutation nội bộ. Không tạo policy `USING (true)` để làm im advisor.

Các WARN security/performance khác thuộc schema cũ và không được trộn vào phạm vi A5.5.1.

## 6. Core production smoke

Fixture namespace:

```text
installation: release-smoke
operation:    release-smoke.core
key:          a551.core.smoke.20260717
```

Kết quả:

```text
first request:                  execute
first replayed:                 false
same key + same payload:        replay
replayed response equal:        true
originalRequestId preserved:    true
same key + different payload:   idempotency_key_conflict
record status:                  completed
attempt count:                  2
audit event 1:                  succeeded
audit event 2:                  replayed
append-only UPDATE blocked:     true
```

## 7. Typed wrapper production smoke

Wrapper:

```text
mcp_idempotent_update_report_setting_group
```

Safe existing row:

```text
mcp_setting_groups.id = msg_0687516286014cc5b77cf667b6c9f349
```

Smoke chỉ ghi lại title hiện tại, sau đó restore toàn bộ row về snapshot ban đầu.

Kết quả:

```text
first request:                  replayed=false
same key + same payload:        replayed=true
same response preserved:        true
same key + different payload:   idempotency_key_conflict
aggregate id persisted:         true
audit succeeded event:          true
audit replayed event:           true
business row restore:           rollbackEqual=true
```

Không còn fixture nghiệp vụ sau restore. Hai idempotency/audit smoke records được giữ lại có chủ đích làm release evidence.

## 8. Client/runtime contract

Stable-key helper sinh một key cho một user intent và giữ nguyên key qua retry mạng. Proxy không tự sinh random key.

Đã onboard đúng 9 Foundation route cases:

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

Legacy follow-up, session edit/delete và 18 legacy cases còn lại không bị helper retry bọc nhầm. Toàn bộ 21 legacy-proxied route cases thuộc A5.5.2.

## 9. Vercel production

```text
Project:        mcp-plan
Project ID:     prj_jbe4PGuBPwVZa71UNfra6wssc3gJ
Deployment ID:  dpl_6XpaVDosdXwrPk8cr6EtmNGaM76U
Target:         production
State:          READY
Git SHA:        504c2e18453ad068fd2640a97d21154050602b81
Domain:         https://mcp-plan.vercel.app
Root smoke:     HTTP 200
```

`/api/health` trên Vercel trả 404 vì Next app không định nghĩa route đó; Gateway health nằm ở VPS port 3001. Root `/` trả 200 và render dashboard dữ liệu thật.

## 10. Gate còn lại — VPS/Gateway

Phiên thực hiện này không có SSH connector hoặc private-key mount, nên không được ghi giả là đã deploy VPS.

Lệnh duy nhất cần chạy trên VPS shell:

```bash
pullmcp
```

`ops/pullmcp` sẽ:

1. reset source về `origin/main`;
2. chạy backend verify;
3. stage runtime đầy đủ;
4. atomic swap + backup;
5. restart `mcp-plan-backend` qua PM2;
6. smoke health/auth/CORS;
7. in `F0.2_VPS_SMOKE=PASS`.

Sau deploy phải chạy authenticated Gateway idempotency smoke trên một Foundation route an toàn:

```text
1. request đầu với key K + payload P => 200, replayed=false
2. request hai với K + P          => 200, replayed=true
3. request ba với K + P2          => 409 IDEMPOTENCY_KEY_CONFLICT
4. restore business row           => rollbackEqual=true
5. query audit ledger              => succeeded + replayed
```

Không bắt đầu A5.5.2 trước khi gate này PASS và evidence được cập nhật.

## 11. Rollback

### Runtime

`pullmcp` tạo backup runtime và tự restore nếu verify/start/smoke fail. Không đụng `milktea-backend` port 3002.

### Database

Hai bảng/core wrappers đã có production evidence và Vercel code mới phụ thuộc chúng. Không drop bảng hoặc wrapper để rollback nóng. Nếu runtime mới lỗi, rollback runtime về backup trước; DB objects giữ tương thích và không ảnh hưởng browser roles.

## 12. Handoff chính xác

```text
A5.5.1 code/CI/DB/Vercel: COMPLETE
A5.5.1 VPS/Gateway:       PENDING
Exact next command:       pullmcp
After pullmcp:            authenticated Gateway replay/conflict/restore/audit smoke
Then:                     update this file + CURRENT_PROGRESS.md
Only after that:          start A5.5.2 audit/implementation for 21 legacy routes
Order Core:               BLOCKED
```
