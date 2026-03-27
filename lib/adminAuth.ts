import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { isAdminRole } from "@/lib/adminRoles";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

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

type RequireOperatoreOk = {
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

async function resolveOperatoreAuth(request: Request): Promise<RequireOperatoreOk | RequireAdminErr> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return unauthorized("Missing Supabase envs", 500);
  }

  const accessToken = getAccessTokenFromRequest(request);

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

  let operatore = op as OperatoreAuthRow | null;
  if (!operatore) {
    const userEmail = String(user.email || "").trim().toLowerCase();
    if (userEmail) {
      const { data: opByEmail, error: opEmailErr } = await adminClient
        .from("operatori")
        .select("id, user_id, ruolo, attivo, email, nome")
        .ilike("email", userEmail)
        .limit(1)
        .maybeSingle();

      if (opEmailErr) {
        return unauthorized(opEmailErr.message, 500);
      }
      if (opByEmail) {
        operatore = opByEmail as OperatoreAuthRow;
        if (!opByEmail.user_id || opByEmail.user_id !== user.id) {
          const { error: updErr } = await adminClient
            .from("operatori")
            .update({ user_id: user.id })
            .eq("id", opByEmail.id);
          if (updErr) {
            return unauthorized(updErr.message, 500);
          }
          operatore = { ...(opByEmail as OperatoreAuthRow), user_id: user.id };
        }
      }
    }
  }

  if (!operatore) {
    return unauthorized("Operatore non associato", 403);
  }
  if (operatore.attivo === false) {
    return unauthorized("Operatore inattivo", 403);
  }

  return {
    ok: true,
    adminClient,
    user,
    operatore,
  };
}

export async function requireOperatore(request: Request): Promise<RequireOperatoreOk | RequireAdminErr> {
  return resolveOperatoreAuth(request);
}

export async function requireAdmin(request: Request): Promise<RequireAdminOk | RequireAdminErr> {
  const auth = await resolveOperatoreAuth(request);
  if (!auth.ok) return auth;

  const isAdmin = isAdminRole(auth.operatore.ruolo) && auth.operatore.attivo !== false;
  if (!isAdmin) {
    return unauthorized("Forbidden", 403);
  }

  return {
    ok: true,
    adminClient: auth.adminClient,
    user: auth.user,
    operatore: auth.operatore,
  };
}
