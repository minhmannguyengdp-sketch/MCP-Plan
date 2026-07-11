import { restRows } from "@/lib/export/supabase-rest";
import type { MarketReportItem, MarketReportKpi, MarketReportStatus } from "./market-reports.types";
import { MarketReportsClientPage } from "./MarketReportsClientPage";

type ReportRow = Record<string, unknown>;

type CountItem = { label?: string; count?: number };

type Sections = {
  competitors?: CountItem[];
  usedProducts?: CountItem[];
  opportunities?: string[];
  risks?: string[];
  nextActions?: string[];
  overview?: Record<string, number>;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sections(row: ReportRow): Sections {
  const value = row.sections;
  return value && typeof value === "object" ? value as Sections : {};
}

function firstLabel(items?: CountItem[]) {
  return Array.isArray(items) && items.length ? text(items[0]?.label) : "";
}

function labels(items?: CountItem[]) {
  return Array.isArray(items) ? items.map((item) => item.label ? `${item.label} (${item.count || 0})` : "").filter(Boolean).join(", ") : "";
}

function status(row: ReportRow): MarketReportStatus {
  const data = sections(row);
  if ((data.risks || []).length) return "risk";
  if ((data.opportunities || []).length || (data.nextActions || []).length) return "opportunity";
  return "normal";
}

function subject(row: ReportRow) {
  return `BC phiên · ${text(row.route_name) || "MCP"}`;
}

function note(row: ReportRow) {
  const data = sections(row);
  const overview = data.overview || {};
  return text(row.summary_text) || [
    `Khách ghé: ${num(overview.visited)}/${num(overview.planned)}`,
    `Quan sát: ${num(overview.observations)}`,
    labels(data.competitors) ? `Đối thủ: ${labels(data.competitors)}` : "",
    labels(data.usedProducts) ? `SP đang dùng: ${labels(data.usedProducts)}` : ""
  ].filter(Boolean).join(" · ");
}

function toItem(row: ReportRow): MarketReportItem {
  const data = sections(row);
  return {
    id: text(row.id),
    date: text(row.session_date || row.snapshot_at).slice(0, 10),
    routeName: text(row.route_name) || "-",
    accountName: `Phiên ${text(row.session_id).slice(0, 8)}`,
    reportType: "competitor",
    subject: subject(row),
    competitorName: firstLabel(data.competitors),
    note: note(row),
    nextAction: (data.nextActions || [])[0] || "Theo dõi phiên sau",
    status: status(row)
  };
}

function kpis(reports: MarketReportItem[], rows: ReportRow[]): MarketReportKpi[] {
  const opportunities = reports.filter((item) => item.status === "opportunity").length;
  const risks = reports.filter((item) => item.status === "risk").length;
  const routeCount = new Set(reports.map((item) => item.routeName).filter(Boolean)).size;
  const observations = rows.reduce((sum, row) => sum + num((sections(row).overview || {}).observations), 0);
  return [
    { label: "BC phiên", value: reports.length, hint: "Snapshot theo session" },
    { label: "Quan sát", value: observations, hint: "Gom từ khách trong phiên" },
    { label: "Cơ hội / Rủi ro", value: `${opportunities}/${risks}`, hint: "Theo snapshot" },
    { label: "Tuyến", value: routeCount, hint: "Có BC phiên" }
  ];
}

export async function MarketReportsPage() {
  const rows = await restRows<ReportRow>("mcp_session_reports", {
    select: "id,session_id,route_id,route_name,session_date,sales,status,kpis,overview,sections,summary_text,snapshot_source,snapshot_at,created_at,updated_at",
    order: "session_date.desc,snapshot_at.desc",
    limit: 500
  });
  const reports = rows.map(toItem);
  return <MarketReportsClientPage kpis={kpis(reports, rows)} reports={reports} />;
}
