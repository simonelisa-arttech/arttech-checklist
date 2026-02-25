"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import DashboardTable from "./components/DashboardTable";
import Toast from "@/components/Toast";
import { isAdminRole } from "@/lib/adminRoles";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

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
type ProjectStatusFilter = "IN_CORSO" | "CONSEGNATO" | "SOSPESO" | "CHIUSO";

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

function normalizeProjectStatus(value?: string | null): ProjectStatusFilter | null {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (raw === "IN_CORSO") return "IN_CORSO";
  if (raw === "CONSEGNATO") return "CONSEGNATO";
  if (raw === "SOSPESO") return "SOSPESO";
  if (raw === "CHIUSO") return "CHIUSO";
  return null;
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

type Checklist = {
  id: string;
  cliente: string;
  cliente_id?: string | null;
  clienti_anagrafica?: { denominazione: string | null } | null;
  nome_checklist: string;
  proforma: string | null;
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
  dimensioni: string | null;
  impianto_quantita: number | null;
  numero_facce: number | null;
  passo: string | null;
  note: string | null;
  tipo_struttura: string | null;
  noleggio_vendita: string | null;
  fine_noleggio: string | null;
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

export default function Page() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const router = useRouter();
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [expandedSaasNoteId, setExpandedSaasNoteId] = useState<string | null>(null);
  const [serialsByChecklistId, setSerialsByChecklistId] = useState<
    Record<string, { seriali: string[] }>
  >({});

  // duplicazione progetto
  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupSourceId, setDupSourceId] = useState<string | null>(null);
  const [dupNewName, setDupNewName] = useState("");
  const [dupSaving, setDupSaving] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
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

  // righe (voci/prodotti)
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
  const canAccessSettings = isAdminRole(currentOperatoreLabel?.ruolo);

  function formatOperatoreRef(refId?: string | null) {
    if (!refId) return "—";
    const found = operatoriLookupById.get(refId);
    if (!found) return refId;
    if (found.nome && found.email) return `${found.nome} (${found.email})`;
    if (found.nome) return found.nome;
    if (found.email) return found.email;
    return refId;
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
    SOSPESO: false,
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

    const filtered = items.filter((c) => {
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
        const status = normalizeProjectStatus(c.stato_progetto);
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
  }, [items, q, saasServiceFilter, projectStatusFilter, sortKey, sortDir, serialsByChecklistId]);

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

  async function load() {
    setLoading(true);
    const baseSelect = `
        *,
        checklist_documents:checklist_documents (
          id,
          tipo,
          filename,
          uploaded_at
        )
      `;

    const joinSelect = `
        *,
        clienti_anagrafica:cliente_id(denominazione),
        checklist_documents:checklist_documents (
          id,
          tipo,
          filename,
          uploaded_at
        )
      `;

    let data: any[] | null = null;
    let error: any = null;

    // Try with join first (if schema exists). Fallback to legacy query on error.
    const joinRes = await supabase
      .from("checklists")
      .select(joinSelect)
      .order("created_at", { ascending: false });

    if (joinRes.error) {
      console.warn("[dashboard] clienti_anagrafica join failed, fallback", joinRes.error);
      const legacyRes = await supabase
        .from("checklists")
        .select(baseSelect)
        .order("created_at", { ascending: false });
      data = legacyRes.data as any[] | null;
      error = legacyRes.error;
    } else {
      data = joinRes.data as any[] | null;
      error = joinRes.error;
    }

    const { data: sections, error: sectionsErr } = await supabase
      .from("checklist_sections_view")
      .select("*");

    const { data: licenseSummary, error: licenseErr } = await supabase
      .from("license_summary_view")
      .select("*");

    const { data: licensesData, error: licensesErr } = await supabase
      .from("licenses")
      .select(
        "id, checklist_id, tipo, scadenza, note, ref_univoco, telefono, intestatario, gestore, fornitore"
      );

    const { data: mainItems, error: mainItemsErr } = await supabase
      .from("checklist_main_item_view")
      .select("checklist_id, codice, descrizione");

    const { data: serialsData, error: serialsErr } = await supabase
      .from("asset_serials")
      .select("checklist_id, seriale");

    const sectionsByChecklistId: Record<string, Partial<Checklist>> = {};
    if (!sectionsErr && sections) {
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
    }

    const licenzeByChecklistId: Record<string, Partial<Checklist>> = {};
    if (licenseErr) {
      console.error("Errore caricamento license_summary_view", licenseErr);
    } else if (licenseSummary) {
      for (const r of licenseSummary as any[]) {
        const checklistId = String(r.checklist_id ?? "");
        if (!checklistId) continue;
        licenzeByChecklistId[checklistId] = {
          licenze_attive: r.licenze_attive ?? 0,
          licenze_prossima_scadenza: r.licenze_prossima_scadenza ?? null,
          licenze_dettaglio: r.licenze_dettaglio ?? null,
        };
      }
    }

    const mainByChecklistId: Record<string, { codice: string | null; descrizione: string | null }> =
      {};
    if (mainItemsErr) {
      console.error("Errore caricamento main items", mainItemsErr);
    } else if (mainItems) {
      for (const r of mainItems as any[]) {
        const checklistId = String(r.checklist_id ?? "");
        if (!checklistId) continue;
        if (!mainByChecklistId[checklistId]) {
          mainByChecklistId[checklistId] = {
            codice: r.codice ?? null,
            descrizione: r.descrizione ?? null,
          };
        }
      }
    }

    if (serialsErr) {
      console.error("Errore caricamento seriali", serialsErr);
    } else if (serialsData) {
      const map: Record<string, { seriali: string[] }> = {};
      for (const r of serialsData as any[]) {
        const checklistId = String(r.checklist_id ?? "");
        if (!checklistId) continue;
        if (!map[checklistId]) map[checklistId] = { seriali: [] };
        if (r.seriale) map[checklistId].seriali.push(String(r.seriale));
      }
      setSerialsByChecklistId(map);
    }

    if (!error && data) {
      const licenseSearchByChecklistId = new Map<string, string>();
      if (licensesErr) {
        console.error("Errore caricamento licenses", licensesErr);
      } else if (licensesData) {
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
          licenseSearchByChecklistId.set(
            checklistId,
            prev ? `${prev} ${parts.join(" ")}` : parts.join(" ")
          );
        }
      }

      const merged = (data as Checklist[]).map((c) => {
        const clienteLabel =
          (c as any).clienti_anagrafica?.denominazione?.trim() || c.cliente || "";
        return {
          ...c,
          cliente: clienteLabel || c.cliente,
          ...(sectionsByChecklistId[c.id] || {}),
          ...(licenzeByChecklistId[c.id] || {}),
          ...(mainByChecklistId[c.id] || {}),
          license_search: licenseSearchByChecklistId.get(c.id) || null,
        };
      });
      setItems(merged as Checklist[]);
    } else if (error) {
      console.error("Errore caricamento checklists (dashboard)", error);
    }

    const { data: catalogItems, error: catalogErr } = await supabase
      .from("catalog_items")
      .select("id, codice, descrizione, tipo, categoria, attivo")
      .eq("attivo", true)
      .order("descrizione", { ascending: true });

    if (catalogErr) {
      console.error("Errore caricamento catalogo", catalogErr);
    } else {
      setCatalogItems((catalogItems || []) as CatalogItem[]);
    }

    const opRes = await fetch("/api/operatori");
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
    const meRes = await fetch("/api/me-operatore");
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

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const closeDupModal = (_reason?: string) => {
    setDupModalOpen(false);
  };

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

  useEffect(() => {
    const channel = supabase
      .channel("rt-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_tasks" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

    const { data: created, error: errCreate } = await supabase
      .from("checklists")
      .insert(payloadChecklist)
      .select("id")
      .single();

    if (errCreate) {
      const info = logSupabaseError(errCreate);
      alert("Errore insert PROGETTO: " + (info || errCreate.message));
      return;
    }
    if (!created?.id) {
      alert("Errore: id PROGETTO non ricevuto");
      return;
    }

    const checklistId = created.id as string;

    // 1) crea tasks da template (solo se non esistono già)
    const { count: existingTasksCount, error: existingTasksErr } = await supabase
      .from("checklist_tasks")
      .select("id", { count: "exact", head: true })
      .eq("checklist_id", checklistId);

    if (existingTasksErr) {
      logSupabaseError(existingTasksErr);
      throw existingTasksErr;
    }

    function mapSezioneToInt(raw: any): number {
      if (raw === null || raw === undefined) return 0;
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      const s0 = String(raw).toUpperCase().trim();
      const s = s0.replace(/[\s\-]+/g, "_"); // spazi/trattini -> _
      if (s.includes("DOCUMENTI")) return 0;
      if (s.includes("SEZIONE_1") || s.includes("SEZIONE1") || s.includes("SEZIONE_01"))
        return 1;
      if (s.includes("SEZIONE_2") || s.includes("SEZIONE2") || s.includes("SEZIONE_02"))
        return 2;
      if (s.includes("SEZIONE_3") || s.includes("SEZIONE3") || s.includes("SEZIONE_03"))
        return 3;
      if (s.includes("_1")) return 1;
      if (s.includes("_2")) return 2;
      if (s.includes("_3")) return 3;
      return 0;
    }

    if ((existingTasksCount ?? 0) === 0) {
      let tpl: any[] | null = null;
      let tplErr: any = null;
      const mapTaskTemplateRows = (rows: any[] | null | undefined) =>
        (rows || []).map((x: any) => ({
          sezione: x.sezione,
          ordine: x.ordine,
          titolo: x.titolo ?? x.voce,
          target: x.target ?? null,
        }));

      {
        const res = await supabase
          .from("checklist_task_templates")
          .select("sezione, ordine, titolo, target")
          .eq("attivo", true)
          .order("sezione", { ascending: true })
          .order("ordine", { ascending: true });
        tpl = mapTaskTemplateRows(res.data as any[] | null);
        tplErr = res.error;
      }

      if (tplErr && String(tplErr.message || "").toLowerCase().includes("target")) {
        const res = await supabase
          .from("checklist_task_templates")
          .select("sezione, ordine, titolo")
          .eq("attivo", true)
          .order("sezione", { ascending: true })
          .order("ordine", { ascending: true });
        tpl = mapTaskTemplateRows(res.data as any[] | null);
        tplErr = res.error;
      }

      if (
        tplErr &&
        String(tplErr.message || "").toLowerCase().includes("checklist_task_templates")
      ) {
        const res = await supabase
          .from("checklist_template_items")
          .select("sezione, ordine, voce")
          .eq("attivo", true)
          .order("sezione", { ascending: true })
          .order("ordine", { ascending: true });
        tpl = mapTaskTemplateRows(res.data as any[] | null);
        tplErr = res.error;
      }

      if (tplErr) {
        logSupabaseError(tplErr);
        throw tplErr;
      }

      const rows = (tpl ?? []).map((t: any) => {
        return {
        checklist_id: checklistId,
        sezione: mapSezioneToInt(t.sezione), // int4
        ordine: t.ordine, // int4
        titolo: t.titolo, // testo task
        target: inferTaskTarget(t.titolo, t.target),
        stato: "DA_FARE",
        };
      });

      if (rows.length) {
        const { error: insErr } = await supabase
          .from("checklist_tasks")
          .insert(rows);

        if (insErr) {
          logSupabaseError(insErr);
          throw insErr;
        }
      }
    }

    // 2A) Auto-seed checklist template -> checklist_checks
    const { data: tmpl, error: tmplErr } = await supabase
      .from("checklist_template_items")
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

      const { error: seedErr } = await supabase
        .from("checklist_checks")
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

      const { error: errItems } = await supabase
        .from("checklist_items")
        .insert(payloadItems);

      if (errItems) {
        const info = logSupabaseError(errItems);
        console.error("ERRORE INSERT progetto_items", errItems);
        alert(
          "Errore insert righe: " +
            (info || errItems.message || "") +
            (errItems.details ? `\nDettagli: ${errItems.details}` : "") +
            (errItems.hint ? `\nHint: ${errItems.hint}` : "")
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

  function openDuplicateModal(checklistId: string) {
    const source = items.find((c) => c.id === checklistId);
    if (!source) return;
    setDupSourceId(checklistId);
    setDupNewName(`COPIA - ${source.nome_checklist || "Senza nome"}`);
    setDupError(null);
    setDupModalOpen(true);
  }

  async function duplicateChecklist() {
    if (!dupSourceId || !dupNewName.trim()) return;
    setDupSaving(true);
    setDupError(null);
    try {
      const { data: source, error: srcErr } = await supabase
        .from("checklists")
        .select("*")
        .eq("id", dupSourceId)
        .single();
      if (srcErr || !source) throw new Error(srcErr?.message || "Progetto non trovato");

      // Campi da copiare (progetto/impianto), escludendo id, timestamps, stato operativo
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        stato_progetto: _sp,
        created_by_operatore: _cbo,
        updated_by_operatore: _ubo,
        checklist_documents: _docs,
        // campi vista/aggregazione che non fanno parte della tabella
        sezione_documenti: _sd,
        sezione_1: _s1,
        sezione_2: _s2,
        sezione_3: _s3,
        stato_complessivo: _sc,
        pct_complessivo: _pc,
        license_count: _lc,
        next_license_expiry: _nle,
        main_item_codice: _mic,
        main_item_descrizione: _mid,
        ...copyFields
      } = source as any;

      const payload: Record<string, any> = {
        ...copyFields,
        nome_checklist: dupNewName.trim(),
        stato_progetto: "IN_CORSO",
        created_by_operatore: currentOperatoreId || null,
        updated_by_operatore: currentOperatoreId || null,
      };

      const { data: created, error: insErr } = await supabase
        .from("checklists")
        .insert(payload)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      if (!created?.id) throw new Error("ID non ricevuto");

      const newId = created.id as string;

      // Duplica checklist_items (BOM)
      const { data: srcItems } = await supabase
        .from("checklist_items")
        .select("codice, descrizione, quantita, note")
        .eq("checklist_id", dupSourceId);
      if (srcItems && srcItems.length > 0) {
        const itemRows = srcItems.map((r: any) => ({
          checklist_id: newId,
          codice: r.codice,
          descrizione: r.descrizione,
          quantita: r.quantita,
          note: r.note,
        }));
        await supabase.from("checklist_items").insert(itemRows);
      }

      // Duplica checklist_tasks (attività da template)
      const { data: srcTasks } = await supabase
        .from("checklist_tasks")
        .select("sezione, ordine, titolo, task_template_id, target")
        .eq("checklist_id", dupSourceId);
      if (srcTasks && srcTasks.length > 0) {
        const taskRows = srcTasks.map((r: any) => ({
          checklist_id: newId,
          sezione: r.sezione,
          ordine: r.ordine,
          titolo: r.titolo,
          stato: "DA_FARE",
          task_template_id: r.task_template_id,
          target: inferTaskTarget(r.titolo, r.target),
        }));
        await supabase.from("checklist_tasks").insert(taskRows);
      }

      closeDupModal("duplicate-success");
      setToastMsg("✅ Progetto duplicato");
      setTimeout(() => router.push(`/checklists/${newId}`), 800);
    } catch (err: any) {
      setDupError(err?.message || "Errore duplicazione");
    } finally {
      setDupSaving(false);
    }
  }

  async function backupAndDeleteChecklist(checklistId: string) {
    const ok = window.confirm("Eliminare questo PROGETTO? Verrà salvato in backup per 30 giorni.");
    if (!ok) return;

    const { data: checklist, error: checklistErr } = await supabase
      .from("checklists")
      .select("*")
      .eq("id", checklistId)
      .single();

    if (checklistErr || !checklist) {
      alert("Errore lettura PROGETTO: " + (checklistErr?.message || "PROGETTO non trovato"));
      return;
    }

    const [itemsRes, tasksRes, licenzeRes, interventiRes] = await Promise.all([
      supabase.from("checklist_items").select("*").eq("checklist_id", checklistId),
      supabase.from("checklist_tasks").select("*").eq("checklist_id", checklistId),
      supabase.from("licenses").select("*").eq("checklist_id", checklistId),
      supabase.from("saas_interventi").select("*").eq("checklist_id", checklistId),
    ]);

    if (itemsRes.error || tasksRes.error || licenzeRes.error || interventiRes.error) {
      alert(
        "Errore lettura dati collegati: " +
          (itemsRes.error?.message ||
            tasksRes.error?.message ||
            licenzeRes.error?.message ||
            interventiRes.error?.message ||
            "")
      );
      return;
    }

    const deletedAt = new Date().toISOString();
    const backupChecklist = {
      checklist_id: checklistId,
      deleted_at: deletedAt,
      data: checklist,
    };
    const { error: backupChecklistErr } = await supabase
      .from("checklists_backup")
      .insert(backupChecklist);

    if (backupChecklistErr) {
      alert("Errore backup PROGETTO: " + backupChecklistErr.message);
      return;
    }

    const backupItems = (itemsRes.data || []).map((r: any) => ({
      checklist_id: checklistId,
      deleted_at: deletedAt,
      data: r,
    }));
    const backupTasks = (tasksRes.data || []).map((r: any) => ({
      checklist_id: checklistId,
      deleted_at: deletedAt,
      data: r,
    }));
    const backupLicenze = (licenzeRes.data || []).map((r: any) => ({
      checklist_id: checklistId,
      deleted_at: deletedAt,
      data: r,
    }));
    const backupInterventi = (interventiRes.data || []).map((r: any) => ({
      checklist_id: checklistId,
      deleted_at: deletedAt,
      data: r,
    }));

    if (backupItems.length > 0) {
      const { error } = await supabase.from("checklist_items_backup").insert(backupItems);
      if (error) {
        alert("Errore backup voci: " + error.message);
        return;
      }
    }

    if (backupTasks.length > 0) {
      const { error } = await supabase.from("checklist_tasks_backup").insert(backupTasks);
      if (error) {
        alert("Errore backup task: " + error.message);
        return;
      }
    }

    if (backupLicenze.length > 0) {
      const { error } = await supabase.from("licenses_backup").insert(backupLicenze);
      if (error) {
        alert("Errore backup licenze: " + error.message);
        return;
      }
    }

    if (backupInterventi.length > 0) {
      const { error } = await supabase.from("saas_interventi_backup").insert(backupInterventi);
      if (error) {
        alert("Errore backup interventi: " + error.message);
        return;
      }
    }

    const { error: delItemsErr } = await supabase
      .from("checklist_items")
      .delete()
      .eq("checklist_id", checklistId);
    if (delItemsErr) {
      alert("Errore eliminazione voci: " + delItemsErr.message);
      return;
    }

    const { error: delTasksErr } = await supabase
      .from("checklist_tasks")
      .delete()
      .eq("checklist_id", checklistId);
    if (delTasksErr) {
      alert("Errore eliminazione task: " + delTasksErr.message);
      return;
    }

    const { error: delLicenzeErr } = await supabase
      .from("licenses")
      .delete()
      .eq("checklist_id", checklistId);
    if (delLicenzeErr) {
      alert("Errore eliminazione licenze: " + delLicenzeErr.message);
      return;
    }

    const { error: delInterventiErr } = await supabase
      .from("saas_interventi")
      .delete()
      .eq("checklist_id", checklistId);
    if (delInterventiErr) {
      alert("Errore eliminazione interventi: " + delInterventiErr.message);
      return;
    }

    const { error: delChecklistErr } = await supabase
      .from("checklists")
      .delete()
      .eq("id", checklistId);
    if (delChecklistErr) {
      alert("Errore eliminazione PROGETTO: " + delChecklistErr.message);
      return;
    }

    await load();
  }

  async function handleLogout() {
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors and proceed with client cleanup
    }
    try {
      localStorage.removeItem("current_operatore_id");
    } catch {
      // ignore
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
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

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {canAccessSettings && (
            <Link
              href="/impostazioni"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              Impostazioni
            </Link>
          )}

          <Link
            href="/checklists/nuova"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: "white",
              textDecoration: "none",
              color: "inherit",
            }}
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
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: "white",
            }}
          >
            + Aggiungi intervento
          </button>
          <Link
            href="/cronoprogramma"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: "white",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Cronoprogramma
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: "white",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {operatoreAssociationError ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b" }}>
          Operatore non associato
        </div>
      ) : currentOperatoreLabel ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#166534" }}>
          Operatore: {currentOperatoreLabel.nome || "—"}
          {currentOperatoreLabel.ruolo ? ` (${currentOperatoreLabel.ruolo})` : ""}
        </div>
      ) : null}

      {/* Nuova checklist spostata su /checklists/nuova */}

      {!showForm && (
        <div style={{ marginTop: 20, paddingBottom: 20 }}>
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
                          SOSPESO: checked,
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
                    In corso
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
                  <col style={{ width: 110 }} />  {/* Data prevista */}
                  <col style={{ width: 110 }} />  {/* Data tassativa */}
                  <col style={{ width: 110 }} />  {/* Dimensioni */}
                  <col style={{ width: 70 }} />   {/* Passo */}
                  <col style={{ width: 70 }} />   {/* m2 */}
                  <col style={{ width: 110 }} />  {/* Tipo impianto */}
                  <col style={{ width: 160 }} />  {/* Indirizzo impianto */}
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
                          {c.nome_checklist}
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
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.impianto_indirizzo ?? "—"}
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
                          {c.stato_progetto ?? "—"}
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
                            data-testid="project-duplicate-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDuplicateModal(c.id);
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
                            Duplica
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
      {dupModalOpen && (
        <div
          data-testid="duplicate-modal"
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
              maxWidth: 480,
              background: "white",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeDupModal("esc");
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14 }}>
              Duplica progetto
            </div>
            <label style={{ display: "block", marginBottom: 14 }}>
              Nome nuovo progetto
              <input
                data-testid="duplicate-name-input"
                value={dupNewName}
                onChange={(e) => setDupNewName(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dupNewName.trim()) duplicateChecklist();
                }}
              />
            </label>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
              Verranno copiati: dati impianto, BOM e attività (resettate a DA_FARE).
              NON verranno copiati: seriali, licenze, SaaS, tagliandi, garanzie, log avvisi.
            </div>
            {dupError && (
              <div style={{ marginBottom: 10, fontSize: 12, color: "#dc2626" }}>
                {dupError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                data-testid="duplicate-cancel-btn"
                onClick={() => closeDupModal("cancel")}
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
                data-testid="duplicate-confirm-btn"
                onClick={duplicateChecklist}
                disabled={dupSaving || !dupNewName.trim()}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: dupSaving || !dupNewName.trim() ? "not-allowed" : "pointer",
                  opacity: dupSaving || !dupNewName.trim() ? 0.6 : 1,
                }}
              >
                {dupSaving ? "Duplicazione..." : "Duplica"}
              </button>
            </div>
          </div>
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
                  params.set("addIntervento", "1");
                  params.set("checklist_id", addInterventoChecklistId);
                  if (addInterventoDescrizione.trim()) {
                    params.set("descrizione", addInterventoDescrizione.trim());
                  }
                  router.push(
                    `/clienti/${encodeURIComponent(addInterventoCliente)}?${params.toString()}`
                  );
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
    </div>
  );
}
