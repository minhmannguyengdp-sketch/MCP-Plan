import Link from "next/link";
import type { ReactNode } from "react";
import { PRIMARY_NAV_ITEMS, SIDEBAR_NAV_ITEMS, type NavItem } from "./navigation";
import { SettingsQuickButton } from "./SettingsQuickButton";

type AppShellProps = { children: ReactNode; activeHref?: string };

function NavLinks({ activeHref, items, mode }: { activeHref: string; items: NavItem[]; mode: "sidebar" | "bottom" }) {
  const style = mode === "bottom" ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined;
  return <nav className={mode === "sidebar" ? "sidebar-nav" : "bottom-nav"} style={style} aria-label="Điều hướng chính">
    {items.map((item) => {
      const isActive = item.href === activeHref;
      const className = mode === "sidebar" ? (isActive ? "sidebar-link active" : "sidebar-link") : (isActive ? "bottom-nav-link active" : "bottom-nav-link");
      return <Link className={className} href={item.href} key={item.href} prefetch><span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-label">{mode === "sidebar" ? item.label : item.shortLabel}</span></Link>;
    })}
  </nav>;
}

export function AppShell({ children, activeHref = "/" }: AppShellProps) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><div className="sidebar-title">MCP-Plan</div><div className="sidebar-subtitle">Quản lý tuyến bán hàng, điểm bán, đơn hàng và công việc.</div></div>
      <NavLinks activeHref={activeHref} items={SIDEBAR_NAV_ITEMS} mode="sidebar" />
      <Link className={activeHref === "/settings" ? "sidebar-link active utility-link" : "sidebar-link utility-link"} href="/settings" prefetch><span className="nav-icon" aria-hidden="true">⚙</span><span>Cài đặt ứng dụng</span></Link>
      <div className="sidebar-footer">MCP-Plan · Quản lý phân phối</div>
    </aside>
    <SettingsQuickButton />
    <main className="main">{children}</main>
    <NavLinks activeHref={activeHref} items={PRIMARY_NAV_ITEMS} mode="bottom" />
  </div>;
}
