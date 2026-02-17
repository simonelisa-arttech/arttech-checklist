import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/favicon.ico")) return true;
  if (pathname.startsWith("/robots.txt")) return true;
  if (pathname.startsWith("/sitemap.xml")) return true;
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|map)$/)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasSessionCookie = cookieHeader.includes("sb-");
  console.log("MW", pathname, "hasSessionCookie", hasSessionCookie);

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (hasSessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.delete("redirect");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
