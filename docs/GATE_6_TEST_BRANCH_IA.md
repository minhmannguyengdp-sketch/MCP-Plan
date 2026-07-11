# Gate 6 - Test branch information architecture

Scope in this pass: items 1-2 only.

## Rule

Test is not a top-level operating module. Test belongs to the MCP session tree:

```text
Ngày
└─ Tuyến / Phiên MCP
   └─ Khách trong phiên
      └─ Test sản phẩm / kết quả test
```

## Implemented

1. Remove Test from main navigation

- `src/ui/shell/navigation.ts`
- Removed `/field-checks` from primary bottom navigation.
- Removed `Test sản phẩm` from sidebar navigation.
- Kept `/field-checks` route available as an admin/summary page, but no longer promoted as a main menu item.

2. Move Test wording under MCP today / session

- `src/app/mcp/page.tsx`
  - Clarifies that order, test, reports, and follow-up live inside the MCP session.
  - Clarifies that Test is not a standalone main menu module.

- `src/features/mcp/McpSessionsManagerSafe.tsx`
  - Session history cards now show branch summary per session:

```text
Nhánh trong phiên: x đơn · y test · z BC · n follow-up
```

## Not changed in this pass

- `/field-checks` route is not deleted.
- DB tables are not changed.
- Test save remains under `/visits -> khách -> Ghi test` through the existing backend session-customer action.

## Smoke checks

```text
/mcp
/routes
/visits?routeId=<routeId>&date=<yyyy-mm-dd>
/mcp/sessions
/field-checks
```

Expected:

```text
- Bottom nav has no Test item.
- Sidebar has no Test sản phẩm item.
- MCP copy explains Test is inside session.
- Session history card shows test count as a branch count.
- /field-checks still opens directly if needed, but is not main navigation.
```
