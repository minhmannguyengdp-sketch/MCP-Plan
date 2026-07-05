"use client";

import { useEffect, useMemo, useState } from "react";

const API = "/api/mcp-report-settings";

type ApiItem = { id: string; key?: string; label: string; value?: string; category?: string; brandName?: string; productId?: string };
type ApiGroup = { id: string; key: string; title: string; items: ApiItem[] };
export type MarketReportFieldValues = { priceSummary: string; displaySummary: string; stockSummary: string; demandSummary: string; opportunitySummary: string; riskSummary: string; nextAction: string; note: string };
export type ReportSettingSelection = { id: string; key: string; label: string; value: string; groupKey: string; groupTitle: string; category: string; brandName: string; productId: string };
export type MarketReportDraft = { fields: MarketReportFieldValues; selectedCompetitors: ReportSettingSelection[]; selectedUsedProducts: ReportSettingSelection[]; selectedSettingItems: ReportSettingSelection[] };

const FIELD_DEFS: Array<{ key: keyof MarketReportFieldValues; label: string }> = [
  { key: "priceSummary", label: "Giá bán / giá đối thủ" },
  { key: "displaySummary", label: "Trưng bày" },
  { key: "stockSummary", label: "Tồn kho" },
  { key: "demandSummary", label: "Nhu cầu" },
  { key: "opportunitySummary", label: "Cơ hội" },
  { key: "riskSummary", label: "Rủi ro" },
  { key: "nextAction", label: "Next action" },
  { key: "note", label: "Ghi chú thêm" }
];
const EMPTY_FIELDS: MarketReportFieldValues = { priceSummary: "", displaySummary: "", stockSummary: "", demandSummary: "", opportunitySummary: "", riskSummary: "", nextAction: "", note: "" };
let cachedGroups: ApiGroup[] | null = null;

export function emptyMarketReportDraft(): MarketReportDraft {
  return { fields: { ...EMPTY_FIELDS }, selectedCompetitors: [], selectedUsedProducts: [], selectedSettingItems: [] };
}
function norm(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d"); }
function isFieldGroup(group: Pick<ApiGroup, "key" | "title">) { const text = norm(`${group.key} ${group.title}`); return text.includes("report_fields") || text.includes("field"); }
function isCompetitorGroup(group: Pick<ApiGroup, "key" | "title"> | ReportSettingSelection) { const text = "groupKey" in group ? norm(`${group.groupKey} ${group.groupTitle}`) : norm(`${group.key} ${group.title}`); return text.includes("doi thu") || text.includes("competitor"); }
function selectionFrom(group: ApiGroup, item: ApiItem): ReportSettingSelection { return { id: item.id, key: item.key || item.id, label: item.label, value: item.value || item.label, groupKey: group.key, groupTitle: group.title, category: item.category || "", brandName: item.brandName || "", productId: item.productId || "" }; }
function groupedLabels(items: ReportSettingSelection[]) { return items.reduce<Record<string, string[]>>((acc, item) => { acc[item.groupTitle] = [...(acc[item.groupTitle] || []), item.label]; return acc; }, {}); }

export function buildMarketReportContent(draft: MarketReportDraft) {
  const lines: string[] = [];
  if (draft.selectedCompetitors.length) lines.push(`Đối thủ: ${draft.selectedCompetitors.map((item) => item.label).join(", ")}`);
  Object.entries(groupedLabels(draft.selectedUsedProducts)).forEach(([group, labels]) => lines.push(`${group}: ${labels.join(", ")}`));
  FIELD_DEFS.forEach((field) => { const text = draft.fields[field.key].trim(); if (text) lines.push(`${field.label}: ${text}`); });
  return lines.join("\n");
}
export function marketReportHasInput(draft: MarketReportDraft) { return buildMarketReportContent(draft).trim().length > 0; }

async function loadGroups() {
  if (cachedGroups) return cachedGroups;
  const response = await fetch(`${API}?groupType=market_report`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Không tải được MCP Setting");
  cachedGroups = Array.isArray(payload.data?.groups) ? payload.data.groups : [];
  return cachedGroups;
}

export function McpMarketReportFields({ value, onChange, saving }: { value: MarketReportDraft; onChange: (value: MarketReportDraft) => void; saving: boolean }) {
  const [groups, setGroups] = useState<ApiGroup[]>(cachedGroups || []);
  const [loading, setLoading] = useState(!cachedGroups);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; loadGroups().then((nextGroups) => { if (!active) return; setGroups(nextGroups || []); setError(null); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Không tải được MCP Setting"); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const settingGroups = useMemo(() => groups.filter((group) => !isFieldGroup(group) && group.items.length > 0), [groups]);
  const selectedIds = useMemo(() => new Set(value.selectedSettingItems.map((item) => item.id)), [value.selectedSettingItems]);
  function updateField(key: keyof MarketReportFieldValues, text: string) { onChange({ ...value, fields: { ...value.fields, [key]: text } }); }
  function toggle(group: ApiGroup, item: ApiItem) { const picked = selectionFrom(group, item); const nextAll = selectedIds.has(picked.id) ? value.selectedSettingItems.filter((selected) => selected.id !== picked.id) : [...value.selectedSettingItems, picked]; onChange({ ...value, selectedSettingItems: nextAll, selectedCompetitors: nextAll.filter(isCompetitorGroup), selectedUsedProducts: nextAll.filter((selected) => !isCompetitorGroup(selected)) }); }
  return <div className="grid"><section className="card report-quick-panel" style={{ padding: 10, display: "grid", gap: 10 }}><div><strong>Tick nhanh báo cáo</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>Lưu kèm ID mẫu vào raw_payload.</p></div>{loading ? <p className="page-subtitle">Đang tải mẫu báo cáo...</p> : null}{error ? <p className="page-subtitle order-message">{error}</p> : null}{settingGroups.map((group) => <div className="report-quick-group" key={group.id}><strong>{group.title}</strong><div className="mcp-status-chips">{group.items.map((item) => <label className="button" key={item.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(group, item)} disabled={saving} />{item.label}</label>)}</div></div>)}{!loading && settingGroups.length === 0 ? <p className="page-subtitle">Chưa có mẫu tick nhanh đang bật.</p> : null}</section><section className="card report-quick-panel" style={{ padding: 10, display: "grid", gap: 10 }}><div><strong>Field báo cáo</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>Phần trống sẽ không lưu vào summary.</p></div><div className="grid">{FIELD_DEFS.map((field) => <label className="form-field" key={field.key}><small>{field.label}</small><textarea value={value.fields[field.key]} onChange={(event) => updateField(field.key, event.target.value)} disabled={saving} /></label>)}</div></section></div>;
}
