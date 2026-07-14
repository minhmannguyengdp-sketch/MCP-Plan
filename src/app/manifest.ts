import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MCP-Plan",
    short_name: "MCP-Plan",
    description: "Quản lý nhà phân phối, tuyến bán hàng, điểm bán, đơn hàng và công việc.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eef2ff",
    theme_color: "#6d5dfc",
    orientation: "portrait",
    icons: [
      { src: "/pwa-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
