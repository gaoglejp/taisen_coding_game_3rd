import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("session")?.value);

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rooms/:path*",
    "/match/:path*",
    "/watch/:path*",
    "/admin/:path*",
  ],
};
