export type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: string;
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Tá»•ng quan", shortLabel: "Tá»•ng", href: "/", description: "Tá»•ng quan NPP", icon: "âŒ‚" },
  { label: "MCP", shortLabel: "MCP", href: "/visits", description: "PhiÃªn tuyáº¿n vÃ  lÆ°á»£t ghÃ©", icon: "â—‡" },
  { label: "ÄÆ¡n hÃ ng", shortLabel: "ÄÆ¡n", href: "/orders", description: "Doanh sá»‘ vÃ  SKU", icon: "+" },
  { label: "Test sáº£n pháº©m", shortLabel: "Test", href: "/field-checks", description: "File test vÃ  káº¿t quáº£", icon: "â—Œ" },
  { label: "MCP-Plan", shortLabel: "Plan", href: "/plans", description: "Káº¿ hoáº¡ch hÃ nh Ä‘á»™ng", icon: "âœ“" }
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  PRIMARY_NAV_ITEMS[0],
  { label: "Tuyáº¿n bÃ¡n hÃ ng", shortLabel: "Tuyáº¿n", href: "/routes", description: "Route vÃ  Ä‘iá»ƒm bÃ¡n", icon: "â—Ž" },
  { label: "KhÃ¡ch hÃ ng", shortLabel: "KhÃ¡ch", href: "/customers", description: "Há»“ sÆ¡ Ä‘iá»ƒm bÃ¡n", icon: "â–¡" },
  PRIMARY_NAV_ITEMS[1],
  PRIMARY_NAV_ITEMS[2],
  PRIMARY_NAV_ITEMS[3],
  { label: "BÃ¡o cÃ¡o thá»‹ trÆ°á»ng", shortLabel: "BC", href: "/reports", description: "GiÃ¡, Ä‘á»‘i thá»§, trÆ°ng bÃ y, tá»“n kho", icon: "â–£" },
  PRIMARY_NAV_ITEMS[4]
];

export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;
