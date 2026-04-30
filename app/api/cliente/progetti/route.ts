export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

type ClienteImpiantoRow = {
  id?: string;
  position?: number | null;
  impianto_quantita?: number | null;
  dimensioni?: string | null;
  passo?: string | null;
  tipo_impianto?: string | null;
  impianto_descrizione?: string | null;
};

type ClienteFatturaEmessaRow = {
  data_intervento?: string | null;
  descrizione?: string | null;
  numero_fattura?: string | null;
  fatturato_il?: string | null;
};

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
        "dimensioni",
        "passo",
        "tipo_impianto",
        "impianto_quantita",
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

  const projectIds = (data || [])
    .map((row: any) => String(row?.id || "").trim())
    .filter(Boolean);

  let impiantiByChecklistId = new Map<string, ClienteImpiantoRow[]>();
  let fattureByChecklistId = new Map<string, ClienteFatturaEmessaRow[]>();
  if (projectIds.length > 0) {
    const { data: impiantiRows, error: impiantiErr } = await auth.adminClient
      .from("checklist_impianti")
      .select(
        [
          "id",
          "checklist_id",
          "position",
          "impianto_quantita",
          "dimensioni",
          "passo",
          "tipo_impianto",
          "impianto_descrizione",
        ].join(", ")
      )
      .in("checklist_id", projectIds)
      .order("position", { ascending: true });

    if (impiantiErr) {
      return NextResponse.json({ error: impiantiErr.message }, { status: 500 });
    }

    impiantiByChecklistId = (impiantiRows || []).reduce((map, row: any) => {
      const checklistId = String(row?.checklist_id || "").trim();
      if (!checklistId) return map;
      const prev = map.get(checklistId) || [];
      prev.push({
        id: row?.id ? String(row.id) : undefined,
        position: typeof row?.position === "number" ? row.position : null,
        impianto_quantita:
          typeof row?.impianto_quantita === "number" ? row.impianto_quantita : null,
        dimensioni: row?.dimensioni ?? null,
        passo: row?.passo ?? null,
        tipo_impianto: row?.tipo_impianto ?? null,
        impianto_descrizione: row?.impianto_descrizione ?? null,
      });
      map.set(checklistId, prev);
      return map;
    }, new Map<string, ClienteImpiantoRow[]>());

    const { data: fattureRows, error: fattureErr } = await auth.adminClient
      .from("saas_interventi")
      .select(["checklist_id", "data", "descrizione", "numero_fattura", "fatturato_il"].join(", "))
      .in("checklist_id", projectIds)
      .eq("esito_fatturazione", "FATTURATO")
      .order("fatturato_il", { ascending: false, nullsFirst: false })
      .order("data", { ascending: false, nullsFirst: false });

    if (fattureErr) {
      return NextResponse.json({ error: fattureErr.message }, { status: 500 });
    }

    fattureByChecklistId = (fattureRows || []).reduce((map, row: any) => {
      const checklistId = String(row?.checklist_id || "").trim();
      if (!checklistId) return map;
      const prev = map.get(checklistId) || [];
      prev.push({
        data_intervento: row?.data ?? null,
        descrizione: row?.descrizione ?? null,
        numero_fattura: row?.numero_fattura ?? null,
        fatturato_il: row?.fatturato_il ?? null,
      });
      map.set(checklistId, prev);
      return map;
    }, new Map<string, ClienteFatturaEmessaRow[]>());
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
    impianti:
      impiantiByChecklistId.get(String(row?.id || "").trim())?.length
        ? impiantiByChecklistId.get(String(row?.id || "").trim())
        : [
            {
              impianto_quantita:
                typeof row?.impianto_quantita === "number" ? row.impianto_quantita : null,
              dimensioni: row?.dimensioni ?? null,
              passo: row?.passo ?? null,
              tipo_impianto: row?.tipo_impianto ?? null,
              impianto_descrizione: row?.impianto_descrizione ?? null,
            },
          ],
    fatture_emesse: fattureByChecklistId.get(String(row?.id || "").trim()) || [],
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
