export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

type OrderItemPayload = {
  productId?: string;
  variantId?: string;
  productName?: string;
  sku?: string | null;
  unit?: string | null;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  note?: string | null;
};

function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

function cleanItem(item: OrderItemPayload) {
  const productName = String(item.productName || "").trim();
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice ?? 0);
  const discount = Number(item.discount || 0);

  if (!productName) throw new Error("product_name_required");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("quantity_required");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("invalid_unit_price");
  if (!Number.isFinite(discount) || discount < 0) throw new Error("invalid_discount");

  return {
    productId: String(item.productId || "").trim() || null,
    variantId: String(item.variantId || "").trim() || null,
    productName,
    sku: String(item.sku || "").trim() || null,
    unit: String(item.unit || "").trim() || null,
    quantity,
    unitPrice,
    discount,
    note: String(item.note || "").trim() || null
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || "").trim();
    if (!sessionCustomerId) throw new Error("session_customer_id_required");

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) throw new Error("order_items_required");

    const data = await rpc("mcp_create_order_from_session_customer", {
      p_session_customer_id: sessionCustomerId,
      p_items: rawItems.map(cleanItem),
      p_note: String(body.note || "").trim() || null,
      p_status: String(body.status || "confirmed").trim() || "confirmed"
    });

    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_order_save_failed" }, { status: 400 });
  }
}
