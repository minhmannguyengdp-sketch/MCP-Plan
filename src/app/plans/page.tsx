import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

export default function PlansPage() {
  return (
    <AppShell activeHref="/plans">
      <PageHeader
        eyebrow="Module"
        title="MCP-Plan"
        subtitle="Bien du lieu report, route, visit va don hang thanh ke hoach hanh dong cho NPP."
      />
      <div className="card">
        <h2 className="panel-title">Dang dung UI shell</h2>
        <p className="page-subtitle">Buoc tiep theo se tao mock plan board va danh sach viec uu tien.</p>
      </div>
    </AppShell>
  );
}
