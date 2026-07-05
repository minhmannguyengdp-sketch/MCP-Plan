"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/ui/layout/PageHeader";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import { AppShell } from "@/ui/shell/AppShell";
import type { McpDayData, McpDayLine } from "@/features/mcp-day/mcp-day.types";
import type { RouteCustomersData } from "@/features/mcp/route-customers.types";
import type { RoutesData } from "@/features/routes/routes.types";
import { McpLineCard } from "./McpLineCard";
import { mcpCustomerActionDescription, type McpCustomerAction } from "./mcp-customer-actions";

type SessionTab = "all" | "pending" | "visited" | "skipped" | "added" | "followups";

type ActionDraft = {
  productName: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  note: string;
  reportType: string;
  templateId: string;
  priceSummary: string;
  competitorSummary: string;
  displaySummary: string;
  stockSummary: string;
  demandSummary: string;
  opportunitySummary: string;
  riskSummary: string;
  nextAction: string;
  dueDate: string;
  priority: string;
  owner: string;
  skipReason: string;
  selectedCompetitorIds: string[];
  selectedProductIds: string[];
};

type ProductCatalogItem = {
  productId: string;
  variantId: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  variantName?: string | null;
  sizeLabel?: string | null;
  sellUnit?: string | null;
  packUnit?: string | null;
  packQuantity?: number | null;
  price?: number | null;
};

type ProductSearchState = {
  q: string;
  category: string;
  loading: boolean;
  variantsLoading: boolean;
  results: ProductCatalogItem[];
  variants: ProductCatalogItem[];
  selectedProductId: string;
  selectedVariant: ProductCatalogItem | null;
  error: string | null;
};

type OrderDraftItem = ProductCatalogItem & {
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

type ReportTemplate = {
  id: string;
  title: string;
  reportType?: string;
  scopeType?: string;
  content?: string;
  priceSummary?: string;
  competitorSummary?: string;
  displaySummary?: string;
  stockSummary?: string;
  demandSummary?: string;
  opportunitySummary?: string;
  riskSummary?: string;
  nextAction?: string;
};

type ReportCompetitor = {
  id: string;
  competitorName: string;
  brandName?: string | null;
  category?: string | null;
  area?: string | null;
};

type ReportProduct = {
  id: string;
  productId?: string | null;
  productName: string;
  brandName?: string | null;
  source?: string | null;
  note?: string | null;
};

type ReportContext = {
  loading: boolean;
  competitors: ReportCompetitor[];
  usedProducts: ReportProduct[];
  templates: ReportTemplate[];
};

function emptyDraft(owner = ""): ActionDraft {
  return {
    productName: "",
    quantity: "1",
    unitPrice: "0",
    unit: "",
    note: "",
    reportType: "price",
    templateId: "",
    priceSummary: "",
    competitorSummary: "",
    displaySummary: "",
    stockSummary: "",
    demandSummary: "",
    opportunitySummary: "",
    riskSummary: "",
    nextAction: "",
    dueDate: "",
    priority: "medium",
    owner,
    skipReason: "",
    selectedCompetitorIds: [],
    selectedProductIds: []
  };
}

function emptyProductSearchState(): ProductSearchState {
  return { q: "", category: "", loading: false, variantsLoading: false, results: [], variants: [], selectedProductId: "", selectedVariant: null, error: null };
}

function emptyReportContext(): ReportContext {
  return { loading: false, competitors: [], usedProducts: [], templates: [] };
}

function sourceLabel(source: McpDayLine["source"]) {
  if (source === "planned") return "Tuyến gốc";
  if (source === "added") return "Phát sinh";
  return "Đồng bộ";
}

function statusLabel(status: McpDayLine["status"]) {
  if (status === "pending") return "Chờ ghé";
  if (status === "visited") return "Đã ghé";
  if (status === "skipped") return "Bỏ qua / không mua";
  return "Hủy";
}

function actionTitle(action: McpCustomerAction) {
  if (action === "order") return "Tạo đơn hàng";
  if (action === "test") return "Ghi test sản phẩm";
  if (action === "market_report") return "Ghi báo cáo thị trường";
  if (action === "skip") return "Bỏ qua / không mua";
  return "Tạo việc follow-up";
}

function actionSaveLabel(action?: McpCustomerAction) {
  if (action === "order") return "Lưu đơn hàng";
  if (action === "test") return "Lưu test";
  if (action === "market_report") return "Lưu báo cáo";
  if (action === "skip") return "Lưu lý do bỏ qua";
  if (action === "follow_up") return "Lưu follow-up";
  return "Lưu kết quả";
}

function productSourceLabel(source?: string | null) {
  if (source === "bought") return "Đã mua";
  if (source === "tested") return "Đã test";
  if (source === "competitor") return "Đối thủ";
  if (source === "manual") return "Nhập tay";
  return "Đang dùng";
}

function joinUnique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join("; ");
}

function reportTemplateMatches(template: ReportTemplate, reportType: string) {
  return !template.reportType || template.reportType === reportType;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString("vi-VN")}đ`;
}

function variantLabel(item: ProductCatalogItem) {
  return [item.variantName, item.sizeLabel, item.packUnit && item.packQuantity ? `${item.packUnit} ${item.packQuantity}` : ""].filter(Boolean).join(" · ") || item.sku || item.variantId;
}

function productKey(item: ProductCatalogItem) {
  return `${item.name} ${item.brand || ""} ${item.category || ""} ${item.sku || ""}`.toLowerCase();
}

function normalizeCatalogItems(value: unknown): ProductCatalogItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<ProductCatalogItem>)
    .filter((item) => item.productId && item.variantId && item.name)
    .map((item) => ({
      productId: String(item.productId),
      variantId: String(item.variantId),
      name: String(item.name),
      brand: item.brand ?? null,
      category: item.category ?? null,
      sku: item.sku ?? null,
      variantName: item.variantName ?? null,
      sizeLabel: item.sizeLabel ?? null,
      sellUnit: item.sellUnit ?? null,
      packUnit: item.packUnit ?? null,
      packQuantity: item.packQuantity ?? null,
      price: Number(item.price || 0)
    }));
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

async function fetchProductSearch(q: string, category = ""): Promise<ProductCatalogItem[]> {
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", "100");
  if (category) params.set("category", category);
  const response = await fetch(`/api/products/search?${params.toString()}`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "Không tìm được sản phẩm");
  }
  return normalizeCatalogItems((payload as { data?: unknown }).data);
}

async function fetchProductVariants(productId: string): Promise<ProductCatalogItem[]> {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}/variants`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "Không tải được quy cách sản phẩm");
  }
  return normalizeCatalogItems((payload as { data?: unknown }).data);
}

async function fetchReportContext(sessionCustomerId: string): Promise<ReportContext> {
  const response = await fetch(`/api/mcp-report-context?sessionCustomerId=${encodeURIComponent(sessionCustomerId)}`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || errorPayload.detail || "Không tải được ngữ cảnh báo cáo");
  }
  const data = (payload as { data?: Partial<ReportContext> }).data || {};
  return {
    loading: false,
    competitors: Array.isArray(data.competitors) ? data.competitors : [],
    usedProducts: Array.isArray(data.usedProducts) ? data.usedProducts : [],
    templates: Array.isArray(data.templates) ? data.templates : []
  };
}

function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return <div className="empty-inline"><strong>{title}</strong><p className="page-subtitle">{hint}</p></div>;
}

function LineList({ lines, onOpen, onAction }: { lines: McpDayLine[]; onOpen: (line: McpDayLine) => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  if (lines.length === 0) return <EmptyPanel title="Chưa có dữ liệu" hint="Tab này sẽ có dữ liệu khi checklist phiên phát sinh đúng trạng thái." />;
  return <div className="mcp-line-list">{lines.map((line) => <McpLineCard key={line.id} line={line} onOpen={onOpen} onAction={onAction} />)}</div>;
}

function CustomerSheet({ line, onClose, onAction }: { line: McpDayLine | null; onClose: () => void; onAction: (line: McpDayLine, action: McpCustomerAction) => void }) {
  if (!line) return null;

  return (
    <BottomSheet
      open={Boolean(line)}
      onClose={onClose}
      title={line.accountName}
      description={`${line.area} · ${sourceLabel(line.source)}`}
      footer={
        <div className="sheet-action-grid">
          <button className="button primary" type="button" onClick={() => onAction(line, "order")}>Tạo đơn</button>
          <button className="button" type="button" onClick={() => onAction(line, "test")}>Ghi test</button>
          <button className="button" type="button" onClick={() => onAction(line, "market_report")}>Báo cáo</button>
          <button className="button" type="button" onClick={() => onAction(line, "follow_up")}>Follow-up</button>
          <button className="button" type="button" onClick={() => onAction(line, "skip")}>Bỏ qua / không mua</button>
          <button className="button" type="button" onClick={onClose}>Đóng</button>
        </div>
      }
    >
      <div className="visit-sheet-content">
        <div className="visit-focus-card"><span>Trạng thái</span><strong>{statusLabel(line.status)}</strong><small>{line.result || line.note || "Chưa ghi kết quả chi tiết"}</small></div>
        <div className="grid">
          <div className="metric-row"><span>Nguồn khách</span><strong>{sourceLabel(line.source)}</strong></div>
          <div className="metric-row"><span>Khu vực</span><strong>{line.area}</strong></div>
          <div className="metric-row"><span>Đơn hàng</span><strong>{line.hasOrder ? "Đã ghi đơn" : "Chưa ghi đơn"}</strong></div>
          <div className="metric-row"><span>Test sản phẩm</span><strong>{line.hasTest ? "Đã ghi test" : "Chưa ghi test"}</strong></div>
          <div className="metric-row"><span>Báo cáo</span><strong>{line.hasReport ? "Đã ghi báo cáo" : "Chưa ghi báo cáo"}</strong></div>
          <div className="metric-row"><span>Follow-up</span><strong>{Number(line.followupCount || 0)} việc</strong></div>
        </div>
      </div>
    </BottomSheet>
  );
}

function OrderFields({
  draft,
  productSearch,
  orderItems,
  orderTotal,
  saving,
  onChange,
  onSearchChange,
  onCategoryChange,
  onRunSearch,
  onPickProduct,
  onPickVariant,
  onAddItem,
  onRemoveItem
}: {
  draft: ActionDraft;
  productSearch: ProductSearchState;
  orderItems: OrderDraftItem[];
  orderTotal: number;
  saving: boolean;
  onChange: (field: keyof ActionDraft, value: string) => void;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onRunSearch: () => void;
  onPickProduct: (productId: string) => void;
  onPickVariant: (variant: ProductCatalogItem) => void;
  onAddItem: () => void;
  onRemoveItem: (variantId: string) => void;
}) {
  const products = productSearch.results.filter((item, index, values) => values.findIndex((candidate) => candidate.productId === item.productId) === index);
  const categories = Array.from(new Set(productSearch.results.map((item) => item.category).filter(Boolean) as string[])).slice(0, 12);
  const selectedVariant = productSearch.selectedVariant;

  return (
    <div className="order-builder order-builder-compact">
      <div className="order-picker-head">
        <label className="form-field order-search-field">
          <small>Gõ để lọc nhanh</small>
          <input
            value={productSearch.q}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onRunSearch(); } }}
            placeholder="Không biết tên thì bấm nhóm bên dưới"
            disabled={saving || productSearch.loading}
          />
        </label>
        <button className="button primary order-search-button" type="button" onClick={onRunSearch} disabled={saving || productSearch.loading}>{productSearch.loading ? "Đang tải..." : "Lọc"}</button>
      </div>

      <div className="catalog-strip" aria-label="Nhóm sản phẩm">
        <button className={!productSearch.category ? "catalog-chip active" : "catalog-chip"} type="button" onClick={() => onCategoryChange("")} disabled={saving || productSearch.loading}>Tất cả</button>
        {categories.map((category) => <button className={productSearch.category === category ? "catalog-chip active" : "catalog-chip"} type="button" key={category} onClick={() => onCategoryChange(category)} disabled={saving || productSearch.loading}>{category}</button>)}
      </div>

      {productSearch.error ? <p className="page-subtitle order-message">{productSearch.error}</p> : null}

      <div className="order-main-grid">
        <div className="order-product-pane">
          <div className="order-section-title"><strong>Chọn sản phẩm</strong><span>{productSearch.loading ? "Đang tải..." : `${products.length} mục`}</span></div>
          <div className="product-card-list compact">
            {products.length === 0 && !productSearch.loading ? <small className="page-subtitle">Chưa có sản phẩm. Bấm Tất cả hoặc nhập từ khóa khác.</small> : null}
            {products.map((item) => (
              <button className={productSearch.selectedProductId === item.productId ? "product-card active" : "product-card"} type="button" key={item.productId} onClick={() => onPickProduct(item.productId)} disabled={saving || productSearch.variantsLoading}>
                <strong>{item.name}</strong>
                <span>{item.brand || "Chưa brand"} · {item.category || "Chưa ngành"}</span>
                <small>{productSearch.results.filter((variant) => variant.productId === item.productId).length} quy cách · {item.sku}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="order-variant-pane">
          <div className="order-section-title"><strong>Quy cách</strong><span>{productSearch.variantsLoading ? "Đang tải..." : `${productSearch.variants.length}`}</span></div>
          <div className="variant-grid compact">
            {productSearch.variantsLoading ? <small className="page-subtitle">Đang tải quy cách...</small> : null}
            {!productSearch.variantsLoading && productSearch.selectedProductId && productSearch.variants.length === 0 ? <small className="page-subtitle">Sản phẩm này chưa có biến thể active.</small> : null}
            {productSearch.variants.map((variant) => (
              <button className={selectedVariant?.variantId === variant.variantId ? "variant-chip active" : "variant-chip"} type="button" key={variant.variantId} onClick={() => onPickVariant(variant)} disabled={saving}>
                <strong>{variantLabel(variant)}</strong>
                <span>{variant.sellUnit || "đv"} · {formatMoney(Number(variant.price || 0))}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="order-edit-grid compact">
        <label className="form-field"><small>SL</small><input inputMode="decimal" value={draft.quantity} onChange={(event) => onChange("quantity", event.target.value)} disabled={saving || !selectedVariant} /></label>
        <label className="form-field"><small>ĐVT</small><input value={draft.unit} readOnly placeholder="—" /></label>
        <label className="form-field"><small>Giá</small><input inputMode="decimal" value={draft.unitPrice} onChange={(event) => onChange("unitPrice", event.target.value)} disabled={saving || !selectedVariant} /></label>
        <button className="button primary" type="button" onClick={onAddItem} disabled={saving || !selectedVariant}>+ Thêm</button>
      </div>

      <div className="order-summary-list compact">
        {orderItems.length === 0 ? <small className="page-subtitle">Chưa có item trong đơn.</small> : null}
        {orderItems.map((item) => (
          <div className="order-summary-row" key={item.variantId}>
            <div>
              <strong>{item.name}</strong>
              <small>{variantLabel(item)} · {item.sku || item.variantId}</small>
            </div>
            <span>{item.quantity} {item.unit} × {formatMoney(item.unitPrice)}</span>
            <b>{formatMoney(item.lineTotal)}</b>
            <button className="button" type="button" onClick={() => onRemoveItem(item.variantId)} disabled={saving}>Xóa</button>
          </div>
        ))}
      </div>

      <label className="form-field order-note-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} placeholder="Giao hàng / công nợ / thời gian giao" /></label>
      <div className="order-total-row"><span>Tổng</span><strong>{formatMoney(orderTotal)}</strong></div>
    </div>
  );
}

function ReportContextFields({
  draft,
  reportContext,
  saving,
  onChange,
  onToggleCompetitor,
  onToggleProduct,
  onApplyTemplate
}: {
  draft: ActionDraft;
  reportContext: ReportContext;
  saving: boolean;
  onChange: (field: keyof ActionDraft, value: string) => void;
  onToggleCompetitor: (id: string) => void;
  onToggleProduct: (id: string) => void;
  onApplyTemplate: (id: string) => void;
}) {
  const templates = reportContext.templates.filter((template) => reportTemplateMatches(template, draft.reportType));

  return (
    <div className="grid">
      <label className="form-field">
        <small>Loại báo cáo</small>
        <select value={draft.reportType} onChange={(event) => onChange("reportType", event.target.value)} disabled={saving}>
          <option value="price">Giá</option>
          <option value="competitor">Đối thủ</option>
          <option value="display">Trưng bày</option>
          <option value="stock">Tồn kho</option>
          <option value="demand">Nhu cầu</option>
        </select>
      </label>

      <label className="form-field">
        <small>Chọn mẫu báo cáo</small>
        <select value={draft.templateId} onChange={(event) => onApplyTemplate(event.target.value)} disabled={saving || reportContext.loading}>
          <option value="">{reportContext.loading ? "Đang tải mẫu..." : "Không dùng mẫu"}</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.scopeType || "global"}</option>)}
        </select>
      </label>

      <label className="form-field"><small>Nội dung báo cáo</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} placeholder="Nội dung chính của báo cáo" /></label>
      <label className="form-field"><small>Giá</small><input value={draft.priceSummary} onChange={(event) => onChange("priceSummary", event.target.value)} placeholder="Giá hiện tại / ưu đãi / chênh lệch" /></label>
      <label className="form-field"><small>Đối thủ</small><input value={draft.competitorSummary} onChange={(event) => onChange("competitorSummary", event.target.value)} placeholder="Ghi chú đối thủ bổ sung" /></label>
      <label className="form-field"><small>Trưng bày</small><input value={draft.displaySummary} onChange={(event) => onChange("displaySummary", event.target.value)} /></label>
      <label className="form-field"><small>Tồn kho</small><input value={draft.stockSummary} onChange={(event) => onChange("stockSummary", event.target.value)} /></label>
      <label className="form-field"><small>Nhu cầu</small><input value={draft.demandSummary} onChange={(event) => onChange("demandSummary", event.target.value)} /></label>
      <label className="form-field"><small>Cơ hội</small><input value={draft.opportunitySummary} onChange={(event) => onChange("opportunitySummary", event.target.value)} /></label>
      <label className="form-field"><small>Rủi ro</small><input value={draft.riskSummary} onChange={(event) => onChange("riskSummary", event.target.value)} /></label>
      <label className="form-field"><small>Next action</small><input value={draft.nextAction} onChange={(event) => onChange("nextAction", event.target.value)} /></label>

      <div className="visit-focus-card">
        <span>Đối thủ chọn nhanh</span>
        <strong>{reportContext.loading ? "Đang tải..." : `${reportContext.competitors.length} lựa chọn`}</strong>
        <div className="sheet-action-grid">
          {reportContext.competitors.length === 0 && !reportContext.loading ? <small>Chưa có đối thủ master.</small> : null}
          {reportContext.competitors.map((item) => (
            <label className="button" key={item.id}>
              <input type="checkbox" checked={draft.selectedCompetitorIds.includes(item.id)} onChange={() => onToggleCompetitor(item.id)} disabled={saving} /> {item.competitorName}{item.category ? ` · ${item.category}` : ""}
            </label>
          ))}
        </div>
      </div>

      <div className="visit-focus-card">
        <span>Sản phẩm đang dùng / đã mua / đã test</span>
        <strong>{reportContext.loading ? "Đang tải..." : `${reportContext.usedProducts.length} sản phẩm`}</strong>
        <div className="sheet-action-grid">
          {reportContext.usedProducts.length === 0 && !reportContext.loading ? <small>Chưa có sản phẩm theo ngữ cảnh khách.</small> : null}
          {reportContext.usedProducts.map((item) => (
            <label className="button" key={item.id}>
              <input type="checkbox" checked={draft.selectedProductIds.includes(item.id)} onChange={() => onToggleProduct(item.id)} disabled={saving} /> {item.productName} · {productSourceLabel(item.source)}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionFields({ action, draft, productSearch, orderItems, orderTotal, reportContext, saving, onChange, onSearchChange, onCategoryChange, onRunSearch, onPickProduct, onPickVariant, onAddOrderItem, onRemoveOrderItem, onToggleCompetitor, onToggleProduct, onApplyTemplate }: { action: McpCustomerAction; draft: ActionDraft; productSearch: ProductSearchState; orderItems: OrderDraftItem[]; orderTotal: number; reportContext: ReportContext; saving: boolean; onChange: (field: keyof ActionDraft, value: string) => void; onSearchChange: (value: string) => void; onCategoryChange: (category: string) => void; onRunSearch: () => void; onPickProduct: (productId: string) => void; onPickVariant: (variant: ProductCatalogItem) => void; onAddOrderItem: () => void; onRemoveOrderItem: (variantId: string) => void; onToggleCompetitor: (id: string) => void; onToggleProduct: (id: string) => void; onApplyTemplate: (id: string) => void }) {
  if (action === "order") {
    return <OrderFields draft={draft} productSearch={productSearch} orderItems={orderItems} orderTotal={orderTotal} saving={saving} onChange={onChange} onSearchChange={onSearchChange} onCategoryChange={onCategoryChange} onRunSearch={onRunSearch} onPickProduct={onPickProduct} onPickVariant={onPickVariant} onAddItem={onAddOrderItem} onRemoveItem={onRemoveOrderItem} />;
  }

  if (action === "test") {
    return (
      <div className="grid">
        <label className="form-field"><small>Sản phẩm test</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} placeholder="VD: Trà ô long / topping / syrup" /></label>
        <label className="form-field"><small>Kết quả</small><select value={draft.priority} onChange={(event) => onChange("priority", event.target.value)} disabled={saving}><option value="tested">Đã test</option><option value="ok">Khách thích</option><option value="retry">Cần thử lại</option><option value="not_suitable">Chưa phù hợp</option><option value="follow_up">Cần theo dõi</option></select></label>
        <label className="form-field"><small>Ghi chú test</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} /></label>
      </div>
    );
  }

  if (action === "market_report") {
    return <ReportContextFields draft={draft} reportContext={reportContext} saving={saving} onChange={onChange} onToggleCompetitor={onToggleCompetitor} onToggleProduct={onToggleProduct} onApplyTemplate={onApplyTemplate} />;
  }

  if (action === "follow_up") {
    return (
      <div className="grid">
        <label className="form-field"><small>Tiêu đề</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} placeholder="VD: Gọi lại chốt đơn / hẹn test lại" /></label>
        <label className="form-field"><small>Ngày hẹn</small><input type="date" value={draft.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} /></label>
        <label className="form-field"><small>Ưu tiên</small><select value={draft.priority} onChange={(event) => onChange("priority", event.target.value)} disabled={saving}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label>
        <label className="form-field"><small>Owner</small><input value={draft.owner} onChange={(event) => onChange("owner", event.target.value)} /></label>
        <label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} /></label>
      </div>
    );
  }

  return (
    <div className="grid">
      <label className="form-field"><small>Lý do bỏ qua / không mua</small><select value={draft.skipReason} onChange={(event) => onChange("skipReason", event.target.value)} disabled={saving}><option value="">Chọn lý do</option><option value="closed">Đóng cửa</option><option value="busy">Khách bận</option><option value="no_demand">Không có nhu cầu</option><option value="price">Chê giá</option><option value="competitor">Đang dùng đối thủ</option><option value="stock_enough">Còn tồn hàng</option><option value="other">Lý do khác</option></select></label>
      <label className="form-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} placeholder="Ghi rõ lý do để quản lý phiên xem lại" /></label>
    </div>
  );
}

function CustomerActionSheet({ selection, draft, productSearch, orderItems, orderTotal, reportContext, saving, message, onChange, onSearchChange, onCategoryChange, onRunSearch, onPickProduct, onPickVariant, onAddOrderItem, onRemoveOrderItem, onToggleCompetitor, onToggleProduct, onApplyTemplate, onClose, onSubmit }: { selection: { line: McpDayLine; action: McpCustomerAction } | null; draft: ActionDraft; productSearch: ProductSearchState; orderItems: OrderDraftItem[]; orderTotal: number; reportContext: ReportContext; saving: boolean; message: string | null; onChange: (field: keyof ActionDraft, value: string) => void; onSearchChange: (value: string) => void; onCategoryChange: (category: string) => void; onRunSearch: () => void; onPickProduct: (productId: string) => void; onPickVariant: (variant: ProductCatalogItem) => void; onAddOrderItem: () => void; onRemoveOrderItem: (variantId: string) => void; onToggleCompetitor: (id: string) => void; onToggleProduct: (id: string) => void; onApplyTemplate: (id: string) => void; onClose: () => void; onSubmit: () => void }) {
  const isOrder = selection?.action === "order";
  return (
    <BottomSheet
      open={Boolean(selection)}
      onClose={onClose}
      title={selection ? actionTitle(selection.action) : "Hành động checklist"}
      description={selection ? selection.line.accountName : undefined}
      footer={<div className={isOrder ? "sheet-action-grid order-sheet-footer" : "sheet-action-grid"}>{isOrder ? <div className="order-footer-total">Tổng: <strong>{formatMoney(orderTotal)}</strong></div> : null}<button className="button primary" type="button" onClick={onSubmit} disabled={saving}>{saving ? "Đang lưu..." : actionSaveLabel(selection?.action)}</button><button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button></div>}
    >
      {selection ? <div className={isOrder ? "visit-sheet-content order-action-content" : "visit-sheet-content"}><div className="visit-focus-card"><span>Khách</span><strong>{selection.line.accountName}</strong><small>{mcpCustomerActionDescription(selection.action)}</small></div><ActionFields action={selection.action} draft={draft} productSearch={productSearch} orderItems={orderItems} orderTotal={orderTotal} reportContext={reportContext} saving={saving} onChange={onChange} onSearchChange={onSearchChange} onCategoryChange={onCategoryChange} onRunSearch={onRunSearch} onPickProduct={onPickProduct} onPickVariant={onPickVariant} onAddOrderItem={onAddOrderItem} onRemoveOrderItem={onRemoveOrderItem} onToggleCompetitor={onToggleCompetitor} onToggleProduct={onToggleProduct} onApplyTemplate={onApplyTemplate} />{message ? <p className="page-subtitle order-message">{message}</p> : null}</div> : null}
    </BottomSheet>
  );
}

export function McpSessionCompactView({ activeHref = "/visits", mcpDayData }: { activeHref?: string; routesData: RoutesData; mcpDayData: McpDayData; routeCustomersData: RouteCustomersData }) {
  const [tab, setTab] = useState<SessionTab>("all");
  const [selectedLine, setSelectedLine] = useState<McpDayLine | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ line: McpDayLine; action: McpCustomerAction } | null>(null);
  const [draft, setDraft] = useState<ActionDraft>(emptyDraft());
  const [productSearch, setProductSearch] = useState<ProductSearchState>(emptyProductSearchState());
  const [orderItems, setOrderItems] = useState<OrderDraftItem[]>([]);
  const [reportContext, setReportContext] = useState<ReportContext>(emptyReportContext());
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  const run = mcpDayData.run;

  const allLines = mcpDayData.lines;
  const pendingLines = allLines.filter((line) => line.status === "pending");
  const visitedLines = allLines.filter((line) => line.status === "visited");
  const skippedLines = allLines.filter((line) => line.status === "skipped");
  const addedLines = allLines.filter((line) => line.source === "added");
  const followupLines = allLines.filter((line) => Number(line.followupCount || 0) > 0);
  const counters = { all: allLines.length, pending: pendingLines.length, visited: visitedLines.length, skipped: skippedLines.length, added: addedLines.length, followups: followupLines.length };
  const linesByTab: Record<SessionTab, McpDayLine[]> = { all: allLines, pending: pendingLines, visited: visitedLines, skipped: skippedLines, added: addedLines, followups: followupLines };
  const orderTotal = orderItems.reduce((total, item) => total + item.lineTotal, 0);

  function updateDraft(field: keyof ActionDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applyVariantToDraft(variant: ProductCatalogItem) {
    setDraft((current) => ({ ...current, productName: variant.name, unit: variant.sellUnit || current.unit, unitPrice: String(variant.price ?? 0) }));
  }

  function toggleDraftList(field: "selectedCompetitorIds" | "selectedProductIds", id: string) {
    setDraft((current) => {
      const values = current[field];
      return { ...current, [field]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id] };
    });
  }

  function applyReportTemplate(id: string) {
    const template = reportContext.templates.find((item) => item.id === id);
    if (!template) {
      setDraft((current) => ({ ...current, templateId: "" }));
      return;
    }
    setDraft((current) => ({ ...current, templateId: template.id, reportType: template.reportType || current.reportType, note: template.content ?? current.note, priceSummary: template.priceSummary ?? current.priceSummary, competitorSummary: template.competitorSummary ?? current.competitorSummary, displaySummary: template.displaySummary ?? current.displaySummary, stockSummary: template.stockSummary ?? current.stockSummary, demandSummary: template.demandSummary ?? current.demandSummary, opportunitySummary: template.opportunitySummary ?? current.opportunitySummary, riskSummary: template.riskSummary ?? current.riskSummary, nextAction: template.nextAction ?? current.nextAction }));
  }

  async function loadProducts(q: string, category: string) {
    setMessage(null);
    setProductSearch((current) => ({ ...current, q, category, loading: true, error: null, results: [], variants: [], selectedProductId: "", selectedVariant: null }));
    try {
      const results = await fetchProductSearch(q.trim(), category);
      setProductSearch((current) => ({ ...current, q, category, loading: false, results, error: null }));
    } catch (error) {
      setProductSearch((current) => ({ ...current, q, category, loading: false, error: error instanceof Error ? error.message : "Không tìm được sản phẩm" }));
    }
  }

  async function runProductSearch() {
    await loadProducts(productSearch.q, productSearch.category);
  }

  function changeProductCategory(category: string) {
    void loadProducts(productSearch.q, category);
  }

  async function pickProduct(productId: string) {
    const fallbackVariants = productSearch.results.filter((item) => item.productId === productId);
    setMessage(null);
    setProductSearch((current) => ({ ...current, selectedProductId: productId, selectedVariant: null, variants: fallbackVariants, variantsLoading: true, error: null }));
    try {
      const variants = await fetchProductVariants(productId);
      const nextVariants = variants.length > 0 ? variants : fallbackVariants;
      const autoVariant = nextVariants.length === 1 ? nextVariants[0] : null;
      setProductSearch((current) => ({ ...current, variantsLoading: false, variants: nextVariants, selectedVariant: autoVariant }));
      if (autoVariant) applyVariantToDraft(autoVariant);
    } catch (error) {
      setProductSearch((current) => ({ ...current, variantsLoading: false, error: error instanceof Error ? error.message : "Không tải được quy cách sản phẩm" }));
    }
  }

  function pickVariant(variant: ProductCatalogItem) {
    setMessage(null);
    setProductSearch((current) => ({ ...current, selectedVariant: variant }));
    applyVariantToDraft(variant);
  }

  function addOrderItem() {
    const variant = productSearch.selectedVariant;
    if (!variant) {
      setMessage("Cần chọn sản phẩm và quy cách trước khi thêm vào đơn");
      return;
    }
    const quantity = toNumber(draft.quantity, 1);
    const unitPrice = toNumber(draft.unitPrice, Number(variant.price || 0));
    if (quantity <= 0) {
      setMessage("Số lượng phải lớn hơn 0");
      return;
    }
    if (unitPrice < 0) {
      setMessage("Giá không hợp lệ");
      return;
    }
    const unit = draft.unit || variant.sellUnit || "";
    setOrderItems((current) => {
      const existed = current.find((item) => item.variantId === variant.variantId && item.unitPrice === unitPrice);
      if (existed) return current.map((item) => item === existed ? { ...item, quantity: item.quantity + quantity, lineTotal: (item.quantity + quantity) * item.unitPrice } : item);
      return [...current, { ...variant, quantity, unit, unitPrice, lineTotal: quantity * unitPrice }];
    });
    setDraft((current) => ({ ...current, quantity: "1" }));
    setMessage(null);
  }

  function removeOrderItem(variantId: string) {
    setOrderItems((current) => current.filter((item) => item.variantId !== variantId));
  }

  async function loadReportContextForLine(line: McpDayLine) {
    const sessionCustomerId = line.sessionCustomerId || line.id;
    setReportContext({ ...emptyReportContext(), loading: true });
    try {
      setReportContext(await fetchReportContext(sessionCustomerId));
    } catch (error) {
      setReportContext(emptyReportContext());
      setMessage(error instanceof Error ? error.message : "Không tải được ngữ cảnh báo cáo");
    }
  }

  function openCustomerAction(line: McpDayLine, action: McpCustomerAction) {
    setMessage(null);
    setSelectedLine(null);
    setDraft(emptyDraft(run.owner || ""));
    setProductSearch(emptyProductSearchState());
    setOrderItems([]);
    setReportContext(emptyReportContext());
    setSelectedAction({ line, action });
    if (action === "order") void loadProducts("", "");
    if (action === "market_report") void loadReportContextForLine(line);
  }

  function selectedReportCompetitors() {
    return reportContext.competitors.filter((item) => draft.selectedCompetitorIds.includes(item.id));
  }

  function selectedReportProducts() {
    return reportContext.usedProducts.filter((item) => draft.selectedProductIds.includes(item.id));
  }

  function submitAction() {
    if (!selectedAction) return;
    const sessionCustomerId = selectedAction.line.sessionCustomerId || selectedAction.line.id;
    startSaving(async () => {
      try {
        setMessage(null);
        if (selectedAction.action === "order") {
          if (orderItems.length === 0) throw new Error("Cần thêm ít nhất 1 sản phẩm vào đơn");
          await postMcpBackend("/api/mcp-orders/from-session-customer", { sessionCustomerId, items: orderItems.map((item) => ({ productId: item.productId, variantId: item.variantId, productName: item.name, sku: item.sku, unit: item.unit, quantity: item.quantity, unitPrice: item.unitPrice, note: variantLabel(item) })), note: draft.note, status: "confirmed" });
        } else if (selectedAction.action === "test") {
          if (!draft.productName.trim()) throw new Error("Cần nhập sản phẩm test");
          await postMcpBackend("/api/backend/mcp-day/session-customer/test", { sessionCustomerId, fileTitle: "Test nhanh từ checklist", results: [{ productName: draft.productName, status: draft.priority || "tested", note: draft.note }], note: draft.note, status: "tested" });
        } else if (selectedAction.action === "market_report") {
          const competitorNames = selectedReportCompetitors().map((item) => item.competitorName);
          const productNames = selectedReportProducts().map((item) => `${item.productName} (${productSourceLabel(item.source)})`);
          const content = joinUnique([draft.note, productNames.length ? `Sản phẩm liên quan: ${productNames.join(", ")}` : "", competitorNames.length ? `Đối thủ liên quan: ${competitorNames.join(", ")}` : ""]);
          const competitorSummary = joinUnique([draft.competitorSummary, ...competitorNames]);
          const demandSummary = joinUnique([draft.demandSummary, productNames.length ? `Sản phẩm đã tick: ${productNames.join(", ")}` : ""]);
          if (!content && !draft.priceSummary && !competitorSummary && !draft.displaySummary && !draft.stockSummary && !demandSummary && !draft.opportunitySummary && !draft.riskSummary && !draft.nextAction) throw new Error("Cần nhập nội dung, chọn mẫu hoặc tick dữ liệu báo cáo");
          await postMcpBackend("/api/backend/mcp-day/session-customer/report", { sessionCustomerId, reportType: draft.reportType, content, priceSummary: draft.priceSummary, competitorSummary, displaySummary: draft.displaySummary, stockSummary: draft.stockSummary, demandSummary, opportunitySummary: draft.opportunitySummary, riskSummary: draft.riskSummary, nextAction: draft.nextAction || content, templateId: draft.templateId || undefined, selectedCompetitors: selectedReportCompetitors(), selectedProducts: selectedReportProducts() });
        } else if (selectedAction.action === "follow_up") {
          if (!draft.productName.trim()) throw new Error("Cần nhập tiêu đề follow-up");
          await postMcpBackend("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: draft.productName, dueDate: draft.dueDate || undefined, priority: draft.priority, owner: draft.owner, note: draft.note, followupType: "general" });
        } else if (selectedAction.action === "skip") {
          if (!draft.skipReason.trim()) throw new Error("Cần chọn lý do bỏ qua / không mua");
          await postMcpBackend("/api/backend/mcp-day/session-customer/status", { sessionCustomerId, visitStatus: "skipped", statusReason: draft.skipReason, note: draft.note || draft.skipReason });
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
      <PageHeader eyebrow="Checklist phiên" title="Checklist phiên" subtitle={`Tuyến gốc: ${run.routeName} · Ngày: ${run.date} · Sale: ${run.owner}`} />
      <section className="mcp-gate-banner mcp-session-compact-head"><strong>{counters.pending} chờ ghé</strong><span>{counters.visited} đã ghé · {counters.skipped} bỏ qua · {counters.added} phát sinh · {counters.followups} follow-up · mở lúc {run.openedAt}</span></section>
      <div className="mcp-status-chips" role="tablist" aria-label="Checklist phiên"><button className={tab === "all" ? "active" : ""} type="button" onClick={() => setTab("all")}>Tất cả khách <b>{counters.all}</b></button><button className={tab === "pending" ? "active" : ""} type="button" onClick={() => setTab("pending")}>Chờ ghé <b>{counters.pending}</b></button><button className={tab === "visited" ? "active" : ""} type="button" onClick={() => setTab("visited")}>Đã ghé <b>{counters.visited}</b></button><button className={tab === "skipped" ? "active" : ""} type="button" onClick={() => setTab("skipped")}>Bỏ qua <b>{counters.skipped}</b></button><button className={tab === "added" ? "active" : ""} type="button" onClick={() => setTab("added")}>Phát sinh <b>{counters.added}</b></button><button className={tab === "followups" ? "active" : ""} type="button" onClick={() => setTab("followups")}>Có follow-up <b>{counters.followups}</b></button></div>
      <LineList lines={linesByTab[tab]} onOpen={setSelectedLine} onAction={openCustomerAction} />
      <CustomerSheet line={selectedLine} onClose={() => setSelectedLine(null)} onAction={openCustomerAction} />
      <CustomerActionSheet selection={selectedAction} draft={draft} productSearch={productSearch} orderItems={orderItems} orderTotal={orderTotal} reportContext={reportContext} saving={saving} message={message} onChange={updateDraft} onSearchChange={(value) => setProductSearch((current) => ({ ...current, q: value }))} onCategoryChange={changeProductCategory} onRunSearch={runProductSearch} onPickProduct={pickProduct} onPickVariant={pickVariant} onAddOrderItem={addOrderItem} onRemoveOrderItem={removeOrderItem} onToggleCompetitor={(id) => toggleDraftList("selectedCompetitorIds", id)} onToggleProduct={(id) => toggleDraftList("selectedProductIds", id)} onApplyTemplate={applyReportTemplate} onClose={() => { if (!saving) setSelectedAction(null); }} onSubmit={submitAction} />
    </AppShell>
  );
}
