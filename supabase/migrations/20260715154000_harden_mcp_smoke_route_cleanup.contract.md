# Contract: guarded MCP smoke route cleanup

This migration extends `mcp_delete_route_hard(text)` only for canonical MCP API smoke routes.

A route is treated as a smoke fixture only when all conditions match:

```text
route_name regex: ^__MCP_V1_API_(FULL|SNAPSHOT_ONCE)__[0-9]{13}-[a-z0-9]{6}$
area: API Smoke
note: temporary MCP v1 API smoke
```

For those routes only, linked rows in orders, order items, market reports, test files/products/customers/results and session reports are removed before the MCP route graph is hard-deleted.

The function remains `security definer`, revokes execute from `public`, `anon`, and `authenticated`, and grants execute only to `service_role`.
