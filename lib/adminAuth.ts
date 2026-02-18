import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/adminRoles";

type OperatoreAuthRow = {
  id: string;
  user_id: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  email: string | null;
  nome: string | null;
};

type RequireAdminOk = {
  ok: true;
  adminClient: SupabaseClient;
  user: User;
  operatore: OperatoreAuthRow;
};

type RequireAdminErr = {
  ok: false;
  response: NextResponse;
};

function unauthorized(message = "Unauthorized", status = 401): RequireAdminErr {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://atsystem.arttechworld.com"
  ).replace(/\/+$/, "");
}

export async function requireAdmin(request: Request): Promise<RequireAdminOk | RequireAdminErr> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return unauthorized("Missing Supabase envs", 500);
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cookieToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="))
    ?.split("=")
    .slice(1)
    .join("=");
  const accessToken = bearerToken || cookieToken || "";

  if (!accessToken) {
    return unauthorized();
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return unauthorized();
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: op, error: opErr } = await adminClient
    .from("operatori")
    .select("id, user_id, ruolo, attivo, email, nome")
    .eq("user_id", user.id)
    .maybeSingle();

  if (opErr) {
    return unauthorized(opErr.message, 500);
  }
  if (!op) {
    return unauthorized("Admin profile missing", 403);
  }

  const isAdmin = isAdminRole(op.ruolo) && op.attivo !== false;
  if (!isAdmin) {
    return unauthorized("Forbidden", 403);
  }

  return {
    ok: true,
    adminClient,
    user,
    operatore: op as OperatoreAuthRow,
  };
}
