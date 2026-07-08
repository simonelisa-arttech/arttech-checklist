import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

/**
 * P5.3 — Auth operatore per gli endpoint staff (dashboard ticket, risposte).
 * Stesso primitivo di /api/me-operatore: token cookie → getUser → riga in `operatori`
 * (match per user_id o email). Ritorna adminClient (service role) + operatore.
 */

export type OperatoreAuthRow = {
  id: string;
  nome: string | null;
  ruolo: string | null;
  email: string | null;
};

export type OperatoreAuthOk = {
  ok: true;
  adminClient: SupabaseClient;
  operatore: OperatoreAuthRow;
};

export type OperatoreAuthErr = { ok: false; response: NextResponse };

function err(message = "Unauthorized", status = 401): OperatoreAuthErr {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

export async function resolveOperatoreAuth(
  request: Request
): Promise<OperatoreAuthOk | OperatoreAuthErr> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return err("Missing Supabase envs", 500);
  }

  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) return err();

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) return err();

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = String(user.email || "").trim().toLowerCase();
  // Match per user_id oppure email (un operatore può non avere ancora user_id collegato).
  const { data: rows, error: opErr } = await adminClient
    .from("operatori")
    .select("id, nome, ruolo, email, attivo, user_id")
    .or(`user_id.eq.${user.id}${email ? `,email.ilike.${email}` : ""}`)
    .limit(5);
  if (opErr) return err(opErr.message, 500);

  const operatore = ((rows || []) as any[])
    .filter((r) => r?.id && r.attivo !== false)
    .sort((a, b) => {
      const sc = (r: any) =>
        (String(r.user_id || "") === user.id ? 2 : 0) +
        (String(r.email || "").trim().toLowerCase() === email ? 1 : 0);
      return sc(b) - sc(a);
    })[0];

  if (!operatore?.id) return err("Operatore non associato", 403);

  return {
    ok: true,
    adminClient,
    operatore: {
      id: String(operatore.id),
      nome: operatore.nome ?? null,
      ruolo: operatore.ruolo ?? null,
      email: operatore.email ?? null,
    },
  };
}
