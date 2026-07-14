# NPP-09 — Plan Cài đặt, tenant và phân quyền

> Trạng thái: **FOUNDATION / PLANNED**  
> Vai trò: nền bắt buộc trước các mutation quan trọng  
> Phụ thuộc: identity provider/auth hiện có, cấu trúc NPP/chi nhánh, [`FOUNDATION_MULTI_TENANT_PORTABILITY.md`](./FOUNDATION_MULTI_TENANT_PORTABILITY.md)

## 1. Mục tiêu

Quản lý tenant/NPP, cấu hình và quyền theo nguyên tắc deny-by-default, có scope và audit rõ ràng.

Phải trả lời được:

```text
Người này đăng nhập bằng identity nào?
Đang thao tác trong NPP/tenant nào?
Membership nào cho phép truy cập?
Ai được làm gì?
Trên chi nhánh/kho/khu vực/khách nào?
Giới hạn giá trị bao nhiêu?
Có cần phê duyệt không?
Quyền/cấu hình có hiệu lực từ khi nào?
NPP đang dùng shared hay dedicated installation nào?
Ai đã thay đổi quyền, cấu hình hoặc installation mapping?
```

## 2. Tách identity, tenant, membership, employee và quyền

```text
identity/user = người đăng nhập từ auth provider
organization/tenant = một NPP độc lập về dữ liệu và cấu hình
membership    = identity được phép truy cập tenant nào
employee      = hồ sơ nhân sự thuộc tenant
role          = nhóm quyền thuận tiện
permission    = hành động cụ thể
scope         = phạm vi dữ liệu
policy        = điều kiện/threshold/approval
installation  = backend/database/storage đang phục vụ tenant
entitlement   = module/tính năng tenant được sử dụng
```

Không hardcode kiểu `if role === admin` rải khắp UI/backend.

Một identity có thể có membership ở một hoặc nhiều tenant. Mỗi request chỉ chạy trong một `TenantContext` rõ ràng.

## 3. TenantContext và tenant selection

Backend phải tạo context sau khi xác thực:

```text
tenantId
actorId
membershipId
employeeId nếu có
branch/warehouse/territory scope
roles/permissions/policies
installationId
requestId
```

Quy tắc:

1. Không tin `tenantId` trong body do frontend gửi.
2. Header/subdomain/tenant selector chỉ chọn tenant; backend kiểm tra membership lại.
3. Người không có membership không được biết tenant hoặc dữ liệu tenant có tồn tại hay không.
4. Service role vẫn phải có actor business context và tenant scope.
5. Background job có system actor, tenant và installation rõ ràng.
6. Tenant switch phải tạo context mới; không tái sử dụng cache/query cũ sai scope.
7. Impersonation/support access phải có lý do, thời hạn, quyền riêng và audit.

## 4. Tenant và installation model

Tối thiểu cần các miền dữ liệu:

```text
organizations/tenants
tenant_memberships
installations
tenant_installation_assignments
branches
warehouses
territories
employees
roles
permissions
role_permissions
membership_role_assignments
scope_assignments
policy_assignments
entitlements/feature assignments
tenant_settings
```

Tên bảng cụ thể chỉ khóa sau audit. Public API dùng DTO trung tính, không trả trực tiếp schema trên.

Installation hỗ trợ:

```text
shared SaaS database/backend
dedicated database nhưng shared code/backend
dedicated backend + database + storage
```

Thay installation không làm đổi tenantId/domain identity. Mapping tenant -> installation là cấu hình platform được bảo vệ và audit.

## 5. Tenant ownership và isolation

Mặc định mọi bảng nghiệp vụ mới có `tenant_id NOT NULL`.

Bắt buộc:

- unique nghiệp vụ gồm tenant scope;
- FK không nối chéo tenant;
- cache/idempotency/queue/storage path chứa tenant scope;
- audit/event/outbox chứa tenantId;
- read và mutation đều filter tenant ở backend/repository;
- RLS/DB policy là defense-in-depth;
- system admin cross-tenant là surface riêng, không dùng endpoint tenant thường;
- export một tenant không được chứa dữ liệu tenant khác.

## 6. Permission model tối thiểu

Permission code theo hành động:

```text
tenant.view/update/export/import
membership.view/invite/update/revoke
installation.view/assign/migrate
entitlement.view/manage
customer.view/create/update/status/merge
product.view/create/update/status/price
order.view/create/update_draft/confirm/amend/cancel
fulfillment.allocate/pick/pack/ship/deliver
inventory.view/adjust/stocktake/transfer
receivable.view/post/collect/allocate/credit/refund/writeoff
employee.view/manage/assign
plan.view/create/assign/approve
report.view/export/snapshot
settings.view/manage
permission.manage
audit.view
support.impersonate
```

Scope tối thiểu:

```text
platform
organization/distributor
branch
warehouse
territory
route
customer assignment
team/hierarchy
self
```

Platform permission và tenant permission phải tách. Tenant admin không được gán tenant sang installation khác hoặc xem tenant khác.

## 7. Threshold và phê duyệt

Không phải quyền nào cũng chỉ có yes/no. Cần policy:

```text
max_discount_percent
max_order_amount
credit_limit_override
max_inventory_adjustment
max_refund/writeoff
approval_required_above
export_sensitive_data
membership_admin_limit
```

Khi vượt ngưỡng:

```text
request -> pending approval -> approved/rejected -> apply once
```

Approval phải tham chiếu tenant, actor, payload/version cụ thể. Sửa payload sau duyệt thì approval cũ mất hiệu lực.

## 8. Cấu hình hệ thống và tenant

Phân lớp cấu hình:

```text
platform default
plan/edition entitlement
tenant setting
branch/warehouse setting
user preference
```

Nhóm cấu hình cần version/effective date:

```text
organization profile
branch/warehouse
number sequences
timezone/currency
money/quantity rounding
order posting policy
inventory negative-stock policy
lot/expiry policy
receivable posting/aging policy
approval thresholds
notification/reminder
MCP templates ngoài frozen core boundary
report/export settings
feature entitlements
installation/cutover settings
```

Không dùng một bảng key-value không schema cho mọi logic quan trọng. Cấu hình ảnh hưởng nghiệp vụ phải validate, version và có effective date.

Độ ưu tiên cấu hình phải được backend resolve nhất quán; frontend không tự merge policy.

## 9. Number sequence

Mã chứng từ cần atomic sequence:

```text
ORD
DEL
RET
EXC
PAY
CRN
STK
TRF
```

Quy tắc:

- unique theo tenant/branch/year nếu policy yêu cầu;
- concurrent create không trùng trong cùng tenant;
- hai tenant có thể dùng cùng số chứng từ mà không conflict;
- không tái sử dụng số đã hủy;
- prefix/format thay đổi theo version/effective date;
- không sinh số bằng `max + 1` không khóa;
- khi migrate tenant phải giữ hoặc map số chứng từ có reconciliation.

## 10. Backend enforcement

- Backend kiểm tra membership + tenant + permission + scope + policy trước mutation.
- Query read cũng áp tenant/scope ở repository/server/DB phù hợp.
- UI chỉ hỗ trợ trải nghiệm, không phải hàng rào bảo mật.
- Service role không đồng nghĩa bỏ permission nghiệp vụ.
- Background job/system actor có danh tính và permission riêng.
- Domain/application không phụ thuộc Supabase auth hoặc schema permission.
- Auth provider được bọc qua adapter; identity ID provider không được dùng làm business employee ID.
- Public error trả business code trung tính, không lộ RLS/provider error.

## 11. Audit log

Sự kiện tối thiểu:

```text
login/security changes nếu nguồn auth hỗ trợ
tenant create/status/change
membership invite/accept/revoke
role/permission/scope changes
settings/entitlement changes
installation assignment/cutover
approval request/decision
sensitive export/import
order/inventory/receivable privileged action
impersonation/support access
```

Audit lưu:

```text
tenantId
installationId khi phù hợp
actor/membership
platform actor nếu là cross-tenant action
action
entity type/id
before/after hoặc diff
reason
request/correlation id
time/ip/user agent khi phù hợp
```

Audit quan trọng không cho người dùng nghiệp vụ sửa/xóa.

## 12. API contract dự kiến

Tenant-facing:

```text
GET  /api/current-tenant
GET  /api/my-memberships
POST /api/tenant-switch-context
GET  /api/settings
PATCH /api/settings/:group
GET  /api/roles
POST /api/roles
PATCH /api/roles/:id
GET  /api/permissions
POST /api/membership-role-assignments
POST /api/scope-assignments
POST /api/approval-requests
POST /api/approval-requests/:id/approve
POST /api/approval-requests/:id/reject
GET  /api/audit-logs
POST /api/tenant-exports
POST /api/tenant-imports/preflight
```

Platform-only:

```text
GET  /api/platform/tenants
POST /api/platform/tenants
POST /api/platform/tenant-installation-assignments
POST /api/platform/tenant-migrations/preflight
POST /api/platform/tenant-migrations/cutover
```

Tên endpoint có thể đổi sau audit, nhưng phải tách rõ tenant surface và platform administration surface.

Success/error DTO tuân theo foundation, không trả trực tiếp auth/provider/database payload.

## 13. UI

Tenant-facing:

```text
Chọn NPP đang làm việc nếu có nhiều membership
Thông tin NPP/chi nhánh/kho
Tài khoản và liên kết nhân viên
Thành viên/membership
Vai trò
Ma trận quyền
Phạm vi dữ liệu
Hạn mức/phê duyệt
Cấu hình chứng từ
Cấu hình đơn/kho/công nợ
Module/entitlement đang bật
Thông báo
Audit log
Export dữ liệu tenant theo quyền
```

Platform-only:

```text
Danh sách tenant
Trạng thái thuê bao/entitlement
Installation đang phục vụ tenant
Shared/dedicated mode
Migration/export/import/cutover status
Support access được audit
```

Màn hình quyền phải có preview “người này thực tế được làm gì trên tenant và phạm vi nào”, không chỉ danh sách checkbox.

## 14. Bootstrap và chống tự khóa

- Có quy trình tạo tenant và owner membership ban đầu có kiểm soát.
- Không cho xóa/khóa owner/admin cuối cùng của tenant.
- Không cho xóa platform admin cuối cùng.
- Thay đổi quyền của chính mình có cảnh báo/approval nếu cần.
- Có break-glass procedure được audit, không dùng tài khoản dùng chung lâu dài.
- Migration permission phải giữ đường truy cập quản trị tối thiểu đã kiểm thử.
- Tenant dedicated deployment vẫn phải bootstrap bằng cùng contract, không tạo logic riêng thủ công.

## 15. Export/import và chuyển installation

Luồng tối thiểu:

```text
preflight -> xác định cutover window -> export versioned
-> checksum/reconciliation -> import dry-run -> validate relationships
-> delta/final export nếu cần -> đổi installation mapping
-> smoke -> reconciliation -> close cutover
```

Phải kiểm tra:

- row/file chỉ thuộc tenant cần chuyển;
- ID/reference đầy đủ;
- tổng đơn, tổng tiền, tồn kho, công nợ trước/sau;
- audit cutover marker;
- retry/resume an toàn;
- rollback hoặc forward-fix rõ ràng.

Không dùng full database dump làm contract duy nhất để bán/tách một NPP.

## 16. Test matrix

```text
[ ] backend deny khi UI cố bypass
[ ] identity có role đúng nhưng không có membership tenant bị chặn
[ ] membership đúng tenant nhưng sai scope vẫn bị chặn
[ ] Tenant A không đọc/mutate được ID Tenant B
[ ] tenant selector/header giả bị chặn
[ ] threshold vượt mức tạo approval đúng tenant
[ ] payload đổi sau approval bị yêu cầu duyệt lại
[ ] last tenant admin không bị xóa/khóa
[ ] last platform admin không bị xóa/khóa
[ ] sequence concurrent không trùng trong tenant
[ ] cùng document number ở hai tenant không conflict
[ ] settings version áp đúng effective date và đúng tenant
[ ] cache/idempotency key không va chéo tenant
[ ] export nhạy cảm có permission và audit
[ ] export một tenant không chứa tenant khác
[ ] service-role request thiếu actor/tenant context bị chặn
[ ] privilege escalation qua tự sửa role/membership bị chặn
[ ] tenant switch không tái sử dụng dữ liệu/cache tenant cũ
[ ] installation cutover giữ canonical API contract
[ ] dedicated deployment dùng cùng domain tests
```

## 17. Checklist

```text
[ ] S-01 Audit auth/user/role/RLS/backend hiện có
[ ] S-02 Chốt tenant/organization/membership model
[ ] S-03 Chốt installation và tenant assignment model
[ ] S-04 Chốt TenantContext/middleware
[ ] S-05 Lập permission catalog platform và tenant
[ ] S-06 Chốt role mặc định
[ ] S-07 Chốt scope/threshold/approval
[ ] S-08 Chốt settings/entitlement schema/version
[ ] S-09 Chốt audit contract
[ ] S-10 Migration/bootstrap
[ ] S-11 Backend authorization/policy service qua ports
[ ] S-12 Tenant isolation test harness
[ ] S-13 UI tenant switch/membership/role/scope/settings/audit
[ ] S-14 Export/import/installation cutover contract
[ ] S-15 Security/integration/repository contract tests
[ ] S-16 Production smoke shared mode
[ ] S-17 Production smoke dedicated mode
[ ] S-18 Freeze foundation v1
```

## 18. Quyết định đã khóa

```text
[D-01] Data model phải hỗ trợ một identity có nhiều tenant membership.
[D-02] Mỗi request chỉ có một active TenantContext.
[D-03] tenantId từ client chỉ là selector, không phải bằng chứng authorization.
[D-04] Shared DB/backend là mode triển khai, không phải ràng buộc domain.
[D-05] Tenant có thể chuyển sang installation khác mà giữ API/domain contract.
[D-06] Platform admin và tenant admin là hai security surface khác nhau.
[D-07] MCP legacy dùng fixedTenantContext cho đến khi có migration/version rõ ràng.
```

## 19. Open questions còn phải audit

```text
[ ] Cấu trúc chi nhánh/kho/khu vực hiện tại ra sao?
[ ] Một employee có thể thuộc nhiều tenant hay chỉ identity có nhiều membership?
[ ] Có cấp quản lý duyệt nhiều tầng không?
[ ] Có cần MFA/SSO ngay phase đầu không?
[ ] Mỗi NPP có domain/subdomain riêng hay dùng tenant selector?
[ ] Tiêu chí nào quyết định shared, isolated DB hoặc dedicated deployment?
[ ] Cutover có cần zero-downtime hay chấp nhận maintenance window?
[ ] Dữ liệu/file MCP legacy hiện tại map vào tenant đầu tiên thế nào?
```
