import { restRows } from "@/lib/export/supabase-rest";

type Row = Record<string, unknown>;
export type CountItem = { label: string; count: number };
export type SessionReportSummary = {
  session: { id: string; routeId: string; routeName: string; sessionDate: string; sales: string; status: string; updatedAt: string };
  kpis: Array<{ label: string; value: string | number; hint: string }>;
  sections: {
    overview: { planned: number; visited: number; pending: number; skipped: number; observations: number; orders: number; tests: number; followups: number };
    competitors: CountItem[];
    usedProducts: CountItem[];
    opportunities: string[];
    risks: string[];
    nextActions: string[];
    observations: Array<{ id: string; customerName: string; competitors: string[]; usedProducts: string[]; note: string }>;
    orders: Array<{ id: string; code: string; customerName: string; status: string; total: number; note: string }>;
    tests: Array<{ id: string; customerName: string; productName: string; status: string; note: string }>;
    skipped: Array<{ id: string; customerName: string; reason: string }>;
  };
};

function cfg() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url, key };
}

function text(value: unknown) { return String(value ?? "").trim(); }
function num(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function uniq(values: string[]) { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))); }
function inFilter(values: string[]) { const ids = uniq(values); return ids.length ? `in.(${ids.join(",")})` : null; }
function raw(row: Row) { return row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {}; }
function selectedLabels(row: Row, key: "competitors" | "usedProducts") {
  const selected = raw(row).selected;
  if (!selected || typeof selected !== "object") return [] as string[];
  const items = (selected as Record<string, unknown>)[key];
  if (!Array.isArray(items)) return [] as string[];
  return items.map((item) => {
    if (!item || typeof item !== "object") return text(item);
    const data = item as Record<string, unknown>;
    return text(data.label || data.value || data.brandName || data.id);
  }).filter(Boolean);
}
function split(value: unknown) { return text(value).split(/[\n,;•]+/).map((item) => item.replace(/^[-–—\s]+/, "").trim()).filter(Boolean); }
function count(values: string[]): CountItem[] {
  const map = values.reduce<Record<string, number>>((acc, value) => { if (value) acc[value] = (acc[value] || 0) + 1; return acc; }, {});
  return Object.entries(map).map(([label, total]) => ({ label, count: total })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));
}
function byId(rows: Row[], key: string) {
  return rows.reduce<Record<string, Row>>((acc, row) => { const id = text(row[key]); if (id) acc[id] = row; return acc; }, {});
}

function summaryText(summary: SessionReportSummary) {
  const overview = summary.sections.overview;
  const competitors = summary.sections.competitors.slice(0, 5).map((item) => `${item.label} (${item.count})`).join(", ");
  const usedProducts = summary.sections.usedProducts.slice(0, 5).map((item) => `${item.label} (${item.count})`).join(", ");
  return [
    `BC phiên ${summary.session.routeName} - ${summary.session.sessionDate}`,
    `Khách: ${overview.visited}/${overview.planned} đã ghé, ${overview.skipped} bỏ qua`,
    `Đơn/Test/Quan sát/Follow-up: ${overview.orders}/${overview.tests}/${overview.observations}/${overview.followups}`,
    competitors ? `Đối thủ: ${competitors}` : "",
    usedProducts ? `SP đang dùng: ${usedProducts}` : "",
    summary.sections.opportunities.length ? `Cơ hội: ${summary.sections.opportunities.join("; ")}` : "",
    summary.sections.risks.length ? `Rủi ro: ${summary.sections.risks.join("; ")}` : "",
    summary.sections.nextActions.length ? `Next action: ${summary.sections.nextActions.join("; ")}` : ""
  ].filter(Boolean).join("\n");
}

export async function buildMcpSessionReportSummary(input: { sessionId?: string; routeId?: string; date?: string }): Promise<SessionReportSummary> {
  const sessionIdInput = text(input.sessionId);
  const routeId = text(input.routeId);
  const sessionDate = text(input.date).slice(0, 10);
  if (!sessionIdInput && (!routeId || !sessionDate)) throw new Error("session_id_or_route_date_required");
  const sessions = await restRows<Row>("mcp_route_sessions", { select: "id,route_id,route_name,session_date,sales,status,planned_customers,visited_customers,order_count,test_count,report_count,followup_count,updated_at", order: "session_date.desc,updated_at.desc", limit: 1, filters: sessionIdInput ? { id: sessionIdInput } : { route_id: routeId, session_date: sessionDate } });
  const session = sessions[0];
  if (!session?.id) throw new Error("session_not_found");
  const sessionId = text(session.id);
  const customers = await restRows<Row>("mcp_session_customers", { select: "id,session_id,route_id,customer_name,phone,area,sort_order,visit_status,status_reason,order_id,test_id,report_id,followup_count,note,created_at,updated_at", order: "sort_order.asc,customer_name.asc", limit: 20000, filters: { session_id: sessionId } });
  const reportIds = customers.map((item) => text(item.report_id)).filter(Boolean);
  const orderIds = customers.map((item) => text(item.order_id)).filter(Boolean);
  const testIds = customers.map((item) => text(item.test_id)).filter(Boolean);
  const [reports, orders, tests] = await Promise.all([
    reportIds.length ? restRows<Row>("market_reports", { select: "id,report_date,sales,market_area,route_name,market_type,competitor_summary,price_summary,demand_summary,company_product_summary,opportunity_summary,risk_summary,next_action,note,raw_payload,created_at,updated_at", order: "created_at.asc", limit: 20000, filters: { id: inFilter(reportIds) } }) : Promise.resolve([] as Row[]),
    orderIds.length ? restRows<Row>("orders", { select: "id,order_code,order_date,customer_name,status,grand_total,note,created_at,updated_at", order: "created_at.asc", limit: 20000, filters: { id: inFilter(orderIds) } }) : Promise.resolve([] as Row[]),
    testIds.length ? restRows<Row>("test_customer_results", { select: "id,product_name,status,note,created_at,updated_at", order: "created_at.asc", limit: 20000, filters: { id: inFilter(testIds) } }) : Promise.resolve([] as Row[])
  ]);
  const customersByReportId = byId(customers, "report_id");
  const customersByOrderId = byId(customers, "order_id");
  const customersByTestId = byId(customers, "test_id");
  const visited = customers.filter((item) => text(item.visit_status) === "visited").length;
  const skipped = customers.filter((item) => text(item.visit_status) === "skipped").length;
  const pending = customers.length - visited - skipped;
  const followups = customers.reduce((sum, item) => sum + num(item.followup_count), 0);
  const observations = reports.map((report) => ({ id: text(report.id), customerName: text(customersByReportId[text(report.id)]?.customer_name) || "Khách trong phiên", competitors: selectedLabels(report, "competitors"), usedProducts: selectedLabels(report, "usedProducts"), note: [text(report.competitor_summary), text(report.company_product_summary), text(report.price_summary), text(report.demand_summary), text(report.opportunity_summary), text(report.risk_summary), text(report.next_action), text(report.note)].filter(Boolean).join("\n") }));
  return {
    session: { id: sessionId, routeId: text(session.route_id), routeName: text(session.route_name), sessionDate: text(session.session_date).slice(0, 10), sales: text(session.sales), status: text(session.status), updatedAt: text(session.updated_at) },
    kpis: [
      { label: "Khách", value: customers.length, hint: `${visited} đã ghé · ${pending} chờ` },
      { label: "Quan sát", value: observations.length, hint: "Input cho BC phiên" },
      { label: "Đơn/Test", value: `${orders.length}/${tests.length}`, hint: "Trong phiên" },
      { label: "Follow-up", value: followups, hint: `${skipped} bỏ qua` }
    ],
    sections: {
      overview: { planned: num(session.planned_customers) || customers.length, visited, pending, skipped, observations: observations.length, orders: orders.length, tests: tests.length, followups },
      competitors: count([...reports.flatMap((row) => selectedLabels(row, "competitors")), ...reports.flatMap((row) => split(row.competitor_summary))]),
      usedProducts: count([...reports.flatMap((row) => selectedLabels(row, "usedProducts")), ...reports.flatMap((row) => split(row.company_product_summary))]),
      opportunities: uniq(reports.flatMap((row) => split(row.opportunity_summary))),
      risks: uniq(reports.flatMap((row) => split(row.risk_summary))),
      nextActions: uniq(reports.flatMap((row) => split(row.next_action))),
      observations,
      orders: orders.map((order) => ({ id: text(order.id), code: text(order.order_code) || text(order.id), customerName: text(customersByOrderId[text(order.id)]?.customer_name || order.customer_name), status: text(order.status), total: num(order.grand_total), note: text(order.note) })),
      tests: tests.map((test) => ({ id: text(test.id), customerName: text(customersByTestId[text(test.id)]?.customer_name), productName: text(test.product_name), status: text(test.status), note: text(test.note) })),
      skipped: customers.filter((item) => text(item.visit_status) === "skipped").map((item) => ({ id: text(item.id), customerName: text(item.customer_name), reason: text(item.status_reason) || text(item.note) }))
    }
  };
}

export async function saveMcpSessionReportSnapshot(sessionId: string, source = "close_session") {
  const summary = await buildMcpSessionReportSummary({ sessionId });
  const env = cfg();
  const body = { session_id: summary.session.id, route_id: summary.session.routeId || null, route_name: summary.session.routeName || null, session_date: summary.session.sessionDate || null, sales: summary.session.sales || null, status: "snapshot", snapshot_source: source, kpis: summary.kpis, overview: summary.sections.overview, sections: summary.sections, summary_text: summaryText(summary), raw_payload: { summary }, snapshot_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const response = await fetch(`${env.url}/rest/v1/mcp_session_reports?on_conflict=session_id&select=*`, { method: "POST", cache: "no-store", headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, Accept: "application/json", "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `session_report_snapshot_${response.status}`);
  return Array.isArray(payload) ? payload[0] : payload;
}

export function sessionReportSummaryText(summary: SessionReportSummary) { return summaryText(summary); }
