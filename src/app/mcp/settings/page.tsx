import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

export default function McpSettingsPage() {
  return (
    <AppShell activeHref="/mcp">
      <PageHeader
        eyebrow="Cài đặt MCP"
        title="Cài đặt MCP"
        subtitle="Nơi chốt luật thêm khách, GPS, trạng thái và mẫu ghi nhận."
      />

      <section className="card">
        <h2 className="panel-title">Chưa bật logic</h2>
        <p className="page-subtitle">
          Phần này để placeholder. Khi chốt luật nghiệp vụ mới thêm backend và DB nếu cần.
        </p>
      </section>
    </AppShell>
  );
}
