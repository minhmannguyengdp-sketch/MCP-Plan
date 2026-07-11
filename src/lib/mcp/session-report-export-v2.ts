import type { SessionReportSource } from "@/lib/mcp/session-report-source";

export type SessionReportExportPayload = {
  schemaVersion: string;
  reportType: "mcp_session_report";
  language: "vi";
  generatedAt: string;
  source: {
    app: "MCP-Plan";
    origin: "snapshot" | "live";
    snapshotId?: string;
    snapshotSource?: string;
    snapshotAt?: string;
  };
  session: SessionReportSource["summary"]["session"];
  overview: SessionReportSource["summary"]["sections"]["overview"];
  score: number;
  health: SessionReportSource["health"];
  insights: SessionReportSource["insights"];
  warnings: string[];
  recommendedActions: SessionReportSource["recommendedActions"];
  customerDetails: SessionReportSource["customerDetails"];
  market: {
    competitors: SessionReportSource["summary"]["sections"]["competitors"];
    usedProducts: SessionReportSource["summary"]["sections"]["usedProducts"];
    observations: SessionReportSource["summary"]["sections"]["observations"];
  };
  commerce: {
    orders: SessionReportSource["summary"]["sections"]["orders"];
    tests: SessionReportSource["summary"]["sections"]["tests"];
  };
  followups: SessionReportSource["summary"]["sections"]["followups"];
  aiPromptContext: Record<string, unknown>;
  aiResult?: Record<string, unknown> | null;
  aiAnalyzedAt?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function percent(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function list(items: string[], empty: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
}

function countList(items: Array<{ label: string; count: number }>, empty: string) {
  return items.length ? items.map((item) => `- ${item.label}: ${item.count}`).join("\n") : `- ${empty}`;
}

export function buildSessionReportExportPayload(source: SessionReportSource): SessionReportExportPayload {
  const summary = source.summary;
  return {
    schemaVersion: source.schemaVersion || "mcp.session-report.snapshot.v2",
    reportType: "mcp_session_report",
    language: "vi",
    generatedAt: new Date().toISOString(),
    source: {
      app: "MCP-Plan",
      origin: source.origin,
      snapshotId: source.snapshotId,
      snapshotSource: source.snapshotSource,
      snapshotAt: source.snapshotAt
    },
    session: summary.session,
    overview: summary.sections.overview,
    score: source.score,
    health: source.health,
    insights: source.insights,
    warnings: source.warnings,
    recommendedActions: source.recommendedActions,
    customerDetails: source.customerDetails,
    market: {
      competitors: summary.sections.competitors,
      usedProducts: summary.sections.usedProducts,
      observations: summary.sections.observations
    },
    commerce: {
      orders: summary.sections.orders,
      tests: summary.sections.tests
    },
    followups: summary.sections.followups,
    aiPromptContext: source.aiPromptContext,
    aiResult: source.aiResult,
    aiAnalyzedAt: source.aiAnalyzedAt
  };
}

export function buildSessionReportMarkdownV2(payload: SessionReportExportPayload) {
  const orders = payload.commerce.orders.length
    ? payload.commerce.orders.map((item) => `- ${item.customerName || "Khách"} · ${item.code || item.id} · ${item.status || "-"} · ${Math.round(item.total || 0).toLocaleString("vi-VN")}đ${item.note ? ` · ${item.note}` : ""}`).join("\n")
    : "- Chưa có đơn hàng.";
  const tests = payload.commerce.tests.length
    ? payload.commerce.tests.map((item) => `- ${item.customerName || "Khách"} · ${item.productName || "Sản phẩm"} · ${item.status || "-"}${item.note ? ` · ${item.note}` : ""}`).join("\n")
    : "- Chưa có test sản phẩm.";
  const observations = payload.market.observations.length
    ? payload.market.observations.map((item) => `- ${item.customerName || "Khách"}: ${item.note || "Không có ghi chú"}`).join("\n")
    : "- Chưa có quan sát thị trường.";
  const followups = payload.followups.length
    ? payload.followups.map((item) => `- [${item.priority || "medium"}] ${item.customerName || "Khách"} · ${item.title || "Follow-up"}${item.dueDate ? ` · ${item.dueDate}` : ""} · ${item.status || "open"}${item.note ? ` · ${item.note}` : ""}`).join("\n")
    : "- Chưa có follow-up.";
  const customers = payload.customerDetails.length
    ? payload.customerDetails.map((item) => `- ${item.sortOrder || "-"}. ${item.customerName} · ${item.visitStatus}${item.statusReason ? ` · ${item.statusReason}` : ""} · ${item.orders.length} đơn · ${item.tests.length} test · ${item.observations.length} quan sát · ${item.followups.length} follow-up`).join("\n")
    : "- Chưa có chi tiết khách.";
  const actions = payload.recommendedActions.length
    ? payload.recommendedActions.map((item) => `- [${item.priority}] ${item.customerName ? `${item.customerName}: ` : ""}${item.action} — ${item.reason}`).join("\n")
    : "- Chưa có hành động đề xuất.";

  return [
    `# BC phiên · ${payload.session.routeName || "MCP"}`,
    "",
    `- **Ngày phiên:** ${payload.session.sessionDate || "-"}`,
    `- **Sales:** ${payload.session.sales || "-"}`,
    `- **Session ID:** ${payload.session.id}`,
    `- **Nguồn:** ${payload.source.origin === "snapshot" ? "Snapshot đã chốt" : "Tổng hợp trực tiếp"}`,
    `- **Schema:** ${payload.schemaVersion}`,
    payload.source.snapshotAt ? `- **Snapshot lúc:** ${payload.source.snapshotAt}` : "",
    "",
    "## Tổng quan",
    "",
    `- Khách kế hoạch: **${payload.overview.planned}**`,
    `- Đã ghé: **${payload.overview.visited}** (${percent(payload.overview.visited, payload.overview.planned)}%)`,
    `- Chờ ghé: **${payload.overview.pending}**`,
    `- Bỏ qua: **${payload.overview.skipped}**`,
    `- Đơn/Test: **${payload.overview.orders}/${payload.overview.tests}**`,
    `- Quan sát/Follow-up: **${payload.overview.observations}/${payload.overview.followups}**`,
    "",
    "## Đánh giá snapshot",
    "",
    `- **Health:** ${payload.health}`,
    `- **Điểm:** ${payload.score}/100`,
    `- **Tóm tắt:** ${payload.insights.summary || "Chưa có nhận định."}`,
    list(payload.insights.reasons || [], "Chưa có lý do đánh giá."),
    "",
    "## Cảnh báo",
    "",
    list(payload.warnings, "Không có cảnh báo."),
    "",
    "## Cơ hội",
    "",
    list(payload.insights.opportunities || [], "Chưa có cơ hội rõ."),
    "",
    "## Rủi ro",
    "",
    list(payload.insights.risks || [], "Chưa có rủi ro rõ."),
    "",
    "## Hành động đề xuất",
    "",
    actions,
    "",
    "## Đơn hàng",
    "",
    orders,
    "",
    "## Test sản phẩm",
    "",
    tests,
    "",
    "## Quan sát thị trường",
    "",
    "### Đối thủ",
    countList(payload.market.competitors, "Chưa ghi nhận."),
    "",
    "### Sản phẩm khách đang dùng",
    countList(payload.market.usedProducts, "Chưa ghi nhận."),
    "",
    "### Chi tiết",
    observations,
    "",
    "## Follow-up",
    "",
    followups,
    "",
    `## Chi tiết khách (${payload.customerDetails.length}/${payload.overview.planned})`,
    "",
    customers,
    payload.aiResult ? "\n## Kết quả AI đã lưu\n\n```json\n" + JSON.stringify(payload.aiResult, null, 2) + "\n```" : "",
    "",
    "---",
    `Generated by MCP-Plan at ${payload.generatedAt}`
  ].filter((line) => line !== "").join("\n");
}

export function sessionReportExportFilenameV2(payload: SessionReportExportPayload, extension: "json" | "md") {
  const route = text(payload.session.routeName || "mcp")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "mcp";
  return `bc-phien-${route}-${payload.session.sessionDate || "khong-ngay"}.${extension}`;
}
