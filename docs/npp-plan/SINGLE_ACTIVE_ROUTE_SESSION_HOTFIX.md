# MCP — Single active session per route hotfix

> Cập nhật: **2026-07-17**  
> Incident: nút **Thêm điểm bán** tại tuyến `Thứ 6` dừng trước mutation và hiện lỗi chung  
> PR: **#31**  
> Trạng thái: **SOURCE + CI PASS — PRODUCTION MIGRATION PENDING**

## 1. Triệu chứng

Màn hình tuyến cố định lấy được GPS nhưng khi bấm **Thêm điểm bán** chỉ hiện:

```text
Không lưu được điểm bán. Vui lòng thử lại.
```

Không có `route-customer.add` record mới tương ứng với thao tác UI vì request tạo khách chưa được gửi.

## 2. Root cause theo luồng thật

```text
McpMasterView
-> GET /api/backend/mcp-settings/session-status?routeId=...
-> lọc status=active
-> phát hiện >1 active session
-> chặn trước POST /api/route-customers
-> userFacingError rơi về fallback chung
```

Production route:

```text
route_id:   mcp-route-mr45ai4r-u7qf4g
route_name: Thứ 6
area:       Chợ Gạo-Gò Công
```

Có năm phiên cùng `active`:

```text
2026-07-17  active  có hoạt động thật
2026-07-10  active  không có hoạt động
2026-07-05  active  có hoạt động thật
2026-07-04  active  có hoạt động thật
2026-07-03  active  có hoạt động thật
```

DB chỉ khóa unique `(route_id, session_date)`. Không có invariant “mỗi tuyến tối đa một phiên active”, và `mcp_open_route_session` có thể tạo ngày mới trong khi ngày cũ chưa được chốt.

## 3. Quyết định sửa

Không chọn âm thầm phiên mới nhất cho thao tác thêm khách. Không xóa phiên cũ. Không đổi snapshot khách để né lỗi.

Migration `20260717183000_single_active_route_session.sql`:

1. khóa writes vào `mcp_route_sessions` trong lúc repair;
2. xếp hạng active sessions theo `session_date`, `created_at`, `id` mới nhất;
3. giữ newest active;
4. phiên cũ có hoạt động đi qua canonical `mcp_update_route_session(..., 'done')`;
5. phiên cũ không có hoạt động chuyển `cancelled`;
6. tạo partial unique index trên `route_id` với `status=active`;
7. thay `mcp_open_route_session` để mở ngày mới sẽ finalize phiên active cũ hơn trong cùng transaction;
8. dùng lock order `session -> route`, đồng nhất với route/session customer mutations;
9. giữ nguyên visit, check-in, result, order, test, report và follow-up hiện hữu.

UI error mapping cũng phân biệt rõ:

```text
nhiều active session -> vào Quản lý phiên để chốt/hủy phiên cũ
active session conflict -> chốt/hủy phiên đang mở trước khi mở phiên mới
```

## 4. Tests

Contract mới:

```text
apps/backend/foundation/route-session-single-active-migration.test.js
```

Khóa các yêu cầu:

- repair chạy trước unique index;
- phân loại activity bằng counters + operational rows;
- không delete session hoặc session customer;
- không backfill/copy customer snapshots trong historical repair;
- partial unique index một active/route;
- open-session dùng session-first lock order;
- stale active được done/cancelled trước insert ngày mới;
- new session vẫn snapshot đúng một lần.

CI:

```text
Foundation F0.2 #324
Run ID: 29595470829
Scanner: PASS
Production hygiene: PASS
Backend tests: PASS
TypeScript: PASS
Next production build: PASS
```

## 5. Production dry-run có rollback

### Repair hiện trạng

Kết quả trong transaction:

```text
17/07 -> active
10/07 -> cancelled
05/07 -> done
04/07 -> done
03/07 -> done
```

Unique index compile thành công. Sau `ROLLBACK`, statuses và schema production vẫn nguyên trạng.

### Mở phiên ngày mới

Sau repair, giả lập:

```sql
mcp_open_route_session(route Thứ 6, date '2026-07-18', 'Dry Run')
```

Kết quả trong transaction:

```text
18/07 -> active
17/07 -> done
active_count = 1
```

Sau `ROLLBACK`, không còn phiên 18/07 và index dry-run không tồn tại.

## 6. Release gate

Chỉ apply production sau khi PR source CI xanh.

Sau apply phải xác nhận:

```text
active_session_count <= 1 cho mọi route
Thứ 6: 17/07 active, 10/07 cancelled, 05/07/04/07/03/07 done
mcp_route_sessions_one_active_per_route_uidx tồn tại
mcp_open_route_session giữ SECURITY DEFINER
UI preflight tuyến Thứ 6 thấy đúng một active session và hiện prompt hai lựa chọn
```

Không đụng `milktea-backend` port 3002. Không bắt đầu A5.5.2, NPP-F06 hoặc Order Core trước khi đóng F05 runtime/UI gates.
