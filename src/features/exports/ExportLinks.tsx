export type ExportLink = {
  label: string;
  href: string;
  tone?: "primary";
  hint?: string;
};

type ExportGroup = {
  title: string;
  links: ExportLink[];
};

export const MCP_EXCEL_LINKS: ExportLink[] = [
  { label: "Danh sách điểm bán", href: "/api/backend/exports/route-customers.csv", tone: "primary", hint: "Tên, địa chỉ, vị trí và liên kết bản đồ" },
  { label: "Chi tiết phiên bán hàng", href: "/api/backend/exports/mcp-sessions.csv", hint: "Điểm bán, kết quả ghé và phát sinh trong phiên" },
  { label: "Đơn hàng và sản phẩm", href: "/api/backend/exports/orders.csv", hint: "Thông tin đơn hàng và từng dòng sản phẩm" },
  { label: "Ghi nhận thị trường", href: "/api/backend/exports/market-reports.csv", hint: "Đối thủ, sản phẩm đang dùng, nhu cầu và cơ hội" },
  { label: "Việc cần theo dõi", href: "/api/backend/exports/followups.csv", hint: "Việc cần làm, ngày hẹn và người phụ trách" },
  { label: "Kết quả thử sản phẩm", href: "/api/backend/exports/tests.csv", hint: "Sản phẩm đã thử và kết quả theo điểm bán" }
];

export const MCP_PDF_LINKS: ExportLink[] = [];

function groupsFromLinks(excelLinks: ExportLink[], pdfLinks: ExportLink[]) {
  const groups: ExportGroup[] = [];
  if (excelLinks.length) groups.push({ title: "Dữ liệu Excel / CSV", links: excelLinks });
  if (pdfLinks.length) groups.push({ title: "Báo cáo để đọc và in", links: pdfLinks });
  return groups;
}

export function ExportMenu({ label = "Xuất file", excelLinks = MCP_EXCEL_LINKS, pdfLinks = MCP_PDF_LINKS, groups, primary = false }: { label?: string; excelLinks?: ExportLink[]; pdfLinks?: ExportLink[]; groups?: ExportGroup[]; primary?: boolean }) {
  const items = groups || groupsFromLinks(excelLinks, pdfLinks);
  return <details className="export-menu">
    <summary className={primary ? "button primary export-menu-trigger" : "button export-menu-trigger"}>{label} ▾</summary>
    <div className="export-menu-panel">
      {items.map((group) => <div className="export-menu-group" key={group.title}>
        <strong>{group.title}</strong>
        {group.links.map((item) => <a className={item.tone === "primary" ? "export-menu-link primary" : "export-menu-link"} key={item.href} href={item.href} target="_blank" rel="noreferrer">
          <span>{item.label}</span>
          {item.hint ? <small>{item.hint}</small> : null}
        </a>)}
      </div>)}
    </div>
  </details>;
}

export function ExportLinksPanel({ title = "Xuất file", subtitle = "Tải dữ liệu để đối chiếu hoặc mở báo cáo để in và lưu PDF.", excelLinks = MCP_EXCEL_LINKS, pdfLinks = MCP_PDF_LINKS }: { title?: string; subtitle?: string; excelLinks?: ExportLink[]; pdfLinks?: ExportLink[] }) {
  return <section className="card" style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><strong>{title}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{subtitle}</p></div>
      <ExportMenu label="Chọn file cần xuất" excelLinks={excelLinks} pdfLinks={pdfLinks} primary />
    </div>
  </section>;
}

export function buildExportLink(label: string, href: string, tone?: "primary", hint?: string): ExportLink {
  return { label, href, tone, hint };
}
