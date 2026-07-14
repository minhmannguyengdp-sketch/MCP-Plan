# Foundation — Multi-tenant và khả năng chuyển DB/backend

> Trạng thái: **FOUNDATION / REQUIRED BEFORE NEW CORE MUTATIONS**  
> Mục tiêu: một codebase có thể phục vụ nhiều NPP, đồng thời có thể tách riêng DB/backend cho từng NPP mà không viết lại logic nghiệp vụ  
> Áp dụng cho: MCP, khách hàng, sản phẩm, đơn hàng, tồn kho, công nợ, nhân viên, kế hoạch, báo cáo và phân quyền

## 1. Quyết định kiến trúc

Hệ thống phải hỗ trợ ba kiểu triển khai nhưng giữ cùng contract nghiệp vụ:

```text
Mode A — Shared SaaS
Nhiều NPP dùng chung frontend, backend và database; dữ liệu tách bằng tenant_id.

Mode B — Shared application, isolated database
Dùng chung code/backend runtime nhưng mỗi NPP có database hoặc schema riêng.

Mode C — Dedicated deployment
Một NPP có backend, database, storage và cấu hình riêng.
```

Không được viết logic nghiệp vụ chỉ chạy được ở Mode A. Việc chọn mode triển khai là cấu hình hạ tầng/adapters, không làm thay đổi API hoặc domain behavior.

## 2. Khái niệm chuẩn

```text
tenant / organization / distributor = một NPP độc lập về dữ liệu và cấu hình
branch                            = chi nhánh thuộc NPP
warehouse                         = kho thuộc NPP/chi nhánh
actor                             = người hoặc system job thực hiện thao tác
membership                        = quan hệ tài khoản được phép truy cập NPP
installation                      = một deployment hoặc kết nối hạ tầng cụ thể
```

Trong code và contract lõi dùng tên trung tính như `tenantId` hoặc `organizationId`. Tên thương mại “NPP” chỉ là cách hiển thị.

## 3. Tenant context bắt buộc

Mọi request nghiệp vụ phải có `TenantContext` đã được backend xác thực:

```ts
TenantContext {
  tenantId
  actorId
  membershipId
  branchIds
  warehouseIds
  roles
  permissions
  requestId
}
```

Quy tắc:

1. Không tin `tenantId` trong body do frontend gửi.
2. Backend suy ra tenant từ đăng nhập, membership, domain/subdomain, installation hoặc tenant selector đã được xác minh.
3. Header như `X-Tenant-Id` chỉ được dùng để chọn tenant; backend vẫn phải kiểm tra actor có membership tương ứng.
4. Background job phải có system actor và tenant scope rõ ràng.
5. Service role/database admin không được coi là quyền nghiệp vụ.
6. Cache key, idempotency key, queue job, file path và log correlation đều phải chứa tenant scope.

## 4. Quy tắc data model multi-tenant

Mặc định mọi bảng nghiệp vụ phải có:

```text
tenant_id NOT NULL
created_at
updated_at
created_by
updated_by
```

Ngoại lệ “global/shared” phải được khai báo rõ, không tự suy diễn.

Bắt buộc:

- unique nghiệp vụ phải gồm `tenant_id`, ví dụ `(tenant_id, order_number)`;
- index truy vấn chính bắt đầu bằng hoặc bao gồm `tenant_id` khi phù hợp;
- FK không được nối chéo tenant;
- document number có sequence theo tenant/branch/policy;
- audit/event/outbox phải lưu `tenant_id`;
- object storage dùng namespace tenant, ví dụ `tenant/<tenantId>/...`;
- import/export phải giữ tenant ownership;
- không dùng ID tuần tự toàn hệ thống làm thông tin có thể đoán giữa các tenant;
- ID API là opaque UUID/ULID hoặc mã trung tính, không phụ thuộc khóa chính của một provider.

Nếu database không hỗ trợ composite FK thuận tiện, backend và migration phải có constraint/trigger hoặc invariant test tương đương để chặn liên kết chéo tenant.

## 5. Trạng thái MCP v1 hiện tại

MCP v1 đã frozen nên không thêm `tenant_id` âm thầm vào contract hiện hành.

Đường chuyển đúng:

```text
1. Audit toàn bộ bảng mcp_* và dữ liệu production.
2. Xác định tenant hiện tại cho dữ liệu legacy.
3. Viết migration/backfill có kiểm tra orphan và rollback/forward-fix.
4. Version contract nếu output/behavior thay đổi.
5. Giữ adapter tương thích cho consumer MCP v1.
6. Chạy full MCP smoke và multi-tenant isolation test.
```

Trong giai đoạn chưa migrate, MCP hiện tại được xem là một installation single-tenant có `fixedTenantContext`. Không được dùng trạng thái tạm này làm thiết kế lâu dài cho App NPP nhiều khách hàng.

## 6. Phân lớp backend để không khóa provider

```text
HTTP/Transport layer
  -> Application use cases
    -> Domain rules/invariants
      -> Ports/interfaces
        -> Adapters
           - PostgreSQL/Supabase adapter hiện tại
           - Auth adapter
           - Storage adapter
           - Queue/event adapter
           - Database/backend adapter khác trong tương lai
```

### 6.1 Domain/Application

- Không import Supabase client, Express, Next.js response hoặc SQL trực tiếp.
- Nhận và trả model/DTO trung tính.
- Chứa transaction boundary theo use case, invariant, transition và idempotency policy.
- Không trả lỗi provider ra ngoài.

### 6.2 Ports

Ví dụ:

```ts
OrderRepository
InventoryRepository
ReceivableRepository
CustomerRepository
TransactionManager
IdempotencyStore
AuditEventStore
ObjectStorage
IdentityProvider
Clock
IdGenerator
```

Port mô tả năng lực nghiệp vụ cần dùng, không mô tả cú pháp Supabase hoặc tên bảng.

### 6.3 Adapters

Adapter chịu trách nhiệm:

- map domain model <-> schema/provider;
- SQL/query/RPC/provider SDK;
- normalize lỗi unique/FK/timeout/concurrency;
- transaction implementation;
- pagination implementation;
- provider health/observability.

Có thể dùng Supabase/PostgreSQL mạnh ở adapter, nhưng domain contract không được phụ thuộc vào nó.

## 7. API contract trung tính

Success response giữ wrapper ổn định:

```json
{
  "data": {},
  "receivedAt": "2026-07-14T00:00:00.000Z",
  "requestId": "req_..."
}
```

Error response chuẩn:

```json
{
  "error": {
    "code": "ORDER_ALREADY_CONFIRMED",
    "message": "Đơn hàng đã được xác nhận.",
    "details": {},
    "retryable": false
  },
  "receivedAt": "2026-07-14T00:00:00.000Z",
  "requestId": "req_..."
}
```

Không trả ra frontend:

- tên bảng/cột nội bộ;
- mã lỗi Supabase/PostgREST/PostgreSQL nguyên bản;
- SQL/RPC name;
- connection string/provider URL;
- service-role/auth provider detail;
- stack trace.

Quy ước dữ liệu:

- thời gian ISO 8601 UTC, timezone nghiệp vụ nằm trong tenant settings;
- tiền dùng minor unit hoặc decimal string theo contract đã khóa, không dùng float tùy tiện;
- quantity có precision và unit rõ ràng;
- enum/status là business code, không phải label UI;
- pagination dùng cursor trung tính khi có thể;
- sort/filter dùng field contract, adapter tự map sang schema;
- ID là opaque string;
- field provider-specific chỉ được đặt trong `meta.provider` nội bộ và không thuộc public contract mặc định.

## 8. Không để schema DB trở thành API

Cấm:

```text
SELECT * rồi trả thẳng row ra frontend
frontend gọi trực tiếp bảng cho mutation nghiệp vụ
API field trùng tên cột chỉ vì tiện, không qua contract
controller chứa SQL và transition nghiệp vụ
RPC Supabase trở thành public API contract
provider error quyết định message/behavior frontend
```

Mỗi use case phải có mapper:

```text
request DTO -> command/query -> domain result -> response DTO
```

## 9. RLS và security boundary

- Backend permission + tenant scope là hàng rào bắt buộc.
- RLS/DB policy là defense-in-depth, không thay thế backend authorization.
- Khi dùng service role, mọi query vẫn phải có tenant predicate hoặc chạy qua repository đã tenant-scoped.
- Không có repository method “list all” không scope trừ module system admin riêng, được audit và deny-by-default.
- Cross-tenant support/impersonation phải có explicit reason, thời hạn và audit.
- Test phải cố tình dùng ID của tenant khác để chứng minh bị chặn ở read và mutation.

## 10. Migration và khả năng chuyển database

### 10.1 Migration hiện tại

- PostgreSQL/Supabase migration là adapter hiện tại.
- Không sửa migration đã chạy.
- Domain invariant phải có test độc lập với migration.
- RLS, trigger, function hoặc RPC provider-specific phải được ghi rõ là infrastructure adapter.

### 10.2 Khi thêm database/backend khác

Thực hiện theo thứ tự:

```text
1. Implement repository/transaction/idempotency adapters.
2. Chạy repository contract tests.
3. Chạy domain/application tests không đổi.
4. Chạy migration/import dry-run.
5. So sánh canonical API output giữa hai adapter.
6. Chạy tenant isolation, concurrency và rollback tests.
7. Cutover bằng configuration/installation mapping.
```

Không fork logic nghiệp vụ theo kiểu:

```ts
if (provider === "supabase") businessRuleA()
else businessRuleB()
```

Khác biệt provider chỉ nằm ở adapter/capability handling.

## 11. Export/import và tách một NPP sang hạ tầng riêng

Phải có tenant portability package được version:

```text
manifest.json
schemaVersion
contractVersion
exportedAt
sourceTenantId
entities/*.jsonl hoặc định dạng chuẩn tương đương
relationships
attachments manifest/checksum
audit cutover marker
```

Luồng tách tenant:

```text
preflight -> freeze/cutover window -> full export -> checksum
-> import dry-run -> ID/reference validation -> delta export nếu cần
-> switch installation mapping -> smoke -> reconciliation
```

Yêu cầu:

- export đầy đủ dữ liệu thuộc tenant, không lẫn tenant khác;
- có mapping ID nếu target tạo ID mới;
- file/ảnh/chứng từ kèm checksum;
- kiểm tra tổng dòng, tổng tiền, tồn kho, công nợ, order balances trước/sau;
- có khả năng chạy dry-run và resume;
- không dựa vào dump toàn DB khi chỉ chuyển một tenant;
- audit giữ được nguồn và thời điểm cutover.

## 12. Shared configuration và tenant customization

Phân loại cấu hình:

```text
platform default
plan/edition entitlement
tenant setting
branch/warehouse setting
user preference
```

Độ ưu tiên phải được backend resolve rõ ràng. Không dùng một bảng key-value không schema để nhét mọi behavior.

Feature flag/entitlement:

- không làm thay đổi invariant cốt lõi;
- có tenant scope;
- có version/effective date khi ảnh hưởng nghiệp vụ;
- API trả capability trung tính cho frontend;
- tắt module không được làm mất dữ liệu lịch sử.

## 13. Observability trung tính

Log/trace/metric tối thiểu:

```text
requestId
traceId
tenantId
actorId
useCase
entityType/entityId
resultCode
latency
adapter/provider nội bộ
deployment/installation
```

Không ghi secret hoặc payload nhạy cảm. Dashboard vận hành có thể nhóm theo tenant nhưng quyền xem phải tách platform admin và tenant admin.

## 14. Test matrix bắt buộc

```text
[ ] Tenant A không đọc được ID hợp lệ của Tenant B
[ ] Tenant A không mutate được entity Tenant B
[ ] Unique number cho phép trùng giữa hai tenant nhưng không trùng trong cùng tenant
[ ] Cache/idempotency cùng key ở hai tenant không va nhau
[ ] Background job không chạy sai tenant
[ ] Storage signed URL không truy cập chéo tenant
[ ] Repository contract tests pass trên adapter hiện tại
[ ] Public API không lộ table/provider error
[ ] Canonical DTO giống nhau giữa adapter mock và PostgreSQL/Supabase
[ ] Export một tenant không chứa row/file tenant khác
[ ] Import dry-run phát hiện thiếu quan hệ/checksum
[ ] Tách tenant sang installation khác giữ đúng totals và lịch sử
[ ] FixedTenantContext của MCP legacy không thể bị client đổi
```

## 15. Checklist foundation

```text
[ ] MT-01 Audit bảng/API/cache/storage/job hiện có theo tenant scope
[ ] MT-02 Chốt tenant/organization/membership/installation model
[ ] MT-03 Chốt TenantContext và middleware xác thực
[ ] MT-04 Chốt canonical success/error DTO
[ ] MT-05 Chốt repository/transaction/idempotency ports
[ ] MT-06 Chốt quy tắc tenant_id, unique, FK và indexes
[ ] MT-07 Audit MCP legacy và lập migration tenant versioned
[ ] MT-08 Tạo tenant isolation test harness
[ ] MT-09 Tạo repository contract test suite
[ ] MT-10 Tạo export/import manifest và reconciliation contract
[ ] MT-11 Chốt deployment modes và installation registry
[ ] MT-12 Production smoke cho shared tenant và dedicated tenant
[ ] MT-13 Freeze foundation v1 trước order/inventory/receivable core
```

## 16. Definition of Done

Foundation chỉ được coi là khóa khi:

- một tài khoản có thể có membership ở một hoặc nhiều tenant nhưng mỗi request chỉ chạy trong một tenant context rõ ràng;
- mọi dữ liệu mới thuộc module App NPP có tenant ownership không mơ hồ;
- backend business use case không import provider SDK;
- public API không lộ schema/provider;
- tenant isolation tests pass;
- repository contract tests pass;
- có kế hoạch versioned cho MCP legacy;
- có export/import dry-run đủ để tách một tenant;
- một adapter DB/backend mới có thể được thêm mà không sửa domain rules hoặc frontend contract.
