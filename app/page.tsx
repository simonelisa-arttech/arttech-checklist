"use client";

import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import CronoprogrammaPanel from "@/components/cronoprogramma/CronoprogrammaPanel";
import Toast from "@/components/Toast";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import { getProjectPresentation, PROJECT_STATUS_FILTER_OPTIONS } from "@/lib/projectStatus";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";
import { storageUpload } from "@/lib/clientStorageApi";
import { isTimelineRowOverdueNotDone } from "@/lib/cronoprogrammaStatus";
import {
  buildOperativiSchedule,
  dateToOperativiIsoDay,
  durationToInputValue,
  estimatedMinutesToLegacyDays,
  minutesToHoursInput,
  normalizeOperativiDate,
} from "@/lib/operativiSchedule";
import { checkOperativiConflicts } from "@/lib/operativiConflicts";

type DashboardScadenzeBreakdown = {
  garanzie: number;
  licenze: number;
  tagliandi: number;
  saasAltro: number;
};

type DashboardScadenzeSummary = {
  count: number;
  breakdown: DashboardScadenzeBreakdown;
  overdueCount: number;
};

type DashboardMetricSummary = {
  count: number;
  overdue: number;
};

type DashboardSimSummaryByPeriod = Record<7 | 15 | 30, DashboardMetricSummary>;

type DocumentiAlertSummary = {
  scaduti_totale: number;
  in_scadenza_totale: number;
  personale_scaduti: number;
  personale_in_scadenza: number;
  aziende_scaduti: number;
  aziende_in_scadenza: number;
};

type DashboardClienteCockpitRow = {
  rowKey: string;
  cliente: string;
  clienteId: string | null;
  projectCount: number;
  openActivities: number;
  imminentActivities: number;
  overdueActivities: number;
  relevantDeadlines: number;
  overdueDeadlines: number;
  searchText: string;
  attentionLabel: "ATTENZIONE" | "MONITORARE" | "STABILE";
  attentionColors: {
    border: string;
    background: string;
    color: string;
  };
};

type DashboardClienteCockpitEntry = Omit<
  DashboardClienteCockpitRow,
  "rowKey" | "attentionLabel" | "attentionColors"
>;

type ClienteAnagraficaRow = {
  id: string;
  denominazione: string | null;
  denominazione_norm: string | null;
  codice_interno: string | null;
  piva: string | null;
  codice_fiscale: string | null;
  attivo: boolean | null;
};

const DASHBOARD_BADGE_COLORS = {
  statusExpired: { border: "#fca5a5", background: "#fee2e2", color: "#b91c1c" },
  statusDueSoon: { border: "#fcd34d", background: "#fffbeb", color: "#b45309" },
  statusOk: { border: "#86efac", background: "#f0fdf4", color: "#166534" },
  statusNeutral: { border: "#e2e8f0", background: "#f8fafc", color: "#64748b" },
} as const;

const EMPTY_SCADENZE_BREAKDOWN: DashboardScadenzeBreakdown = {
  garanzie: 0,
  licenze: 0,
  tagliandi: 0,
  saasAltro: 0,
};

const EMPTY_DOCUMENTI_ALERT_SUMMARY: DocumentiAlertSummary = {
  scaduti_totale: 0,
  in_scadenza_totale: 0,
  personale_scaduti: 0,
  personale_in_scadenza: 0,
  aziende_scaduti: 0,
  aziende_in_scadenza: 0,
};

function getProjectStatusBadge(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "NOLEGGIO_IN_CORSO") {
    return {
      label: "NOLEGGIO_IN_CORSO",
      border: "#93c5fd",
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }
  if (raw === "IN_LAVORAZIONE" || raw === "IN_CORSO" || raw === "IN ATTESA") {
    return {
      label: raw === "IN_CORSO" ? "IN_LAVORAZIONE" : raw,
      border: DASHBOARD_BADGE_COLORS.statusDueSoon.border,
      background: DASHBOARD_BADGE_COLORS.statusDueSoon.background,
      color: DASHBOARD_BADGE_COLORS.statusDueSoon.color,
    };
  }
  if (raw === "COMPLETATO" || raw === "CHIUSO") {
    return {
      label: raw,
      border: DASHBOARD_BADGE_COLORS.statusOk.border,
      background: DASHBOARD_BADGE_COLORS.statusOk.background,
      color: DASHBOARD_BADGE_COLORS.statusOk.color,
    };
  }
  if (raw === "BLOCCATO" || raw === "SCADUTO") {
    return {
      label: raw,
      border: DASHBOARD_BADGE_COLORS.statusExpired.border,
      background: DASHBOARD_BADGE_COLORS.statusExpired.background,
      color: DASHBOARD_BADGE_COLORS.statusExpired.color,
    };
  }
  return {
    label: raw || "—",
    border: DASHBOARD_BADGE_COLORS.statusNeutral.border,
    background: DASHBOARD_BADGE_COLORS.statusNeutral.background,
    color: DASHBOARD_BADGE_COLORS.statusNeutral.color,
  };
}

function classifyProjectDeadline(value: string | null | undefined, todayIso: string, upcomingIso: string) {
  const date = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < todayIso) return "SCADUTA" as const;
  if (date <= upcomingIso) return "IMMINENTE" as const;
  return null;
}

function normalizeClienteSearchKey(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildScadenzeLink(days: number) {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return `/scadenze?from=${toDateInputValue(from)}&to=${toDateInputValue(to)}`;
}

function logSupabaseError(error: any) {
  if (!error) return;
  const info = {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  };
  const raw =
    error && typeof error === "object"
      ? JSON.stringify(error, Object.getOwnPropertyNames(error))
      : String(error);
  console.error("SUPABASE ERROR:", {
    ...info,
    raw,
  });
  const parts = [
    info.message,
    info.details ? `details: ${info.details}` : null,
    info.hint ? `hint: ${info.hint}` : null,
    info.code ? `code: ${info.code}` : null,
    raw && raw !== "{}" ? `raw: ${raw}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function isChecklistDuplicateError(error: any) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    code === "23505" &&
    (message.includes("checklists_cliente_id_nome_checklist_key") ||
      details.includes("cliente_id") ||
      details.includes("nome_checklist"))
  );
}

type Checklist = {
  id: string;
  cliente: string;
  cliente_id?: string | null;
  clienti_anagrafica?: { denominazione: string | null } | null;
  nome_checklist: string;
  proforma: string | null;
  po: string | null;
  magazzino_importazione: string | null;
  created_by_operatore: string | null;
  updated_by_operatore: string | null;

  // SAAS
  tipo_saas: string | null; // (se lo stai ancora usando)
  saas_piano: string | null;
  saas_scadenza: string | null; // date -> string ISO
  saas_stato: string | null;
  saas_tipo: string | null;
  saas_note: string | null;

  // m2
  m2_calcolati: number | null;
  m2_inclusi: number | null;
  m2_allocati: number | null;

  // date & campi progetto
  data_prevista: string | null;
  data_tassativa: string | null;
  tipo_impianto: string | null;
  impianto_indirizzo: string | null;
  impianto_codice: string | null;
  impianto_descrizione: string | null;
  dimensioni: string | null;
  impianto_quantita: number | null;
  numero_facce: number | null;
  passo: string | null;
  note: string | null;
  tipo_struttura: string | null;
  noleggio_vendita: string | null;
  fine_noleggio: string | null;
  data_disinstallazione?: string | null;
  mercato: string | null;
  modello: string | null;
  stato_progetto: string | null;
  data_installazione_reale: string | null;

  // garanzia
  garanzia_stato: string | null;
  garanzia_scadenza: string | null;

  // checklist sections view
  documenti: string | null;
  sezione_1: string | null;
  sezione_2: string | null;
  sezione_3: string | null;
  stato_complessivo: string | null;
  pct_complessivo: number | null;
  codice: string | null;
  descrizione: string | null;
  licenze_attive: number | null;
  licenze_prossima_scadenza: string | null;
  licenze_dettaglio: string | null;
  license_search?: string | null;
  checklist_documents?: {
    id: string;
    tipo: string | null;
    filename: string | null;
    uploaded_at: string | null;
  }[];
  created_at: string;
  updated_at: string | null;
};

type OperatoreRow = {
  id: string;
  user_id?: string | null;
  nome: string | null;
  email?: string | null;
  ruolo?: string | null;
  attivo: boolean;
};

type ChecklistItem = {
  codice: string;
  descrizione: string;
  descrizione_custom?: string;
  qty: string; // UI-only (string). In DB the column name is `quantita` (numeric)
  note: string;
  search?: string;
};

type CatalogItem = {
  id: string;
  codice: string | null;
  descrizione: string | null;
  tipo: string | null;
  categoria?: string | null;
  attivo: boolean;
};

function isFiniteNumberString(v: string) {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function isCustomCode(code: string) {
  return code.trim().toUpperCase() === "CUSTOM";
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeCustomCode(code: string) {
  return isCustomCode(code) ? "CUSTOM" : code;
}

function calcM2(
  dimensioni: string | null,
  numeroFacce?: number | null,
  impiantoQuantita?: number | null
): number | null {
  const base = calcM2FromDimensioni(dimensioni, numeroFacce ?? 1);
  const qty =
    Number.isFinite(Number(impiantoQuantita)) && Number(impiantoQuantita) > 0
      ? Number(impiantoQuantita)
      : 1;
  return base == null ? null : base * qty;
}

function inferTaskTarget(titolo?: string | null, existingTarget?: string | null) {
  const rawTarget = String(existingTarget || "")
    .trim()
    .toUpperCase();
  if (rawTarget === "MAGAZZINO" || rawTarget === "TECNICO_SW" || rawTarget === "GENERICA") {
    return rawTarget;
  }
  const titoloNorm = String(titolo || "")
    .trim()
    .toUpperCase();
  if (titoloNorm.includes("ELETTRONICA DI CONTROLLO: SCHEMI DATI ED ELETTRICI")) {
    return "TECNICO_SW";
  }
  if (
    titoloNorm.includes("PREPARAZIONE / RISERVA DISPONIBILIT") ||
    titoloNorm.includes("ORDINE MERCE")
  ) {
    return "MAGAZZINO";
  }
  return "GENERICA";
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type TimelineRow = {
  kind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO";
  id: string;
  row_ref_id: string;
  data_prevista: string;
  data_tassativa: string;
  cliente: string;
  checklist_id: string | null;
  ticket_no?: string | null;
  proforma?: string | null;
  progetto: string;
  tipologia: string;
  descrizione: string;
  stato: string;
  fatto: boolean;
};

type CronoMeta = {
  fatto: boolean;
  hidden: boolean;
  updated_at: string | null;
  updated_by_operatore: string | null;
  updated_by_nome: string | null;
  data_inizio?: string | null;
  durata_prevista_minuti?: number | null;
  durata_giorni?: number | null;
  modalita_attivita?: string | null;
  personale_previsto?: string | null;
  personale_ids?: string[] | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
  slots?: Array<{
    id?: string;
    data_inizio?: string | null;
    durata_prevista_minuti?: number | null;
    orario?: string | null;
    position?: number;
  }>;
  referenti_cliente?: Array<{
    id?: string;
    nome?: string | null;
    contatto?: string | null;
    ruolo?: string | null;
    position?: number;
  }>;
};

type CronoComment = {
  id: string;
  commento: string;
  created_at: string | null;
  created_by_operatore: string | null;
  created_by_nome: string | null;
};

type QuickAttivitaType = "INSTALLAZIONE" | "DISINSTALLAZIONE" | "ALTRA_ATTIVITA";
type DashboardClientSaasFilter = "TUTTI" | "SAAS" | "SAAS_ULTRA" | "ART_TECH_EVENTS";
type QuickAttachmentDocumentType = "GENERICO" | "CLIENTE" | "DRIVE" | "ODA_FORNITORE";
type QuickAttivitaTouched = {
  ore: boolean;
  indirizzo: boolean;
  referenteClienteNome: boolean;
  referenteClienteContatto: boolean;
  referenteArtTechNome: boolean;
};

type QuickAttivitaAttachmentDraft =
  | {
      id: string;
      kind: "UPLOAD";
      title: string;
      documentType: QuickAttachmentDocumentType;
      file: File;
    }
  | {
      id: string;
      kind: "LINK";
      title: string;
      documentType: QuickAttachmentDocumentType;
      url: string;
      provider: "GOOGLE_DRIVE" | "GENERIC";
    };

type DashboardClienteReferente = {
  id: string;
  cliente_id: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  ruolo: string | null;
  attivo: boolean | null;
};

const QUICK_ATTIVITA_OPTIONS: Array<{ value: QuickAttivitaType; label: string; tipo: string }> = [
  { value: "INSTALLAZIONE", label: "Installazione", tipo: "INSTALLAZIONE" },
  { value: "DISINSTALLAZIONE", label: "Disinstallazione", tipo: "DISINSTALLAZIONE" },
  { value: "ALTRA_ATTIVITA", label: "Altra attività", tipo: "ATTIVITA_OPERATIVA" },
];

const EMPTY_QUICK_ATTIVITA_TOUCHED: QuickAttivitaTouched = {
  ore: false,
  indirizzo: false,
  referenteClienteNome: false,
  referenteClienteContatto: false,
  referenteArtTechNome: false,
};

const QUICK_ATTACHMENT_TYPE_OPTIONS: Array<{ value: QuickAttachmentDocumentType; label: string }> = [
  { value: "GENERICO", label: "Interno" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "DRIVE", label: "Drive" },
  { value: "ODA_FORNITORE", label: "ODA" },
];

const QUICK_ATTACHMENT_TYPE_BADGES: Record<
  QuickAttachmentDocumentType,
  { label: string; background: string; color: string }
> = {
  GENERICO: { label: "Interno", background: "#f3f4f6", color: "#374151" },
  CLIENTE: { label: "Cliente", background: "#dbeafe", color: "#1d4ed8" },
  DRIVE: { label: "Drive", background: "#dcfce7", color: "#166534" },
  ODA_FORNITORE: { label: "ODA", background: "#fef3c7", color: "#92400e" },
};

function isQuickAttachmentHttpUrl(url: string) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function detectQuickAttachmentProvider(url: string) {
  return String(url || "").toLowerCase().includes("drive.google.com") ? "GOOGLE_DRIVE" : "GENERIC";
}

function makeQuickAttachmentDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDashboardClienteRowKey(clienteValue?: string | null, clienteIdValue?: string | null) {
  const clienteId = String(clienteIdValue || "").trim();
  if (clienteId) return `id:${clienteId}`;
  const normalizedName = normalizeClienteSearchKey(clienteValue);
  return normalizedName ? `name:${normalizedName}` : null;
}

function getDashboardSaasFilterKey(item: Checklist): Exclude<DashboardClientSaasFilter, "TUTTI"> | null {
  const piano = String(item.saas_piano || "").trim().toUpperCase();
  const tipo = String(item.saas_tipo || item.tipo_saas || "").trim().toUpperCase();
  const combined = `${piano} ${tipo}`.trim();
  if (!combined) return null;
  if (
    combined.includes("SAAS-EVT") ||
    combined.includes("EVENT") ||
    combined.includes("ART TECH EVENT")
  ) {
    return "ART_TECH_EVENTS";
  }
  if (combined.startsWith("SAAS-UL") || combined.startsWith("SAAS-PR") || combined.includes("ULTRA")) {
    return "SAAS_ULTRA";
  }
  return "SAAS";
}

function isDashboardSaasConnectionActive(item: Checklist) {
  const projectPresentation = getProjectPresentation({
    stato_progetto: item.stato_progetto,
    pct_complessivo: item.pct_complessivo,
    noleggio_vendita: item.noleggio_vendita,
    data_disinstallazione: item.data_disinstallazione,
  });
  const projectStatus = String(projectPresentation.displayStatus || "").trim().toUpperCase();
  const saasStatus = String(item.saas_stato || "").trim().toUpperCase();
  const projectIsActive = projectStatus !== "CHIUSO" && projectStatus !== "RIENTRATO";
  const saasIsActive =
    !saasStatus ||
    !["DISATTIVO", "CESSATO", "SCADUTO", "CHIUSO", "INATTIVO"].includes(saasStatus);
  return projectIsActive && saasIsActive;
}

type OperativiFields = {
  data_inizio: string;
  durata_giorni: string;
  modalita_attivita: string;
  personale_previsto: string;
  personale_ids: string[];
  mezzi: string;
  descrizione_attivita: string;
  indirizzo: string;
  orario: string;
  referente_cliente_nome: string;
  referente_cliente_contatto: string;
  commerciale_art_tech_nome: string;
  commerciale_art_tech_contatto: string;
  referenti_cliente: Array<{
    id?: string;
    nome?: string | null;
    contatto?: string | null;
    ruolo?: string | null;
    position?: number;
  }>;
};

const EMPTY_OPERATIVI: OperativiFields = {
  data_inizio: "",
  durata_giorni: "",
  modalita_attivita: "",
  personale_previsto: "",
  personale_ids: [],
  mezzi: "",
  descrizione_attivita: "",
  indirizzo: "",
  orario: "",
  referente_cliente_nome: "",
  referente_cliente_contatto: "",
  commerciale_art_tech_nome: "",
  commerciale_art_tech_contatto: "",
  referenti_cliente: [],
};

type CronoMetaSlot = NonNullable<CronoMeta["slots"]>[number];
type CronoMetaReferente = NonNullable<CronoMeta["referenti_cliente"]>[number];

function getSortedCronoSlots(slots?: CronoMeta["slots"] | null): CronoMetaSlot[] {
  return (Array.isArray(slots) ? slots : [])
    .filter((slot) => {
      const data = normalizeOperativiDate(slot?.data_inizio);
      const durata = Number(slot?.durata_prevista_minuti);
      const hasDuration = Number.isFinite(durata) && durata >= 0;
      const hasOrario = Boolean(String(slot?.orario || "").trim());
      return Boolean(data || hasDuration || hasOrario);
    })
    .sort((left, right) => {
      const leftPosition = Number.isFinite(Number(left?.position)) ? Number(left?.position) : Number.MAX_SAFE_INTEGER;
      const rightPosition = Number.isFinite(Number(right?.position)) ? Number(right?.position) : Number.MAX_SAFE_INTEGER;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
      const leftDate = normalizeOperativiDate(left?.data_inizio);
      const rightDate = normalizeOperativiDate(right?.data_inizio);
      if (leftDate !== rightDate) return String(leftDate).localeCompare(String(rightDate));
      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });
}

function getSortedCronoReferenti(referenti?: CronoMeta["referenti_cliente"] | null): CronoMetaReferente[] {
  return (Array.isArray(referenti) ? referenti : [])
    .filter((referente) =>
      Boolean(
        String(referente?.nome || "").trim() ||
          String(referente?.contatto || "").trim() ||
          String(referente?.ruolo || "").trim()
      )
    )
    .sort((left, right) => {
      const leftPosition = Number.isFinite(Number(left?.position)) ? Number(left?.position) : Number.MAX_SAFE_INTEGER;
      const rightPosition = Number.isFinite(Number(right?.position)) ? Number(right?.position) : Number.MAX_SAFE_INTEGER;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });
}

function getCronoPrimarySlot(meta?: CronoMeta | null) {
  return getSortedCronoSlots(meta?.slots)[0];
}

function getCronoPrimaryDate(meta?: CronoMeta | null) {
  return normalizeOperativiDate(getCronoPrimarySlot(meta)?.data_inizio) || normalizeOperativiDate(meta?.data_inizio);
}

function getCronoPrimaryOrario(meta?: CronoMeta | null) {
  const slotWithOrario = getSortedCronoSlots(meta?.slots).find((slot) => String(slot?.orario || "").trim());
  return String(slotWithOrario?.orario || meta?.orario || "");
}

function getCronoTotalEstimatedMinutes(meta?: CronoMeta | null) {
  const slots = getSortedCronoSlots(meta?.slots);
  if (slots.length) {
    const total = slots.reduce((sum, slot) => {
      const value = Number(slot?.durata_prevista_minuti);
      return Number.isFinite(value) && value >= 0 ? sum + Math.round(value) : sum;
    }, 0);
    return total > 0 ? total : null;
  }
  const value = Number(meta?.durata_prevista_minuti);
  if (Number.isFinite(value) && value >= 0) return Math.round(value);
  return null;
}

function buildReferentiClienteSummary(meta?: CronoMeta | null) {
  const referenti = getSortedCronoReferenti(meta?.referenti_cliente);
  if (!referenti.length) {
    return {
      referenti,
      nome: String(meta?.referente_cliente_nome || ""),
      contatto: String(meta?.referente_cliente_contatto || ""),
    };
  }
  const nome = referenti
    .map((referente) => {
      const nomeValue = String(referente?.nome || "").trim();
      const ruoloValue = String(referente?.ruolo || "").trim();
      return [nomeValue, ruoloValue].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join(" • ");
  const contatto = referenti
    .map((referente) => String(referente?.contatto || "").trim())
    .filter(Boolean)
    .join(" • ");
  return { referenti, nome, contatto };
}

function extractOperativi(meta?: CronoMeta | null): OperativiFields {
  const totalEstimatedMinutes = getCronoTotalEstimatedMinutes(meta);
  const referentiSummary = buildReferentiClienteSummary(meta);
  return {
    data_inizio: getCronoPrimaryDate(meta),
    durata_giorni:
      totalEstimatedMinutes != null
        ? minutesToHoursInput(totalEstimatedMinutes)
        : durationToInputValue(meta?.durata_giorni),
    modalita_attivita: String(meta?.modalita_attivita || ""),
    personale_previsto: String(meta?.personale_previsto || ""),
    personale_ids: Array.isArray(meta?.personale_ids)
      ? meta.personale_ids.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    mezzi: String(meta?.mezzi || ""),
    descrizione_attivita: String(meta?.descrizione_attivita || ""),
    indirizzo: String(meta?.indirizzo || ""),
    orario: getCronoPrimaryOrario(meta),
    referente_cliente_nome: referentiSummary.nome,
    referente_cliente_contatto: referentiSummary.contatto,
    commerciale_art_tech_nome: String(meta?.commerciale_art_tech_nome || ""),
    commerciale_art_tech_contatto: String(meta?.commerciale_art_tech_contatto || ""),
    referenti_cliente: referentiSummary.referenti,
  };
}

function getRowSchedule(
  row: TimelineRow,
  value?:
    | {
        data_inizio?: string | null;
        durata_prevista_minuti?: number | null;
        durata_giorni?: string | number | null;
        slots?: CronoMeta["slots"] | null;
      }
    | null
) {
  const slots = getSortedCronoSlots(value?.slots);
  if (slots.length) {
    const firstSlot = slots[0];
    const lastSlot = [...slots]
      .reverse()
      .find((slot) => normalizeOperativiDate(slot?.data_inizio)) || firstSlot;
    const data_inizio =
      normalizeOperativiDate(firstSlot?.data_inizio) ||
      normalizeOperativiDate(value?.data_inizio) ||
      normalizeOperativiDate(row.data_tassativa || row.data_prevista);
    const data_fine = normalizeOperativiDate(lastSlot?.data_inizio) || data_inizio;
    const startDate = data_inizio ? new Date(`${data_inizio}T00:00:00Z`) : null;
    const endDate = data_fine ? new Date(`${data_fine}T00:00:00Z`) : null;
    const durata_giorni =
      startDate && endDate
        ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
        : 1;
    return {
      data_inizio,
      data_fine,
      durata_giorni,
    };
  }
  const durataLegacy = estimatedMinutesToLegacyDays(value?.durata_prevista_minuti) ?? value?.durata_giorni ?? null;
  return buildOperativiSchedule(value?.data_inizio ?? null, row.data_tassativa || row.data_prevista, durataLegacy);
}

function inferInterventoTipologia(text?: string | null) {
  const v = String(text || "").toLowerCase();
  if (!v) return "INTERVENTO";
  if (v.includes("assistenza")) return "ASSISTENZA";
  if (v.includes("installaz")) return "INSTALLAZIONE";
  if (v.includes("noleggio")) return "NOLEGGIO";
  if (v.includes("manutenz")) return "MANUTENZIONE";
  return "INTERVENTO";
}

function getRowKey(rowKind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO", rowRefId: string) {
  return `${rowKind}:${rowRefId}`;
}

function normalizePersonaleText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildConflictTooltip(personale: string[], mezzi: string[]) {
  const details: string[] = [];
  if (personale.length) details.push(`Personale già impegnato: ${personale.join(", ")}`);
  if (mezzi.length) details.push(`Mezzi già impegnati: ${mezzi.join(", ")}`);
  return details.join(" | ");
}

function hasDefinedOperativi(meta?: CronoMeta | null) {
  if (!meta) return false;
  const operativi = extractOperativi(meta);
  return Boolean(
    operativi.data_inizio ||
      operativi.durata_giorni ||
      operativi.personale_ids.length > 0 ||
      operativi.personale_previsto.trim() ||
      operativi.mezzi.trim() ||
      operativi.descrizione_attivita.trim() ||
      operativi.indirizzo.trim() ||
      operativi.orario.trim() ||
      operativi.referente_cliente_nome.trim() ||
      operativi.referente_cliente_contatto.trim() ||
      operativi.commerciale_art_tech_nome.trim() ||
      operativi.commerciale_art_tech_contatto.trim()
  );
}

function downloadCronoCsv(
  filename: string,
  rows: TimelineRow[],
  metaByKey: Record<string, CronoMeta>,
  commentsByKey: Record<string, CronoComment[]>
) {
  const header = [
    "tipo_evento",
    "data_inizio",
    "durata_giorni",
    "data_fine",
    "data_prevista",
    "data_tassativa",
    "cliente",
    "progetto",
    "ticket_no",
    "fatto",
    "nota_ultima",
    "descrizione",
    "personale_previsto",
    "mezzi",
    "descrizione_attivita",
    "indirizzo",
    "orario",
    "referente_cliente_nome",
    "referente_cliente_contatto",
    "commerciale_art_tech_nome",
    "commerciale_art_tech_contatto",
    "checklist_link",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const key = getRowKey(r.kind, r.row_ref_id);
    const fatto = Boolean(metaByKey[key]?.fatto ?? r.fatto);
    const latestComment = commentsByKey[key]?.[0];
    const op = extractOperativi(metaByKey[key] || null);
    const schedule = getRowSchedule(r, metaByKey[key] || null);
    const cells = [
      r.kind,
      schedule.data_inizio,
      schedule.durata_giorni,
      schedule.data_fine,
      r.data_prevista,
      r.data_tassativa,
      r.cliente,
      r.progetto,
      r.ticket_no || "",
      fatto ? "FATTO" : "DA_FINIRE",
      latestComment?.commento || "",
      r.descrizione,
      op.personale_previsto,
      op.mezzi,
      op.descrizione_attivita,
      op.indirizzo,
      op.orario,
      op.referente_cliente_nome,
      op.referente_cliente_contatto,
      op.commerciale_art_tech_nome,
      op.commerciale_art_tech_contatto,
      r.checklist_id ? `/checklists/${r.checklist_id}` : "",
    ].map((x) => `"${String(x || "").replaceAll('"', '""')}"`);
    lines.push(cells.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DashboardCockpitPage({
  showCockpitSection = true,
  showClientiSection = false,
  showCronoSection = true,
  showProjectsSection = false,
  enableProjectFilters = false,
  enableClientFilters = false,
  showClientiCockpit = false,
  projectsView = "compact",
  pageTitle = "AT SYSTEM",
  pageSubtitle = "Cockpit operativo",
}: {
  showCockpitSection?: boolean;
  showClientiSection?: boolean;
  showCronoSection?: boolean;
  showProjectsSection?: boolean;
  enableProjectFilters?: boolean;
  enableClientFilters?: boolean;
  showClientiCockpit?: boolean;
  projectsView?: "compact" | "extended";
  pageTitle?: string;
  pageSubtitle?: string;
} = {}) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<Checklist[]>([]);
  const [clientiRegistry, setClientiRegistry] = useState<ClienteAnagraficaRow[]>([]);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [currentOperatoreId, setCurrentOperatoreId] = useState<string>("");
  const [currentOperatoreLabel, setCurrentOperatoreLabel] = useState<{
    nome: string | null;
    ruolo: string | null;
  } | null>(null);
  const [operatoriLookupById, setOperatoriLookupById] = useState<
    Map<string, { nome: string | null; email: string | null }>
  >(new Map());
  const [operatoreAssociationError, setOperatoreAssociationError] = useState<string | null>(null);
  const [scadenzePeriodDays, setScadenzePeriodDays] = useState<7 | 15 | 30>(7);
  const [scadenzeByPeriod, setScadenzeByPeriod] = useState<Record<7 | 15 | 30, DashboardScadenzeSummary>>({
    7: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
    15: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
    30: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
  });
  const [interventiDaChiudereSummary, setInterventiDaChiudereSummary] = useState<DashboardMetricSummary>({
    count: 0,
    overdue: 0,
  });
  const [interventiEntro7Summary, setInterventiEntro7Summary] = useState<DashboardMetricSummary>({
    count: 0,
    overdue: 0,
  });
  const [fattureDaEmettereCount, setFattureDaEmettereCount] = useState(0);
  const [noleggiAttiviCount, setNoleggiAttiviCount] = useState(0);
  const [consegneEntro7Summary, setConsegneEntro7Summary] = useState<DashboardMetricSummary>({
    count: 0,
    overdue: 0,
  });
  const [smontaggiEntro7Summary, setSmontaggiEntro7Summary] = useState<DashboardMetricSummary>({
    count: 0,
    overdue: 0,
  });
  const [documentiAlertSummary, setDocumentiAlertSummary] = useState<DocumentiAlertSummary>(
    EMPTY_DOCUMENTI_ALERT_SUMMARY
  );
  const [simScadenzeByPeriod, setSimScadenzeByPeriod] = useState<DashboardSimSummaryByPeriod>({
    7: { count: 0, overdue: 0 },
    15: { count: 0, overdue: 0 },
    30: { count: 0, overdue: 0 },
  });
  const [simSearchByChecklistId, setSimSearchByChecklistId] = useState<Record<string, string[]>>({});
  const [clientiMissingEmailCount, setClientiMissingEmailCount] = useState(0);
  const [dashboardProjectSearch, setDashboardProjectSearch] = useState("");
  const [dashboardProjectQuickFilter, setDashboardProjectQuickFilter] = useState<
    "TUTTI" | "CRITICI" | "IMMINENTI" | "SCADUTI"
  >("TUTTI");
  const [dashboardProjectStatusFilter, setDashboardProjectStatusFilter] = useState("TUTTI");
  const [dashboardClientSearch, setDashboardClientSearch] = useState("");
  const [dashboardClientQuickFilter, setDashboardClientQuickFilter] = useState<
    "TUTTI" | "ATTENZIONE" | "MONITORARE" | "STABILE"
  >("TUTTI");
  const [dashboardClientSaasFilter, setDashboardClientSaasFilter] =
    useState<DashboardClientSaasFilter>("TUTTI");
  const [showMissingEmailInfo, setShowMissingEmailInfo] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [addInterventoOpen, setAddInterventoOpen] = useState(false);
  const [addInterventoCliente, setAddInterventoCliente] = useState("");
  const [addInterventoChecklistId, setAddInterventoChecklistId] = useState("");
  const [addInterventoDescrizione, setAddInterventoDescrizione] = useState("");
  const [addInterventoPersonalePrevisto, setAddInterventoPersonalePrevisto] = useState("");
  const [addInterventoMezzi, setAddInterventoMezzi] = useState("");
  const [addInterventoNoteOperative, setAddInterventoNoteOperative] = useState("");
  const [addInterventoIndirizzo, setAddInterventoIndirizzo] = useState("");
  const [addInterventoReferenteClienteNome, setAddInterventoReferenteClienteNome] = useState("");
  const [addInterventoReferenteClienteContatto, setAddInterventoReferenteClienteContatto] = useState("");
  const [addInterventoReferenteArtTechNome, setAddInterventoReferenteArtTechNome] = useState("");
  const [addInterventoReferentiCliente, setAddInterventoReferentiCliente] = useState<
    DashboardClienteReferente[]
  >([]);
  const [addInterventoAttachmentDocumentType, setAddInterventoAttachmentDocumentType] =
    useState<QuickAttachmentDocumentType>("GENERICO");
  const [addInterventoAttachmentInputKey, setAddInterventoAttachmentInputKey] = useState(0);
  const [addInterventoAttachmentFiles, setAddInterventoAttachmentFiles] = useState<File[]>([]);
  const [addInterventoAttachmentLinkTitle, setAddInterventoAttachmentLinkTitle] = useState("");
  const [addInterventoAttachmentLinkUrl, setAddInterventoAttachmentLinkUrl] = useState("");
  const [addInterventoAttachmentDrafts, setAddInterventoAttachmentDrafts] = useState<
    QuickAttivitaAttachmentDraft[]
  >([]);
  const [addInterventoTouched, setAddInterventoTouched] =
    useState<QuickAttivitaTouched>(EMPTY_QUICK_ATTIVITA_TOUCHED);
  const [addInterventoSaving, setAddInterventoSaving] = useState(false);
  const [addInterventoError, setAddInterventoError] = useState<string | null>(null);
  const [addAttivitaOpen, setAddAttivitaOpen] = useState(false);
  const [addAttivitaType, setAddAttivitaType] = useState<QuickAttivitaType>("INSTALLAZIONE");
  const [addAttivitaCliente, setAddAttivitaCliente] = useState("");
  const [addAttivitaChecklistId, setAddAttivitaChecklistId] = useState("");
  const [addAttivitaData, setAddAttivitaData] = useState("");
  const [addAttivitaOre, setAddAttivitaOre] = useState("8");
  const [addAttivitaDescrizione, setAddAttivitaDescrizione] = useState("");
  const [addAttivitaPersonalePrevisto, setAddAttivitaPersonalePrevisto] = useState("");
  const [addAttivitaMezzi, setAddAttivitaMezzi] = useState("");
  const [addAttivitaNoteOperative, setAddAttivitaNoteOperative] = useState("");
  const [addAttivitaIndirizzo, setAddAttivitaIndirizzo] = useState("");
  const [addAttivitaReferenteClienteNome, setAddAttivitaReferenteClienteNome] = useState("");
  const [addAttivitaReferenteClienteContatto, setAddAttivitaReferenteClienteContatto] = useState("");
  const [addAttivitaReferenteArtTechNome, setAddAttivitaReferenteArtTechNome] = useState("");
  const [addAttivitaReferentiCliente, setAddAttivitaReferentiCliente] = useState<DashboardClienteReferente[]>([]);
  const [addAttivitaAttachmentDocumentType, setAddAttivitaAttachmentDocumentType] =
    useState<QuickAttachmentDocumentType>("GENERICO");
  const [addAttivitaAttachmentInputKey, setAddAttivitaAttachmentInputKey] = useState(0);
  const [addAttivitaAttachmentFiles, setAddAttivitaAttachmentFiles] = useState<File[]>([]);
  const [addAttivitaAttachmentLinkTitle, setAddAttivitaAttachmentLinkTitle] = useState("");
  const [addAttivitaAttachmentLinkUrl, setAddAttivitaAttachmentLinkUrl] = useState("");
  const [addAttivitaAttachmentDrafts, setAddAttivitaAttachmentDrafts] = useState<
    QuickAttivitaAttachmentDraft[]
  >([]);
  const [addAttivitaTouched, setAddAttivitaTouched] =
    useState<QuickAttivitaTouched>(EMPTY_QUICK_ATTIVITA_TOUCHED);
  const [addAttivitaSaving, setAddAttivitaSaving] = useState(false);
  const [addAttivitaError, setAddAttivitaError] = useState<string | null>(null);
  const [debugLocation, setDebugLocation] = useState<string>("");
  const [debugCookieHasSb, setDebugCookieHasSb] = useState<boolean | null>(null);
  const [debugLocalKeys, setDebugLocalKeys] = useState<string[]>([]);
  const [debugSessionEmail, setDebugSessionEmail] = useState<string | null>(null);
  const [debugSessionLoading, setDebugSessionLoading] = useState<boolean>(true);
  const [debugForcedByQuery, setDebugForcedByQuery] = useState(false);

  // campi testata
  const [cliente, setCliente] = useState("");
  const [nomeChecklist, setNomeChecklist] = useState("");
  const [proforma, setProforma] = useState("");
  const [magazzinoImportazione, setMagazzinoImportazione] = useState("");
  const [saasPiano, setSaasPiano] = useState<string>("");
  const [saasScadenza, setSaasScadenza] = useState("");
  const [saasNote, setSaasNote] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [dataTassativa, setDataTassativa] = useState("");
  const [statoProgetto, setStatoProgetto] = useState("IN_CORSO");
  const [dataInstallazioneReale, setDataInstallazioneReale] = useState("");
  const [noleggioVendita, setNoleggioVendita] = useState("");
  const [tipoStruttura, setTipoStruttura] = useState("");
  const [passo, setPasso] = useState("");
  const [tipoImpianto, setTipoImpianto] = useState<"INDOOR" | "OUTDOOR" | "">("");
  const [dimensioni, setDimensioni] = useState("");
  const [garanziaScadenza, setGaranziaScadenza] = useState(""); // yyyy-mm-dd
  const [ultraScope, setUltraScope] = useState<"CLIENTE" | "CHECKLIST">("CLIENTE");
  const [ultraInclusi, setUltraInclusi] = useState<string>("");

  // righe (accessori/ricambi)
  const [rows, setRows] = useState<ChecklistItem[]>([
    { codice: "", descrizione: "", qty: "", note: "", search: "" },
  ]);

  const canCreate = useMemo(() => {
    return cliente.trim().length > 0 && nomeChecklist.trim().length > 0;
  }, [cliente, nomeChecklist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setDebugForcedByQuery(params.get("debug") === "1");
    setDebugLocation(window.location.href);
    setDebugCookieHasSb(document.cookie.includes("sb-"));
    const keys = Object.keys(localStorage).filter(
      (k) => k.toLowerCase().includes("supabase") || k.toLowerCase().includes("sb-")
    );
    setDebugLocalKeys(keys);
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error("Debug getSession error", error);
        setDebugSessionEmail(data.session?.user?.email ?? null);
        setDebugSessionLoading(false);
      })
      .catch((err) => {
        console.error("Debug getSession exception", err);
        setDebugSessionLoading(false);
      });
  }, []);

  const showDebugAuth = process.env.NODE_ENV !== "production" || debugForcedByQuery;

  function getCurrentOperatoreDisplayName() {
    const directName = String(currentOperatoreLabel?.nome || "").trim();
    if (directName) return directName;
    const lookup = operatoriLookupById.get(currentOperatoreId || "");
    const lookupName = String(lookup?.nome || "").trim();
    if (lookupName) return lookupName;
    const lookupEmail = String(lookup?.email || "").trim();
    if (lookupEmail) return lookupEmail;
    return null;
  }

  async function resolveOperatoreForSave() {
    const existingId = String(currentOperatoreId || "").trim();
    const existingName = String(getCurrentOperatoreDisplayName() || "").trim();
    if (existingId) {
      return {
        id: existingId,
        displayName: existingName || null,
      };
    }

    const meRes = await fetch("/api/me-operatore", { credentials: "include" });
    const meData = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !meData?.operatore?.id) {
      throw new Error(String(meData?.error || "Operatore non associato"));
    }

    const resolvedId = String(meData.operatore.id || "").trim();
    const resolvedName = String(meData.operatore.nome || "").trim() || null;
    if (!resolvedId) {
      throw new Error("Operatore non associato");
    }

    setCurrentOperatoreId(resolvedId);
    setCurrentOperatoreLabel({
      nome: meData.operatore.nome ?? null,
      ruolo: meData.operatore.ruolo ?? null,
    });

    return {
      id: resolvedId,
      displayName: resolvedName,
    };
  }

  const isUltraOrPremium =
    saasPiano.startsWith("SAAS-UL") || saasPiano.startsWith("SAAS-PR");

  const strutturaOptions = useMemo(() => {
    return catalogItems.filter((item) => {
      const code = (item.codice ?? "").toUpperCase();
      return code.startsWith("STR-") || code === "TEC-STRCT";
    });
  }, [catalogItems]);

  const loadAbortRef = useRef<AbortController | null>(null);
  const loadRequestSeqRef = useRef(0);

  const [cronoLoading, setCronoLoading] = useState(true);
  const [cronoError, setCronoError] = useState<string | null>(null);
  const [cronoRows, setCronoRows] = useState<TimelineRow[]>([]);
  const [cronoFromDate, setCronoFromDate] = useState("");
  const [cronoToDate, setCronoToDate] = useState("");
  const [cronoClienteFilter, setCronoClienteFilter] = useState("TUTTI");
  const [cronoKindFilter, setCronoKindFilter] = useState<
    "TUTTI" | "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO"
  >("TUTTI");
  const [cronoQuickRangeDays, setCronoQuickRangeDays] = useState<7 | 15 | 30 | null>(null);
  const [cronoShowFatto, setCronoShowFatto] = useState(false);
  const [cronoShowHidden, setCronoShowHidden] = useState(false);
  const [cronoQ, setCronoQ] = useState("");
  const [cronoPersonaleFilter, setCronoPersonaleFilter] = useState("");
  const [cronoSortBy, setCronoSortBy] = useState<"data_prevista" | "data_tassativa">("data_tassativa");
  const [cronoSortDir, setCronoSortDir] = useState<"asc" | "desc">("asc");
  const [cronoMetaByKey, setCronoMetaByKey] = useState<Record<string, CronoMeta>>({});
  const [cronoCommentsByKey, setCronoCommentsByKey] = useState<Record<string, CronoComment[]>>({});
  const [cronoNoteDraftByKey, setCronoNoteDraftByKey] = useState<Record<string, string>>({});
  const [cronoStateLoading, setCronoStateLoading] = useState(false);
  const [cronoStateError, setCronoStateError] = useState<string | null>(null);
  const [cronoSavingFattoKey, setCronoSavingFattoKey] = useState<string | null>(null);
  const [cronoSavingHiddenKey, setCronoSavingHiddenKey] = useState<string | null>(null);
  const [cronoSavingCommentKey, setCronoSavingCommentKey] = useState<string | null>(null);
  const [cronoSavingOperativiKey, setCronoSavingOperativiKey] = useState<string | null>(null);
  const [cronoDeletingCommentId, setCronoDeletingCommentId] = useState<string | null>(null);
  const [cronoNoteHistoryKey, setCronoNoteHistoryKey] = useState<string | null>(null);
  const [cronoOperativiDraftByKey, setCronoOperativiDraftByKey] = useState<Record<string, OperativiFields>>({});
  const cronoTopScrollRef = useRef<HTMLDivElement | null>(null);
  const cronoMainScrollRef = useRef<HTMLDivElement | null>(null);
  const cronoBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const cronoScrollContentRef = useRef<HTMLDivElement | null>(null);
  const cronoSyncingScrollRef = useRef<"top" | "main" | "bottom" | null>(null);
  const [cronoScrollContentWidth, setCronoScrollContentWidth] = useState(4320);

  async function loadHomeCronoRowState(timelineRows: TimelineRow[]) {
    if (!timelineRows.length) {
      setCronoMetaByKey({});
      setCronoCommentsByKey({});
      return;
    }
    setCronoStateLoading(true);
    setCronoStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "load",
          rows: timelineRows.map((r) => ({ row_kind: r.kind, row_ref_id: r.row_ref_id })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data?.error || "");
        if (
          msg.toLowerCase().includes("cronoprogramma_meta") ||
          msg.toLowerCase().includes("cronoprogramma_comments")
        ) {
          setCronoStateError(
            "Funzioni note/fatto non attive: esegui script scripts/20260227_add_cronoprogramma_meta_comments.sql"
          );
        } else {
          setCronoStateError(msg || "Errore caricamento stato cronoprogramma");
        }
        setCronoMetaByKey({});
        setCronoCommentsByKey({});
        return;
      }
      const nextMeta = (data?.meta as Record<string, CronoMeta>) || {};
      setCronoMetaByKey(nextMeta);
      setCronoOperativiDraftByKey((prev) => {
        const next = { ...prev };
        for (const r of timelineRows) {
          const key = getRowKey(r.kind, r.row_ref_id);
          if (!next[key]) next[key] = extractOperativi(nextMeta[key]);
        }
        return next;
      });
      setCronoCommentsByKey((data?.comments as Record<string, CronoComment[]>) || {});
    } finally {
      setCronoStateLoading(false);
    }
  }

  async function setHomeCronoFatto(row: TimelineRow, fatto: boolean) {
    const key = getRowKey(row.kind, row.row_ref_id);
    setCronoSavingFattoKey(key);
    setCronoStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_fatto", row_kind: row.kind, row_ref_id: row.row_ref_id, fatto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoStateError(data?.error || "Errore salvataggio stato fatto");
        return;
      }
      setCronoMetaByKey((prev) => ({ ...prev, [key]: data?.meta }));
      setCronoRows((prev) =>
        prev.map((r) => (r.kind === row.kind && r.row_ref_id === row.row_ref_id ? { ...r, fatto } : r))
      );
    } finally {
      setCronoSavingFattoKey(null);
    }
  }

  async function setHomeCronoHidden(row: TimelineRow, hidden: boolean) {
    const key = getRowKey(row.kind, row.row_ref_id);
    setCronoSavingHiddenKey(key);
    setCronoStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_hidden", row_kind: row.kind, row_ref_id: row.row_ref_id, hidden }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoStateError(data?.error || "Errore salvataggio stato nascosta");
        return;
      }
      setCronoMetaByKey((prev) => ({ ...prev, [key]: data?.meta }));
    } finally {
      setCronoSavingHiddenKey(null);
    }
  }

  async function addHomeCronoComment(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const commento = String(cronoNoteDraftByKey[key] || "").trim();
    if (!commento) return;
    setCronoSavingCommentKey(key);
    setCronoStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_comment", row_kind: row.kind, row_ref_id: row.row_ref_id, commento }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoStateError(data?.error || "Errore salvataggio commento");
        return;
      }
      setCronoNoteDraftByKey((prev) => ({ ...prev, [key]: "" }));
      setCronoCommentsByKey((prev) => ({ ...prev, [key]: [data?.comment, ...(prev[key] || [])].filter(Boolean) }));
    } finally {
      setCronoSavingCommentKey(null);
    }
  }

  async function saveHomeCronoOperativi(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const draft = cronoOperativiDraftByKey[key] || EMPTY_OPERATIVI;
    setCronoSavingOperativiKey(key);
    setCronoStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_operativi", row_kind: row.kind, row_ref_id: row.row_ref_id, ...draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoStateError(data?.error || "Errore salvataggio dati operativi");
        return;
      }
      setCronoMetaByKey((prev) => ({ ...prev, [key]: data?.meta }));
      setCronoOperativiDraftByKey((prev) => ({ ...prev, [key]: extractOperativi(data?.meta || null) }));
    } finally {
      setCronoSavingOperativiKey(null);
    }
  }

  async function deleteHomeCronoComment(row: TimelineRow, commentId: string) {
    const safeId = String(commentId || "").trim();
    if (!safeId) return;
    setCronoDeletingCommentId(safeId);
    setCronoStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_comment", comment_id: safeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoStateError(data?.error || "Errore eliminazione commento");
        return;
      }
      const key = getRowKey(row.kind, row.row_ref_id);
      setCronoCommentsByKey((prev) => ({ ...prev, [key]: (prev[key] || []).filter((c) => c.id !== safeId) }));
    } finally {
      setCronoDeletingCommentId(null);
    }
  }

  function applyHomeCronoQuickRange(days: 7 | 15 | 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = new Date(today.getTime());
    to.setDate(to.getDate() + days);
    setCronoFromDate(dateToOperativiIsoDay(today));
    setCronoToDate(dateToOperativiIsoDay(to));
    setCronoQuickRangeDays(days);
  }

  function onHomeCronoTopScroll(e: UIEvent<HTMLDivElement>) {
    if (cronoSyncingScrollRef.current === "main" || cronoSyncingScrollRef.current === "bottom") return;
    cronoSyncingScrollRef.current = "top";
    if (cronoMainScrollRef.current) cronoMainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (cronoBottomScrollRef.current) cronoBottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    cronoSyncingScrollRef.current = null;
  }

  function onHomeCronoMainScroll(e: UIEvent<HTMLDivElement>) {
    if (cronoSyncingScrollRef.current === "top" || cronoSyncingScrollRef.current === "bottom") return;
    cronoSyncingScrollRef.current = "main";
    if (cronoTopScrollRef.current) cronoTopScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (cronoBottomScrollRef.current) cronoBottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    cronoSyncingScrollRef.current = null;
  }

  function onHomeCronoBottomScroll(e: UIEvent<HTMLDivElement>) {
    if (cronoSyncingScrollRef.current === "top" || cronoSyncingScrollRef.current === "main") return;
    cronoSyncingScrollRef.current = "bottom";
    if (cronoTopScrollRef.current) cronoTopScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (cronoMainScrollRef.current) cronoMainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    cronoSyncingScrollRef.current = null;
  }

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getTime());
    from.setDate(from.getDate() - 7);
    const to = new Date(now.getTime());
    to.setDate(to.getDate() + 60);
    setCronoFromDate(dateToOperativiIsoDay(from));
    setCronoToDate(dateToOperativiIsoDay(to));
  }, []);

  async function loadHomeCrono() {
    setCronoLoading(true);
    setCronoError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load_events" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoError(String(data?.error || "Errore caricamento cronoprogramma"));
        setCronoRows([]);
        return;
      }
      const timeline = ((data?.events as TimelineRow[]) || []).map((r) => ({
        ...r,
        tipologia: String(r.tipologia || inferInterventoTipologia(r.descrizione)).toUpperCase(),
      }));
      setCronoRows(timeline);
      await loadHomeCronoRowState(timeline);
    } finally {
      setCronoLoading(false);
    }
  }

  useEffect(() => {
    void loadHomeCrono();
  }, []);

  const homeCronoClienti = useMemo(() => {
    return Array.from(new Set(cronoRows.map((r) => r.cliente).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [cronoRows]);

  const homeCronoFiltered = useMemo(() => {
    const needle = cronoQ.trim().toLowerCase();
    const personaleNeedle = normalizePersonaleText(cronoPersonaleFilter);
    return cronoRows.filter((r) => {
      const key = getRowKey(r.kind, r.row_ref_id);
      const fatto = Boolean(cronoMetaByKey[key]?.fatto ?? r.fatto);
      const hidden = Boolean(cronoMetaByKey[key]?.hidden);
      const operativi = extractOperativi(cronoMetaByKey[key] || null);
      const personalePrevisto = operativi.personale_previsto;
      const schedule = getRowSchedule(r, cronoMetaByKey[key] || null);
      if (hidden && !cronoShowHidden) return false;
      if (fatto && !cronoShowFatto) return false;
      if (cronoClienteFilter !== "TUTTI" && r.cliente !== cronoClienteFilter) return false;
      if (cronoKindFilter !== "TUTTI" && r.kind !== cronoKindFilter) return false;
      if (personaleNeedle && !normalizePersonaleText(personalePrevisto).includes(personaleNeedle)) return false;
      if (needle) {
        const matchesSearch = `${r.cliente} ${r.progetto} ${r.ticket_no || ""} ${r.descrizione} ${r.stato}`
          .toLowerCase()
          .includes(needle);
        if (!matchesSearch) return false;
      }
      if (fatto && cronoShowFatto) return true;
      if (cronoFromDate && schedule.data_fine < cronoFromDate) return false;
      if (cronoToDate && schedule.data_inizio > cronoToDate) return false;
      return true;
    });
  }, [
    cronoRows,
    cronoFromDate,
    cronoToDate,
    cronoClienteFilter,
    cronoKindFilter,
    cronoQ,
    cronoPersonaleFilter,
    cronoMetaByKey,
    cronoShowFatto,
    cronoShowHidden,
  ]);

  const homeCronoFilteredSorted = useMemo(() => {
    const sorted = [...homeCronoFiltered];
    const field = cronoSortBy;
    sorted.sort((a, b) => {
      const avSchedule = getRowSchedule(a, cronoMetaByKey[getRowKey(a.kind, a.row_ref_id)] || null);
      const bvSchedule = getRowSchedule(b, cronoMetaByKey[getRowKey(b.kind, b.row_ref_id)] || null);
      const av = field === "data_prevista" ? avSchedule.data_inizio : avSchedule.data_fine;
      const bv = field === "data_prevista" ? bvSchedule.data_inizio : bvSchedule.data_fine;
      const comparison = String(av || "").localeCompare(String(bv || ""));
      return cronoSortDir === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [homeCronoFiltered, cronoSortBy, cronoSortDir, cronoMetaByKey]);

  const homeCronoConflictByKey = useMemo(() => {
    return checkOperativiConflicts(
      cronoRows.map((row) => {
        const key = getRowKey(row.kind, row.row_ref_id);
        const operativi = cronoOperativiDraftByKey[key] || extractOperativi(cronoMetaByKey[key] || null);
        const schedule = getRowSchedule(row, operativi);
        return {
          key,
          start: schedule.data_inizio,
          end: schedule.data_fine,
          personale: operativi.personale_previsto,
          mezzi: operativi.mezzi,
        };
      })
    );
  }, [cronoRows, cronoMetaByKey, cronoOperativiDraftByKey]);

  const attivitaEntro7Summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inSevenDays = new Date(today);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    let count = 0;
    let overdue = 0;

    for (const row of cronoRows) {
      if (row.kind === "DISINSTALLAZIONE") continue;

      const key = getRowKey(row.kind, row.row_ref_id);
      const meta = cronoMetaByKey[key] || null;
      const fatto = Boolean(meta?.fatto ?? row.fatto);
      const hidden = Boolean(meta?.hidden);
      if (fatto || hidden) continue;

      if (isTimelineRowOverdueNotDone(row, meta, today)) {
        overdue += 1;
        continue;
      }

      const dueDateRaw = String(row.data_tassativa || row.data_prevista || "").trim();
      if (!dueDateRaw) continue;
      const dueDate = new Date(dueDateRaw);
      if (!Number.isFinite(dueDate.getTime())) continue;
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate >= today && dueDate <= inSevenDays) {
        count += 1;
      }
    }

    return { count, overdue };
  }, [cronoRows, cronoMetaByKey]);

  useEffect(() => {
    const updateScrollWidth = () => {
      const width = cronoScrollContentRef.current?.scrollWidth || 4320;
      setCronoScrollContentWidth(width);
    };
    updateScrollWidth();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScrollWidth);
      return () => window.removeEventListener("resize", updateScrollWidth);
    }
  }, [homeCronoFilteredSorted.length, cronoLoading]);

  function toggleHomeCronoSort(field: "data_prevista" | "data_tassativa") {
    if (cronoSortBy === field) {
      setCronoSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setCronoSortBy(field);
    setCronoSortDir("asc");
  }

  const homeCronoRowByKey = useMemo(() => {
    const map: Record<string, TimelineRow> = {};
    for (const r of cronoRows) {
      map[getRowKey(r.kind, r.row_ref_id)] = r;
    }
    return map;
  }, [cronoRows]);

  const clientiOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((c) => {
      if (c.cliente) set.add(c.cliente);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
  }, [items]);

  const dashboardClientRows = useMemo<DashboardClienteCockpitRow[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toDateInputValue(today);
    const upcoming7 = new Date(today);
    upcoming7.setDate(upcoming7.getDate() + 7);
    const upcoming30 = new Date(today);
    upcoming30.setDate(upcoming30.getDate() + 30);
    const upcoming7Iso = toDateInputValue(upcoming7);
    const upcoming30Iso = toDateInputValue(upcoming30);

    const clientMap = new Map<string, DashboardClienteCockpitEntry>();
    const keyByClienteId = new Map<string, string>();
    const keyByClienteName = new Map<string, string>();

    for (const clienteRow of clientiRegistry) {
      const cliente = String(clienteRow.denominazione || "").trim();
      const clienteId = String(clienteRow.id || "").trim() || null;
      const normalizedName = normalizeClienteSearchKey(cliente);
      if (!cliente && !clienteId) continue;
      const key = clienteId ? `id:${clienteId}` : `name:${normalizedName}`;
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          cliente: cliente || "Cliente senza denominazione",
          clienteId,
          projectCount: 0,
          openActivities: 0,
          imminentActivities: 0,
          overdueActivities: 0,
          relevantDeadlines: 0,
          overdueDeadlines: 0,
          searchText: [
            cliente,
            clienteRow.denominazione_norm,
            clienteRow.codice_interno,
            clienteRow.piva,
            clienteRow.codice_fiscale,
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
      if (clienteId) keyByClienteId.set(clienteId, key);
      if (normalizedName) keyByClienteName.set(normalizedName, key);
    }

    const ensureClient = (clienteValue?: string | null, clienteIdValue?: string | null) => {
      const cliente = String(clienteValue || "").trim();
      const clienteId = String(clienteIdValue || "").trim() || null;
      const normalizedName = normalizeClienteSearchKey(cliente);
      const existingKey =
        (clienteId && keyByClienteId.get(clienteId)) ||
        (normalizedName && keyByClienteName.get(normalizedName)) ||
        null;
      if (existingKey && clientMap.has(existingKey)) {
        return clientMap.get(existingKey) || null;
      }
      if (!cliente && !clienteId) return null;
      const dynamicKey = clienteId ? `id:${clienteId}` : `name:${normalizedName}`;
      if (!clientMap.has(dynamicKey)) {
        clientMap.set(dynamicKey, {
          cliente: cliente || "Cliente senza denominazione",
          clienteId,
          projectCount: 0,
          openActivities: 0,
          imminentActivities: 0,
          overdueActivities: 0,
          relevantDeadlines: 0,
          overdueDeadlines: 0,
          searchText: cliente,
        });
      }
      if (clienteId) keyByClienteId.set(clienteId, dynamicKey);
      if (normalizedName) keyByClienteName.set(normalizedName, dynamicKey);
      return clientMap.get(dynamicKey) || null;
    };

    const registerDeadline = (entry: DashboardClienteCockpitEntry | null, rawValue?: string | null) => {
      const value = String(rawValue || "").trim().slice(0, 10);
      if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      if (value < todayIso) {
        entry.overdueDeadlines += 1;
        return;
      }
      if (value <= upcoming30Iso) {
        entry.relevantDeadlines += 1;
      }
    };

    for (const item of items) {
      const entry = ensureClient(item.cliente, item.cliente_id);
      if (!entry) continue;
      entry.projectCount += 1;
      registerDeadline(entry, item.data_tassativa || item.data_prevista);
      registerDeadline(entry, item.garanzia_scadenza);
      registerDeadline(entry, item.licenze_prossima_scadenza);
      registerDeadline(entry, item.fine_noleggio);
    }

    for (const row of cronoRows) {
      const checklistClienteId =
        items.find((item) => String(item.id || "") === String(row.checklist_id || ""))?.cliente_id || null;
      const entry = ensureClient(row.cliente, checklistClienteId);
      if (!entry) continue;
      const key = getRowKey(row.kind, row.row_ref_id);
      const meta = cronoMetaByKey[key] || null;
      const fatto = Boolean(meta?.fatto ?? row.fatto);
      const hidden = Boolean(meta?.hidden);
      if (fatto || hidden) continue;

      entry.openActivities += 1;

      if (isTimelineRowOverdueNotDone(row, meta, today)) {
        entry.overdueActivities += 1;
        continue;
      }

      const dueDate = String(row.data_tassativa || row.data_prevista || "").trim().slice(0, 10);
      if (dueDate && dueDate >= todayIso && dueDate <= upcoming7Iso) {
        entry.imminentActivities += 1;
      }
    }

    const aggregatedRows = new Map<string, DashboardClienteCockpitEntry>();

    for (const entry of clientMap.values()) {
      const normalizedName = normalizeClienteSearchKey(entry.cliente);
      const aggregateKey = normalizedName || (entry.clienteId ? `id:${entry.clienteId}` : "");
      if (!aggregateKey) continue;
      const existing = aggregatedRows.get(aggregateKey);
      if (!existing) {
        aggregatedRows.set(aggregateKey, { ...entry });
        continue;
      }
      existing.cliente = existing.cliente || entry.cliente;
      existing.clienteId = existing.clienteId || entry.clienteId;
      existing.projectCount += entry.projectCount;
      existing.openActivities += entry.openActivities;
      existing.imminentActivities += entry.imminentActivities;
      existing.overdueActivities += entry.overdueActivities;
      existing.relevantDeadlines += entry.relevantDeadlines;
      existing.overdueDeadlines += entry.overdueDeadlines;
      existing.searchText = [existing.searchText, entry.searchText].filter(Boolean).join(" ");
    }

    return Array.from(aggregatedRows.entries())
      .map(([aggregateKey, entry]) => {
        const hasAttention = entry.overdueActivities > 0 || entry.overdueDeadlines > 0;
        const hasMonitoring = entry.imminentActivities > 0 || entry.relevantDeadlines > 0;
        return {
          rowKey: entry.clienteId ? `id:${entry.clienteId}` : `name:${aggregateKey}`,
          ...entry,
          attentionLabel: hasAttention
            ? ("ATTENZIONE" as const)
            : hasMonitoring
            ? ("MONITORARE" as const)
            : ("STABILE" as const),
          attentionColors: hasAttention
            ? DASHBOARD_BADGE_COLORS.statusExpired
            : hasMonitoring
            ? DASHBOARD_BADGE_COLORS.statusDueSoon
            : DASHBOARD_BADGE_COLORS.statusOk,
        };
      })
      .sort((a, b) => {
        const aScore = a.overdueActivities + a.overdueDeadlines * 2 + a.imminentActivities + a.relevantDeadlines;
        const bScore = b.overdueActivities + b.overdueDeadlines * 2 + b.imminentActivities + b.relevantDeadlines;
        if (bScore !== aScore) return bScore - aScore;
        if (b.projectCount !== a.projectCount) return b.projectCount - a.projectCount;
        return a.cliente.localeCompare(b.cliente, "it", { sensitivity: "base" });
      });
  }, [clientiRegistry, items, cronoRows, cronoMetaByKey]);

  const dashboardProjectStatusOptions = PROJECT_STATUS_FILTER_OPTIONS.compactDashboard;

  const dashboardProjectRows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toDateInputValue(today);
    const upcoming30 = new Date(today);
    upcoming30.setDate(upcoming30.getDate() + 30);
    const upcoming30Iso = toDateInputValue(upcoming30);

    return [...items]
      .map((item) => {
        const licenzaDeadline = classifyProjectDeadline(
          item.licenze_prossima_scadenza,
          todayIso,
          upcoming30Iso
        );
        const garanziaDeadline = classifyProjectDeadline(
          item.garanzia_scadenza,
          todayIso,
          upcoming30Iso
        );
        return {
          ...item,
          projectPresentation: getProjectPresentation({
            stato_progetto: item.stato_progetto,
            pct_complessivo: item.pct_complessivo,
            noleggio_vendita: item.noleggio_vendita,
            data_disinstallazione: item.data_disinstallazione,
          }),
          deadlineFlags: {
            licenza: licenzaDeadline,
            garanzia: garanziaDeadline,
            hasExpired: licenzaDeadline === "SCADUTA" || garanziaDeadline === "SCADUTA",
            hasDueSoon: licenzaDeadline === "IMMINENTE" || garanziaDeadline === "IMMINENTE",
          },
        };
      })
      .sort((a, b) => {
      const clienteCmp = String(a.cliente || "").localeCompare(String(b.cliente || ""), "it", {
        sensitivity: "base",
      });
      if (clienteCmp !== 0) return clienteCmp;
      const dateA = String(a.data_tassativa || a.data_prevista || "");
      const dateB = String(b.data_tassativa || b.data_prevista || "");
      const dateCmp = dateA.localeCompare(dateB);
      if (dateCmp !== 0) return dateCmp;
        return String(a.nome_checklist || "").localeCompare(String(b.nome_checklist || ""), "it", {
          sensitivity: "base",
        });
      });
  }, [items]);

  const filteredDashboardProjectRows = useMemo(() => {
    const needle = dashboardProjectSearch.trim().toLowerCase();
    return dashboardProjectRows.filter((item) => {
      const matchesSearch =
        !needle ||
        `${item.cliente || ""} ${item.nome_checklist || ""} ${item.proforma || ""} ${item.po || ""} ${item.tipo_impianto || ""} ${item.impianto_codice || ""} ${(simSearchByChecklistId[item.id] || []).join(" ")}`
          .toLowerCase()
          .includes(needle);
      if (!matchesSearch) return false;

      if (
        dashboardProjectStatusFilter !== "TUTTI" &&
        String(item.projectPresentation?.displayStatus || "").trim() !== dashboardProjectStatusFilter
      ) {
        return false;
      }

      if (dashboardProjectQuickFilter === "CRITICI" && !item.deadlineFlags.hasExpired) return false;
      if (
        dashboardProjectQuickFilter === "IMMINENTI" &&
        (item.deadlineFlags.hasExpired || !item.deadlineFlags.hasDueSoon)
      ) {
        return false;
      }
      if (dashboardProjectQuickFilter === "SCADUTI" && !item.deadlineFlags.hasExpired) return false;

      return true;
    });
  }, [
    dashboardProjectQuickFilter,
    dashboardProjectRows,
    dashboardProjectSearch,
    dashboardProjectStatusFilter,
    simSearchByChecklistId,
  ]);

  const dashboardClientSaasCards = useMemo(() => {
    const clientKeysByFilter: Record<Exclude<DashboardClientSaasFilter, "TUTTI">, Set<string>> = {
      SAAS: new Set<string>(),
      SAAS_ULTRA: new Set<string>(),
      ART_TECH_EVENTS: new Set<string>(),
    };
    const projectCountByFilter: Record<Exclude<DashboardClientSaasFilter, "TUTTI">, number> = {
      SAAS: 0,
      SAAS_ULTRA: 0,
      ART_TECH_EVENTS: 0,
    };

    for (const item of items) {
      if (!isDashboardSaasConnectionActive(item)) continue;
      const filterKey = getDashboardSaasFilterKey(item);
      if (!filterKey) continue;
      projectCountByFilter[filterKey] += 1;
      const rowKey = getDashboardClienteRowKey(item.cliente, item.cliente_id);
      if (!rowKey) continue;
      clientKeysByFilter[filterKey].add(rowKey);
    }

    return [
      {
        key: "SAAS" as const,
        label: "SaaS",
        helper: "Clienti con piano SaaS",
        count: clientKeysByFilter.SAAS.size,
        projectCount: projectCountByFilter.SAAS,
        colors: DASHBOARD_BADGE_COLORS.statusNeutral,
        clientKeys: clientKeysByFilter.SAAS,
      },
      {
        key: "SAAS_ULTRA" as const,
        label: "SaaS Ultra",
        helper: "Clienti con piano Ultra",
        count: clientKeysByFilter.SAAS_ULTRA.size,
        projectCount: projectCountByFilter.SAAS_ULTRA,
        colors: DASHBOARD_BADGE_COLORS.statusDueSoon,
        clientKeys: clientKeysByFilter.SAAS_ULTRA,
      },
      {
        key: "ART_TECH_EVENTS" as const,
        label: "Art Tech Events",
        helper: "Clienti con servizio Events",
        count: clientKeysByFilter.ART_TECH_EVENTS.size,
        projectCount: projectCountByFilter.ART_TECH_EVENTS,
        colors: DASHBOARD_BADGE_COLORS.statusOk,
        clientKeys: clientKeysByFilter.ART_TECH_EVENTS,
      },
    ].filter((card) => card.count > 0);
  }, [items]);

  const dashboardClientSaasClientKeys = useMemo(() => {
    return dashboardClientSaasCards.reduce<
      Partial<Record<Exclude<DashboardClientSaasFilter, "TUTTI">, Set<string>>>
    >((acc, card) => {
      acc[card.key] = card.clientKeys;
      return acc;
    }, {});
  }, [dashboardClientSaasCards]);

  const filteredDashboardClientRows = useMemo(() => {
    const needle = normalizeClienteSearchKey(dashboardClientSearch);
    return dashboardClientRows.filter((row) => {
      const matchesSearch =
        !needle ||
        normalizeClienteSearchKey(
          `${row.searchText} ${row.projectCount} ${row.openActivities} ${row.imminentActivities} ${row.relevantDeadlines} ${row.overdueDeadlines}`
        ).includes(needle);
      if (!matchesSearch) return false;
      if (dashboardClientQuickFilter !== "TUTTI" && row.attentionLabel !== dashboardClientQuickFilter) {
        return false;
      }
      if (dashboardClientSaasFilter !== "TUTTI") {
        const allowedClientKeys = dashboardClientSaasClientKeys[dashboardClientSaasFilter];
        if (!allowedClientKeys?.has(row.rowKey)) {
          return false;
        }
      }
      return true;
    });
  }, [
    dashboardClientQuickFilter,
    dashboardClientRows,
    dashboardClientSaasClientKeys,
    dashboardClientSaasFilter,
    dashboardClientSearch,
  ]);

  const clientRowsToRender = filteredDashboardClientRows;

  const dashboardClientSummary = useMemo(
    () => ({
      total: dashboardClientRows.length,
      attention: dashboardClientRows.filter((row) => row.attentionLabel === "ATTENZIONE").length,
      withOpenActivities: dashboardClientRows.filter((row) => row.openActivities > 0).length,
      withRelevantDeadlines: dashboardClientRows.filter(
        (row) => row.relevantDeadlines > 0 || row.overdueDeadlines > 0
      ).length,
    }),
    [dashboardClientRows]
  );

  const checklistOptions = useMemo(() => {
    if (!addInterventoCliente) return [];
    return items
      .filter((c) => c.cliente === addInterventoCliente)
      .map((c) => ({ id: c.id, nome: c.nome_checklist }));
  }, [items, addInterventoCliente]);

  const attivitaChecklistOptions = useMemo(() => {
    if (!addAttivitaCliente) return [];
    return items
      .filter((c) => c.cliente === addAttivitaCliente)
      .map((c) => ({ id: c.id, nome: c.nome_checklist }));
  }, [items, addAttivitaCliente]);

  const selectedAttivitaChecklist = useMemo(
    () => items.find((item) => item.id === addAttivitaChecklistId) || null,
    [items, addAttivitaChecklistId]
  );
  const selectedInterventoChecklist = useMemo(
    () => items.find((item) => item.id === addInterventoChecklistId) || null,
    [items, addInterventoChecklistId]
  );
  const quickOperatoreNameOptions = useMemo(() => {
    const names = new Set<string>();
    const currentName = String(currentOperatoreLabel?.nome || "").trim();
    if (currentName) names.add(currentName);
    for (const entry of operatoriLookupById.values()) {
      const nome = String(entry.nome || "").trim();
      if (nome) names.add(nome);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "it"));
  }, [currentOperatoreLabel, operatoriLookupById]);

  const selectedScadenzeSummary = scadenzeByPeriod[scadenzePeriodDays];
  const selectedSimScadenzeSummary = simScadenzeByPeriod[scadenzePeriodDays];
  const cockpitCardHeight = 128;
  const shortcutCardStyle = {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "center" as const,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #fcd34d",
    background: "rgba(255,255,255,0.62)",
    color: "inherit",
    textDecoration: "none",
    width: "100%",
    minWidth: 0,
    minHeight: cockpitCardHeight,
    height: cockpitCardHeight,
  };
  const shortcutCardTitleStyle = {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.2,
    color: "#6b7280",
    width: "100%",
    minHeight: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1.2,
  };
  const shortcutCardNumberWrapStyle = {
    flex: 1,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const shortcutCardNumberStyle = {
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1,
  };
  const shortcutCardBadgeStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: "#92400e",
    minHeight: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap" as const,
  };

  function isScadenzaNotManaged(row: any) {
    const workflow = String(row?.workflow_stato || row?.stato || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    return !["CONFERMATO", "FATTURATO", "NON_RINNOVATO", "ANNULLATO", "CHIUSO"].includes(workflow);
  }

  function renderCockpitMetricCard(
    href: string,
    title: string,
    count: number,
    secondaryLabel?: string,
    secondaryValue?: number,
    showSecondaryAlert = false
  ) {
    return (
      <Link href={href} style={shortcutCardStyle}>
        <div style={shortcutCardTitleStyle}>{title}</div>
        <div style={shortcutCardNumberWrapStyle}>
          <div style={shortcutCardNumberStyle}>{count}</div>
        </div>
        <div style={shortcutCardBadgeStyle}>
          {secondaryLabel ? `${showSecondaryAlert ? "⚠ " : ""}(${secondaryLabel}: ${secondaryValue ?? 0})` : "\u00A0"}
        </div>
      </Link>
    );
  }

  function renderDocumentiAlertCockpitCard() {
    const personeTotale =
      documentiAlertSummary.personale_scaduti + documentiAlertSummary.personale_in_scadenza;
    const aziendeTotale =
      documentiAlertSummary.aziende_scaduti + documentiAlertSummary.aziende_in_scadenza;

    return (
      <Link href="/scadenze" style={shortcutCardStyle}>
        <div style={shortcutCardTitleStyle}>DOCUMENTI / CORSI</div>
        <div style={shortcutCardNumberWrapStyle}>
          <div style={shortcutCardNumberStyle}>{documentiAlertSummary.scaduti_totale}</div>
        </div>
        <div style={{ ...shortcutCardBadgeStyle, minHeight: 30, flexDirection: "column" as const, gap: 2 }}>
          <span>In scadenza: {documentiAlertSummary.in_scadenza_totale}</span>
          <span style={{ fontSize: 10, color: "#a16207" }}>
            Persone: {personeTotale} · Aziende: {aziendeTotale}
          </span>
        </div>
      </Link>
    );
  }

  function parseSimDateOnly(value?: string | null) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function buildSimScadenzeSummary(rows: Array<{ data_scadenza: string | null; attiva: boolean }>) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next: DashboardSimSummaryByPeriod = {
      7: { count: 0, overdue: 0 },
      15: { count: 0, overdue: 0 },
      30: { count: 0, overdue: 0 },
    };

    for (const row of rows) {
      if (row.attiva === false) continue;
      const expiry = parseSimDateOnly(row.data_scadenza);
      if (!expiry) continue;
      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        next[7].overdue += 1;
        next[15].overdue += 1;
        next[30].overdue += 1;
        continue;
      }
      if (diffDays <= 7) next[7].count += 1;
      if (diffDays <= 15) next[15].count += 1;
      if (diffDays <= 30) next[30].count += 1;
    }

    return next;
  }

  async function load() {
    const requestSeq = ++loadRequestSeqRef.current;
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isLatest = () => requestSeq === loadRequestSeqRef.current;

    setDashboardLoadError(null);

    let data: any[] | null = null;
    let catalogItemsData: any[] | null = null;
    let error: any = null;

    try {
      setOperatoreAssociationError(null);
      let meRes: Response;
      try {
        meRes = await fetch("/api/me-operatore", { signal: controller.signal, credentials: "include" });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        throw new Error("Errore caricamento operatore corrente");
      }
      if (!isLatest()) return;
      const meData = await meRes.json().catch(() => ({}));
      if (!meRes.ok || !meData?.operatore?.id) {
        if (meData?.error) {
          console.error("Errore risoluzione operatore corrente", meData.error);
        }
        setCurrentOperatoreId("");
        setCurrentOperatoreLabel(null);
        setOperatoreAssociationError("Operatore non associato");
      } else {
        const canAccessBackoffice = meData.operatore.can_access_backoffice !== false;
        const canAccessOperatorApp = meData.operatore.can_access_operator_app === true;
        setCurrentOperatoreId(String(meData.operatore.id));
        setCurrentOperatoreLabel({
          nome: meData.operatore.nome ?? null,
          ruolo: String(meData.operatore.ruolo || "").trim() || null,
        });
        if (canAccessBackoffice === false && canAccessOperatorApp) {
          router.replace("/operatori");
          return;
        }
      }

      const debug = new URLSearchParams(window.location.search).get("debug") === "1";
      const dashboardRes = await fetch(`/api/dashboard${debug ? "?debug=1" : ""}`, {
        signal: controller.signal,
      });
      const dashboardData = await dashboardRes.json().catch(() => ({}));
      if (!dashboardRes.ok) {
        error = { message: dashboardData?.error || "Errore caricamento dashboard" };
        if (!isLatest()) return;
        setDashboardLoadError(String(error?.message || "Errore caricamento dashboard"));
        return;
      }

      data = (dashboardData?.data?.checklists as any[]) || [];
      catalogItemsData = (dashboardData?.data?.catalogItems as any[]) || [];

      if (debug) {
        console.log("[dashboard] auth_mode:", dashboardData?.auth_mode || dashboardData?.debug?.auth_mode);
        console.log(
          "[dashboard] result_count:",
          dashboardData?.debug?.result_count ?? (dashboardData?.data?.checklists || []).length
        );
      }

      if (!isLatest()) return;

      const merged = (data as Checklist[]).map((c) => {
        const clienteLabel =
          (c as any).clienti_anagrafica?.denominazione?.trim() || c.cliente || "";
        return {
          ...c,
          cliente: clienteLabel || c.cliente,
        };
      });
      setItems(merged as Checklist[]);
      setCatalogItems((catalogItemsData || []) as CatalogItem[]);

      try {
        const clientiRes = await dbFrom("clienti_anagrafica")
          .select("id,denominazione,denominazione_norm,codice_interno,piva,codice_fiscale,attivo")
          .eq("attivo", true)
          .order("denominazione", { ascending: true });
        if (!isLatest()) return;
        if (clientiRes.error) {
          throw clientiRes.error;
        }
        setClientiRegistry(((clientiRes.data || []) as ClienteAnagraficaRow[]).filter((row) =>
          String(row?.denominazione || "").trim()
        ));
      } catch (e: any) {
        if (!isLatest()) return;
        console.error("Errore caricamento clienti anagrafica", e);
        setClientiRegistry([]);
      }

      const today = new Date();
      const from = toDateInputValue(today);
      const scadenzePeriods = [7, 15, 30] as const;
      const buildScadenzeBreakdown = (rows: any[]): DashboardScadenzeBreakdown =>
        rows.reduce(
          (acc: DashboardScadenzeBreakdown, row: any) => {
            const tipo = String(row?.tipo || "")
              .trim()
              .toUpperCase();
            const source = String(row?.source || "")
              .trim()
              .toLowerCase();
            if (tipo === "GARANZIA" || source === "garanzie") acc.garanzie += 1;
            else if (tipo === "LICENZA" || source === "licenze") acc.licenze += 1;
            else if (tipo === "TAGLIANDO" || source === "tagliandi") acc.tagliandi += 1;
            else acc.saasAltro += 1;
            return acc;
          },
          { ...EMPTY_SCADENZE_BREAKDOWN }
        );
      try {
        const loadScadenzeSummary = async (days: (typeof scadenzePeriods)[number]) => {
          const untilDate = new Date(today);
          untilDate.setDate(untilDate.getDate() + days);
          const to = toDateInputValue(untilDate);
          const res = await fetch(`/api/scadenze?from=${from}&to=${to}`, {
            signal: controller.signal,
            credentials: "include",
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || typeof json?.count !== "number") {
            throw new Error(String(json?.error || `Errore caricamento scadenze ${days} giorni`));
          }
          const rows = Array.isArray(json?.data) ? json.data : [];
          return [days, { count: json.count, breakdown: buildScadenzeBreakdown(rows), overdueCount: 0 }] as const;
        };

        const summaries = await Promise.all(
          scadenzePeriods.map((days) => loadScadenzeSummary(days))
        );
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const overdueRes = await fetch(`/api/scadenze?to=${toDateInputValue(yesterday)}`, {
          signal: controller.signal,
          credentials: "include",
        });
        const overdueJson = await overdueRes.json().catch(() => ({}));
        if (!overdueRes.ok) {
          throw new Error(String(overdueJson?.error || "Errore caricamento scadenze scadute"));
        }
        const overdueRows = overdueRes.ok && Array.isArray(overdueJson?.data) ? overdueJson.data : [];
        const overdueCount = overdueRows.filter((row: any) => isScadenzaNotManaged(row)).length;
        if (!isLatest()) return;
        setScadenzeByPeriod({
          7: {
            ...(summaries.find(([days]) => days === 7)?.[1] || {
              count: 0,
              breakdown: { ...EMPTY_SCADENZE_BREAKDOWN },
              overdueCount: 0,
            }),
            overdueCount,
          },
          15: {
            ...(summaries.find(([days]) => days === 15)?.[1] || {
              count: 0,
              breakdown: { ...EMPTY_SCADENZE_BREAKDOWN },
              overdueCount: 0,
            }),
            overdueCount,
          },
          30: {
            ...(summaries.find(([days]) => days === 30)?.[1] || {
              count: 0,
              breakdown: { ...EMPTY_SCADENZE_BREAKDOWN },
              overdueCount: 0,
            }),
            overdueCount,
          },
        });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        console.error("Errore caricamento KPI scadenze", e);
        setDashboardLoadError((prev) => prev || String(e?.message || "Errore caricamento scadenze dashboard"));
      }

      try {
        const missingEmailRes = await fetch("/api/clienti/missing-email-count", {
          signal: controller.signal,
          credentials: "include",
        });
        const missingEmailData = await missingEmailRes.json().catch(() => ({}));
        if (!isLatest()) return;
        if (missingEmailRes.ok && typeof missingEmailData?.count === "number") {
          setClientiMissingEmailCount(missingEmailData.count);
        } else {
          setClientiMissingEmailCount(0);
        }
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setClientiMissingEmailCount(0);
      }

      try {
        const res = await fetch("/api/interventi/da-chiudere", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!isLatest()) return;
        const count = res.ok && Array.isArray(data) ? data.length : 0;
        setInterventiDaChiudereSummary({ count, overdue: count });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setInterventiDaChiudereSummary({ count: 0, overdue: 0 });
      }

      try {
        const [res, overdueRes] = await Promise.all([
          fetch("/api/interventi/entro-7-giorni", {
            signal: controller.signal,
            credentials: "include",
          }),
          fetch("/api/interventi/entro-7-giorni?overdue=1", {
            signal: controller.signal,
            credentials: "include",
          }),
        ]);
        const data = await res.json().catch(() => []);
        const overdueData = await overdueRes.json().catch(() => []);
        if (!isLatest()) return;
        setInterventiEntro7Summary({
          count: res.ok && Array.isArray(data) ? data.length : 0,
          overdue: overdueRes.ok && Array.isArray(overdueData) ? overdueData.length : 0,
        });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setInterventiEntro7Summary({ count: 0, overdue: 0 });
      }

      try {
        const res = await fetch("/api/fatture/da-emettere", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!isLatest()) return;
        setFattureDaEmettereCount(res.ok && Array.isArray(data) ? data.length : 0);
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setFattureDaEmettereCount(0);
      }

      try {
        const res = await fetch("/api/noleggi/attivi", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!isLatest()) return;
        setNoleggiAttiviCount(res.ok && Array.isArray(data) ? data.length : 0);
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setNoleggiAttiviCount(0);
      }

      try {
        const [res, overdueRes] = await Promise.all([
          fetch("/api/consegne/entro-7-giorni", {
            signal: controller.signal,
            credentials: "include",
          }),
          fetch("/api/consegne/entro-7-giorni?overdue=1", {
            signal: controller.signal,
            credentials: "include",
          }),
        ]);
        const data = await res.json().catch(() => []);
        const overdueData = await overdueRes.json().catch(() => []);
        if (!isLatest()) return;
        setConsegneEntro7Summary({
          count: res.ok && Array.isArray(data) ? data.length : 0,
          overdue: overdueRes.ok && Array.isArray(overdueData) ? overdueData.length : 0,
        });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setConsegneEntro7Summary({ count: 0, overdue: 0 });
      }

      try {
        const [res, overdueRes] = await Promise.all([
          fetch("/api/noleggi/smontaggi-entro-7-giorni", {
            signal: controller.signal,
            credentials: "include",
          }),
          fetch("/api/noleggi/smontaggi-entro-7-giorni?overdue=1", {
            signal: controller.signal,
            credentials: "include",
          }),
        ]);
        const data = await res.json().catch(() => []);
        const overdueData = await overdueRes.json().catch(() => []);
        if (!isLatest()) return;
        setSmontaggiEntro7Summary({
          count: res.ok && Array.isArray(data) ? data.length : 0,
          overdue: overdueRes.ok && Array.isArray(overdueData) ? overdueData.length : 0,
        });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setSmontaggiEntro7Summary({ count: 0, overdue: 0 });
      }

      try {
        const res = await fetch("/api/cockpit/documenti-alert-summary", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!isLatest()) return;
        if (res.ok) {
          setDocumentiAlertSummary({
            scaduti_totale: Number(data?.scaduti_totale || 0),
            in_scadenza_totale: Number(data?.in_scadenza_totale || 0),
            personale_scaduti: Number(data?.personale_scaduti || 0),
            personale_in_scadenza: Number(data?.personale_in_scadenza || 0),
            aziende_scaduti: Number(data?.aziende_scaduti || 0),
            aziende_in_scadenza: Number(data?.aziende_in_scadenza || 0),
          });
        } else {
          setDocumentiAlertSummary(EMPTY_DOCUMENTI_ALERT_SUMMARY);
        }
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setDocumentiAlertSummary(EMPTY_DOCUMENTI_ALERT_SUMMARY);
      }

      try {
        let simRes = await dbFrom("sim_cards")
          .select("checklist_id,numero_telefono,data_scadenza,attiva")
          .eq("attiva", true);
        if (simRes.error) {
          simRes = await dbFrom("sim_cards")
            .select("data_scadenza,attiva")
            .eq("attiva", true);
        }
        if (!isLatest()) return;
        if (simRes.error) {
          setSimScadenzeByPeriod({
            7: { count: 0, overdue: 0 },
            15: { count: 0, overdue: 0 },
            30: { count: 0, overdue: 0 },
          });
          setSimSearchByChecklistId({});
        } else {
          const nextSimSearchByChecklistId: Record<string, string[]> = {};
          const simRows = (((simRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => {
            const checklistId = String(row.checklist_id || "").trim();
            const numeroTelefono = String(row.numero_telefono || "").trim();
            if (checklistId && numeroTelefono) {
              if (!nextSimSearchByChecklistId[checklistId]) nextSimSearchByChecklistId[checklistId] = [];
              nextSimSearchByChecklistId[checklistId].push(numeroTelefono);
            }
            return {
              data_scadenza: row.data_scadenza == null ? null : String(row.data_scadenza),
              attiva: row.attiva !== false,
            };
          });
          setSimScadenzeByPeriod(buildSimScadenzeSummary(simRows));
          setSimSearchByChecklistId(nextSimSearchByChecklistId);
        }
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        if (!isLatest()) return;
        setSimScadenzeByPeriod({
          7: { count: 0, overdue: 0 },
          15: { count: 0, overdue: 0 },
          30: { count: 0, overdue: 0 },
        });
        setSimSearchByChecklistId({});
      }

      let opRes: Response;
      try {
        opRes = await fetch("/api/operatori", { signal: controller.signal });
      } catch (e: any) {
        if (e?.name === "AbortError" || controller.signal.aborted) return;
        throw new Error("Errore caricamento operatori");
      }
      if (!isLatest()) return;
      if (opRes.ok) {
        const opData = await opRes.json().catch(() => ({}));
        const list = Array.isArray(opData?.data) ? opData.data : [];
        const nextMap = new Map<string, { nome: string | null; email: string | null }>();
        for (const row of list) {
          const id = String(row?.id || "");
          if (!id) continue;
          nextMap.set(id, {
            nome: row?.nome ?? null,
            email: row?.email ?? null,
          });
        }
        setOperatoriLookupById(nextMap);
      }

    } catch (e: any) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      if (!isLatest()) return;
      const message = String(e?.message || "Errore caricamento dashboard");
      console.error("Errore caricamento dashboard", e);
      setDashboardLoadError(message);
      setInterventiDaChiudereSummary({ count: 0, overdue: 0 });
      setInterventiEntro7Summary({ count: 0, overdue: 0 });
      setFattureDaEmettereCount(0);
      setNoleggiAttiviCount(0);
      setConsegneEntro7Summary({ count: 0, overdue: 0 });
      setSmontaggiEntro7Summary({ count: 0, overdue: 0 });
      setDocumentiAlertSummary(EMPTY_DOCUMENTI_ALERT_SUMMARY);
      setSimScadenzeByPeriod({
        7: { count: 0, overdue: 0 },
        15: { count: 0, overdue: 0 },
        30: { count: 0, overdue: 0 },
      });
      setClientiMissingEmailCount(0);
    } finally {
      if (!isLatest()) return;
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (loadAbortRef.current) loadAbortRef.current.abort();
    };
  }, []);

  const closeAddIntervento = (_reason?: string) => {
    setAddInterventoOpen(false);
  };

  const closeAddAttivita = (_reason?: string) => {
    setAddAttivitaOpen(false);
  };

  useEffect(() => {
    if (!addInterventoCliente) {
      setAddInterventoChecklistId("");
      setAddInterventoReferentiCliente([]);
      return;
    }
    const first = items.find((c) => c.cliente === addInterventoCliente);
    if (first?.id) setAddInterventoChecklistId(first.id);
  }, [addInterventoCliente, items]);

  useEffect(() => {
    const clienteId =
      String(selectedInterventoChecklist?.cliente_id || "").trim() ||
      String(items.find((item) => item.cliente === addInterventoCliente)?.cliente_id || "").trim();
    if (!clienteId) {
      setAddInterventoReferentiCliente([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/clienti/${encodeURIComponent(clienteId)}/referenti`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || json?.ok === false) {
          setAddInterventoReferentiCliente([]);
          return;
        }
        setAddInterventoReferentiCliente(((json?.referenti || []) as DashboardClienteReferente[]).slice());
      } catch {
        if (!active) return;
        setAddInterventoReferentiCliente([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [addInterventoCliente, items, selectedInterventoChecklist]);

  useEffect(() => {
    if (selectedInterventoChecklist?.impianto_indirizzo && !addInterventoTouched.indirizzo) {
      setAddInterventoIndirizzo(String(selectedInterventoChecklist.impianto_indirizzo || ""));
    }
    if (!addInterventoTouched.referenteArtTechNome) {
      setAddInterventoReferenteArtTechNome(String(getCurrentOperatoreDisplayName() || ""));
    }
  }, [
    selectedInterventoChecklist,
    addInterventoTouched.indirizzo,
    addInterventoTouched.referenteArtTechNome,
    currentOperatoreId,
    currentOperatoreLabel,
    operatoriLookupById,
  ]);

  useEffect(() => {
    const firstReferente =
      addInterventoReferentiCliente.find((item) => item.attivo !== false) || addInterventoReferentiCliente[0];
    if (!firstReferente) return;
    if (!addInterventoTouched.referenteClienteNome) {
      setAddInterventoReferenteClienteNome(String(firstReferente.nome || ""));
    }
    if (!addInterventoTouched.referenteClienteContatto) {
      setAddInterventoReferenteClienteContatto(
        String(firstReferente.telefono || firstReferente.email || "").trim()
      );
    }
  }, [
    addInterventoReferentiCliente,
    addInterventoTouched.referenteClienteNome,
    addInterventoTouched.referenteClienteContatto,
  ]);

  function addQuickInterventoFilesToDraft() {
    if (addInterventoAttachmentFiles.length === 0) {
      setAddInterventoError("Seleziona almeno un file da allegare.");
      return;
    }
    setAddInterventoError(null);
    setAddInterventoAttachmentDrafts((prev) => [
      ...prev,
      ...addInterventoAttachmentFiles.map((file) => ({
        id: makeQuickAttachmentDraftId(),
        kind: "UPLOAD" as const,
        title: file.name,
        documentType: addInterventoAttachmentDocumentType,
        file,
      })),
    ]);
    setAddInterventoAttachmentFiles([]);
    setAddInterventoAttachmentInputKey((prev) => prev + 1);
  }

  function addQuickInterventoLinkToDraft() {
    const url = addInterventoAttachmentLinkUrl.trim();
    const title = addInterventoAttachmentLinkTitle.trim() || url;
    if (!isQuickAttachmentHttpUrl(url)) {
      setAddInterventoError("Inserisci un link Drive valido in formato http(s).");
      return;
    }
    setAddInterventoError(null);
    setAddInterventoAttachmentDrafts((prev) => [
      ...prev,
      {
        id: makeQuickAttachmentDraftId(),
        kind: "LINK",
        title,
        documentType: addInterventoAttachmentDocumentType,
        url,
        provider: detectQuickAttachmentProvider(url),
      },
    ]);
    setAddInterventoAttachmentLinkTitle("");
    setAddInterventoAttachmentLinkUrl("");
  }

  function removeQuickInterventoDraftAttachment(draftId: string) {
    setAddInterventoAttachmentDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
  }

  async function persistQuickInterventoDraftAttachments(entityId: string) {
    for (const draft of addInterventoAttachmentDrafts) {
      if (draft.kind === "UPLOAD") {
        const safeName = draft.file.name.replace(/\s+/g, "_");
        const path = `intervento/${entityId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await storageUpload(path, draft.file);
        if (uploadError) {
          throw new Error(`Errore upload allegato ${draft.file.name}: ${uploadError.message}`);
        }

        const res = await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            source: "UPLOAD",
            entity_type: "INTERVENTO",
            entity_id: entityId,
            title: draft.title,
            document_type: draft.documentType,
            storage_path: path,
            mime_type: draft.file.type || null,
            size_bytes: draft.file.size,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(data?.error || `Errore salvataggio allegato ${draft.title}`));
        }
        continue;
      }

      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "LINK",
          entity_type: "INTERVENTO",
          entity_id: entityId,
          title: draft.title,
          document_type: draft.documentType,
          url: draft.url,
          provider: draft.provider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || `Errore salvataggio link ${draft.title}`));
      }
    }
  }

  async function submitQuickIntervento() {
    if (!addInterventoCliente || !addInterventoChecklistId) {
      setAddInterventoError("Seleziona cliente e progetto.");
      return;
    }
    const selectedChecklist = items.find((item) => item.id === addInterventoChecklistId) || null;
    if (!selectedChecklist) {
      setAddInterventoError("Progetto non trovato.");
      return;
    }

    const descrizione = addInterventoDescrizione.trim() || "Nuovo intervento";
    const today = new Date().toISOString().slice(0, 10);

    setAddInterventoSaving(true);
    setAddInterventoError(null);
    try {
      let insertedId: string | null = null;
      let attachmentWarning: string | null = null;
      const payloadBase = {
        cliente: selectedChecklist.cliente,
        checklist_id: selectedChecklist.id,
        data: today,
        data_tassativa: null,
        descrizione,
        tipo: descrizione,
        incluso: false,
        proforma: selectedChecklist.proforma || null,
        codice_magazzino: selectedChecklist.magazzino_importazione || null,
        fatturazione_stato: null,
        stato_intervento: "APERTO",
        esito_fatturazione: "DA_FATTURARE",
        note: null,
      };

      let insRes = await dbFrom("saas_interventi").insert(payloadBase).select("id").single();
      if (insRes.error && String(insRes.error.message || "").toLowerCase().includes("data_tassativa")) {
        const { data_tassativa: _skip, ...payloadNoTassativa } = payloadBase;
        insRes = await dbFrom("saas_interventi").insert(payloadNoTassativa).select("id").single();
      }
      if (insRes.error) {
        throw new Error(insRes.error.message || "Errore creazione intervento");
      }
      insertedId = String((insRes.data as { id?: string } | null)?.id || "").trim() || null;
      if (!insertedId) {
        throw new Error("Intervento creato senza id");
      }

      const operativiRes = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_operativi",
          row_kind: "INTERVENTO",
          row_ref_id: insertedId,
          data_inizio: today,
          durata_giorni: "",
          modalita_attivita: "ONSITE",
          personale_previsto: addInterventoPersonalePrevisto.trim(),
          personale_ids: [],
          mezzi: addInterventoMezzi.trim(),
          descrizione_attivita: addInterventoNoteOperative.trim() || descrizione,
          indirizzo: addInterventoIndirizzo.trim(),
          referente_cliente_nome: addInterventoReferenteClienteNome.trim(),
          referente_cliente_contatto: addInterventoReferenteClienteContatto.trim(),
          commerciale_art_tech_nome: addInterventoReferenteArtTechNome.trim(),
        }),
      });
      const operativiJson = await operativiRes.json().catch(() => ({}));
      if (!operativiRes.ok) {
        throw new Error(String(operativiJson?.error || "Intervento creato ma dati operativi non salvati"));
      }

      if (addInterventoAttachmentDrafts.length > 0) {
        try {
          await persistQuickInterventoDraftAttachments(insertedId);
        } catch (attachmentError: any) {
          attachmentWarning = String(
            attachmentError?.message || "Intervento creato ma alcuni allegati non sono stati salvati"
          );
        }
      }

      await Promise.all([load(), loadHomeCrono()]);
      setToastMsg(attachmentWarning ? `Intervento creato. ${attachmentWarning}` : "Intervento creato.");
      setAddInterventoCliente("");
      setAddInterventoChecklistId("");
      setAddInterventoDescrizione("");
      setAddInterventoPersonalePrevisto("");
      setAddInterventoMezzi("");
      setAddInterventoNoteOperative("");
      setAddInterventoIndirizzo("");
      setAddInterventoReferenteClienteNome("");
      setAddInterventoReferenteClienteContatto("");
      setAddInterventoReferenteArtTechNome("");
      setAddInterventoReferentiCliente([]);
      setAddInterventoAttachmentDocumentType("GENERICO");
      setAddInterventoAttachmentInputKey(0);
      setAddInterventoAttachmentFiles([]);
      setAddInterventoAttachmentLinkTitle("");
      setAddInterventoAttachmentLinkUrl("");
      setAddInterventoAttachmentDrafts([]);
      setAddInterventoTouched(EMPTY_QUICK_ATTIVITA_TOUCHED);
      closeAddIntervento("submit");
      router.push(`/checklists/${selectedChecklist.id}?focus=interventi`);
    } catch (err: any) {
      setAddInterventoError(String(err?.message || "Errore creazione intervento"));
    } finally {
      setAddInterventoSaving(false);
    }
  }

  useEffect(() => {
    if (!addAttivitaCliente) {
      setAddAttivitaChecklistId("");
      setAddAttivitaReferentiCliente([]);
      return;
    }
    const first = items.find((c) => c.cliente === addAttivitaCliente);
    if (first?.id) setAddAttivitaChecklistId(first.id);
  }, [addAttivitaCliente, items]);

  useEffect(() => {
    const hoursByType: Record<QuickAttivitaType, string> = {
      INSTALLAZIONE: "8",
      DISINSTALLAZIONE: "4",
      ALTRA_ATTIVITA: "2",
    };
    if (addAttivitaTouched.ore) return;
    setAddAttivitaOre(hoursByType[addAttivitaType]);
  }, [addAttivitaType, addAttivitaTouched.ore]);

  useEffect(() => {
    const clienteId =
      String(selectedAttivitaChecklist?.cliente_id || "").trim() ||
      String(items.find((item) => item.cliente === addAttivitaCliente)?.cliente_id || "").trim();
    if (!clienteId) {
      setAddAttivitaReferentiCliente([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/clienti/${encodeURIComponent(clienteId)}/referenti`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || json?.ok === false) {
          setAddAttivitaReferentiCliente([]);
          return;
        }
        setAddAttivitaReferentiCliente(((json?.referenti || []) as DashboardClienteReferente[]).slice());
      } catch {
        if (!active) return;
        setAddAttivitaReferentiCliente([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [addAttivitaCliente, items, selectedAttivitaChecklist]);

  useEffect(() => {
    if (selectedAttivitaChecklist?.impianto_indirizzo && !addAttivitaTouched.indirizzo) {
      setAddAttivitaIndirizzo(String(selectedAttivitaChecklist.impianto_indirizzo || ""));
    }
    if (!addAttivitaTouched.referenteArtTechNome) {
      setAddAttivitaReferenteArtTechNome(String(getCurrentOperatoreDisplayName() || ""));
    }
  }, [
    selectedAttivitaChecklist,
    addAttivitaTouched.indirizzo,
    addAttivitaTouched.referenteArtTechNome,
    currentOperatoreId,
    currentOperatoreLabel,
    operatoriLookupById,
  ]);

  useEffect(() => {
    const firstReferente =
      addAttivitaReferentiCliente.find((item) => item.attivo !== false) || addAttivitaReferentiCliente[0];
    if (!firstReferente) return;
    if (!addAttivitaTouched.referenteClienteNome) {
      setAddAttivitaReferenteClienteNome(String(firstReferente.nome || ""));
    }
    if (!addAttivitaTouched.referenteClienteContatto) {
      setAddAttivitaReferenteClienteContatto(
        String(firstReferente.telefono || firstReferente.email || "").trim()
      );
    }
  }, [
    addAttivitaReferentiCliente,
    addAttivitaTouched.referenteClienteNome,
    addAttivitaTouched.referenteClienteContatto,
  ]);

  function addQuickAttivitaFilesToDraft() {
    if (addAttivitaAttachmentFiles.length === 0) {
      setAddAttivitaError("Seleziona almeno un file da allegare.");
      return;
    }
    setAddAttivitaError(null);
    setAddAttivitaAttachmentDrafts((prev) => [
      ...prev,
      ...addAttivitaAttachmentFiles.map((file) => ({
        id: makeQuickAttachmentDraftId(),
        kind: "UPLOAD" as const,
        title: file.name,
        documentType: addAttivitaAttachmentDocumentType,
        file,
      })),
    ]);
    setAddAttivitaAttachmentFiles([]);
    setAddAttivitaAttachmentInputKey((prev) => prev + 1);
  }

  function addQuickAttivitaLinkToDraft() {
    const url = addAttivitaAttachmentLinkUrl.trim();
    const title = addAttivitaAttachmentLinkTitle.trim() || url;
    if (!isQuickAttachmentHttpUrl(url)) {
      setAddAttivitaError("Inserisci un link Drive valido in formato http(s).");
      return;
    }
    setAddAttivitaError(null);
    setAddAttivitaAttachmentDrafts((prev) => [
      ...prev,
      {
        id: makeQuickAttachmentDraftId(),
        kind: "LINK",
        title,
        documentType: addAttivitaAttachmentDocumentType,
        url,
        provider: detectQuickAttachmentProvider(url),
      },
    ]);
    setAddAttivitaAttachmentLinkTitle("");
    setAddAttivitaAttachmentLinkUrl("");
  }

  function removeQuickAttivitaDraftAttachment(draftId: string) {
    setAddAttivitaAttachmentDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
  }

  async function persistQuickAttivitaDraftAttachments(entityId: string) {
    for (const draft of addAttivitaAttachmentDrafts) {
      if (draft.kind === "UPLOAD") {
        const safeName = draft.file.name.replace(/\s+/g, "_");
        const path = `intervento/${entityId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await storageUpload(path, draft.file);
        if (uploadError) {
          throw new Error(`Errore upload allegato ${draft.file.name}: ${uploadError.message}`);
        }

        const res = await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            source: "UPLOAD",
            entity_type: "INTERVENTO",
            entity_id: entityId,
            title: draft.title,
            document_type: draft.documentType,
            storage_path: path,
            mime_type: draft.file.type || null,
            size_bytes: draft.file.size,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(data?.error || `Errore salvataggio allegato ${draft.title}`));
        }
        continue;
      }

      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "LINK",
          entity_type: "INTERVENTO",
          entity_id: entityId,
          title: draft.title,
          document_type: draft.documentType,
          url: draft.url,
          provider: draft.provider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || `Errore salvataggio link ${draft.title}`));
      }
    }
  }

  async function submitQuickAttivita() {
    if (!addAttivitaCliente || !addAttivitaChecklistId) {
      setAddAttivitaError("Seleziona cliente e progetto.");
      return;
    }
    if (!addAttivitaData) {
      setAddAttivitaError("Seleziona la data attività.");
      return;
    }
    if (!addAttivitaOre.trim()) {
      setAddAttivitaError("Inserisci le ore previste.");
      return;
    }
    if (!Number.isFinite(Number(addAttivitaOre.replace(",", "."))) || Number(addAttivitaOre.replace(",", ".")) <= 0) {
      setAddAttivitaError("Ore previste non valide.");
      return;
    }
    const selectedChecklist = items.find((item) => item.id === addAttivitaChecklistId) || null;
    if (!selectedChecklist) {
      setAddAttivitaError("Progetto non trovato.");
      return;
    }

    const selectedType = QUICK_ATTIVITA_OPTIONS.find((option) => option.value === addAttivitaType);
    const label = selectedType?.label || "Attività operativa";
    const tipo = selectedType?.tipo || "ATTIVITA_OPERATIVA";
    const descrizione = addAttivitaDescrizione.trim() || label;

    setAddAttivitaSaving(true);
    setAddAttivitaError(null);
    try {
      let insertedId: string | null = null;
      let attachmentWarning: string | null = null;
      const payloadBase = {
        cliente: selectedChecklist.cliente,
        checklist_id: selectedChecklist.id,
        data: addAttivitaData,
        data_tassativa: addAttivitaData,
        descrizione,
        tipo,
        incluso: false,
        proforma: selectedChecklist.proforma || null,
        codice_magazzino: selectedChecklist.magazzino_importazione || null,
        fatturazione_stato: null,
        stato_intervento: "APERTO",
        esito_fatturazione: "NON_FATTURARE",
        note: null,
      };

      let insRes = await dbFrom("saas_interventi").insert(payloadBase).select("id").single();
      if (insRes.error && String(insRes.error.message || "").toLowerCase().includes("data_tassativa")) {
        const { data_tassativa: _skip, ...payloadNoTassativa } = payloadBase;
        insRes = await dbFrom("saas_interventi").insert(payloadNoTassativa).select("id").single();
      }
      if (insRes.error) {
        throw new Error(insRes.error.message || "Errore creazione attività");
      }
      insertedId = String((insRes.data as { id?: string } | null)?.id || "").trim() || null;
      if (!insertedId) {
        throw new Error("Attività creata senza id");
      }

      const operativiRes = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_operativi",
          row_kind: "INTERVENTO",
          row_ref_id: insertedId,
          data_inizio: addAttivitaData,
          durata_giorni: addAttivitaOre.replace(",", "."),
          modalita_attivita: "ONSITE",
          personale_previsto: addAttivitaPersonalePrevisto.trim(),
          personale_ids: [],
          mezzi: addAttivitaMezzi.trim(),
          descrizione_attivita: addAttivitaNoteOperative.trim() || descrizione,
          indirizzo: addAttivitaIndirizzo.trim(),
          referente_cliente_nome: addAttivitaReferenteClienteNome.trim(),
          referente_cliente_contatto: addAttivitaReferenteClienteContatto.trim(),
          commerciale_art_tech_nome: addAttivitaReferenteArtTechNome.trim(),
        }),
      });
      const operativiJson = await operativiRes.json().catch(() => ({}));
      if (!operativiRes.ok) {
        throw new Error(String(operativiJson?.error || "Attività creata ma dati operativi non salvati"));
      }

      if (addAttivitaAttachmentDrafts.length > 0) {
        try {
          await persistQuickAttivitaDraftAttachments(insertedId);
        } catch (attachmentError: any) {
          attachmentWarning = String(
            attachmentError?.message || "Attività creata ma alcuni allegati non sono stati salvati"
          );
        }
      }

      await Promise.all([load(), loadHomeCrono()]);
      setToastMsg(attachmentWarning ? `${label} creata. ${attachmentWarning}` : `${label} creata.`);
      setAddAttivitaType("INSTALLAZIONE");
      setAddAttivitaCliente("");
      setAddAttivitaChecklistId("");
      setAddAttivitaData("");
      setAddAttivitaOre("8");
      setAddAttivitaDescrizione("");
      setAddAttivitaPersonalePrevisto("");
      setAddAttivitaMezzi("");
      setAddAttivitaNoteOperative("");
      setAddAttivitaIndirizzo("");
      setAddAttivitaReferenteClienteNome("");
      setAddAttivitaReferenteClienteContatto("");
      setAddAttivitaReferenteArtTechNome("");
      setAddAttivitaReferentiCliente([]);
      setAddAttivitaAttachmentDocumentType("GENERICO");
      setAddAttivitaAttachmentInputKey(0);
      setAddAttivitaAttachmentFiles([]);
      setAddAttivitaAttachmentLinkTitle("");
      setAddAttivitaAttachmentLinkUrl("");
      setAddAttivitaAttachmentDrafts([]);
      setAddAttivitaTouched(EMPTY_QUICK_ATTIVITA_TOUCHED);
      closeAddAttivita("submit");
    } catch (err: any) {
      setAddAttivitaError(String(err?.message || "Errore creazione attività"));
    } finally {
      setAddAttivitaSaving(false);
    }
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { codice: "", descrizione: "", qty: "", note: "", search: "" },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, key: keyof ChecklistItem, value: string) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  }

  function updateRowFields(idx: number, patch: Partial<ChecklistItem>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  async function onCreate() {
    try {
    if (!canCreate) {
      alert("Compila almeno Cliente e Nome PROGETTO.");
      return;
    }

    let operatoreForSave: { id: string; displayName: string | null } | null = null;
    try {
      operatoreForSave = await resolveOperatoreForSave();
    } catch (err: any) {
      alert(err?.message || "Operatore non associato");
      return;
    }

    // 1) Insert testata checklist e prendiamo l'id creato
    const payloadChecklist = {
      cliente: cliente.trim(),
      nome_checklist: nomeChecklist.trim(),
      proforma: proforma.trim() ? proforma.trim() : null,
      magazzino_importazione: magazzinoImportazione.trim()
        ? magazzinoImportazione.trim()
        : null,
      created_by_operatore: operatoreForSave.id,
      updated_by_operatore: operatoreForSave.id,
      created_by: operatoreForSave.displayName,
      updated_by: operatoreForSave.displayName,
      saas_piano: saasPiano || null,
      saas_scadenza: saasScadenza.trim() ? saasScadenza.trim() : null,
      saas_note: saasNote.trim() ? saasNote.trim() : null,
      saas_tipo: null,
      tipo_saas: null,
      data_prevista: dataPrevista.trim() ? dataPrevista.trim() : null,
      data_tassativa: dataTassativa.trim() ? dataTassativa.trim() : null,
      stato_progetto: statoProgetto || null,
      data_installazione_reale: dataInstallazioneReale.trim()
        ? dataInstallazioneReale.trim()
        : null,
      noleggio_vendita: noleggioVendita.trim() ? noleggioVendita.trim() : null,
      tipo_struttura: tipoStruttura.trim() ? tipoStruttura.trim() : null,
      passo: passo.trim() ? passo.trim() : null,
      tipo_impianto: tipoImpianto || null,
      dimensioni: dimensioni.trim() ? dimensioni.trim() : null,
      impianto_quantita: 1,
      numero_facce: 1,
      m2_calcolati: calcM2(dimensioni.trim() ? dimensioni.trim() : null, 1, 1),
      m2_inclusi: calcM2(dimensioni.trim() ? dimensioni.trim() : null, 1, 1),
      m2_allocati: null,
      garanzia_scadenza: garanziaScadenza.trim()
        ? garanziaScadenza.trim()
        : null,
    };

    const { data: created, error: errCreate } = await dbFrom("checklists")
      .insert(payloadChecklist)
      .select("id")
      .single();

    if (errCreate) {
      if (isChecklistDuplicateError(errCreate)) {
        alert("Esiste gia' un progetto con questo cliente e questo nome checklist.");
        return;
      }
      const info = logSupabaseError(errCreate);
      alert("Errore insert PROGETTO: " + (info || errCreate.message));
      return;
    }
    if (!created?.id) {
      alert("Errore: id PROGETTO non ricevuto");
      return;
    }

    const checklistId = created.id as string;

    {
      const res = await fetch("/api/checklists/materialize-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ checklist_id: checklistId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Errore materializzazione checklist_tasks");
      }
    }

    // 2A) Auto-seed checklist template -> checklist_checks
    const { data: tmpl, error: tmplErr } = await dbFrom("checklist_template_items")
      .select("sezione, voce")
      .eq("attivo", true)
      .order("sezione", { ascending: true })
      .order("ordine", { ascending: true })
      .order("voce", { ascending: true });

    if (tmplErr) {
      const info = logSupabaseError(tmplErr);
      console.error("ERRORE LOAD progetto_template_items", tmplErr);
      alert("Errore seed template PROGETTO: " + (info || tmplErr.message));
    } else if (tmpl && tmpl.length > 0) {
      const payloadChecks = (tmpl as any[]).map((r) => ({
        checklist_id: checklistId,
        sezione: r.sezione,
        voce: r.voce,
        stato: "DA FARE",
        note: null,
      }));

      const { error: seedErr } = await dbFrom("checklist_checks")
        .insert(payloadChecks);

      if (seedErr) {
        const info = logSupabaseError(seedErr);
        console.error("ERRORE INSERT progetto_checks", seedErr);
        alert("Errore seed template PROGETTO: " + (info || seedErr.message));
      }
    }

    // NOTE: `checklist_items` must have a `checklist_id` uuid column referencing `checklists.id`.

    // 2) Filtra righe non vuote
    const normalizedRows = rows
      .map((r) => ({
        codice: normalizeCustomCode(r.codice.trim()),
        descrizione: r.descrizione.trim(),
        descrizione_custom: (r.descrizione_custom ?? "").trim(),
        qty: r.qty.trim(),
        note: r.note.trim(),
      }))
      .filter((r) => r.codice || r.descrizione || r.qty || r.note);

    // 3) Validazione minima sulle qty (se presente deve essere numero)
    for (const r of normalizedRows) {
      if (r.qty !== "" && !isFiniteNumberString(r.qty)) {
        alert(`Qty non valida (deve essere numero): "${r.qty}"`);
        return;
      }
      if (isCustomCode(r.codice) && r.descrizione_custom === "") {
        alert("Inserisci la descrizione per la voce fuori catalogo.");
        return;
      }
    }

    // 4) Insert righe su checklist_items (se ce ne sono)
    if (normalizedRows.length > 0) {
      // IMPORTANT: DB columns must match these keys.
      // Expected columns in `checklist_items`:
      // - checklist_id (uuid)
      // - codice (text)
      // - descrizione (text)
      // - quantita (numeric)
      // - note (text)
      const payloadItems = normalizedRows.map((r) => ({
        checklist_id: checklistId,
        codice: r.codice ? r.codice : null,
        descrizione:
          isCustomCode(r.codice)
            ? r.descrizione_custom || null
            : r.descrizione
            ? r.descrizione
            : null,
        quantita: r.qty === "" ? null : Number(r.qty),
        note: r.note ? r.note : null,
      }));

      const { error: errItems } = await dbFrom("checklist_items")
        .insert(payloadItems);

      if (errItems) {
        const info = logSupabaseError(errItems);
        console.error("ERRORE INSERT progetto_items", errItems);
        alert(
          "Errore insert righe: " +
            (info || errItems.message || "") +
            ((errItems as any)?.details ? `\nDettagli: ${(errItems as any).details}` : "") +
            ((errItems as any)?.hint ? `\nHint: ${(errItems as any).hint}` : "")
        );
        return;
      }
    }

    // reset form
    setCliente("");
    setNomeChecklist("");
    setProforma("");
    setMagazzinoImportazione("");
    setSaasPiano("");
    setSaasScadenza("");
    setSaasNote("");
    setDataPrevista("");
    setDataTassativa("");
    setStatoProgetto("IN_CORSO");
    setDataInstallazioneReale("");
    setNoleggioVendita("");
    setTipoStruttura("");
    setTipoImpianto("");
    setPasso("");
    setDimensioni("");
    setGaranziaScadenza("");
    setUltraScope("CLIENTE");
    setUltraInclusi("");
    setRows([{ codice: "", descrizione: "", qty: "", note: "", search: "" }]);
    setShowForm(false);

    await load();
    } catch (err: any) {
      const info = logSupabaseError(err);
      alert("Errore: " + (info || err?.message || String(err)));
    }
  }

  async function backupAndDeleteChecklist(checklistId: string) {
    const ok = window.confirm("Eliminare questo PROGETTO? Verrà salvato in backup per 30 giorni.");
    if (!ok) return;

    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    const res = await fetch(`/api/checklists/delete-with-backup${debug ? "?debug=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist_id: checklistId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert("Errore eliminazione PROGETTO: " + (data?.error || "Operazione fallita"));
      return;
    }
    if (debug) {
      console.log("[delete-with-backup] auth_mode:", data?.auth_mode || data?.debug?.auth_mode);
    }

    await load();
  }

  const navButtonStyle = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    cursor: "pointer",
    background: "#fff",
    textDecoration: "none",
    color: "inherit",
    fontWeight: 700,
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
  } as const;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0, minWidth: 190 }}>
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>{pageTitle}</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>{pageSubtitle}</div>
        </div>

        {showDebugAuth && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px dashed #ef4444",
              fontSize: 12,
              background: "#fff7ed",
              color: "#7c2d12",
              maxWidth: 380,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>DEBUG AUTH</div>
            <div>href: {debugLocation || "—"}</div>
            <div>cookie sb-*: {debugCookieHasSb === null ? "—" : String(debugCookieHasSb)}</div>
            <div>
              localStorage keys: {debugLocalKeys.length ? debugLocalKeys.join(", ") : "—"}
            </div>
            <div>
              session:{" "}
              {debugSessionLoading ? "loading" : debugSessionEmail ? debugSessionEmail : "—"}
            </div>
            <div>operatore: {currentOperatoreId || "—"}</div>
          </div>
        )}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link
              href="/checklists/nuova"
              style={navButtonStyle}
            >
              + Nuovo PROGETTO
            </Link>
            <button
              type="button"
              onClick={() => {
                setAddInterventoError(null);
                setAddInterventoCliente("");
                setAddInterventoChecklistId("");
                setAddInterventoDescrizione("");
                setAddInterventoIndirizzo("");
                setAddInterventoReferenteClienteNome("");
                setAddInterventoReferenteClienteContatto("");
                setAddInterventoReferenteArtTechNome("");
                setAddInterventoReferentiCliente([]);
                setAddInterventoAttachmentDocumentType("GENERICO");
                setAddInterventoAttachmentInputKey(0);
                setAddInterventoAttachmentFiles([]);
                setAddInterventoAttachmentLinkTitle("");
                setAddInterventoAttachmentLinkUrl("");
                setAddInterventoAttachmentDrafts([]);
                setAddInterventoTouched(EMPTY_QUICK_ATTIVITA_TOUCHED);
                setAddInterventoOpen(true);
              }}
              style={navButtonStyle}
            >
              + Aggiungi intervento
            </button>
            <button
              type="button"
              onClick={() => {
                setAddAttivitaError(null);
                setAddAttivitaType("INSTALLAZIONE");
                setAddAttivitaCliente("");
                setAddAttivitaChecklistId("");
                setAddAttivitaData("");
                setAddAttivitaOre("8");
                setAddAttivitaDescrizione("");
                setAddAttivitaIndirizzo("");
                setAddAttivitaReferenteClienteNome("");
                setAddAttivitaReferenteClienteContatto("");
                setAddAttivitaReferenteArtTechNome("");
                setAddAttivitaReferentiCliente([]);
                setAddAttivitaAttachmentDocumentType("GENERICO");
                setAddAttivitaAttachmentInputKey(0);
                setAddAttivitaAttachmentFiles([]);
                setAddAttivitaAttachmentLinkTitle("");
                setAddAttivitaAttachmentLinkUrl("");
                setAddAttivitaAttachmentDrafts([]);
                setAddAttivitaTouched(EMPTY_QUICK_ATTIVITA_TOUCHED);
                setAddAttivitaOpen(true);
              }}
              style={navButtonStyle}
            >
              + Aggiungi attività
            </button>
          </div>
        </div>
      </div>

      {/* Nuova checklist spostata su /checklists/nuova */}

      {!showForm && (
        <div style={{ marginTop: 20, paddingBottom: 20 }}>
          {dashboardLoadError && (
            <div style={{ marginBottom: 10, fontSize: 13, color: "#b91c1c" }}>
              {dashboardLoadError}
            </div>
          )}
          {showCockpitSection ? (
            <div
              className="dashboard-cockpit-frame"
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #f59e0b",
                background: "#fffbeb",
                color: "#92400e",
              }}
            >
              <div className="dashboard-cockpit-inner" style={{ display: "grid", gap: 12 }}>
              <div
                className="dashboard-cockpit-primary-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(420px, 2.4fr) repeat(3, minmax(150px, 1fr))",
                  gap: 12,
                  alignItems: "stretch",
                }}
              >
                <div
                  className="dashboard-cockpit-card dashboard-scadenze-card"
                  style={{
                    minHeight: cockpitCardHeight,
                    height: cockpitCardHeight,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #fcd34d",
                    background: "rgba(255,255,255,0.62)",
                    color: "inherit",
                    overflow: "hidden",
                  }}
                >
                  <div
                    className="dashboard-scadenze-shell grid h-full grid-rows-[auto_1fr] gap-2"
                  >
                      <div
                        className="dashboard-scadenze-header flex items-center justify-between gap-2"
                      >
                      <Link
                        href={buildScadenzeLink(scadenzePeriodDays)}
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.2,
                          color: "#92400e",
                          textDecoration: "none",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        SCADENZE IN ARRIVO
                      </Link>
                      <div
                        className="dashboard-scadenze-range inline-flex shrink-0 gap-1 rounded-full border border-[#fcd34d] bg-[rgba(255,255,255,0.8)] p-[2px]"
                      >
                        {([7, 15, 30] as const).map((days) => {
                          const active = scadenzePeriodDays === days;
                          return (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setScadenzePeriodDays(days)}
                              style={{
                                border: "none",
                                borderRadius: 999,
                                padding: "3px 8px",
                                background: active ? "#f59e0b" : "transparent",
                                color: active ? "white" : "#92400e",
                                fontWeight: 800,
                                fontSize: 11,
                                lineHeight: 1.1,
                                cursor: "pointer",
                              }}
                            >
                              {days} giorni
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className="dashboard-scadenze-body grid min-h-0 grid-cols-[minmax(150px,168px)_minmax(0,1fr)] items-start gap-x-4 gap-y-2"
                    >
                      <div
                        className="dashboard-scadenze-total flex min-w-0 flex-col items-center justify-center gap-1 text-center"
                      >
                        <div
                          style={{
                            fontSize: 30,
                            lineHeight: 1,
                            fontWeight: 900,
                          }}
                        >
                          {selectedScadenzeSummary.count}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          Totale entro {scadenzePeriodDays} giorni
                        </div>
                        <div style={shortcutCardBadgeStyle}>
                          (Scadute non gestite: {selectedScadenzeSummary.overdueCount})
                        </div>
                      </div>
                      <div
                        className="dashboard-scadenze-breakdown grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 pt-1 text-[13px] font-bold"
                      >
                        <div style={{ whiteSpace: "nowrap" }}>Garanzie: {selectedScadenzeSummary.breakdown.garanzie}</div>
                        <div style={{ whiteSpace: "nowrap" }}>Licenze: {selectedScadenzeSummary.breakdown.licenze}</div>
                        <div style={{ whiteSpace: "nowrap" }}>Tagliandi: {selectedScadenzeSummary.breakdown.tagliandi}</div>
                        <div style={{ whiteSpace: "nowrap" }}>SaaS: {selectedScadenzeSummary.breakdown.saasAltro}</div>
                      </div>
                    </div>
                  </div>
                </div>
                {renderCockpitMetricCard(
                  "/admin/fatture-da-emettere",
                  "FATTURE DA EMETTERE",
                  fattureDaEmettereCount
                )}
                {renderCockpitMetricCard(
                  `/scadenze`,
                  "SIM IN SCADENZA",
                  selectedSimScadenzeSummary.count,
                  "Scadute",
                  selectedSimScadenzeSummary.overdue
                )}
                {renderDocumentiAlertCockpitCard()}
              </div>
              <div
                className="dashboard-cockpit-kpi-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "stretch",
                }}
              >
                {renderCockpitMetricCard(
                  "/admin/interventi-da-chiudere",
                  "INTERVENTI DA CHIUDERE",
                  interventiDaChiudereSummary.count,
                  "In ritardo",
                  interventiDaChiudereSummary.overdue
                )}
                {renderCockpitMetricCard(
                  "/admin/interventi-entro-7-giorni",
                  "INTERVENTI ENTRO 7 GIORNI",
                  interventiEntro7Summary.count,
                  "Scaduti",
                  interventiEntro7Summary.overdue
                )}
                {renderCockpitMetricCard(
                  "/cronoprogramma?filter=7gg_scadute",
                  "ATTIVITÀ ENTRO 7 GG",
                  attivitaEntro7Summary.count,
                  "Scadute",
                  attivitaEntro7Summary.overdue,
                  true
                )}
                {renderCockpitMetricCard(
                  "/admin/smontaggi-noleggi-entro-7-giorni",
                  "SMONTAGGI NOLEGGI ENTRO 7 GIORNI",
                  smontaggiEntro7Summary.count,
                  "Scaduti",
                  smontaggiEntro7Summary.overdue
                )}
                {renderCockpitMetricCard(
                  "/admin/noleggi-attivi",
                  "NOLEGGI ATTIVI",
                  noleggiAttiviCount
                )}
              </div>
              </div>
            </div>
          ) : null}
          {showProjectsSection ? (
            <div style={{ marginTop: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Tutti i progetti
                </h2>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {dashboardProjectRows.length} progetti
                </div>
                {projectsView === "compact" ? (
                  <Link
                    href="/dashboard-estesa"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#1d4ed8",
                      textDecoration: "none",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Apri dashboard estesa
                  </Link>
                ) : null}
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "#e5e7eb",
                  }}
                />
              </div>
              {enableProjectFilters ? (
                <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <input
                      value={dashboardProjectSearch}
                      onChange={(e) => setDashboardProjectSearch(e.target.value)}
                      placeholder="Cerca cliente, progetto, proforma, PO, impianto, numero SIM"
                      style={{
                        flex: "1 1 300px",
                        minWidth: 0,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "white",
                      }}
                    />
                    <select
                      value={dashboardProjectStatusFilter}
                      onChange={(e) => setDashboardProjectStatusFilter(e.target.value)}
                      style={{
                        flex: "0 1 220px",
                        minWidth: 0,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "white",
                      }}
                    >
                      <option value="TUTTI">Tutti gli stati</option>
                      {dashboardProjectStatusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {[
                      { value: "TUTTI", label: "Tutti" },
                      { value: "CRITICI", label: "Critici" },
                      { value: "IMMINENTI", label: "Imminenti" },
                      { value: "SCADUTI", label: "Scaduti" },
                    ].map((option) => {
                      const active = dashboardProjectQuickFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setDashboardProjectQuickFilter(
                              option.value as typeof dashboardProjectQuickFilter
                            )
                          }
                          style={{
                            border: "1px solid #cbd5e1",
                            background: active ? "#dbeafe" : "#fff",
                            color: active ? "#1d4ed8" : "#334155",
                            borderRadius: 999,
                            padding: "7px 11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {filteredDashboardProjectRows.length} risultati
                    </span>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 10 }}>
                {filteredDashboardProjectRows.length === 0 ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#64748b",
                      fontSize: 14,
                    }}
                  >
                    Nessun progetto trovato con i filtri correnti
                  </div>
                ) : null}
                {projectsView === "extended" ? (
                  <div
                    style={{
                      overflowX: "auto",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "white",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Cliente", "Progetto", "Proforma", "PO", "Data chiave", "Stato", "Criticita", "Azioni"].map((label) => (
                            <th
                              key={label}
                              style={{
                                padding: "12px 14px",
                                borderBottom: "1px solid #e2e8f0",
                                textAlign: label === "Azioni" ? "right" : "left",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#475569",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDashboardProjectRows.map((item) => {
                          const projectStatus = getProjectStatusBadge(item.stato_progetto);
                          const keyDate = item.data_tassativa || item.data_prevista;
                          return (
                            <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "12px 14px", verticalAlign: "top", fontSize: 14, color: "#334155" }}>
                                {item.cliente || "—"}
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                                  {item.nome_checklist || "—"}
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                  {item.tipo_impianto ? (
                                    <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                                      {item.tipo_impianto}
                                    </span>
                                  ) : null}
                                  {item.impianto_codice ? (
                                    <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                                      {item.impianto_codice}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top", fontSize: 14, color: "#334155" }}>
                                {item.proforma || "—"}
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top", fontSize: 14, color: "#334155" }}>
                                {item.po || "—"}
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top", fontSize: 14, color: "#334155", whiteSpace: "nowrap" }}>
                                {keyDate ? new Date(keyDate).toLocaleDateString("it-IT") : "—"}
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                                <span
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    border: `1px solid ${projectStatus.border}`,
                                    background: projectStatus.background,
                                    color: projectStatus.color,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {projectStatus.label}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {item.deadlineFlags.licenza === "SCADUTA" ? (
                                    <span style={{ padding: "4px 8px", borderRadius: 999, background: DASHBOARD_BADGE_COLORS.statusExpired.background, border: `1px solid ${DASHBOARD_BADGE_COLORS.statusExpired.border}`, color: DASHBOARD_BADGE_COLORS.statusExpired.color, fontWeight: 800, fontSize: 12 }}>
                                      Lic scad.
                                    </span>
                                  ) : item.deadlineFlags.licenza === "IMMINENTE" ? (
                                    <span style={{ padding: "4px 8px", borderRadius: 999, background: DASHBOARD_BADGE_COLORS.statusDueSoon.background, border: `1px solid ${DASHBOARD_BADGE_COLORS.statusDueSoon.border}`, color: DASHBOARD_BADGE_COLORS.statusDueSoon.color, fontWeight: 800, fontSize: 12 }}>
                                      Lic immin.
                                    </span>
                                  ) : null}
                                  {item.deadlineFlags.garanzia === "SCADUTA" ? (
                                    <span style={{ padding: "4px 8px", borderRadius: 999, background: DASHBOARD_BADGE_COLORS.statusExpired.background, border: `1px solid ${DASHBOARD_BADGE_COLORS.statusExpired.border}`, color: DASHBOARD_BADGE_COLORS.statusExpired.color, fontWeight: 800, fontSize: 12 }}>
                                      Gar scad.
                                    </span>
                                  ) : item.deadlineFlags.garanzia === "IMMINENTE" ? (
                                    <span style={{ padding: "4px 8px", borderRadius: 999, background: DASHBOARD_BADGE_COLORS.statusDueSoon.background, border: `1px solid ${DASHBOARD_BADGE_COLORS.statusDueSoon.border}`, color: DASHBOARD_BADGE_COLORS.statusDueSoon.color, fontWeight: 800, fontSize: 12 }}>
                                      Gar immin.
                                    </span>
                                  ) : null}
                                  {item.deadlineFlags.licenza == null && item.deadlineFlags.garanzia == null ? (
                                    <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                                  ) : null}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", verticalAlign: "top", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <Link
                                    href={`/checklists/${item.id}`}
                                    style={{
                                      padding: "8px 12px",
                                      borderRadius: 10,
                                      border: "1px solid #cbd5e1",
                                      background: "#fff",
                                      color: "#0f172a",
                                      textDecoration: "none",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Apri progetto
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => void backupAndDeleteChecklist(item.id)}
                                    style={{
                                      padding: "8px 12px",
                                      borderRadius: 10,
                                      border: "1px solid #fca5a5",
                                      background: "#fff1f2",
                                      color: "#b91c1c",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Elimina progetto
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  filteredDashboardProjectRows.map((item) => {
                    const projectPresentation = getProjectPresentation({
                      stato_progetto: item.stato_progetto,
                      pct_complessivo: item.pct_complessivo,
                      noleggio_vendita: item.noleggio_vendita,
                      data_disinstallazione: item.data_disinstallazione,
                    });
                    const projectStatus = getProjectStatusBadge(projectPresentation.displayStatus);
                    const keyDate = item.data_tassativa || item.data_prevista;
                    return (
                      <Link
                        key={item.id}
                        href={`/checklists/${item.id}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 14,
                          alignItems: "center",
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: "1px solid #e2e8f0",
                          background: "white",
                          color: "inherit",
                          textDecoration: "none",
                          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                              {item.nome_checklist || "—"}
                            </span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{item.cliente || "—"}</span>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                background:
                                  projectPresentation.projectKind === "NOLEGGIO" ? "#eff6ff" : "#f8fafc",
                                border:
                                  projectPresentation.projectKind === "NOLEGGIO"
                                    ? "1px solid #bfdbfe"
                                    : "1px solid #e2e8f0",
                                color:
                                  projectPresentation.projectKind === "NOLEGGIO" ? "#1d4ed8" : "#64748b",
                                fontSize: 11,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {projectPresentation.projectKind}
                            </span>
                            {projectPresentation.isNoleggioInCorso ? (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  background: "#dbeafe",
                                  border: "1px solid #93c5fd",
                                  color: "#1d4ed8",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                NOLEGGIO_IN_CORSO
                              </span>
                            ) : null}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginTop: 8,
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            {item.proforma ? (
                              <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                Proforma: {item.proforma}
                              </span>
                            ) : null}
                            {item.po ? (
                              <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                PO: {item.po}
                              </span>
                            ) : null}
                            <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              Data chiave:{" "}
                              {keyDate ? new Date(keyDate).toLocaleDateString("it-IT") : "—"}
                            </span>
                            {item.tipo_impianto ? (
                              <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                {item.tipo_impianto}
                              </span>
                            ) : null}
                            {item.deadlineFlags.licenza === "SCADUTA" ? (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  background: DASHBOARD_BADGE_COLORS.statusExpired.background,
                                  border: `1px solid ${DASHBOARD_BADGE_COLORS.statusExpired.border}`,
                                  color: DASHBOARD_BADGE_COLORS.statusExpired.color,
                                  fontWeight: 800,
                                }}
                              >
                                Lic scad.
                              </span>
                            ) : item.deadlineFlags.licenza === "IMMINENTE" ? (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  background: DASHBOARD_BADGE_COLORS.statusDueSoon.background,
                                  border: `1px solid ${DASHBOARD_BADGE_COLORS.statusDueSoon.border}`,
                                  color: DASHBOARD_BADGE_COLORS.statusDueSoon.color,
                                  fontWeight: 800,
                                }}
                              >
                                Lic immin.
                              </span>
                            ) : null}
                            {item.deadlineFlags.garanzia === "SCADUTA" ? (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  background: DASHBOARD_BADGE_COLORS.statusExpired.background,
                                  border: `1px solid ${DASHBOARD_BADGE_COLORS.statusExpired.border}`,
                                  color: DASHBOARD_BADGE_COLORS.statusExpired.color,
                                  fontWeight: 800,
                                }}
                              >
                                Gar scad.
                              </span>
                            ) : item.deadlineFlags.garanzia === "IMMINENTE" ? (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  background: DASHBOARD_BADGE_COLORS.statusDueSoon.background,
                                  border: `1px solid ${DASHBOARD_BADGE_COLORS.statusDueSoon.border}`,
                                  color: DASHBOARD_BADGE_COLORS.statusDueSoon.color,
                                  fontWeight: 800,
                                }}
                              >
                                Gar immin.
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                          <span
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              border: `1px solid ${projectStatus.border}`,
                              background: projectStatus.background,
                              color: projectStatus.color,
                              fontSize: 12,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {projectStatus.label}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>
                            Apri progetto →
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
          {showClientiSection ? (
            <div style={{ marginTop: 24 }}>
            {showClientiCockpit ? (
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  {[
                    {
                      label: "Totale clienti",
                      value: dashboardClientSummary.total,
                      colors: DASHBOARD_BADGE_COLORS.statusNeutral,
                      href: "/clienti",
                    },
                    {
                      label: "Con attenzione",
                      value: dashboardClientSummary.attention,
                      colors: DASHBOARD_BADGE_COLORS.statusExpired,
                      href: "/clienti-cockpit?quick=ATTENZIONE",
                    },
                    {
                      label: "Con attività aperte",
                      value: dashboardClientSummary.withOpenActivities,
                      colors: DASHBOARD_BADGE_COLORS.statusDueSoon,
                      href: "/clienti-cockpit?focus=open-activities",
                    },
                    {
                      label: "Con scadenze rilevanti",
                      value: dashboardClientSummary.withRelevantDeadlines,
                      colors: DASHBOARD_BADGE_COLORS.statusDueSoon,
                      href: "/clienti-cockpit?focus=relevant-deadlines",
                    },
                  ].map((card) => (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() => router.push(card.href)}
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${card.colors.border}`,
                        background: card.colors.background,
                        padding: "14px 16px",
                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: card.colors.color }}>{card.label}</div>
                      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{card.value}</div>
                    </button>
                  ))}
                </div>
                {dashboardClientSaasCards.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {dashboardClientSaasCards.map((card) => {
                      const active = dashboardClientSaasFilter === card.key;
                      return (
                        <button
                          key={card.key}
                          type="button"
                          onClick={() =>
                            setDashboardClientSaasFilter((prev) => (prev === card.key ? "TUTTI" : card.key))
                          }
                          style={{
                            textAlign: "left",
                            borderRadius: 16,
                            border: `1px solid ${active ? "#0f172a" : card.colors.border}`,
                            background: active ? "#0f172a" : card.colors.background,
                            padding: "14px 16px",
                            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                            cursor: "pointer",
                            color: active ? "white" : "#0f172a",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: active ? "rgba(255,255,255,0.8)" : card.colors.color,
                              }}
                            >
                              {card.label}
                            </div>
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 800,
                                background: active ? "rgba(255,255,255,0.16)" : "#fff",
                                border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(15,23,42,0.08)",
                                color: active ? "white" : "#475569",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {active ? "Filtro attivo" : "Filtra clienti"}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800 }}>
                            {card.count}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: active ? "rgba(255,255,255,0.75)" : "#64748b",
                              display: "grid",
                              gap: 2,
                            }}
                          >
                            <span>{card.count} clienti</span>
                            <span>{card.projectCount} progetti</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Clienti
              </h2>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                {clientRowsToRender.length} clienti
              </div>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "#e5e7eb",
                }}
              />
            </div>
            {enableClientFilters ? (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <input
                  value={dashboardClientSearch}
                  onChange={(e) => setDashboardClientSearch(e.target.value)}
                  placeholder="Cerca cliente"
                  style={{
                    flex: "1 1 300px",
                    minWidth: 0,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "white",
                  }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {[
                    { value: "TUTTI", label: "Tutti" },
                    { value: "ATTENZIONE", label: "Attenzione" },
                    { value: "MONITORARE", label: "Monitorare" },
                    { value: "STABILE", label: "Stabile" },
                  ].map((option) => {
                    const active = dashboardClientQuickFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDashboardClientQuickFilter(
                            option.value as "TUTTI" | "ATTENZIONE" | "MONITORARE" | "STABILE"
                          )
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
                          background: active ? "#0f172a" : "white",
                          color: active ? "white" : "#0f172a",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                  {dashboardClientSaasFilter !== "TUTTI" ? (
                    <button
                      type="button"
                      onClick={() => setDashboardClientSaasFilter("TUTTI")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {dashboardClientSaasFilter === "SAAS_ULTRA"
                        ? "SaaS Ultra"
                        : dashboardClientSaasFilter === "ART_TECH_EVENTS"
                        ? "Art Tech Events"
                        : "SaaS"}{" "}
                      attivo · Mostra tutti
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 10 }}>
              {clientRowsToRender.length === 0 ? (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  Nessun cliente trovato con i filtri attuali.
                </div>
              ) : (
                clientRowsToRender.map((row) => (
                  <Link
                    key={row.rowKey}
                    href={`/clienti/${encodeURIComponent(row.cliente)}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "white",
                      color: "inherit",
                      textDecoration: "none",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: "#0f172a",
                          lineHeight: 1.2,
                          wordBreak: "break-word",
                        }}
                      >
                        {row.cliente}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 8,
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          {row.projectCount} progetti
                        </span>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: DASHBOARD_BADGE_COLORS.statusNeutral.background,
                            border: `1px solid ${DASHBOARD_BADGE_COLORS.statusNeutral.border}`,
                            color: DASHBOARD_BADGE_COLORS.statusNeutral.color,
                          }}
                        >
                          {row.openActivities} attivita aperte
                        </span>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: DASHBOARD_BADGE_COLORS.statusDueSoon.background,
                            border: `1px solid ${DASHBOARD_BADGE_COLORS.statusDueSoon.border}`,
                            color: DASHBOARD_BADGE_COLORS.statusDueSoon.color,
                          }}
                        >
                          {row.imminentActivities} imminenti 7 gg
                        </span>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: DASHBOARD_BADGE_COLORS.statusDueSoon.background,
                            border: `1px solid ${DASHBOARD_BADGE_COLORS.statusDueSoon.border}`,
                            color: DASHBOARD_BADGE_COLORS.statusDueSoon.color,
                          }}
                        >
                          {row.relevantDeadlines + row.overdueDeadlines} scadenze rilevanti
                        </span>
                        {row.overdueActivities > 0 || row.overdueDeadlines > 0 ? (
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: DASHBOARD_BADGE_COLORS.statusExpired.background,
                              border: `1px solid ${DASHBOARD_BADGE_COLORS.statusExpired.border}`,
                              color: DASHBOARD_BADGE_COLORS.statusExpired.color,
                            }}
                          >
                            {row.overdueActivities + row.overdueDeadlines} criticita
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          border: `1px solid ${row.attentionColors.border}`,
                          background: row.attentionColors.background,
                          color: row.attentionColors.color,
                          fontSize: 12,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.attentionLabel}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>
                        Apri cliente →
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            </div>
          ) : null}
          {showCronoSection ? (
            <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Cronoprogramma operativo
              </h2>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "#e5e7eb",
                }}
              />
            </div>
            {cronoError && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fee2e2",
                  color: "#991b1b",
                  marginBottom: 10,
                }}
              >
                {cronoError}
              </div>
            )}
            {cronoStateError && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#fff7ed",
                  color: "#9a3412",
                  marginBottom: 10,
                }}
              >
                {cronoStateError}
              </div>
            )}
            <CronoprogrammaPanel
              fromDate={cronoFromDate}
              setFromDate={(value) => {
                const next = typeof value === "function" ? value(cronoFromDate) : value;
                setCronoFromDate(next);
                setCronoQuickRangeDays(null);
              }}
              toDate={cronoToDate}
              setToDate={(value) => {
                const next = typeof value === "function" ? value(cronoToDate) : value;
                setCronoToDate(next);
                setCronoQuickRangeDays(null);
              }}
              clienteFilter={cronoClienteFilter}
              setClienteFilter={setCronoClienteFilter}
              kindFilter={cronoKindFilter}
              setKindFilter={setCronoKindFilter}
              q={cronoQ}
              setQ={setCronoQ}
              personaleFilter={cronoPersonaleFilter}
              setPersonaleFilter={setCronoPersonaleFilter}
              clienti={homeCronoClienti}
              quickRangeDays={cronoQuickRangeDays}
              applyQuickRange={applyHomeCronoQuickRange}
              showFatto={cronoShowFatto}
              setShowFatto={setCronoShowFatto}
              showHidden={cronoShowHidden}
              setShowHidden={setCronoShowHidden}
              filteredSorted={homeCronoFilteredSorted}
              onExportCsv={() =>
                downloadCronoCsv(
                  `cronoprogramma_${new Date().toISOString().slice(0, 10)}.csv`,
                  homeCronoFilteredSorted,
                  cronoMetaByKey,
                  cronoCommentsByKey
                )
              }
              topScrollRef={cronoTopScrollRef}
              mainScrollRef={cronoMainScrollRef}
              bottomScrollRef={cronoBottomScrollRef}
              scrollContentRef={cronoScrollContentRef}
              onTopScroll={onHomeCronoTopScroll}
              onMainScroll={onHomeCronoMainScroll}
              onBottomScroll={onHomeCronoBottomScroll}
              scrollContentWidth={cronoScrollContentWidth}
              loading={cronoLoading}
              sortBy={cronoSortBy}
              sortDir={cronoSortDir}
              toggleSort={toggleHomeCronoSort}
              metaByKey={cronoMetaByKey}
              commentsByKey={cronoCommentsByKey}
              noteDraftByKey={cronoNoteDraftByKey}
              setNoteDraftByKey={setCronoNoteDraftByKey}
              stateLoading={cronoStateLoading}
              savingFattoKey={cronoSavingFattoKey}
              savingHiddenKey={cronoSavingHiddenKey}
              savingCommentKey={cronoSavingCommentKey}
              savingOperativiKey={cronoSavingOperativiKey}
              deletingCommentId={cronoDeletingCommentId}
              noteHistoryKey={cronoNoteHistoryKey}
              setNoteHistoryKey={setCronoNoteHistoryKey}
              operativiDraftByKey={cronoOperativiDraftByKey}
              setOperativiDraftByKey={setCronoOperativiDraftByKey}
              conflictByKey={homeCronoConflictByKey}
              rowByKey={homeCronoRowByKey}
              setFatto={setHomeCronoFatto}
              setHidden={setHomeCronoHidden}
              addComment={addHomeCronoComment}
              saveOperativi={saveHomeCronoOperativi}
              deleteComment={deleteHomeCronoComment}
              getRowKey={getRowKey}
              getRowSchedule={getRowSchedule}
              extractOperativi={extractOperativi}
              buildConflictTooltip={buildConflictTooltip}
              hasDefinedOperativi={hasDefinedOperativi}
              emptyOperativi={EMPTY_OPERATIVI}
            />
            </div>
          ) : null}
  </div>
)}
      {addInterventoOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeAddIntervento("esc");
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>
              Aggiungi intervento
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                Cliente
                <select
                  value={addInterventoCliente}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAddInterventoCliente(value);
                    setAddInterventoChecklistId("");
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                >
                  <option value="">—</option>
                  {clientiOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Progetto
                <select
                  value={addInterventoChecklistId}
                  onChange={(e) => setAddInterventoChecklistId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                  disabled={!addInterventoCliente}
                >
                  <option value="">—</option>
                  {checklistOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome || c.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                Indirizzo
                <input
                  value={addInterventoIndirizzo}
                  onChange={(e) => {
                    setAddInterventoIndirizzo(e.target.value);
                    setAddInterventoTouched((prev) => ({ ...prev, indirizzo: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Referente Art Tech
                <input
                  value={addInterventoReferenteArtTechNome}
                  onChange={(e) => {
                    setAddInterventoReferenteArtTechNome(e.target.value);
                    setAddInterventoTouched((prev) => ({ ...prev, referenteArtTechNome: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Referente cliente
                <input
                  value={addInterventoReferenteClienteNome}
                  onChange={(e) => {
                    setAddInterventoReferenteClienteNome(e.target.value);
                    setAddInterventoTouched((prev) => ({ ...prev, referenteClienteNome: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Contatto referente
                <input
                  value={addInterventoReferenteClienteContatto}
                  onChange={(e) => {
                    setAddInterventoReferenteClienteContatto(e.target.value);
                    setAddInterventoTouched((prev) => ({ ...prev, referenteClienteContatto: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              Descrizione (opzionale)
              <input
                value={addInterventoDescrizione}
                onChange={(e) => setAddInterventoDescrizione(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                Personale previsto / assegnato
                <input
                  list="quick-intervento-personale-options"
                  value={addInterventoPersonalePrevisto}
                  onChange={(e) => setAddInterventoPersonalePrevisto(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
                <datalist id="quick-intervento-personale-options">
                  {quickOperatoreNameOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Mezzi
                <input
                  value={addInterventoMezzi}
                  onChange={(e) => setAddInterventoMezzi(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              Note operative
              <textarea
                value={addInterventoNoteOperative}
                onChange={(e) => setAddInterventoNoteOperative(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </label>
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Allegati</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                I file e i link vengono collegati all&apos;intervento subito dopo la creazione.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 8, marginBottom: 8 }}>
                <select
                  value={addInterventoAttachmentDocumentType}
                  onChange={(e) =>
                    setAddInterventoAttachmentDocumentType(e.target.value as QuickAttachmentDocumentType)
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                >
                  {QUICK_ATTACHMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      Tipo documento: {option.label}
                    </option>
                  ))}
                </select>
                <input
                  key={addInterventoAttachmentInputKey}
                  type="file"
                  multiple
                  onChange={(e) => setAddInterventoAttachmentFiles(e.target.files ? Array.from(e.target.files) : [])}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={addQuickInterventoFilesToDraft}
                  disabled={addInterventoSaving}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aggiungi file
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr auto", gap: 8 }}>
                <input
                  value={addInterventoAttachmentLinkTitle}
                  onChange={(e) => setAddInterventoAttachmentLinkTitle(e.target.value)}
                  placeholder="Titolo link / documento"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                />
                <input
                  value={addInterventoAttachmentLinkUrl}
                  onChange={(e) => setAddInterventoAttachmentLinkUrl(e.target.value)}
                  placeholder="Link Drive o URL documento"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={addQuickInterventoLinkToDraft}
                  disabled={addInterventoSaving}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aggiungi link
                </button>
              </div>
              {addInterventoAttachmentDrafts.length > 0 ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {addInterventoAttachmentDrafts.map((draft) => {
                    const badge = QUICK_ATTACHMENT_TYPE_BADGES[draft.documentType];
                    return (
                      <div
                        key={draft.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          background: "white",
                        }}
                      >
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            background: badge.background,
                            color: badge.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {badge.label}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {draft.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {draft.kind === "UPLOAD" ? `File · ${draft.file.name}` : draft.url}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuickInterventoDraftAttachment(draft.id)}
                          disabled={addInterventoSaving}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {addInterventoError && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#dc2626" }}>
                {addInterventoError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => closeAddIntervento("cancel")}
                disabled={addInterventoSaving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void submitQuickIntervento()}
                disabled={addInterventoSaving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {addInterventoSaving ? "Salvataggio..." : "Salva intervento"}
              </button>
            </div>
          </div>
        </div>
      )}
      {addAttivitaOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => closeAddAttivita("overlay")}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "white",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeAddAttivita("esc");
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>
              Aggiungi attività
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                Tipo attività
                <select
                  value={addAttivitaType}
                  onChange={(e) => setAddAttivitaType(e.target.value as QuickAttivitaType)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                >
                  {QUICK_ATTIVITA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Cliente
                <select
                  value={addAttivitaCliente}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAddAttivitaCliente(value);
                    setAddAttivitaChecklistId("");
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                >
                  <option value="">—</option>
                  {clientiOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Progetto
                <select
                  value={addAttivitaChecklistId}
                  onChange={(e) => setAddAttivitaChecklistId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                  disabled={!addAttivitaCliente}
                >
                  <option value="">—</option>
                  {attivitaChecklistOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome || c.id}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Data
                <input
                  type="date"
                  value={addAttivitaData}
                  onChange={(e) => setAddAttivitaData(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Ore previste
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={addAttivitaOre}
                  onChange={(e) => {
                    setAddAttivitaOre(e.target.value);
                    setAddAttivitaTouched((prev) => ({ ...prev, ore: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                Indirizzo
                <input
                  value={addAttivitaIndirizzo}
                  onChange={(e) => {
                    setAddAttivitaIndirizzo(e.target.value);
                    setAddAttivitaTouched((prev) => ({ ...prev, indirizzo: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Referente Art Tech
                <input
                  value={addAttivitaReferenteArtTechNome}
                  onChange={(e) => {
                    setAddAttivitaReferenteArtTechNome(e.target.value);
                    setAddAttivitaTouched((prev) => ({ ...prev, referenteArtTechNome: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Referente cliente
                <input
                  value={addAttivitaReferenteClienteNome}
                  onChange={(e) => {
                    setAddAttivitaReferenteClienteNome(e.target.value);
                    setAddAttivitaTouched((prev) => ({ ...prev, referenteClienteNome: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Contatto referente
                <input
                  value={addAttivitaReferenteClienteContatto}
                  onChange={(e) => {
                    setAddAttivitaReferenteClienteContatto(e.target.value);
                    setAddAttivitaTouched((prev) => ({ ...prev, referenteClienteContatto: true }));
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              Descrizione attività
              <textarea
                value={addAttivitaDescrizione}
                onChange={(e) => setAddAttivitaDescrizione(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "block", marginBottom: 12 }}>
                Personale previsto / assegnato
                <input
                  list="quick-attivita-personale-options"
                  value={addAttivitaPersonalePrevisto}
                  onChange={(e) => setAddAttivitaPersonalePrevisto(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
                <datalist id="quick-attivita-personale-options">
                  {quickOperatoreNameOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                Mezzi
                <input
                  value={addAttivitaMezzi}
                  onChange={(e) => setAddAttivitaMezzi(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 6,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              Note operative
              <textarea
                value={addAttivitaNoteOperative}
                onChange={(e) => setAddAttivitaNoteOperative(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </label>
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Allegati</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                I file e i link vengono collegati alla nuova attività subito dopo il salvataggio.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 8, marginBottom: 8 }}>
                <select
                  value={addAttivitaAttachmentDocumentType}
                  onChange={(e) =>
                    setAddAttivitaAttachmentDocumentType(e.target.value as QuickAttachmentDocumentType)
                  }
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                >
                  {QUICK_ATTACHMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      Tipo documento: {option.label}
                    </option>
                  ))}
                </select>
                <input
                  key={addAttivitaAttachmentInputKey}
                  type="file"
                  multiple
                  onChange={(e) => setAddAttivitaAttachmentFiles(e.target.files ? Array.from(e.target.files) : [])}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={addQuickAttivitaFilesToDraft}
                  disabled={addAttivitaSaving}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aggiungi file
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr auto", gap: 8 }}>
                <input
                  value={addAttivitaAttachmentLinkTitle}
                  onChange={(e) => setAddAttivitaAttachmentLinkTitle(e.target.value)}
                  placeholder="Titolo link / documento"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                />
                <input
                  value={addAttivitaAttachmentLinkUrl}
                  onChange={(e) => setAddAttivitaAttachmentLinkUrl(e.target.value)}
                  placeholder="Link Drive o URL documento"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={addQuickAttivitaLinkToDraft}
                  disabled={addAttivitaSaving}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aggiungi link
                </button>
              </div>
              {addAttivitaAttachmentDrafts.length > 0 ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {addAttivitaAttachmentDrafts.map((draft) => {
                    const badge = QUICK_ATTACHMENT_TYPE_BADGES[draft.documentType];
                    return (
                      <div
                        key={draft.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto minmax(0, 1fr) auto",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          background: "white",
                        }}
                      >
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            background: badge.background,
                            color: badge.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {badge.label}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {draft.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {draft.kind === "UPLOAD" ? `File · ${draft.file.name}` : draft.url}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuickAttivitaDraftAttachment(draft.id)}
                          disabled={addAttivitaSaving}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            {addAttivitaError && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#dc2626" }}>
                {addAttivitaError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => closeAddAttivita("cancel")}
                disabled={addAttivitaSaving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void submitQuickAttivita()}
                disabled={addAttivitaSaving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {addAttivitaSaving ? "Salvataggio..." : "Salva attività"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toastMsg && (
        <Toast message={toastMsg} variant="success" onClose={() => setToastMsg(null)} />
      )}
      <style jsx>{`
        .dashboard-cockpit-frame {
          width: 100%;
          max-width: 1020px;
          margin: 0 auto;
        }
        .dashboard-cockpit-inner {
          width: 100%;
        }
        .dashboard-cockpit-primary-grid {
          grid-template-columns: minmax(380px, 2.2fr) repeat(3, minmax(165px, 1fr));
        }
        .dashboard-scadenze-card {
          grid-column: auto;
          width: 100%;
          max-width: none;
        }
        .dashboard-scadenze-shell {
          width: 100%;
          max-width: none;
          margin: 0;
        }
        .dashboard-scadenze-breakdown {
          justify-items: start;
        }
        .dashboard-cockpit-kpi-grid :global(a) {
          max-width: none;
        }
        @media (max-width: 960px) {
          .dashboard-cockpit-frame {
            max-width: none;
          }
          .dashboard-cockpit-primary-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-cockpit-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dashboard-scadenze-card {
            max-width: none;
            justify-self: stretch;
          }
          .dashboard-scadenze-body {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .dashboard-scadenze-header {
            flex-wrap: wrap;
          }
          .dashboard-scadenze-breakdown {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .dashboard-cockpit-frame {
            padding: 10px;
          }
          .dashboard-cockpit-kpi-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-scadenze-breakdown {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default function Page() {
  return (
    <DashboardCockpitPage
      pageTitle="AT SYSTEM"
      pageSubtitle="Cockpit operativo"
      showClientiSection={false}
      showCronoSection
    />
  );
}
