# NPP-F05 — Repeatable Gateway runtime closure smoke

> Cập nhật: **2026-07-17**  
> Trạng thái source: **PR #27 MERGED; drift fix PR #30 CI PASS**  
> VPS boundary: **`F0.2_VPS_SMOKE=PASS`**  
> F05 runtime closure: **RERUN PENDING SAU PR #30**

## 1. Mục tiêu

Đóng hai runtime gate còn thiếu mà không dùng một khối lệnh thủ công dài:

1. manual sales check-in qua authenticated Foundation Gateway;
2. persisted idempotency/audit của một mutation thuộc A5.5.1.

Script không phải application consumer. Đây là operational verification tooling và nằm tại:

```text
test/runtime/smoke-f05-runtime-closure.mjs
```

Lệnh chuẩn:

```bash
cd /var/www/mcp-plan-source
node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
```

Hoặc:

```bash
cd /var/www/mcp-plan-source
set -a
. /var/www/mcp-plan-backend/.env
set +a
npm run smoke:f05-runtime
```

## 2. Phạm vi kiểm tra

### Gateway boundary

- backend token;
- request ID;
- canonical `data / receivedAt / requestId` envelope;
- health `installationConfigured/providerConfigured/authBoundary`.

### Fixture route/customer/session

- route được tạo qua Gateway với guarded smoke metadata hiện hữu;
- `POST /api/route-customers` đi qua typed owner `route-customer.add`;
- một `Idempotency-Key` riêng cho intent tạo route customer;
- `routeCustomerId` response phải trùng `routeCustomerId` trong session snapshot;
- mở session và đọc snapshot qua Gateway.

### Session check-in

- check-in lần đầu với GPS tạm;
- replay cùng key/cùng payload;
- conflict cùng key/payload khác;
- lần bấm thứ hai bỏ check-in, không gửi tọa độ;
- trạng thái xử lý khách không đổi;
- GPS điểm bán không đổi;
- audit có `succeeded`, `replayed`, `remove_checkin succeeded`;
- idempotency record `completed`, `attempt_count=2`.

### A5.5.1 Foundation mutation

Route:

```text
POST /api/mcp-day/session-customer/result
```

Kiểm:

- first execute `replayed=false`;
- replay `replayed=true`;
- response cũ được giữ nguyên;
- cùng key/payload khác trả `409 idempotency_key_conflict`;
- audit `succeeded + replayed`;
- record `completed`, `attempt_count=2`.

### Cleanup

Route fixture dùng đúng guarded contract đã tồn tại:

```text
route_name: __MCP_V1_API_FULL__<13-digit timestamp>-<6-char suffix>
area:       API Smoke
note:       temporary MCP v1 API smoke
```

Sau mọi nhánh PASS/FAIL, script gọi guarded smoke cleanup và yêu cầu:

```text
smokeCleanup=true
fixtureCleanup=PASS
```

Không mở rộng hard-delete guard production cho một prefix test mới. Không dùng dữ liệu khách production hiện hữu và không để fixture nghiệp vụ.

## 3. Secret và boundary

Script đọc từ VPS environment:

```text
BACKEND_API_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Quy tắc:

- không in secret;
- service role chỉ dùng read-only để xác minh audit/idempotency/GPS;
- mutation nghiệp vụ vẫn đi qua authenticated Gateway;
- source app/backend không import runtime test;
- direct mutation scanner không thêm baseline hoặc exception.

## 4. Source / PR / CI

### Script gốc

```text
PR:           #27 — MERGED
Branch:       f05-runtime-smoke-closure
Merge SHA:    a59dfdc01c6755ef426753c3c8216cc460b747d2
Final CI:     Foundation F0.2 #286 — PASS
CI run ID:    29563734574
```

### Drift fix sau route-customer typed ownership

```text
PR:           #30 — MERGED AFTER CI PASS
Branch:       fix/f05-runtime-smoke-route-owner
Final head:   3875aef1565134d7b38b395c720fa0ce97c2b6ca
Final CI:     Foundation F0.2 #320 — PASS
CI run ID:    29593856963
```

CI #320 PASS:

- runtime hardcode audit;
- scanner + retirement policy;
- production hygiene;
- direct DB mutation audit;
- deploy/frontend auth contracts;
- backend Foundation verify;
- runtime smoke syntax/contract tests;
- TypeScript;
- Next production build.

Vercel Preview của PR #30 bị `CANCELED` bởi `ignoreCommand`, đúng chủ đích; branch không chạy `npm install`/`next build` trên Vercel.

## 5. VPS evidence và root cause lần chạy đầu

`pullmcp` đã hoàn tất thành công:

```text
127.0.0.1:3001 LISTEN
127.0.0.1:3102 LISTEN
F0.2_VPS_SMOKE=PASS
```

F05 runtime attempt đầu trả:

```json
{
  "F05_RUNTIME_CLOSURE_SMOKE": "FAIL",
  "errors": [
    "outlet_before_missing",
    "f05_runtime_cleanup_failed"
  ]
}
```

Đây không phải lỗi deployer hoặc PM2. Root cause là smoke tooling bị drift:

1. `POST /api/route-customers` đã chuyển sang typed idempotent owner nhưng fixture cũ không gửi `Idempotency-Key`.
2. Fixture cũ dùng `__MCP_V1_API_F05_RUNTIME__`, area/note riêng, không khớp hard-delete smoke guard hiện hữu.
3. Cleanup RPC đã xóa route nhưng trả `smokeCleanup=false`; script diễn giải thành cleanup fail.
4. `AggregateError` chỉ in message ngoài, che mất lỗi cleanup con.

Production DB được kiểm tra sau lần FAIL và không còn route fixture F05. Không có fixture leak.

PR #30 sửa đúng tooling:

- thêm stable route-customer idempotency key;
- dùng lại guarded fixture contract hiện hữu;
- kiểm response/snapshot ownership;
- flatten nested cleanup errors;
- không đổi schema, business mutation hoặc hard-delete guard.

## 6. Expected output sau rerun

```json
{
  "F05_RUNTIME_CLOSURE_SMOKE": "PASS",
  "health": "PASS",
  "canonicalEnvelope": "PASS",
  "checkin": {
    "first": "PASS",
    "replay": "PASS",
    "conflict": "PASS",
    "secondClickUndo": "PASS",
    "audit": "PASS",
    "outletGpsUnchanged": true,
    "visitStatusUnchanged": true
  },
  "foundationResult": {
    "first": "PASS",
    "replay": "PASS",
    "conflict": "PASS",
    "audit": "PASS",
    "responsePreserved": true
  },
  "fixtureCleanup": "PASS"
}
```

## 7. Release gate

Không được đóng NPP-F05/A5.5.1 runtime trước khi có output thật từ VPS:

```text
pullmcp => F0.2_VPS_SMOKE=PASS        PASS
smoke-f05-runtime-closure => PASS     PENDING RERUN
fixtureCleanup => PASS                PENDING RERUN
```

Lệnh rerun:

```bash
pullmcp
cd /var/www/mcp-plan-source
node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
```

Sau khi output thật PASS phải cập nhật:

```text
CURRENT_PROGRESS.md
docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
file này
```

Không bắt đầu A5.5.2, NPP-F06 hoặc Order Core trước khi hoàn tất gate trên.
