export type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: string;
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Tổng quan", shortLabel: "Tổng", href: "/", description: "Tổng quan NPP", icon: "⌂" },
  { label: "MCP", shortLabel: "MCP", href: "/visits", description: "Phiên tuyến và lượt ghé", icon: "◇" },
  { label: "Đơn hàng", shortLabel: "Đơn", href: "/orders", description: "Doanh số và SKU", icon: "+" },
  { label: "Test sản phẩm", shortLabel: "Test", href: "/field-checks", description: "File test và kết quả", icon: "◌" },
  { label: "MCP-Plan", shortLabel: "Plan", href: "/plans", description: "Kế hoạch hành động", icon: "✓" }
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  PRIMARY_NAV_ITEMS[0],
  { label: "Tuyến bán hàng", shortLabel: "Tuyến", href: "/routes", description: "Route và điểm bán", icon: "◎" },
  { label: "Khách hàng", shortLabel: "Khách", href: "/customers", description: "Hồ sơ điểm bán", icon: "□" },
  PRIMARY_NAV_ITEMS[1],
  PRIMARY_NAV_ITEMS[2],
  PRIMARY_NAV_ITEMS[3],
  { label: "Báo cáo thị trường", shortLabel: "BC", href: "/reports", description: "Giá, đối thủ, trưng bày, tồn kho", icon: "▣" },
  PRIMARY_NAV_ITEMS[4]
];

export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;
