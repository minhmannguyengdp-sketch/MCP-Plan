# MCP-Plan — Current Progress

> File handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-17**  
> Phase hiện tại: **A5.5 — persisted idempotency + append-only audit (audit next)**

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
VPS:            DEPLOYED + VERIFIED
GATEWAY SMOKE:  PASS
FULL RELEASE:   VERIFIED
SCANNER DEBT:   3 -> 0
UNCLASSIFIED:   0
FORBIDDEN:      0
```

Evidence:

- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_AUDIT.md`
- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_OWNER.md`

Production runtime evidence:

```text
pullmcp:                  F0.2_VPS_SMOKE=PASS
backup:                   /var/www/mcp-plan-backend.backup.20260717-003144
PM2 mcp-plan-backend:     online, restart 0
Gateway:                  127.0.0.1:3001
legacy internal:          127.0.0.1:3102
milktea-backend:          port 3002, process riêng, không đụng tới
health:                   HTTP 200 + canonical requestId
```

Authenticated Gateway mutation smoke:

```text
POST /api/field-checks/result: PASS
canonical envelope:           PASS
status mapping:               opportunity -> interested
persisted status:             interested
Foundation context:           PASS
restore rollbackEqual:        true
fixture remaining:            false
```

Local pull/build mới không có output trong chat cuối nên không ghi nhận giả; đây không phải release blocker vì merge-context CI production build, Supabase production, VPS runtime và authenticated mutation smoke đều verified.

A5.4.4 đã đóng. Không sửa thêm trong phase này.

## A5.5 — Persisted idempotency + append-only audit

```text
AUDIT:          NOT STARTED
IMPLEMENTATION: NOT STARTED
CODE CHANGE:    NONE
MIGRATION:      NONE
```

### Audit tiếp theo bắt buộc

1. Tìm toàn bộ nơi đọc/truyền `Idempotency-Key`, `idempotencyKey`, `requestId` và `receivedAt`.
2. Xác định request lặp hiện replay response, trả conflict hay chỉ dựa vào uniqueness/upsert.
3. Liệt kê tất cả mutation owner/RPC đã nhận Foundation context nhưng chưa có persisted idempotency record.
4. Audit bảng, trigger, function và log hiện có liên quan đến audit/event/history.
5. Phân biệt audit append-only thật với metadata mutable trong `raw_payload`.
6. Đề xuất transaction boundary gồm payload hash, response snapshot, trạng thái processing/completed/failed, lease/retry và conflict semantics.
7. Xác định retention, cleanup, index, RLS/grants, service-role boundary và dữ liệu nhạy cảm cần redact.
8. Chỉ audit trước; chưa sửa code, chưa migration, chưa PR implementation.
9. Xuất evidence `docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md` và cập nhật file này.
10. **Chưa bắt đầu Order Core.**

## Quy tắc tiến độ bắt buộc

Mỗi phase chỉ được tuyên bố hoàn tất khi repo đã ghi trạng thái, test/CI/scanner, migration/smoke, commit/PR, Supabase/VPS/Vercel, blocker và bước tiếp theo trong:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi trong chat.
