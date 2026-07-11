import { restRows } from "@/lib/export/supabase-rest";
import type { CountItem, MarketReportItem, MarketReportKpi, MarketReportStatus, SessionReportOverview, SessionReportSections } from "./market-reports.types";
import { MarketReportsClientPage } from "./MarketReportsClientPage";

type ReportRow = Record<string, unknown>;

type RawSections = Partial<SessionReportSections> & Record<string, unknown>;

const EMPTY_OVERVIEW: SessionReportOverview = {
  planned: 0,
  visited: 0,
  pending: 0,
  skipped: 0,
  observations: 0,
  orders: 0,
  tests: 0,
  followups: 0
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function countList(value: unknown): CountItem[] {
  return Array.isArray(value)
    ? value.map((item) => {
        const row = object(item);
        return { label: text(row.label), count: num(row.count) };
      }).filter((item) => item.label)
    : [];
}

function detailList<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.map((item) => object(item) as T) : [];
}

function rawSections(row: ReportRow): RawSections {
  const value = row.sections;
  return value && typeof value === "object" && !Array.isArray(value) ? value as RawSections : {};
}

function overview(row: ReportRow): SessionReportOverview {
  const fromRow = object(row.overview);
  const fromSections = object(rawSections(row).overview);
  const merged = { ...fromSections, ...fromRow };
  return {
    planned: num(merged.planned),
    visited: num(merged.visited),
    pending: num(merged.pending),
    skipped: num(merged.skipped),
    observations: num(merged.observations),
    orders: num(merged.orders),
    tests: num(merged.tests),
    followups: num(merged.followups)
  };
}

function sections(row: ReportRow): SessionReportSections {
  const data = rawSections(row);
  return {
    overview: overview(row),
    competitors: countList(data.competitors),
    usedProducts: countList(data.usedProducts),
    opportunities: stringList(data.opportunities),
    risks: stringList(data.risks),
    nextActions: stringList(data.nextActions),
    observations: detailList(data.observations),
    orders: detailList(data.orders),
    tests: detailList(data.tests),
    followups: detailList(data.followups),
    skipped: detailList(data.skipped),
    customers: detailList(data.customers)
  };
}

function firstLabel(items?: CountItem[]) {
  return Array.isArray(items) && items.length ? text(items[0]?.label) : "";
}

function labels(items?: CountItem[]) {
  return Array.isArray(items) ? items.map((item) => item.label ? `${item.label} (${item.count || 0})` : "").filter(Boolean).join(", ") : "";
}

function status(row: ReportRow): MarketReportStatus {
  const data = sections(row);
  const ov = data.overview;
  const visitRate = ov.planned > 0 ? ov.visited / ov.planned : 0;
  if (data.risks.length || (ov.planned > 0 && visitRate < 0.35)) return "risk";
  if (data.opportunities.length || data.nextActions.length || ov.orders > 0 || ov.tests > 0) return "opportunity";
  return "normal";
}

function subject(row: ReportRow) {
  return `BC phiên · ${text(row.route_name) || "MCP"}`;
}

function nextAction(row: ReportRow) {
  const data = sections(row);
  const ov = data.overview;
  if (data.nextActions.length) return data.nextActions[0];
  if (ov.tests > 0 && ov.followups === 0) return "Tạo follow-up cho khách đã test";
  if (ov.planned > 0 && ov.visited < ov.planned) return "Kiểm tra lý do khách chưa ghé";
  return "Theo dõi phiên sau";
}

function note(row: ReportRow) {
  const data = sections(row);
  const ov = data.overview;
  return text(row.summary_text) || [
    `Khách: ${ov.visited}/${ov.planned} đã ghé`,
    `Đơn/Test/Quan sát/Follow-up: ${ov.orders}/${ov.tests}/${ov.observations}/${ov.followups}`,
    labels(data.competitors) ? `Đối thủ: ${labels(data.competitors)}` : "",
    labels(data.usedProducts) ? `SP đang dùng: ${labels(data.usedProducts)}` : ""
  ].filter(Boolean).join(" · ");
}

function toItem(row: ReportRow): MarketReportItem {
  const data = sections(row);
  return {
    id: text(row.id),
    sessionId: text(row.session_id),
    routeId: text(row.route_id),
    date: text(row.session_date || row.snapshot_at).slice(0, 10),
    routeName: text(row.route_name) || "-",
    sales: text(row.sales),
    accountName: `Phiên ${text(row.session_id).slice(0, 8)}`,
    reportType: "competitor",
    subject: subject(row),
    competitorName: firstLabel(data.competitors),
    note: note(row),
    nextAction: nextAction(row),
    status: status(row),
    snapshotSource: text(row.snapshot_source),
    snapshotAt: text(row.snapshot_at),
    overview: data.overview,
    sections: data
  };
}

function kpis(reports: MarketReportItem[]): MarketReportKpi[] {
  const opportunities = reports.filter((item) => item.status === "opportunity").length;
  const risks = reports.filter((item) => item.status === "risk").length;
  const routeCount = new Set(reports.map((item) => item.routeName).filter(Boolean)).size;
  const observations = reports.reduce((sum, row) => sum + row.overview.observations, 0);
  return [
    { label: "BC phiên", value: reports.length, hint: "Theo phiên đã chốt" },
    { label: "Quan sát", value: observations, hint: "Gom từ khách trong phiên" },
    { label: "Cơ hội / Rủi ro", value: `${opportunities}/${risks}`, hint: "Theo BC đã chốt" },
    { label: "Tuyến", value: routeCount, hint: "Có BC phiên" }
  ];
}

export async function MarketReportsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const rows = await restRows<ReportRow>("mcp_session_reports", {
    select: "id,session_id,route_id,route_name,session_date,sales,status,kpis,overview,sections,summary_text,snapshot_source,snapshot_at,created_at,updated_at",
    order: "session_date.desc,snapshot_at.desc",
    limit: 500
  });
  const reports = rows.map(toItem);
  const focusSessionId = text(searchParams?.sessionId || searchParams?.session_id || "");
  return <MarketReportsClientPage kpis={kpis(reports)} reports={reports} focusSessionId={focusSessionId} />;
}