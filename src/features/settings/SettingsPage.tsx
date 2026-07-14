import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";
import { InstallAppCard } from "./InstallAppCard";

export function SettingsPage() {
  return <AppShell activeHref="/settings">
    <PageHeader eyebrow="Cài đặt" title="Cài đặt ứng dụng" subtitle="Cài MCP-Plan trên thiết bị và làm mới ứng dụng khi có phiên bản mới."><span className="badge">Ứng dụng web</span></PageHeader>
    <section className="settings-grid">
      <InstallAppCard />
      <div className="card settings-card"><div><span className="badge">Thông tin ứng dụng</span><h2 className="panel-title">Trạng thái sử dụng</h2><p className="page-subtitle">MCP-Plan sẵn sàng hỗ trợ quản lý tuyến bán hàng, chăm sóc điểm bán và theo dõi công việc hằng ngày.</p></div><div className="grid"><div className="metric-row"><span>Trạng thái</span><strong>Sẵn sàng sử dụng</strong></div><div className="metric-row"><span>Thiết bị</span><strong>Điện thoại và máy tính bảng</strong></div><div className="metric-row"><span>Cập nhật</span><strong>Làm mới nhanh</strong></div></div></div>
    </section>
  </AppShell>;
}
