export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";

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
    adminClient,
    cliente: data as ClientePortaleAuthRow,
  };
}

export async function GET(request: Request) {
  const auth = await resolveClienteAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  const { data, error } = await auth.adminClient
    .from("checklists")
    .select(
      [
        "id",
        "cliente_id",
        "cliente",
        "nome_checklist",
        "proforma",
        "po",
        "noleggio_vendita",
        "stato_progetto",
        "data_prevista",
        "data_tassativa",
        "fine_noleggio",
        "impianto_codice",
        "impianto_descrizione",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .eq("cliente_id", auth.cliente.cliente_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const progetti = (data || []).map((row: any) => ({
    ...row,
    stato_progetto:
      getEffectiveProjectStatus({
        stato_progetto: row?.stato_progetto ?? null,
        noleggio_vendita: row?.noleggio_vendita ?? null,
        data_prevista: row?.data_prevista ?? null,
        fine_noleggio: row?.fine_noleggio ?? null,
      }) ?? row?.stato_progetto ?? null,
  }));

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
    progetti,
  });
}
