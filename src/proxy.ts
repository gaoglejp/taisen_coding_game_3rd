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
    "/practice/:path*",
    "/tutorial/:path*",
    // NOTE: /watch is intentionally NOT guarded — public spectating is
    // anonymous (see /api/match/:id/public, "no auth required"; gated by
    // isPublicWatch / watchingPublic). The watch page handles visibility.
    "/admin/:path*",
  ],
};
