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
  { label: "Khách/tuyến + GPS", href: "/api/backend/exports/route-customers.csv", tone: "primary", hint: "Danh sách khách tuyến, tọa độ, Google Maps" },
  { label: "Phiên/checklist", href: "/api/backend/exports/mcp-sessions.csv", hint: "Snapshot khách trong phiên, trạng thái ghé" },
  { label: "Đơn hàng + item", href: "/api/backend/exports/orders.csv", hint: "Header đơn và dòng sản phẩm" },
  { label: "BC thị trường", href: "/api/backend/exports/market-reports.csv", hint: "Đối thủ, brand đang dùng, nhu cầu" },
  { label: "Follow-up", href: "/api/backend/exports/followups.csv", hint: "Việc cần làm, ngày hẹn, owner" },
  { label: "Test", href: "/api/backend/exports/tests.csv", hint: "Hồ sơ test và kết quả theo khách" }
];

export const MCP_PDF_LINKS: ExportLink[] = [
  { label: "Dashboard", href: "/api/backend/pdf/dashboard", tone: "primary", hint: "Tổng quan quản trị để in/lưu PDF" },
  { label: "BC thị trường", href: "/api/backend/pdf/market-report", hint: "Báo cáo thị trường tổng hợp" }
];

function groupsFromLinks(excelLinks: ExportLink[], pdfLinks: ExportLink[]) {
  const groups: ExportGroup[] = [];
  if (excelLinks.length) groups.push({ title: "Excel dữ liệu", links: excelLinks });
  if (pdfLinks.length) groups.push({ title: "PDF báo cáo", links: pdfLinks });
  return groups;
}

export function ExportMenu({ label = "Xuất", excelLinks = MCP_EXCEL_LINKS, pdfLinks = MCP_PDF_LINKS, groups, primary = false }: { label?: string; excelLinks?: ExportLink[]; pdfLinks?: ExportLink[]; groups?: ExportGroup[]; primary?: boolean }) {
  const items = groups || groupsFromLinks(excelLinks, pdfLinks);
  return <details style={{ position: "relative", display: "inline-block" }}>
    <summary className={primary ? "button primary" : "button"} style={{ listStyle: "none", cursor: "pointer" }}>{label} ▾</summary>
    <div style={{ position: "absolute", right: 0, zIndex: 50, minWidth: 260, marginTop: 8, padding: 10, border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel)", boxShadow: "var(--shadow)" }}>
      {items.map((group) => <div key={group.title} style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <strong style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{group.title}</strong>
        {group.links.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer" style={{ display: "grid", gap: 2, padding: "8px 10px", borderRadius: 10, background: "var(--panel-soft)", border: "1px solid var(--line)", fontWeight: 700 }}>
          <span>{item.label}</span>
          {item.hint ? <small style={{ color: "var(--muted)", fontWeight: 400 }}>{item.hint}</small> : null}
        </a>)}
      </div>)}
    </div>
  </details>;
}

export function ExportLinksPanel({ title = "Xuất file", subtitle = "Tải Excel nền hoặc mở bản in PDF vận hành.", excelLinks = MCP_EXCEL_LINKS, pdfLinks = MCP_PDF_LINKS }: { title?: string; subtitle?: string; excelLinks?: ExportLink[]; pdfLinks?: ExportLink[] }) {
  return <section className="card" style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><strong>{title}</strong><p className="page-subtitle" style={{ margin: "4px 0 0" }}>{subtitle}</p></div>
      <ExportMenu label="Xuất" excelLinks={excelLinks} pdfLinks={pdfLinks} primary />
    </div>
  </section>;
}

export function buildExportLink(label: string, href: string, tone?: "primary", hint?: string): ExportLink {
  return { label, href, tone, hint };
}
