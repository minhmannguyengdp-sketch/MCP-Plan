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
import { APP_MENU_GROUPS, navItemForHref } from "./navigation";
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
  openMenu: () => void;
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

export function AppTopBar({ activeHref }: { activeHref: string }) {
  const context = useContext(MobileAppMenuContext);
  if (!context) throw new Error("AppTopBar must be used inside MobileAppMenuProvider");
  const current = navItemForHref(activeHref);

  return (
    <header className={styles.topBar} data-app-top-bar>
      <div className={styles.topBarIdentity}>
        <span className={styles.topBarMark} aria-hidden="true">HP</span>
        <span className={styles.topBarCopy}>
          <small>MCP-Plan</small>
          <strong>{current.label}</strong>
        </span>
      </div>
      <div className={styles.topBarActions}>
        <div className={styles.topBarTools} data-app-top-bar-tools />
        <button
          aria-haspopup="dialog"
          aria-label="Mở menu ứng dụng"
          className={styles.trigger}
          type="button"
          onClick={context.openMenu}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>
    </header>
  );
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
  const openMenu = useCallback(() => setOpen(true), []);
  const contextValue = useMemo(() => ({ register, openMenu }), [register, openMenu]);
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

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
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

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  const contextualItems = registration?.items || [];
  const title = registration?.title || "Menu MCP";
  const description = registration?.description || "Chuyển phân hệ, mở tác vụ màn hình và cấu hình ứng dụng.";

  return (
    <MobileAppMenuContext.Provider value={contextValue}>
      {children}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className={styles.menuList}>
          {contextualItems.length ? (
            <section className={styles.menuSection} aria-label="Tác vụ màn hình">
              <div className={styles.sectionHeading}>
                <strong>Tác vụ màn hình</strong>
                <small>Áp dụng cho nội dung đang mở</small>
              </div>
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
            </section>
          ) : null}

          {APP_MENU_GROUPS.map((group) => (
            <section className={styles.menuSection} aria-label={group.label} key={group.id}>
              <div className={styles.sectionHeading}><strong>{group.label}</strong></div>
              <div className={styles.navigationGrid}>
                {group.items.map((item) => (
                  <button
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ""}`}
                    key={item.href}
                    type="button"
                    onClick={() => navigate(item.href)}
                  >
                    <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                    <span className={styles.navCopy}>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <div className={styles.divider} />
          <button className={`${styles.menuItem} ${isSettings ? styles.menuItemActive : ""}`} type="button" onClick={handleSettings}>
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
