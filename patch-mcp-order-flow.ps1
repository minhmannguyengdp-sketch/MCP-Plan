param(
  [string]$ProjectRoot = "F:\1_A_Disk_D\Tool\mcp-plan"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ProjectRoot)) {
  throw "Khong tim thay project root: $ProjectRoot"
}

Set-Location $ProjectRoot

$backendPath = Join-Path $ProjectRoot "apps\backend\server.js"
$uiPath = Join-Path $ProjectRoot "src\features\mcp\McpSessionCompactView.tsx"

if (-not (Test-Path $backendPath)) {
  throw "Khong tim thay file backend: $backendPath"
}
if (-not (Test-Path $uiPath)) {
  throw "Khong tim thay file UI: $uiPath"
}

$backupDir = Join-Path $ProjectRoot (".patch-backup-mcp-order-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item $backendPath (Join-Path $backupDir "server.js.bak")
Copy-Item $uiPath (Join-Path $backupDir "McpSessionCompactView.tsx.bak")

Write-Host "Backup da tao: $backupDir"

$backend = Get-Content -Raw -Encoding UTF8 $backendPath

$helper = @'
async function supabaseRpc(functionName, args = {}) {
  assertSupabaseConfig();
  const response = await fetch(new URL(`/rest/v1/rpc/${functionName}`, SUPABASE_URL), {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(args)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "supabase_rpc_failed");
    error.statusCode = response.status || 502;
    error.detail = payload?.details || payload?.hint || payload?.raw || text;
    throw error;
  }

  return payload;
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest("order_items_required");

  return items.map((item) => {
    const productName = String(item.productName || item.product_name || "").trim();
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
    const discount = Number(item.discount || 0);

    if (!productName) throw badRequest("product_name_required");
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("quantity_required");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest("invalid_unit_price");
    if (!Number.isFinite(discount) || discount < 0) throw badRequest("invalid_discount");

    return {
      productId: String(item.productId || item.product_id || "").trim() || null,
      productName,
      sku: String(item.sku || "").trim() || null,
      unit: String(item.unit || "").trim() || null,
      quantity,
      unitPrice,
      discount,
      note: String(item.note || "").trim() || null
    };
  });
}

async function createMcpSessionCustomerOrder(body) {
  const sessionCustomerId = String(body.sessionCustomerId || body.session_customer_id || body.id || "").trim();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");

  const items = normalizeOrderItems(body.items);
  const note = String(body.note || "").trim();
  const status = String(body.status || "confirmed").trim() || "confirmed";

  return supabaseRpc("mcp_create_order_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_items: items,
    p_note: note || null,
    p_status: status
  });
}

'@

if ($backend -notmatch "async function supabaseRpc") {
  $anchor = "`nfunction randomId(prefix)"
  $index = $backend.IndexOf($anchor)
  if ($index -lt 0) {
    throw "Khong tim thay anchor function randomId(prefix) trong server.js"
  }
  $backend = $backend.Substring(0, $index) + "`n" + $helper + $backend.Substring($index)
  Write-Host "Da chen supabaseRpc + createMcpSessionCustomerOrder"
} else {
  Write-Host "Backend helper da ton tai, bo qua chen helper"
}

if ($backend -notmatch '/api/mcp-day/session-customer/order') {
  $old = 'if (url.pathname === "/api/mcp-day/session-customer/status") return wrap(await updateMcpSessionCustomerStatus(await readJsonBody(req)));'
  $new = $old + "`n  " + 'if (url.pathname === "/api/mcp-day/session-customer/order") return wrap(await createMcpSessionCustomerOrder(await readJsonBody(req)));'
  if (-not $backend.Contains($old)) {
    throw "Khong tim thay route status de chen route order"
  }
  $backend = $backend.Replace($old, $new)
  Write-Host "Da chen backend route /api/mcp-day/session-customer/order"
} else {
  Write-Host "Backend route order da ton tai, bo qua"
}

Set-Content -Path $backendPath -Encoding UTF8 -Value $backend

$ui = @'
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
  if (action === "order") return "Tạo đơn hàng";
  if (action === "test") return "Ghi nhận có test";
  if (action === "market_report") return "Ghi báo cáo thị trường";
  return "Tạo việc follow-up";
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
    throw new Error(errorPayload.error || errorPayload.detail || "Không lưu được hành động MCP");
  }
  return payload;
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function ResultCard({ result }: { result: McpDayResult }) {
  return <OperationalListCard leading={<span>{result.startTime}</span>} eyebrow={`${result.startTime} · ${result.endTime}`} title={result.accountName} description={result.result} badge={<span className={result.hasOrder ? "dashboard-status status-good" : "dashboard-status status-watch"}>{result.hasOrder ? "Có đơn" : result.nextAction}</span>} meta={[result.hasTest ? "Có test" : "Chưa test", result.hasReport ? "Có báo cáo" : "Chưa báo cáo", `Follow-up ${Number(result.followupCount || 0)}`]} />;
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  return (
    <BottomSheet open={Boolean(line)} onClose={onClose} title={line ? line.accountName : "Xử lý điểm bán"} description={line ? `${line.area} · ${sourceLabel(line.source)}` : undefined} footer={line ? <div className="sheet-action-grid"><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Tạo đơn</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi có test</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Ghi báo cáo</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Tạo follow-up</button><button className="button" type="button" onClick={onClose}>Đóng</button></div> : undefined}>
      {line ? <div className="visit-sheet-content"><div className="visit-focus-card"><span>Trạng thái ghé</span><strong>{statusLabel(line.status)}</strong><small>{line.result ?? "Chưa ghi kết quả chi tiết"}</small></div><div className="grid"><div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(line.source)}</strong></div><div className="metric-row"><span>Khu vực</span><strong>{line.area}</strong></div><div className="metric-row"><span>Đơn hàng</span><strong>{line.hasOrder ? "Đã ghi có đơn" : "Chưa ghi đơn"}</strong></div><div className="metric-row"><span>Test sản phẩm</span><strong>{line.hasTest ? "Đã ghi test" : "Chưa ghi test"}</strong></div><div className="metric-row"><span>Báo cáo</span><strong>{line.hasReport ? "Đã ghi báo cáo" : "Chưa ghi báo cáo"}</strong></div><div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)} việc</strong></div></div></div> : null}
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
    <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "Hành động MCP"} description={selection ? selection.line.accountName : undefined} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : isOrder ? "Lưu đơn hàng" : "Lưu kết quả"}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>
      {selection ? (
        <div className="visit-sheet-content">
          <div className="visit-focus-card">
            <span>Điểm bán</span>
            <strong>{selection.line.accountName}</strong>
            <small>{isOrder ? "Tạo đơn hàng thật và link vào phiên MCP" : mcpCustomerActionDescription(selection.action)}</small>
          </div>

          {isOrder ? (
            <div className="grid">
              {orderItems.map((item, index) => (
                <div className="visit-focus-card" key={`order-item-${index}`}>
                  <span>Sản phẩm {index + 1}</span>
                  <label className="form-field">
                    <small>Tên sản phẩm</small>
                    <input value={item.productName} onChange={(event) => onOrderItemChange(index, "productName", event.target.value)} placeholder="VD: Trà sữa truyền thống" />
                  </label>
                  <label className="form-field">
                    <small>Số lượng</small>
                    <input inputMode="decimal" value={item.quantity} onChange={(event) => onOrderItemChange(index, "quantity", event.target.value)} />
                  </label>
                  <label className="form-field">
                    <small>Giá</small>
                    <input inputMode="decimal" value={item.unitPrice} onChange={(event) => onOrderItemChange(index, "unitPrice", event.target.value)} />
                  </label>
                  <label className="form-field">
                    <small>Đơn vị</small>
                    <input value={item.unit} onChange={(event) => onOrderItemChange(index, "unit", event.target.value)} placeholder="ly / gói / thùng" />
                  </label>
                  <label className="form-field">
                    <small>Ghi chú dòng</small>
                    <input value={item.note} onChange={(event) => onOrderItemChange(index, "note", event.target.value)} />
                  </label>
                  {orderItems.length > 1 ? <button className="button" type="button" onClick={() => onRemoveOrderItem(index)} disabled={saving}>Xóa dòng</button> : null}
                </div>
              ))}

              <button className="button" type="button" onClick={onAddOrderItem} disabled={saving}>Thêm sản phẩm</button>

              <label className="form-field">
                <small>Ghi chú đơn</small>
                <textarea value={orderNote} onChange={(event) => onOrderNoteChange(event.target.value)} placeholder="Ghi chú giao hàng / công nợ / yêu cầu khách" />
              </label>
            </div>
          ) : (
            <div className="grid">
              <div className="metric-row"><span>Thao tác</span><strong>{actionTitle(selection.action)}</strong></div>
              <div className="metric-row"><span>Khu vực</span><strong>{selection.line.area}</strong></div>
              <div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(selection.line.source)}</strong></div>
            </div>
          )}

          {message ? <p className="page-subtitle">{message}</p> : null}
        </div>
      ) : null}
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
          if (items.length === 0) throw new Error("Cần nhập ít nhất một sản phẩm");
          await postMcpBackend("/api/backend/mcp-day/session-customer/order", { sessionCustomerId, items, note: orderNote, status: "confirmed" });
        } else if (selectedAction.action === "follow_up") {
          await postMcpBackend("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: `Theo dõi ${selectedAction.line.accountName}`, followupType: "general", priority: "medium", owner: run.owner, note: `Tạo việc từ MCP Day cho ${selectedAction.line.accountName}` });
        } else {
          const resultType = selectedAction.action === "market_report" ? "report" : selectedAction.action;
          await postMcpBackend("/api/backend/mcp-day/session-customer/result", { sessionCustomerId, resultType, note: mcpCustomerActionDescription(selectedAction.action), hasTest: resultType === "test" ? true : undefined, hasReport: resultType === "report" ? true : undefined });
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
      {tab === "customers" ? <LineList lines={mcpDayData.lines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      {tab === "results" ? (mcpDayData.results.length > 0 ? <div className="mcp-line-list">{mcpDayData.results.map((result) => <ResultCard key={result.id} result={result} />)}</div> : <LineList lines={resultLines} onOpen={setSelectedLine} onAction={openCustomerAction} />) : null}
      {tab === "added" ? <LineList lines={addedLines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      {tab === "followups" ? <LineList lines={followupLines} onOpen={setSelectedLine} onAction={openCustomerAction} /> : null}
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={openCustomerAction} />
      <CustomerActionSheet selection={selectedAction} saving={saving} message={message} orderItems={orderItems} orderNote={orderNote} onOrderItemChange={updateOrderItem} onAddOrderItem={() => setOrderItems((items) => [...items, emptyOrderItem()])} onRemoveOrderItem={(index) => setOrderItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} onOrderNoteChange={setOrderNote} onClose={() => { if (!saving) setSelectedAction(null); }} onSubmit={submitAction} />
    </AppShell>
  );
}

'@

Set-Content -Path $uiPath -Encoding UTF8 -Value $ui
Write-Host "Da thay UI McpSessionCompactView bang ban co form don hang"

Write-Host ""
Write-Host "XONG PATCH. Gio chay tiep:"
Write-Host "npm run build"
Write-Host "git diff -- apps/backend/server.js src/features/mcp/McpSessionCompactView.tsx"
Write-Host "git add ."
Write-Host 'git commit -m "feat: add MCP order form flow"'
Write-Host "git push origin main"
