import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

export default function OrdersPage() {
  return (
    <AppShell activeHref="/orders">
      <PageHeader
        eyebrow="Module"
        title="Don hang"
        subtitle="Theo doi don hang, doanh so, SKU, khach hang va nguon phat sinh don."
      />
      <div className="card">
        <h2 className="panel-title">Dang dung UI shell</h2>
        <p className="page-subtitle">Buoc tiep theo se tao order table va KPI doanh so bang mock data.</p>
      </div>
    </AppShell>
  );
}
