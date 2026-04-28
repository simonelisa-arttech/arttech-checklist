import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

export type ClientePortaleAuthRow = {
  cliente_id: string;
  email: string;
  attivo: boolean;
};

export type ClientePortalAuthOk = {
  ok: true;
  adminClient: SupabaseClient;
  cliente: ClientePortaleAuthRow;
  impersonation: boolean;
  impersonated_by_operatore_id: string | null;
};

export type ClientePortalAuthErr = {
  ok: false;
  response: NextResponse;
};

function unauthorized(message = "Unauthorized", status = 401): ClientePortalAuthErr {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

export async function resolveClientePortalAuth(
  request: Request
): Promise<ClientePortalAuthOk | ClientePortalAuthErr> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return unauthorized("Missing Supabase envs", 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const impersonationToken = String(
    new URL(request.url).searchParams.get("impersonation_token") || ""
  ).trim();

  if (impersonationToken) {
    const tokenHash = crypto.createHash("sha256").update(impersonationToken).digest("hex");
    const { data: tokenRow, error: tokenErr } = await adminClient
      .from("clienti_portale_impersonation_tokens")
      .select("id, cliente_id, operatore_id, expires_at, revoked_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenErr) {
      return unauthorized(tokenErr.message, 500);
    }
    if (!tokenRow?.id) {
      return unauthorized("Impersonation token non valido", 401);
    }
    if (tokenRow.revoked_at) {
      return unauthorized("Impersonation token revocato", 403);
    }
    const expiresAtMs = new Date(String(tokenRow.expires_at || "")).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return unauthorized("Impersonation token scaduto", 403);
    }

    const { data: clienteRow, error: clienteErr } = await adminClient
      .from("clienti_anagrafica")
      .select("id, email")
      .eq("id", tokenRow.cliente_id)
      .maybeSingle();
    if (clienteErr) {
      return unauthorized(clienteErr.message, 500);
    }
    if (!clienteRow?.id) {
      return unauthorized("Cliente non trovato per impersonation", 404);
    }

    if (!tokenRow.used_at) {
      await adminClient
        .from("clienti_portale_impersonation_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
    }

    return {
      ok: true,
      adminClient,
      cliente: {
        cliente_id: String(clienteRow.id),
        email: String((clienteRow as any)?.email || "").trim().toLowerCase(),
        attivo: true,
      },
      impersonation: true,
      impersonated_by_operatore_id: String(tokenRow.operatore_id || "").trim() || null,
    };
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

  const { data, error } = await adminClient
    .from("clienti_portale_auth")
    .select("cliente_id, email, attivo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return unauthorized(error.message, 500);
  }
  if (!data) {
    return unauthorized("Cliente non associato", 401);
  }

  return {
    ok: true,
    adminClient,
    cliente: data as ClientePortaleAuthRow,
    impersonation: false,
    impersonated_by_operatore_id: null,
  };
}
