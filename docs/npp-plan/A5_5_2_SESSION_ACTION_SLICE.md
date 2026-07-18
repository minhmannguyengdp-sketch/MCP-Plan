# A5.5.2 — Session action idempotency slice

> Cập nhật: **2026-07-18**  
> PR: **#41**  
> Phạm vi: **order / test / market report / follow-up từ khách trong phiên**  
> Trạng thái: **CODE IN PROGRESS — PRODUCTION MIGRATION/RUNTIME PENDING**

## Root cause

Bốn thao tác nghiệp vụ rủi ro cao vẫn đi qua legacy proxy và gọi business RPC trực tiếp. Caller dùng `fetch()` thường nên không có stable `Idempotency-Key`; retry có thể tạo thêm đơn, kết quả test hoặc follow-up, còn report có thể chạy update lại mà không có replay contract.

## Kiến trúc slice

```text
UI user intent
-> idempotentMutationFetch (một key giữ nguyên qua retry)
-> Next backend proxy
-> Foundation Gateway
-> transitional typed owner
-> typed idempotent wrapper RPC
-> existing business RPC
-> audit + response snapshot + completed record trong cùng transaction
```

Bốn route được intercept trước legacy proxy:

```text
POST /api/mcp-day/session-customer/order
POST /api/mcp-day/session-customer/test
POST /api/mcp-day/session-customer/report
POST /api/mcp-day/session-customer/followup
```

Không thêm generic table-write endpoint. Existing business RPC tiếp tục sở hữu invariant và table mutation.

## Operation inventory

```text
session-customer.order.create
session-customer.test.create
session-customer.report.create
session-customer.followup.create
```

Mỗi wrapper:

- canonicalize payload đã validate;
- claim bằng `(installation_id, operation, idempotency_key)`;
- replay cùng key/cùng payload;
- trả 409 khi cùng key/khác payload;
- delegate existing business RPC;
- lưu trusted `foundation_context` vào aggregate row;
- complete idempotency record và append audit trong cùng transaction.

## Coverage

```text
A5.5.1 verified: 9/30
Slice target:      +4
Target after production runtime evidence: 13/30
Legacy remaining: 17
```

Không ghi 13/30 PASS cho đến khi migration production, VPS deploy và authenticated Gateway smoke execute/replay/conflict/audit/cleanup đều PASS.

## Test gates

- mutation unit test kiểm RPC args + trusted context;
- migration contract kiểm 4 begin/complete/replay wrapper;
- transitional API test chứng minh route không rơi xuống legacy proxy;
- caller contract cấm quay lại `fetch()` thường;
- Foundation scanner, backend verify, TypeScript và Next build;
- browser regression hiện hữu.

## Runtime gate sau merge

1. Apply migration từ source `main`.
2. `pullmcp` trên VPS.
3. Tạo fixture riêng và chạy từng operation qua Gateway `127.0.0.1:3001`.
4. Với mỗi operation kiểm execute, replay, same-key/different-payload conflict và audit.
5. Rollback/dọn fixture; không để đơn/test/report/follow-up test trong production.
6. Chỉ khi cleanup PASS mới cập nhật coverage thành 13/30.

Không đụng `milktea-backend` port `3002`.
