export const dynamic = "force-dynamic";

type Dict = Record<string, unknown>;
function isObj(v: unknown): v is Dict { return !!v && typeof v === "object" && !Array.isArray(v); }
function text(v: unknown) { const s = String(v ?? "").trim(); return s || null; }
function list(v: unknown) { return Array.isArray(v) ? v.filter(isObj).map((x) => ({ id: String(x.id || "").trim(), label: text(x.label), value: text(x.value), groupTitle: text(x.groupTitle), category: text(x.category), brandName: text(x.brandName), productId: text(x.productId) })).filter((x) => x.id) : []; }
function ids(v: Array<{ id: string }>) { return Array.from(new Set(v.map((x) => x.id))); }
function env() { const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, ""); const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim(); if (!url || !key) throw new Error("missing_supabase_config"); return { url, key }; }
function fallbackContent(fields: Dict, competitors: Array<{ id: string; label: string | null; value: string | null }>, products: Array<{ id: string; label: string | null; value: string | null; groupTitle: string | null }>) { const parts: string[] = []; if (competitors.length) parts.push(`Đối thủ: ${competitors.map((x) => x.label || x.value || x.id).join(", ")}`); const byGroup = products.reduce<Record<string, string[]>>((acc, x) => { const title = x.groupTitle || "Thương hiệu/sản phẩm đang dùng"; acc[title] = [...(acc[title] || []), x.label || x.value || x.id]; return acc; }, {}); Object.entries(byGroup).forEach(([title, values]) => parts.push(`${title}: ${values.join(", ")}`)); ["priceSummary", "displaySummary", "stockSummary", "demandSummary", "opportunitySummary", "riskSummary", "nextAction", "note"].forEach((k) => { const v = text(fields[k]); if (v) parts.push(v); }); return parts.join("\n"); }

async function callReportRpc(args: Dict) {
  const e = env();
  const res = await fetch(`${e.url}/rest/v1/rpc/mcp_create_report_from_session_customer`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: e.key, Authorization: `Bearer ${e.key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || payload.error || `supabase_${res.status}`);
  return payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionCustomerId = text(body.sessionCustomerId || body.session_customer_id);
    if (!sessionCustomerId) throw new Error("session_customer_id_required");
    const fields = isObj(body.fields) ? body.fields : {};
    const selected = isObj(body.selected) ? body.selected : {};
    const competitors = list(selected.competitors);
    const usedProducts = list(selected.usedProducts);
    const settingItems = list(selected.settingItems);
    const allItems = settingItems.length ? settingItems : [...competitors, ...usedProducts];
    const data = await callReportRpc({
      p_session_customer_id: sessionCustomerId,
      p_report_type: text(body.reportType) || "market_report",
      p_content: text(body.content) || fallbackContent(fields, competitors, usedProducts),
      p_price_summary: text(fields.priceSummary),
      p_competitor_summary: text(fields.competitorSummary),
      p_display_summary: text(fields.displaySummary),
      p_stock_summary: text(fields.stockSummary),
      p_demand_summary: text(fields.demandSummary),
      p_opportunity_summary: text(fields.opportunitySummary),
      p_risk_summary: text(fields.riskSummary),
      p_next_action: text(fields.nextAction),
      p_note: text(fields.note),
      p_raw_payload: { context: isObj(body.context) ? body.context : {}, fields, selected: { competitors, usedProducts, settingItems: allItems } },
      p_selected_competitor_ids: ids(competitors),
      p_selected_used_product_ids: ids(usedProducts),
      p_selected_setting_item_ids: ids(allItems)
    });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_save_failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
