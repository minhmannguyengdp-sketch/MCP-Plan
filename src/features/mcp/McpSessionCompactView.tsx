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
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, type McpCustomerAction } from "./mcp-customer-actions";

type SessionTab = "customers" | "results" | "added" | "followups";

type OrderDraftItem = {
  productName: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  note: string;
};

const emptyOrderItem = (): OrderDraftItem => ({
  productName: "",
  quantity: "1",
  unitPrice: "0",
  unit: "",
  note: ""
});

function toOrderPayloadItems(items: OrderDraftItem[]) {
  return items
    .map((item) => ({
      productName: item.productName.trim(),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      unit: item.unit.trim(),
      note: item.note.trim()
    }))
    .filter((item) => item.productName);
}

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "planned") return "KhÃ¡ch theo tuyáº¿n";
  if (source === "added") return "KhÃ¡ch phÃ¡t sinh";
  return "Äá»“ng bá»™";
}

function statusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chá» ghÃ©";
  if (status === "visited") return "ÄÃ£ ghÃ©";
  if (status === "skipped") return "Bá» qua";
  return "Há»§y";
}

function actionTitle(action: McpCustomerAction) {
  if (action === "order") return "Táº¡o Ä‘Æ¡n hÃ ng";
  if (action === "test") return "Ghi nháº­n cÃ³ test";
  if (action === "market_report") return "Ghi bÃ¡o cÃ¡o thá»‹ trÆ°á»ng";
  return "Táº¡o viá»‡c follow-up";
}

function hasLineResult(line: McpDayLine) {
  return Boolean(line.visitId || line.result || line.hasOrder || line.hasTest || line.hasReport || Number(line.followupCount || 0) > 0 || line.status === "visited");
}

async function postMcpBackend(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "KhÃ´ng lÆ°u Ä‘Æ°á»£c hÃ nh Ä‘á»™ng MCP");
  }
  return payload;
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function ResultCard({ result }: { result: McpDayResult }) {
  return <OperationalListCard leading={<span>{result.startTime}</span>} eyebrow={`${result.startTime} Â· ${result.endTime}`} title={result.accountName} description={result.result} badge={<span className={result.hasOrder ? "dashboard-status status-good" : "dashboard-status status-watch"}>{result.hasOrder ? "CÃ³ Ä‘Æ¡n" : result.nextAction}</span>} meta={[result.hasTest ? "CÃ³ test" : "ChÆ°a test", result.hasReport ? "CÃ³ bÃ¡o cÃ¡o" : "ChÆ°a bÃ¡o cÃ¡o", `Follow-up ${Number(result.followupCount || 0)}`]} />;
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  return (
    <BottomSheet open={Boolean(line)} onClose={onClose} title={line ? line.accountName : "Xá»­ lÃ½ Ä‘iá»ƒm bÃ¡n"} description={line ? `${line.area} Â· ${sourceLabel(line.source)}` : undefined} footer={line ? <div className="sheet-action-grid"><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Táº¡o Ä‘Æ¡n</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi cÃ³ test</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Ghi bÃ¡o cÃ¡o</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Táº¡o follow-up</button><button className="button" type="button" onClick={onClose}>ÄÃ³ng</button></div> : undefined}>
      {line ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Tráº¡ng thÃ¡i ghÃ©</span><strong>{statusLabel(line.status)}</strong><small>{line.result ?? "ChÆ°a ghi káº¿t quáº£ chi tiáº¿t"}</small></div><div className="grid"><div className="metric-row"><span>Nguá»“n khÃ¡ch</span><strong>{sourceLabel(line.source)}</strong></div><div className="metric-row"><span>Khu vá»±c</span><strong>{line.area}</strong></div><div className="metric-row"><span>ÄÆ¡n hÃ ng</span><strong>{line.hasOrder ? "ÄÃ£ ghi cÃ³ Ä‘Æ¡n" : "ChÆ°a ghi Ä‘Æ¡n"}</strong></div><div className="metric-row"><span>Test sáº£n pháº©m</span><strong>{line.hasTest ? "ÄÃ£ ghi test" : "ChÆ°a ghi test"}</strong></div><div className="metric-row"><span>BÃ¡o cÃ¡o</span><strong>{line.hasReport ? "ÄÃ£ ghi bÃ¡o cÃ¡o" : "ChÆ°a ghi bÃ¡o cÃ¡o"}</strong></div><div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)} viá»‡c</strong></div></div></div> : null}
    </BottomSheet>
  );
}

function CustomerActionSheet({
  selection,
  saving,
  message,
  orderItems,
  orderNote,
  onOrderItemChange,
  onAddOrderItem,
  onRemoveOrderItem,
  onOrderNoteChange,
  onClose,
  onSubmit
}: {
  selection: { line: McpDayLine; action: McpCustomerAction } | null;
  saving: boolean;
  message: string | null;
  orderItems: OrderDraftItem[];
  orderNote: string;
  onOrderItemChange: (index: number, field: keyof OrderDraftItem, value: string) => void;
  onAddOrderItem: () => void;
  onRemoveOrderItem: (index: number) => void;
  onOrderNoteChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isOrder = selection?.action === "order";

  return (
    <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "HÃ nh Ä‘á»™ng MCP"} description={selection ? selection.line.accountName : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Äang lÆ°u..." : isOrder ? "LÆ°u Ä‘Æ¡n hÃ ng" : "LÆ°u káº¿t quáº£"}</button><button className="button" type="button" onClick={onClose} disabled={saving}>ÄÃ³ng</button></div>}>
      {selection ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Äiá»ƒm bÃ¡n</span>
            <strong>{selection.line.accountName}</strong>
            <small>{isOrder ? "Táº¡o Ä‘Æ¡n hÃ ng tháº­t vÃ  link vÃ o phiÃªn MCP" : mcpCustomerActionDescription(selection.action)}</small>
          </div>

          {isOrder ? (
            <div className="grid">
              {orderItems.map((item, index) => (
                <div className="visit-focus-card" key={`order-item-${index}`}>
                  <span>Sáº£n pháº©m {index + 1}</span>
                  <label className="form-field">
                    <small>TÃªn sáº£n pháº©m</small>
                    <input value={item.productName} onChange={(event) => onOrderItemChange(index, "productName", event.target.value)} placeholder="VD: TrÃ  sá»¯a truyá»n thá»‘ng" />
                  </label>
                  <label className="form-field">
                    <small>Sá»‘ lÆ°á»£ng</small>
                    <input inputMode="decimal" value={item.quantity} onChange={(event) => onOrderItemChange(index, "quantity", event.target.value)} />
                  </label>
                  <label className="form-field">
                    <small>GiÃ¡</small>
                    <input inputMode="decimal" value={item.unitPrice} onChange={(event) => onOrderItemChange(index, "unitPrice", event.target.value)} />
                  </label>
                  <label className="form-field">
                    <small>ÄÆ¡n vá»‹</small>
                    <input value={item.unit} onChange={(event) => onOrderItemChange(index, "unit", event.target.value)} placeholder="ly / gÃ³i / thÃ¹ng" />
                  </label>
                  <label className="form-field">
                    <small>Ghi chÃº dÃ²ng</small>
                    <input value={item.note} onChange={(event) => onOrderItemChange(index, "note", event.target.value)} />
                  </label>
                  {orderItems.length > 1 ? <button className="button" type="button" onClick={() => onRemoveOrderItem(index)} disabled={saving}>XÃ³a dÃ²ng</button> : null}
                </div>
              ))}

              <button className="button" type="button" onClick={onAddOrderItem} disabled={saving}>ThÃªm sáº£n pháº©m</button>

              <label className="form-field">
                <small>Ghi chÃº Ä‘Æ¡n</small>
                <textarea value={orderNote} onChange={(event) => onOrderNoteChange(event.target.value)} placeholder="Ghi chÃº giao hÃ ng / cÃ´ng ná»£ / yÃªu cáº§u khÃ¡ch" />
              </label>
            </div>
          ) : (
            <div className="grid">
              <div className="metric-row"><span>Thao tÃ¡c</span><strong>{actionTitle(selection.action)}</strong></div>
              <div className="metric-row"><span>Khu vá»±c</span><strong>{selection.line.area}</strong></div>
              <div className="metric-row"><span>Nguá»“n khÃ¡ch</span><strong>{sourceLabel(selection.line.source)}</strong></div>
            </div>
          )}

          {message ? <p className="page-subtitle">{message}</p> : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}

function LineList({ lines, onOpen, onAction }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  if (lines.length === 0) return <EmptyPanel title="ChÆ°a cÃ³ dá»¯ liá»‡u" hint="Tab nÃ y sáº½ cÃ³ dá»¯ liá»‡u khi phiÃªn ngÃ y phÃ¡t sinh Ä‘Ãºng tráº¡ng thÃ¡i." />;
  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} />)}</div>;
}

export function McpSessionCompactView({ activeHref = "/visits", mcpDayData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<SessionTab>("customers");
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [orderItems, setOrderItems] = useState<OrderDraftItem[]>([emptyOrderItem()]);
  const [orderNote, setOrderNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  const run = mcpDayData.run;
  const resultLines = mcpDayData.lines.filter(hasLineResult);
  const addedLines = mcpDayData.lines.filter((line) => line.source === "added");
  const followupLines = mcpDayData.lines.filter((line) => Number(line.followupCount || 0) > 0);
  const counters = { customers: mcpDayData.lines.length, results: mcpDayData.results.length || resultLines.length, added: addedLines.length, followups: followupLines.length };
  const pendingCount = mcpDayData.lines.filter((line) => line.status === "pending").length;

  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) {
    setMessage(null);
    setSelectedLine(null);
    if (action === "order") {
      setOrderItems([emptyOrderItem()]);
      setOrderNote("");
    }
    setSelectedAction({ line, action });
  }

  function updateOrderItem(index: number, field: keyof OrderDraftItem, value: string) {
    setOrderItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function submitAction() {
    if (!selectedAction) return;
    const sessionCustomerId = selectedAction.line.sessionCustomerId || selectedAction.line.id;
    startSaving(async () => {
      try {
        setMessage(null);
        if (selectedAction.action === "order") {
          const items = toOrderPayloadItems(orderItems);
          if (items.length === 0) throw new Error("Cáº§n nháº­p Ã­t nháº¥t má»™t sáº£n pháº©m");
          await postMcpBackend("/api/backend/mcp-day/session-customer/order", { sessionCustomerId, items, note: orderNote, status: "confirmed" });
        } else if (selectedAction.action === "follow_up") {
          await postMcpBackend("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: `Theo dÃµi ${selectedAction.line.accountName}`, followupType: "general", priority: "medium", owner: run.owner, note: `Táº¡o viá»‡c tá»« MCP Day cho ${selectedAction.line.accountName}` });
        } else {
          const resultType = selectedAction.action === "market_report" ? "report" : selectedAction.action;
          await postMcpBackend("/api/backend/mcp-day/session-customer/result", { sessionCustomerId, resultType, note: mcpCustomerActionDescription(selectedAction.action), hasTest: resultType === "test" ? true : undefined, hasReport: resultType === "report" ? true : undefined });
        }
        setSelectedAction(null);
        setSelectedLine(null);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "KhÃ´ng lÆ°u Ä‘Æ°á»£c hÃ nh Ä‘á»™ng MCP");
      }
    });
  }

  return (
    <AppShell activeHref={activeHref}>
      <PageHeader eyebrow="PhiÃªn MCP ngÃ y" title={run.routeName} subtitle={`${run.date} Â· ${run.owner} Â· ${counters.customers} khÃ¡ch`} />
      <section className="mcp-gate-banner mcp-session-compact-head">
        <strong>{pendingCount} chá» xá»­ lÃ½</strong>
        <span>{counters.results} káº¿t quáº£ Â· {counters.added} phÃ¡t sinh Â· {counters.followups} follow-up Â· má»Ÿ lÃºc {run.openedAt}</span>
      </section>
      <div className="mcp-status-chips" role="tablist" aria-label="PhiÃªn MCP ngÃ y"><button className={tab === "customers" ? "active" : ""} type="button" onClick={() => setTab("customers")}>KhÃ¡ch <b>{counters.customers}</b></button><button className={tab === "results" ? "active" : ""} type="button" onClick={() => setTab("results")}>Káº¿t quáº£ <b>{counters.results}</b></button><button className={tab === "added" ? "active" : ""} type="button" onClick={() => setTab("added")}>PhÃ¡t sinh <b>{counters.added}</b></button><button className={tab === "followups" ? "active" : ""} type="button" onClick={() => setTab("followups")}>Follow-up <b>{counters.followups}</b></button></div>
      {tab === "customers" ? <LineList lines={mcpDayData.lines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      {tab === "results" ? (mcpDayData.results.length > 0 ? <div className="mcp-line-list">{mcpDayData.results.map((result) => <ResultCard key={result.id} result={result} />)}</div> : <LineList lines={resultLines} onOpen={setSelectedLine} onAction={openCustomerAction} />) : null}
      {tab === "added" ? <LineList lines={addedLines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      {tab === "followups" ? <LineList lines={followupLines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={openCustomerAction} />
      <CustomerActionSheet selection={selectedAction} saving={saving} message={message} orderItems={orderItems} orderNote={orderNote} onOrderItemChange={updateOrderItem} onAddOrderItem={() => setOrderItems((items) => [...items, emptyOrderItem()])} onRemoveOrderItem={(index) => setOrderItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} onOrderNoteChange={setOrderNote} onClose={() => { if (!saving) setSelectedAction(null); }} onSubmit={submitAction} />
    </AppShell>
  );
}

