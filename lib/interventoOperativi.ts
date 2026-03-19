"use client";

export type InterventoOperativiMeta = {
  personale_previsto?: string | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
  updated_at?: string | null;
  updated_by_operatore?: string | null;
  updated_by_operatore_nome?: string | null;
};

export type InterventoOperativiFormState = {
  personale_previsto: string;
  mezzi: string;
  descrizione_attivita: string;
  indirizzo: string;
  orario: string;
  referente_cliente_nome: string;
  referente_cliente_contatto: string;
  commerciale_art_tech_nome: string;
  commerciale_art_tech_contatto: string;
};

export const EMPTY_INTERVENTO_OPERATIVI: InterventoOperativiFormState = {
  personale_previsto: "",
  mezzi: "",
  descrizione_attivita: "",
  indirizzo: "",
  orario: "",
  referente_cliente_nome: "",
  referente_cliente_contatto: "",
  commerciale_art_tech_nome: "",
  commerciale_art_tech_contatto: "",
};

export function extractInterventoOperativi(
  meta?: InterventoOperativiMeta | null
): InterventoOperativiFormState {
  return {
    personale_previsto: String(meta?.personale_previsto || ""),
    mezzi: String(meta?.mezzi || ""),
    descrizione_attivita: String(meta?.descrizione_attivita || ""),
    indirizzo: String(meta?.indirizzo || ""),
    orario: String(meta?.orario || ""),
    referente_cliente_nome: String(meta?.referente_cliente_nome || ""),
    referente_cliente_contatto: String(meta?.referente_cliente_contatto || ""),
    commerciale_art_tech_nome: String(meta?.commerciale_art_tech_nome || ""),
    commerciale_art_tech_contatto: String(meta?.commerciale_art_tech_contatto || ""),
  };
}

export async function loadInterventoOperativi(rowRefId: string) {
  const res = await fetch("/api/cronoprogramma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "load",
      rows: [{ row_kind: "INTERVENTO", row_ref_id: rowRefId }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || "Errore caricamento dati operativi intervento"));
  }
  const meta = ((data?.meta || {}) as Record<string, InterventoOperativiMeta>)[`INTERVENTO:${rowRefId}`] || null;
  return {
    meta,
    form: extractInterventoOperativi(meta),
  };
}

export async function saveInterventoOperativi(
  rowRefId: string,
  form: InterventoOperativiFormState
) {
  const res = await fetch("/api/cronoprogramma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "set_operativi",
      row_kind: "INTERVENTO",
      row_ref_id: rowRefId,
      ...form,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || "Errore salvataggio dati operativi intervento"));
  }
  const meta = (data?.meta || null) as InterventoOperativiMeta | null;
  return {
    meta,
    form: extractInterventoOperativi(meta),
  };
}
