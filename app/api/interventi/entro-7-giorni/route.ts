import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export const runtime = "nodejs";

type InterventoRow = {
  id: string;
  cliente: string | null;
  checklist_id: string | null;
  data: string | null;
  data_tassativa?: string | null;
  descrizione: string | null;
  stato_intervento: string | null;
  fatturazione_stato: string | null;
  checklist?: {
    id: string | null;
    nome_checklist: string | null;
  } | null;
};

function toIsoDay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function normalizeInterventoStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function isRelevantIntervento(row: InterventoRow) {
  const stato = normalizeInterventoStatus(row.stato_intervento);
  const fatturazione = normalizeInterventoStatus(row.fatturazione_stato);
  if (stato === "CHIUSO") return false;
  if (fatturazione === "CHIUSO" || fatturazione === "FATTURATO") return false;
  return true;
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const inSevenDaysIso = inSevenDays.toISOString().slice(0, 10);

  let res = await auth.adminClient
    .from("saas_interventi")
    .select(
      "id, cliente, checklist_id, data, data_tassativa, descrizione, stato_intervento, fatturazione_stato, checklist:checklists(id, nome_checklist)"
    )
    .order("data_tassativa", { ascending: true, nullsFirst: false })
    .order("data", { ascending: true, nullsFirst: false });

  if (res.error && String(res.error.message || "").toLowerCase().includes("data_tassativa")) {
    res = await auth.adminClient
      .from("saas_interventi")
      .select(
        "id, cliente, checklist_id, data, descrizione, stato_intervento, fatturazione_stato, checklist:checklists(id, nome_checklist)"
      )
      .order("data", { ascending: true, nullsFirst: false });
    if (!res.error) {
      res.data = ((res.data || []) as any[]).map((row: any) => ({ ...row, data_tassativa: null }));
    }
  }

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const rows = ((res.data || []) as InterventoRow[])
    .map((row: InterventoRow) => ({
      id: row.id,
      cliente: row.cliente || "—",
      progetto: row.checklist?.nome_checklist || row.descrizione || "—",
      checklist_id: row.checklist?.id || row.checklist_id || null,
      data_intervento: toIsoDay(row.data_tassativa) || toIsoDay(row.data),
      stato_intervento: row.stato_intervento || null,
      fatturazione_stato: row.fatturazione_stato || null,
    }))
    .filter((row: any) => !!row.data_intervento && row.data_intervento >= todayIso && row.data_intervento <= inSevenDaysIso)
    .filter((row: any) =>
      isRelevantIntervento({
        id: row.id,
        cliente: row.cliente,
        checklist_id: row.checklist_id,
        data: row.data_intervento,
        descrizione: row.progetto,
        stato_intervento: row.stato_intervento,
        fatturazione_stato: row.fatturazione_stato,
      })
    )
    .sort((a: any, b: any) => {
      const byDate = String(a.data_intervento).localeCompare(String(b.data_intervento));
      if (byDate !== 0) return byDate;
      return `${a.cliente} ${a.progetto}`.localeCompare(`${b.cliente} ${b.progetto}`);
    });

  return NextResponse.json(rows);
}
