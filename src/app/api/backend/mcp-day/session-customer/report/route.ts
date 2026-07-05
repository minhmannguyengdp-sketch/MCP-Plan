export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!key) throw new Error("missing_supabase_config");
  return { url, key };
}

function cleanItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isDict).map((item) => ({
    id: String(item.id || "").trim(),
    key: clean(item.key),
    label: clean(item.label),
    value: clean(item.value),
    groupKey: clean(item.groupKey),
    groupTitle: clean(item.groupTitle),
    category: clean(item.category),
    brandName: clean(item.brandName),
    productId: clean(item.productId)
  })).filter((item) => item.id);
}

function itemIds(items: Array<{ id: string }>) {
  return Array.from(new Set(items.map((item) => item.id)));
}

function linesFrom(fields: Dict, competitors: Array<{ id: string; label: string | null; value: string | null }>, usedProducts: Array<{ id: string; label: string | null; value: string | null; groupTitle: string | null }>) {
  const lines: string[] = [];
  if (competitors.length) lines.push(`Đối thủ: ${competitors.map((item) => item.label || item.value || item.id).join(", ")}`);
  const groups = usedProducts.reduce<Record<string, string[]>>((acc, item) => {
    const title = item.groupTitle || "SP đang dùng";
    acc[title] = [...(acc[title] || []), item.label || item.value || item.id];
    return acc;
  }, {});
  Object.entries(groups).forEach(([title, values]) => lines.push(`${title}: ${values.join(", ")}`));
  const labels: Record<string, string> = { priceSummary: "Giá", displaySummary: "Trưng bày", stockSummary: "Tồn kho", demandSummary: "Nhu cầu", opportunitySummary: "Cơ hội", riskSummary: "Rủi ro", nextAction: "Next action", note: "Ghi chú" };
  Object.entries(labels).forEach(([key, label]) => {
    const text = clean(fields[key]);
    if (text) lines.push(`${label}: ${text}`);
  });
  return lines.join("\n");
}

async function callRpc(args: Dict) {
  const env = getEnv();
  const response = await fetch(`${env.url}/rest/v1/rpc/mcp_create_report_from_session_customer`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionCustomerId = clean(body.sessionCustomerId || body.session_customer_id);
    if (!sessionCustomerId) throw new Error("session_customer_id_required");
    const fields = isDict(body.fields) ? body.fields : {};
    const selected = isDict(body.selected) ? body.selected : {};
    const competitors = cleanItems(selected.competitors);
    const usedProducts = cleanItems(selected.usedProducts);
    const explicitItems = cleanItems(selected.settingItems);
    const settingItems = explicitItems.length ? explicitItems : [...competitors, ...usedProducts];
    const content = clean(body.content) || linesFrom(fields, competitors, usedProducts);
    const rawPayload = { ...(isDict(body.rawPayload) ? body.rawPayload : {}), context: isDict(body.context) ? body.context : {}, fields, selected: { competitors, usedProducts, settingItems } };
    const data = await callRpc({
      p_session_customer_id: sessionCustomerId,
      p_report_type: clean(body.reportType) || "market_report",
      p_content: content,
      p_price_summary: clean(fields.priceSummary),
      p_competitor_summary: clean(fields.competitorSummary),
      p_display_summary: clean(fields.displaySummary),
      p_stock_summary: clean(fields.stockSummary),
      p_demand_summary: clean(fields.demandSummary),
      p_opportunity_summary: clean(fields.opportunitySummary),
      p_risk_summary: clean(fields.riskSummary),
      p_next_action: clean(fields.nextAction),
      p_note: clean(fields.note),
      p_raw_payload: rawPayload,
      p_selected_competitor_ids: itemIds(competitors),
      p_selected_used_product_ids: itemIds(usedProducts),
      p_selected_setting_item_ids: itemIds(settingItems)
    });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_save_failed" }, { status: 400 });
  }
}
