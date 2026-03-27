import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/reset-password",
  "/auth/login",
  "/api/auth/password-recovery",
];
const API_PREFIX = "/api/";
const ASSET_PREFIXES = ["/_next", "/images"];
const ASSET_FILE_RE =
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff|woff2|ttf|eot)$/i;

function unauthorizedApiResponse() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRequest = pathname === "/api" || pathname.startsWith(API_PREFIX);

  if (process.env.E2E === "1") {
    return NextResponse.next();
  }

  if (
    pathname === "/favicon.ico" ||
    ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    ASSET_FILE_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = getAccessTokenFromRequest(req);
  const refreshToken = req.cookies.get("sb-refresh-token")?.value;

  if (!accessToken) {
    if (isApiRequest) {
      return unauthorizedApiResponse();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const res = NextResponse.next();
  let currentUserId: string | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);
  currentUserId = user?.id ?? null;

  if (user) {
    return res;
  }

  if (refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      currentUserId = data.user?.id ?? null;
      const secure = process.env.NODE_ENV === "production";
      res.cookies.set("sb-access-token", data.session.access_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: data.session.expires_in ?? 3600,
      });
      res.cookies.set("sb-refresh-token", data.session.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  if (isApiRequest) {
    return unauthorizedApiResponse();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  const redirectResponse = NextResponse.redirect(url);
  redirectResponse.cookies.delete("sb-access-token");
  redirectResponse.cookies.delete("sb-refresh-token");
  return redirectResponse;
}

export const config = {
  matcher: [
    "/:path*",
  ],
};
