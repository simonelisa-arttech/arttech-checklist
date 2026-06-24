import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 90;

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/reset-password",
  "/auth/login",
  "/api/auth/password-recovery",
  "/api/public/",
  "/registrazione",
];
const API_PREFIX = "/api/";
const ASSET_PREFIXES = ["/_next", "/images"];
const ASSET_FILE_RE =
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff|woff2|ttf|eot)$/i;
const SIM_SYNC_PATH = "/api/sim/sync-from-licenses";
const CLIENT_PORTAL_PATH = "/cliente";

type SimSyncAuthDebugReason =
  | "access-token-missing"
  | "access-token-invalid"
  | "refresh-token-missing"
  | "refresh-failed"
  | "refresh-user-invalid";

function unauthorizedApiResponse(pathname: string, reason?: SimSyncAuthDebugReason) {
  const response = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (pathname === SIM_SYNC_PATH && reason) {
    response.headers.set("x-auth-debug", reason);
    console.warn("[middleware][sim-sync] unauthorized", {
      pathname,
      reason,
    });
  }

  return response;
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

  // Access token assente MA refresh token presente: non fare logout.
  // Si prosegue e si tenta il refresh silenzioso piu' sotto, cosi' la
  // permanenza effettiva sul sito dura quanto il refresh token (90 giorni)
  // e non quanto la scadenza JWT dell'access token.
  if (!accessToken && !refreshToken) {
    if (isApiRequest) {
      return unauthorizedApiResponse(pathname, "refresh-token-missing");
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let currentUserId: string | null = null;
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let userError: Error | null = null;
  if (accessToken) {
    const userResult = await supabase.auth.getUser(accessToken);
    user = userResult.data.user;
    userError = userResult.error;
  }
  currentUserId = user?.id ?? null;

  if (user) {
    if (serviceRoleKey) {
      const portalRedirect = await getClientPortalRedirectIfNeeded({
        pathname,
        nextUrl: req.nextUrl,
        userId: user.id,
        supabaseUrl,
        serviceRoleKey,
      });
      if (portalRedirect) return portalRedirect;
    }
    return res;
  }

  if (refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      currentUserId = data.user?.id ?? null;
      const secure = process.env.NODE_ENV === "production";
      // Inoltra il nuovo access token alla route a valle: la richiesta corrente
      // (pagina o API) prosegue subito senza 401 dopo il refresh silenzioso.
      const forwardedHeaders = new Headers(req.headers);
      forwardedHeaders.set("authorization", `Bearer ${data.session.access_token}`);
      const refreshedRes = NextResponse.next({ request: { headers: forwardedHeaders } });
      refreshedRes.cookies.set("sb-access-token", data.session.access_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: data.session.expires_in ?? 3600,
      });
      refreshedRes.cookies.set("sb-refresh-token", data.session.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });
      if (currentUserId && serviceRoleKey) {
        const portalRedirect = await getClientPortalRedirectIfNeeded({
          pathname,
          nextUrl: req.nextUrl,
          userId: currentUserId,
          supabaseUrl,
          serviceRoleKey,
        });
        if (portalRedirect) {
          portalRedirect.cookies.set("sb-access-token", data.session.access_token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: data.session.expires_in ?? 3600,
          });
          portalRedirect.cookies.set("sb-refresh-token", data.session.refresh_token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: REFRESH_TOKEN_MAX_AGE,
          });
          return portalRedirect;
        }
      }
      return refreshedRes;
    }

    if (isApiRequest && pathname === SIM_SYNC_PATH) {
      const reason: SimSyncAuthDebugReason =
        !error && data?.session ? "refresh-user-invalid" : "refresh-failed";
      return unauthorizedApiResponse(pathname, reason);
    }
  }

  if (isApiRequest) {
    return unauthorizedApiResponse(
      pathname,
      refreshToken ? "access-token-invalid" : userError ? "access-token-invalid" : "refresh-token-missing"
    );
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

async function getClientPortalRedirectIfNeeded({
  pathname,
  nextUrl,
  userId,
  supabaseUrl,
  serviceRoleKey,
}: {
  pathname: string;
  nextUrl: NextRequest["nextUrl"];
  userId: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}) {
  if (
    pathname.startsWith(API_PREFIX) ||
    pathname.startsWith(CLIENT_PORTAL_PATH) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/")
  ) {
    return null;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: clientePortalAccess, error } = await adminClient
    .from("clienti_portale_auth")
    .select("id")
    .eq("user_id", userId)
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();

  if (error || !clientePortalAccess?.id) {
    return null;
  }

  const redirectUrl = nextUrl.clone();
  redirectUrl.pathname = CLIENT_PORTAL_PATH;
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}
