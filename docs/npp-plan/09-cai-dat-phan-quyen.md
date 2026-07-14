# NPP-09 — Plan Cài đặt và phân quyền

> Trạng thái: **FOUNDATION / PLANNED**  
> Vai trò: Nền bắt buộc trước các mutation quan trọng  
> Phụ thuộc: Identity provider/auth hiện có, cấu trúc NPP/chi nhánh

## 1. Mục tiêu

Quản lý cấu hình và quyền theo nguyên tắc deny-by-default, có scope và audit rõ ràng.

Phải trả lời được:

```text
Ai được làm gì?
Trên NPP/chi nhánh/kho/khu vực/khách nào?
Giới hạn giá trị bao nhiêu?
Có cần phê duyệt không?
Quyền có hiệu lực từ khi nào?
Ai đã thay đổi quyền/cấu hình?
```

## 2. Tách identity, role, permission và scope

```text
identity/user = người đăng nhập
employee      = người trong tổ chức
role          = nhóm quyền thuận tiện
permission    = hành động cụ thể
scope         = phạm vi dữ liệu
policy        = điều kiện/threshold/approval
```

Không hardcode kiểu `if role === admin` rải khắp UI/backend.

## 3. Permission model tối thiểu

Permission code theo hành động:

```text
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
```

Scope tối thiểu:

```text
organization/distributor
branch
warehouse
territory
route
customer assignment
team/hierarchy
self
```

## 4. Threshold và phê duyệt

Không phải quyền nào cũng chỉ có yes/no. Cần policy:

```text
max_discount_percent
max_order_amount
credit_limit_override
max_inventory_adjustment
max_refund/writeoff
approval_required_above
```

Khi vượt ngưỡng:

```text
request -> pending approval -> approved/rejected -> apply once
```

Approval phải tham chiếu payload/version cụ thể; sửa payload sau duyệt thì approval cũ mất hiệu lực.

## 5. Cấu hình hệ thống

Nhóm cấu hình cần version/hiệu lực:

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
```

Không dùng một bảng key-value không schema cho mọi logic quan trọng. Cấu hình ảnh hưởng nghiệp vụ phải validate, version và có effective date.

## 6. Number sequence

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

- unique theo organization/branch/year nếu policy yêu cầu;
- concurrent create không trùng;
- không tái sử dụng số đã hủy;
- prefix/format thay đổi theo version/effective date;
- không sinh số bằng `max + 1` không khóa.

## 7. Backend enforcement

- Backend kiểm tra permission + scope + policy trước mutation.
- Query read cũng áp scope ở server/DB phù hợp.
- UI chỉ hỗ trợ trải nghiệm, không phải hàng rào bảo mật.
- Service role không đồng nghĩa bỏ permission nghiệp vụ; backend vẫn phải xác định actor.
- Background job/system actor có danh tính và permission riêng.

## 8. Audit log

Sự kiện tối thiểu:

```text
login/security changes nếu nguồn auth hỗ trợ
role/permission/scope changes
settings changes
approval request/decision
sensitive export
order/inventory/receivable privileged action
impersonation/support access nếu có
```

Audit lưu:

```text
actor
organization scope
action
entity type/id
before/after hoặc diff
reason
request/correlation id
time/ip/user agent khi phù hợp
```

Audit quan trọng không cho người dùng nghiệp vụ sửa/xóa.

## 9. API dự kiến

```text
GET  /api/settings
PATCH /api/settings/:group
GET  /api/roles
POST /api/roles
PATCH /api/roles/:id
GET  /api/permissions
POST /api/user-role-assignments
POST /api/scope-assignments
POST /api/approval-requests
POST /api/approval-requests/:id/approve
POST /api/approval-requests/:id/reject
GET  /api/audit-logs
```

## 10. UI

```text
Thông tin NPP/chi nhánh/kho
Tài khoản và liên kết nhân viên
Vai trò
Ma trận quyền
Phạm vi dữ liệu
Hạn mức/phê duyệt
Cấu hình chứng từ
Cấu hình đơn/kho/công nợ
Thông báo
Audit log
```

Màn hình quyền phải có preview “người này thực tế được làm gì trên phạm vi nào”, không chỉ danh sách checkbox rời rạc.

## 11. Bootstrap và chống tự khóa

Cần quy trình bootstrap owner/admin ban đầu có kiểm soát.

- Không cho xóa/khóa admin cuối cùng.
- Thay đổi quyền của chính mình có cảnh báo/approval nếu cần.
- Có break-glass procedure được audit, không dùng tài khoản dùng chung lâu dài.
- Migration permission phải giữ đường truy cập quản trị tối thiểu đã kiểm thử.

## 12. Test matrix

```text
[ ] backend deny khi UI cố bypass
[ ] role đúng nhưng sai scope vẫn bị chặn
[ ] threshold vượt mức tạo approval
[ ] payload đổi sau approval bị yêu cầu duyệt lại
[ ] last admin không bị xóa/khóa
[ ] sequence concurrent không trùng
[ ] settings version áp đúng effective date
[ ] export nhạy cảm có permission và audit
[ ] service-role request thiếu actor business context bị chặn
[ ] privilege escalation qua tự sửa role bị chặn
```

## 13. Checklist

```text
[ ] S-01 Audit auth/user/role/RLS/backend hiện có
[ ] S-02 Chốt organization/branch/scope model
[ ] S-03 Lập permission catalog
[ ] S-04 Chốt role mặc định
[ ] S-05 Chốt threshold/approval
[ ] S-06 Chốt settings schema/version
[ ] S-07 Chốt audit contract
[ ] S-08 Migration/bootstrap
[ ] S-09 Backend authorization middleware/policy service
[ ] S-10 UI role/scope/settings/audit
[ ] S-11 Security/integration tests
[ ] S-12 Production smoke/freeze v1
```

## 14. Open questions

```text
[ ] Một tài khoản có thể vào nhiều NPP không?
[ ] Cấu trúc chi nhánh/kho/khu vực hiện tại ra sao?
[ ] Có cấp quản lý duyệt nhiều tầng không?
[ ] Có cần MFA/SSO ngay phase đầu không?
[ ] Owner cuối cùng được xác định và khôi phục thế nào?
```
