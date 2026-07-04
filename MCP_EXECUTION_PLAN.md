# MCP Execution Plan

> Mục tiêu của file này: gom toàn bộ logic MCP hiện tại, lỗi đã phát hiện, DB contract và checklist làm tiếp để không làm lý thuyết suông, không sửa chắp vá.

## 0. Nguyên tắc bắt buộc

```text
1. Không sửa UI trước khi biết action đó ghi vào bảng nào.
2. Không thêm nút nếu chưa có nghiệp vụ, API, payload, DB output rõ ràng.
3. Không fallback latest session khi người dùng đã chọn route/date.
4. Không dùng mock cho flow có routeId/sessionId.
5. Không tạo dữ liệu trùng khi bấm lại hoặc mở lại phiên.
6. Không dùng service role key ở Vercel/browser.
7. Backend/VPS chịu trách nhiệm nghiệp vụ; frontend chỉ truyền đúng payload và hiển thị kết quả.
8. Mỗi gate phải có smoke test và output kỳ vọng.
```

## 1. Runtime hiện tại

```text
Frontend: Vercel / Next.js
Live URL: https://mcp-plan.vercel.app

Backend VPS:
- Host: backend-DO-02
- IP: 165.22.109.61
- Source path: /var/www/mcp-plan-source
- Runtime path: /var/www/mcp-plan-backend
- PM2 app: mcp-plan-backend
- Internal API: http://127.0.0.1:3001
- Public rewrite target: http://165.22.109.61

Supabase:
- Project ref: noiadkpkvdohljgopgfb
```

Vercel chỉ cần biến trỏ về backend:

```text
BACKEND_API_BASE_URL=http://165.22.109.61
```

Không đưa `SUPABASE_SERVICE_ROLE_KEY` lên Vercel. Supabase service role chỉ ở VPS backend hoặc Supabase Edge Function.

## 2. Trạng thái live đã xác nhận

### Đã sửa xong

```text
✅ /visits không còn được mở trống routeId.
✅ /mcp -> /routes -> open-session -> /visits?routeId=...&date=...
✅ Backend live đã load đúng session theo routeId + date.
✅ Trường hợp test route Thứ 6 2026-07-04 đã trả đúng:
   - routeId: mcp-route-mr45ai4r-u7qf4g
   - routeName: Thứ 6
   - date: 2026-07-04
   - lines: 18
✅ 3 card MCP home đã route-first, không tự vào latest /visits.
✅ Card khách trong phiên đã có quick actions: Đơn / Test / BC / FU.
```

### Chưa đạt nghiệp vụ thật

```text
❌ Popup Đơn/Test/BC/FU chưa phải form nghiệp vụ thật.
❌ Đơn chỉ set cờ hasOrder, chưa tạo orders/order_items.
❌ Test chỉ set cờ hasTest, chưa tạo file test / khách test / kết quả test.
❌ Báo cáo chỉ set cờ hasReport, chưa tạo market report thật.
❌ Follow-up còn payload mặc định, chưa có ngày hẹn/owner/priority/nội dung thật từ người dùng.
❌ Tab /mcp/settings còn placeholder, chưa có template thao tác.
❌ Nhiều nút ở Orders/Test/Reports như “Việc”, “Tạo việc xử lý” chưa có handler hoặc chưa ghi DB.
```

## 3. Logic nghiệp vụ MCP chuẩn

### 3.1 Tuyến cố định / route master

Tuyến cố định là dữ liệu gốc để lập lịch đi tuyến.

```text
mcp_routes
  -> một tuyến cố định: Thứ 2, Thứ 3, Thứ 6...

mcp_route_customers
  -> danh sách khách thuộc tuyến cố định
  -> có sort_order, active, GPS, note
```

Quy tắc:

```text
1. Sửa khách trong tuyến cố định không được làm thay đổi phiên cũ đã mở.
2. Khách active trong route master sẽ được copy sang session khi mở phiên mới.
3. Khách inactive/hidden không copy vào session mới.
4. Thứ tự ghé trong phiên lấy từ sort_order của route master tại thời điểm mở phiên.
5. GPS thuộc route master; phiên chỉ snapshot thông tin cần đi trong ngày.
```

### 3.2 Tuyến trong ngày / session snapshot

Phiên trong ngày là bản chụp của tuyến cố định tại một ngày cụ thể.

```text
mcp_route_sessions
  -> một phiên đi tuyến theo route_id + session_date

mcp_session_customers
  -> snapshot khách trong phiên đó
  -> không phụ thuộc trực tiếp vào route master sau khi mở phiên

mcp_visits
  -> kết quả ghé thật / check-in / has_order / has_test / has_report

mcp_followups
  -> việc cần theo dõi sau ghé
```

Quy tắc:

```text
1. Một route chỉ có tối đa một session cho một ngày.
2. Một route_customer chỉ được snapshot một lần trong cùng một session.
3. Khách phát sinh trong ngày source = added, route_customer_id có thể null.
4. Bấm lại open-session không duplicate session và không duplicate snapshot.
5. Visit phải dùng session.session_date, không dùng ngày server hiện tại.
6. Nếu action phát sinh từ một phiên, payload phải có sessionId hoặc sessionCustomerId rõ ràng.
7. Không được action vào latest session nếu người dùng đang ở phiên cụ thể.
```

## 4. DB hiện có và vai trò

### MCP core

```text
mcp_routes
- Tuyến cố định.

mcp_route_customers
- Khách trong tuyến cố định.

mcp_route_sessions
- Phiên MCP theo ngày.

mcp_session_customers
- Snapshot khách trong phiên.

mcp_visits
- Kết quả ghé thật.

mcp_followups
- Việc theo dõi phát sinh từ phiên/khách.
```

### Nghiệp vụ liên quan

```text
orders
order_items
- Đơn hàng thật.

test_files
test_file_products
test_customers
test_customer_results
- Đợt test, sản phẩm test, khách test và kết quả từng sản phẩm.

market_reports
market_report_products
market_report_competitors
- Báo cáo thị trường thật.
```

## 5. Các khóa DB cần harden tiếp

### Đã có

```sql
create unique index if not exists mcp_session_customers_session_route_customer_uidx
on public.mcp_session_customers(session_id, route_customer_id)
where route_customer_id is not null;
```

### Cần thêm trước khi làm form

```sql
-- Một tuyến chỉ có một phiên cho một ngày.
create unique index if not exists mcp_route_sessions_route_date_uidx
on public.mcp_route_sessions(route_id, session_date);

-- Một visit chính cho một session_customer, nếu DB đã có session_customer_id sau này.
-- Hiện mcp_visits chưa có session_customer_id, nên cân nhắc thêm cột này hoặc giữ visit_id ở mcp_session_customers.
```

## 6. Backend/API contract cần chuẩn hóa

### 6.1 Endpoint hiện có

```text
GET  /api/mcp-day/data?routeId=...&date=...
POST /api/mcp-day/open-session
POST /api/mcp-day/session-customer/status
POST /api/mcp-day/session-customer/result
POST /api/mcp-day/session-customer/add
POST /api/mcp-day/session-customer/followup
```

### 6.2 Endpoint nên tách rõ nghiệp vụ

Không nên dùng một endpoint result chung cho mọi nghiệp vụ lâu dài. Cần tách để payload/DB rõ:

```text
POST /api/mcp-day/session-customer/order
POST /api/mcp-day/session-customer/test
POST /api/mcp-day/session-customer/report
POST /api/mcp-day/session-customer/followup
POST /api/mcp-day/session-customer/add-customer
POST /api/mcp-day/session/close
```

### 6.3 Payload yêu cầu

#### Order từ MCP

```json
{
  "sessionId": "mrs_...",
  "sessionCustomerId": "msc_...",
  "routeId": "mcp-route-...",
  "orderDate": "2026-07-04",
  "customerName": "Tên khách",
  "phone": "...",
  "area": "...",
  "items": [
    { "productId": "...", "productName": "Trà Đen", "quantity": 1, "unitPrice": 0, "unit": "gói", "note": "" }
  ],
  "note": ""
}
```

Output DB:

```text
orders
order_items
mcp_visits.has_order = true
mcp_visits.order_id = order.id
mcp_session_customers.order_id = order.id
mcp_route_sessions.order_count recalc
```

#### Test từ MCP

```json
{
  "sessionId": "mrs_...",
  "sessionCustomerId": "msc_...",
  "testFileId": "test-file-...",
  "customerName": "Tên khách",
  "products": [
    { "productId": "...", "productName": "Trà Gạo Rang", "status": "ok", "note": "Khách thích" }
  ],
  "note": ""
}
```

Output DB:

```text
test_customers
test_customer_results
mcp_visits.has_test = true
mcp_visits.test_id = test_customer.id hoặc test_result group id
mcp_session_customers.test_id = ...
mcp_route_sessions.test_count recalc
```

#### Báo cáo từ MCP

```json
{
  "sessionId": "mrs_...",
  "sessionCustomerId": "msc_...",
  "reportType": "price | competitor | display | stock | demand",
  "subject": "Giá đối thủ",
  "competitorName": "...",
  "price": 0,
  "status": "normal | opportunity | risk",
  "nextAction": "...",
  "note": ""
}
```

Output DB:

```text
market_reports
market_report_products / market_report_competitors nếu có chi tiết
mcp_visits.has_report = true
mcp_visits.report_id = market_report.id
mcp_session_customers.report_id = market_report.id
mcp_route_sessions.report_count recalc
```

#### Follow-up từ MCP

```json
{
  "sessionId": "mrs_...",
  "sessionCustomerId": "msc_...",
  "title": "Gọi lại khách",
  "dueDate": "2026-07-08",
  "priority": "low | medium | high",
  "owner": "Sale",
  "followupType": "general | order | test | report | debt | delivery",
  "note": ""
}
```

Output DB:

```text
mcp_followups
mcp_session_customers.followup_count recalc
```

## 7. UI form cần làm thật

### 7.1 Popup MCP customer

Card khách trong phiên cần mở popup có 2 lớp:

```text
Lớp 1: Thông tin khách
- Tên khách
- Khu vực
- Phone
- Nguồn: planned/added
- Trạng thái: pending/visited/skipped/cancelled
- Ghi chú tuyến/session
- GPS/maps nếu có

Lớp 2: Hành động
- Ghi đơn
- Test sản phẩm
- Báo cáo
- Follow-up
- Bỏ qua / đóng cửa / hẹn lại
```

### 7.2 Form Đơn

```text
- Chọn sản phẩm từ template hoặc nhập nhanh.
- Số lượng.
- Đơn vị.
- Đơn giá.
- Chiết khấu nếu cần.
- Ghi chú giao hàng.
- Lưu nháp / Chốt đơn.
```

### 7.3 Form Test

```text
- Chọn file test hiện có hoặc tạo nhanh file test.
- Danh sách sản phẩm test lấy từ file/template.
- Mỗi sản phẩm có status:
  pending / ok / interested / sample / follow / bad / retry
- Ghi chú từng sản phẩm.
- Ghi chú khách test.
```

### 7.4 Form Báo cáo

```text
- Loại báo cáo: giá / đối thủ / trưng bày / tồn kho / nhu cầu.
- Sản phẩm liên quan.
- Đối thủ nếu có.
- Giá nếu có.
- Đánh giá: normal / opportunity / risk.
- Next action.
- Ghi chú.
```

### 7.5 Form Follow-up

```text
- Tiêu đề.
- Ngày hẹn.
- Người phụ trách.
- Ưu tiên.
- Loại follow-up.
- Ghi chú.
```

## 8. Tab Cài đặt tuyến cần có gì

`/mcp/settings` không được là placeholder. Cần chia thành các tab cấu hình nghiệp vụ:

```text
1. Mẫu đơn hàng
2. Mẫu test sản phẩm
3. Mẫu báo cáo thị trường
4. Mẫu follow-up
5. Lý do bỏ qua/không mua
6. Luật thêm khách phát sinh
7. Luật chốt phiên
```

### 8.1 Mẫu đơn hàng

```text
- Product/SKU nhanh.
- Combo nhanh.
- Giá mặc định.
- Đơn vị tính.
- Ghi chú giao hàng mẫu.
```

### 8.2 Mẫu test sản phẩm

```text
- Tên file test mẫu.
- Danh sách sản phẩm test mặc định.
- Status test.
- Ghi chú gợi ý.
```

### 8.3 Mẫu báo cáo

```text
- Giá đối thủ.
- Tồn kho.
- Trưng bày.
- Nhu cầu.
- Cơ hội/rủi ro.
- Next action mẫu.
```

### 8.4 Luật thêm khách

```text
Khi thêm khách phát sinh trong phiên:
1. Chỉ thêm vào phiên hôm nay.
2. Thêm vào tuyến cố định.
3. Thêm cả phiên hôm nay và tuyến cố định.

Default đề xuất: hỏi người dùng mỗi lần.
```

## 9. Repo tham khảo `gustavjung01/report` - nguyên tắc lấy về

Không copy UI nguyên xi. Chỉ lấy nghiệp vụ:

```text
1. Home có 4 nghiệp vụ chính: MCP / Đơn / Test / Báo cáo.
2. Data hub cũng chia 4 nhóm: MCP / Đơn / Test / Báo cáo.
3. Test flow phải là:
   tạo file test -> chọn sản phẩm -> thêm khách -> nhập kết quả từng sản phẩm.
4. Local DB/offline queue là hướng tốt cho app mobile sau này, nhưng MCP-Plan hiện ưu tiên backend live trước.
5. Form phải tạo data thật, không chỉ set flag.
```

## 10. Gate triển khai tiếp theo

### Gate MCP-5: Backend correctness hardening

Trạng thái: `todo`

Checklist:

```text
[ ] Thêm unique index mcp_route_sessions(route_id, session_date).
[ ] Sửa backend updateMcpSessionCustomerStatus: visit_date = session.session_date.
[ ] Sửa Edge Function mcp-day-8b3 ensureVisit: visit_date = session.session_date.
[ ] Không cho add/result fallback latest session nếu action đến từ UI phiên cụ thể.
[ ] Smoke open-session cùng route/date 2 lần không duplicate.
[ ] Smoke action trên session quá khứ không ghi visit_date hôm nay.
```

Output kỳ vọng:

```text
GET /api/mcp-day/data?routeId=...&date=...
-> luôn đúng route/date.

POST result/order/test/report/followup
-> luôn ghi vào đúng sessionCustomerId.
```

### Gate MCP-6: Action form contract

Trạng thái: `todo`

Checklist:

```text
[ ] Chốt payload cho Order/Test/Report/Follow-up.
[ ] Chốt bảng ghi cho từng action.
[ ] Chốt response trả về cho UI.
[ ] Chốt error code nghiệp vụ.
[ ] Viết API contract docs.
```

### Gate MCP-7: Real MCP popup forms

Trạng thái: `todo`

Checklist:

```text
[ ] Popup khách có tab/thao tác rõ.
[ ] Form Đơn tạo orders/order_items thật.
[ ] Form Test tạo/ghi test data thật.
[ ] Form Báo cáo tạo market report thật.
[ ] Form Follow-up nhập đầy đủ fields.
[ ] Nút không có handler thì bỏ hoặc disable có lý do.
[ ] Field nhập phải nhập được trên mobile.
```

### Gate MCP-8: MCP Settings templates

Trạng thái: `todo`

Checklist:

```text
[ ] Tạo UI /mcp/settings thật.
[ ] DB template nếu cần.
[ ] CRUD template đơn hàng.
[ ] CRUD template test.
[ ] CRUD template báo cáo.
[ ] CRUD template follow-up/lý do.
[ ] Áp template vào popup MCP.
```

### Gate MCP-9: Route master management

Trạng thái: `todo`

Checklist:

```text
[ ] Thêm/sửa tuyến.
[ ] Thêm/sửa khách tuyến.
[ ] Ẩn/khôi phục khách tuyến.
[ ] Reorder sort_order.
[ ] Update GPS/maps.
[ ] Luật thêm khách phát sinh vào route master.
```

### Gate MCP-10: Session close/report

Trạng thái: `todo`

Checklist:

```text
[ ] Chốt phiên.
[ ] Không cho sửa dữ liệu quan trọng sau khi chốt, trừ quyền admin.
[ ] Tổng kết phiên: khách đã ghé/chưa ghé, đơn, test, báo cáo, follow-up.
[ ] Xuất báo cáo ngày/tuyến.
```

## 11. Smoke test chuẩn sau mỗi gate

### Test route/session

```bash
curl -fsS "http://127.0.0.1:3001/api/mcp-day/data?routeId=mcp-route-mr45ai4r-u7qf4g&date=2026-07-04" | head -c 500
```

Kỳ vọng:

```text
routeName: Thứ 6
date: 2026-07-04
routeId: mcp-route-mr45ai4r-u7qf4g
```

### Test Vercel rewrite

```text
https://mcp-plan.vercel.app/api/backend/mcp-day/data?routeId=mcp-route-mr45ai4r-u7qf4g&date=2026-07-04
```

Kỳ vọng giống VPS.

### Test UI

```text
/mcp
-> chọn tuyến
-> mở phiên
-> URL phải có routeId + date
-> card khách đúng tuyến
-> bấm Đơn/Test/BC/FU
-> form phải nhập được
-> lưu xong reload vẫn còn data đúng khách/session
```

## 12. Không làm trong phase này

```text
- Không làm AI/mindmap trước khi action data thật ổn định.
- Không làm dashboard đẹp thêm nếu popup còn không ghi được nghiệp vụ.
- Không thêm biến Supabase lên Vercel.
- Không tạo mock mới che lỗi backend.
- Không sửa DB thủ công không migration.
```
