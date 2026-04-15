export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

type ClientePortaleAuthRow = {
  cliente_id: string;
  email: string;
  attivo: boolean;
};

async function resolveClienteAuth(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false as const, response: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }) };
  }

  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient
    .from("clienti_portale_auth")
    .select("cliente_id, email, attivo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Cliente non associato" }, { status: 401 }),
    };
  }

  return {
    ok: true as const,
    cliente: data as ClientePortaleAuthRow,
  };
}

export async function GET(request: Request) {
  const auth = await resolveClienteAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
  });
}
