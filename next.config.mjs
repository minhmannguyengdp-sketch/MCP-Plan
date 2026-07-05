/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendBaseUrl = process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!backendBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/backend/:path((?!mcp-report-settings|mcp-session-actions).*)",
        destination: `${backendBaseUrl.replace(/\/+$/, "")}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
