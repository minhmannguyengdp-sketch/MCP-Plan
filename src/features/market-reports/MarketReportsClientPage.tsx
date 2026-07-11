"use client";

import { useMemo, useState } from "react";
import { CompactKpiStrip } from "@/ui/cards/CompactKpiStrip";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { FilterBar } from "@/ui/layout/FilterBar";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { MarketReportItem, MarketReportKpi, MarketReportStatus, MarketReportType, SessionReportCustomer } from "./market-reports.types";
import styles from "./MarketReportsClientPage.module.css";

type ReportTab = "overview" | "orders" | "tests" | "observations" | "followups" | "customers" | "ai";
type AgentProductInsight = { product?: string; status?: string; insight?: string };
type AgentCustomerAction = { customer?: string; priority?: string; action?: string; reason?: string };
type AgentSampleRequest = { customer?: string; products?: string[]; note?: string };
type AgentFollowup = { customer?: string; date?: string; note?: string };
type AgentOrderOpportunity = { customer?: string; products?: string[]; confidence?: string; reason?: string };
type AgentResult = {
  summary: string;
  market_insights: string[];
  product_insights: AgentProductInsight[];
  customer_actions: AgentCustomerAction[];
  sample_requests: AgentSampleRequest[];
  follow_up_list: AgentFollowup[];
  order_opportunities: AgentOrderOpportunity[];
  risks: string[];
  next_steps: string[];
};
type AgentResponse = { ok?: boolean; source?: string; error?: string; result?: unknown };

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "orders", label: "Đơn hàng" },
  { id: "tests", label: "Test" },
  { id: "observations", label: "Quan sát" },
  { id: "followups", label: "Follow-up" },
  { id: "customers", label: "Khách" },
  { id: "ai", label: "AI Summary" }
];

function getStatusLabel(status: MarketReportStatus) {
  if (status === "opportunity") return "Cơ hội";
  if (status === "risk") return "Cần xử lý";
  return "Bình thường";
}

function getTypeLabel(type: MarketReportType) {
  if (type === "price") return "Giá";
  if (type === "competitor") return "BC phiên";
  if (type === "display") return "Trưng bày";
  return "Tồn kho";
}

function getStatusClass(status: MarketReportStatus) {
  if (status === "opportunity") return `${styles.status} ${styles.opportunity}`;
  if (status === "risk") return `${styles.status} ${styles.risk}`;
  return `${styles.status} ${styles.normal}`;
}

function pct(done: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((done / total) * 100)}%`;
}

function money(value?: number) {
  return `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;
}

function reportExportUrl(report: MarketReportItem, format: "json" | "markdown") {
  return `/api/mcp-session-report/export?sessionId=${encodeURIComponent(report.sessionId)}&format=${format}`;
}

function reportAnalyzeUrl() {
  return "/api/mcp-session-report/analyze";
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function objectList<T>(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as T[] : [];
}

function normalizeAgentResult(value: unknown): AgentResult {
  const result = object(value);
  return {
    summary: String(result.summary ?? "").trim(),
    market_insights: stringList(result.market_insights),
    product_insights: objectList<AgentProductInsight>(result.product_insights),
    customer_actions: objectList<AgentCustomerAction>(result.customer_actions),
    sample_requests: objectList<AgentSampleRequest>(result.sample_requests),
    follow_up_list: objectList<AgentFollowup>(result.follow_up_list),
    order_opportunities: objectList<AgentOrderOpportunity>(result.order_opportunities),
    risks: stringList(result.risks),
    next_steps: stringList(result.next_steps)
  };
}

function buildAiSummary(report: MarketReportItem) {
  const ov = report.overview;
  const visitRate = ov.planned > 0 ? ov.visited / ov.planned : 0;
  const risks = [...report.sections.risks];
  const opportunities = [...report.sections.opportunities];
  const nextActions = [...report.sections.nextActions];

  if (ov.planned > 0 && visitRate < 0.35) risks.unshift(`Độ phủ phiên thấp: ${ov.visited}/${ov.planned} khách (${pct(ov.visited, ov.planned)}).`);
  if (ov.tests > 0 && ov.followups === 0) risks.push("Có test sản phẩm nhưng chưa có follow-up đi kèm.");
  if (ov.orders > 0) opportunities.unshift(`Có ${ov.orders} đơn phát sinh trong phiên.`);
  if (ov.tests > 0) opportunities.push(`Có ${ov.tests} test sản phẩm cần theo dõi kết quả.`);
  if (ov.observations > 0) opportunities.push(`Có ${ov.observations} quan sát thị trường làm input cho phân tích.`);
  if (ov.planned > 0 && ov.visited < ov.planned) nextActions.unshift("Rà lại nhóm khách chưa ghé và lý do bỏ sót tuyến.");
  if (ov.tests > 0 && ov.followups === 0) nextActions.unshift("Tạo follow-up cho khách đã test để không mất tín hiệu mua hàng.");
  if (ov.orders > 0) nextActions.push("Kiểm tra trạng thái xử lý đơn sau phiên.");

  const summary = risks.length
    ? "Phiên có dữ liệu bán hàng/test nhưng còn điểm cần xử lý trước khi dùng làm báo cáo quản trị."
    : opportunities.length
      ? "Phiên có tín hiệu tích cực, nên tiếp tục chuyển các phát sinh thành follow-up cụ thể."
      : "Phiên chưa có nhiều tín hiệu phát sinh, cần bổ sung quan sát hoặc lý do chưa ghé để báo cáo có giá trị hơn.";

  return {
    score: report.status === "risk" ? "Cần xử lý" : report.status === "opportunity" ? "Có tín hiệu" : "Bình thường",
    summary,
    risks: Array.from(new Set(risks)).slice(0, 6),
    opportunities: Array.from(new Set(opportunities)).slice(0, 6),
    nextActions: Array.from(new Set(nextActions)).slice(0, 8)
  };
}

function ReportCard({ report, onSelect }: { report: MarketReportItem; onSelect: (report: MarketReportItem) => void }) {
  const ov = report.overview;
  return (
    <OperationalListCard
      leading={<span>BC</span>}
      eyebrow={`BC phiên · ${report.date}`}
      title={report.subject}
      description={`${report.routeName} · ${ov.visited}/${ov.planned} khách đã ghé · ${ov.orders} đơn · ${ov.tests} test`}
      badge={<strong className={getStatusClass(report.status)}>{getStatusLabel(report.status)}</strong>}
      meta={[`Độ phủ ${pct(ov.visited, ov.planned)}`, `${ov.observations} quan sát`, report.nextAction]}
      actions={[
        { label: "Xem", tone: "primary", onClick: () => onSelect(report) },
        { label: "JSON", href: reportExportUrl(report, "json") },
        { label: "MD", href: reportExportUrl(report, "markdown") }
      ]}
    />
  );
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className={styles.reportMetric}><span>{label}</span><strong>{value}</strong>{hint ? <small>{hint}</small> : null}</div>;
}

function EmptyBlock({ children }: { children: string }) {
  return <div className="empty-inline">{children}</div>;
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <EmptyBlock>{empty}</EmptyBlock>;
  return <div className={styles.textList}>{items.map((item) => <p key={item}>{item}</p>)}</div>;
}

function DetailRow({ title, meta, note }: { title: string; meta?: string; note?: string }) {
  return <article className={styles.detailRow}><div><strong>{title}</strong>{meta ? <span>{meta}</span> : null}</div>{note ? <p>{note}</p> : null}</article>;
}

function customerRows(report: MarketReportItem): SessionReportCustomer[] {
  if (report.sections.customers?.length) return report.sections.customers;
  const rows: SessionReportCustomer[] = [];
  report.sections.orders.forEach((order) => rows.push({ id: order.id, customerName: order.customerName, status: "Có đơn", orderId: order.id, note: order.code }));
  report.sections.tests.forEach((test) => rows.push({ id: test.id, customerName: test.customerName, status: "Có test", testId: test.id, note: test.productName }));
  report.sections.observations.forEach((observation) => rows.push({ id: observation.id, customerName: observation.customerName, status: "Có quan sát", note: observation.note || observation.summary }));
  report.sections.followups.forEach((followup) => rows.push({ id: followup.id, customerName: followup.customerName, status: "Có follow-up", followupCount: 1, note: followup.title }));
  report.sections.skipped.forEach((customer) => rows.push({ ...customer, status: customer.status || "Bỏ qua" }));
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.customerName || "-"}-${row.status || "-"}-${row.note || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function OverviewTab({ report }: { report: MarketReportItem }) {
  const ov = report.overview;
  return <div className={styles.reportTabBody}>
    <section className={styles.reportHero}>
      <div><span>Đánh giá BC</span><strong>{getStatusLabel(report.status)}</strong><p>{report.note}</p></div>
      <div className="sheet-action-grid">
        <a className="button primary" href={reportExportUrl(report, "json")} target="_blank" rel="noreferrer">Xuất JSON</a>
        <a className="button" href={reportExportUrl(report, "markdown")} target="_blank" rel="noreferrer">Xuất Markdown</a>
      </div>
    </section>
    <div className={styles.reportMetricGrid}>
      <Metric label="Khách trong phiên" value={ov.planned} hint={`${ov.visited} đã ghé · ${ov.pending} chờ`} />
      <Metric label="Độ phủ" value={pct(ov.visited, ov.planned)} hint={`${ov.skipped} bỏ qua`} />
      <Metric label="Đơn/Test" value={`${ov.orders}/${ov.tests}`} hint="Phát sinh trong phiên" />
      <Metric label="Quan sát/Follow-up" value={`${ov.observations}/${ov.followups}`} hint="Input & việc sau phiên" />
    </div>
    <div className="grid">
      <div className="metric-row"><span>Loại</span><strong>{getTypeLabel(report.reportType)}</strong></div>
      <div className="metric-row"><span>Tuyến</span><strong>{report.routeName}</strong></div>
      <div className="metric-row"><span>Ngày phiên</span><strong>{report.date}</strong></div>
      <div className="metric-row"><span>Nguồn snapshot</span><strong>{report.snapshotSource || "-"}</strong></div>
    </div>
  </div>;
}

function OrdersTab({ report }: { report: MarketReportItem }) {
  if (!report.sections.orders.length) return <EmptyBlock>Phiên này chưa có đơn hàng.</EmptyBlock>;
  return <div className={styles.detailList}>{report.sections.orders.map((order) => <DetailRow key={order.id} title={`${order.customerName || "Khách"} · ${order.code || order.id}`} meta={`${order.status || "-"} · ${money(order.total)}`} note={order.note} />)}</div>;
}

function TestsTab({ report }: { report: MarketReportItem }) {
  if (!report.sections.tests.length) return <EmptyBlock>Phiên này chưa có test sản phẩm.</EmptyBlock>;
  return <div className={styles.detailList}>{report.sections.tests.map((test) => <DetailRow key={test.id} title={`${test.customerName || "Khách"} · ${test.productName || "Sản phẩm test"}`} meta={test.status || "Chưa rõ trạng thái"} note={test.note} />)}</div>;
}

function ObservationsTab({ report }: { report: MarketReportItem }) {
  return <div className={styles.reportTabBody}>
    <section className={styles.chipSection}>
      <strong>Đối thủ</strong>
      {report.sections.competitors.length ? <div className={styles.chips}>{report.sections.competitors.map((item) => <span key={item.label}>{item.label} · {item.count}</span>)}</div> : <EmptyBlock>Chưa có đối thủ nổi bật.</EmptyBlock>}
    </section>
    <section className={styles.chipSection}>
      <strong>Sản phẩm khách đang dùng</strong>
      {report.sections.usedProducts.length ? <div className={styles.chips}>{report.sections.usedProducts.map((item) => <span key={item.label}>{item.label} · {item.count}</span>)}</div> : <EmptyBlock>Chưa ghi sản phẩm đang dùng.</EmptyBlock>}
    </section>
    <section className={styles.twoColumnSection}>
      <div><h3>Cơ hội</h3><TextList items={report.sections.opportunities} empty="Chưa có cơ hội được ghi nhận." /></div>
      <div><h3>Rủi ro</h3><TextList items={report.sections.risks} empty="Chưa có rủi ro được ghi nhận." /></div>
    </section>
    <section>
      <h3>Quan sát chi tiết</h3>
      {report.sections.observations.length ? <div className={styles.detailList}>{report.sections.observations.map((item, index) => <DetailRow key={item.id || index} title={item.customerName || `Quan sát ${index + 1}`} meta={[...(item.competitors || []), ...(item.usedProducts || [])].join(" · ")} note={item.note || item.summary} />)}</div> : <EmptyBlock>Chưa có quan sát chi tiết theo khách.</EmptyBlock>}
    </section>
  </div>;
}

function FollowupsTab({ report }: { report: MarketReportItem }) {
  if (!report.sections.followups.length) return <EmptyBlock>Phiên này chưa có follow-up.</EmptyBlock>;
  return <div className={styles.detailList}>{report.sections.followups.map((item) => <DetailRow key={item.id} title={`${item.customerName || "Khách"} · ${item.title || "Follow-up"}`} meta={`${item.priority || "-"} · ${item.status || "-"} · ${item.dueDate || "chưa hẹn"}`} note={item.note || item.owner} />)}</div>;
}

function CustomersTab({ report }: { report: MarketReportItem }) {
  const rows = customerRows(report);
  return <div className={styles.reportTabBody}>
    <div className={styles.reportMetricGrid}>
      <Metric label="Tổng khách" value={report.overview.planned} />
      <Metric label="Đã ghé" value={report.overview.visited} />
      <Metric label="Chờ" value={report.overview.pending} />
      <Metric label="Bỏ qua" value={report.overview.skipped} />
    </div>
    {rows.length ? <div className={styles.detailList}>{rows.map((item, index) => <DetailRow key={item.id || index} title={item.customerName || `Khách ${index + 1}`} meta={item.status} note={item.note} />)}</div> : <EmptyBlock>Snapshot hiện tại chưa lưu chi tiết từng khách. Gate 8E sẽ bổ sung customer_details để AI đọc đầy đủ từng điểm bán.</EmptyBlock>}
  </div>;
}

function AgentResultView({ result, source }: { result: AgentResult; source?: string }) {
  return <div className={styles.reportTabBody}>
    <section className={styles.aiPanel}>
      <span>Kết quả ADK Agent{source ? ` · ${source}` : ""}</span>
      <strong>{result.summary ? "Đã phân tích" : "Chưa có tóm tắt"}</strong>
      <p>{result.summary || "Agent chưa trả tóm tắt."}</p>
    </section>
    <section className={styles.twoColumnSection}>
      <div><h3>Nhận định thị trường</h3><TextList items={result.market_insights} empty="Agent chưa có nhận định thị trường." /></div>
      <div><h3>Rủi ro</h3><TextList items={result.risks} empty="Agent chưa nêu rủi ro." /></div>
    </section>
    <section>
      <h3>Sản phẩm</h3>
      {result.product_insights.length ? <div className={styles.detailList}>{result.product_insights.map((item, index) => <DetailRow key={`${item.product || "product"}-${index}`} title={item.product || `Sản phẩm ${index + 1}`} meta={item.status || "unknown"} note={item.insight} />)}</div> : <EmptyBlock>Agent chưa có nhận định sản phẩm.</EmptyBlock>}
    </section>
    <section>
      <h3>Hành động theo khách</h3>
      {result.customer_actions.length ? <div className={styles.detailList}>{result.customer_actions.map((item, index) => <DetailRow key={`${item.customer || "customer"}-${index}`} title={item.customer || `Khách ${index + 1}`} meta={item.priority || "medium"} note={[item.action, item.reason].filter(Boolean).join(" · ")} />)}</div> : <EmptyBlock>Agent chưa đề xuất hành động theo khách.</EmptyBlock>}
    </section>
    <section>
      <h3>Cơ hội đơn hàng</h3>
      {result.order_opportunities.length ? <div className={styles.detailList}>{result.order_opportunities.map((item, index) => <DetailRow key={`${item.customer || "order"}-${index}`} title={item.customer || `Khách ${index + 1}`} meta={`${item.confidence || "medium"} · ${(item.products || []).join(", ") || "chưa rõ sản phẩm"}`} note={item.reason} />)}</div> : <EmptyBlock>Agent chưa nêu cơ hội đơn hàng.</EmptyBlock>}
    </section>
    <section>
      <h3>Việc tiếp theo</h3>
      <TextList items={result.next_steps} empty="Agent chưa đề xuất việc tiếp theo." />
    </section>
  </div>;
}

function AiTab({ report }: { report: MarketReportItem }) {
  const ai = buildAiSummary(report);
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<{ result: AgentResult; source?: string } | null>(null);
  const [error, setError] = useState("");

  async function runAgent() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(reportAnalyzeUrl(), {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: report.sessionId })
      });
      const payload = await response.json().catch(() => ({})) as AgentResponse;
      const result = normalizeAgentResult(payload.result);
      if (!response.ok || payload.ok === false) {
        setError(payload.error || result.summary || "Agent chưa phân tích được BC phiên.");
      }
      if (result.summary || result.market_insights.length || result.customer_actions.length || result.risks.length) {
        setAgent({ result, source: payload.source });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gọi được MCP Report Agent.");
    } finally {
      setLoading(false);
    }
  }

  return <div className={styles.reportTabBody}>
    <section className={styles.aiPanel}>
      <span>Phân tích nền có quy tắc</span>
      <strong>{ai.score}</strong>
      <p>{ai.summary}</p>
      <div className="sheet-action-grid">
        <button className="button primary" type="button" onClick={runAgent} disabled={loading}>{loading ? "Agent đang phân tích..." : "Phân tích bằng ADK Agent"}</button>
        <a className="button" href={reportExportUrl(report, "json")} target="_blank" rel="noreferrer">Xuất JSON</a>
        <a className="button" href={reportExportUrl(report, "markdown")} target="_blank" rel="noreferrer">Xuất Markdown</a>
      </div>
    </section>
    {error ? <EmptyBlock>{error}</EmptyBlock> : null}
    {agent ? <AgentResultView result={agent.result} source={agent.source} /> : <>
      <section className={styles.twoColumnSection}>
        <div><h3>Cơ hội</h3><TextList items={ai.opportunities} empty="Chưa đủ tín hiệu cơ hội." /></div>
        <div><h3>Rủi ro</h3><TextList items={ai.risks} empty="Chưa có rủi ro rõ." /></div>
      </section>
      <section>
        <h3>Next actions đề xuất</h3>
        <TextList items={ai.nextActions} empty="Chưa có việc đề xuất." />
      </section>
    </>}
  </div>;
}

function ReportSheet({ report, onClose }: { report: MarketReportItem | null; onClose: () => void }) {
  const [tab, setTab] = useState<ReportTab>("overview");
  return (
    <BottomSheet
      open={Boolean(report)}
      onClose={onClose}
      title={report ? `BC phiên · ${report.routeName}` : "Chi tiết BC phiên"}
      description={report ? `${report.accountName} · ${report.date}` : undefined}
      footer={<div className="sheet-action-grid"><button className="button" type="button" onClick={onClose}>Đóng</button>{report ? <><a className="button primary" href={reportExportUrl(report, "json")} target="_blank" rel="noreferrer">JSON</a><a className="button" href={reportExportUrl(report, "markdown")} target="_blank" rel="noreferrer">Markdown</a></> : null}</div>}
    >
      {report ? (
        <div className={styles.reportSheet}>
          <div className={styles.tabBar}>{REPORT_TABS.map((item) => <button key={item.id} className={tab === item.id ? styles.activeTab : ""} type="button" onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
          {tab === "overview" ? <OverviewTab report={report} /> : null}
          {tab === "orders" ? <OrdersTab report={report} /> : null}
          {tab === "tests" ? <TestsTab report={report} /> : null}
          {tab === "observations" ? <ObservationsTab report={report} /> : null}
          {tab === "followups" ? <FollowupsTab report={report} /> : null}
          {tab === "customers" ? <CustomersTab report={report} /> : null}
          {tab === "ai" ? <AiTab key={report.id} report={report} /> : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function MarketReportsClientPage({ kpis, reports, focusSessionId = "" }: { kpis: MarketReportKpi[]; reports: MarketReportItem[]; focusSessionId?: string }) {
  const focusedReport = useMemo(() => reports.find((report) => report.sessionId === focusSessionId || report.id === focusSessionId) || null, [focusSessionId, reports]);
  const [selectedReport, setSelectedReport] = useState<MarketReportItem | null>(focusedReport);
  const needAction = reports.filter((report) => report.status !== "normal").length;

  return (
    <AppShell activeHref="/reports">
      <PageHeader eyebrow="BC phiên MCP" title="BC phiên" subtitle="BC phiên đã chốt, có JSON/Markdown chuẩn và ADK Agent Gemini 2.5 Pro để phân tích khi cần."><span className="badge">{needAction} cần xử lý</span></PageHeader>
      <FilterBar filters={[{ label: "Nguồn", value: "Phiên MCP" }, { label: "Trạng thái", value: "Đã chốt" }, { label: "Nhóm", value: "Theo phiên" }]} />
      <CompactKpiStrip items={kpis} />

      <div className={styles.templateGrid}>
        <span>Tổng quan</span>
        <span>Đơn/Test</span>
        <span>Quan sát</span>
        <span>AI · JSON · MD</span>
      </div>

      <section className={styles.section}>
        <div className="dashboard-section-head"><h2>BC phiên đã chốt</h2><span>{reports.length} phiên</span></div>
        <div className={styles.list}>{reports.length ? reports.map((report) => <ReportCard key={report.id} report={report} onSelect={setSelectedReport} />) : <div className="empty-inline">Chưa có BC phiên. Chốt một phiên MCP để lưu BC chính thức.</div>}</div>
      </section>

      <ReportSheet report={selectedReport} onClose={() => setSelectedReport(null)} />
    </AppShell>
  );
}
