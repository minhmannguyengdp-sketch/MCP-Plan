import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MCP-Plan",
    short_name: "MCP-Plan",
    description: "Quan ly NPP, tuyen ban hang, don hang va ke hoach hanh dong.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5faf8",
    theme_color: "#00957f",
    orientation: "portrait",
    icons: [
      { src: "/pwa-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
