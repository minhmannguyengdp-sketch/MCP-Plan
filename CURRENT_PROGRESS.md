# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-19**  
> Master plan: **Phase A / NPP-F05 / A5.5.2**  
> Trạng thái: **MASTER PLAN CONTINUES — ROUTE CREATE/UPDATE SOURCE MERGED — PRODUCTION RUNTIME PENDING**

## 1. Quyết định trình tự hiện tại

Owner đã quyết định:

```text
1. Tiếp tục master plan A5.5.2 trước.
2. Hoãn lượt mobile production test/fix MCP sang một pass riêng sau.
3. Không dùng quyết định hoãn này để bỏ bất kỳ live smoke hoặc rollout gate nào.
4. Không bắt đầu NPP-F06.
5. Không bắt đầu Order Core.
6. Không đụng milktea-backend hoặc port 3002.
```

Không được ghi Chromium smoke thay cho kiểm tra điện thoại production. Không được ghi `RUNTIME PASS` nếu chưa áp migration, pull VPS và chạy authenticated runtime smoke có dọn fixture.

## 2. Coverage A5.5.2 đã sửa

Con số handoff cũ `13/30` bị thiếu operation persisted-idempotent `route-customer.add` từ PR #29.

```text
Plan:                         ke-hoach-app-van-hanh-npp.md
Phase:                        Phase A — Foundation portability
Current milestone:            NPP-F05 / A5.5.2
Corrected original baseline:  14/30
PR #65 source slice:          +4 session lifecycle routes
PR #66 source slice:          +2 route create/update routes
Source coverage merged:       20/30
Original routes remaining:    10
Runtime verified now:         14/30
```

Hai operation phát sinh sau khi mẫu số 30 được khóa — `session-customer.checkin.set` và standalone `order.create` — vẫn phải tuân thủ Foundation/idempotency nhưng không làm đổi mẫu số original inventory.

Inventory và invariant:

```text
docs/npp-plan/A5_5_2_MUTATION_INVENTORY_AND_SESSION_LIFECYCLE.md
docs/npp-plan/A5_5_2_ROUTE_MASTER_WRITE_SLICE.md
```

## 3. PR #66 — Route create/update

```text
PR:                         #66 — MERGED / SOURCE PASS
Branch:                     a5-5-2-route-master-write
Merge SHA:                  5692e7592a94e51b6f41b88c8543156cc95c5dec
Foundation F0.2:            #537 PASS
F05 UI Browser Smoke:       #133 PASS
Supabase migration applied: NO
VPS pullmcp:                NO
Production runtime smoke:   NO
Vercel deploy:              NO
```

Hai public operations:

```text
POST  /api/routes        route.create
PATCH /api/routes/:id    route.update
```

Kiến trúc:

```text
McpMasterView
-> Next same-origin proxy
-> authenticated Foundation Gateway
-> typed route API / route mutation owner
-> service-role-only persisted-idempotent PostgreSQL wrapper
-> existing mcp_create_route / mcp_update_route business owner
```

Source guarantees đã PASS:

- create/update dùng stable `Idempotency-Key` tại caller;
- replay cùng key/payload trả persisted response;
- cùng key/khác payload conflict;
- trusted request/installation/actor context được ghi vào `mcp_routes.raw_payload`;
- append-only audit qua persisted idempotency owner;
- exact provider fingerprints, không wildcard/dynamic target;
- Gateway intercept trước transitional/legacy fallback;
- archive `/archive` không bị route API DB-only nhận nhầm;
- scanner, backend Foundation, typecheck, frontend production build và browser smoke PASS.

Migration source:

```text
supabase/migrations/20260719210000_a5_5_2_route_master_write_idempotency.sql
```

## 4. PR #65 — Session lifecycle

```text
PR:                         #65 — MERGED / SOURCE PASS
Merge SHA:                  f8df14acd453e7452d3542eaff2618f964a034b6
Foundation F0.2:            #533 PASS
F05 UI Browser Smoke:       #131 PASS
Supabase migration applied: NO
VPS pullmcp:                NO
Production runtime smoke:   NO
Vercel deploy:              NO
```

Bốn operations:

```text
POST   /api/mcp-day/open-session                  route-session.open
POST   /api/mcp-day/session-customer/status       session-customer.status.update
PATCH  /api/mcp-sessions/:id                      route-session.update
DELETE /api/mcp-sessions/:id                      route-session.delete-empty
```

Migration source:

```text
supabase/migrations/20260719200000_a5_5_2_session_lifecycle_idempotency.sql
```

## 5. Root boundary decisions

### Session lifecycle

- một active session trên mỗi route;
- lock order canonical khi mở phiên;
- skipped/cancelled customer status bắt buộc reason;
- không bỏ âm thầm order/test/report/follow-up activity;
- session đã đóng là read-only;
- chỉ hard-delete session rỗng, non-closed; có activity thì cancel.

### Route master

Route create/update được tách khỏi ba route còn lại vì chúng không dùng chung một owner:

```text
DB-only route aggregate:
- POST  /api/routes
- PATCH /api/routes/:id

Route-customer aggregate với historical RPC overloads:
- PATCH /api/route-customers/:id

Cross-system PostgreSQL + private R2 orchestration:
- POST /api/routes/:id/archive
- POST /api/route-customers/:id/archive
```

Không được bọc hai archive operation như một PostgreSQL transaction giả. Owner phải giữ deletion job/R2 lifecycle hiện tại và bổ sung persisted user-intent idempotency đúng cross-system logic.

## 6. Remaining original 10 routes

### S2b — Route-customer update: 1

```text
PATCH /api/route-customers/:id
```

Trước khi code phải giải quyết rõ hai overload lịch sử của `mcp_update_route_customer`; không đoán signature và không để legacy chọn owner ngầm.

### S2c — Route/customer archive with R2: 2

```text
POST /api/routes/:id/archive
POST /api/route-customers/:id/archive
```

Hai route đã có Foundation R2 deletion lifecycle owner, nhưng public user intent chưa có persisted replay/conflict/audit chuẩn A5.5.2.

### S3 — Route settings: 7

```text
POST /api/mcp-settings/order-template
POST /api/mcp-settings/test-template
POST /api/mcp-settings/report-template
POST /api/mcp-settings/followup-template
POST /api/mcp-settings/skip-reason-template
POST /api/mcp-settings/customer-add-rule
POST /api/mcp-settings/session-status
```

`mcp-settings/session-status` là admin/settings intent, không gộp với runtime session lifecycle dù cùng dùng canonical lifecycle owner.

## 7. Production rollout còn pending

PR #65 và #66 đều chỉ SOURCE PASS. Khi owner yêu cầu rollout production, phải thực hiện theo thứ tự có kiểm chứng:

```text
1. Apply migration session lifecycle.
2. Apply migration route create/update.
3. VPS pullmcp.
4. Verify PM2 mcp-plan-backend.
5. Verify HTTP health trên 127.0.0.1:3001.
6. Chạy guarded authenticated runtime smoke cho từng operation:
   - execute;
   - replay;
   - conflict;
   - audit;
   - trusted context;
   - business invariant;
   - complete fixture cleanup.
7. Chỉ sau runtime PASS mới tăng runtime coverage từ 14/30.
```

Không dùng route/customer/session production thật cho smoke.

## 8. PR #64 — standalone order creation

```text
PR:                         #64 — MERGED / SOURCE PASS
Merge SHA:                  d9b04441f6802b6840d026f3ae5dc2afc30a0728
Foundation F0.2:            #525 PASS
F05 UI Browser Smoke:       #124 PASS
Supabase migration applied: NO
VPS pullmcp:                NO
Vercel deploy:              NO
Production test:            NO
```

Source có nút tạo đơn, khách đã có/khách vãng lai, product picker và typed standalone order owner. Không được nói tính năng đã live trước migration + VPS + Vercel + smoke.

## 9. MCP/R2/mobile test còn nợ

Các hạng mục này được hoãn, không bị hủy:

- mobile production AppShell/theme/interaction feedback;
- storefront photo create/view/delete full R2 smoke;
- route customer photo preview production check;
- tab order standalone production check;
- MCP UX issues người dùng phát hiện sau khi test thật;
- cleanup timer và production R2 state re-verification.

## 10. Runtime topology

```text
VPS source:          /var/www/mcp-plan-source
VPS runtime:         /var/www/mcp-plan-backend
PM2 process:         mcp-plan-backend
Foundation Gateway: 127.0.0.1:3001
Legacy internal:     127.0.0.1:3102
Milktea backend:     3002 — KHÔNG ĐỤNG
```

Backend health:

```bash
pm2 list
curl -fsS http://127.0.0.1:3001/health
```

Không dùng `systemctl is-active mcp-plan-backend.service`.

## 11. Điểm tiếp tục

```text
A. Nếu owner yêu cầu tiếp source master plan:
   bắt đầu S2b route-customer update;
   đọc và chọn explicit canonical overload trước khi viết wrapper.

B. Nếu owner yêu cầu rollout:
   apply migrations -> pullmcp -> health -> guarded runtime smokes -> evidence.

C. Nếu owner chuyển sang test/fix MCP:
   dừng master-plan coding, kiểm production state thật trước khi sửa UI.
```

Không chỉ ghi trạng thái trong chat; mọi thay đổi trạng thái phải cập nhật file này.
