export type NavItem = {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: string;
};

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "T\u1ed5ng quan", shortLabel: "T\u1ed5ng", href: "/", description: "T\u1ed5ng quan NPP", icon: "⌂" },
  { label: "MCP", shortLabel: "MCP", href: "/mcp", description: "Tuy\u1ebfn, phi\u00ean h\u00f4m nay v\u00e0 c\u00e0i \u0111\u1eb7t MCP", icon: "◇" },
  { label: "\u0110\u01a1n h\u00e0ng", shortLabel: "\u0110\u01a1n", href: "/orders", description: "Doanh s\u1ed1 v\u00e0 SKU", icon: "+" },
  { label: "Test s\u1ea3n ph\u1ea9m", shortLabel: "Test", href: "/field-checks", description: "File test v\u00e0 k\u1ebft qu\u1ea3", icon: "◌" },
  { label: "MCP-Plan", shortLabel: "Plan", href: "/plans", description: "K\u1ebf ho\u1ea1ch h\u00e0nh \u0111\u1ed9ng", icon: "✓" }
];

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  PRIMARY_NAV_ITEMS[0],
  PRIMARY_NAV_ITEMS[1],
  { label: "Tuy\u1ebfn", shortLabel: "Tuy\u1ebfn", href: "/routes", description: "Tuy\u1ebfn g\u1ed1c v\u00e0 kh\u00e1ch tuy\u1ebfn", icon: "◎" },
  { label: "MCP h\u00f4m nay", shortLabel: "H\u00f4m nay", href: "/visits", description: "Phi\u00ean tuy\u1ebfn v\u00e0 l\u01b0\u1ee3t gh\u00e9", icon: "◇" },
  { label: "Kh\u00e1ch h\u00e0ng", shortLabel: "Kh\u00e1ch", href: "/customers", description: "H\u1ed3 s\u01a1 \u0111i\u1ec3m b\u00e1n", icon: "□" },
  PRIMARY_NAV_ITEMS[2],
  PRIMARY_NAV_ITEMS[3],
  { label: "B\u00e1o c\u00e1o th\u1ecb tr\u01b0\u1eddng", shortLabel: "BC", href: "/reports", description: "Gi\u00e1, \u0111\u1ed1i th\u1ee7, tr\u01b0ng b\u00e0y, t\u1ed3n kho", icon: "▣" },
  PRIMARY_NAV_ITEMS[4]
];

export const NAV_ITEMS = SIDEBAR_NAV_ITEMS;
