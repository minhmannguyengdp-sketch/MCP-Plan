export type NavItem = { label: string; shortLabel: string; href: string; description: string; icon: string };

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Tổng quan", shortLabel: "Tổng", href: "/", description: "Tình hình kinh doanh và công việc cần xử lý", icon: "⌂" },
  { label: "MCP", shortLabel: "MCP", href: "/mcp", description: "Quản lý tuyến và phiên đi thị trường", icon: "◇" },
  { label: "Đơn hàng", shortLabel: "Đơn", href: "/orders", description: "Theo dõi đơn hàng và doanh số", icon: "+" },
  { label: "Báo cáo phiên", shortLabel: "Báo cáo", href: "/reports", description: "Báo cáo sau mỗi phiên đi tuyến", icon: "▣" },
  { label: "Kế hoạch", shortLabel: "Việc", href: "/plans", description: "Công việc cần theo dõi và xử lý", icon: "✓" }
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  PRIMARY_NAV_ITEMS[0], PRIMARY_NAV_ITEMS[1],
  { label: "Tuyến bán hàng", shortLabel: "Tuyến", href: "/routes", description: "Quản lý tuyến và điểm bán trong tuyến", icon: "◎" },
  { label: "Đi tuyến hôm nay", shortLabel: "Hôm nay", href: "/visits", description: "Ghi nhận kết quả tại từng điểm bán", icon: "◇" },
  { label: "Lịch sử phiên", shortLabel: "Phiên", href: "/mcp/sessions", description: "Tra cứu các phiên đi tuyến theo ngày", icon: "▤" },
  { label: "Cài đặt MCP", shortLabel: "Mẫu", href: "/mcp-setting", description: "Thiết lập lựa chọn nhanh cho báo cáo", icon: "⚙" },
  { label: "Điểm bán", shortLabel: "Khách", href: "/customers", description: "Hồ sơ và lịch sử chăm sóc điểm bán", icon: "□" },
  PRIMARY_NAV_ITEMS[2], PRIMARY_NAV_ITEMS[3], PRIMARY_NAV_ITEMS[4]
];

export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;
