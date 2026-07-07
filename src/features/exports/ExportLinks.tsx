type ExportLink = {
  label: string;
  href: string;
  tone?: "primary";
  hint?: string;
};

const EXCEL_LINKS: ExportLink[] = [
  { label: "Excel khách/tuyến + GPS", href: "/api/backend/exports/route-customers.csv", tone: "primary", hint: "Danh sách khách tuyến, tọa độ, Google Maps" },
  { label: "Excel phiên/checklist", href: "/api/backend/exports/mcp-sessions.csv", hint: "Snapshot khách trong phiên, trạng thái ghé" },
  { label: "Excel đơn hàng + item", href: "/api/backend/exports/orders.csv", hint: "Header đơn và dòng sản phẩm" },
  { label: "Excel BC thị trường", href: "/api/backend/exports/market-reports.csv", hint: "Đối thủ, brand đang dùng, nhu cầu" },
  { label: "Excel follow-up", href: "/api/backend/exports/followups.csv", hint: "Việc cần làm, ngày hẹn, owner" },
  { label: "Excel test", href: "/api/backend/exports/tests.csv", hint: "Hồ sơ test và kết quả theo khách" }
];

const PDF_LINKS: ExportLink[] = [
  { label: "PDF dashboard", href: "/api/backend/pdf/dashboard", tone: "primary", hint: "Tổng quan quản trị để in/lưu PDF" },
  { label: "PDF BC thị trường", href: "/api/backend/pdf/market-report", hint: "Báo cáo thị trường tổng hợp" }
];

function ExportButton({ item }: { item: ExportLink }) {
  return <a className={item.tone === "primary" ? "button primary" : "button"} href={item.href} target="_blank" rel="noreferrer">{item.label}</a>;
}

export function ExportLinksPanel({ title = "Xuất file", subtitle = "Tải Excel nền hoặc mở bản in PDF vận hành.", excelLinks = EXCEL_LINKS, pdfLinks = PDF_LINKS }: { title?: string; subtitle?: string; excelLinks?: ExportLink[]; pdfLinks?: ExportLink[] }) {
  return <section className="card" style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
      <div><strong>{title}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{subtitle}</p></div>
      <span className="badge">Excel / PDF</span>
    </div>
    <div className="grid" style={{ gap: 10 }}>
      <div>
        <p className="page-subtitle" style={{ marginBottom: 8 }}><b>Excel nền</b></p>
        <div className="sheet-action-grid">{excelLinks.map((item) => <ExportButton item={item} key={item.href} />)}</div>
      </div>
      <div>
        <p className="page-subtitle" style={{ marginBottom: 8 }}><b>PDF vận hành</b></p>
        <div className="sheet-action-grid">{pdfLinks.map((item) => <ExportButton item={item} key={item.href} />)}</div>
      </div>
    </div>
  </section>;
}

export function buildExportLink(label: string, href: string, tone?: "primary"): ExportLink {
  return { label, href, tone };
}
