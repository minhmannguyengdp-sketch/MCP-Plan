# MCP-Plan — Current Progress

> File handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-16**  
> Phase hiện tại: **A5.4.3 — Report Settings mutation ownership**

## 1. A5.4.2 — Session report write ownership

```text
SOURCE:       VERIFIED
CI:           VERIFIED
SUPABASE:     VERIFIED
VPS:          DEPLOYED + VERIFIED
VERCEL PROD:  PENDING — account build-rate-limit
FULL RELEASE: PENDING
```

Evidence:

```text
docs/npp-plan/A5_4_2_SESSION_REPORT_OWNER.md
```

Mốc:

```text
PR:                    #22
merge commit:          92e56223570a956d7f272e21859ef75051bb5fdc
Vercel trigger commit: 3656a60858c950377657a01ca5dcd9eeaf991feb
Foundation CI:         29499830985
mutation debt:         10 -> 7
```

Release gates còn lại: authenticated production mutation smoke cho snapshot/AI-result và Vercel production deploy hiện tại.

## 2. A5.4.3 — Report Settings mutation ownership

### Trạng thái

```text
AUDIT:        COMPLETE
SOURCE:       VERIFIED
CI:           VERIFIED
SUPABASE:     APPLIED + VERIFIED
PR:           #23 — READY TO MERGE
MAIN:         PENDING MERGE
LOCAL:        PENDING PULL AFTER MERGE
VPS:          PENDING PULL/DEPLOY AFTER MERGE
GATEWAY SMOKE:PENDING AFTER VPS DEPLOY
FULL RELEASE: PENDING
```

Evidence:

```text
docs/npp-plan/A5_4_3_REPORT_SETTINGS_AUDIT.md
docs/npp-plan/A5_4_3_REPORT_SETTINGS_OWNER.md
```

### Implementation

Foundation hiện là owner duy nhất của bốn write route:

```text
POST  /api/mcp-report-setting-groups
PATCH /api/mcp-report-setting-groups
POST  /api/mcp-report-settings
PATCH /api/mcp-report-settings
```

Application owner:

```text
apps/backend/foundation/report-setting-mutations.js
```

RPC production:

```text
mcp_create_report_setting_group
mcp_update_report_setting_group
mcp_create_report_setting_item
mcp_update_report_setting_item
```

Direct group PostgREST đã bị xóa khỏi transitional handler. Legacy item create/update owner và routes đã bị xóa. GET read contract vẫn giữ nguyên.

### CI và scanner

```text
PR:                   #23
Foundation CI run:    29510594019
CI result:            SUCCESS
mutation debt:        7 -> 3
unclassified:         0
forbidden:            0
```

Đã pass:

```text
backend build/tests
migration contract/permission tests
four Gateway interception tests
caller retirement regression tests
runtime config and production hygiene gates
TypeScript typecheck
Next production build
```

### Supabase production

```text
migration version: 20260716152911
migration name:    report_setting_mutations
service_role:      EXECUTE true for all 4 RPCs
anon:              EXECUTE false
authenticated:     EXECUTE false
search_path:       public
```

Production DB smoke:

```text
create group: PASS
update group: PASS
create item:  PASS
update item:  PASS
context write: PASS
cleanup final: group 0 / item 0
```

### Retired fingerprints

```text
6ae585a158e2fd800062fb45
500b241ecd80ff8d74047e27
ea3fdd0cec40084d8ba06c1f
204c2501e1755878fd26bf36
```

### Việc phải làm ngay sau merge

1. Local pull `main`.
2. VPS chạy `pullmcp` ngay vì backend runtime thay đổi.
3. Kiểm tra PM2, logs, Gateway `3001`, legacy internal `3102` và health.
4. Không đụng `milktea-backend` port `3002`.
5. Chạy authenticated Gateway smoke đủ bốn Report Settings write route với cleanup.
6. Cập nhật merge SHA, VPS evidence và trạng thái VERIFIED vào file này cùng evidence A5.4.3.
7. Chỉ sau khi gate trên đạt mới bắt đầu A5.4.4.

## 3. Sau A5.4.3

```text
A5.4.4  field-check + market-report writes: 3 -> 0
A5.5    persisted idempotency + append-only audit
```

**Chưa bắt đầu Order Core.**

## 4. Quy tắc tiến độ bắt buộc

Một phase/subphase chỉ được tuyên bố hoàn tất khi repo đã ghi:

- trạng thái `AUDITED / IMPLEMENTED / MERGED / DEPLOYED / VERIFIED`;
- test, CI và scanner;
- migration và production smoke;
- commit SHA và PR;
- Supabase, VPS và Vercel;
- blocker và bước tiếp theo.

Phải cập nhật đồng thời:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi trong chat.

## 5. Lệnh vận hành

Local:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull origin main
npm run build
```

VPS:

```powershell
ssh -i "F:\1_A_Disk_D\khuong-binh\TK\DIGI-OCEAN\DO-backend-02\backend-DO-02" root@165.22.109.61
```

Sau khi vào VPS:

```bash
pullmcp
pm2 status
pm2 logs mcp-plan-backend --lines 100 --nostream
curl -fsS http://127.0.0.1:3001/api/health
```

Không sửa trực tiếp `/var/www/mcp-plan-backend`. Không đụng process/cổng `3002` của Milktea.
