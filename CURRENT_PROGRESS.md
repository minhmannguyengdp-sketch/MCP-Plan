# MCP-Plan — Current Progress

> **File handoff bắt buộc cho chat mới. Đọc file này trước khi tiếp tục.**  
> Cập nhật gần nhất: **2026-07-17**  
> Master plan: **Phase A / NPP-F05 — audit consumer + khóa mutation trực tiếp**  
> Trạng thái: **SOURCE/CI/DB VERIFIED — PR #27 READY TO MERGE — VERCEL RATE-LIMIT + VPS RUNTIME PENDING**

## 1. Điểm tiếp tục duy nhất

```text
1. Merge PR #27 sau final docs CI.
2. Chờ/gỡ Vercel account build-rate-limit và deploy current main.
3. Xác nhận Vercel / và /mcp trả HTTP 200.
4. SSH VPS và chạy pullmcp.
5. Xác nhận F0.2_VPS_SMOKE=PASS.
6. Chạy smoke runtime chính thức:
   cd /var/www/mcp-plan-source
   node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
7. Chỉ khi JSON có F05_RUNTIME_CLOSURE_SMOKE=PASS mới đóng runtime gate.
8. Cập nhật CURRENT_PROGRESS.md + evidence release trên main.

KHÔNG bắt đầu A5.5.2.
KHÔNG bắt đầu NPP-F06.
KHÔNG bắt đầu Order Core.
KHÔNG đụng milktea-backend port 3002.
```

SSH:

```powershell
ssh -i "F:\1_A_Disk_D\khuong-binh\TK\DIGI-OCEAN\DO-backend-02\backend-DO-02" root@165.22.109.61
```

## 2. Master plan position

Active master plan:

```text
ke-hoach-app-van-hanh-npp.md
Phase A — Foundation portability
Current milestone: NPP-F05 / A5.5
```

Master plan bắt buộc hoàn thành F05 runtime trước khi mở:

```text
NPP-F06 — production DB vs migrations/functions/policies/grants
A5.5.2 — 21 legacy mutation route cases
Order Core / NPP-03
```

## 3. Session UI + manual sales check-in

```text
PR:                        #26 — MERGED
MERGE SHA:                 6c1a3b8e9d74489abb4d3a1409faeb812543a105
CI:                        PASS — Foundation F0.2 #271
SCANNER:                   debt 0 / unclassified 0 / forbidden 0
SUPABASE:                  APPLIED + VERIFIED
DB CHECK-IN SMOKE:         PASS
DB REPLAY:                 PASS
DB CONFLICT:               PASS
DB SECOND-CLICK UNDO:      PASS
BUSINESS RESTORE:          rollbackEqual=true
OUTLET GPS UNCHANGED:      true
VISIT STATUS UNCHANGED:    true
VERCEL PROD:               BLOCKED — ACCOUNT BUILD-RATE-LIMIT
VPS/GATEWAY:               PENDING
FULL RUNTIME RELEASE:      PENDING
```

UI đã merge:

- sáu nút hành động ở lưới `3 × 2`;
- trạng thái xử lý ở góc phải trên;
- check-in ô vuông bên phải, chỉ lấy GPS khi bấm;
- bấm lần hai bỏ check-in và không gọi GPS;
- popup tạo đơn giữ nguyên;
- popup Test / Quan sát / Theo dõi / Bỏ qua dùng variant compact.

Evidence:

```text
docs/npp-plan/SESSION_UI_CHECKIN_RELEASE.md
```

## 4. PR #27 — repeatable F05 runtime smoke

```text
PR:             #27 — OPEN / READY TO MERGE
BRANCH:         f05-runtime-smoke-closure
HEAD SHA:       6de1f41e45b68da014e934342264aec610062ce4
CI:             PASS — Foundation F0.2 #284
CI RUN ID:      29563539777
SCANNER:        PASS — không thêm baseline/exception
TYPECHECK:      PASS
NEXT BUILD:     PASS
```

Files:

```text
test/runtime/smoke-f05-runtime-closure.mjs
test/f05-runtime-smoke-script.test.mjs
package.json -> smoke:f05-runtime
```

Lý do đặt script trong `test/runtime`:

- script là operational verification tooling, không phải application consumer;
- script cần service-role read-only để xác minh audit/idempotency/GPS;
- `src`, `apps/backend`, `scripts` và runtime app không import script;
- scanner application boundary vẫn giữ sạch, không đăng ký ngoại lệ.

Smoke tự thực hiện:

```text
1. health/auth/canonical envelope
2. tạo route + khách + session tạm có smoke guard
3. check-in lần đầu => replayed=false
4. cùng key + cùng payload => replayed=true
5. cùng key + payload khác => 409 idempotency conflict
6. bấm lần hai => checkedIn=false, không gửi GPS
7. xác minh visit status không đổi
8. xác minh GPS điểm bán không đổi
9. xác minh audit succeeded/replayed/remove_checkin
10. xác minh idempotency record completed + attempt_count=2
11. chạy A5.5.1 result mutation execute/replay/conflict/audit
12. cleanup toàn bộ fixture bằng guarded route cleanup
```

Expected output:

```text
F05_RUNTIME_CLOSURE_SMOKE=PASS
fixtureCleanup=PASS
```

Evidence:

```text
docs/npp-plan/F05_RUNTIME_CLOSURE_SMOKE.md
```

## 5. A5.5.1 — persisted idempotency core

```text
PR:                       #25 — MERGED
MERGE SHA:                504c2e18453ad068fd2640a97d21154050602b81
CI:                       PASS — Foundation F0.2 #237
SUPABASE:                 APPLIED + VERIFIED
DB CORE SMOKE:            PASS
DB TYPED WRAPPER SMOKE:   PASS
BUSINESS RESTORE:         rollbackEqual=true
SCOPE COMPLETE:           9/30 mutation route cases
LEGACY REMAINING:         21 — NOT STARTED
VPS/GATEWAY REPLAY:       PENDING
FULL RELEASE:             PENDING
```

Evidence:

```text
docs/npp-plan/A5_5_IDEMPOTENCY_AUDIT.md
docs/npp-plan/A5_5_1_IDEMPOTENCY_RELEASE.md
```

## 6. Vercel blocker

Empty trigger commits đã được tạo trên `main`, mới nhất:

```text
285b0391f4032242b33c9abbfef9cfc82150e784
chore: trigger Vercel production deploy
```

GitHub/Vercel vẫn trả:

```text
context: Vercel
state:   failure
reason:  build-rate-limit
```

Không retry liên tục. Khi quota/build window mở lại, deploy current `main` và smoke `/` + `/mcp`.

## 7. VPS runtime

```text
source:             /var/www/mcp-plan-source
runtime:            /var/www/mcp-plan-backend
PM2:                mcp-plan-backend
Gateway:            127.0.0.1:3001
legacy internal:    127.0.0.1:3102
milktea-backend:    port 3002 — KHÔNG ĐỤNG
```

Deploy:

```bash
pullmcp
```

Runtime smoke sau deploy:

```bash
cd /var/www/mcp-plan-source
node --env-file=/var/www/mcp-plan-backend/.env test/runtime/smoke-f05-runtime-closure.mjs
```

Không được suy diễn VPS đã chạy source mới nếu chưa có output thực tế của `pullmcp`.

## 8. Local workstation sync

Sau khi PR #27 merge:

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull origin main
npm run build
```

Không commit/push nếu chỉ pull và build không tạo thay đổi source.

## 9. Quy tắc đóng F05

Chỉ đóng NPP-F05/A5.5.1 runtime khi có đủ:

```text
Vercel current main READY + / + /mcp HTTP 200
VPS pullmcp => F0.2_VPS_SMOKE=PASS
F05 runtime smoke => PASS
fixtureCleanup => PASS
Gateway replay/conflict/undo/audit => PASS
CURRENT_PROGRESS.md + evidence cập nhật trên main
```

Không chỉ ghi trạng thái trong chat.
