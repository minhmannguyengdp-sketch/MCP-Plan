"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function mergeOptions(current: string[], next: Array<string | null | undefined>) {
  return Array.from(new Set([
    ...current,
    ...next.map((value) => String(value || "").trim()).filter(Boolean)
  ])).sort((left, right) => left.localeCompare(right, "vi"));
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
  const productRequestRef = useRef(0);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [routeCustomerId, setRouteCustomerId] = useState("");
  const [manualCustomer, setManualCustomer] = useState<ManualCustomer>(emptyManualCustomer());
  const [sales, setSales] = useState("Sale");
  const [status, setStatus] = useState<"draft" | "confirmed">("confirmed");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [items, setItems] = useState<OrderDraftItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
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
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedQuantityByVariant = useMemo(() => new Map(items.map((item) => [item.variantId, item.quantity])), [items]);

  const loadProducts = useCallback(async (query: string, category: string, brand: string) => {
    const requestId = ++productRequestRef.current;
    setLoadingProducts(true);
    setProductError(null);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "100" });
      if (category) params.set("category", category);
      if (brand) params.set("brand", brand);
      const response = await fetch(`/api/products/search?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(payload, "Không tải được sản phẩm"));
      const nextProducts = normalizeCatalogItems((payload as { data?: unknown }).data);
      if (requestId !== productRequestRef.current) return;
      setProducts(nextProducts);
      setCategoryOptions((current) => mergeOptions(current, nextProducts.map((item) => item.category)));
      setBrandOptions((current) => mergeOptions(current, nextProducts.map((item) => item.brand)));
    } catch (error) {
      if (requestId !== productRequestRef.current) return;
      setProducts([]);
      setProductError(error instanceof Error ? error.message : "Không tải được sản phẩm");
    } finally {
      if (requestId === productRequestRef.current) setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      productRequestRef.current += 1;
      return;
    }
    setCustomerMode("existing");
    setCustomerSearch("");
    setRouteCustomerId("");
    setManualCustomer(emptyManualCustomer());
    setSales("Sale");
    setStatus("confirmed");
    setNote("");
    setProductSearch("");
    setProductCategory("");
    setProductBrand("");
    setCategoryOptions([]);
    setBrandOptions([]);
    setProducts([]);
    setItems([]);
    setProductError(null);
    setMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadProducts(productSearch, productCategory, productBrand);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadProducts, open, productBrand, productCategory, productSearch]);

  function addProduct(product: ProductCatalogItem) {
    setMessage(null);
    setItems((current) => {
      const existed = current.find((item) => item.variantId === product.variantId);
      if (existed) {
        return current.map((item) => item.variantId === product.variantId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { ...product, quantity: 1, unitPrice: Number(product.price || 0) }];
    });
  }

  function decreaseProduct(variantId: string) {
    setItems((current) => current.flatMap((item) => {
      if (item.variantId !== variantId) return [item];
      if (item.quantity <= 1) return [];
      return [{ ...item, quantity: item.quantity - 1 }];
    }));
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

  function clearProductFilters() {
    setProductSearch("");
    setProductCategory("");
    setProductBrand("");
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

  const customerDescription = customerMode === "existing"
    ? selectedCustomer?.accountName || "Chưa chọn khách"
    : manualCustomer.name || "Khách nhập nhanh";

  return (
    <BottomSheet
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title="Tạo đơn hàng"
      description={`${customerDescription} · ${totalQuantity} sản phẩm`}
      variant="workspace"
      footer={(
        <div className={styles.footer}>
          <div className={styles.footerSummary}>
            <small>{items.length} dòng · {totalQuantity} sản phẩm</small>
            <strong>{money.format(total)}</strong>
          </div>
          <button className="button primary" type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Đang tạo..." : "Tạo đơn"}</button>
          <button className="button" type="button" onClick={onClose} disabled={saving}>Đóng</button>
        </div>
      )}
    >
      <div className={styles.workspace}>
        <div className={styles.leftPane}>
          <section className={`${styles.section} ${styles.customerSection}`}>
            <div className={styles.sectionHead}>
              <div><strong>1. Chọn khách</strong><small>Khách đã có hoặc nhập nhanh khách vãng lai</small></div>
              {selectedCustomer ? <span className={styles.selectionBadge}>Đã chọn</span> : null}
            </div>
            <div className={styles.modeTabs} role="tablist" aria-label="Cách chọn khách">
              <button type="button" className={customerMode === "existing" ? styles.activeTab : ""} onClick={() => setCustomerMode("existing")} disabled={saving}>Khách đã có</button>
              <button type="button" className={customerMode === "manual" ? styles.activeTab : ""} onClick={() => setCustomerMode("manual")} disabled={saving}>Nhập khách</button>
            </div>

            {customerMode === "existing" ? (
              <div className={styles.customerPicker}>
                <label className={styles.compactField}><span>Tìm tên / SĐT / khu vực / tuyến</span><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Gõ để lọc khách" disabled={saving} /></label>
                <div className={styles.customerList}>
                  {filteredCustomers.length === 0 ? <p className={styles.emptyState}>Không có khách phù hợp.</p> : null}
                  {filteredCustomers.map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      className={routeCustomerId === customer.id ? styles.selectedCustomer : ""}
                      onClick={() => { setRouteCustomerId(customer.id); setMessage(null); }}
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
                <label className={styles.compactField}><span>Tên khách *</span><input value={manualCustomer.name} onChange={(event) => updateManualCustomer("name", event.target.value)} disabled={saving} /></label>
                <label className={styles.compactField}><span>Số điện thoại</span><input inputMode="tel" value={manualCustomer.phone} onChange={(event) => updateManualCustomer("phone", event.target.value)} disabled={saving} /></label>
                <label className={styles.compactField}><span>Khu vực</span><input value={manualCustomer.area} onChange={(event) => updateManualCustomer("area", event.target.value)} disabled={saving} /></label>
                <label className={styles.compactField}><span>Địa chỉ giao hàng</span><input value={manualCustomer.address} onChange={(event) => updateManualCustomer("address", event.target.value)} disabled={saving} /></label>
                <p className={styles.hint}>Khách nhập nhanh chỉ được lưu như snapshot của đơn, không tự thêm vào tuyến.</p>
              </div>
            )}
          </section>

          <section className={`${styles.section} ${styles.catalogSection}`}>
            <div className={styles.sectionHead}>
              <div><strong>2. Chọn sản phẩm</strong><small>Tìm realtime theo tên, SKU, nhãn, nhóm và quy cách</small></div>
              <span className={styles.resultCount} aria-live="polite">{loadingProducts ? "Đang tìm..." : `${products.length} kết quả`}</span>
            </div>

            <div className={styles.searchToolbar}>
              <label className={`${styles.compactField} ${styles.searchField}`}>
                <span>Tìm sản phẩm</span>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void loadProducts(productSearch, productCategory, productBrand);
                    }
                  }}
                  placeholder="Ví dụ: SKU, tên hàng, vị, dung tích..."
                  disabled={saving}
                />
              </label>
              <button className="button" type="button" onClick={() => void loadProducts(productSearch, productCategory, productBrand)} disabled={saving || loadingProducts}>Tìm ngay</button>
              <button className="button" type="button" onClick={clearProductFilters} disabled={saving || (!productSearch && !productCategory && !productBrand)}>Xóa lọc</button>
            </div>

            <div className={styles.filterRow}>
              <label className={styles.compactField}>
                <span>Nhóm hàng</span>
                <select value={productCategory} onChange={(event) => setProductCategory(event.target.value)} disabled={saving}>
                  <option value="">Tất cả nhóm</option>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className={styles.compactField}>
                <span>Nhãn hàng</span>
                <select value={productBrand} onChange={(event) => setProductBrand(event.target.value)} disabled={saving}>
                  <option value="">Tất cả nhãn</option>
                  {brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </label>
              <p>Danh sách tự cập nhật sau 250ms; bấm Enter để tìm ngay.</p>
            </div>

            {productError ? <p className={styles.message}>{productError}</p> : null}
            <div className={styles.productResults} role="list" aria-label="Kết quả tìm sản phẩm">
              {loadingProducts && products.length === 0 ? <p className={styles.emptyState}>Đang tải danh mục sản phẩm...</p> : null}
              {!loadingProducts && products.length === 0 && !productError ? <p className={styles.emptyState}>Không tìm thấy sản phẩm. Thử xóa bớt bộ lọc hoặc tìm bằng SKU.</p> : null}
              {products.map((product) => {
                const selectedQuantity = selectedQuantityByVariant.get(product.variantId) || 0;
                return (
                  <article key={product.variantId} className={selectedQuantity ? styles.selectedProduct : ""} role="listitem">
                    <div className={styles.productMain}>
                      <strong>{product.name}</strong>
                      <small>{[product.brand, product.category].filter(Boolean).join(" · ") || "Chưa phân nhóm"}</small>
                      <span>{variantLabel(product)} · {product.sku || "Chưa SKU"}</span>
                    </div>
                    <div className={styles.productPrice}>
                      <b>{money.format(Number(product.price || 0))}</b>
                      {selectedQuantity ? <small>Trong đơn: {selectedQuantity}</small> : null}
                    </div>
                    <button type="button" onClick={() => addProduct(product)} disabled={saving}>+ Thêm</button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className={styles.rightPane}>
          <section className={`${styles.section} ${styles.cartSection}`}>
            <div className={styles.sectionHead}>
              <div><strong>Đơn đang lên</strong><small>{items.length} dòng · {totalQuantity} sản phẩm</small></div>
              <b className={styles.cartTotal}>{money.format(total)}</b>
            </div>
            <div className={styles.itemList}>
              {items.length === 0 ? <p className={styles.emptyState}>Chưa có sản phẩm. Chọn sản phẩm ở cột bên trái để thêm vào đơn.</p> : null}
              {items.map((item) => (
                <article key={item.variantId}>
                  <div className={styles.itemHead}>
                    <div><strong>{item.name}</strong><small>{variantLabel(item)} · {item.sku || "Chưa SKU"}</small></div>
                    <button type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.variantId !== item.variantId))} disabled={saving} aria-label={`Xóa ${item.name}`}>×</button>
                  </div>
                  <div className={styles.itemControls}>
                    <label>
                      <span>Số lượng</span>
                      <div className={styles.quantityControl}>
                        <button type="button" onClick={() => decreaseProduct(item.variantId)} disabled={saving} aria-label={`Giảm ${item.name}`}>−</button>
                        <input type="number" min="1" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.variantId, "quantity", Number(event.target.value))} disabled={saving} />
                        <button type="button" onClick={() => addProduct(item)} disabled={saving} aria-label={`Tăng ${item.name}`}>+</button>
                      </div>
                    </label>
                    <label className={styles.priceField}><span>Đơn giá</span><input type="number" min="0" inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.variantId, "unitPrice", Number(event.target.value))} disabled={saving} /></label>
                    <b>{money.format(item.quantity * item.unitPrice)}</b>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.section} ${styles.finalSection}`}>
            <div className={styles.sectionHead}><div><strong>3. Hoàn tất</strong><small>Thông tin xử lý đơn</small></div></div>
            <div className={styles.finalGrid}>
              <label className={styles.compactField}><span>Nhân viên phụ trách</span><input value={sales} onChange={(event) => setSales(event.target.value)} disabled={saving} /></label>
              <label className={styles.compactField}><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "confirmed")} disabled={saving}><option value="confirmed">Đã chốt</option><option value="draft">Nháp</option></select></label>
            </div>
            <label className={styles.compactField}><span>Ghi chú giao hàng / công nợ</span><textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} /></label>
            {message ? <p className={styles.message}>{message}</p> : null}
          </section>
        </aside>
      </div>
    </BottomSheet>
  );
}
