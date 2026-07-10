import { isObj, rpc, sessionCustomerAction, text, type Dict } from "../_shared";

export const dynamic = "force-dynamic";

function list(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(isObj)
        .map((item) => ({
          id: String(item.id || item.key || item.value || item.label || "").trim(),
          label: text(item.label),
          value: text(item.value),
          groupTitle: text(item.groupTitle),
          category: text(item.category),
          brandName: text(item.brandName),
          productId: text(item.productId)
        }))
        .filter((item) => item.id)
    : [];
}

function ids(items: Array<{ id: string }>) {
  return Array.from(new Set(items.map((item) => item.id)));
}

function fallbackContent(fields: Dict, competitors: Array<{ id: string; label: string | null; value: string | null }>, products: Array<{ id: string; label: string | null; value: string | null; groupTitle: string | null }>, context: Dict) {
  const parts: string[] = [];
  if (competitors.length) parts.push(`Đối thủ: ${competitors.map((item) => item.label || item.value || item.id).join(", ")}`);
  const byGroup = products.reduce<Record<string, string[]>>((acc, item) => {
    const title = item.groupTitle || "Thương hiệu/sản phẩm đang dùng";
    acc[title] = [...(acc[title] || []), item.label || item.value || item.id];
    return acc;
  }, {});
  Object.entries(byGroup).forEach(([title, values]) => parts.push(`${title}: ${values.join(", ")}`));
  ["priceSummary", "displaySummary", "stockSummary", "demandSummary", "opportunitySummary", "riskSummary", "nextAction", "note"].forEach((key) => {
    const value = text(fields[key]);
    if (value) parts.push(value);
  });
  return parts.join("\n") || `Báo cáo thị trường: ${text(context.customerName || context.customer_name) || "khách trong phiên"}`;
}

export async function POST(request: Request) {
  return sessionCustomerAction(request, async (body, sessionCustomerId) => {
    const fields = isObj(body.fields) ? body.fields : {};
    const selected = isObj(body.selected) ? body.selected : {};
    const context = isObj(body.context) ? body.context : {};
    const competitors = list(selected.competitors);
    const usedProducts = list(selected.usedProducts);
    const settingItems = list(selected.settingItems);
    const allItems = settingItems.length ? settingItems : [...competitors, ...usedProducts];
    const content = text(body.content) || fallbackContent(fields, competitors, usedProducts.length ? usedProducts : allItems, context);

    return rpc("mcp_create_report_from_session_customer", {
      p_session_customer_id: sessionCustomerId,
      p_report_type: text(body.reportType || body.report_type) || "general",
      p_content: content,
      p_price_summary: text(fields.priceSummary),
      p_competitor_summary: text(fields.competitorSummary),
      p_display_summary: text(fields.displaySummary),
      p_stock_summary: text(fields.stockSummary),
      p_demand_summary: text(fields.demandSummary),
      p_opportunity_summary: text(fields.opportunitySummary),
      p_risk_summary: text(fields.riskSummary),
      p_next_action: text(fields.nextAction),
      p_note: text(fields.note) || content,
      p_raw_payload: { context, fields, selected: { competitors, usedProducts, settingItems: allItems }, inputSessionCustomerId: text(body.sessionCustomerId || body.session_customer_id), resolvedSessionCustomerId: sessionCustomerId },
      p_selected_competitor_ids: ids(competitors),
      p_selected_used_product_ids: ids(usedProducts),
      p_selected_setting_item_ids: ids(allItems)
    });
  });
}
