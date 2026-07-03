import { KpiCard } from "@/ui/cards/KpiCard";
import { PageHeader } from "@/ui/layout/PageHeader";
import { AppShell } from "@/ui/shell/AppShell";

const kpis = [
  { label: "Tuyen active", value: 8, hint: "Mock data UI shell" },
  { label: "Diem ban", value: 51, hint: "Khach hang trong tuyen" },
  { label: "Luot ghe", value: 73, hint: "Theo luong report moi" },
  { label: "Don hang", value: 2, hint: "Se noi API sau" }
];

const modules = [
  ["Dashboard", "Tong quan nhanh tinh hinh NPP, route, visit, don hang."],
  ["Tuyen ban hang", "Quan ly route, khach hang theo tuyen va lich ghe."],
  ["Kiem tra thi truong", "Theo doi san pham, doi thu, co hoi va rui ro."],
  ["MCP-Plan", "Bien du lieu thanh ke hoach hanh dong ngay/tuan/thang."]
];

export default function HomePage() {
  return (
    <AppShell activeHref="/">
      <PageHeader
        eyebrow="Frontend shell"
        title="MCP-Plan Dashboard"
        subtitle="Khung UI moi cho report NPP: sach, tach backend, san sang mo rong thanh tool lon. Du lieu hien tai dang dung mock data de uu tien giao dien va kien truc."
      >
        <span className="badge">Mock data mode</span>
      </PageHeader>

      <section className="hero-panel">
        <div className="card">
          <h2 className="panel-title">Huong lam hien tai</h2>
          <p className="page-subtitle">
            Lam UI report moi truoc, khong phu thuoc Supabase. Backend sau nay co the dua qua VPS va frontend chi doi API base URL.
          </p>
          <div className="action-row">
            <a className="button primary" href="/routes">Xem tuyen ban hang</a>
            <a className="button" href="/plans">Xem MCP-Plan</a>
          </div>
        </div>

        <div className="card">
          <h2 className="panel-title">Kien truc da chot</h2>
          <p className="page-subtitle"><span className="status-dot" />UI khong goi Supabase truc tiep.</p>
          <p className="page-subtitle"><span className="status-dot" />Backend co the tach VPS.</p>
          <p className="page-subtitle"><span className="status-dot" />Supabase chi la data source.</p>
        </div>
      </section>

      <section className="grid cards">
        {kpis.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
        ))}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="panel-title">Module san pham</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Vai tro</th>
                <th>Trang thai</th>
              </tr>
            </thead>
            <tbody>
              {modules.map(([name, description]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{description}</td>
                  <td><span className="badge">UI shell</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
