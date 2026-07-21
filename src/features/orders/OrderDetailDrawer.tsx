"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { OrderDto } from "@/lib/api/api.types";
import styles from "./OrderDetailDrawer.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function statusLabel(status: string) {
  if (status === "draft") return "Nháp";
  if (status === "confirmed") return "Đã chốt";
  if (status === "delivered") return "Đã giao";
  if (status === "cancelled") return "Đã hủy";
  return status || "Chưa xác định";
}

function statusClass(status: string) {
  if (status === "draft") return `${styles.status} ${styles.draft}`;
  if (status === "confirmed") return `${styles.status} ${styles.confirmed}`;
  if (status === "delivered") return `${styles.status} ${styles.delivered}`;
  return `${styles.status} ${styles.cancelled}`;
}

function exportHref(order: OrderDto) {
  return `/api/backend/exports/orders.csv?orderId=${encodeURIComponent(order.id)}`;
}

type OrderDetailDrawerProps = {
  open: boolean;
  order: OrderDto | null;
  possibleDuplicate: boolean;
  onClose: () => void;
};

export function OrderDetailDrawer({ open, order, possibleDuplicate, onClose }: OrderDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mounted || !open) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollRegion = document.querySelector<HTMLElement>("[data-app-scroll-region='true']");
    const scrollTop = scrollRegion?.scrollTop ?? 0;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      regionOverflow: scrollRegion?.style.overflow ?? "",
      regionOverscroll: scrollRegion?.style.overscrollBehavior ?? ""
    };

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "contain";
    if (scrollRegion) {
      scrollRegion.style.overflow = "hidden";
      scrollRegion.style.overscrollBehavior = "contain";
    }

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      if (scrollRegion) {
        scrollRegion.style.overflow = previous.regionOverflow;
        scrollRegion.style.overscrollBehavior = previous.regionOverscroll;
        scrollRegion.scrollTop = scrollTop;
      }
    };
  }, [mounted, open]);

  if (!mounted || !open) return null;

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onCloseRef.current();
  }

  const averageLineValue = order && order.quantity > 0 ? order.totalAmount / order.quantity : 0;

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={handleBackdropClick} data-order-detail-surface="backdrop">
      <aside
        ref={panelRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-order-detail-surface="drawer"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span>Chi tiết đơn hàng</span>
            <h2 id={titleId}>{order ? order.code : "Không tìm thấy đơn"}</h2>
            <p id={descriptionId}>{order ? `${order.accountName} · ${order.routeName}` : "Liên kết chi tiết không còn khớp với dữ liệu đang tải."}</p>
          </div>
          <div className={styles.headerActions}>
            {order ? <strong className={statusClass(order.status)}>{statusLabel(order.status)}</strong> : null}
            <button ref={closeButtonRef} className={styles.closeButton} type="button" aria-label="Đóng chi tiết đơn" onClick={() => onCloseRef.current()}>×</button>
          </div>
        </header>

        <div className={styles.body}>
          {order ? (
            <>
              <section className={styles.totalCard} aria-label="Tổng giá trị đơn">
                <span>Doanh số đặt hàng</span>
                <strong>{money.format(order.totalAmount)}</strong>
                <small>{order.accountName} · {order.date}</small>
              </section>

              {possibleDuplicate ? (
                <section className={styles.warning} aria-label="Cảnh báo đơn nghi trùng">
                  <strong>Đơn có dấu hiệu trùng</strong>
                  <span>Cùng khách, ngày, giá trị, số lượng và số SKU với một đơn khác. Đây là cảnh báo đối chiếu, hệ thống không tự sửa hoặc xóa dữ liệu.</span>
                </section>
              ) : null}

              <section className={styles.section}>
                <header><div><span>01</span><h3>Tổng quan</h3></div><small>Snapshot tại thời điểm ghi nhận</small></header>
                <div className={styles.identityCard}>
                  <div><span>Khách hàng</span><strong>{order.accountName}</strong></div>
                  <div><span>Tuyến</span><strong>{order.routeName || "Chưa xác định"}</strong></div>
                </div>
                <dl className={styles.detailGrid}>
                  <div><dt>Ngày đơn</dt><dd>{order.date}</dd></div>
                  <div><dt>Nhân viên</dt><dd>{order.owner || "Chưa xác định"}</dd></div>
                  <div><dt>Nguồn đơn</dt><dd>{order.source || "Chưa xác định"}</dd></div>
                  <div><dt>Trạng thái</dt><dd>{statusLabel(order.status)}</dd></div>
                </dl>
              </section>

              <section className={styles.section}>
                <header><div><span>02</span><h3>Cấu trúc đơn</h3></div><small>Số liệu tổng hợp từ API danh sách</small></header>
                <div className={styles.metricGrid}>
                  <article><span>SKU</span><strong>{integer.format(order.skuCount)}</strong><small>Mã hàng phát sinh</small></article>
                  <article><span>Sản lượng</span><strong>{integer.format(order.quantity)}</strong><small>Tổng đơn vị đặt</small></article>
                  <article><span>Bình quân/đơn vị</span><strong>{money.format(averageLineValue)}</strong><small>Tổng giá trị ÷ sản lượng</small></article>
                </div>
                <div className={styles.dataBoundary}>
                  <strong>Chưa có chi tiết từng dòng hàng</strong>
                  <span>API đơn hiện chỉ trả tổng SKU, số lượng và giá trị. Drawer không suy diễn tên sản phẩm, vị, đơn giá hoặc chiết khấu khi nguồn dữ liệu chưa cung cấp.</span>
                </div>
              </section>

              <section className={styles.section}>
                <header><div><span>03</span><h3>Định danh và nguồn</h3></div><small>Dùng để đối chiếu, xuất và hỗ trợ</small></header>
                <dl className={styles.detailGrid}>
                  <div className={styles.fullRow}><dt>Mã đơn</dt><dd>{order.code}</dd></div>
                  <div className={styles.fullRow}><dt>ID hệ thống</dt><dd className={styles.mono}>{order.id}</dd></div>
                </dl>
              </section>
            </>
          ) : (
            <section className={styles.notFound}>
              <strong>Đơn không còn trong tập dữ liệu hiện tại</strong>
              <span>Có thể bộ dữ liệu đã thay đổi hoặc URL chứa ID không hợp lệ. Đóng chi tiết để quay lại danh sách mà không mất bộ lọc.</span>
            </section>
          )}
        </div>

        <footer className={styles.footer}>
          {order ? <a className="button primary" href={exportHref(order)}>Xuất đơn hàng</a> : null}
          <button className="button" type="button" onClick={() => onCloseRef.current()}>Đóng</button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
