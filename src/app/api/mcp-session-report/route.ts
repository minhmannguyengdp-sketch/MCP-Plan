import { errorResponse, restRows } from "@/lib/export/supabase-rest";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inFilter(values: string[]) {
  const ids = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return ids.length ? `in.(${ids.join(",")})` : null;
}

function raw(row: Row) {
  return row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload as Record<string, unknown> : {};
}

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

function split(value: unknown) {
  return text(value).split(/[\n,;•]+/).map((item) => item.replace(/^[-–—\s]+/, "").trim()).filter(Boolean);
}

function count(values: string[]) {
  const map = values.reduce<Record<string, number>>((acc, value) => {
    if (value) acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(map).map(([label, total]) => ({ label, count: total })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));
}

function byId(rows: Row[], key: string) {
  return rows.reduce<Record<string, Row>>((acc, row) => {
    const id = text(row[key]);
    if (id) acc[id] = row;
    return acc;
  }, {});
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionIdInput = text(params.get("sessionId") || params.get("session_id"));
    const routeId = text(params.get("routeId") || params.get("route_id"));
    const sessionDate = text(params.get("date") || params.get("sessionDate") || params.get("session_date")).slice(0, 10);
    if (!sessionIdInput && (!routeId || !sessionDate)) throw new Error("session_id_or_route_date_required");

    const sessions = await restRows<Row>("mcp_route_sessions", {
      select: "id,route_id,route_name,session_date,sales,status,planned_customers,visited_customers,order_count,test_count,report_count,followup_count,updated_at",
      order: "session_date.desc,updated_at.desc",
      limit: 1,
      filters: sessionIdInput ? { id: sessionIdInput } : { route_id: routeId, session_date: sessionDate }
    });
    const session = sessions[0];
    if (!session?.id) throw new Error("session_not_found");
    const sessionId = text(session.id);

    const customers = await restRows<Row>("mcp_session_customers", {
      select: "id,session_id,route_id,customer_name,phone,area,sort_order,visit_status,status_reason,order_id,test_id,report_id,followup_count,note,created_at,updated_at",
      order: "sort_order.asc,customer_name.asc",
      limit: 20000,
      filters: { session_id: sessionId }
    });

    const reportIds = customers.map((item) => text(item.report_id)).filter(Boolean);
    const orderIds = customers.map((item) => text(item.order_id)).filter(Boolean);
    const testIds = customers.map((item) => text(item.test_id)).filter(Boolean);

    const [reports, orders, tests] = await Promise.all([
      reportIds.length ? restRows<Row>("market_reports", {
        select: "id,report_date,sales,market_area,route_name,market_type,competitor_summary,price_summary,demand_summary,company_product_summary,opportunity_summary,risk_summary,next_action,note,raw_payload,created_at,updated_at",
        order: "created_at.asc",
        limit: 20000,
        filters: { id: inFilter(reportIds) }
      }) : Promise.resolve([] as Row[]),
      orderIds.length ? restRows<Row>("orders", {
        select: "id,order_code,order_date,customer_name,status,grand_total,note,created_at,updated_at",
        order: "created_at.asc",
        limit: 20000,
        filters: { id: inFilter(orderIds) }
      }) : Promise.resolve([] as Row[]),
      testIds.length ? restRows<Row>("test_customer_results", {
        select: "id,product_name,status,note,created_at,updated_at",
        order: "created_at.asc",
        limit: 20000,
        filters: { id: inFilter(testIds) }
      }) : Promise.resolve([] as Row[])
    ]);

    const customersByReportId = byId(customers, "report_id");
    const customersByOrderId = byId(customers, "order_id");
    const customersByTestId = byId(customers, "test_id");

    const visited = customers.filter((item) => text(item.visit_status) === "visited").length;
    const skipped = customers.filter((item) => text(item.visit_status) === "skipped").length;
    const pending = customers.length - visited - skipped;
    const followups = customers.reduce((sum, item) => sum + num(item.followup_count), 0);

    const observations = reports.map((report) => ({
      id: text(report.id),
      customerName: text(customersByReportId[text(report.id)]?.customer_name) || "Khách trong phiên",
      competitors: selectedLabels(report, "competitors"),
      usedProducts: selectedLabels(report, "usedProducts"),
      note: [text(report.competitor_summary), text(report.company_product_summary), text(report.price_summary), text(report.demand_summary), text(report.opportunity_summary), text(report.risk_summary), text(report.next_action), text(report.note)].filter(Boolean).join("\n")
    }));

    const data = {
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
        opportunities: reports.flatMap((row) => split(row.opportunity_summary)),
        risks: reports.flatMap((row) => split(row.risk_summary)),
        nextActions: reports.flatMap((row) => split(row.next_action)),
        observations,
        orders: orders.map((order) => ({ id: text(order.id), code: text(order.order_code) || text(order.id), customerName: text(customersByOrderId[text(order.id)]?.customer_name || order.customer_name), status: text(order.status), total: num(order.grand_total), note: text(order.note) })),
        tests: tests.map((test) => ({ id: text(test.id), customerName: text(customersByTestId[text(test.id)]?.customer_name), productName: text(test.product_name), status: text(test.status), note: text(test.note) })),
        skipped: customers.filter((item) => text(item.visit_status) === "skipped").map((item) => ({ id: text(item.id), customerName: text(item.customer_name), reason: text(item.status_reason) || text(item.note) }))
      }
    };

    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
