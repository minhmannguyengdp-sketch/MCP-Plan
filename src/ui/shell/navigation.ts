export type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: string;
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Tổng quan", shortLabel: "Tổng", href: "/", description: "Tổng quan NPP", icon: "⌂" },
  { label: "MCP", shortLabel: "MCP", href: "/mcp", description: "Tuyến, phiên và cài đặt MCP", icon: "◇" },
  { label: "Đơn hàng", shortLabel: "Đơn", href: "/orders", description: "Doanh số và SKU", icon: "+" },
  { label: "BC phiên", shortLabel: "BC", href: "/reports", description: "Báo cáo chốt theo phiên MCP", icon: "▣" },
  { label: "MCP-Plan", shortLabel: "Plan", href: "/plans", description: "Kế hoạch hành động", icon: "✓" }
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  PRIMARY_NAV_ITEMS[0],
  PRIMARY_NAV_ITEMS[1],
  { label: "Tuyến gốc", shortLabel: "Tuyến", href: "/routes", description: "Tuyến gốc và khách tuyến", icon: "◎" },
  { label: "MCP hôm nay", shortLabel: "Hôm nay", href: "/visits", description: "Checklist phiên đang chạy: đơn, test, quan sát, follow-up", icon: "◇" },
  { label: "Phiên", shortLabel: "Phiên", href: "/mcp/sessions", description: "Lịch sử phiên chạy tuyến theo ngày, gồm nhánh test trong phiên", icon: "▤" },
  { label: "MCP Setting", shortLabel: "Mẫu", href: "/mcp-setting", description: "Mẫu dùng chung cho quan sát thị trường", icon: "⚙" },
  { label: "Khách hàng", shortLabel: "Khách", href: "/customers", description: "Hồ sơ điểm bán", icon: "□" },
  PRIMARY_NAV_ITEMS[2],
  PRIMARY_NAV_ITEMS[3],
  PRIMARY_NAV_ITEMS[4]
];

export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;
