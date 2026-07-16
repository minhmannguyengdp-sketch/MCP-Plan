# MCP-Plan — Current Progress

> Đây là file handoff bắt buộc cho chat mới.  
> Cập nhật gần nhất: **2026-07-16**  
> Phase hiện tại: **A5.4 — retire direct database mutation owners**

## Trạng thái hiện tại

### A5.4.2 — Session report write ownership

Trạng thái:

```text
SOURCE:          VERIFIED
CI:              VERIFIED
SUPABASE:        VERIFIED
VPS RUNTIME:     DEPLOYED + VERIFIED
VERCEL PROD:     PENDING — account build-rate-limit
FULL RELEASE:    PENDING
```

Chi tiết evidence:

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

## Release gates còn lại của A5.4.2

1. Chạy và ghi nhận authenticated production mutation smoke qua hai route:

```text
POST /api/mcp-session-report
POST /api/mcp-session-report/ai-result
```

Smoke phải dùng dữ liệu an toàn, restore giá trị cũ hoặc dọn sạch record test. Không ghi token/secret vào evidence.

2. Xác nhận Vercel production đã deploy commit hiện tại sau khi hết `build-rate-limit`.

Không ghi A5.4.2 là `FULLY RELEASED` trước khi hai gate trên được ghi nhận.

## Công việc tiếp theo

### A5.4.3 — Report Settings mutation ownership

Bắt đầu bằng **audit only**, chưa sửa code ngay.

Audit phải xác định:

1. toàn bộ caller ghi Report Settings trực tiếp từ frontend hoặc legacy backend;
2. file, function, route, table, RPC và loại mutation;
3. caller live, caller chết và duplicate owner;
4. route Foundation Gateway hiện đã intercept;
5. chính xác 4 legacy fingerprints cần retire;
6. boundary backend/RPC đúng logic;
7. kế hoạch test, migration, rollout và rollback.

Mục tiêu implementation sau audit:

```text
direct mutation debt: 7 -> 3
```

Sau A5.4.3:

```text
A5.4.4  field-check + market-report writes: 3 -> 0
A5.5    persisted idempotency + audit
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