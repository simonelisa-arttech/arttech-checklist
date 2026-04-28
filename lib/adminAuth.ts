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
  can_access_impostazioni?: boolean | null;
  can_access_backoffice?: boolean | null;
  can_access_operator_app?: boolean | null;
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

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function pickBestOperatoreCandidate(rows: OperatoreAuthRow[], userId: string, userEmail: string) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  const ranked = [...rows].sort((a, b) => {
    const score = (row: OperatoreAuthRow) => {
      let total = 0;
      if (row.attivo !== false) total += 1000;
      if (normalizeEmail(row.email) === normalizedUserEmail) total += 500;
      if (String(row.user_id || "") === userId) total += 250;
      if (row.can_access_impostazioni === true) total += 50;
      if (row.can_access_backoffice === true) total += 25;
      if (row.can_access_operator_app === true) total += 10;
      if (isAdminRole(row.ruolo)) total += 25;
      return total;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "it", { sensitivity: "base" });
  });
  return ranked[0] || null;
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
    .select("id, user_id, ruolo, attivo, email, nome, can_access_impostazioni, can_access_backoffice, can_access_operator_app")
    .eq("user_id", user.id);

  if (opErr) {
    return unauthorized(opErr.message, 500);
  }

  const userEmail = normalizeEmail(user.email);
  let operatoriByEmail: OperatoreAuthRow[] = [];
  if (userEmail) {
    const { data: opByEmail, error: opEmailErr } = await adminClient
      .from("operatori")
      .select("id, user_id, ruolo, attivo, email, nome, can_access_impostazioni, can_access_backoffice, can_access_operator_app")
      .ilike("email", userEmail);

    if (opEmailErr) {
      return unauthorized(opEmailErr.message, 500);
    }
    operatoriByEmail = (opByEmail || []) as OperatoreAuthRow[];
  }

  const candidates = [...((op || []) as OperatoreAuthRow[]), ...operatoriByEmail].reduce<OperatoreAuthRow[]>(
    (acc, row) => {
      if (!row?.id || acc.some((item) => item.id === row.id)) return acc;
      acc.push(row);
      return acc;
    },
    []
  );

  let operatore = pickBestOperatoreCandidate(candidates, user.id, userEmail);

  if (!operatore) {
    return unauthorized("Operatore non associato", 403);
  }
  if (!operatore.user_id || operatore.user_id !== user.id) {
    const { error: updErr } = await adminClient
      .from("operatori")
      .update({ user_id: user.id })
      .eq("id", operatore.id);
    if (updErr) {
      return unauthorized(updErr.message, 500);
    }
    operatore = { ...operatore, user_id: user.id };
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
