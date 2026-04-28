export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildScadenzeAgenda } from "@/lib/scadenze/buildScadenzeAgenda";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

function parseLocalDay(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getScadenzaStato(value?: string | null) {
  const scadenza = parseLocalDay(value);
  if (!scadenza) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return scadenza < today ? "SCADUTA" : "IMMINENTE";
}

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  try {
    const rows = await buildScadenzeAgenda(auth.adminClient, {
      cliente_id: auth.cliente.cliente_id,
    });

    return NextResponse.json({
      ok: true,
      cliente: {
        cliente_id: auth.cliente.cliente_id,
        email: auth.cliente.email,
        attivo: auth.cliente.attivo,
      },
      scadenze: rows.map((row) => ({
        id: row.id,
        tipo: row.tipo,
        progetto: row.progetto,
        checklist_id: row.checklist_id,
        data_scadenza: row.scadenza,
        stato: getScadenzaStato(row.scadenza),
        cliente: row.cliente,
        source: row.source,
        origine: row.origine,
        sottotipo: row.sottotipo,
        riferimento: row.riferimento,
        descrizione: row.descrizione,
        workflow_stato: row.workflow_stato,
        note: row.note,
        raw_id: row.raw_id,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore caricamento scadenze cliente" },
      { status: 500 }
    );
  }
}
