# MCP Order end-to-end patch guide

GitHub connector is blocking direct writes to executable files right now, so apply this locally.

## Backend

File: `apps/backend/server.js`

Add `supabaseRpc`, `normalizeOrderItems`, and `createMcpSessionCustomerOrder` after `proxySupabaseFunction`.

```js
async function supabaseRpc(functionName, args = {}) {
  assertSupabaseConfig();
  const response = await fetch(new URL(`/rest/v1/rpc/${functionName}`, SUPABASE_URL), {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(args)
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "supabase_rpc_failed");
    error.statusCode = response.status || 502;
    error.detail = payload?.details || payload?.hint || payload?.raw || text;
    throw error;
  }
  return payload;
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest("order_items_required");
  return items.map((item) => {
    const productName = String(item.productName || item.product_name || "").trim();
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
    const discount = Number(item.discount || 0);
    if (!productName) throw badRequest("product_name_required");
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("quantity_required");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest("invalid_unit_price");
    return {
      productId: String(item.productId || item.product_id || "").trim() || null,
      productName,
      sku: String(item.sku || "").trim() || null,
      unit: String(item.unit || "").trim() || null,
      quantity,
      unitPrice,
      discount: Number.isFinite(discount) && discount > 0 ? discount : 0,
      note: String(item.note || "").trim() || null
    };
  });
}

async function createMcpSessionCustomerOrder(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  return supabaseRpc("mcp_create_order_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_items: normalizeOrderItems(body.items),
    p_note: String(body.note || "").trim() || null,
    p_status: String(body.status || "confirmed").trim() || "confirmed"
  });
}
```

Add this route in `handlePost` before `result`:

```js
if (url.pathname === "/api/mcp-day/session-customer/order") {
  return wrap(await createMcpSessionCustomerOrder(await readJsonBody(req)));
}
```

## UI

File: `src/features/mcp/McpSessionCompactView.tsx`

Add an order draft state, render inputs when `selection.action === "order"`, and submit to:

```ts
await postMcpBackend("/api/backend/mcp-day/session-customer/order", {
  sessionCustomerId,
  items,
  note: orderNote,
  status: "confirmed"
});
```

Do not use `/session-customer/result` for order form anymore.

## Build/deploy

```powershell
cd "F:\1_A_Disk_D\Tool\mcp-plan"
git pull origin main
npm run build
git add .
git commit -m "feat: add MCP order form flow"
git push origin main
```

VPS:

```bash
pullmcp
```
