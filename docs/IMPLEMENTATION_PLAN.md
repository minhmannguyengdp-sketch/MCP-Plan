# Implementation Plan - MCP-Plan

## Muc tieu

Xay dung MCP-Plan dua tren Supabase DB hien co, uu tien route/test/order dang co data that. Khong bat dau bang frontend dep mat khi backend contract va DB logic chua ro.

## Thu tu lam chuan

```text
DB audit -> Backend read API -> Frontend MVP -> DB extension rieng cho plan/action -> Security hardening -> AI planning/mindmap
```

## Phase 0 - Dong bo repo va tai lieu

Trang thai: repo moi, can bo sung tai lieu nen.

Viec can co:

- `README.md`
- `docs/DB_AUDIT.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/API_PLAN.md`
- `docs/DB_EXTENSION_PLAN.md`

Tieu chuan xong:

- Moi nguoi nhin repo la biet DB nao, table nao, module nao lam truoc.
- Co nguyen tac khong chap va.

## Phase 1 - Backend skeleton read-only

Uu tien backend truoc frontend.

Can lam:

- Tao app skeleton.
- Cau hinh Supabase client/server.
- Tach env:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` chi dung server, khong expose frontend.
- Tao module backend:
  - `routes`
  - `visits`
  - `tests`
  - `orders`
  - `dashboard`

Khong lam:

- Khong viet truc tiep query lung tung trong frontend.
- Khong dung service role trong browser.
- Khong them/sua schema khi chua co migration.

Tieu chuan xong:

- API doc co endpoint, input, output.
- API doc co query source tu table nao.
- Chay duoc dashboard summary bang data Supabase that.

## Phase 2 - API dashboard cot loi

Module phai lam truoc:

1. Dashboard overview
2. Route/session/visit
3. Test file/test result
4. Order/order item

KPI cot loi:

- So route active.
- So khach hang trong tuyen.
- So phien tuyen theo ngay.
- So visit, ty le visit/planned.
- So visit co order.
- So dot test active.
- So customer da test.
- So result pending/done/issue theo status.
- Doanh so theo ngay/sales/customer neu order data du.

Tieu chuan xong:

- API khong tra ve data raw qua lon.
- Co filter ngay, route, sales, area.
- Co guard null/empty state.

## Phase 3 - Frontend MVP

Frontend lam sau khi API co contract.

Man hinh toi thieu:

1. Dashboard tong quan
2. Tuyen ban hang
3. Khach hang theo tuyen
4. Lich su visit
5. Dot test/ket qua test
6. Don hang
7. MCP-Plan goi y hanh dong

Nguyen tac UI:

- Sidebar ro module.
- Filter ngay/route/sales/area nam tren dau.
- Bang du lieu co sort/search/pagination.
- Card KPI lay tu backend API, khong tinh lung tung tren frontend.
- Neu data rong thi hien thong bao dung nghiep vu, khong loi UI.

## Phase 4 - DB extension rieng cho MCP-Plan

Chi tao bang moi de luu plan/action, khong pha bang report goc.

Bang du kien:

- `mcp_plans`
- `mcp_plan_items`
- `mcp_action_logs`
- `mcp_plan_snapshots`
- `mcp_user_settings`

Muc dich:

- Luu ke hoach ngay/tuan/thang.
- Luu action goi y tu AI/logic.
- Luu trang thai xu ly: open, doing, done, cancelled.
- Luu snapshot KPI tai thoi diem tao plan.

Truoc khi migration:

- Viet SQL migration rieng.
- Check ten bang khong trung.
- Check RLS policy ro role.
- Co rollback note.

## Phase 5 - Security hardening

Can lam truoc khi mo cho nhieu nguoi dung that.

Van de hien co:

- Nhieu policy `anon insert/update` dang qua mo.
- Function `public.rls_auto_enable()` dang SECURITY DEFINER va public co the execute.
- Function `public.set_updated_at` can set search_path co dinh.

Huong sua dung logic:

- Frontend chi dung anon key cho read neu duoc phep.
- Write operation di qua backend hoac authenticated user co policy ro.
- Service role chi nam tren server.
- Rut execute public cho function nguy hiem.

Khong sua an toan bang cach tat RLS. RLS phai bat va policy phai dung.

## Phase 6 - AI planning/mindmap

Chi lam sau khi dashboard va data contract on dinh.

AI module dung de:

- Goi y tuyen can uu tien.
- Goi y khach hang can ghe lai.
- Phat hien test result bat thuong.
- Tao next action tu order/test/visit.
- Xuat mindmap/plan theo ngay/tuan.

AI khong duoc doc DB truc tiep lung tung. Backend phai cap context da loc va da gom nhom.

## Viec lam ngay tiep theo

1. Tao backend skeleton.
2. Tao Supabase server client.
3. Tao endpoint `GET /api/dashboard/summary`.
4. Tao endpoint `GET /api/routes`.
5. Tao endpoint `GET /api/routes/:id/customers`.
6. Tao endpoint `GET /api/visits`.
7. Tao endpoint `GET /api/tests`.
8. Tao endpoint `GET /api/orders`.
9. Sau khi API ok moi dung frontend build dashboard.
