# MCP warm theme foundation và session-action UI gate

> Cập nhật: **2026-07-18**  
> Phạm vi: **Bước 1–2 trước khi mở rộng AppShell/menu**

## Root cause UI action gate

Backend order/test/report/follow-up đã có typed owner và production runtime PASS, nhưng caller UI còn dùng alias/đường dẫn frontend cũ trong khi `mutationOperation()` chỉ nhận đường dẫn khác. Vì operation được resolve trước `fetch`, thao tác có thể dừng tại client với `unsupported_mutation_operation` và không gửi request.

Fix khóa bốn caller vào cùng canonical frontend proxy:

```text
/api/backend/mcp-day/session-customer/order
/api/backend/mcp-day/session-customer/test
/api/backend/mcp-day/session-customer/report
/api/backend/mcp-day/session-customer/followup
```

Chromium smoke click thật bốn action trên UI, kiểm mỗi request có `Idempotency-Key`, đúng payload/customer và chỉ tạo một aggregate trong stateful mock.

## Warm theme foundation

Palette dùng mô hình lai:

```text
app canvas       #F7F3ED  kem nhẹ
card/table       #FFFFFF  trắng
header/sidebar   #5A3A24  nâu
primary          #4F7A3A  xanh olive
accent           #C89B5B  vàng đất
text             #2B211B
border           #E8DED2
```

Tất cả màu nằm trong `src/app/npp-theme.css`, sau đó map về alias hiện hữu (`--bg`, `--panel`, `--brand`...). Không rải hex mới theo từng màn hình. Theme được import cuối để làm lớp ownership duy nhất trong giai đoạn chuyển đổi.

## Chưa nằm trong slice

- Chưa mở rộng inventory của menu ☰.
- Chưa đổi từng component đặc thù bằng CSS riêng.
- Chưa thêm haptic/rung.
- Không đổi backend/schema.

Sau CI/Vercel, còn một lượt mobile production click thực tế để ghi live evidence; automated browser smoke không được ghi thay cho live production.
