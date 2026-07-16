# MCP-Plan — Current Progress

> File handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-16**  
> Phase hiện tại: **A5.4.4 — field-check + market-report write ownership**

## A5.4.2 — Session report write ownership

```text
SOURCE:       VERIFIED
CI:           VERIFIED
SUPABASE:     VERIFIED
VPS:          DEPLOYED + VERIFIED
VERCEL PROD:  PENDING — account build-rate-limit
FULL RELEASE: PENDING
```

Evidence: `docs/npp-plan/A5_4_2_SESSION_REPORT_OWNER.md`

Còn hai gate: authenticated production mutation smoke cho snapshot/AI-result và Vercel production deploy current main.

## A5.4.3 — Report Settings mutation ownership

```text
AUDIT:          COMPLETE
SOURCE:         VERIFIED
CI:             VERIFIED
SUPABASE:       APPLIED + VERIFIED
PR:             #23 — MERGED
MERGE SHA:      a7a26cafd03e37695407b4b73ed6485f5c5215bb
LOCAL BUILD:    PASS
VPS DEPLOY:     PASS
GATEWAY SMOKE:  PASS
FULL RELEASE:   VERIFIED
SCANNER DEBT:   7 -> 3
UNCLASSIFIED:   0
FORBIDDEN:      0
```

Evidence:

- `docs/npp-plan/A5_4_3_REPORT_SETTINGS_AUDIT.md`
- `docs/npp-plan/A5_4_3_REPORT_SETTINGS_OWNER.md`

A5.4.3 đã đóng, không sửa thêm.

## A5.4.4 — Field-check + market-report writes

```text
AUDIT:          COMPLETE
SOURCE:         VERIFIED
CI:             VERIFIED
SUPABASE:       APPLIED + VERIFIED
PR:             #24 — MERGED
MERGE SHA:      7eed7a69ff7efd386971b7a820561b0cb1660848
MAIN:           UPDATED
LOCAL:          PENDING PULL
VPS:            PENDING PULL/DEPLOY
GATEWAY SMOKE:  PENDING AFTER VPS DEPLOY
FULL RELEASE:   PENDING
SCANNER DEBT:   3 -> 0
UNCLASSIFIED:   0
FORBIDDEN:      0
```

Evidence:

- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_AUDIT.md`
- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_OWNER.md`

### Ownership đã triển khai

```text
Field-check UI
-> authenticated Foundation Gateway
-> apps/backend/foundation/field-check-mutations.js
-> mcp_update_field_check_result service-role-only RPC
-> locked test_customer_results row
```

- `resultId` bắt buộc; không còn fallback create field-check.
- Status UI được map về vocabulary DB chuẩn.
- RPC merge `raw_payload` và Foundation context, không overwrite mù.
- Duplicate route `/api/mcp-market-reports` đã xóa.
- Market report chuẩn vẫn dùng `/api/backend/mcp-day/session-customer/report` -> `mcp_create_report_from_session_customer`.
- Browser roles không còn INSERT/UPDATE/TRUNCATE trên `test_customer_results` và `market_reports`.
- Mutation policies trên hai bảng bằng 0; SELECT policies vẫn giữ.

### CI và production DB

```text
Final CI run:             29518939926
CI run number:            179
CI result:                SUCCESS

Production migrations:
20260716171112  field_check_mutation_owner
20260716171124  close_field_check_public_writes

RPC service_role EXECUTE: true
RPC anon/auth EXECUTE:    false
browser mutation grants:  0
mutation policies:         0
```

Production smoke trong subtransaction rollback:

```text
RPC update:                  PASS
status mapping:              PASS
raw_payload preserved:       PASS
Foundation context:          PASS
session-customer validation: PASS
rollback byte-equal:         true
```

### Bước tiếp theo chính xác

1. Local pull `main` và chạy `npm run build`.
2. VPS chạy `pullmcp` ngay vì backend runtime thay đổi.
3. Kiểm tra PM2, logs, health, Gateway 3001 và legacy internal 3102.
4. Không đụng `milktea-backend` port 3002.
5. Chạy authenticated Gateway smoke `/api/field-checks/result` có restore/rollback.
6. Cập nhật VPS evidence và trạng thái FULL RELEASE VERIFIED.
7. Sau đó bắt đầu A5.5 persisted idempotency + append-only audit.

**Chưa bắt đầu Order Core.**

## Quy tắc tiến độ bắt buộc

Mỗi phase chỉ được tuyên bố hoàn tất khi repo đã ghi trạng thái, test/CI/scanner, migration/smoke, commit/PR, Supabase/VPS/Vercel, blocker và bước tiếp theo trong:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi trong chat.
