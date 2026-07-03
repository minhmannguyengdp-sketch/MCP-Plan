import { NAV_ITEMS } from "./navigation";

type AppShellProps = {
  children: React.ReactNode;
  activeHref?: string;
};

export function AppShell({ children, activeHref = "/" }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-title">MCP-Plan</div>
          <div className="sidebar-subtitle">Cong cu quan ly NPP, report va ke hoach hanh dong.</div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === activeHref;

            return (
              <a className={isActive ? "sidebar-link active" : "sidebar-link"} href={item.href} key={item.href}>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-footer">Frontend sach truoc. Backend/VPS va Supabase noi sau theo API contract.</div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
