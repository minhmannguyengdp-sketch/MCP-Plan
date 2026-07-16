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
IMPLEMENTATION: NOT STARTED
CODE CHANGE:    NONE
MIGRATION:      NONE
SCANNER DEBT:   3
TARGET:         3 -> 0
```

Evidence:

- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_AUDIT.md`

Ba fingerprints còn lại:

```text
474001fbfa0d1de1ed003364  field-check direct PATCH
f70d562b03f15f08cae868e8  field-check direct POST
ffb1c503e59aa8fcf8f0344f  market-report direct POST
```

### Kết luận audit

1. Field-check PATCH là caller live qua `MarketChecksClientPage` và `/api/field-checks/result`.
2. Field-check POST/create là fallback sai logic; valid session test luôn có `resultId`. Production: 4/4 `test_id` match result, missing 0.
3. Route `/api/mcp-market-reports` là duplicate dead/broken path. Active UI dùng `/api/backend/mcp-day/session-customer/report` -> `mcp_create_report_from_session_customer`.
4. Production có 0 row source `mcp_market_report_api`, nhưng có 3 row source canonical RPC.
5. Route market cũ còn thiếu `id` bắt buộc khi insert `market_reports`.
6. Field-check đang ghi status UI `normal/opportunity/risk` vào DB vốn dùng `pending/ok/retry/follow/interested/bad/sample`; phải sửa mapping cùng phase.
7. Field-check direct PATCH có thể trả 200 + null khi row không tồn tại và đang overwrite toàn bộ `raw_payload`.
8. `test_customer_results` và `market_reports` vẫn có anon INSERT/UPDATE permissive policies; phải drop mutation policies sau cutover.

### Ownership đích

```text
Field-check UI
-> authenticated Foundation Gateway
-> field-check application owner
-> mcp_update_field_check_result service-role-only RPC
-> locked test_customer_results row
```

Chỉ tạo một update RPC; không tạo create RPC field-check mới.

Market report giữ owner chuẩn hiện tại:

```text
/api/backend/mcp-day/session-customer/report
-> mcp_create_report_from_session_customer
```

Xóa duplicate `/api/mcp-market-reports`.

### Bước implementation tiếp theo

1. Tạo branch/PR riêng.
2. Tạo `field-check-mutations.js`.
3. Tạo RPC update service-role-only, lock row, 404 đúng, merge `raw_payload` + Foundation context.
4. Require `resultId`; xóa fallback POST create.
5. Sửa status read/write mapping về domain DB chuẩn.
6. Xóa dead market route + handler.
7. Drop anon INSERT/UPDATE policies cho hai bảng; giữ SELECT nếu còn cần.
8. Thêm migration/use-case/Gateway/caller/dead-route/RLS tests.
9. Retire đúng 3 fingerprints; scanner `3 -> 0`, unclassified 0, forbidden 0.
10. Apply migration, production smoke có restore/cleanup, deploy VPS và cập nhật evidence.

Không cần pull local/VPS cho hai commit audit tài liệu. Chưa bắt đầu Order Core. Sau A5.4.4 mới tới A5.5 persisted idempotency + append-only audit.

## Quy tắc tiến độ bắt buộc

Mỗi phase chỉ được tuyên bố hoàn tất khi repo đã ghi trạng thái, test/CI/scanner, migration/smoke, commit/PR, Supabase/VPS/Vercel, blocker và bước tiếp theo trong:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi trong chat.