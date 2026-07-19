# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật: **2026-07-19**  
> Master plan: **Phase A / NPP-F05 / A5.5.2**  
> Trạng thái: **MASTER PLAN CONTINUES — SESSION LIFECYCLE SOURCE MERGED — PRODUCTION RUNTIME PENDING**

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

## 2. Vị trí master plan và coverage đã sửa

Con số handoff cũ `13/30` bị thiếu operation persisted-idempotent `route-customer.add` từ PR #29.

```text
Plan:                         ke-hoach-app-van-hanh-npp.md
Phase:                        Phase A — Foundation portability
Current milestone:            NPP-F05 / A5.5.2
Corrected original baseline:  14/30
PR #65 source slice:          +4 session lifecycle routes
Source coverage merged:       18/30
Original routes remaining:    12
Runtime verified now:         14/30
```

Hai operation phát sinh sau khi mẫu số 30 được khóa — `session-customer.checkin.set` và standalone `order.create` — vẫn phải tuân thủ Foundation/idempotency nhưng không làm đổi mẫu số original inventory.

Inventory và invariant đầy đủ:

```text
docs/npp-plan/A5_5_2_MUTATION_INVENTORY_AND_SESSION_LIFECYCLE.md
```

## 3. PR #65 — A5.5.2 Session Lifecycle

```text
PR:                         #65 — MERGED / SOURCE PASS
Branch:                     a5-5-2-session-lifecycle
Merge SHA:                  f8df14acd453e7452d3542eaff2618f964a034b6
Foundation F0.2:            #533 PASS
F05 UI Browser Smoke:       #131 PASS
Supabase migration applied: NO
VPS pullmcp:                NO
Production runtime smoke:   NO
Vercel deploy:              NO
```

Bốn public operations trong slice:

```text
POST   /api/mcp-day/open-session                  route-session.open
POST   /api/mcp-day/session-customer/status       session-customer.status.update
PATCH  /api/mcp-sessions/:id                      route-session.update
DELETE /api/mcp-sessions/:id                      route-session.delete-empty
```

Kiến trúc:

```text
Browser caller
-> Next same-origin proxy
-> authenticated Foundation Gateway
-> typed session-lifecycle owner
-> service-role-only persisted-idempotent PostgreSQL wrapper
-> existing canonical PostgreSQL business owner
```

Bảo đảm source đã PASS:

- stable `Idempotency-Key` tại caller;
- same-key/same-payload replay contract;
- same-key/different-payload conflict contract;
- trusted Foundation request/installation/actor context;
- append-only audit through persisted idempotency wrappers;
- exact provider fingerprints, không wildcard/dynamic target;
- Foundation intercept trước legacy fallback;
- direct DB mutation scanner vẫn giữ debt/unclassified/forbidden bằng 0;
- backend Foundation, typecheck, frontend production build và browser smoke PASS.

Invariants giữ nguyên:

- một active session trên mỗi route;
- lock order canonical khi mở phiên;
- skipped/cancelled customer status bắt buộc reason;
- không được bỏ âm thầm order/test/report/follow-up activity;
- session đã đóng là read-only;
- close-session snapshot vẫn thuộc canonical update owner;
- chỉ hard-delete session rỗng, non-closed; có activity thì phải cancel.

## 4. Root cause CI đã sửa

CI cũ gộp bốn nhóm mutation policy trong một step nên không xác định được nhóm lỗi. Workflow đã được tách thành các gate có tên riêng mà không bỏ test.

A5.5.1 caller contract cũ từng bắt buộc `McpSessionsManagerSafe.callApi` dùng raw `fetch`, vì trước đây chỉ snapshot được onboard. Khi PATCH/DELETE session được onboard, assertion đó trở thành kiến trúc lỗi thời. Contract đã được nâng cấp để:

- cấm raw mutation trong `callApi`;
- buộc PATCH dùng `route-session.update`;
- buộc DELETE dùng `route-session.delete-empty`;
- vẫn giữ snapshot operation `session-report.snapshot.create`.

## 5. Rollout gate cho PR #65

Chỉ thực hiện khi owner yêu cầu rollout production:

```text
1. Apply migration 20260719200000_a5_5_2_session_lifecycle_idempotency.sql.
2. VPS pullmcp.
3. Verify PM2 mcp-plan-backend and HTTP health on 3001.
4. Run guarded authenticated lifecycle smoke:
   - execute;
   - replay;
   - conflict;
   - audit;
   - trusted context;
   - business invariant;
   - complete fixture cleanup.
5. Chỉ sau runtime PASS mới ghi runtime coverage 18/30.
```

Không dùng customer/route/session production thật cho smoke. Destructive smoke chỉ dùng guarded temporary empty session.

## 6. Remaining original 12 routes after PR #65 source merge

### S2 — Route master: 5

```text
POST  /api/routes
PATCH /api/routes/:id
POST  /api/routes/:id/archive
PATCH /api/route-customers/:id
POST  /api/route-customers/:id/archive
```

Hai archive route đã có Foundation R2 lifecycle owner, nhưng vẫn còn thiếu persisted idempotency/audit chuẩn A5.5.2 cho public user intent.

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

`mcp-settings/session-status` thuộc admin/settings intent, không trộn với runtime session-lifecycle slice dù dùng chung canonical lifecycle owner.

## 7. PR #64 — standalone order creation

```text
PR:                         #64 — MERGED
Merge SHA:                  d9b04441f6802b6840d026f3ae5dc2afc30a0728
Foundation F0.2:            #525 PASS
F05 UI Browser Smoke:       #124 PASS
Supabase migration applied: NO
VPS pullmcp:                NO
Vercel deploy:              NO
Production test:            NO
```

Source đã có nút tạo đơn, chọn khách đã có hoặc nhập khách vãng lai, product picker và typed standalone order owner. Không được nói tính năng đã live trước khi migration + VPS + Vercel + smoke hoàn tất.

## 8. MCP/R2/mobile test còn nợ

Các hạng mục này được hoãn theo quyết định trình tự, không bị hủy:

- mobile production AppShell/theme/interaction feedback;
- storefront photo create/view/delete full R2 smoke;
- route customer photo preview production check;
- tab order standalone production check;
- MCP UX issues người dùng phát hiện sau khi test thật;
- cleanup timer và production R2 state re-verification.

## 9. Runtime topology

```text
VPS source:          /var/www/mcp-plan-source
VPS runtime:         /var/www/mcp-plan-backend
PM2 process:         mcp-plan-backend
Foundation Gateway: 127.0.0.1:3001
Legacy internal:     127.0.0.1:3102
Milktea backend:     3002 — KHÔNG ĐỤNG
```

Backend health phải kiểm bằng:

```bash
pm2 list
curl -fsS http://127.0.0.1:3001/health
```

Không dùng `systemctl is-active mcp-plan-backend.service`.

## 10. Điểm tiếp tục sau PR #65

```text
A. Nếu owner yêu cầu rollout:
   migration -> pullmcp -> health -> guarded lifecycle runtime smoke -> evidence.

B. Nếu owner yêu cầu tiếp source master plan mà chưa rollout:
   bắt đầu S2 Route Master, nhưng phải ghi rõ runtime PR #65 vẫn pending.

C. Nếu owner chuyển sang test/fix MCP:
   dừng master-plan coding tại đây, kiểm production state thật trước khi sửa UI.
```

Không chỉ ghi trạng thái trong chat; mọi thay đổi trạng thái phải cập nhật file này.
