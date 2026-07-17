# MCP-Plan — Current Progress

> File handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-17**  
> Phase hiện tại: **A5.5.1 — idempotency core + Foundation mutation onboarding**

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

## A5.4.3 — Report Settings mutation ownership

```text
AUDIT:         COMPLETE
SOURCE:        VERIFIED
CI:            VERIFIED
SUPABASE:      APPLIED + VERIFIED
PR:            #23 — MERGED
MERGE SHA:     a7a26cafd03e37695407b4b73ed6485f5c5215bb
VPS:           DEPLOYED + VERIFIED
GATEWAY SMOKE: PASS
FULL RELEASE:  VERIFIED
SCANNER:       7 -> 3
```

Evidence:
- `docs/npp-plan/A5_4_3_REPORT_SETTINGS_AUDIT.md`
- `docs/npp-plan/A5_4_3_REPORT_SETTINGS_OWNER.md`

## A5.4.4 — Field-check + market-report writes

```text
AUDIT:         COMPLETE
SOURCE:        VERIFIED
CI:            VERIFIED
SUPABASE:      APPLIED + VERIFIED
PR:            #24 — MERGED
MERGE SHA:     7eed7a69ff7efd386971b7a820561b0cb1660848
VPS:           DEPLOYED + VERIFIED
GATEWAY SMOKE: PASS
FULL RELEASE:  VERIFIED
SCANNER:       3 -> 0
UNCLASSIFIED:  0
FORBIDDEN:     0
```

Evidence:
- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_AUDIT.md`
- `docs/npp-plan/A5_4_4_FIELD_CHECK_MARKET_REPORT_OWNER.md`

Runtime:

```text
pullmcp:               F0.2_VPS_SMOKE=PASS
backup:                /var/www/mcp-plan-backend.backup.20260717-003144
PM2:                   online, restart 0
Gateway:               127.0.0.1:3001
legacy internal:       127.0.0.1:3102
milktea-backend:       port 3002, không đụng tới
field-check smoke:     PASS
restore rollbackEqual: true
fixture remaining:     false
```

A5.4.4 đã đóng.

## A5.5 — Persisted idempotency + append-only audit

```text
AUDIT:          COMPLETE
IMPLEMENTATION: NOT STARTED
CODE CHANGE:    NONE
MIGRATION:      NONE
TOTAL SCOPE:    30 mutation route cases
FOUNDATION:     9
LEGACY PROXY:   21
```

Evidence:
- `docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md`

### Audit findings

1. Hệ thống chỉ có request correlation, chưa có persisted idempotency.
2. Next proxy và Gateway chỉ validate/forward key; không claim, hash, lock, replay hoặc lưu response.
3. Production có 0 idempotency object, 0 audit/event/history object và 0 audit trigger.
4. Có 8 RPC nhận Foundation context; snapshot report chưa nhận context.
5. Legacy internal có 21 mutation route cases không truyền context vào RPC.
6. Unique constraint, row lock và upsert chỉ là idempotent-ish.
7. Context trong `raw_payload` là mutable last-write metadata, không phải history.
8. `pgcrypto` đã có để dùng SHA-256.
9. A5.5 chỉ hoàn tất khi đạt 30/30 route cases onboard hoặc route được retire.

### A5.5.1 tiếp theo

1. Tạo branch/PR riêng.
2. Tạo `mcp_idempotency_records` và `mcp_audit_events`.
3. Tạo helper claim/replay/complete và append audit trong typed RPC transaction.
4. Chặn audit UPDATE/DELETE; browser roles không có mutation grant.
5. Bổ sung context cho session report snapshot.
6. Onboard đủ 9 Foundation mutation route cases.
7. Thêm stable-key client helper; không sinh key mới mỗi retry.
8. Bắt buộc test replay, key conflict, active lease, concurrency, rollback, redaction và append-only.
9. Apply migration + production smoke trước merge/deploy.
10. Sau đó A5.5.2 onboard 21 legacy route cases.
11. **Chưa bắt đầu Order Core.**

Hai commit closure/audit chỉ là tài liệu; chưa cần pull local hoặc VPS.

## Quy tắc tiến độ bắt buộc

Mỗi phase chỉ hoàn tất khi repo đã ghi test/CI/scanner, migration/smoke, SHA/PR, Supabase/VPS/Vercel, blocker và bước tiếp theo trong:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```
