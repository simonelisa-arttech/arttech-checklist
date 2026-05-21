"use client";

import {
  getOperativiEstimatedMinutes,
  minutesToHoursInput,
  normalizeOperativiDate,
} from "@/lib/operativiSchedule";

export type InterventoOperativiMeta = {
  data_inizio?: string | null;
  durata_giorni?: number | null;
  durata_prevista_minuti?: number | null;
  modalita_attivita?: string | null;
  personale_previsto?: string | null;
  personale_ids?: string[] | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referenti_cliente?:
    | Array<{
        id?: string | null;
        nome?: string | null;
        contatto?: string | null;
        ruolo?: string | null;
        position?: number | null;
      }>
    | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
  updated_at?: string | null;
  updated_by_operatore?: string | null;
  updated_by_operatore_nome?: string | null;
};

export type InterventoOperativiReferente = {
  id?: string;
  nome: string;
  contatto: string;
  ruolo: string;
};

export type InterventoOperativiFormState = {
  data_inizio: string;
  durata_giorni: string;
  modalita_attivita: string;
  personale_previsto: string;
  personale_ids: string[];
  mezzi: string;
  descrizione_attivita: string;
  indirizzo: string;
  orario: string;
  referenti_cliente: InterventoOperativiReferente[];
  referente_cliente_nome: string;
  referente_cliente_contatto: string;
  commerciale_art_tech_nome: string;
  commerciale_art_tech_contatto: string;
};

export const EMPTY_INTERVENTO_OPERATIVI: InterventoOperativiFormState = {
  data_inizio: "",
  durata_giorni: "",
  modalita_attivita: "",
  personale_previsto: "",
  personale_ids: [],
  mezzi: "",
  descrizione_attivita: "",
  indirizzo: "",
  orario: "",
  referenti_cliente: [{ nome: "", contatto: "", ruolo: "" }],
  referente_cliente_nome: "",
  referente_cliente_contatto: "",
  commerciale_art_tech_nome: "",
  commerciale_art_tech_contatto: "",
};

function trimTrailingZeros(value: number) {
  return String(Math.round(value * 100) / 100).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function hoursInputToMinutes(value?: string | number | null) {
  const hours = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
}

function normalizeReferente(
  value:
    | {
        id?: string | null;
        nome?: string | null;
        contatto?: string | null;
        ruolo?: string | null;
      }
    | null
    | undefined
): InterventoOperativiReferente {
  const id = String(value?.id || "").trim();
  return {
    ...(id ? { id } : {}),
    nome: String(value?.nome || "").trim(),
    contatto: String(value?.contatto || "").trim(),
    ruolo: String(value?.ruolo || "").trim(),
  };
}

function buildFallbackReferentiCliente(
  meta?: InterventoOperativiMeta | null
): InterventoOperativiReferente[] {
  const referenti = Array.isArray(meta?.referenti_cliente)
    ? meta.referenti_cliente.map((value) => normalizeReferente(value))
    : [];
  const filtered = referenti.filter((row) => row.nome || row.contatto || row.ruolo);
  if (filtered.length > 0) return filtered;
  const fallback = {
    nome: String(meta?.referente_cliente_nome || "").trim(),
    contatto: String(meta?.referente_cliente_contatto || "").trim(),
    ruolo: "",
  };
  return fallback.nome || fallback.contatto ? [fallback] : [{ nome: "", contatto: "", ruolo: "" }];
}

export function extractInterventoOperativi(
  meta?: InterventoOperativiMeta | null
): InterventoOperativiFormState {
  const stimatoMinuti = getOperativiEstimatedMinutes(meta);
  const referentiCliente = buildFallbackReferentiCliente(meta);
  return {
    data_inizio: normalizeOperativiDate(meta?.data_inizio),
    durata_giorni: stimatoMinuti != null ? minutesToHoursInput(stimatoMinuti) : "",
    modalita_attivita: String(meta?.modalita_attivita || ""),
    personale_previsto: String(meta?.personale_previsto || ""),
    personale_ids: Array.isArray(meta?.personale_ids)
      ? meta.personale_ids.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    mezzi: String(meta?.mezzi || ""),
    descrizione_attivita: String(meta?.descrizione_attivita || ""),
    indirizzo: String(meta?.indirizzo || ""),
    orario: String(meta?.orario || ""),
    referenti_cliente: referentiCliente,
    referente_cliente_nome: referentiCliente[0]?.nome || "",
    referente_cliente_contatto: referentiCliente[0]?.contatto || "",
    commerciale_art_tech_nome: String(meta?.commerciale_art_tech_nome || ""),
    commerciale_art_tech_contatto: String(meta?.commerciale_art_tech_contatto || ""),
  };
}

export async function loadInterventoOperativi(rowRefId: string) {
  const res = await fetch("/api/cronoprogramma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
  const durataPrevistaMinuti = hoursInputToMinutes(form.durata_giorni);
  const referentiCliente = Array.isArray(form.referenti_cliente)
    ? form.referenti_cliente
        .map((value) => normalizeReferente(value))
        .filter((value) => value.nome || value.contatto || value.ruolo)
    : [];
  const res = await fetch("/api/cronoprogramma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      action: "set_operativi",
      row_kind: "INTERVENTO",
      row_ref_id: rowRefId,
      data_inizio: form.data_inizio,
      durata_prevista_minuti: durataPrevistaMinuti,
      modalita_attivita: form.modalita_attivita,
      personale_previsto: form.personale_previsto,
      personale_ids: form.personale_ids,
      mezzi: form.mezzi,
      descrizione_attivita: form.descrizione_attivita,
      indirizzo: form.indirizzo,
      orario: form.orario,
      referenti_cliente: referentiCliente,
      referente_cliente_nome: referentiCliente[0]?.nome || form.referente_cliente_nome,
      referente_cliente_contatto: referentiCliente[0]?.contatto || form.referente_cliente_contatto,
      commerciale_art_tech_nome: form.commerciale_art_tech_nome,
      commerciale_art_tech_contatto: form.commerciale_art_tech_contatto,
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
