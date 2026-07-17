# NPP-F05 — Repeatable Gateway runtime closure smoke

> Cập nhật: **2026-07-17**  
> Trạng thái source: **READY TO MERGE**  
> Production runtime: **PENDING `pullmcp` + smoke output**

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

### Session check-in

- tạo fixture route/customer/session qua Gateway;
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

Route fixture dùng prefix được guard:

```text
__MCP_V1_API_F05_RUNTIME__
```

Sau mọi nhánh PASS/FAIL, script gọi guarded smoke cleanup và yêu cầu:

```text
smokeCleanup=true
fixtureCleanup=PASS
```

Không dùng dữ liệu khách production hiện hữu và không để fixture nghiệp vụ.

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

```text
PR:           #27
Branch:       f05-runtime-smoke-closure
Head SHA:     6de1f41e45b68da014e934342264aec610062ce4
CI workflow:  Foundation F0.2
CI run:       #284
CI run ID:    29563539777
Conclusion:   success
```

CI PASS:

- runtime hardcode audit;
- scanner + retirement policy;
- production hygiene;
- direct DB mutation audit;
- deploy/frontend auth contracts;
- backend Foundation verify;
- runtime smoke syntax/contract tests;
- TypeScript;
- Next production build.

## 5. Expected output

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

## 6. Release gate

Không được đóng NPP-F05/A5.5.1 runtime trước khi có output thật từ VPS:

```text
pullmcp => F0.2_VPS_SMOKE=PASS
smoke-f05-runtime-closure => PASS
fixtureCleanup => PASS
```

Sau đó phải cập nhật:

```text
CURRENT_PROGRESS.md
docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
file này
```

Không bắt đầu A5.5.2, NPP-F06 hoặc Order Core trước khi hoàn tất gate trên.
