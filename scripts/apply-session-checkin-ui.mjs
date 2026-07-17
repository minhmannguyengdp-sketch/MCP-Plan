import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`source_mismatch:${path}:${count}:${before.slice(0, 80)}`);
  await writeFile(path, source.replace(before, after), "utf8");
}

const viewPath = "src/features/mcp/McpSessionCompactViewFinal2.tsx";

await replaceOnce(
  viewPath,
  'import { BottomSheet } from "@/ui/overlay/BottomSheet";\n',
  'import { BottomSheet } from "@/ui/overlay/BottomSheet";\nimport { idempotentMutationFetch } from "@/lib/api/idempotent-fetch";\n'
);

await replaceOnce(
  viewPath,
  'import { McpMarketReportFields, buildMarketReportContent, emptyMarketReportDraft, marketReportHasInput, type MarketReportDraft } from "./McpMarketReportFields";\n',
  'import { McpMarketReportFields, buildMarketReportContent, emptyMarketReportDraft, marketReportHasInput, type MarketReportDraft } from "./McpMarketReportFields";\nimport popupStyles from "./McpSessionPopupCompact.module.css";\n'
);

await replaceOnce(
  viewPath,
  `async function getVariants(productId: string) {
  const response = await fetch(\`/api/products/\${encodeURIComponent(productId)}/variants\`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = payload as { error?: string; detail?: string };
    throw new Error(err.error || err.detail || "Không tải được quy cách sản phẩm");
  }
  return normalizeCatalogItems((payload as { data?: unknown }).data);
}
`,
  `async function getVariants(productId: string) {
  const response = await fetch(\`/api/products/\${encodeURIComponent(productId)}/variants\`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = payload as { error?: string; detail?: string };
    throw new Error(err.error || err.detail || "Không tải được quy cách sản phẩm");
  }
  return normalizeCatalogItems((payload as { data?: unknown }).data);
}

type CheckinNotice = { kind: "success" | "error"; message: string };

function currentSalesPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Thiết bị hoặc trình duyệt không hỗ trợ định vị."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

function geolocationMessage(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) return "Chưa được cấp quyền định vị. Hãy bật quyền vị trí rồi bấm check-in lại.";
    if (error.code === error.POSITION_UNAVAILABLE) return "Thiết bị chưa lấy được vị trí hiện tại. Hãy đứng nơi thoáng và thử lại.";
    if (error.code === error.TIMEOUT) return "Lấy vị trí quá thời gian. Hãy thử lại tại điểm bán.";
  }
  return error instanceof Error ? error.message : "Không lấy được vị trí hiện tại.";
}

async function saveManualCheckin(line: McpDayLine, checkedIn: boolean, position?: GeolocationPosition) {
  const sessionCustomerId = line.sessionCustomerId || line.id;
  const response = await idempotentMutationFetch(
    "/api/backend/mcp-day/session-customer/checkin",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(checkedIn ? {
        sessionCustomerId,
        checkedIn: true,
        geoLat: position?.coords.latitude,
        geoLng: position?.coords.longitude,
        geoAccuracy: position?.coords.accuracy,
        geoSource: "browser_manual"
      } : {
        sessionCustomerId,
        checkedIn: false
      })
    },
    { operation: "session-customer.checkin.set" }
  );
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; detail?: string };
  if (!response.ok) throw new Error(payload.error?.message || payload.detail || "Không lưu được check-in.");
  return payload;
}
`
);

await replaceOnce(
  viewPath,
  'function LineList({ lines, onOpen, onAction }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {\n  if (lines.length === 0) return <div className="empty-inline"><strong>Chưa có dữ liệu</strong><p className="page-subtitle">Tab này chưa có khách phù hợp.</p></div>;\n  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} />)}</div>;\n}\n',
  'function LineList({ lines, onOpen, onAction, onToggleCheckin, checkinBusyIds }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void; onToggleCheckin: (line: McpDayLine) => void; checkinBusyIds: Set<string> }) {\n  if (lines.length === 0) return <div className="empty-inline"><strong>Chưa có dữ liệu</strong><p className="page-subtitle">Tab này chưa có khách phù hợp.</p></div>;\n  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} onToggleCheckin={onToggleCheckin} checkinBusy={checkinBusyIds.has(line.sessionCustomerId || line.id)} />)}</div>;\n}\n'
);

await replaceOnce(
  viewPath,
  '    <BottomSheet open={Boolean(line)} onClose={onClose} title={line.accountName} description={`${line.area} · ${sourceLabel(line.source)}`} footer={<div className="sheet-action-grid"><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Tạo đơn</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Thử sản phẩm</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Quan sát</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Theo dõi</button><button className="button" type="button" onClick={() => onAction(line, "skip")}>Bỏ qua / không mua</button><button className="button" type="button" onClick={onClose}>Đóng</button></div>}>\n',
  '    <BottomSheet variant="compact" open={Boolean(line)} onClose={onClose} title={line.accountName} description={`${line.area} · ${sourceLabel(line.source)}`} footer={<div className={popupStyles.customerFooter}><button className="button primary" type="button" onClick={() => onAction(line, "order")}>Tạo đơn</button><button className="button" type="button" onClick={() => onAction(line, "test")}>Thử sản phẩm</button><button className="button" type="button" onClick={() => onAction(line, "market_report")}>Quan sát</button><button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Theo dõi</button><button className="button" type="button" onClick={() => onAction(line, "skip")}>Bỏ qua</button><button className="button" type="button" onClick={onClose}>Đóng</button></div>}>\n'
);

await replaceOnce(
  viewPath,
  '  return <BottomSheet open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "Thao tác tại điểm bán"} description={selection ? selection.line.accountName : undefined} footer={<div className={isOrder ? "sheet-action-grid order-sheet-footer" : "sheet-action-grid"}>{isOrder ? <div className="order-footer-total">Tổng: <strong>{formatMoney(orderTotal)}</strong></div> : null}<button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : actionSaveLabel(selection?.action)}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>{selection ? <div className={isOrder ? "visit-sheet-content order-action-content" : "visit-sheet-content"}><div className="visit-focus-card"><span>Khách</span><strong>{selection.line.accountName}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div><ActionFields action={selection.action} draft={draft} marketReport={marketReport} productSearch={productSearch} orderItems={orderItems} orderTotal={orderTotal} saving={saving} onChange={onChange} onMarketReportChange={onMarketReportChange} onSearchChange={onSearchChange} onCategoryChange={onCategoryChange} onRunSearch={onRunSearch} onPickProduct={onPickProduct} onCommitPickerItems={onCommitPickerItems} onRemoveOrderItem={onRemoveOrderItem} onChangeItemQuantity={onChangeItemQuantity} />{message ? <p className="page-subtitle order-message">{message}</p> : null}</div> : null}</BottomSheet>;\n',
  '  return <BottomSheet variant={isOrder ? "default" : "compact"} open={Boolean(selection)} onClose={onClose} title={selection ? actionTitle(selection.action) : "Thao tác tại điểm bán"} description={selection ? selection.line.accountName : undefined} footer={<div className={isOrder ? "sheet-action-grid order-sheet-footer" : popupStyles.footer}>{isOrder ? <div className="order-footer-total">Tổng: <strong>{formatMoney(orderTotal)}</strong></div> : null}<button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : actionSaveLabel(selection?.action)}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}>{selection ? <div className={isOrder ? "visit-sheet-content order-action-content" : `visit-sheet-content ${popupStyles.content}`}><div className="visit-focus-card"><span>Khách</span><strong>{selection.line.accountName}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div><ActionFields action={selection.action} draft={draft} marketReport={marketReport} productSearch={productSearch} orderItems={orderItems} orderTotal={orderTotal} saving={saving} onChange={onChange} onMarketReportChange={onMarketReportChange} onSearchChange={onSearchChange} onCategoryChange={onCategoryChange} onRunSearch={onRunSearch} onPickProduct={onPickProduct} onCommitPickerItems={onCommitPickerItems} onRemoveOrderItem={onRemoveOrderItem} onChangeItemQuantity={onChangeItemQuantity} />{message ? <p className="page-subtitle order-message">{message}</p> : null}</div> : null}</BottomSheet>;\n'
);

await replaceOnce(
  viewPath,
  '  const [message, setMessage] = useState<string | null>(null);\n  const [saving, startSaving] = useTransition();\n',
  '  const [message, setMessage] = useState<string | null>(null);\n  const [checkinBusyIds, setCheckinBusyIds] = useState<Set<string>>(new Set());\n  const [checkinNotice, setCheckinNotice] = useState<CheckinNotice | null>(null);\n  const [saving, startSaving] = useTransition();\n'
);

await replaceOnce(
  viewPath,
  '  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) { setMessage(null); setSelectedLine(null); setDraft(emptyDraft(run.owner || "")); setMarketReport(emptyMarketReportDraft()); setProductSearch(emptyProductSearchState()); setOrderItems([]); setSelectedAction({ line, action }); if (action === "order") void loadProducts("", ""); }\n\n  function submitAction() {\n',
  '  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) { setMessage(null); setSelectedLine(null); setDraft(emptyDraft(run.owner || "")); setMarketReport(emptyMarketReportDraft()); setProductSearch(emptyProductSearchState()); setOrderItems([]); setSelectedAction({ line, action }); if (action === "order") void loadProducts("", ""); }\n\n  async function toggleCustomerCheckin(line: McpDayLine) {\n    const sessionCustomerId = line.sessionCustomerId || line.id;\n    if (checkinBusyIds.has(sessionCustomerId)) return;\n    setCheckinNotice(null);\n    setCheckinBusyIds((current) => new Set(current).add(sessionCustomerId));\n    try {\n      if (line.checkedIn) {\n        await saveManualCheckin(line, false);\n        setCheckinNotice({ kind: "success", message: `Đã bỏ check-in của ${line.accountName}.` });\n      } else {\n        const position = await currentSalesPosition();\n        await saveManualCheckin(line, true, position);\n        setCheckinNotice({ kind: "success", message: `Đã check-in vị trí hiện tại tại ${line.accountName} · sai số khoảng ${Math.round(position.coords.accuracy)}m.` });\n      }\n      router.refresh();\n    } catch (error) {\n      setCheckinNotice({ kind: "error", message: geolocationMessage(error) });\n    } finally {\n      setCheckinBusyIds((current) => { const next = new Set(current); next.delete(sessionCustomerId); return next; });\n    }\n  }\n\n  function submitAction() {\n'
);

await replaceOnce(
  viewPath,
  '<LineList lines={linesByTab[tab]} onOpen={setSelectedLine} onAction={openCustomerAction} />',
  '{checkinNotice ? <p className={`${popupStyles.notice} ${checkinNotice.kind === "error" ? popupStyles.noticeError : ""}`}>{checkinNotice.message}</p> : null}<LineList lines={linesByTab[tab]} onOpen={setSelectedLine} onAction={openCustomerAction} onToggleCheckin={toggleCustomerCheckin} checkinBusyIds={checkinBusyIds} />'
);

const serverPath = "apps/backend/server.js";
await replaceOnce(
  serverPath,
  'select: "id,session_id,route_id,route_customer_id,customer_id,customer_name,phone,area,address,sort_order,source,planned_status,visit_status,status_reason,visit_id,order_id,test_id,report_id,followup_count,note,created_at,updated_at",',
  'select: "id,session_id,route_id,route_customer_id,customer_id,customer_name,phone,area,address,sort_order,source,planned_status,visit_status,status_reason,visit_id,order_id,test_id,report_id,followup_count,note,checkin_lat,checkin_lng,checkin_accuracy,checkin_at,checkin_source,created_at,updated_at",'
);

await replaceOnce(
  serverPath,
  '      followupCount,\n      visitId: visit?.id || snapshot.visit_id || undefined\n',
  '      followupCount,\n      visitId: visit?.id || snapshot.visit_id || undefined,\n      checkedIn: Boolean(snapshot.checkin_at),\n      checkinAt: snapshot.checkin_at || undefined,\n      checkinLat: snapshot.checkin_lat == null ? undefined : numberValue(snapshot.checkin_lat),\n      checkinLng: snapshot.checkin_lng == null ? undefined : numberValue(snapshot.checkin_lng),\n      checkinAccuracy: snapshot.checkin_accuracy == null ? undefined : numberValue(snapshot.checkin_accuracy),\n      checkinSource: snapshot.checkin_source || undefined\n'
);

console.log("session_checkin_ui_transform=OK");
