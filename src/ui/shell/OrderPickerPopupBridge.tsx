"use client";

import { useEffect } from "react";

function closePicker(root: Element | null) {
  root?.classList.remove("product-picker-popup-open");
}

function openPicker(root: Element | null) {
  root?.classList.add("product-picker-popup-open");
}

export function OrderPickerPopupBridge() {
  useEffect(() => {
    function ensureControls() {
      document.querySelectorAll(".order-action-content .order-builder-compact").forEach((builder) => {
        if (builder.querySelector(".order-open-picker-button")) return;

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "button primary order-open-picker-button";
        trigger.textContent = "Chọn sản phẩm / vị";
        trigger.addEventListener("click", () => openPicker(builder.closest(".order-action-content")));

        const close = document.createElement("button");
        close.type = "button";
        close.className = "order-picker-popup-close";
        close.setAttribute("aria-label", "Đóng chọn sản phẩm");
        close.textContent = "×";
        close.addEventListener("click", () => closePicker(builder.closest(".order-action-content")));

        const mainGrid = builder.querySelector(".order-main-grid");
        builder.insertBefore(trigger, mainGrid || builder.firstChild);
        builder.appendChild(close);
      });
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;
      const root = target.closest(".order-action-content");
      if (!root) return;

      if (target.closest(".variant-chip")) {
        window.setTimeout(() => closePicker(root), 180);
      }
      if (target.classList.contains("product-picker-popup-open")) {
        closePicker(root);
      }
    }

    ensureControls();
    document.addEventListener("click", onClick);
    const observer = new MutationObserver(ensureControls);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", onClick);
      observer.disconnect();
    };
  }, []);

  return null;
}
