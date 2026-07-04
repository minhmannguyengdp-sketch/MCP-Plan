"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OperationalListCard } from "@/ui/cards/OperationalListCard";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { McpDayData, McpDayLine, McpDayResult } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";
import { createApiClient } from "@/lib/api/api-client";
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, type McpCustomerAction } from "./mcp-customer-actions";

type SessionTab = "customers" | "results" | "added" | "followups";

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "planned") return "Khách theo tuyến";
  if (source === "added") return "Khách phát sinh";
  return "Đồng bộ";
}

function statusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua";
  return "Hủy";
}

function actionTitle(action: McpCustomerAction) {
  if (action === "order") return "Ghi nhận có đơn";
  if (action === "test") return "Ghi nhận có test";
  if (action === "market_report") return "Ghi báo cáo thị trường";
  return "Tạo việc follow-up";
}

function hasLineResult(line: McpDayLine) {
  return Boolean(line.visitId || line.result || line.hasOrder || line.hasTest || line.hasReport || Number(line.followupCount || 0) > 0 || line.status === "visited");
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function ResultCard({ result }: { result: McpDayResult }) {
  return <OperationalListCard leading={<span>{result.startTime}</span>} eyebrow={`${result.startTime} · ${result.endTime}`} title={result.accountName} description={result.result} badge={<span className={result.hasOrder ? "dashboard-status status-good" : "dashboard-status status-watch"}>{result.hasOrder ? "Có đơn" : result.nextAction}</span>} meta={[result.hasTest ? "Có test" : "Chưa test", result.hasReport ? "Có báo cáo" : "Chưa báo cáo", `Follow-up ${Number(result.followupCount || 0)}`]} />;
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  return (
    <BottomSheet open={Boolean(line)} onClose={onClose} title={line ? line.accountName : "Xử lý điểm bán"} description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined} footer={line ? <div className="sheet-action-grid"><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Ghi có đơn</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi có test</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Ghi báo cáo</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Tạo follow-up</button><button className="button" type="button" onClick={onClose}>Đóng</button></div> : undefined}>
      {line ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Trạng thái ghé</span><strong>{statusLabel(line.status)}</strong><small>{line.result ?? "Chưa ghi kết quả chi tiết"}</small></div><div className="grid"><div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(line.source)}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{line.area}</strong></div><div className="metric-row"><span>Đơn hàng</span><strong>{line.hasOrder ? "Đã ghi có đơn" : "Chưa ghi đơn"}</strong></div><div className="metric-row"><span>Test sản phẩm</span><strong>{line.hasTest ? "Đã ghi test" : "Chưa ghi test"}</strong></div><div className="metric-row"><span>Báo cáo</span><strong>{line.hasReport ? "Đã ghi báo cáo" : "Chưa ghi báo cáo"}</strong></div><div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)} việc</strong></div></div></div> : null}
    </BottomSheet>
  );
}

function CustomerActionSheet({ selection, saving, message, onClose, onSubmit }: { selection: { line: McpDayLine; action: McpCustomerAction } | null; saving: boolean; message: string | null; onClose: () => void; onSubmit: () => void }) {
  return (
    <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "Hành động MCP"} description={selection ? selection.line.accountName : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : "Lưu kết quả"}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {selection ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Điểm bán</span><strong>{selection.line.accountName}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div><div className="grid"><div className="metric-row"><span>Thao tác</span><strong>{actionTitle(selection.action)}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{selection.line.area}</strong></div><div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(selection.line.source)}</strong></div></div>{message ? <p className="page-subtitle">{message}</p> : null}</div> : null}
    </BottomSheet>
  );
}

function LineList({ lines, onOpen, onAction }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  if (lines.length === 0) return <EmptyPanel title="Chưa có dữ liệu" hint="Tab này sẽ có dữ liệu khi phiên ngày phát sinh đúng trạng thái." />;
  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} />)}</div>;
}

export function McpSessionCompactView({ activeHref = "/visits", mcpDayData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<SessionTab>("customers");
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  const run = mcpDayData.run;
  const resultLines = mcpDayData.lines.filter(hasLineResult);
  const addedLines = mcpDayData.lines.filter((line) => line.source === "added");
  const followupLines = mcpDayData.lines.filter((line) => Number(line.followupCount || 0) > 0);
  const counters = { customers: mcpDayData.lines.length, results: mcpDayData.results.length || resultLines.length, added: addedLines.length, followups: followupLines.length };
  const pendingCount = mcpDayData.lines.filter((line) => line.status === "pending").length;

  function submitAction() {
    if (!selectedAction) return;
    const api = createApiClient();
    const sessionCustomerId = selectedAction.line.sessionCustomerId || selectedAction.line.id;
    startSaving(async () => {
      try {
        setMessage(null);
        if (selectedAction.action === "follow_up") {
          await api.createMcpDayFollowup({ sessionCustomerId, title: `Theo dõi ${selectedAction.line.accountName}`, followupType: "general", priority: "medium", owner: run.owner, note: `Tạo việc từ MCP Day cho ${selectedAction.line.accountName}` });
        } else {
          const resultType = selectedAction.action === "market_report" ? "report" : selectedAction.action;
          await api.createMcpDayResult({ sessionCustomerId, resultType, note: mcpCustomerActionDescription(selectedAction.action), hasOrder: resultType === "order" ? true : undefined, hasTest: resultType === "test" ? true : undefined, hasReport: resultType === "report" ? true : undefined });
        }
        setSelectedAction(null);
        setSelectedLine(null);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không lưu được hành động MCP");
      }
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="Phiên MCP ngày" title={run.routeName} subtitle={`${run.date} · ${run.owner} · ${counters.customers} khách`} />
      <section className="mcp-gate-banner mcp-session-compact-head">
        <strong>{pendingCount} chờ xử lý</strong>
        <span>{counters.results} kết quả · {counters.added} phát sinh · {counters.followups} follow-up · mở lúc {run.openedAt}</span>
      </section>
      <div className="mcp-status-chips" role="tablist" aria-label="Phiên MCP ngày"><button className={tab === "customers" ? "active" : ""} type="button" onClick={() => setTab("customers")}>Khách <b>{counters.customers}</b></button><button className={tab === "results" ? "active" : ""} type="button" onClick={() => setTab("results")}>Kết quả <b>{counters.results}</b></button><button className={tab === "added" ? "active" : ""} type="button" onClick={() => setTab("added")}>Phát sinh <b>{counters.added}</b></button><button className={tab === "followups" ? "active" : ""} type="button" onClick={() => setTab("followups")}>Follow-up <b>{counters.followups}</b></button></div>
      {tab === "customers" ? <LineList lines={mcpDayData.lines} onOpen={setSelectedLine} onAction={(line, action) => setSelectedAction({ line, action })} /> : null}
      {tab === "results" ? (mcpDayData.results.length > 0 ? <div className="mcp-line-list">{mcpDayData.results.map((result) => <ResultCard key={result.id} result={result} />)}</div> : <LineList lines={resultLines} onOpen={setSelectedLine} onAction={(line, action) => setSelectedAction({ line, action })} />) : null}
      {tab === "added" ? <LineList lines={addedLines} onOpen={setSelectedLine} onAction={(line, action) => setSelectedAction({ line, action })} /> : null}
      {tab === "followups" ? <LineList lines={followupLines} onOpen={setSelectedLine} onAction={(line, action) => setSelectedAction({ line, action })} /> : null}
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={(line, action) => setSelectedAction({ line, action })} />
      <CustomerActionSheet selection={selectedAction} saving={saving} message={message} onClose={() => { if (!saving) setSelectedAction(null); }} onSubmit={submitAction} />
    </AppShell>
  );
}
