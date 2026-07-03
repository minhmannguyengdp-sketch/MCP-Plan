import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import "./order-popups.css";
import "./mobile-nav-tune.css";

export const metadata: Metadata = {
  title: "MCP-Plan",
  description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong.",
  applicationName: "MCP-Plan",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MCP-Plan"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#101828"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
