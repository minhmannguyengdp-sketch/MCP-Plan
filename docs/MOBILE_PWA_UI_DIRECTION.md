# Mobile PWA UI Direction

MCP-Plan uu tien mobile/PWA som de tranh lap lai loi UI web bi don va nat khi them module.

## Huong tham khao

Khong copy app nao, chi lay nguyen tac:

```text
Notion       = ro rang, card-based, it nhieu vien phu
Shopify POS  = thao tac nhanh, card lon, phu hop ban hang
Linear       = spacing gon, danh sach sach, trang thai ro
```

## Nguyen tac UI mobile

```text
1. Mobile first cho nghiep vu field sales
2. Bottom navigation thay sidebar tren man nho
3. Bang dai tren desktop phai thanh card tren mobile
4. KPI card 2 cot tren mobile
5. Touch target toi thieu khoang 44px
6. Filter chip scroll ngang, khong ep xuong qua nhieu dong
7. Noi dung quan trong nam tren dau man
```

## Da lam

```text
src/app/mobile.css
src/app/manifest.ts
src/app/layout.tsx
src/ui/shell/AppShell.tsx
src/ui/shell/navigation.ts
src/ui/table/DataTable.tsx
```

Thay doi:

```text
- an sidebar tren mobile
- them bottom nav fixed
- them short label va icon cho nav
- DataTable co desktop table + mobile card mode
- toi uu spacing, card, filter chip, KPI mobile
- them manifest cho PWA standalone
- them theme color va apple web app metadata
```

## Man can soi sau buoc nay

```text
/
/orders
/field-checks
/plans
/routes
/customers
/visits
```

## Buoc tiep theo

```text
1. Test tren mobile viewport
2. Chinh tung man neu card qua dai
3. Them app icon PNG day du kich thuoc
4. Them offline shell sau
```
