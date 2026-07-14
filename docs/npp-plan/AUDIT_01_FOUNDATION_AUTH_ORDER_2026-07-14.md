# Audit 01 — Foundation, Auth và luồng Đơn hàng hiện tại

> Trạng thái: **COMPLETE / READ-ONLY AUDIT**  
> Ngày audit: **2026-07-14**  
> Phạm vi: foundation portability, tenant/auth boundary, `orders`, `order_items`, luồng tạo đơn từ MCP  
> Kết luận triển khai: **NO-GO cho Order Core mới trước khi hoàn thành Foundation Slice F0**

## 1. Mục tiêu

Audit hiện trạng trước khi phát triển App NPP nhiều tenant nhằm trả lời:

```text
1. Backend hiện đang phụ thuộc Supabase tới mức nào?
2. Request có actor/tenant context đã xác thực hay chưa?
3. orders/order_items có đủ constraint và mutation boundary hay chưa?
4. Luồng tạo đơn từ MCP có idempotent và an toàn khi gọi lặp hay chưa?
5. Dữ liệu order production hiện có vấn đề gì cần migration/backfill?
6. Có thể bắt đầu ngay order lifecycle mới hay phải khóa foundation tối thiểu trước?
```

Audit này không sửa code, không chạy migration, không thay dữ liệu và không deploy.

## 2. Phạm vi đã kiểm tra

### Code/runtime

- `apps/backend/server.js` và helper gọi Supabase.
- Đường UI tạo đơn trong phiên MCP.
- Endpoint/proxy và RPC dùng để tạo đơn từ session customer.
- Wrapper response và cách normalize lỗi hiện tại.

### Database production

- Schema `orders`, `order_items`.
- Liên kết với `mcp_session_customers`, sản phẩm và biến thể.
- Constraint, index, trigger, RLS policy và table grants.
- Function `mcp_create_order_from_session_customer`.
- Thống kê chất lượng dữ liệu order hiện tại.
- Sự tồn tại của tenant/organization/membership/role/permission model.

### Giới hạn

- Storage, queue và background job chưa tham gia trực tiếp vào luồng tạo order hiện tại; khi các thành phần này được đưa vào Order/Fulfillment phải audit tenant scope lại trước khi dùng.
- Không đọc dữ liệu cá nhân chi tiết; audit chỉ dùng metadata schema, aggregate count và function definition.

## 3. Kết luận điều hành

Không nên bắt đầu code toàn bộ vòng đời đơn hàng ngay.

Lý do không phải vì thiếu UI, mà vì bốn nền bắt buộc chưa tồn tại hoặc chưa khóa:

```text
BLOCKER 1: orders/order_items chưa có tenant ownership.
BLOCKER 2: anon/authenticated vẫn có đường ghi trực tiếp vào orders/order_items.
BLOCKER 3: request tạo đơn chưa có TenantContext/actor business context.
BLOCKER 4: tạo đơn từ MCP chưa idempotent theo source và có thể tạo lặp.
```

Hướng đúng:

```text
Audit hoàn tất
-> Foundation Slice F0 tối thiểu
-> làm sạch/migrate order legacy có kiểm soát
-> Order draft -> confirmed vertical slice
-> Fulfillment/Inventory
-> Receivable/Payment
-> Return/Exchange
```

Không xây trọn bộ nền SaaS trước. Chỉ xây foundation tối thiểu đủ để Order Core không phải đập lại.

## 4. Kiến trúc hiện tại

Luồng runtime:

```text
Browser/PWA
  -> Next.js/Vercel proxy
    -> VPS Node HTTP server
      -> Supabase REST/RPC/Edge Function bằng service role
```

Backend hiện tại có các helper gọi trực tiếp:

```text
supabaseGet(table, params)
supabaseInsert(table, rows)
supabasePatch(table, values)
supabaseRpc(functionName, args)
proxySupabaseFunction(functionName, body)
```

Nhận xét:

- Transport/controller, application logic và provider access còn nằm gần nhau trong một server lớn.
- Tên bảng, RPC và lỗi provider vẫn là khái niệm nội bộ trực tiếp của backend.
- Chưa có lớp `OrderRepository`, `TransactionManager`, `IdempotencyStore` hoặc use case trung tính cho order.
- Cách hiện tại chạy được cho MCP v1 nhưng không phù hợp để mở rộng Order Core đa tenant và chuyển provider sau này.

## 5. Response và request context hiện tại

Success wrapper hiện tại:

```json
{
  "data": {},
  "receivedAt": "..."
}
```

Chưa thấy trong đường order đã audit:

```text
requestId
tenantId đã xác thực
actorId
membershipId
permission/scope
idempotency key chuẩn
canonical business error object
```

CORS trong backend hiện cho phép origin cấu hình, mặc định `*`. Danh sách header thể hiện trong code chỉ gồm `Content-Type, Accept`; chưa thấy `Authorization`, tenant selector hoặc idempotency header được xử lý ở đoạn audit.

Kết luận:

- Backend hiện xác thực hạ tầng bằng service role, nhưng chưa chứng minh được actor nghiệp vụ nào đang thực hiện request.
- Service role không thể thay thế tenant scope hoặc business permission.
- `created_by`/`updated_by` trong `orders` đang nullable và luồng RPC hiện tại không cung cấp actor đầy đủ.

## 6. Tenant và auth model

Kết quả schema audit:

- Có `auth.users`; số tài khoản hiện tại: **3**.
- Không tìm thấy public model rõ ràng cho:

```text
tenants / organizations
tenant_memberships
roles / permissions
scope assignments
installations
entitlements
```

Các bảng nghiệp vụ đã kiểm tra chưa có `tenant_id` hoặc `organization_id`:

```text
orders
order_items
mcp_session_customers
mcp_route_customers
products
product_variants
product_unit_rules
```

Rủi ro:

- Không thể chứng minh một row thuộc NPP nào khi dùng shared database.
- Unique/index/FK hiện chưa tenant-scoped.
- Khi bán cho NPP thứ hai, chỉ filter ở UI hoặc body request là không đủ an toàn.
- Không có foundation để chuyển một tenant sang DB/backend riêng mà giữ cùng identity/domain contract.

Quyết định:

- App NPP mới phải bắt đầu bằng `TenantContext` được backend xác thực.
- MCP v1 frozen chưa được thêm `tenant_id` âm thầm.
- Trong giai đoạn chuyển tiếp, MCP legacy dùng `fixedTenantContext` do backend cấu hình và client không được đổi.
- Migration MCP sang multi-tenant phải versioned, có backfill, smoke và isolation test riêng.

## 7. Schema `orders`

Các nhóm field hiện có:

```text
id, order_code
customer_id
route_id, session_id
status
payment_method, note
subtotal, discount_total, grand_total
source_type, source_id
sync_status
created_at, updated_at
created_by, updated_by
```

Thiếu cho Order Core:

```text
tenant_id / organization_id
version hoặc optimistic lock
idempotency_key
order lifecycle constraint
fulfillment_status riêng
payment_status riêng
currency/rounding contract rõ ràng
business document sequence tenant-scoped
actor bắt buộc cho mutation quan trọng
```

`status` hiện là text mặc định `draft`, nhưng chưa có check constraint giới hạn trạng thái hợp lệ.

## 8. Schema `order_items`

Các field chính:

```text
id
order_id
product_id, variant_id
product_name, sku, unit
quantity
unit_price, discount, line_total
note, created_at
```

Constraint hiện có:

- Primary key.
- FK `order_id -> orders(id)` với `ON DELETE CASCADE`.

Thiếu:

```text
tenant_id
quantity > 0 check
product_id/variant_id FK đáng tin cậy
unit snapshot/conversion contract
created_by/updated_by
version/audit event
ordered/cancelled/allocated/shipped/delivered/returned quantities
```

`ON DELETE CASCADE` hiện phù hợp với dữ liệu draft/legacy đơn giản, nhưng không được dùng để xóa lịch sử order đã ảnh hưởng kho/công nợ trong Order Core mới.

## 9. Constraint và index audit

Đã xác nhận:

- `orders` chỉ có primary key trong nhóm constraint audit.
- `order_items` có primary key và FK về `orders`.
- Không có unique constraint cho `order_code`.
- Không có unique constraint cho source reference.
- Không có check `quantity > 0`.
- Không có check order status.
- Không có tenant-aware composite FK/index.
- Không tìm thấy trigger active trên `orders`/`order_items` trong truy vấn audit.

Hệ quả:

- Duplicate source/order code hiện không bị DB chặn.
- Dữ liệu dòng số lượng 0 có thể tồn tại.
- Tính tiền và invariant phụ thuộc hoàn toàn vào từng đường mutation, dễ lệch khi có endpoint khác.

## 10. Security boundary của `orders` và `order_items`

RLS đang bật nhưng chưa phải boundary an toàn.

Policy ghi nhận:

```text
orders:
- anon SELECT
- anon INSERT WITH CHECK true
- anon UPDATE USING true / WITH CHECK true

order_items:
- anon SELECT
- anon INSERT WITH CHECK true
- anon UPDATE USING true / WITH CHECK true
```

Table grants còn rộng hơn:

```text
anon và authenticated có:
SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
trên orders và order_items
```

RLS có thể chặn một số thao tác không có policy tương ứng, nhưng với `INSERT/UPDATE ... true`, client dùng anon key vẫn còn đường ghi trực tiếp hợp lệ.

Đây là **BLOCKER** vì:

- VPS backend chưa phải mutation boundary duy nhất cho order.
- Không có actor/tenant permission được backend kiểm soát.
- Một client có thể bypass use case, transition, idempotency và audit.

So sánh:

- Các bảng `mcp_*` đã được khóa mutation về `service_role` theo MCP v1 freeze.
- `orders` và `order_items` chưa được khóa tương đương vì chúng là bảng dùng chung ngoài boundary `mcp_*`.

Không được revoke ngay mà không audit consumer. Việc revoke phải đi trong migration có kiểm thử toàn bộ đường tạo/read/export order và rollback/forward-fix rõ ràng.

## 11. Luồng tạo đơn từ MCP

UI hiện tạo đơn bằng request dạng:

```text
POST /api/mcp-orders/from-session-customer
```

Payload chứa:

```text
sessionCustomerId
items
note
status = confirmed
```

Chưa gửi:

```text
tenant context
actor context
idempotency key
expected version
```

RPC `mcp_create_order_from_session_customer` có các điểm tốt:

- Chạy transaction tại DB.
- Lock session customer.
- Chặn phiên đã đóng.
- Tạo `orders` và `order_items` thật.
- Gắn order vào session customer/visit và cập nhật counter.
- Quyền execute RPC đã giới hạn cho `service_role`.

Nhưng có lỗi thiết kế cần xử lý trước Order Core:

### 11.1 Không idempotent theo source

Không có unique/check trước khi tạo theo:

```text
(source_type, source_id, operation)
```

Gọi lại request có thể tạo order mới.

### 11.2 Có thể ghi đè liên kết order của session customer

RPC cập nhật `mcp_session_customers.order_id` bằng order mới. Nếu gọi lại, liên kết hiện tại có thể bị thay bằng order sau, trong khi order cũ vẫn còn.

### 11.3 Chấp nhận quantity bằng 0

Quantity được chuẩn hóa không âm nhưng vẫn có thể bằng 0. Dữ liệu thực tế đã có dòng nonpositive.

### 11.4 Mã đơn phụ thuộc timestamp

Order code sinh theo timestamp nhưng không có unique constraint/sequence atomic. Dữ liệu hiện đã có nhóm order code trùng.

### 11.5 Tạo thẳng `confirmed`

MCP v1 đang tạo order đã xác nhận theo contract hiện hành. Order Core tương lai không được biến endpoint này thành toàn bộ vòng đời đơn. Cần adapter/source integration để đưa order MCP vào domain order mới mà không phá contract frozen.

## 12. Chất lượng dữ liệu order hiện tại

Snapshot aggregate tại thời điểm audit:

| Chỉ số | Kết quả |
|---|---:|
| Orders | 18 |
| Order items | 12 |
| Orphan item | 0 |
| Item thiếu order_id | 0 |
| Order không có item | 7 |
| Order thiếu customer_id | 0 |
| Order thiếu source_type | 5 |
| Order thiếu source_id | 5 |
| Order thiếu status | 0 |
| Header total lệch tổng item | 0 |

Phân bố status:

| Status | Số lượng |
|---|---:|
| confirmed | 10 |
| draft | 7 |
| created | 1 |

`created` là trạng thái legacy không nằm trong contract order dự kiến.

Phân bố source:

| Source type | Số lượng |
|---|---:|
| mcp_session_customer | 13 |
| null | 5 |

Bất thường dữ liệu:

| Vấn đề | Kết quả |
|---|---:|
| Nhóm duplicate source reference | 1 |
| Nhóm duplicate order_code | 1 |
| Dòng quantity <= 0 | 3 |
| Dòng thiếu product_id | 4 |
| Dòng thiếu variant_id | 4 |
| Dòng thiếu SKU | 4 |
| Dòng thiếu unit | 2 |
| Giá âm | 0 |
| Discount âm | 0 |

Kết luận dữ liệu:

- Không được thêm constraint `NOT NULL`, unique hoặc `quantity > 0` trực tiếp trước khi phân loại/backfill các row legacy.
- Bảy order không có item cần phân loại: draft hợp lệ, dữ liệu cũ, order shell hay lỗi.
- Duplicate source/order code phải được xử lý bằng mapping/quarantine, không tự xóa.
- Không backfill fulfillment/payment status bằng suy đoán.

## 13. Risk register

| Mức | Rủi ro | Tác động | Điều kiện gỡ |
|---|---|---|---|
| BLOCKER | Không có tenant ownership | Rò dữ liệu chéo NPP, không thể shared SaaS an toàn | Tenant model + backfill + isolation tests |
| BLOCKER | Anon/auth ghi trực tiếp order | Bypass backend/domain/audit | Migration revoke/policy sau consumer audit |
| BLOCKER | Không có TenantContext/actor boundary | Không biết ai làm gì trong NPP nào | Auth middleware + membership/scope |
| BLOCKER | Tạo order MCP không idempotent | Duplicate order, ghi đè link | Idempotency/source uniqueness + retry tests |
| HIGH | Backend khóa chặt provider | Khó chuyển DB/backend, khó test domain | Use case/ports/adapters |
| HIGH | Một order status gánh nhiều ý nghĩa | Sai giao hàng/thanh toán | Tách order/fulfillment/payment status |
| HIGH | Constraint order yếu | Dữ liệu xấu tiếp tục tăng | Backfill rồi thêm check/unique/FK |
| HIGH | Mã order không sequence atomic | Trùng số khi concurrent | Tenant-scoped document sequence |
| HIGH | Legacy data không đồng nhất | Migration thất bại/suy diễn sai | Mapping + review queue + reconciliation |
| MEDIUM | Response chưa có requestId/error object | Khó trace và đổi provider | Canonical API envelope |
| MEDIUM | CORS/header chưa phục vụ auth context | Auth integration chưa rõ | Explicit CORS/auth/idempotency headers |

## 14. Quyết định kiến trúc sau audit

### 14.1 Chưa làm full Order Core

Không bắt đầu ngay sửa/hủy/giao thiếu/trả/đổi khi foundation chưa khóa.

### 14.2 Chỉ làm Foundation Slice F0 tối thiểu

Không xây toàn bộ màn hình tenant administration hoặc dedicated deployment ngay.

F0 chỉ cần đủ để:

- request có tenant/actor context;
- order use case không phụ thuộc Supabase;
- DB mutation chỉ đi qua backend;
- retry không duplicate;
- Tenant A không đọc/ghi dữ liệu Tenant B;
- API trả DTO/error trung tính.

### 14.3 Không sửa MCP v1 âm thầm

- Giữ MCP frozen.
- Dùng `fixedTenantContext` cho installation hiện tại.
- Thay đổi tenant/idempotency liên quan MCP phải migration/version/test rõ ràng.

### 14.4 Không xem service role là permission

Service role chỉ là credential hạ tầng. Backend vẫn phải kiểm tra actor, membership, tenant, scope và policy.

## 15. Thứ tự triển khai bắt buộc tiếp theo

### F0.1 — Canonical request context

```text
requestId
TenantContext
actorId
membershipId
permission/scope
fixedTenantContext cho MCP legacy
```

Acceptance:

- Client không thể tự đổi tenant nếu không có membership.
- Request thiếu context bị chặn ở mutation mới.
- MCP legacy chỉ dùng tenant cố định do server cấu hình.

### F0.2 — Tách application/use case và ports

Tối thiểu:

```text
CreateOrderDraft
ConfirmOrder
OrderRepository
TransactionManager
IdempotencyStore
AuditEventStore
Clock
IdGenerator
```

Supabase/PostgreSQL chỉ nằm trong adapter.

### F0.3 — Canonical API envelope

Success:

```json
{
  "data": {},
  "receivedAt": "...",
  "requestId": "req_..."
}
```

Error:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "details": {},
    "retryable": false
  },
  "receivedAt": "...",
  "requestId": "req_..."
}
```

### F0.4 — Consumer audit rồi khóa mutation table

Trước khi revoke:

```text
1. Liệt kê mọi Next route/VPS route/RPC/export/import đang dùng orders/order_items.
2. Chuyển mutation hợp lệ về backend service/use case.
3. Thêm smoke test.
4. Migration revoke anon/auth write và gỡ policy write=true.
5. Xác nhận read contract không bị phá.
```

### F0.5 — Tenant model và migration plan

Tối thiểu:

```text
tenants/organizations
tenant_memberships
installations hoặc fixed installation mapping
actor/audit context
```

Sau đó thiết kế backfill tenant cho order/product/customer/MCP legacy.

### F0.6 — Làm sạch order legacy

```text
- phân loại 7 order không có item;
- map status created;
- map 5 order thiếu source;
- xử lý duplicate source/order code;
- xử lý 3 dòng quantity <= 0;
- phân loại các dòng thiếu product/variant/SKU/unit;
- không xóa hoặc suy diễn fulfillment/payment.
```

### F0.7 — Constraint và idempotency

Sau backfill:

```text
unique tenant-scoped order number
unique source/idempotency contract
quantity > 0
status checks
FK/invariant tenant-safe
optimistic version
audit event
```

### F0.8 — Order vertical slice đầu tiên

Chỉ khi F0 pass:

```text
create draft
-> update draft
-> confirm
-> cancel before fulfillment
```

Chưa làm fulfillment/payment/return trong slice đầu.

## 16. Gate trước khi code Order Core

Order Core chỉ được bắt đầu khi toàn bộ mục sau đạt:

```text
[ ] TenantContext đã xác thực ở backend
[ ] Actor/audit context hoạt động
[ ] Repository/application boundary có test
[ ] Public API không lộ lỗi provider
[ ] Anon/auth không còn mutation trực tiếp orders/order_items
[ ] Legacy order anomalies có mapping/backfill plan
[ ] Idempotency contract đã khóa
[ ] Tenant isolation tests pass
[ ] MCP v1 smoke vẫn pass
[ ] Migration và rollback/forward-fix plan được duyệt
```

## 17. Checklist audit

```text
[x] MT-01A Audit tenant scope trên đường Order/MCP hiện tại
[x] S-01 Audit auth/user/RLS/permission liên quan order
[x] O-01 Audit orders/order_items/API/UI/production aggregates
[x] Audit RPC tạo order từ MCP
[x] Audit constraint/index/RLS/table grant
[x] Audit dữ liệu legacy bằng aggregate, không đọc PII
[x] Xác định blockers và thứ tự remediation

[ ] MT-02 Chốt tenant/organization/membership/installation model
[ ] MT-03 Implement TenantContext
[ ] MT-04 Canonical API envelope
[ ] MT-05 Repository/transaction/idempotency ports
[ ] S-02 Permission catalog tối thiểu
[ ] O-02 Khóa lifecycle/transition matrix
[ ] Viết migration/backfill
[ ] Sửa code
[ ] Deploy
```

## 18. Kết luận cuối

```text
Audit Bước 1 đã hoàn thành.

MCP v1 core đang frozen và mutation mcp_* đã được bảo vệ tốt hơn.
Tuy nhiên order domain dùng chung chưa đủ điều kiện để mở rộng thành App NPP nhiều tenant.

Việc tiếp theo đúng logic là Foundation Slice F0,
không phải làm thêm UI đơn hàng và cũng không phải xây toàn bộ SaaS administration.
```
