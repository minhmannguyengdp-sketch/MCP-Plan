"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import styles from "./MobileAppMenu.module.css";

export type MobileAppMenuItem = {
  id: string;
  label: string;
  description?: string;
  icon: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  keepOpen?: boolean;
  onSelect: () => void | boolean | Promise<void | boolean>;
};

export type MobileAppMenuRegistration = {
  title?: string;
  description?: string;
  items: MobileAppMenuItem[];
  message?: string | null;
};

type MobileAppMenuContextValue = {
  register: (registration: MobileAppMenuRegistration) => () => void;
};

const MobileAppMenuContext = createContext<MobileAppMenuContextValue | null>(null);

export function useRegisterMobileAppMenu(registration: MobileAppMenuRegistration) {
  const context = useContext(MobileAppMenuContext);
  if (!context) throw new Error("useRegisterMobileAppMenu must be used inside MobileAppMenuProvider");

  useEffect(() => context.register(registration), [context, registration]);
}

export function MobileAppMenuProvider({ children }: { children: ReactNode }) {
  const parent = useContext(MobileAppMenuContext);
  if (parent) return <>{children}</>;
  return <MobileAppMenuRoot>{children}</MobileAppMenuRoot>;
}

function MobileAppMenuRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [registration, setRegistration] = useState<MobileAppMenuRegistration | null>(null);

  const register = useCallback((next: MobileAppMenuRegistration) => {
    setRegistration(next);
    return () => {
      setRegistration((current) => (current === next ? null : current));
    };
  }, []);

  const contextValue = useMemo(() => ({ register }), [register]);
  const isSettings = pathname === "/settings";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleItem(item: MobileAppMenuItem) {
    if (item.disabled) return;
    if (!item.keepOpen) setOpen(false);
    const result = await item.onSelect();
    if (item.keepOpen && result === true) setOpen(false);
  }

  function handleSettings() {
    setOpen(false);
    if (isSettings) {
      if (window.history.length > 1) router.back();
      else router.push("/");
      return;
    }
    router.push("/settings");
  }

  const contextualItems = registration?.items || [];
  const title = registration?.title || "Menu ứng dụng";
  const description = registration?.description || "Tác vụ nhanh và cài đặt.";

  return (
    <MobileAppMenuContext.Provider value={contextValue}>
      {children}
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Mở menu ứng dụng"
        className={`${styles.trigger} ${open || isSettings ? styles.triggerActive : ""}`}
        type="button"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className={styles.menuList}>
          {contextualItems.map((item) => (
            <button
              className={`${styles.menuItem} ${item.tone === "danger" ? styles.danger : ""}`}
              disabled={item.disabled}
              key={item.id}
              type="button"
              onClick={() => void handleItem(item)}
            >
              <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.menuCopy}>
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
              <span className={styles.menuChevron} aria-hidden="true">›</span>
            </button>
          ))}

          {contextualItems.length ? <div className={styles.divider} /> : null}

          <button className={styles.menuItem} type="button" onClick={handleSettings}>
            <span className={styles.menuIcon} aria-hidden="true">⚙</span>
            <span className={styles.menuCopy}>
              <strong>{isSettings ? "Đóng cài đặt" : "Cài đặt ứng dụng"}</strong>
              <small>{isSettings ? "Quay lại màn hình trước." : "Cấu hình dữ liệu và hành vi ứng dụng."}</small>
            </span>
            <span className={styles.menuChevron} aria-hidden="true">›</span>
          </button>

          {registration?.message ? <p className={styles.error}>{registration.message}</p> : null}
        </div>
      </BottomSheet>
    </MobileAppMenuContext.Provider>
  );
}
