import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/backend/mcp-day/session-customer/test") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/mcp-day/session-customer/test";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/backend/mcp-day/session-customer/test"]
};
