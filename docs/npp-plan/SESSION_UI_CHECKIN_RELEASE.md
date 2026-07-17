# Session UI — Manual sales check-in + compact MCP popups

> Cập nhật: **2026-07-17**  
> Trạng thái source: **VERIFIED — PR #26 READY TO MERGE**  
> Trạng thái production DB: **APPLIED + VERIFIED**  
> Runtime VPS/Gateway: **PENDING**

## 1. Phạm vi

### Tab Phiên

- Sáu hành động được rút gọn thành lưới cố định `3 cột × 2 hàng`:
  - Chỉ đường;
  - Đơn;
  - Test;
  - Quan sát;
  - Theo dõi;
  - Bỏ qua.
- Trạng thái xử lý nằm góc phải trên, đối xứng với tên khách; không còn mang hình thức nút thao tác.
- Nút check-in là ô vuông riêng bên phải, cao bằng hai hàng hành động.

### Check-in

- Chỉ gọi `navigator.geolocation.getCurrentPosition` khi sales bấm nút check-in.
- Không tự lấy vị trí khi mở tab, render card hoặc refresh trang.
- `maximumAge: 0`, `enableHighAccuracy: true`, timeout 15 giây.
- Bấm lần hai thực hiện `checkedIn=false`; nhánh này không gọi GPS và không gửi tọa độ cũ.
- Check-in không đổi `visit_status`.
- Check-in không ghi đè GPS của `mcp_route_customers`.

### Popup MCP

- Popup tạo đơn giữ nguyên workspace hiện tại.
- Popup Test / Quan sát / Theo dõi / Bỏ qua và popup thông tin khách dùng variant `compact`:
  - khung rộng hơn;
  - viền 1px;
  - radius và shadow nhẹ hơn;
  - nút nhỏ hơn;
  - form/chip dày đặc vừa đủ để tăng vùng thao tác.

## 2. Source ownership

Branch:

```text
ui-session-checkin-modal-density
```

PR:

```text
#26 — Session UI: manual sales check-in and compact MCP popups
```

Final verified head before merge:

```text
6c759d1a620d6ab75fd33887dac32a304823864a
```

Final CI:

```text
Workflow:   Foundation F0.2
Run:        #269
Run ID:     29561052313
Conclusion: success
```

PASS:

- runtime hardcode audit;
- direct mutation scanner + retirement policy;
- production hygiene;
- direct DB mutation audit;
- deploy/frontend auth contracts;
- backend Foundation verify;
- check-in migration contract;
- check-in use-case contract;
- Gateway interception contract;
- UI manual-GPS and compact-popup contract;
- TypeScript;
- Next production build.

Scanner:

```text
legacy debt:  0
unclassified: 0
forbidden:    0
```

Typed owner fingerprint:

```text
fdb8534a5fa190e47190a2be
owner: session-customer-checkin-idempotent-use-case
```

## 3. Database design

Source migration:

```text
supabase/migrations/20260717124500_session_customer_checkin.sql
```

Production migration:

```text
20260717065144  session_customer_checkin
```

Columns trên `mcp_session_customers`:

```text
checkin_lat
checkin_lng
checkin_accuracy
checkin_at
checkin_source
```

Đây là vị trí sales tại lần check-in, tách hoàn toàn khỏi GPS điểm bán.

RPC:

```text
mcp_set_session_customer_checkin
mcp_idempotent_set_session_customer_checkin
```

Permission:

```text
base RPC service_role execute:          false
typed wrapper service_role execute:     true
typed wrapper anon execute:             false
typed wrapper authenticated execute:    false
```

Operation idempotency:

```text
session-customer.checkin.set
```

Audit actions:

```text
checkin
remove_checkin
```

## 4. Production smoke

Safe row:

```text
session customer: msc_87f01a38604942969a9a8c45eb6c83e3
customer:         Sinh Đôi
session status:   active
```

Results:

```text
first check-in:                  PASS — replayed=false
same key + same payload:         PASS — replayed=true
same response/time preserved:    PASS
same key + different accuracy:   idempotency_key_conflict PASS
second-click undo:               PASS — checkedIn=false
undo sends no coordinates:       PASS
check-in columns after undo:      null
business restore:                rollbackEqual=true
visit status preserved:          pending
outlet GPS hash before/after:     identical
```

Outlet GPS hash:

```text
8d393bd119d1422ee72451d347b94104d1dd87bcafd0e72f5c5ad99397644e16
```

Audit evidence:

```text
checkin        succeeded
checkin        replayed
remove_checkin succeeded
```

Idempotency evidence:

```text
check-in key attempt_count: 2
undo key attempt_count:     1
both records:               completed / HTTP 200
```

Business row was restored to its exact pre-smoke `raw_payload`, `updated_at` and null check-in fields. Release idempotency/audit rows remain as immutable evidence.

## 5. Release boundary

Before declaring this UI release fully deployed:

1. merge PR #26;
2. verify Vercel production uses merge SHA and root returns HTTP 200;
3. SSH VPS and run `pullmcp`;
4. verify `F0.2_VPS_SMOKE=PASS`;
5. run authenticated Gateway check-in/replay/conflict/undo smoke;
6. update `CURRENT_PROGRESS.md` and this evidence file.

Do not infer VPS is current until actual `pullmcp` output exists. Do not touch `milktea-backend` port 3002.
