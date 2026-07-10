import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./order-popups.css";
import "./outlet-profile.css";
import "./mobile-nav-tune.css";
import "./polish.css";
import "./compact-operational.css";
import "./safe-area.css";
import "./mcp-popup-compact.css";
import "./mcp-order-tea-filter.css";
import "./mcp-order-selected-compact.css";
import "./mcp-order-mobile-workbench.css";
import "./mcp-order-tree-readable.css";
import "./mcp-order-report-style.css";
import "./mcp-sessions-compact.css";
import "./mcp-sessions-color.css";
import "./mcp-compact-ui.css";
import "./mcp-order-main-final.css";
import "./mcp-scroll-restore.css";

export const metadata: Metadata = {
  title: "MCP-Plan",
  description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong.",
  applicationName: "MCP-Plan",
  icons: {
    icon: "/pwa-icon.svg",
    shortcut: "/pwa-icon.svg",
    apple: "/pwa-icon.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MCP-Plan"
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#101828"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
