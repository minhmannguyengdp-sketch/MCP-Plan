"use client";

import { useEffect, useMemo, useState } from "react";

const API = "/api/backend/mcp-report-settings";
const PRODUCTS_API = "/api/products/search";
const PRODUCT_CATEGORIES = ["Siro", "Sinh tố", "Trà", "Sữa", "Topping"];
const QUICK_NOTE_ITEMS = ["Chê giá", "Còn tồn", "Cần test", "Muốn đổi nguồn", "Cần báo giá", "Đang dùng đối thủ"];

type ApiItem = { id: string; key?: string; label: string; value?: string; category?: string; brandName?: string; productId?: string };
type ApiGroup = { id: string; key: string; title: string; items: ApiItem[] };
type ProductItem = { productId: string; name: string; brand?: string | null; category?: string | null };
export type MarketReportFieldValues = { priceSummary: string; displaySummary: string; stockSummary: string; demandSummary: string; opportunitySummary: string; riskSummary: string; nextAction: string; note: string };
export type ReportSettingSelection = { id: string; key: string; label: string; value: string; groupKey: string; groupTitle: string; category: string; brandName: string; productId: string };
export type MarketReportDraft = { fields: MarketReportFieldValues; selectedCompetitors: ReportSettingSelection[]; selectedUsedProducts: ReportSettingSelection[]; selectedSettingItems: ReportSettingSelection[] };

const FIELD_DEFS: Array<{ key: keyof MarketReportFieldValues; label: string; compact?: boolean }> = [
  { key: "priceSummary", label: "Giá / lý do", compact: true },
  { key: "demandSummary", label: "Nhu cầu", compact: true },
  { key: "nextAction", label: "Next action", compact: true },
  { key: "note", label: "Ghi chú thêm", compact: true },
  { key: "displaySummary", label: "Trưng bày" },
  { key: "stockSummary", label: "Tồn kho" },
  { key: "opportunitySummary", label: "Cơ hội" },
  { key: "riskSummary", label: "Rủi ro" }
];
const EMPTY_FIELDS: MarketReportFieldValues = { priceSummary: "", displaySummary: "", stockSummary: "", demandSummary: "", opportunitySummary: "", riskSummary: "", nextAction: "", note: "" };
let cachedGroups: ApiGroup[] | null = null;
let cachedCatalog: ProductItem[] | null = null;

export function emptyMarketReportDraft(): MarketReportDraft { return { fields: { ...EMPTY_FIELDS }, selectedCompetitors: [], selectedUsedProducts: [], selectedSettingItems: [] }; }
function norm(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d"); }
function isFieldGroup(group: Pick<ApiGroup, "key" | "title">) { const text = norm(`${group.key} ${group.title}`); return text.includes("report_fields") || text.includes("field"); }
function isCompetitorGroup(group: Pick<ApiGroup, "key" | "title"> | ReportSettingSelection) { const text = "groupKey" in group ? norm(`${group.groupKey} ${group.groupTitle}`) : norm(`${group.key} ${group.title}`); return text.includes("doi thu") || text.includes("competitor"); }
function isLegacyUsedProductGroup(group: Pick<ApiGroup, "key" | "title">) { const text = norm(`${group.key} ${group.title}`); return text.includes("sp dang dung") || text.includes("used_product"); }
function selectionFrom(group: ApiGroup, item: ApiItem): ReportSettingSelection { return { id: item.id, key: item.key || item.id, label: item.label, value: item.value || item.label, groupKey: group.key, groupTitle: group.title, category: item.category || "", brandName: item.brandName || "", productId: item.productId || "" }; }
function groupedLabels(items: ReportSettingSelection[]) { return items.reduce<Record<string, string[]>>((acc, item) => { acc[item.groupTitle] = [...(acc[item.groupTitle] || []), item.label]; return acc; }, {}); }
function isRealBrand(value?: string | null) { const text = String(value || "").trim(); return Boolean(text && !norm(text).includes("no brand") && !norm(text).includes("chua ro")); }
function chipLabel(item: ProductItem) { const brand = isRealBrand(item.brand) ? String(item.brand).trim() : String(item.name || "").trim(); return brand || item.productId; }
function uniqueCatalogSelections(products: ProductItem[]) {
  const seen = new Set<string>();
  return products
    .filter((item) => item.productId && item.name && item.category && PRODUCT_CATEGORIES.includes(String(item.category)))
    .map((item) => ({ item, label: chipLabel(item), category: String(item.category || "") }))
    .filter(({ label }) => label && label.length > 1)
    .filter(({ label, category }) => { const key = `${category}|${norm(label)}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(({ item, label, category }) => ({ id: `catalog_${category}_${norm(label)}`, key: `catalog_${category}_${norm(label)}`, label: `${category}: ${label}`, value: label, groupKey: "catalog_used_products", groupTitle: "Thương hiệu/sản phẩm đang dùng", category, brandName: isRealBrand(item.brand) ? String(item.brand) : label, productId: item.productId } satisfies ReportSettingSelection));
}

export function buildMarketReportContent(draft: MarketReportDraft) {
  const lines: string[] = [];
  if (draft.selectedCompetitors.length) lines.push(`Đối thủ: ${draft.selectedCompetitors.map((item) => item.label).join(", ")}`);
  Object.entries(groupedLabels(draft.selectedUsedProducts)).forEach(([group, labels]) => lines.push(`${group}: ${labels.join(", ")}`));
  FIELD_DEFS.forEach((field) => { const text = draft.fields[field.key].trim(); if (text) lines.push(`${field.label}: ${text}`); });
  return lines.join("\n");
}
export function marketReportHasInput(draft: MarketReportDraft) { return buildMarketReportContent(draft).trim().length > 0; }
async function loadGroups() { if (cachedGroups) return cachedGroups; const response = await fetch(`${API}?groupType=market_report`, { cache: "no-store", headers: { Accept: "application/json" } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Không tải được MCP Setting"); cachedGroups = Array.isArray(payload.data?.groups) ? payload.data.groups : []; return cachedGroups; }
async function loadCatalog() { if (cachedCatalog) return cachedCatalog; const response = await fetch(`${PRODUCTS_API}?limit=100`, { cache: "no-store", headers: { Accept: "application/json" } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || "Không tải được sản phẩm"); cachedCatalog = Array.isArray(payload.data) ? payload.data : []; return cachedCatalog; }

export function McpMarketReportFields({ value, onChange, saving }: { value: MarketReportDraft; onChange: (value: MarketReportDraft) => void; saving: boolean }) {
  const [groups, setGroups] = useState<ApiGroup[]>(cachedGroups || []);
  const [catalog, setCatalog] = useState<ProductItem[]>(cachedCatalog || []);
  const [loading, setLoading] = useState(!cachedGroups || !cachedCatalog);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; Promise.all([loadGroups(), loadCatalog()]).then(([nextGroups, nextCatalog]) => { if (!active) return; setGroups(nextGroups || []); setCatalog(nextCatalog || []); setError(null); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Không tải được dữ liệu tick"); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const competitorGroups = useMemo(() => groups.filter((group) => !isFieldGroup(group) && !isLegacyUsedProductGroup(group) && isCompetitorGroup(group) && group.items.length > 0), [groups]);
  const catalogSelections = useMemo(() => uniqueCatalogSelections(catalog), [catalog]);
  const selectedIds = useMemo(() => new Set(value.selectedSettingItems.map((item) => item.id)), [value.selectedSettingItems]);
  function updateField(key: keyof MarketReportFieldValues, text: string) { onChange({ ...value, fields: { ...value.fields, [key]: text } }); }
  function applySelection(picked: ReportSettingSelection) { const nextAll = selectedIds.has(picked.id) ? value.selectedSettingItems.filter((selected) => selected.id !== picked.id) : [...value.selectedSettingItems, picked]; onChange({ ...value, selectedSettingItems: nextAll, selectedCompetitors: nextAll.filter(isCompetitorGroup), selectedUsedProducts: nextAll.filter((selected) => !isCompetitorGroup(selected) && selected.groupKey !== "quick_notes") }); }
  function toggle(group: ApiGroup, item: ApiItem) { applySelection(selectionFrom(group, item)); }
  function toggleQuickNote(label: string) { const current = value.fields.note.trim(); const exists = current.split(/[,\n]/).map((x) => x.trim()).includes(label); const next = exists ? current.split(/[,\n]/).map((x) => x.trim()).filter((x) => x && x !== label).join(", ") : [current, label].filter(Boolean).join(", "); updateField("note", next); }
  return <div className="report-popup-grid"><section className="report-quick-panel"><div className="report-section-head"><strong>Tick nhanh báo cáo</strong><small>Tick thương hiệu/sản phẩm thật, ghi chú ngắn nếu cần.</small></div>{loading ? <p className="page-subtitle">Đang tải dữ liệu tick...</p> : null}{error ? <p className="page-subtitle order-message">{error}</p> : null}{competitorGroups.map((group) => <div className="report-quick-group" key={group.id}><strong>Đối thủ</strong><div className="report-chip-grid">{group.items.map((item) => <label className={selectedIds.has(item.id) ? "report-chip selected" : "report-chip"} key={item.id}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(group, item)} disabled={saving} />{item.label}</label>)}</div></div>)}<div className="report-quick-group"><strong>Thương hiệu/sản phẩm khách đang dùng</strong><div className="report-chip-grid">{catalogSelections.map((item) => <label className={selectedIds.has(item.id) ? "report-chip selected" : "report-chip"} key={item.id}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => applySelection(item)} disabled={saving} />{item.label}</label>)}</div>{!loading && catalogSelections.length === 0 ? <p className="page-subtitle">Chưa lấy được sản phẩm từ catalog.</p> : null}</div><div className="report-quick-group"><strong>Ghi chú nhanh</strong><div className="report-chip-grid">{QUICK_NOTE_ITEMS.map((label) => { const active = value.fields.note.includes(label); return <button className={active ? "report-chip selected" : "report-chip"} key={label} type="button" onClick={() => toggleQuickNote(label)} disabled={saving}>{label}</button>; })}</div></div></section><section className="report-field-panel"><div className="report-section-head"><strong>Ghi thêm</strong><small>Ô trống sẽ không lưu vào summary.</small></div><div className="report-field-grid">{FIELD_DEFS.map((field) => <label className="form-field report-field" key={field.key}><small>{field.label}</small><textarea rows={field.compact ? 2 : 2} value={value.fields[field.key]} onChange={(event) => updateField(field.key, event.target.value)} disabled={saving} /></label>)}</div></section></div>;
}
