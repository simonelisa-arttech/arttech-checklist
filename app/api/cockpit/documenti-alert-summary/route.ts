export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

type DocumentoAlertRow = {
  id: string | null;
  data_scadenza: string | null;
  giorni_preavviso: number | null;
  alert_stato: string | null;
};

function startOfLocalDay(value?: Date) {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeAlertStato(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "SOSPESO" || raw === "COMPLETATO" || raw === "ATTIVO") return raw;
  return null;
}

function getAlertState(row: DocumentoAlertRow, today: Date) {
  const expiry = parseDateOnly(row.data_scadenza);
  if (!expiry) return null;

  const stato = normalizeAlertStato(row.alert_stato);
  if (stato === "SOSPESO" || stato === "COMPLETATO") return null;

  if (expiry < today) return "SCADUTO" as const;

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const preavviso =
    typeof row.giorni_preavviso === "number" && Number.isFinite(row.giorni_preavviso)
      ? row.giorni_preavviso
      : 30;

  if (diffDays >= 0 && diffDays <= preavviso) return "IN_SCADENZA" as const;
  return null;
}

function summarizeRows(rows: DocumentoAlertRow[], today: Date) {
  let scaduti = 0;
  let inScadenza = 0;

  for (const row of rows) {
    const state = getAlertState(row, today);
    if (state === "SCADUTO") scaduti += 1;
    else if (state === "IN_SCADENZA") inScadenza += 1;
  }

  return { scaduti, in_scadenza: inScadenza };
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const today = startOfLocalDay();

  const [{ data: personaleRows, error: personaleError }, { data: aziendeRows, error: aziendeError }] =
    await Promise.all([
      auth.adminClient
        .from("personale_documenti")
        .select("id, data_scadenza, giorni_preavviso, alert_stato"),
      auth.adminClient
        .from("aziende_documenti")
        .select("id, data_scadenza, giorni_preavviso, alert_stato"),
    ]);

  if (personaleError) {
    return NextResponse.json(
      { ok: false, error: `Errore caricamento documenti personale: ${personaleError.message}` },
      { status: 500 }
    );
  }
  if (aziendeError) {
    return NextResponse.json(
      { ok: false, error: `Errore caricamento documenti aziende: ${aziendeError.message}` },
      { status: 500 }
    );
  }

  const personale = summarizeRows((personaleRows || []) as DocumentoAlertRow[], today);
  const aziende = summarizeRows((aziendeRows || []) as DocumentoAlertRow[], today);

  return NextResponse.json({
    ok: true,
    scaduti_totale: personale.scaduti + aziende.scaduti,
    in_scadenza_totale: personale.in_scadenza + aziende.in_scadenza,
    personale_scaduti: personale.scaduti,
    personale_in_scadenza: personale.in_scadenza,
    aziende_scaduti: aziende.scaduti,
    aziende_in_scadenza: aziende.in_scadenza,
  });
}
