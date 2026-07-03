import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

export default function CustomersPage() {
  return (
    <AppShell activeHref="/customers">
      <PageHeader
        eyebrow="Module"
        title="Khach hang / diem ban"
        subtitle="Quan ly ho so diem ban, khu vuc, dia chi, so dien thoai va lich su cham soc."
      />
      <div className="card">
        <h2 className="panel-title">Dang dung UI shell</h2>
        <p className="page-subtitle">Buoc tiep theo se tao customer table dung chung DataTable va mock data.</p>
      </div>
    </AppShell>
  );
}
