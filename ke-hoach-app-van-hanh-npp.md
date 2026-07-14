# Kế hoạch phát triển App vận hành Nhà phân phối

> Trạng thái: **ACTIVE MASTER PLAN**  
> Bắt đầu phase: **2026-07-14**  
> MCP v1: **CORE COMPLETE / FROZEN**  
> Tài liệu khóa MCP: [`MCP_EXECUTION_PLAN.md`](./MCP_EXECUTION_PLAN.md)  
> Foundation bắt buộc: [`docs/npp-plan/FOUNDATION_MULTI_TENANT_PORTABILITY.md`](./docs/npp-plan/FOUNDATION_MULTI_TENANT_PORTABILITY.md)

## 1. Tuyên bố chuyển phase

MCP v1 đã hoàn chỉnh luồng lõi:

```text
Tuyến -> Phiên -> Khách trong phiên -> Đơn hàng -> Thử sản phẩm
-> Báo cáo thị trường -> Follow-up -> Báo cáo phiên
```

Từ thời điểm này:

1. **Đóng phase phát triển lõi MCP, không đóng module MCP.**
2. Contract và logic dữ liệu MCP v1 không được thay đổi tùy tiện.
3. MCP chỉ được sửa khi có lỗi thật, vấn đề hiệu năng, bảo mật hoặc nâng cấp có migration/version/smoke test rõ ràng.
4. Trọng tâm phát triển chuyển sang **MCP-Plan như một ứng dụng quản lý NPP hoàn chỉnh**.
5. MCP trở thành một phân hệ vận hành thị trường nằm trong App NPP tổng thể.
6. Sản phẩm phải được thiết kế để có thể bán cho nhiều NPP, dùng chung hạ tầng hoặc tách riêng hạ tầng tùy khách hàng.

## 2. Mục tiêu sản phẩm nhiều NPP

Một codebase và một contract nghiệp vụ phải chạy được ở cả ba mode:

```text
Mode A — Shared SaaS
Nhiều NPP dùng chung frontend, backend và database; dữ liệu tách bằng tenant_id.

Mode B — Shared application, isolated database
Dùng chung code/backend nhưng mỗi NPP có database hoặc schema riêng.

Mode C — Dedicated deployment
Một NPP có backend, database, storage và cấu hình riêng.
```

Quy tắc khóa:

- Không fork logic nghiệp vụ riêng cho từng NPP.
- Không để frontend phụ thuộc vào Supabase, tên bảng hoặc cấu trúc backend hiện tại.
- Không để public API trở thành bản sao của database schema.
- Chuyển một NPP sang DB/backend khác chỉ thay adapter, cấu hình installation và luồng migrate dữ liệu; domain rules và frontend contract không đổi.
- Có thể dùng chung MCP, DB và backend ở giai đoạn đầu, nhưng mọi dữ liệu/nghiệp vụ mới phải có tenant ownership rõ ràng.

Chi tiết bắt buộc nằm tại [`FOUNDATION_MULTI_TENANT_PORTABILITY.md`](./docs/npp-plan/FOUNDATION_MULTI_TENANT_PORTABILITY.md).

## 3. Bản đồ module App NPP

Thứ tự hiển thị/nghiệp vụ chính:

```text
Tổng quan điều hành
-> Khách hàng
-> Sản phẩm
-> Đơn hàng
-> Tồn kho
-> Công nợ
-> Nhân viên
-> Kế hoạch
-> Báo cáo
-> Cài đặt và phân quyền
```

Mỗi module có một execution plan riêng để theo dõi, bổ sung và khóa contract độc lập:

| Mã | Module | Plan | Trạng thái |
|---|---|---|---|
| FOUNDATION | Multi-tenant và portability | [`docs/npp-plan/FOUNDATION_MULTI_TENANT_PORTABILITY.md`](./docs/npp-plan/FOUNDATION_MULTI_TENANT_PORTABILITY.md) | **Required first** |
| NPP-00 | Tổng quan điều hành | [`docs/npp-plan/00-tong-quan-dieu-hanh.md`](./docs/npp-plan/00-tong-quan-dieu-hanh.md) | Planned |
| NPP-01 | Khách hàng | [`docs/npp-plan/01-khach-hang.md`](./docs/npp-plan/01-khach-hang.md) | Planned |
| NPP-02 | Sản phẩm | [`docs/npp-plan/02-san-pham.md`](./docs/npp-plan/02-san-pham.md) | Planned |
| NPP-03 | Đơn hàng | [`docs/npp-plan/03-don-hang.md`](./docs/npp-plan/03-don-hang.md) | **Priority 1 / Design first** |
| NPP-04 | Tồn kho | [`docs/npp-plan/04-ton-kho.md`](./docs/npp-plan/04-ton-kho.md) | Planned |
| NPP-05 | Công nợ | [`docs/npp-plan/05-cong-no.md`](./docs/npp-plan/05-cong-no.md) | Planned |
| NPP-06 | Nhân viên | [`docs/npp-plan/06-nhan-vien.md`](./docs/npp-plan/06-nhan-vien.md) | Planned |
| NPP-07 | Kế hoạch | [`docs/npp-plan/07-ke-hoach.md`](./docs/npp-plan/07-ke-hoach.md) | Planned |
| NPP-08 | Báo cáo | [`docs/npp-plan/08-bao-cao.md`](./docs/npp-plan/08-bao-cao.md) | Planned |
| NPP-09 | Cài đặt và phân quyền | [`docs/npp-plan/09-cai-dat-phan-quyen.md`](./docs/npp-plan/09-cai-dat-phan-quyen.md) | Foundation |

## 4. Kiến trúc mục tiêu bắt buộc

Không coi Supabase/VPS hiện tại là domain architecture. Đó chỉ là adapter đang dùng.

```text
Browser/PWA
  -> Public API contract / Next.js proxy
    -> Backend transport/controllers
      -> Application use cases
        -> Domain rules/invariants
          -> Ports/interfaces
            -> Infrastructure adapters
               - PostgreSQL/Supabase hiện tại
               - Auth provider
               - Object storage
               - Queue/event
               - DB/backend khác trong tương lai
```

Runtime hiện tại:

```text
Browser/PWA
  -> Next.js/Vercel proxy
  -> VPS backend
  -> Supabase/PostgreSQL
```

Nguyên tắc:

1. Frontend không tự quyết định logic nghiệp vụ quan trọng.
2. Mutation có ảnh hưởng đơn hàng, kho, công nợ, quyền hoặc audit phải chạy qua backend.
3. Mỗi thay đổi schema phải có migration rõ ràng; không sửa DB thủ công rồi bỏ quên migration.
4. Không chắp vá theo triệu chứng. Phải tái hiện lỗi, tìm đúng tầng chịu trách nhiệm, sửa logic và thêm test hồi quy.
5. Không dùng một cột trạng thái để gánh nhiều loại sự thật khác nhau.
6. Dữ liệu đã phát sinh ảnh hưởng kho/công nợ không hard-delete; dùng hủy, đảo bút toán hoặc chứng từ điều chỉnh.
7. API mutation phải idempotent ở các luồng có nguy cơ gọi lặp.
8. Mọi thao tác quan trọng phải có actor, thời gian và audit/event log.
9. Báo cáo lấy dữ liệu từ nguồn nghiệp vụ đã khóa hoặc read model tái tạo được.
10. Triển khai theo vertical slice: migration -> backend contract -> UI -> test -> deploy -> production smoke.
11. Mọi request nghiệp vụ phải chạy trong `TenantContext` được backend xác thực.
12. Không tin `tenantId` do frontend gửi nếu chưa kiểm tra membership.
13. Mọi bảng nghiệp vụ mới mặc định có `tenant_id NOT NULL`.
14. Unique, FK, index, cache, idempotency, storage path và job phải tenant-scoped.
15. Domain/application không import Supabase SDK, SQL, Next.js response hoặc Express response.
16. Public API chỉ trả DTO và error code trung tính; không lộ tên bảng, SQL, RPC hoặc lỗi provider.
17. RLS là defense-in-depth; backend authorization và tenant filtering vẫn bắt buộc.
18. Service role không được bypass permission nghiệp vụ hoặc tenant scope.
19. Mọi adapter DB/backend mới phải chạy cùng repository contract tests và canonical API tests.
20. Phải có export/import versioned để tách riêng một NPP khỏi shared infrastructure.

## 5. Tenant model tối thiểu

Khái niệm:

```text
tenant / organization / distributor = một NPP độc lập
membership                        = tài khoản được quyền vào NPP
installation                      = hạ tầng đang phục vụ NPP
branch                            = chi nhánh
warehouse                         = kho
actor                             = người/system job thực hiện thao tác
```

Mỗi request nghiệp vụ có context trung tính:

```text
tenantId
actorId
membershipId
branch/warehouse scope
roles/permissions
requestId
```

Một tài khoản được phép có membership ở một hoặc nhiều NPP. UI phase đầu có thể đơn giản hóa thành một NPP, nhưng data model và backend không được khóa cứng giả định đó.

Đối với MCP legacy chưa có tenant model đầy đủ:

- trước mắt dùng `fixedTenantContext` do backend cấu hình, không cho client đổi;
- không thêm field âm thầm vào MCP v1 frozen;
- khi bán đa NPP phải audit và tạo migration/backfill/version contract rõ ràng;
- chạy lại full MCP smoke và tenant isolation test.

## 6. Tách miền dữ liệu, không nhập nhằng

```text
MCP market operations
Customer master
Product catalog and pricing
Sales order
Fulfillment and delivery
Inventory ledger
Receivables and payment
Employee and responsibility
Planning and action
Reporting snapshots/read models
Identity, role and permission
Tenant, installation and entitlement
Audit and configuration
```

Quy tắc liên kết:

- MCP có thể tạo nguồn đơn hàng, follow-up hoặc tín hiệu thị trường, nhưng không sở hữu toàn bộ vòng đời đơn/kho/công nợ.
- Đơn hàng là nguồn yêu cầu bán hàng.
- Giao hàng là nguồn sự thật về số lượng thực giao.
- Tồn kho là nguồn sự thật về nhập/xuất/giữ/điều chỉnh.
- Công nợ là nguồn sự thật về phải thu, thu tiền, hoàn tiền và bù trừ.
- Dashboard và báo cáo chỉ đọc từ các nguồn sự thật trên hoặc read model tái tạo được.
- Tenant/installation quyết định dữ liệu nằm ở đâu, không thay đổi ý nghĩa nghiệp vụ của dữ liệu.

## 7. API contract trung tính

Success wrapper:

```json
{
  "data": {},
  "receivedAt": "2026-07-14T00:00:00.000Z",
  "requestId": "req_..."
}
```

Error wrapper:

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

Cấm trả trực tiếp:

```text
Supabase/PostgREST/PostgreSQL error nguyên bản
tên bảng/cột/RPC
stack trace
provider URL hoặc cấu hình hạ tầng
SELECT * row chưa qua mapper
```

Luồng chuẩn:

```text
request DTO -> application command/query -> domain result
-> response DTO -> provider-neutral HTTP response
```

## 8. Thứ tự triển khai đúng theo phụ thuộc

Thứ tự menu không đồng nghĩa thứ tự xây kỹ thuật.

### Phase A — Khóa foundation multi-tenant và portability

```text
A1. Audit auth/user/role và dữ liệu hiện có
A2. Chốt tenant/organization/membership/installation model
A3. Chốt TenantContext và backend middleware
A4. Chốt actor/audit/event contract
A5. Chốt canonical success/error DTO
A6. Chốt repository/transaction/idempotency ports
A7. Chốt tenant_id, unique, FK, index, cache, storage và job rules
A8. Chốt money, quantity, unit, timezone và document numbering
A9. Chốt permission matrix tối thiểu
A10. Chốt export/import/reconciliation contract
```

Không code mutation lõi mới trước khi các mục A2-A7 được khóa.

### Phase B — Chuẩn hóa master data

```text
B1. Khách hàng
B2. Sản phẩm, biến thể, đơn vị quy đổi
B3. Bảng giá/chiết khấu tối thiểu
B4. Kho và vị trí kho tối thiểu
B5. Nhân viên phụ trách tối thiểu
```

### Phase C — Đơn hàng lõi

```text
C1. Contract vòng đời đơn
C2. Dòng đơn và tính tiền
C3. Sửa/hủy có version và audit
C4. Giao đủ/giao thiếu/giao nhiều lần
C5. Trả hàng/đổi hàng
C6. Liên kết tồn kho và công nợ
C7. Repository contract và tenant isolation tests
```

Đây là phase nghiệp vụ ưu tiên cao nhất, nhưng chỉ bắt đầu sau foundation multi-tenant tối thiểu.

### Phase D — Tồn kho và giao nhận

```text
D1. Inventory ledger
D2. Reservation/allocation
D3. Pick/pack/ship/deliver
D4. Partial delivery/backorder
D5. Return-to-stock/damaged/quarantine
D6. Stocktake/adjustment/transfer
```

### Phase E — Công nợ

```text
E1. Receivable posting
E2. Payment allocation
E3. Partial payment/overpayment
E4. Refund/credit note/offset
E5. Aging and credit limit
```

### Phase F — Điều hành và mở rộng

```text
F1. Dashboard/read models
F2. Nhân viên và hiệu suất
F3. Kế hoạch/action
F4. Báo cáo
F5. Cài đặt/phân quyền hoàn chỉnh
F6. Tenant export/import và dedicated deployment smoke
```

## 9. Quy tắc đặc biệt cho đơn hàng

Đơn hàng không dùng một trạng thái duy nhất. Tối thiểu phải tách:

```text
order_status       = trạng thái nghiệp vụ đơn
fulfillment_status = trạng thái chuẩn bị/giao hàng
payment_status     = trạng thái thanh toán/công nợ
```

Ví dụ:

```text
order_status:
draft | confirmed | cancelled | completed

fulfillment_status:
unfulfilled | allocated | picking | packed | partially_delivered | delivered | returned

payment_status:
unposted | unpaid | partially_paid | paid | overpaid | refunded | written_off
```

Các trường hợp bắt buộc phải thiết kế trước khi code:

1. Sửa đơn khi còn draft.
2. Sửa đơn sau xác nhận bằng amendment/version, không ghi đè mất lịch sử.
3. Hủy toàn đơn trước giao.
4. Hủy một phần dòng hàng.
5. Giao thiếu do thiếu kho.
6. Khách chỉ nhận một phần.
7. Giao nhiều đợt.
8. Backorder phần còn thiếu.
9. Đổi sản phẩm trước giao.
10. Đổi hàng sau giao.
11. Trả toàn bộ hoặc một phần.
12. Hàng hỏng, hết hạn, không nhập lại kho bán được.
13. Điều chỉnh giá/chiết khấu sau xác nhận.
14. Hoàn tiền hoặc bù trừ công nợ.
15. Đơn từ MCP gọi lại nhiều lần không được duplicate.
16. Cùng idempotency key ở hai tenant không được va nhau.
17. Không được tham chiếu customer/product/warehouse thuộc tenant khác.
18. Canonical order DTO phải giống nhau dù chạy shared DB hay dedicated DB.

Plan chi tiết: [`docs/npp-plan/03-don-hang.md`](./docs/npp-plan/03-don-hang.md).

## 10. Mẫu theo dõi bắt buộc cho từng module

Mỗi plan module phải duy trì:

```text
1. Mục tiêu và phạm vi
2. Ngoài phạm vi
3. Nguồn dữ liệu hiện có
4. Tenant ownership và installation behavior
5. Contract cần khóa
6. Canonical request/response DTO
7. Data model/migration
8. Ports và infrastructure adapters
9. Backend API
10. UI/UX
11. Permission matrix
12. Audit/event log
13. Tenant isolation/repository contract tests
14. Migration/backfill
15. Export/import nếu có
16. Deploy/smoke/rollback
17. Open questions
18. Decision log
19. Checklist trạng thái
```

Trạng thái task chuẩn:

```text
TODO -> DESIGNING -> CONTRACT LOCKED -> IMPLEMENTING
-> REVIEW -> VERIFIED -> DEPLOYED -> FROZEN
```

Không đánh dấu `DONE` chỉ vì UI đã hiện; phải đủ DB, backend, permission, tenant isolation, test và production smoke.

## 11. Definition of Ready

Một module chỉ được bắt đầu code mutation khi:

- Đã audit bảng/API/UI hiện có.
- Đã vẽ luồng chuẩn và luồng ngoại lệ.
- Đã xác định nguồn sự thật.
- Đã chốt tenant ownership và tenant scope.
- Đã chốt canonical DTO, không trả thẳng DB row.
- Đã chốt port/repository cần dùng và adapter hiện tại.
- Đã chốt trạng thái và transition hợp lệ.
- Đã chốt quyền ai được xem/tạo/sửa/hủy/duyệt.
- Đã có migration plan và rollback/forward-fix plan.
- Đã có acceptance test cho happy path, edge case và cross-tenant attack.
- Đã xác định cách export/import khi entity thuộc tenant portability scope.

## 12. Definition of Done

Một vertical slice chỉ hoàn thành khi:

- Migration chạy được trên môi trường sạch và production-compatible.
- Backend áp dụng đúng transaction và idempotency.
- Frontend không bypass backend mutation.
- Permission deny-by-default hoạt động.
- Tenant A không thể đọc hoặc mutate dữ liệu Tenant B.
- Unique/FK/cache/idempotency/storage/job không bị va chéo tenant.
- Domain/application không phụ thuộc provider SDK.
- Public API không lộ schema/provider.
- Repository contract và canonical API tests pass.
- Audit/event đầy đủ.
- Unit/integration/contract/security tests pass.
- Build pass.
- Deploy VPS/Vercel đúng phần liên quan.
- Production smoke pass cho mode triển khai đang hỗ trợ.
- Tài liệu và decision log được cập nhật.

## 13. Quy tắc thay đổi contract

Khi thay đổi logic đã khóa:

1. Ghi rõ lý do nghiệp vụ.
2. Xác định tenant và dữ liệu cũ bị ảnh hưởng.
3. Xác định thay đổi domain contract hay chỉ infrastructure adapter.
4. Tạo migration/version mới; không sửa migration đã chạy.
5. Cập nhật canonical API contract nếu behavior/output đổi.
6. Cập nhật adapters liên quan nhưng không fork business rule.
7. Thêm test hồi quy, repository contract và tenant isolation test.
8. Có kế hoạch deploy và rollback/forward-fix.
9. Cập nhật module plan, foundation và master plan.
10. Không sửa âm thầm để chữa một màn hình hoặc một NPP riêng.

## 14. Mốc triển khai gần nhất

```text
[ ] NPP-F00 Audit multi-tenant: DB/API/auth/cache/storage/job/MCP legacy
[ ] NPP-F01 Chốt tenant/membership/installation và TenantContext
[ ] NPP-F02 Chốt canonical response/error DTO
[ ] NPP-F03 Chốt repository/transaction/idempotency ports
[ ] NPP-F04 Tạo tenant isolation và repository contract test harness
[ ] NPP-F05 Audit toàn bộ order/order_items/API/UI hiện có
[ ] NPP-F06 Khóa order lifecycle và transition matrix
[ ] NPP-F07 Khóa product/unit/price contract tối thiểu cho đơn
[ ] NPP-F08 Khóa warehouse/inventory movement contract tối thiểu
[ ] NPP-F09 Khóa receivable posting contract tối thiểu
[ ] NPP-F10 Thiết kế migration theo vertical slice đầu tiên
[ ] NPP-F11 Implement đơn draft -> confirmed với audit/idempotency/tenant scope
[ ] NPP-F12 Implement giao một phần và backorder
[ ] NPP-F13 Implement trả/đổi hàng
[ ] NPP-F14 Chốt tenant export/import manifest và reconciliation
[ ] NPP-F15 Kết nối dashboard/read model sau khi nguồn sự thật ổn định
```

## 15. Kết luận

```text
MCP v1 = frozen core, tiếp tục tồn tại như module vận hành thị trường.
MCP-Plan = App quản lý NPP tổng thể, có thể phục vụ nhiều NPP.
Shared DB/backend = lựa chọn triển khai hiện tại, không phải ràng buộc domain.
TenantContext + canonical contract + ports/adapters = nền để chuyển DB/backend.
Đơn hàng = miền nghiệp vụ ưu tiên số 1 sau khi foundation tối thiểu được khóa.
Mỗi module = một plan riêng, có contract, tenant scope, test và decision log độc lập.
```
