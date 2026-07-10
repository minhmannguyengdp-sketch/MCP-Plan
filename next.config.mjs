/** @type {import('next').NextConfig} */
const localBackendRoutes = [
  "exports",
  "mcp-report-settings",
  "mcp-session-actions",
  "mcp-day/open-session",
  "mcp-day/session-customer/order",
  "mcp-day/session-customer/test",
  "mcp-day/session-customer/report",
  "mcp-day/session-customer/followup",
  "mcp-day/session-customer/status"
];

const backendRoutePattern = localBackendRoutes
  .map((route) => route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendBaseUrl = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!backendBaseUrl) {
      return [];
    }

    return [
      {
        source: `/api/backend/:path((?!${backendRoutePattern}).*)`,
        destination: `${backendBaseUrl.replace(/\/+$/, "")}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
