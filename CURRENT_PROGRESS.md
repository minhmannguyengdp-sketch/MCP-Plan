# MCP-Plan — Current Progress

> Đọc file này trước khi tiếp tục.  
> Cập nhật: **2026-07-19**  
> Phase: **A / NPP-F05 / A5.5.2**  
> Trạng thái: **SOURCE 21/30 — RUNTIME 14/30 — PRODUCTION ROLLOUT PENDING**

## Quyết định hiện tại

- Tiếp tục master plan A5.5.2 trước.
- Hoãn mobile production test/fix MCP sang pass riêng.
- Không bắt đầu NPP-F06 hoặc Order Core.
- Không đụng `milktea-backend` hoặc port `3002`.
- Không ghi runtime PASS khi chưa apply migration, pull VPS và chạy authenticated smoke có cleanup.

## Coverage

Baseline cũ `13/30` thiếu `route-customer.add`; baseline đúng là `14/30`.

```text
PR #65 session lifecycle:    +4
PR #66 route create/update:  +2
PR #67 route-customer edit:  +1
Source merged:               21/30
Remaining original routes:   9
Runtime verified:            14/30
```

## PR #67 — Route-customer update

```text
PR:                    #67 MERGED / SOURCE PASS
Merge SHA:             39c3c77b1c3e4588c04faaf33c5a07c25b72f0fc
Foundation F0.2:       #540 PASS
F05 Browser Smoke:     #134 PASS
Migration applied:     NO
VPS pullmcp:           NO
Production smoke:      NO
Vercel deploy:         NO
```

Operation:

```text
PATCH /api/route-customers/:id
route-customer.update
```

Production có hai overload `mcp_update_route_customer`. Source owner gọi explicit overload 13 tham số để giữ `geo_accuracy`, `geo_source`, `google_maps_url`; overload 10 tham số chưa bị xóa khi chưa có retirement evidence.

Migration:

```text
supabase/migrations/20260719220000_a5_5_2_route_customer_update_idempotency.sql
```

## Earlier merged source slices

```text
PR #66 route.create / route.update
Merge: 5692e7592a94e51b6f41b88c8543156cc95c5dec
Migration: 20260719210000_a5_5_2_route_master_write_idempotency.sql

PR #65 session lifecycle x4
Merge: f8df14acd453e7452d3542eaff2618f964a034b6
Migration: 20260719200000_a5_5_2_session_lifecycle_idempotency.sql
```

## Remaining 9 routes

### S2c — R2 archive orchestration: 2

```text
POST /api/routes/:id/archive
POST /api/route-customers/:id/archive
```

Đã có Foundation R2 deletion lifecycle và retry jobs, nhưng public user intent còn thiếu persisted replay/conflict/audit. Không giả vờ R2 + PostgreSQL là một transaction.

### S3 — Settings: 7

```text
POST /api/mcp-settings/order-template
POST /api/mcp-settings/test-template
POST /api/mcp-settings/report-template
POST /api/mcp-settings/followup-template
POST /api/mcp-settings/skip-reason-template
POST /api/mcp-settings/customer-add-rule
POST /api/mcp-settings/session-status
```

## Production debt còn pending

PR #64, #65, #66, #67 chỉ SOURCE PASS. Rollout phải theo thứ tự migrations → `pullmcp` → `pm2 list` → health `127.0.0.1:3001` → guarded execute/replay/conflict/audit/context/invariant smoke → cleanup fixture.

Không dùng dữ liệu khách/tuyến/phiên thật cho smoke.

MCP/R2/mobile test còn nợ: AppShell/feedback mobile, R2 create/view/delete, preview ảnh khách, standalone order, cleanup timer và các UX issue người dùng phát hiện.

## Điểm tiếp tục

Đọc owner thật của S2c và S3, chọn lát cắt nhỏ nhất khép kín, ghi invariant/retry/test plan trước khi code. Không chỉ cập nhật trạng thái trong chat.
