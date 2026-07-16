# A5.4.4 — Field-check + market-report write ownership

> Cập nhật: **2026-07-16**  
> Trạng thái: **SOURCE / CI / SUPABASE VERIFIED — MERGE & VPS PENDING**  
> PR: **#24**  
> Audit đầu vào: `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_AUDIT.md`

## 1. Kết quả triển khai

Field-check update hiện có một application owner duy nhất:

```text
Browser
-> POST /api/field-checks/result
-> authenticated Foundation Gateway
-> apps/backend/foundation/field-check-mutations.js
-> mcp_update_field_check_result
-> locked test_customer_results row
```

Không tạo RPC field-check create mới. Request thiếu `resultId` fail trước provider. Duplicate route `/api/mcp-market-reports` và direct market-report handler đã bị xóa; luồng market report chuẩn vẫn là:

```text
/api/backend/mcp-day/session-customer/report
-> mcp_create_report_from_session_customer
```

## 2. Logic field-check đã sửa

Write mapping:

```text
normal      -> ok
opportunity -> interested
risk        -> bad
```

Read mapping bao phủ vocabulary cũ:

```text
opportunity: ok, interested, sample
risk:        bad, retry, follow
normal:      pending, tested và giá trị còn lại
```

RPC mới:

- yêu cầu `resultId` và `productName`;
- lock row `FOR UPDATE`;
- bỏ qua row đã soft-delete;
- trả `field_check_result_not_found` khi không có row;
- kiểm tra `sessionCustomerId` khi caller gửi lên;
- merge `raw_payload` cũ với metadata whitelisted và Foundation context;
- không overwrite JSON mù;
- chỉ cho `service_role` EXECUTE.

## 3. Database cutover

Migration source:

```text
supabase/migrations/20260716234500_field_check_mutation_owner.sql
supabase/migrations/20260716234600_close_field_check_public_writes.sql
```

Production records:

```text
20260716171112  field_check_mutation_owner
20260716171124  close_field_check_public_writes
```

Production permission verification:

```text
mcp_update_field_check_result:
  SECURITY DEFINER: true
  search_path: public
  service_role EXECUTE: true
  anon EXECUTE: false
  authenticated EXECUTE: false

browser INSERT/UPDATE/TRUNCATE grants:
  test_customer_results: 0
  market_reports:         0

mutation policies on both tables: 0
SELECT policies: retained
```

## 4. Scanner retirement

Retired fingerprints:

```text
474001fbfa0d1de1ed003364  field-check direct PATCH
f70d562b03f15f08cae868e8  field-check direct POST
ffb1c503e59aa8fcf8f0344f  market-report direct POST
```

Result:

```text
direct mutation debt: 3 -> 0
unclassified:         0
forbidden:            0
```

Approved boundary fingerprint:

```text
9c0c82bc255db9f5e5285357  mcp_update_field_check_result RPC owner
```

## 5. Tests and CI

Final CI trước evidence commit:

```text
workflow: Foundation F0.2
run:      29518627223
number:   177
result:   SUCCESS
```

Đã pass:

```text
runtime hardcode audit
scanner + retirement policy
production hygiene
backend build/tests
field-check use-case tests
migration locking/permission/context tests
Gateway/caller/dead-route regressions
TypeScript typecheck
Next production build
```

## 6. Production smoke

Smoke dùng một result thật trong PostgreSQL subtransaction và chủ động rollback.

```text
RPC update:                 PASS
status mapping:             PASS
raw_payload preserved:      PASS
Foundation context:         PASS
session-customer validation:PASS
rollback byte-equal:        true
```

Không có fixture hoặc thay đổi dữ liệu còn lại sau smoke.

## 7. Release state

```text
AUDIT:         COMPLETE
SOURCE:        VERIFIED
CI:            VERIFIED
SUPABASE:      APPLIED + VERIFIED
PR #24:        OPEN — READY TO MERGE
MAIN:          PENDING MERGE
LOCAL:         PENDING PULL AFTER MERGE
VPS:           PENDING PULL/DEPLOY AFTER MERGE
GATEWAY SMOKE: PENDING AFTER VPS DEPLOY
FULL RELEASE:  PENDING
```

## 8. Bước tiếp theo bắt buộc

1. Chạy final CI sau commit evidence.
2. Merge PR #24 khi CI xanh.
3. Local pull `main` và chạy production build.
4. VPS chạy `pullmcp` ngay vì backend runtime thay đổi.
5. Kiểm tra PM2, logs, health, cổng 3001/3102; không đụng Milktea 3002.
6. Chạy authenticated Gateway smoke `/api/field-checks/result` trên row thật với restore/rollback.
7. Cập nhật merge SHA, VPS evidence và trạng thái VERIFIED trong file này cùng `CURRENT_PROGRESS.md`.
8. Chỉ sau đó mới bắt đầu A5.5 persisted idempotency + append-only audit.

Chưa bắt đầu Order Core.
