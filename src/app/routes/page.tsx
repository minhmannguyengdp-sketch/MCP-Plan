import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

export default function RoutesPage() {
  return (
    <AppShell activeHref="/routes">
      <PageHeader
        eyebrow="Module"
        title="Tuyen ban hang"
        subtitle="Man hinh route se dung mock data truoc, sau do noi API/backend VPS theo contract."
      />
      <div className="card">
        <h2 className="panel-title">Dang dung UI shell</h2>
        <p className="page-subtitle">Buoc tiep theo se tao bang route, filter khu vuc, sale va trang thai tuyen.</p>
      </div>
    </AppShell>
  );
}
