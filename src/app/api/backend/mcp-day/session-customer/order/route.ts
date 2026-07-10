import { sessionCustomerAction, rpc } from "../_shared";

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

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return sessionCustomerAction(request, async (body, sessionCustomerId) => {
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) throw new Error("order_items_required");
    return rpc("mcp_create_order_from_session_customer", {
      p_session_customer_id: sessionCustomerId,
      p_items: rawItems.map((item) => cleanItem(item as OrderItemPayload)),
      p_note: String(body.note || "").trim() || null,
      p_status: String(body.status || "confirmed").trim() || "confirmed"
    });
  });
}
