"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type BottomSheetProps = {
  title: string;
  description?: string;
  open?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
};

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  background: "rgba(16, 24, 40, 0.54)",
  padding: "16px",
  overscrollBehavior: "contain",
  touchAction: "auto"
};

const sheetStyle: CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "min(88dvh, 760px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--line)",
  borderRadius: "24px 24px 18px 18px",
  boxShadow: "0 -24px 70px rgba(16, 24, 40, 0.28)",
  overscrollBehavior: "contain",
  touchAction: "pan-y"
};

const handleStyle: CSSProperties = {
  width: 44,
  height: 5,
  flex: "0 0 auto",
  alignSelf: "center",
  borderRadius: 999,
  background: "var(--line)",
  margin: "10px 0 4px"
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  flex: "0 0 auto",
  padding: "14px 20px 12px",
  borderBottom: "1px solid var(--line)"
};

const bodyStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  padding: "18px 20px 20px",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  touchAction: "pan-y"
};

const footerStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "14px 20px calc(14px + env(safe-area-inset-bottom))",
  borderTop: "1px solid var(--line)",
  background: "var(--panel)"
};

export function BottomSheet({ title, description, open = false, children, footer, onClose }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previousBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior
    };
    const previousHtml = {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "contain";

    const focusFrame = window.requestAnimationFrame(() => {
      sheetRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      body.style.position = previousBody.position;
      body.style.top = previousBody.top;
      body.style.left = previousBody.left;
      body.style.right = previousBody.right;
      body.style.width = previousBody.width;
      body.style.overflow = previousBody.overflow;
      body.style.overscrollBehavior = previousBody.overscrollBehavior;
      html.style.overflow = previousHtml.overflow;
      html.style.overscrollBehavior = previousHtml.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [mounted, open]);

  if (!mounted || !open) return null;

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onCloseRef.current?.();
  }

  return createPortal(
    <div className="sheet-backdrop" role="presentation" onClick={handleBackdropClick} style={backdropStyle}>
      <section
        ref={sheetRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        style={sheetStyle}
      >
        <div className="sheet-handle" style={handleStyle} />
        <header className="sheet-header" style={headerStyle}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button className="sheet-close" type="button" aria-label="Đóng" onClick={() => onCloseRef.current?.()}>
            ×
          </button>
        </header>
        <div className="sheet-body" style={bodyStyle}>{children}</div>
        {footer ? <footer className="sheet-footer" style={footerStyle}>{footer}</footer> : null}
      </section>
    </div>,
    document.body
  );
}
