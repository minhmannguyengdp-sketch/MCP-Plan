# Kế hoạch phát triển App vận hành Nhà phân phối

> Trạng thái: **ACTIVE MASTER PLAN**  
> Bắt đầu phase: **2026-07-14**  
> MCP v1: **CORE COMPLETE / FROZEN**  
> Tài liệu khóa MCP: [`MCP_EXECUTION_PLAN.md`](./MCP_EXECUTION_PLAN.md)

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

## 2. Bản đồ module App NPP

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

## 3. Nguyên tắc kiến trúc bắt buộc

```text
Browser/PWA
  -> Next.js/Vercel proxy
  -> VPS backend
  -> Supabase/PostgreSQL
```

1. Frontend không tự quyết định logic nghiệp vụ quan trọng.
2. Mutation có ảnh hưởng đơn hàng, kho, công nợ, quyền hoặc audit phải chạy qua VPS backend.
3. Mỗi thay đổi schema phải có migration rõ ràng; không sửa DB thủ công rồi bỏ quên migration.
4. Không chắp vá theo triệu chứng. Phải tái hiện lỗi, tìm đúng tầng chịu trách nhiệm, sửa logic và thêm test hồi quy.
5. Không dùng một cột trạng thái để gánh nhiều loại sự thật khác nhau.
6. Dữ liệu đã phát sinh ảnh hưởng kho/công nợ không hard-delete; dùng hủy, đảo bút toán hoặc chứng từ điều chỉnh.
7. API mutation phải idempotent ở các luồng có nguy cơ gọi lặp.
8. Mọi thao tác quan trọng phải có `created_by`, `updated_by`, thời gian và audit/event log.
9. Các báo cáo lấy dữ liệu từ nguồn nghiệp vụ đã khóa, không tự tính theo logic riêng khác với backend.
10. Triển khai theo vertical slice hoàn chỉnh: migration -> backend contract -> UI -> test -> deploy -> production smoke.

## 4. Tách miền dữ liệu, không nhập nhằng

Các miền chính:

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
Audit and configuration
```

Quy tắc liên kết:

- MCP có thể tạo nguồn đơn hàng, follow-up hoặc tín hiệu thị trường, nhưng không sở hữu toàn bộ vòng đời đơn/kho/công nợ.
- Đơn hàng là nguồn yêu cầu bán hàng.
- Giao hàng là nguồn sự thật về số lượng thực giao.
- Tồn kho là nguồn sự thật về nhập/xuất/giữ/điều chỉnh.
- Công nợ là nguồn sự thật về phải thu, thu tiền, hoàn tiền và bù trừ.
- Dashboard và báo cáo chỉ đọc từ các nguồn sự thật trên hoặc read model được tái tạo được.

## 5. Thứ tự triển khai đúng theo phụ thuộc

Thứ tự menu không đồng nghĩa thứ tự xây kỹ thuật. Thứ tự triển khai:

### Phase A — Khóa nền tảng dùng chung

```text
A1. Audit user/role hiện có
A2. Chốt tenant/NPP scope
A3. Chốt actor/audit/event contract
A4. Chốt money, quantity, unit, timezone, document numbering
A5. Chốt permission matrix tối thiểu
```

Không cần hoàn thiện toàn bộ màn hình cài đặt trước, nhưng nền quyền và audit phải có trước mutation quan trọng.

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
```

Đây là phase ưu tiên cao nhất vì các module kho, công nợ và báo cáo đều phụ thuộc logic đơn.

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
```

## 6. Quy tắc đặc biệt cho đơn hàng

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

Plan chi tiết nằm tại [`docs/npp-plan/03-don-hang.md`](./docs/npp-plan/03-don-hang.md).

## 7. Mẫu theo dõi bắt buộc cho từng module

Mỗi plan module phải duy trì các mục:

```text
1. Mục tiêu và phạm vi
2. Ngoài phạm vi
3. Nguồn dữ liệu hiện có
4. Contract cần khóa
5. Data model/migration
6. Backend API
7. UI/UX
8. Permission matrix
9. Audit/event log
10. Test matrix
11. Migration/backfill
12. Deploy/smoke/rollback
13. Open questions
14. Decision log
15. Checklist trạng thái
```

Trạng thái task chuẩn:

```text
TODO -> DESIGNING -> CONTRACT LOCKED -> IMPLEMENTING
-> REVIEW -> VERIFIED -> DEPLOYED -> FROZEN
```

Không đánh dấu `DONE` chỉ vì UI đã hiện; phải đủ DB, backend, permission, test và production smoke.

## 8. Definition of Ready

Một module chỉ được bắt đầu code mutation khi:

- Đã audit bảng/API/UI hiện có.
- Đã vẽ luồng chuẩn và luồng ngoại lệ.
- Đã xác định nguồn sự thật.
- Đã chốt trạng thái và transition hợp lệ.
- Đã chốt quyền ai được xem/tạo/sửa/hủy/duyệt.
- Đã có migration plan và rollback/forward-fix plan.
- Đã có acceptance test cho happy path và edge case.

## 9. Definition of Done

Một vertical slice chỉ hoàn thành khi:

- Migration chạy được trên môi trường sạch và production-compatible.
- Backend áp dụng đúng transaction và idempotency.
- Frontend không bypass backend mutation.
- Permission deny-by-default hoạt động.
- Audit/event đầy đủ.
- Unit/integration/contract test pass.
- Build pass.
- Deploy VPS/Vercel đúng phần liên quan.
- Production smoke pass.
- Tài liệu và decision log được cập nhật.

## 10. Quy tắc thay đổi contract

Khi thay đổi logic đã khóa:

1. Ghi rõ lý do nghiệp vụ.
2. Xác định dữ liệu cũ bị ảnh hưởng.
3. Tạo migration/version mới.
4. Cập nhật API contract.
5. Thêm test hồi quy.
6. Có kế hoạch deploy và rollback/forward-fix.
7. Cập nhật module plan và master plan.
8. Không sửa âm thầm để chữa một màn hình riêng.

## 11. Mốc triển khai gần nhất

```text
[ ] NPP-F01 Audit toàn bộ order/order_items/API/UI hiện có
[ ] NPP-F02 Khóa order lifecycle và transition matrix
[ ] NPP-F03 Khóa product/unit/price contract tối thiểu cho đơn
[ ] NPP-F04 Khóa warehouse/inventory movement contract tối thiểu
[ ] NPP-F05 Khóa receivable posting contract tối thiểu
[ ] NPP-F06 Thiết kế migration theo vertical slice đầu tiên
[ ] NPP-F07 Implement đơn draft -> confirmed với audit/idempotency
[ ] NPP-F08 Implement giao một phần và backorder
[ ] NPP-F09 Implement trả/đổi hàng
[ ] NPP-F10 Kết nối dashboard/read model sau khi nguồn sự thật ổn định
```

## 12. Kết luận

```text
MCP v1 = frozen core, tiếp tục tồn tại như module vận hành thị trường.
MCP-Plan = App quản lý NPP tổng thể.
Đơn hàng = miền ưu tiên số 1 và phải khóa logic trước khi mở rộng kho/công nợ.
Mỗi module = một plan riêng, có contract, checklist, test và decision log độc lập.
```
