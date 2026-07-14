import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resolve = (file) => path.join(root, file);
const read = (file) => fs.readFileSync(resolve(file), "utf8");
const write = (file, content) => {
  fs.mkdirSync(path.dirname(resolve(file)), { recursive: true });
  fs.writeFileSync(resolve(file), content.replace(/^\uFEFF/, ""), "utf8");
};

function replaceMany(file, replacements) {
  let content = read(file);
  for (const [from, to] of replacements) {
    if (typeof from === "string") {
      if (!content.includes(from)) throw new Error(`${file}: missing target: ${from.slice(0, 100)}`);
      content = content.split(from).join(to);
    } else {
      if (!from.test(content)) throw new Error(`${file}: missing regex target: ${from}`);
      content = content.replace(from, to);
    }
  }
  write(file, content);
}

write("src/lib/ui/business-text.ts", `const REPLACEMENTS: Array<[RegExp, string]> = [
  [/route master\\/report sync/gi, "Đồng bộ từ tuyến và báo cáo"],
  [/route master/gi, "dữ liệu tuyến"],
  [/report sync/gi, "đồng bộ báo cáo"],
  [/opened by backend api/gi, "Phiên được mở từ hệ thống"],
  [/supabase live/gi, "Đang cập nhật"],
  [/customer_details/gi, "chi tiết điểm bán"],
  [/\\bBC phiên\\b/gi, "Báo cáo phiên"],
  [/\\bBC\\b/g, "Báo cáo"],
  [/\\bsnapshot\\b/gi, "báo cáo"],
  [/follow[- ]?up/gi, "việc theo dõi"],
  [/\\btest sản phẩm\\b/gi, "thử sản phẩm"],
  [/\\btesst\\b/gi, "thử"],
  [/\\btest\\b/gi, "thử sản phẩm"],
  [/\\bhealth\\b/gi, "mức đánh giá"],
  [/\\bactive\\b/gi, "đang hoạt động"],
  [/\\blive\\b/gi, "đang cập nhật"],
  [/\\bapi\\b/gi, "hệ thống"]
];

export function businessText(value: unknown, fallback = "") {
  let output = String(value ?? "").trim();
  if (!output) return fallback;
  for (const [pattern, replacement] of REPLACEMENTS) output = output.replace(pattern, replacement);
  return output.replace(/\\s{2,}/g, " ").trim();
}

export function businessOwner(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw || /^(sale|sales)$/i.test(raw)) return "Chưa phân công";
  return businessText(raw);
}

export function isTechnicalSourceText(value: unknown) {
  return /(supabase|backend|database|\\bdb\\b|nguồn dữ liệu|data source|source:|\\bapi\\b)/i.test(String(value ?? ""));
}
`);

replaceMany("src/ui/layout/FilterBar.tsx", [
  ['title = "Bo loc nhanh"', 'title = "Bộ lọc nhanh"']
]);

replaceMany("src/features/dashboard/DashboardPage.tsx", [
  ['import { SourceBadge } from "@/ui/status/SourceBadge";', 'import { SourceBadge } from "@/ui/status/SourceBadge";\nimport { businessOwner, businessText, isTechnicalSourceText } from "@/lib/ui/business-text";'],
  ['<h3>{action.title}</h3>\n        <p>{action.description}</p>', '<h3>{businessText(action.title)}</h3>\n        <p>{businessText(action.description)}</p>'],
  ['<strong>{action.owner}</strong>', '<strong>{businessOwner(action.owner)}</strong>'],
  ['title: dashboard.actions[0]?.title || "Không có việc khẩn cấp",', 'title: businessText(dashboard.actions[0]?.title, "Không có việc khẩn cấp"),'],
  ['description: dashboard.actions[0]?.description || "Chưa có cảnh báo vận hành nổi bật từ dữ liệu hiện tại.",', 'description: businessText(dashboard.actions[0]?.description, "Chưa có cảnh báo vận hành nổi bật từ dữ liệu hiện tại."),'],
  ['text(latestSession.sales) || "Chưa phân công"', 'businessOwner(latestSession.sales)'],
  ['cta: "Xem test"', 'cta: "Xem kết quả thử"'],
  ['subtitle="Nhìn nhanh phiên MCP, Báo cáo mới nhất, việc cần xử lý và sức khỏe tuyến — tập trung vào tình hình kinh doanh và công việc cần xử lý."', 'subtitle="Nhìn nhanh phiên MCP, báo cáo mới nhất, việc cần xử lý và tình hình tuyến bán hàng."'],
  ['<CompactKpiStrip items={dashboard.kpis.map((item) => ({ label: item.label, value: item.value, hint: item.trend }))} />', '<CompactKpiStrip items={dashboard.kpis.map((item) => ({ label: businessText(item.label), value: item.value, hint: businessText(item.trend) }))} />'],
  ['<div className="empty-inline">Chưa có cảnh báo nổi bật từ phiên, BC và tuyến hiện tại.</div>', '<div className="empty-inline">Chưa có cảnh báo nổi bật từ phiên, báo cáo và tuyến hiện tại.</div>'],
  ['{dashboard.insights.map((item) => (\n          <div className="metric-row" key={item.label}>\n            <span>{item.label}</span>\n            <strong>{item.value}</strong>\n          </div>\n        ))}', '{dashboard.insights.filter((item) => !isTechnicalSourceText(`${item.label} ${item.value}`)).map((item) => (\n          <div className="metric-row" key={item.label}>\n            <span>{businessText(item.label)}</span>\n            <strong>{businessText(item.value)}</strong>\n          </div>\n        ))}']
]);

replaceMany("src/features/market-reports/MarketReportsPage.tsx", [
  ['import { MarketReportsClientPage } from "./MarketReportsClientPage";', 'import { MarketReportsClientPage } from "./MarketReportsClientPage";\nimport { businessOwner, businessText } from "@/lib/ui/business-text";'],
  ['return Array.isArray(value) ? value.map(text).filter(Boolean) : [];', 'return Array.isArray(value) ? value.map((item) => businessText(item)).filter(Boolean) : [];'],
  ['return { label: text(row.label), count: num(row.count) };', 'return { label: businessText(row.label), count: num(row.count) };'],
  ['summary: text(data.summary),', 'summary: businessText(data.summary),'],
  ['function recommendedActions(row: ReportRow): SessionReportRecommendedAction[] {\n  return detailList<SessionReportRecommendedAction>(row.recommended_actions);\n}', 'function recommendedActions(row: ReportRow): SessionReportRecommendedAction[] {\n  return detailList<SessionReportRecommendedAction>(row.recommended_actions).map((item) => ({\n    ...item,\n    customerName: businessText(item.customerName),\n    action: businessText(item.action),\n    reason: businessText(item.reason)\n  }));\n}'],
  ['sales: text(row.sales),', 'sales: businessOwner(row.sales),'],
  ['accountName: `Phiên ${text(row.session_id).slice(0, 8)}`,', 'accountName: businessOwner(row.sales),'],
  ['subject: `BC phiên · ${text(row.route_name) || "MCP"}`,', 'subject: `Báo cáo phiên · ${text(row.route_name) || "MCP"}`,'],
  ['note: storedInsights.summary || text(row.summary_text) || "Snapshot chưa có nhận định.",', 'note: storedInsights.summary || businessText(row.summary_text) || "Báo cáo chưa có nhận định."'],
  ['nextAction: text(firstAction?.action) || "Theo dõi phiên sau",', 'nextAction: businessText(firstAction?.action, "Theo dõi phiên sau"),'],
  ['{ label: "BC phiên", value: reports.length, hint: "Theo snapshot đã chốt" },\n    { label: "Tốt / Rủi ro", value: `${good}/${risks}`, hint: "Đọc từ health đã lưu" },\n    { label: "Đủ khách", value: `${complete}/${reports.length}`, hint: "customer_details hoàn chỉnh" },\n    { label: "Tuyến", value: routeCount, hint: "Có BC phiên" }', '{ label: "Báo cáo phiên", value: reports.length, hint: "Các phiên đã chốt" },\n    { label: "Tốt / Cần xử lý", value: `${good}/${risks}`, hint: "Theo mức đánh giá đã lưu" },\n    { label: "Đủ điểm bán", value: `${complete}/${reports.length}`, hint: "Có đầy đủ chi tiết điểm bán" },\n    { label: "Tuyến", value: routeCount, hint: "Có báo cáo phiên" }']
]);

replaceMany("src/features/market-reports/MarketReportsClientPage.tsx", [
  ['import { userFacingError } from "@/lib/ui/user-facing-error";', 'import { userFacingError } from "@/lib/ui/user-facing-error";\nimport { businessText } from "@/lib/ui/business-text";'],
  ['return Array.isArray(value) ? value.map(text).filter(Boolean) : [];', 'return Array.isArray(value) ? value.map((item) => businessText(item)).filter(Boolean) : [];'],
  ['summary: text(row.summary),', 'summary: businessText(row.summary),'],
  ['product_insights: objectList<AgentProductInsight>(row.product_insights),', 'product_insights: objectList<AgentProductInsight>(row.product_insights).map((item) => ({ ...item, status: businessText(item.status), insight: businessText(item.insight) })),'],
  ['customer_actions: objectList<AgentCustomerAction>(row.customer_actions),', 'customer_actions: objectList<AgentCustomerAction>(row.customer_actions).map((item) => ({ ...item, priority: businessText(item.priority), action: businessText(item.action), reason: businessText(item.reason) })),'],
  ['order_opportunities: objectList<AgentOrderOpportunity>(row.order_opportunities),', 'order_opportunities: objectList<AgentOrderOpportunity>(row.order_opportunities).map((item) => ({ ...item, confidence: businessText(item.confidence), reason: businessText(item.reason) })),'],
  ['leading={<span>BC</span>}', 'leading={<span>▣</span>}'],
  ['title={report.subject}', 'title={businessText(report.subject)}'],
  ['meta={[`Độ phủ ${pct(ov.visited, ov.planned)}`, `${report.sections.customers?.length || 0}/${ov.planned} khách chi tiết`, report.nextAction]}', 'meta={[`Độ phủ ${pct(ov.visited, ov.planned)}`, `${report.sections.customers?.length || 0}/${ov.planned} điểm bán có chi tiết`, businessText(report.nextAction)]}'],
  ['<div><span>Đánh giá snapshot</span><strong>{report.health} · {report.score}/100</strong><p>{report.insights.summary || report.note}</p></div>', '<div><span>Đánh giá phiên</span><strong>{statusLabel(report.status)} · {report.score}/100</strong><p>{businessText(report.insights.summary || report.note)}</p></div>'],
  ['<Metric label="Khách" value={ov.planned}', '<Metric label="Điểm bán" value={ov.planned}'],
  ['<Metric label="Đơn/Test" value={`${ov.orders}/${ov.tests}`} />', '<Metric label="Đơn / lượt thử" value={`${ov.orders}/${ov.tests}`} />'],
  ['<Metric label="Chi tiết khách"', '<Metric label="Chi tiết điểm bán"'],
  ['meta={`${item.status || "-"} · ${money(item.total)}`}', 'meta={`${businessText(item.status || "-")} · ${money(item.total)}`}'],
  ['meta={item.status || "-"}', 'meta={businessText(item.status || "-")}'],
  ['meta={`${item.priority || "-"} · ${item.status || "-"} · ${item.dueDate || "chưa hẹn"}`}', 'meta={`${businessText(item.priority || "-")} · ${businessText(item.status || "-")} · ${item.dueDate || "chưa hẹn"}`}'],
  ['return [customer.visitStatus || customer.status || "pending", customer.area, customer.phone].filter(Boolean).join(" · ");', 'return [businessText(customer.visitStatus || customer.status || "Chờ xử lý"), customer.area, customer.phone].filter(Boolean).join(" · ");'],
  ['const signals = `${customer.orders?.length || 0} đơn · ${customer.tests?.length || 0} test · ${customer.observations?.length || 0} quan sát · ${customer.followups?.length || 0} follow-up`;', 'const signals = `${customer.orders?.length || 0} đơn · ${customer.tests?.length || 0} lượt thử · ${customer.observations?.length || 0} ghi nhận · ${customer.followups?.length || 0} việc theo dõi`;'],
  ['<p>{report.insights.summary || "Báo cáo chưa có nhận định."}</p>', '<p>{businessText(report.insights.summary, "Báo cáo chưa có nhận định.")}</p>'],
  ['title={`${item.customerName ? `${item.customerName} · ` : ""}${item.action || "Việc cần làm"}`}', 'title={businessText(`${item.customerName ? `${item.customerName} · ` : ""}${item.action || "Việc cần làm"}`)}'],
  ['note={item.reason}', 'note={businessText(item.reason)}']
]);

replaceMany("src/features/market-checks/MarketChecksClientPage.tsx", [
  ['<FilterBar filters={[{ label: "Nguồn", value: "Phiên MCP" }, { label: "Nhóm", value: "Theo phiên đi tuyến" }, { label: "Màn", value: "Theo dõi kết quả" }]} />', '<FilterBar filters={[{ label: "Phạm vi", value: "Theo phiên đi tuyến" }, { label: "Trạng thái", value: needAction ? `${needAction} cần xử lý` : "Đã cập nhật" }, { label: "Sắp xếp", value: "Mới nhất trước" }]} />'],
  ['<strong><b>{setup.customers}</b><small>Khách</small></strong>', '<strong><b>{setup.customers}</b><small>Điểm bán</small></strong>']
]);

replaceMany("src/features/dashboard/DashboardPage.tsx", [
  ['<strong>{businessText(item.value)}</strong>', '<strong>{businessText(item.value)}</strong>']
]);

const auditFile = "scripts/audit-user-facing-copy.mjs";
let audit = read(auditFile);
const marker = '  "Dang mo..."\n];';
if (!audit.includes(marker)) throw new Error("audit marker not found");
audit = audit.replace(marker, '  "Dang mo...",\n  "Bo loc nhanh",\n  "Đánh giá snapshot",\n  "Đơn/Test",\n  "Theo snapshot đã chốt",\n  "Đọc từ health đã lưu",\n  "customer_details hoàn chỉnh",\n  "Supabase live",\n  "Tuyến active",\n  "Xem test"\n];');
write(auditFile, audit);

console.log("Applied final preview-driven business copy cleanup.");
