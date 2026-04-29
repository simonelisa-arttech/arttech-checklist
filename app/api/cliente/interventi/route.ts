export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getInterventoLifecycleStatus } from "@/lib/interventi";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  const { data: checklistRows, error: checklistErr } = await auth.adminClient
    .from("checklists")
    .select("id, nome_checklist")
    .eq("cliente_id", auth.cliente.cliente_id);

  if (checklistErr) {
    return NextResponse.json({ error: checklistErr.message }, { status: 500 });
  }

  const checklistIds = (checklistRows || [])
    .map((row: any) => String(row?.id || "").trim())
    .filter(Boolean);

  if (checklistIds.length === 0) {
    return NextResponse.json({
      ok: true,
      cliente: {
        cliente_id: auth.cliente.cliente_id,
        email: auth.cliente.email,
        attivo: auth.cliente.attivo,
      },
      interventi: [],
    });
  }

  const checklistNameById = new Map<string, string | null>(
    (checklistRows || []).map((row: any) => [
      String(row?.id || "").trim(),
      String(row?.nome_checklist || "").trim() || null,
    ])
  );

  let interventiRows: any[] = [];

  const { data, error } = await auth.adminClient
    .from("saas_interventi")
    .select("id, checklist_id, ticket_no, data, descrizione, stato_intervento, chiuso_il, note")
    .in("checklist_id", checklistIds)
    .order("data", { ascending: false });

  interventiRows = data || [];

  if (error && String(error.message || "").toLowerCase().includes("ticket_no")) {
    const retry = await auth.adminClient
      .from("saas_interventi")
      .select("id, checklist_id, data, descrizione, stato_intervento, chiuso_il, note")
      .in("checklist_id", checklistIds)
      .order("data", { ascending: false });

    if (retry.error) {
      return NextResponse.json({ error: retry.error.message }, { status: 500 });
    }

    interventiRows = (retry.data || []).map((row: any) => ({
      ...row,
      ticket_no: null,
    }));
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
    interventi: interventiRows.map((row: any) => {
      const checklistId = String(row?.checklist_id || "").trim() || null;
      const descrizione = String(row?.descrizione || "").trim();
      const ticketNo = String(row?.ticket_no || "").trim();
      return {
        id: String(row?.id || ""),
        checklist_id: checklistId,
        progetto_nome: checklistId ? checklistNameById.get(checklistId) || null : null,
        titolo: ticketNo || descrizione || "Intervento",
        descrizione: descrizione || null,
        tipo: ticketNo ? "Intervento" : "Attività",
        stato: getInterventoLifecycleStatus({
          stato_intervento: row?.stato_intervento ?? null,
          chiuso_il: row?.chiuso_il ?? null,
        }),
        data_intervento: row?.data ?? null,
        note: row?.note ?? null,
      };
    }),
  });
}
