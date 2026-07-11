import { restRows } from "@/lib/export/supabase-rest";
import type { SessionReportSummary } from "@/lib/mcp/session-report";

type Row = Record<string, unknown>;

type OrderItem = SessionReportSummary["sections"]["orders"][number];
type TestItem = SessionReportSummary["sections"]["tests"][number];
type ObservationItem = SessionReportSummary["sections"]["observations"][number];
type FollowupItem = SessionReportSummary["sections"]["followups"][number];

export type SessionReportCustomerDetail = {
  id: string;
  routeId: string;
  routeCustomerId: string;
  customerId: string;
  customerName: string;
  phone: string;
  area: string;
  sortOrder: number;
  visitStatus: string;
  statusReason: string;
  note: string;
  orderId: string;
  testId: string;
  reportId: string;
  followupCount: number;
  orders: OrderItem[];
  tests: TestItem[];
  observations: ObservationItem[];
  followups: FollowupItem[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function byName<T extends { customerName: string }>(items: T[], customerName: string) {
  const name = text(customerName).toLocaleLowerCase("vi");
  return items.filter((item) => text(item.customerName).toLocaleLowerCase("vi") === name);
}

function linkedOrNamed<T extends { id: string; customerName: string }>(items: T[], linkedId: string, customerName: string) {
  const linked = linkedId ? items.filter((item) => text(item.id) === linkedId) : [];
  return linked.length ? linked : byName(items, customerName);
}

export async function buildSessionReportCustomerDetails(summary: SessionReportSummary): Promise<SessionReportCustomerDetail[]> {
  const rows = await restRows<Row>("mcp_session_customers", {
    select: "id,session_id,route_id,route_customer_id,customer_id,customer_name,phone,area,sort_order,visit_status,status_reason,order_id,test_id,report_id,followup_count,note,created_at,updated_at",
    order: "sort_order.asc,customer_name.asc",
    limit: 20000,
    filters: { session_id: summary.session.id }
  });

  return rows.map((row) => {
    const customerName = text(row.customer_name) || "Khách trong phiên";
    const orderId = text(row.order_id);
    const testId = text(row.test_id);
    const reportId = text(row.report_id);
    const orders = linkedOrNamed(summary.sections.orders, orderId, customerName);
    const tests = linkedOrNamed(summary.sections.tests, testId, customerName);
    const observations = linkedOrNamed(summary.sections.observations, reportId, customerName);
    const followups = byName(summary.sections.followups, customerName);

    return {
      id: text(row.id),
      routeId: text(row.route_id),
      routeCustomerId: text(row.route_customer_id),
      customerId: text(row.customer_id),
      customerName,
      phone: text(row.phone),
      area: text(row.area),
      sortOrder: num(row.sort_order),
      visitStatus: text(row.visit_status) || "pending",
      statusReason: text(row.status_reason),
      note: text(row.note),
      orderId,
      testId,
      reportId,
      followupCount: Math.max(num(row.followup_count), followups.length),
      orders,
      tests,
      observations,
      followups
    };
  });
}
