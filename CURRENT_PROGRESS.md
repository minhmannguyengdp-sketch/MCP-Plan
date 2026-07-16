# MCP-Plan — Current Progress

> Đây là file handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-16**  
> Phase hiện tại: **A5.4.3 — Report Settings mutation ownership**

## Trạng thái hiện tại

### A5.4.2 — Session report write ownership

```text
SOURCE:          VERIFIED
CI:              VERIFIED
SUPABASE:        VERIFIED
VPS RUNTIME:     DEPLOYED + VERIFIED
VERCEL PROD:     PENDING — account build-rate-limit
FULL RELEASE:    PENDING
```

Evidence:

```text
docs/npp-plan/A5_4_2_SESSION_REPORT_OWNER.md
```

Mốc chính:

```text
PR:                       #22
merge commit:             92e56223570a956d7f272e21859ef75051bb5fdc
Vercel trigger commit:    3656a60858c950377657a01ca5dcd9eeaf991feb
Foundation CI:            29499830985
mutation debt:            10 -> 7
production migration:     20260716193000_save_session_report_ai_result.sql
```

VPS đã xác nhận:

```text
backend tests:            47/47 pass
PM2 mcp-plan-backend:     online, restart 0
Gateway:                  127.0.0.1:3001
legacy internal:          127.0.0.1:3102
milktea backend:          port 3002, process riêng, không đụng tới
Foundation smoke:         PASS
health canonical:         PASS
new backend error log:    0 bytes
```

Release gates còn lại của A5.4.2:

1. Authenticated production mutation smoke qua:

```text
POST /api/mcp-session-report
POST /api/mcp-session-report/ai-result
```

2. Xác nhận Vercel production đã deploy current main sau khi hết `build-rate-limit`.

Không ghi A5.4.2 là `FULLY RELEASED` trước khi hai gate trên được ghi nhận.

## A5.4.3 — Report Settings mutation ownership

### Audit

```text
AUDIT:            COMPLETE
IMPLEMENTATION:   NOT STARTED
CODE CHANGE:      NONE
MIGRATION:        NONE
SCANNER BASELINE: 7
TARGET:           7 -> 3
```

Evidence audit:

```text
docs/npp-plan/A5_4_3_REPORT_SETTINGS_AUDIT.md
```

Audit đã xác nhận đúng 4 mutation live:

```text
POST  /api/mcp-report-setting-groups  create group
PATCH /api/mcp-report-setting-groups  update/toggle group
POST  /api/mcp-report-settings        create item
PATCH /api/mcp-report-settings        update/toggle item
```

Caller live:

```text
src/app/mcp-setting/groups/page.tsx
src/features/mcp-settings/McpReportSettingsPage.tsx
```

Ownership hiện tại:

```text
group writes -> Foundation transitional handler -> direct PostgREST
item writes  -> Foundation Gateway passthrough -> legacy backend -> direct PostgREST
```

Bốn fingerprints phải retire:

```text
6ae585a158e2fd800062fb45  Foundation POST  mcp_setting_groups
500b241ecd80ff8d74047e27  Foundation PATCH mcp_setting_groups
ea3fdd0cec40084d8ba06c1f  legacy POST      mcp_setting_items
204c2501e1755878fd26bf36  legacy PATCH     mcp_setting_items
```

Production DB audit:

```text
mcp_setting_groups: 7 rows
mcp_setting_items:  52 rows
group_type/status:  market_report / active
orphan or blank-key rows: 0
UNIQUE group_key: present
UNIQUE (group_id,item_key): present
RLS: enabled
anon/authenticated: SELECT only
setting mutation RPC: none
```

### Bước tiếp theo chính xác

Implement A5.4.3 trên branch/PR riêng, không sửa chắp vá transport handler.

Bắt buộc:

1. Tạo Foundation application owner `report-setting-mutations.js`.
2. Gateway intercept đủ 4 route group/item.
3. Tạo 4 typed service-role-only RPC create/update group/item.
4. Dùng deterministic normalized key, không dùng `Date.now()` fallback.
5. Validate/lock group hoặc item, map not-found và duplicate thành canonical `404/409`.
6. Merge `raw_payload` và lưu requestId/actor/installation/NPP context.
7. Xóa direct group PostgREST khỏi transitional handler.
8. Xóa legacy item mutation owner và routes sau khi Foundation tests pass.
9. Thêm migration/use-case/Gateway/caller regression/permission tests.
10. Retire đúng 4 fingerprints; scanner debt phải `7 -> 3`.
11. Apply production migration, smoke có cleanup, deploy VPS và ghi evidence.
12. Cập nhật lại file này cùng evidence trước khi tuyên bố hoàn tất.

Không dùng generic direct-table settings endpoint. Không mở persisted idempotency/audit của A5.5 trong slice này.

## Sau A5.4.3

```text
A5.4.4  field-check + market-report writes: 3 -> 0
A5.5    persisted idempotency + append-only audit
```

**Chưa bắt đầu Order Core.**

## Quy tắc cập nhật tiến độ bắt buộc

Một phase/subphase chỉ được tuyên bố hoàn tất khi đã cập nhật repo với:

- trạng thái `AUDITED / IMPLEMENTED / MERGED / DEPLOYED / VERIFIED`;
- việc đã làm;
- test, CI và scanner trước/sau;
- migration và production smoke;
- commit SHA và PR;
- trạng thái Supabase, VPS và Vercel;
- blocker hoặc phần còn pending;
- bước tiếp theo chính xác cho chat mới.

Phải cập nhật đồng thời:

```text
CURRENT_PROGRESS.md
file evidence tương ứng trong docs/npp-plan/
```

Không chỉ ghi tiến độ trong chat. Không tuyên bố hoàn thành nếu thay đổi tiến độ chưa được commit lên `main`.

## Lệnh vận hành chuẩn

Local:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull origin main
npm run build
git add .
git commit -m "message"
git push origin main
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

Không sửa trực tiếp runtime `/var/www/mcp-plan-backend`. Không đụng `milktea-backend` port `3002`.