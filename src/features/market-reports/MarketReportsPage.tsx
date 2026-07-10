import { restRows } from "@/lib/export/supabase-rest";
import type { MarketReportItem, MarketReportKpi, MarketReportStatus, MarketReportType } from "./market-reports.types";
import { MarketReportsClientPage } from "./MarketReportsClientPage";

type ReportRow = Record<string, string | number | boolean | null | Record<string, unknown>>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function rawValue(row: ReportRow, path: string) {
  const raw = row.raw_payload;
  if (!raw || typeof raw !== "object") return "";
  return path.split(".").reduce<unknown>((acc, key) => acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined, raw);
}

function rawText(row: ReportRow, path: string) {
  const value = rawValue(row, path);
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "object" && item ? text((item as Record<string, unknown>).label || (item as Record<string, unknown>).value || (item as Record<string, unknown>).id) : text(item))
      .filter(Boolean)
      .join(", ");
  }
  return text(value);
}

function reportType(row: ReportRow): MarketReportType {
  const value = text(row.market_type || rawValue(row, "reportType") || rawValue(row, "report_type")).toLowerCase();
  if (value.includes("competitor") || value.includes("doi-thu") || value.includes("đối")) return "competitor";
  if (value.includes("display") || value.includes("trung")) return "display";
  if (value.includes("stock") || value.includes("ton") || value.includes("tồn")) return "stock";
  return "price";
}

function status(row: ReportRow): MarketReportStatus {
  const explicit = text(row.status || rawValue(row, "status")).toLowerCase();
  if (explicit === "risk" || explicit === "opportunity" || explicit === "normal") return explicit;
  if (text(row.risk_summary)) return "risk";
  if (text(row.opportunity_summary) || text(row.next_action)) return "opportunity";
  return "normal";
}

function subject(row: ReportRow) {
  return text(row.opportunity_summary) || text(row.risk_summary) || text(row.next_action) || text(row.note) || text(row.competitor_summary) || "Báo cáo thị trường";
}

function note(row: ReportRow) {
  return [
    text(row.price_summary),
    text(row.competitor_summary),
    text(row.demand_summary),
    text(row.company_product_summary),
    text(row.note)
  ].filter(Boolean).join(" · ") || "Chưa có ghi chú";
}

function price(row: ReportRow) {
  const value = Number(rawValue(row, "fields.price") || rawValue(row, "price") || 0);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toItem(row: ReportRow): MarketReportItem {
  return {
    id: text(row.id),
    date: text(row.report_date).slice(0, 10),
    routeName: text(row.route_name) || "-",
    accountName: rawText(row, "context.customerName") || rawText(row, "context.customer_name") || "Báo cáo tổng",
    reportType: reportType(row),
    subject: subject(row),
    competitorName: rawText(row, "selected.competitors") || text(row.competitor_summary),
    price: price(row),
    note: note(row),
    nextAction: text(row.next_action) || "Theo dõi tiếp",
    status: status(row)
  };
}

function kpis(reports: MarketReportItem[]): MarketReportKpi[] {
  const opportunities = reports.filter((item) => item.status === "opportunity").length;
  const risks = reports.filter((item) => item.status === "risk").length;
  const routeCount = new Set(reports.map((item) => item.routeName).filter(Boolean)).size;
  return [
    { label: "Báo cáo", value: reports.length, hint: "Dữ liệu thật" },
    { label: "Cơ hội", value: opportunities, hint: "Có hướng khai thác" },
    { label: "Rủi ro", value: risks, hint: "Cần xử lý" },
    { label: "Tuyến", value: routeCount, hint: "Có phát sinh BC" }
  ];
}

export async function MarketReportsPage() {
  const rows = await restRows<ReportRow>("market_reports", {
    select: "id,report_date,sales,market_area,route_name,market_type,total_shops,competitor_summary,price_summary,demand_summary,company_product_summary,opportunity_summary,risk_summary,next_action,note,sync_status,raw_payload,created_at,updated_at,synced_at",
    order: "report_date.desc,updated_at.desc",
    limit: 500
  });
  const reports = rows.map(toItem);

  return <MarketReportsClientPage kpis={kpis(reports)} reports={reports} />;
}
