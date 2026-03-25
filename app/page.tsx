"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import DashboardTable from "./components/DashboardTable";
import OperativeNotesPanel from "@/components/OperativeNotesPanel";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import Toast from "@/components/Toast";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";

const SAAS_PIANI = [
  { code: "SAAS-PL", label: "CARE PLUS (ASSISTENZA BASE)" },
  { code: "SAAS-PR", label: "CARE PREMIUM (ASSISTENZA AVANZATA + MONITORAGGIO)" },
  { code: "SAAS-UL", label: "CARE ULTRA (ASSISTENZA PRIORITARIA / H24 SE PREVISTA)" },
  { code: "SAAS-PR4", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H4)" },
  { code: "SAAS-PR8", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H8)" },
  { code: "SAAS-PR12", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H12)" },
  { code: "SAAS-PR24", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H24)" },
  { code: "SAAS-PR36", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H36)" },
  { code: "SAAS-UL4", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL8", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL12", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL24", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL36", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-EVTF", label: "ART TECH EVENT (assistenza remota durante eventi)" },
  { code: "SAAS-EVTO", label: "ART TECH EVENT (assistenza onsite durante eventi)" },
  { code: "SAAS-MON", label: "MONITORAGGIO REMOTO & ALERT" },
  { code: "SAAS-TCK", label: "TICKETING / HELP DESK" },
  { code: "SAAS-SIM", label: "CONNETTIVITÀ SIM DATI" },
  { code: "SAAS-CMS", label: "LICENZA CMS / SOFTWARE TERZI" },
  { code: "SAAS-BKP", label: "BACKUP CONFIGURAZIONI / RIPRISTINO" },
  { code: "SAAS-RPT", label: "REPORTISTICA (LOG, UPTIME, ON-AIR)" },
  { code: "SAAS-SLA", label: "SLA RIPRISTINO (ES. ENTRO 2H) – OPZIONE" },
  { code: "SAAS-EXT", label: "ESTENSIONE GARANZIA / COPERTURE" },
  { code: "SAAS-CYB", label: "CYBER / ANTIVIRUS / HARDENING PLAYER" },
];

function saasLabelFromCode(code?: string | null) {
  if (!code) return "";
  const found = SAAS_PIANI.find((p) => p.code === code);
  return found ? found.label : "";
}

type SaasServiceFilter = "EVENTS" | "ULTRA" | "PREMIUM" | "PLUS";
type ProjectStatusFilter =
  | "IN_CORSO"
  | "CONSEGNATO"
  | "NOLEGGIO_ATTIVO"
  | "RIENTRATO"
  | "SOSPESO"
  | "OPERATIVO"
  | "CHIUSO";
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

const EMPTY_SCADENZE_BREAKDOWN: DashboardScadenzeBreakdown = {
  garanzie: 0,
  licenze: 0,
  tagliandi: 0,
  saasAltro: 0,
};

function buildScadenzeLink(days: number) {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return `/scadenze?from=${toDateInputValue(from)}&to=${toDateInputValue(to)}`;
}

function matchesSingleSaasService(row: Checklist, filter: SaasServiceFilter) {
  const piano = String(row.saas_piano || "")
    .trim()
    .toUpperCase();
  const tipo = String(row.saas_tipo || "")
    .trim()
    .toUpperCase();
  const combined = `${piano} ${tipo}`;
  if (filter === "EVENTS") {
    return (
      combined.includes("SAAS-EVT") ||
      combined.includes("EVENT") ||
      combined.includes("ART TECH EVENT")
    );
  }
  if (filter === "ULTRA") return combined.includes("SAAS-UL");
  if (filter === "PREMIUM") return combined.includes("SAAS-PR");
  if (filter === "PLUS") return combined.includes("SAAS-PL");
  return true;
}

function normalizeProjectStatus(project: {
  stato_progetto?: string | null;
  noleggio_vendita?: string | null;
  data_disinstallazione?: string | null;
  pct_complessivo?: number | null;
}): ProjectStatusFilter | null {
  const { isNoleggioAttivo } = getProjectNoleggioState(project);
  if (isNoleggioAttivo) return "NOLEGGIO_ATTIVO";
  return getEffectiveProjectStatus(project);
}

function getProjectStatusLabel(project: {
  stato_progetto?: string | null;
  noleggio_vendita?: string | null;
  data_disinstallazione?: string | null;
  pct_complessivo?: number | null;
}) {
  const { isNoleggioAttivo } = getProjectNoleggioState(project);
  const effective = getEffectiveProjectStatus(project);
  if (effective === "CONSEGNATO" && isNoleggioAttivo) return "CONSEGNATO + IN_CORSO";
  if (effective === "IN_CORSO") return "IN_LAVORAZIONE";
  return effective || "—";
}

function getProjectNoleggioState(project: {
  stato_progetto?: string | null;
  noleggio_vendita?: string | null;
  data_disinstallazione?: string | null;
}) {
  const stato = String(project.stato_progetto || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const isNoleggio = String(project.noleggio_vendita || "").trim().toUpperCase() === "NOLEGGIO";
  const disinstallazione = parseLocalDay(project.data_disinstallazione);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const isNoleggioAttivo =
    stato === "CONSEGNATO" && isNoleggio && (!disinstallazione || disinstallazione >= today);
  const disinstallazioneImminente =
    isNoleggioAttivo &&
    !!disinstallazione &&
    disinstallazione >= today &&
    disinstallazione <= inSevenDays;

  return { isNoleggioAttivo, disinstallazioneImminente };
}

function renderStatusBadge(value?: string | null) {
  const label = value?.trim() || "—";
  const upper = label.toUpperCase();
  let bg = "#f3f4f6";
  let color = "#6b7280";

  if (upper === "OK") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (upper === "DA FARE") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "NON NECESSARIO") {
    bg = "#e5e7eb";
    color = "#374151";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

function parseLocalDay(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function getExpiryStatus(value?: string | null): "ATTIVA" | "SCADUTA" | "—" {
  const dt = parseLocalDay(value);
  if (!dt) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dt < today ? "SCADUTA" : "ATTIVA";
}

function isHttpUrl(value?: string | null) {
  const raw = String(value || "").trim();
  return /^https?:\/\//i.test(raw);
}

function normalizeDashboardAddressValue(value?: string | null) {
  const raw = String(value || "")
    .replace(/[\u200B-\u200D\u2060\u00A0]/g, " ")
    .trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (
    normalized === "-" ||
    normalized === "—" ||
    normalized === "null" ||
    normalized === "n.d." ||
    normalized === "nd"
  ) {
    return null;
  }
  return raw.replace(/\s+/g, " ");
}

function renderDashboardAddressCell(value?: string | null) {
  const normalized = normalizeDashboardAddressValue(value);
  if (!normalized) return "—";

  if (isHttpUrl(normalized)) {
    const label = /google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(normalized)
      ? "Apri mappa"
      : "Apri link";

    return (
      <a
        href={normalized}
        target="_blank"
        rel="noreferrer"
        title={normalized}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          color: "#2563eb",
          textDecoration: "underline",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </a>
    );
  }

  return (
    <span
      title={normalized}
      style={{
        display: "block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {normalized}
    </span>
  );
}

function renderBadge(label: "ATTIVA" | "SCADUTA" | "—") {
  let bg = "#e5e7eb";
  let color = "#374151";
  if (label === "ATTIVA") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (label === "SCADUTA") {
    bg = "#fee2e2";
    color = "#991b1b";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
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

function getChecklistM2(row: Checklist): number | null {
  const computed = calcM2(row.dimensioni, row.numero_facce, row.impianto_quantita);
  if (computed != null) return computed;
  if (typeof row.m2_calcolati === "number" && Number.isFinite(row.m2_calcolati)) {
    return row.m2_calcolati;
  }
  return null;
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

export default function Page() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const router = useRouter();
  const [items, setItems] = useState<Checklist[]>([]);
  const [allProjects, setAllProjects] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [clientiMissingEmailCount, setClientiMissingEmailCount] = useState(0);
  const [showMissingEmailInfo, setShowMissingEmailInfo] = useState(false);
  const [expandedSaasNoteId, setExpandedSaasNoteId] = useState<string | null>(null);
  const [expandedDashboardNoteId, setExpandedDashboardNoteId] = useState<string | null>(null);
  const [serialsByChecklistId, setSerialsByChecklistId] = useState<
    Record<string, { seriali: string[] }>
  >({});

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [addInterventoOpen, setAddInterventoOpen] = useState(false);
  const [addInterventoCliente, setAddInterventoCliente] = useState("");
  const [addInterventoChecklistId, setAddInterventoChecklistId] = useState("");
  const [addInterventoDescrizione, setAddInterventoDescrizione] = useState("");
  const [addInterventoError, setAddInterventoError] = useState<string | null>(null);
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

  function formatOperatoreRef(refId?: string | null) {
    if (!refId) return "—";
    const found = operatoriLookupById.get(refId);
    if (!found) return refId;
    if (found.nome && found.email) return `${found.nome} (${found.email})`;
    if (found.nome) return found.nome;
    if (found.email) return found.email;
    return refId;
  }

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

  const isUltraOrPremium =
    saasPiano.startsWith("SAAS-UL") || saasPiano.startsWith("SAAS-PR");

  const strutturaOptions = useMemo(() => {
    return catalogItems.filter((item) => {
      const code = (item.codice ?? "").toUpperCase();
      return code.startsWith("STR-") || code === "TEC-STRCT";
    });
  }, [catalogItems]);

  // dashboard: ricerca + ordinamento
  const [q, setQ] = useState("");
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadRequestSeqRef = useRef(0);
  const [saasServiceFilter, setSaasServiceFilter] = useState<Record<SaasServiceFilter, boolean>>({
    EVENTS: false,
    ULTRA: false,
    PREMIUM: false,
    PLUS: false,
  });
  const [projectStatusFilter, setProjectStatusFilter] = useState<
    Record<ProjectStatusFilter, boolean>
  >({
    IN_CORSO: false,
    CONSEGNATO: false,
    NOLEGGIO_ATTIVO: false,
    RIENTRATO: false,
    SOSPESO: false,
    OPERATIVO: false,
    CHIUSO: false,
  });
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<
    | "created_at"
    | "nome_checklist"
    | "cliente"
    | "codice"
    | "descrizione"
    | "passo"
    | "tipo_impianto"
    | "impianto_indirizzo"
    | "dimensioni"
    | "m2_calcolati"
    | "proforma"
    | "po"
    | "proforma_doc"
    | "magazzino_importazione"
    | "saas_piano"
    | "saas_scadenza"
    | "saas_note"
    | "saas_stato"
    | "garanzia_scadenza"
    | "data_prevista"
    | "data_tassativa"
    | "stato_progetto"
    | "data_installazione_reale"
    | "pct_complessivo"
    | "licenze_attive"
    | "licenze_prossima_scadenza"
    | "updated_at"
  >("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: typeof sortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(key: typeof sortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function toNum(v: any) {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function toTime(v: any) {
    const t = Date.parse(v ?? "");
    return Number.isFinite(t) ? t : null;
  }

  function cmp(a: any, b: any) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    const na = toNum(a);
    const nb = toNum(b);
    if (na != null && nb != null) return na - nb;

    const ta = toTime(a);
    const tb = toTime(b);
    if (ta != null && tb != null) return ta - tb;

    return String(a).localeCompare(String(b), "it", { sensitivity: "base" });
  }

  function getSortRaw(row: Checklist, key: typeof sortKey) {
    if (key === "m2_calcolati") return getChecklistM2(row);
    if (key === "pct_complessivo") return row.pct_complessivo;
    if (key === "licenze_attive") return row.licenze_attive ?? 0;
    if (key === "saas_stato") return getExpiryStatus(row.saas_scadenza);
    if (key === "proforma_doc") {
      const docs = (row.checklist_documents ?? []) as any[];
      const hasProforma = docs.some((d) =>
        String(d.tipo ?? "")
          .toUpperCase()
          .includes("PROFORMA")
      );
      return hasProforma ? 1 : 0;
    }
    return (row as any)[key];
  }

  const displayRows = useMemo(() => {
    const rawNeedle = q.trim().toLowerCase();
    const tokenMatch = rawNeedle.match(/\bproforma:(si|no)\b/);
    const proformaFilter =
      tokenMatch?.[1] === "si" ? true : tokenMatch?.[1] === "no" ? false : null;
    const needle = rawNeedle.replace(/\bproforma:(si|no)\b/g, "").trim();

    const filtered = allProjects.filter((c) => {
      const activeFilters = (Object.entries(saasServiceFilter) as Array<[SaasServiceFilter, boolean]>)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      if (activeFilters.length > 0) {
        const matchAll = activeFilters.every((f) => matchesSingleSaasService(c, f));
        if (!matchAll) return false;
      }
      const activeStatusFilters = (
        Object.entries(projectStatusFilter) as Array<[ProjectStatusFilter, boolean]>
      )
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      if (activeStatusFilters.length > 0) {
          const status = normalizeProjectStatus(c);
          if (!status || !activeStatusFilters.includes(status)) return false;
        }
      const docs = (c.checklist_documents ?? []) as any[];
      const hasProforma = docs.some((d) =>
        String(d.tipo ?? "")
          .toUpperCase()
          .includes("PROFORMA")
      );
      if (proformaFilter === true && !hasProforma) return false;
      if (proformaFilter === false && hasProforma) return false;
      if (!needle) return true;
      const serials = serialsByChecklistId[c.id]?.seriali || [];
      const hay = [
        c.nome_checklist,
        c.cliente,
        c.codice ?? "",
        c.descrizione ?? "",
        c.passo ?? "",
        c.tipo_impianto ?? "",
        c.impianto_indirizzo ?? "",
        c.dimensioni ?? "",
        getChecklistM2(c) != null
          ? getChecklistM2(c)?.toFixed(2) ?? ""
          : "",
        c.proforma ?? "",
        c.po ?? "",
        c.magazzino_importazione ?? "",
        c.tipo_saas ?? "",
        c.saas_piano ?? "",
        saasLabelFromCode(c.saas_piano ?? "") ?? "",
        c.saas_tipo ?? "",
        c.saas_scadenza ?? "",
        getExpiryStatus(c.saas_scadenza),
        c.saas_note ?? "",
        c.garanzia_scadenza ?? "",
        c.data_prevista ?? "",
        c.data_tassativa ?? "",
        c.stato_progetto ?? "",
        c.data_installazione_reale ?? "",
        c.data_installazione_reale
          ? new Date(c.data_installazione_reale).toLocaleDateString()
          : "",
        c.documenti ?? "",
        c.sezione_1 ?? "",
        c.sezione_2 ?? "",
        c.sezione_3 ?? "",
        c.stato_complessivo ?? "",
        c.pct_complessivo != null ? String(c.pct_complessivo) : "",
        c.licenze_attive != null ? String(c.licenze_attive) : "",
        c.licenze_prossima_scadenza ?? "",
        c.licenze_dettaglio ?? "",
        c.license_search ?? "",
        c.updated_at ?? "",
        ...serials,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });

    const dir = sortDir === "asc" ? 1 : -1;

    const sorted = [...filtered].sort((a, b) => {
      const aVal = getSortRaw(a, sortKey);
      const bVal = getSortRaw(b, sortKey);
      const aEmpty = aVal == null || aVal === "";
      const bEmpty = bVal == null || bVal === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      return cmp(aVal, bVal) * dir;
    });

    return sorted;
  }, [allProjects, q, saasServiceFilter, projectStatusFilter, sortKey, sortDir, serialsByChecklistId]);

  const clientiOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((c) => {
      if (c.cliente) set.add(c.cliente);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
  }, [items]);

  const checklistOptions = useMemo(() => {
    if (!addInterventoCliente) return [];
    return items
      .filter((c) => c.cliente === addInterventoCliente)
      .map((c) => ({ id: c.id, nome: c.nome_checklist }));
  }, [items, addInterventoCliente]);

  const selectedScadenzeSummary = scadenzeByPeriod[scadenzePeriodDays];
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
    secondaryValue?: number
  ) {
    return (
      <Link href={href} style={shortcutCardStyle}>
        <div style={shortcutCardTitleStyle}>{title}</div>
        <div style={shortcutCardNumberWrapStyle}>
          <div style={shortcutCardNumberStyle}>{count}</div>
        </div>
        <div style={shortcutCardBadgeStyle}>
          {secondaryLabel ? `(${secondaryLabel}: ${secondaryValue ?? 0})` : "\u00A0"}
        </div>
      </Link>
    );
  }

  async function load() {
    const requestSeq = ++loadRequestSeqRef.current;
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isLatest = () => requestSeq === loadRequestSeqRef.current;

    setLoading(true);
    setDashboardLoadError(null);

    let data: any[] | null = null;
    let sections: any[] | null = null;
    let licenseSummary: any[] | null = null;
    let licensesData: any[] | null = null;
    let serialsData: any[] | null = null;
    let catalogItemsData: any[] | null = null;
    let error: any = null;

    try {
      const debug = new URLSearchParams(window.location.search).get("debug") === "1";
      const params = new URLSearchParams();
      if (debug) params.set("debug", "1");
      // ricerca solo client-side: non passare q all'API

      const activeSaasFilters = (Object.entries(saasServiceFilter) as Array<[SaasServiceFilter, boolean]>)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      if (activeSaasFilters.length > 0) params.set("saas", activeSaasFilters.join(","));

      const activeProjectStatusFilters = (
        Object.entries(projectStatusFilter) as Array<[ProjectStatusFilter, boolean]>
      )
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);
      if (activeProjectStatusFilters.length > 0) params.set("stati", activeProjectStatusFilters.join(","));
      const dashboardRes = await fetch(`/api/dashboard${params.size ? `?${params.toString()}` : ""}`, {
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
      sections = (dashboardData?.data?.sections as any[]) || [];
      licenseSummary = (dashboardData?.data?.licenseSummary as any[]) || [];
      licensesData = (dashboardData?.data?.licenses as any[]) || [];
      serialsData = (dashboardData?.data?.serials as any[]) || [];
      catalogItemsData = (dashboardData?.data?.catalogItems as any[]) || [];

      if (debug) {
        console.log("[dashboard] auth_mode:", dashboardData?.auth_mode || dashboardData?.debug?.auth_mode);
        console.log(
          "[dashboard] result_count:",
          dashboardData?.debug?.result_count ?? (dashboardData?.data?.checklists || []).length
        );
      }

      if (!isLatest()) return;

      const sectionsByChecklistId: Record<string, Partial<Checklist>> = {};
      for (const r of sections as any[]) {
        const checklistId = String(r.checklist_id ?? "");
        if (!checklistId) continue;
        sectionsByChecklistId[checklistId] = {
          documenti: r.documenti ?? null,
          sezione_1: r.sezione_1 ?? null,
          sezione_2: r.sezione_2 ?? null,
          sezione_3: r.sezione_3 ?? null,
          stato_complessivo: r.stato_complessivo ?? null,
          pct_complessivo: r.pct_complessivo ?? null,
        };
      }

      const licenzeByChecklistId: Record<string, Partial<Checklist>> = {};
      for (const r of licenseSummary as any[]) {
        const checklistId = String(r.checklist_id ?? "");
        if (!checklistId) continue;
        licenzeByChecklistId[checklistId] = {
          licenze_attive: r.licenze_attive ?? 0,
          licenze_prossima_scadenza: r.licenze_prossima_scadenza ?? null,
          licenze_dettaglio: r.licenze_dettaglio ?? null,
        };
      }

      const serialMap: Record<string, { seriali: string[] }> = {};
      for (const r of serialsData as any[]) {
        const checklistId = String(r.checklist_id ?? "");
        if (!checklistId) continue;
        if (!serialMap[checklistId]) serialMap[checklistId] = { seriali: [] };
        if (r.seriale) serialMap[checklistId].seriali.push(String(r.seriale));
      }
      setSerialsByChecklistId(serialMap);

      const licenseSearchByChecklistId = new Map<string, string>();
      for (const l of licensesData as any[]) {
        const checklistId = String(l.checklist_id ?? "");
        if (!checklistId) continue;
        const parts = [
          l.tipo,
          l.scadenza,
          l.note,
          l.ref_univoco,
          l.telefono,
          l.intestatario,
          l.gestore,
          l.fornitore,
        ]
          .filter(Boolean)
          .map((p) => String(p));
        if (parts.length === 0) continue;
        const prev = licenseSearchByChecklistId.get(checklistId) || "";
        licenseSearchByChecklistId.set(checklistId, prev ? `${prev} ${parts.join(" ")}` : parts.join(" "));
      }

      const merged = (data as Checklist[]).map((c) => {
        const clienteLabel =
          (c as any).clienti_anagrafica?.denominazione?.trim() || c.cliente || "";
        return {
          ...c,
          cliente: clienteLabel || c.cliente,
          ...(sectionsByChecklistId[c.id] || {}),
          ...(licenzeByChecklistId[c.id] || {}),
          codice: c.impianto_codice ?? null,
          descrizione: c.impianto_descrizione ?? null,
          license_search: licenseSearchByChecklistId.get(c.id) || null,
        };
      });
      setItems(merged as Checklist[]);
      setAllProjects(merged as Checklist[]);
      setCatalogItems((catalogItemsData || []) as CatalogItem[]);

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
        const summaries = await Promise.all(
          scadenzePeriods.map(async (days) => {
            const untilDate = new Date(today);
            untilDate.setDate(untilDate.getDate() + days);
            const to = toDateInputValue(untilDate);
            const res = await fetch(`/api/scadenze?from=${from}&to=${to}`, {
              signal: controller.signal,
              credentials: "include",
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || typeof json?.count !== "number") {
              return [days, { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 }] as const;
            }
            const rows = Array.isArray(json?.data) ? json.data : [];
            return [days, { count: json.count, breakdown: buildScadenzeBreakdown(rows), overdueCount: 0 }] as const;
          })
        );
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const overdueRes = await fetch(`/api/scadenze?to=${toDateInputValue(yesterday)}`, {
          signal: controller.signal,
          credentials: "include",
        });
        const overdueJson = await overdueRes.json().catch(() => ({}));
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
        setScadenzeByPeriod({
          7: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
          15: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
          30: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
        });
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

      setOperatoreAssociationError(null);
      let meRes: Response;
      try {
        meRes = await fetch("/api/me-operatore", { signal: controller.signal });
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
        setCurrentOperatoreId(String(meData.operatore.id));
        setCurrentOperatoreLabel({
          nome: meData.operatore.nome ?? null,
          ruolo: meData.operatore.ruolo ?? null,
        });
      }
    } catch (e: any) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      if (!isLatest()) return;
      const message = String(e?.message || "Errore caricamento dashboard");
      console.error("Errore caricamento dashboard", e);
      setDashboardLoadError(message);
      setScadenzeByPeriod({
        7: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
        15: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
        30: { count: 0, breakdown: { ...EMPTY_SCADENZE_BREAKDOWN }, overdueCount: 0 },
      });
      setInterventiDaChiudereSummary({ count: 0, overdue: 0 });
      setInterventiEntro7Summary({ count: 0, overdue: 0 });
      setFattureDaEmettereCount(0);
      setNoleggiAttiviCount(0);
      setConsegneEntro7Summary({ count: 0, overdue: 0 });
      setSmontaggiEntro7Summary({ count: 0, overdue: 0 });
      setClientiMissingEmailCount(0);
    } finally {
      if (!isLatest()) return;
      setLoading(false);
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

  useEffect(() => {
    if (!addInterventoCliente) {
      setAddInterventoChecklistId("");
      return;
    }
    const first = items.find((c) => c.cliente === addInterventoCliente);
    if (first?.id) setAddInterventoChecklistId(first.id);
  }, [addInterventoCliente, items]);

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

    // 1) Insert testata checklist e prendiamo l'id creato
    const payloadChecklist = {
      cliente: cliente.trim(),
      nome_checklist: nomeChecklist.trim(),
      proforma: proforma.trim() ? proforma.trim() : null,
      magazzino_importazione: magazzinoImportazione.trim()
        ? magazzinoImportazione.trim()
        : null,
      created_by_operatore: currentOperatoreId || null,
      updated_by_operatore: currentOperatoreId || null,
      created_by: getCurrentOperatoreDisplayName(),
      updated_by: getCurrentOperatoreDisplayName(),
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
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>DASH BOARD</div>
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
                setAddInterventoOpen(true);
              }}
              style={navButtonStyle}
            >
              + Aggiungi intervento
            </button>
            <Link
              href="/cronoprogramma"
              style={navButtonStyle}
            >
              Cronoprogramma
            </Link>
            <Link
              href="/scadenze"
              style={navButtonStyle}
            >
              Scadenze
            </Link>
            <Link
              href="/import-progetti"
              style={navButtonStyle}
            >
              Importa progetti
            </Link>
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
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
                <div className="dashboard-cockpit-card dashboard-fatture-card">
                  {renderCockpitMetricCard(
                    "/admin/fatture-da-emettere",
                    "FATTURE DA EMETTERE",
                    fattureDaEmettereCount
                  )}
                </div>
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
                  "/admin/consegne-entro-7-giorni",
                  "CONSEGNE ENTRO 7 GIORNI",
                  consegneEntro7Summary.count,
                  "Scadute",
                  consegneEntro7Summary.overdue
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
          {loading ? (
            <div>Caricamento…</div>
          ) : items.length === 0 ? (
            <div>Nessun PROGETTO presente</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginTop: 24,
                }}
              >
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cerca (cliente, nome, proforma, SAAS, scadenze…)"
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    minWidth: 280,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                    fontSize: 13,
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "white",
                  }}
                >
                  <span style={{ fontWeight: 700, opacity: 0.85 }}>SaaS</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={Object.values(saasServiceFilter).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSaasServiceFilter({
                          EVENTS: checked,
                          ULTRA: checked,
                          PREMIUM: checked,
                          PLUS: checked,
                        });
                      }}
                    />
                    Tutti
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={saasServiceFilter.EVENTS}
                      onChange={(e) =>
                        setSaasServiceFilter((prev) => ({ ...prev, EVENTS: e.target.checked }))
                      }
                    />
                    Art Tech Events
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={saasServiceFilter.ULTRA}
                      onChange={(e) =>
                        setSaasServiceFilter((prev) => ({ ...prev, ULTRA: e.target.checked }))
                      }
                    />
                    ULTRA
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={saasServiceFilter.PREMIUM}
                      onChange={(e) =>
                        setSaasServiceFilter((prev) => ({ ...prev, PREMIUM: e.target.checked }))
                      }
                    />
                    PREMIUM
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={saasServiceFilter.PLUS}
                      onChange={(e) =>
                        setSaasServiceFilter((prev) => ({ ...prev, PLUS: e.target.checked }))
                      }
                    />
                    PLUS
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                    fontSize: 13,
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "white",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={Object.values(projectStatusFilter).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProjectStatusFilter({
                          IN_CORSO: checked,
                          CONSEGNATO: checked,
                          NOLEGGIO_ATTIVO: checked,
                          RIENTRATO: checked,
                          SOSPESO: checked,
                          OPERATIVO: checked,
                          CHIUSO: checked,
                        });
                      }}
                    />
                    Tutti stati
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.IN_CORSO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({ ...prev, IN_CORSO: e.target.checked }))
                      }
                    />
                    In lavorazione
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.CONSEGNATO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({
                          ...prev,
                          CONSEGNATO: e.target.checked,
                        }))
                      }
                    />
                    Consegnato
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.NOLEGGIO_ATTIVO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({
                          ...prev,
                          NOLEGGIO_ATTIVO: e.target.checked,
                        }))
                      }
                    />
                    Noleggio attivo
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.RIENTRATO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({
                          ...prev,
                          RIENTRATO: e.target.checked,
                        }))
                      }
                    />
                    Rientrato
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.SOSPESO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({ ...prev, SOSPESO: e.target.checked }))
                      }
                    />
                    Sospeso
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.OPERATIVO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({ ...prev, OPERATIVO: e.target.checked }))
                      }
                    />
                    Operativo
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={projectStatusFilter.CHIUSO}
                      onChange={(e) =>
                        setProjectStatusFilter((prev) => ({ ...prev, CHIUSO: e.target.checked }))
                      }
                    />
                    Chiuso
                  </label>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Risultati: {displayRows.length}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 14,
                  background: "white",
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                }}
              >
                <DashboardTable>
                  <table
                    style={{
                      width: "max-content",
                      minWidth: 1600,
                      tableLayout: "fixed",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                <colgroup>
                  <col style={{ width: 170 }} />  {/* PROGETTO */}
                  <col style={{ width: 140 }} />  {/* Cliente */}
                  <col style={{ width: 140 }} />  {/* Proforma */}
                  <col style={{ width: 120 }} />  {/* PO */}
                  <col style={{ width: 110 }} />  {/* Data prevista */}
                  <col style={{ width: 110 }} />  {/* Data tassativa */}
                  <col style={{ width: 110 }} />  {/* Dimensioni */}
                  <col style={{ width: 70 }} />   {/* Passo */}
                  <col style={{ width: 70 }} />   {/* m2 */}
                  <col style={{ width: 110 }} />  {/* Tipo impianto */}
                  <col style={{ width: 180 }} />  {/* Indirizzo impianto */}
                  <col style={{ width: 120 }} />  {/* Install. reale */}
                  <col style={{ width: 110 }} />  {/* Codice */}
                  <col style={{ width: 130 }} />  {/* Magazzino */}
                  <col style={{ width: 200 }} />  {/* Descrizione */}
                  <col style={{ width: 150 }} />  {/* SAAS */}
                  <col style={{ width: 120 }} />  {/* SAAS scadenza */}
                  <col style={{ width: 200 }} />  {/* SAAS note */}
                  <col style={{ width: 140 }} />  {/* SAAS stato */}
                  <col style={{ width: 150 }} />  {/* Garanzia */}
                  <col style={{ width: 120 }} />  {/* Licenze # attive */}
                  <col style={{ width: 180 }} />  {/* Licenze prossima scadenza */}
                  <col style={{ width: 220 }} />  {/* Licenze dettaglio */}
                  <col style={{ width: 130 }} />  {/* Stato progetto */}
                  <col style={{ width: 120 }} />  {/* Documenti */}
                  <col style={{ width: 120 }} />  {/* Sezione 1 */}
                  <col style={{ width: 120 }} />  {/* Sezione 2 */}
                  <col style={{ width: 120 }} />  {/* Sezione 3 */}
                  <col style={{ width: 120 }} />  {/* Stato complessivo */}
                  <col style={{ width: 110 }} />  {/* % Stato */}
                  <col style={{ width: 120 }} />  {/* Creato */}
                  <col style={{ width: 120 }} />  {/* Modificato */}
                  <col style={{ width: 130 }} />  {/* Creato da */}
                  <col style={{ width: 130 }} />  {/* Modificato da */}
                  <col style={{ width: 160 }} />  {/* Azioni */}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      onClick={() => toggleSort("nome_checklist")}
                      title="Ordina per Nome PROGETTO"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      PROGETTO
                      {sortIcon("nome_checklist")}
                    </th>
                    <th
                      onClick={() => toggleSort("cliente")}
                      title="Ordina per Cliente"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Cliente
                      {sortIcon("cliente")}
                    </th>
                    <th
                      onClick={() => toggleSort("proforma_doc")}
                      title="Ordina per Proforma"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Proforma
                      {sortIcon("proforma_doc")}
                    </th>
                    <th
                      onClick={() => toggleSort("po")}
                      title="Ordina per PO"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      PO
                      {sortIcon("po")}
                    </th>
                    <th
                      onClick={() => toggleSort("data_prevista")}
                      title="Ordina per Data installazione prevista"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Data prevista
                      {sortIcon("data_prevista")}
                    </th>
                    <th
                      onClick={() => toggleSort("data_tassativa")}
                      title="Ordina per Data tassativa"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Data tassativa
                      {sortIcon("data_tassativa")}
                    </th>
                    <th
                      onClick={() => toggleSort("dimensioni")}
                      title="Ordina per Dimensioni"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Dimensioni
                      {sortIcon("dimensioni")}
                    </th>
                    <th
                      onClick={() => toggleSort("passo")}
                      title="Ordina per Passo"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Passo
                      {sortIcon("passo")}
                    </th>
                    <th
                      onClick={() => toggleSort("m2_calcolati")}
                      title="Ordina per m2"
                      style={{
                        textAlign: "right",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      m2
                      {sortIcon("m2_calcolati")}
                    </th>
                    <th
                      onClick={() => toggleSort("tipo_impianto")}
                      title="Ordina per Tipo impianto"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Tipo impianto
                      {sortIcon("tipo_impianto")}
                    </th>
                    <th
                      onClick={() => toggleSort("impianto_indirizzo")}
                      title="Ordina per Indirizzo impianto"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Indirizzo impianto
                      {sortIcon("impianto_indirizzo")}
                    </th>
                    <th
                      onClick={() => toggleSort("data_installazione_reale")}
                      title="Ordina per Installazione reale"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Install. reale
                      {sortIcon("data_installazione_reale")}
                    </th>
                    <th
                      onClick={() => toggleSort("codice")}
                      title="Ordina per Codice"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Codice
                      {sortIcon("codice")}
                    </th>
                    <th
                      onClick={() => toggleSort("magazzino_importazione")}
                      title="Ordina per Magazzino importazione"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Magazzino
                      {sortIcon("magazzino_importazione")}
                    </th>
                    <th
                      onClick={() => toggleSort("descrizione")}
                      title="Ordina per Descrizione"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Descrizione
                      {sortIcon("descrizione")}
                    </th>
                    <th
                      onClick={() => toggleSort("saas_piano")}
                      title="Ordina per SAAS"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      SAAS
                      {sortIcon("saas_piano")}
                    </th>
                    <th
                      onClick={() => toggleSort("saas_scadenza")}
                      title="Ordina per SAAS scadenza"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      SAAS scadenza
                      {sortIcon("saas_scadenza")}
                    </th>
                    <th
                      onClick={() => toggleSort("saas_note")}
                      title="Ordina per SAAS note"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      SAAS note
                      {sortIcon("saas_note")}
                    </th>
                    <th
                      onClick={() => toggleSort("saas_stato")}
                      title="Ordina per SAAS stato"
                      style={{
                        textAlign: "center",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      SAAS stato
                      {sortIcon("saas_stato")}
                    </th>
                    <th
                      onClick={() => toggleSort("garanzia_scadenza")}
                      title="Ordina per Garanzia scadenza"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Garanzia
                      {sortIcon("garanzia_scadenza")}
                    </th>
                    <th
                      onClick={() => toggleSort("licenze_attive")}
                      title="Ordina per Licenze attive"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Licenze # attive
                      {sortIcon("licenze_attive")}
                    </th>
                    <th
                      onClick={() => toggleSort("licenze_prossima_scadenza")}
                      title="Ordina per Licenze prossima scadenza"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Licenze prossima scadenza
                      {sortIcon("licenze_prossima_scadenza")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Licenze dettaglio
                    </th>
                    <th
                      onClick={() => toggleSort("stato_progetto")}
                      title="Ordina per Stato progetto"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Stato progetto
                      {sortIcon("stato_progetto")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Documenti
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Sezione 1
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Sezione 2
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Sezione 3
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Stato complessivo
                    </th>
                    <th
                      onClick={() => toggleSort("pct_complessivo")}
                      title="Ordina per % Stato complessivo"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      % Stato
                      {sortIcon("pct_complessivo")}
                    </th>
                    <th
                      onClick={() => toggleSort("created_at")}
                      title="Ordina per Data creazione"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Creato
                      {sortIcon("created_at")}
                    </th>
                    <th
                      onClick={() => toggleSort("updated_at")}
                      title="Ordina per Data modifica"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        cursor: "pointer",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Modificato
                      {sortIcon("updated_at")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Creato da
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Modificato da
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        position: "sticky",
                        top: 0,
                        background: "white",
                        zIndex: 2,
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((c) => {
                    return (
                      <tr
                        key={c.id}
                        data-testid="project-row"
                        data-project-id={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/checklists/${c.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/checklists/${c.id}`);
                          }
                        }}
                        style={{
                          borderBottom: "1px solid #f7f7f7",
                          cursor: "pointer",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div>{c.nome_checklist}</div>
                            <div
                              style={{
                                border: "1px solid #eef2f7",
                                borderRadius: 10,
                                padding: "8px 10px",
                                background: "#f9fafb",
                                display: "grid",
                                gap: 8,
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
                                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                                  Note operative
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedDashboardNoteId((prev) => (prev === c.id ? null : c.id));
                                  }}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 8,
                                    border: "1px solid #d1d5db",
                                    background: "white",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {expandedDashboardNoteId === c.id ? "Chiudi" : "Apri"}
                                </button>
                              </div>
                              {expandedDashboardNoteId === c.id ? (
                                <OperativeNotesPanel
                                  compact
                                  items={[
                                    {
                                      rowKind: "INSTALLAZIONE",
                                      rowRefId: c.id,
                                      label: "Installazione",
                                    },
                                    ...(String(c.noleggio_vendita || "").trim().toUpperCase() === "NOLEGGIO"
                                      ? [
                                          {
                                            rowKind: "DISINSTALLAZIONE" as const,
                                            rowRefId: c.id,
                                            label: "Disinstallazione",
                                          },
                                        ]
                                      : []),
                                  ]}
                                />
                              ) : (
                                <div
                                  style={{
                                    fontSize: 12,
                                    opacity: 0.7,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  —
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.cliente ? (
                            <Link
                              href={`/clienti/${encodeURIComponent(c.cliente)}`}
                              style={{
                                textDecoration: "underline",
                                fontWeight: 700,
                                color: "#2563eb",
                              }}
                              title="Apri scheda cliente"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {c.cliente}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {(() => {
                            const docs = (c.checklist_documents ?? []) as any[];
                            const proformaDocs = docs.filter((d) =>
                              String(d.tipo ?? "")
                                .toUpperCase()
                                .includes("PROFORMA")
                            );
                            const hasProforma = proformaDocs.length > 0;
                            const latest = proformaDocs[0];
                            const titleParts = [];
                            if (c.proforma) {
                              titleParts.push(`Proforma: ${c.proforma}`);
                            } else if (hasProforma) {
                              titleParts.push("Documento PROFORMA presente");
                            }
                            if (latest?.filename) {
                              titleParts.push(`File: ${latest.filename}`);
                            }
                            const title = titleParts.join(" | ");
                            return (
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span>{c.proforma ?? "—"}</span>
                                {hasProforma && (
                                  <span title={title} style={{ cursor: "help" }}>
                                    ✅
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.po ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.data_prevista
                            ? new Date(c.data_prevista).toLocaleDateString()
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.data_tassativa
                            ? new Date(c.data_tassativa).toLocaleDateString()
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.dimensioni ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.passo ?? "—"}</td>
                        <td style={{ padding: "10px 12px", opacity: 0.85, textAlign: "right" }}>
                          {getChecklistM2(c) != null
                            ? getChecklistM2(c)!.toFixed(2)
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.tipo_impianto ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            opacity: 0.85,
                            width: 180,
                            maxWidth: 180,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {renderDashboardAddressCell(c.impianto_indirizzo)}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.data_installazione_reale
                            ? new Date(c.data_installazione_reale).toLocaleDateString()
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.codice ?? "—"}</td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.magazzino_importazione ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.descrizione ?? "—"}</td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.saas_piano
                            ? `${c.saas_piano} — ${saasLabelFromCode(c.saas_piano)}`
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.saas_scadenza
                            ? new Date(c.saas_scadenza).toLocaleDateString()
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            opacity: 0.85,
                            cursor: c.saas_note ? "pointer" : "default",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!c.saas_note) return;
                            setExpandedSaasNoteId((prev) => (prev === c.id ? null : c.id));
                          }}
                        >
                          {c.saas_note ? (
                            <div style={{ display: "grid", gap: 4 }}>
                              <div
                                style={
                                  expandedSaasNoteId === c.id
                                    ? { whiteSpace: "pre-wrap" }
                                    : {
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                      }
                                }
                              >
                                {c.saas_note}
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  opacity: 0.6,
                                  userSelect: "none",
                                }}
                              >
                                {expandedSaasNoteId === c.id
                                  ? "clicca per chiudere"
                                  : "clicca per espandere"}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          {renderBadge(getExpiryStatus(c.saas_scadenza))}
                        </td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              alignItems: "flex-start",
                            }}
                          >
                            <span>
                              {c.garanzia_scadenza
                                ? new Date(c.garanzia_scadenza).toLocaleDateString()
                                : "—"}
                            </span>
                            <span>{renderBadge(getExpiryStatus(c.garanzia_scadenza))}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.licenze_attive != null ? c.licenze_attive : 0}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span>
                              {c.licenze_prossima_scadenza
                                ? new Date(c.licenze_prossima_scadenza).toLocaleDateString()
                                : "—"}
                            </span>
                            {renderBadge(getExpiryStatus(c.licenze_prossima_scadenza))}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.licenze_dettaglio ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                            <span>{getProjectStatusLabel(c)}</span>
                            {getProjectNoleggioState(c).isNoleggioAttivo ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: "#dbeafe",
                                  color: "#1d4ed8",
                                }}
                              >
                                NOLEGGIO ATTIVO
                              </span>
                            ) : null}
                            {getProjectNoleggioState(c).disinstallazioneImminente ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: "#ffedd5",
                                  color: "#c2410c",
                                }}
                              >
                                ⚠ Disinstallazione imminente
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.documenti)}</td>
                        <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.sezione_1)}</td>
                        <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.sezione_2)}</td>
                        <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.sezione_3)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {renderStatusBadge(c.stato_complessivo)}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.pct_complessivo != null
                            ? `${Math.round(c.pct_complessivo)}%`
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.75 }}>
                          {new Date(c.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.75 }}>
                          {c.updated_at ? new Date(c.updated_at).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {formatOperatoreRef(c.created_by_operatore)}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {formatOperatoreRef(c.updated_by_operatore)}
                        </td>
                        <td style={{ padding: "10px 12px", display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/checklists/${c.id}`);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #2563eb",
                              background: "white",
                              color: "#2563eb",
                              cursor: "pointer",
                            }}
                          >
                            Apri
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              backupAndDeleteChecklist(c.id);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #dc2626",
                              background: "white",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            Elimina
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                  </table>
                </DashboardTable>

          {displayRows.length === 0 && (
            <div style={{ padding: 14, opacity: 0.7 }}>Nessun risultato</div>
          )}
        </div>
      </div>
    )}
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
            {addInterventoError && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#dc2626" }}>
                {addInterventoError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => closeAddIntervento("cancel")}
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
                onClick={() => {
                  if (!addInterventoCliente || !addInterventoChecklistId) {
                    setAddInterventoError("Seleziona cliente e progetto.");
                    return;
                  }
                  const params = new URLSearchParams();
                  params.set("focus", "interventi");
                  params.set("addIntervento", "1");
                  if (addInterventoDescrizione.trim()) {
                    params.set("descrizione", addInterventoDescrizione.trim());
                  }
                  router.push(`/checklists/${addInterventoChecklistId}?${params.toString()}`);
                  closeAddIntervento("submit");
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Continua
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
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
        .dashboard-scadenze-card {
          grid-column: span 2 / span 2;
          width: 100%;
          max-width: none;
        }
        .dashboard-fatture-card {
          grid-column: 5 / span 1;
          width: 100%;
          max-width: none;
          justify-self: stretch;
          min-width: 0;
        }
        .dashboard-fatture-card :global(a) {
          height: 100%;
        }
        .dashboard-scadenze-shell {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
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
          .dashboard-scadenze-card,
          .dashboard-fatture-card {
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
