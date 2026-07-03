import type { ReactNode } from "react";
import { NAV_ITEMS } from "./navigation";

type AppShellProps = {
  children: ReactNode;
  activeHref?: string;
};

function NavLinks({ activeHref, mode }: { activeHref: string; mode: "sidebar" | "bottom" }) {
  return (
    <nav className={mode === "sidebar" ? "sidebar-nav" : "bottom-nav"} aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === activeHref;
        const className = mode === "sidebar" ? (isActive ? "sidebar-link active" : "sidebar-link") : isActive ? "bottom-nav-link active" : "bottom-nav-link";

        return (
          <a className={className} href={item.href} key={item.href}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{mode === "sidebar" ? item.label : item.shortLabel}</span>
          </a>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, activeHref = "/" }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-title">MCP-Plan</div>
          <div className="sidebar-subtitle">Cong cu quan ly NPP, report va ke hoach hanh dong.</div>
        </div>

        <NavLinks activeHref={activeHref} mode="sidebar" />

        <a className={activeHref === "/settings" ? "sidebar-link active utility-link" : "sidebar-link utility-link"} href="/settings">
          <span className="nav-icon" aria-hidden="true">⚙</span>
          <span>Cai dat</span>
        </a>

        <div className="sidebar-footer">Frontend sach truoc. Backend/VPS va Supabase noi sau theo API contract.</div>
      </aside>

      <a className={activeHref === "/settings" ? "mobile-settings-link active" : "mobile-settings-link"} href="/settings" aria-label="Cai dat">
        ⚙
      </a>

      <main className="main">{children}</main>
      <NavLinks activeHref={activeHref} mode="bottom" />
    </div>
  );
}
