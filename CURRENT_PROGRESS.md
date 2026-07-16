# MCP-Plan — Current Progress

> File handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-16**  
> Phase hiện tại: **A5.4.4 — field-check + market-report write ownership (audit next)**

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

Production runtime evidence:

```text
backend tests:           60/60 pass
PM2 mcp-plan-backend:    online, restart 0
Gateway:                 127.0.0.1:3001
legacy internal:         127.0.0.1:3102
milktea backend:         port 3002, process riêng, không đụng tới
Foundation boundary:     PASS
health/auth/CORS smoke:  PASS
```

Authenticated Gateway mutation smoke:

```text
POST  /api/mcp-report-setting-groups: PASS
PATCH /api/mcp-report-setting-groups: PASS
POST  /api/mcp-report-settings:       PASS
PATCH /api/mcp-report-settings:       PASS
canonical envelope:                   PASS
Foundation context:                   PASS
optional field clear:                 PASS
cleanup final:                        group 0 / item 0
```

A5.4.3 đã hoàn tất. Không sửa thêm trong phase này.

## Bước tiếp theo chính xác

Bắt đầu **A5.4.4 — field-check + market-report writes**, trước tiên audit, chưa sửa code.

Ba legacy findings còn lại:

```text
474001fbfa0d1de1ed003364  field-check update
f70d562b03f15f08cae868e8  field-check create
ffb1c503e59aa8fcf8f0344f  market-report create
```

Mục tiêu:

```text
direct mutation debt: 3 -> 0
```

Audit phải xác định caller live/dead, route owner hiện tại, table/RPC, transaction boundary, validation, context, cleanup và thứ tự triển khai. Chưa bắt đầu Order Core. Sau A5.4.4 mới tới A5.5 persisted idempotency + append-only audit.

## Quy tắc tiến độ bắt buộc

Mỗi phase chỉ được tuyên bố hoàn tất khi repo đã ghi trạng thái, test/CI/scanner, migration/smoke, commit/PR, Supabase/VPS/Vercel, blocker và bước tiếp theo trong:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi trong chat.