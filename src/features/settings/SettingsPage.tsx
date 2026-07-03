import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { InstallAppCard } from "./InstallAppCard";

export function SettingsPage() {
  return (
    <AppShell activeHref="/settings">
      <PageHeader
        eyebrow="Settings"
        title="Cai dat app"
        subtitle="Cac tuy chon phu cho PWA, cap nhat phien ban va cai app. Khong dua vao bottom nav de tranh roi man hinh field sales."
      >
        <span className="badge">PWA</span>
      </PageHeader>

      <section className="settings-grid">
        <InstallAppCard />

        <div className="card settings-card">
          <div>
            <span className="badge">He thong</span>
            <h2 className="panel-title">Thong tin phien ban</h2>
            <p className="page-subtitle">Hien dang la ban UI/PWA mock-first. Backend, Supabase va VPS se noi sau qua API contract.</p>
          </div>

          <div className="grid">
            <div className="metric-row"><span>Mode</span><strong>Mock/API contract</strong></div>
            <div className="metric-row"><span>Mobile</span><strong>PWA-ready</strong></div>
            <div className="metric-row"><span>Offline</span><strong>Phase sau</strong></div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
