# A5.4.3 — Report Settings mutation ownership

> Cập nhật: **2026-07-16**  
> Trạng thái: **SOURCE / CI / SUPABASE VERIFIED — MERGE & VPS PENDING**  
> PR: **#23**  
> Audit đầu vào: `docs/npp-plan/A5_4_3_REPORT_SETTINGS_AUDIT.md`

## 1. Kết quả triển khai

A5.4.3 đã gom bốn mutation Report Settings về một application owner tại Foundation:

```text
POST  /api/mcp-report-setting-groups  -> create group
PATCH /api/mcp-report-setting-groups  -> update/toggle group
POST  /api/mcp-report-settings        -> create item
PATCH /api/mcp-report-settings        -> update/toggle item
```

Luồng đích:

```text
Browser
-> Next proxy
-> authenticated Foundation Gateway
-> report-setting use case
-> typed service-role-only RPC
-> PostgreSQL
```

GET `/api/mcp-report-settings` vẫn giữ read contract cũ trong legacy runtime; slice này chỉ thay mutation owner.

## 2. Source changes

Application owner mới:

```text
apps/backend/foundation/report-setting-mutations.js
```

Use cases:

```text
createReportSettingGroup
updateReportSettingGroup
createReportSettingItem
updateReportSettingItem
```

Foundation đã intercept đủ bốn write route. Direct PostgREST group writes đã bị xóa khỏi `transitional-api.js`. Legacy item create/update functions và hai write routes đã bị xóa khỏi `apps/backend/server.js`.

Không còn timestamp fallback cho key. Group/item key được chuẩn hóa deterministic từ payload. Validation gồm title/label, key, status, group type, sort order và metadata.

## 3. Database contract

Migration source:

```text
supabase/migrations/20260716213000_report_setting_mutations.sql
```

Production migration record:

```text
version: 20260716152911
name:    report_setting_mutations
```

RPCs:

```text
mcp_create_report_setting_group
mcp_update_report_setting_group
mcp_create_report_setting_item
mcp_update_report_setting_item
```

Mỗi RPC:

- dùng `SECURITY DEFINER` và `search_path=public`;
- chỉ cho `service_role` EXECUTE;
- `anon` và `authenticated` không có EXECUTE;
- lock group/item liên quan khi create/update;
- dùng unique constraints hiện có;
- fail khi row không tồn tại;
- merge `raw_payload` và lưu Foundation context;
- chuẩn hóa duplicate/not-found thành business error ổn định.

Production permission verification:

```text
function                                service_role  anon   authenticated
mcp_create_report_setting_group         true          false  false
mcp_update_report_setting_group         true          false  false
mcp_create_report_setting_item          true          false  false
mcp_update_report_setting_item          true          false  false
```

## 4. Scanner retirement

Retired fingerprints:

```text
6ae585a158e2fd800062fb45  direct group insert
500b241ecd80ff8d74047e27  direct group patch
ea3fdd0cec40084d8ba06c1f  legacy item insert
204c2501e1755878fd26bf36  legacy item patch
```

Result:

```text
direct REST mutation debt: 7 -> 3
unclassified:              0
forbidden:                 0
```

Ba findings còn lại thuộc A5.4.4:

```text
474001fbfa0d1de1ed003364  field-check update
f70d562b03f15f08cae868e8  field-check create
ffb1c503e59aa8fcf8f0344f  market-report create
```

## 5. Tests and CI

Foundation CI:

```text
run:        29510594019
run number: 158
result:     SUCCESS
```

Gates đã pass:

```text
runtime hardcode audit
scanner + retirement policy
production hygiene
backend Foundation build/tests
migration source/permission/locking/context tests
four Gateway interception tests
caller retirement regression tests
TypeScript typecheck
Next production build
```

## 6. Production DB smoke

Production smoke đã chạy đủ:

```text
create group: PASS
update group: PASS
create item:  PASS
update item:  PASS
Foundation context persisted: PASS
optional field clear: PASS
```

Cleanup đầu tiên trong cùng SQL statement trả `0` do statement snapshot không thấy row được function vừa tạo. Không bỏ qua kết quả này: record smoke sau đó được tìm chính xác và xóa bằng statement riêng.

Cleanup verification cuối:

```text
smoke group count: 0
smoke item count:  0
```

Không còn fixture smoke trong production.

## 7. Release state

```text
SOURCE:       VERIFIED
CI:           VERIFIED
SUPABASE:     APPLIED + VERIFIED
PR #23:       OPEN — READY TO MERGE
MAIN:         PENDING MERGE
LOCAL:        PENDING PULL AFTER MERGE
VPS:          PENDING PULL/DEPLOY AFTER MERGE
VERCEL PROD:  pending normal production deployment state
FULL RELEASE: PENDING
```

## 8. Bước tiếp theo bắt buộc

1. Merge PR #23 sau khi final CI vẫn xanh.
2. Local chạy `git pull origin main` ngay sau merge.
3. VPS chạy `pullmcp` ngay sau merge.
4. Kiểm tra PM2, backend logs và health `127.0.0.1:3001`.
5. Chạy authenticated Gateway smoke qua bốn write route với fixture có cleanup.
6. Cập nhật file này và `CURRENT_PROGRESS.md` bằng merge SHA, VPS evidence và trạng thái VERIFIED.
7. Chỉ sau đó mới bắt đầu A5.4.4.

Không đụng `milktea-backend` port `3002`.
