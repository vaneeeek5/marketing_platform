import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const token = await getToken({ req });
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");

    if (isAuthPage) {
        if (isAuth) {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return null;
    }

    if (!isAuth) {
        let from = req.nextUrl.pathname;
        if (req.nextUrl.search) {
            from += req.nextUrl.search;
        }

        return NextResponse.redirect(
            new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
        );
    }

    // Role-based protection
    if (req.nextUrl.pathname.startsWith("/settings")) {
        if (token?.role !== "admin") {
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    return null;
}

export const config = {
    matcher: ["/settings/:path*", "/login", "/"], // Add other protected routes if needed, e.g. /leads, /reports
};
