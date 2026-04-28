export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
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
