"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RouteCustomerItem } from "@/features/mcp/route-customers.types";
import { idempotentMutationFetch } from "@/lib/api/idempotent-fetch";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import styles from "./OrderCreateSheet.module.css";

type CustomerMode = "existing" | "manual";

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

type OrderDraftItem = ProductCatalogItem & {
  quantity: number;
  unitPrice: number;
};

type ManualCustomer = {
  name: string;
  phone: string;
  area: string;
  address: string;
};

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as { error?: string | { message?: string }; detail?: string; message?: string };
  if (typeof value.error === "string" && value.error.trim()) return value.error;
  if (value.error && typeof value.error === "object" && value.error.message?.trim()) return value.error.message;
  return value.detail || value.message || fallback;
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

function variantLabel(item: ProductCatalogItem) {
  return [
    item.variantName,
    item.sizeLabel,
    item.packUnit && item.packQuantity ? `${item.packUnit} ${item.packQuantity}` : ""
  ].filter(Boolean).join(" · ") || item.sku || item.variantId;
}

function emptyManualCustomer(): ManualCustomer {
  return { name: "", phone: "", area: "", address: "" };
}

export function OrderCreateSheet({
  open,
  customers,
  onClose,
  onCreated
}: {
  open: boolean;
  customers: RouteCustomerItem[];
  onClose: () => void;
  onCreated: (orderCode: string) => void;
}) {
  const router = useRouter();
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [routeCustomerId, setRouteCustomerId] = useState("");
  const [manualCustomer, setManualCustomer] = useState<ManualCustomer>(emptyManualCustomer());
  const [sales, setSales] = useState("Sale");
  const [status, setStatus] = useState<"draft" | "confirmed">("confirmed");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [items, setItems] = useState<OrderDraftItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeCustomers = useMemo(() => customers.filter((customer) => customer.status !== "hidden"), [customers]);
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return activeCustomers.slice(0, 50);
    return activeCustomers.filter((customer) =>
      `${customer.accountName} ${customer.contactName} ${customer.area} ${customer.routeName}`.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [activeCustomers, customerSearch]);
  const selectedCustomer = activeCustomers.find((customer) => customer.id === routeCustomerId) || null;
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  useEffect(() => {
    if (!open) return;
    setCustomerMode("existing");
    setCustomerSearch("");
    setRouteCustomerId("");
    setManualCustomer(emptyManualCustomer());
    setSales("Sale");
    setStatus("confirmed");
    setNote("");
    setProductSearch("");
    setProducts([]);
    setItems([]);
    setMessage(null);
    void loadProducts("");
  }, [open]);

  async function loadProducts(query: string) {
    setLoadingProducts(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "100" });
      const response = await fetch(`/api/products/search?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(payload, "Không tải được sản phẩm"));
      setProducts(normalizeCatalogItems((payload as { data?: unknown }).data));
    } catch (error) {
      setProducts([]);
      setMessage(error instanceof Error ? error.message : "Không tải được sản phẩm");
    } finally {
      setLoadingProducts(false);
    }
  }

  function addProduct(product: ProductCatalogItem) {
    setItems((current) => {
      const existed = current.find((item) => item.variantId === product.variantId);
      if (existed) {
        return current.map((item) => item.variantId === product.variantId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { ...product, quantity: 1, unitPrice: Number(product.price || 0) }];
    });
  }

  function updateItem(variantId: string, field: "quantity" | "unitPrice", value: number) {
    setItems((current) => current.map((item) => {
      if (item.variantId !== variantId) return item;
      if (field === "quantity") return { ...item, quantity: Math.max(1, value || 1) };
      return { ...item, unitPrice: Math.max(0, value || 0) };
    }));
  }

  function updateManualCustomer(field: keyof ManualCustomer, value: string) {
    setManualCustomer((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    if (saving) return;
    if (customerMode === "existing" && !routeCustomerId) {
      setMessage("Cần chọn một khách đã có.");
      return;
    }
    if (customerMode === "manual" && !manualCustomer.name.trim()) {
      setMessage("Cần nhập tên khách.");
      return;
    }
    if (items.length === 0) {
      setMessage("Cần thêm ít nhất một sản phẩm vào đơn.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await idempotentMutationFetch(
        "/api/backend/orders",
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            customerMode,
            routeCustomerId: customerMode === "existing" ? routeCustomerId : undefined,
            customer: customerMode === "manual" ? manualCustomer : undefined,
            sales,
            status,
            note,
            items: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.name,
              sku: item.sku,
              unit: item.sellUnit || "",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              note: variantLabel(item)
            }))
          })
        },
        { operation: "order.create" }
      );
      const payload = await response.json().catch(() => ({})) as { data?: { orderCode?: string }; error?: unknown; detail?: string };
      if (!response.ok) throw new Error(apiErrorMessage(payload, "Không tạo được đơn hàng"));
      const orderCode = payload.data?.orderCode || "Đơn mới";
      router.refresh();
      onCreated(orderCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được đơn hàng");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title="Tạo đơn hàng"
      description={customerMode === "existing" ? selectedCustomer?.accountName || "Chọn khách đã có" : manualCustomer.name || "Nhập khách"}
      footer={(
        <div className={styles.footer}>
          <div><small>Tổng đơn</small><strong>{money.format(total)}</strong></div>
          <button className="button primary" type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Đang tạo..." : "Tạo đơn"}</button>
          <button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button>
        </div>
      )}
    >
      <div className={styles.content}>
        <section className={styles.section}>
          <div className={styles.sectionHead}><strong>1. Chọn khách</strong><small>Khách đã có hoặc nhập nhanh khách vãng lai</small></div>
          <div className={styles.modeTabs} role="tablist" aria-label="Cách chọn khách">
            <button type="button" className={customerMode === "existing" ? styles.activeTab : ""} onClick={() => setCustomerMode("existing")} disabled={saving}>Khách đã có</button>
            <button type="button" className={customerMode === "manual" ? styles.activeTab : ""} onClick={() => setCustomerMode("manual")} disabled={saving}>Nhập khách</button>
          </div>

          {customerMode === "existing" ? (
            <div className={styles.customerPicker}>
              <label className="form-field"><small>Tìm tên / SĐT / khu vực / tuyến</small><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Tìm khách" disabled={saving} /></label>
              <div className={styles.customerList}>
                {filteredCustomers.length === 0 ? <p className="page-subtitle">Không có khách phù hợp.</p> : null}
                {filteredCustomers.map((customer) => (
                  <button
                    type="button"
                    key={customer.id}
                    className={routeCustomerId === customer.id ? styles.selectedCustomer : ""}
                    onClick={() => setRouteCustomerId(customer.id)}
                    disabled={saving}
                  >
                    <strong>{customer.accountName}</strong>
                    <span>{customer.contactName} · {customer.area}</span>
                    <small>{customer.routeName}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.manualGrid}>
              <label className="form-field"><small>Tên khách *</small><input value={manualCustomer.name} onChange={(event) => updateManualCustomer("name", event.target.value)} disabled={saving} /></label>
              <label className="form-field"><small>Số điện thoại</small><input inputMode="tel" value={manualCustomer.phone} onChange={(event) => updateManualCustomer("phone", event.target.value)} disabled={saving} /></label>
              <label className="form-field"><small>Khu vực</small><input value={manualCustomer.area} onChange={(event) => updateManualCustomer("area", event.target.value)} disabled={saving} /></label>
              <label className="form-field"><small>Địa chỉ giao hàng</small><input value={manualCustomer.address} onChange={(event) => updateManualCustomer("address", event.target.value)} disabled={saving} /></label>
              <p className={styles.hint}>Khách nhập nhanh chỉ được lưu như snapshot của đơn, không tự thêm vào tuyến.</p>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><strong>2. Thêm sản phẩm</strong><small>{items.length} mã đã chọn</small></div>
          <div className={styles.searchRow}>
            <label className="form-field"><small>Tìm tên / SKU</small><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadProducts(productSearch); } }} disabled={saving || loadingProducts} /></label>
            <button className="button" type="button" onClick={() => void loadProducts(productSearch)} disabled={saving || loadingProducts}>{loadingProducts ? "Đang tải" : "Tìm"}</button>
          </div>
          <div className={styles.productResults}>
            {products.slice(0, 30).map((product) => (
              <button type="button" key={product.variantId} onClick={() => addProduct(product)} disabled={saving}>
                <span><strong>{product.name}</strong><small>{variantLabel(product)} · {product.sku || "Chưa SKU"}</small></span>
                <b>{money.format(Number(product.price || 0))}</b>
                <em>+ Thêm</em>
              </button>
            ))}
          </div>
          <div className={styles.itemList}>
            {items.length === 0 ? <p className="page-subtitle">Chưa có sản phẩm trong đơn.</p> : null}
            {items.map((item) => (
              <article key={item.variantId}>
                <div><strong>{item.name}</strong><small>{variantLabel(item)}</small></div>
                <label><small>SL</small><input type="number" min="1" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.variantId, "quantity", Number(event.target.value))} disabled={saving} /></label>
                <label><small>Đơn giá</small><input type="number" min="0" inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.variantId, "unitPrice", Number(event.target.value))} disabled={saving} /></label>
                <b>{money.format(item.quantity * item.unitPrice)}</b>
                <button type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.variantId !== item.variantId))} disabled={saving}>Xóa</button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><strong>3. Hoàn tất</strong><small>Thông tin xử lý đơn</small></div>
          <div className={styles.finalGrid}>
            <label className="form-field"><small>Nhân viên phụ trách</small><input value={sales} onChange={(event) => setSales(event.target.value)} disabled={saving} /></label>
            <label className="form-field"><small>Trạng thái</small><select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "confirmed")} disabled={saving}><option value="confirmed">Đã chốt</option><option value="draft">Nháp</option></select></label>
          </div>
          <label className="form-field"><small>Ghi chú giao hàng / công nợ</small><textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} /></label>
          {message ? <p className={styles.message}>{message}</p> : null}
        </section>
      </div>
    </BottomSheet>
  );
}
