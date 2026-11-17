import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Optimistic check only: send visitors without a session cookie to /login.
 * This is NOT the security boundary. Every page and Server Action verifies
 * the session against the database itself (src/lib/auth/guards.ts and
 * src/lib/actions.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
