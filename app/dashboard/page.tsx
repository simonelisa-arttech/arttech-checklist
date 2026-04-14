"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import DashboardProjectsSection from "@/components/dashboard/DashboardProjectsSection";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

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
  tipo_saas: string | null;
  saas_piano: string | null;
  saas_scadenza: string | null;
  saas_stato: string | null;
  saas_tipo: string | null;
  saas_note: string | null;
  m2_calcolati: number | null;
  m2_inclusi: number | null;
  m2_allocati: number | null;
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
  garanzia_stato: string | null;
  garanzia_scadenza: string | null;
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

type SortDir = "asc" | "desc";
type SortKey =
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
  | "updated_at";

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

function getSortRaw(row: Checklist, key: SortKey) {
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

export default function DashboardPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const router = useRouter();
  const [items, setItems] = useState<Checklist[]>([]);
  const [allProjects, setAllProjects] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const [operatoriLookupById, setOperatoriLookupById] = useState<
    Map<string, { nome: string | null; email: string | null }>
  >(new Map());
  const [expandedSaasNoteId, setExpandedSaasNoteId] = useState<string | null>(null);
  const [expandedDashboardNoteId, setExpandedDashboardNoteId] = useState<string | null>(null);
  const [serialsByChecklistId, setSerialsByChecklistId] = useState<
    Record<string, { seriali: string[] }>
  >({});
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
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function formatOperatoreRef(refId?: string | null) {
    if (!refId) return "—";
    const found = operatoriLookupById.get(refId);
    if (!found) return refId;
    if (found.nome && found.email) return `${found.nome} (${found.email})`;
    if (found.nome) return found.nome;
    if (found.email) return found.email;
    return refId;
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
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
        getChecklistM2(c) != null ? getChecklistM2(c)?.toFixed(2) ?? "" : "",
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
        c.data_installazione_reale ? new Date(c.data_installazione_reale).toLocaleDateString() : "",
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

    return [...filtered].sort((a, b) => {
      const aVal = getSortRaw(a, sortKey);
      const bVal = getSortRaw(b, sortKey);
      const aEmpty = aVal == null || aVal === "";
      const bEmpty = bVal == null || bVal === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      return cmp(aVal, bVal) * dir;
    });
  }, [allProjects, q, saasServiceFilter, projectStatusFilter, sortKey, sortDir, serialsByChecklistId]);

  async function load() {
    const requestSeq = ++loadRequestSeqRef.current;
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isLatest = () => requestSeq === loadRequestSeqRef.current;

    setLoading(true);
    setDashboardLoadError(null);

    try {
      const dashboardRes = await fetch("/api/dashboard", {
        signal: controller.signal,
        credentials: "include",
      });
      const dashboardData = await dashboardRes.json().catch(() => ({}));
      if (!dashboardRes.ok) {
        if (!isLatest()) return;
        setDashboardLoadError(String(dashboardData?.error || "Errore caricamento dashboard"));
        return;
      }

      const data = (dashboardData?.data?.checklists as any[]) || [];
      const sections = (dashboardData?.data?.sections as any[]) || [];
      const licenseSummary = (dashboardData?.data?.licenseSummary as any[]) || [];
      const licensesData = (dashboardData?.data?.licenses as any[]) || [];
      const serialsData = (dashboardData?.data?.serials as any[]) || [];

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

      const opRes = await fetch("/api/operatori", { signal: controller.signal, credentials: "include" });
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
      setDashboardLoadError(String(e?.message || "Errore caricamento dashboard"));
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

  async function backupAndDeleteChecklist(checklistId: string) {
    const ok = window.confirm("Eliminare questo PROGETTO? Verrà salvato in backup per 30 giorni.");
    if (!ok) return;

    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    const res = await fetch(`/api/checklists/delete-with-backup${debug ? "?debug=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ checklist_id: checklistId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert("Errore eliminazione PROGETTO: " + (data?.error || "Operazione fallita"));
      return;
    }

    await load();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flexShrink: 0, minWidth: 190 }}>
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>CLIENTI</div>
        </div>
      </div>

      {dashboardLoadError && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          {dashboardLoadError}
        </div>
      )}

      <DashboardProjectsSection
        loading={loading}
        itemsCount={items.length}
        q={q}
        setQ={setQ}
        saasServiceFilter={saasServiceFilter}
        setSaasServiceFilter={setSaasServiceFilter}
        projectStatusFilter={projectStatusFilter}
        setProjectStatusFilter={setProjectStatusFilter}
        displayRows={displayRows}
        toggleSort={toggleSort}
        sortIcon={sortIcon}
        expandedDashboardNoteId={expandedDashboardNoteId}
        setExpandedDashboardNoteId={setExpandedDashboardNoteId}
        expandedSaasNoteId={expandedSaasNoteId}
        setExpandedSaasNoteId={setExpandedSaasNoteId}
        onOpenProject={(projectId) => router.push(`/checklists/${projectId}`)}
        onDeleteProject={backupAndDeleteChecklist}
        getChecklistM2={getChecklistM2}
        renderDashboardAddressCell={renderDashboardAddressCell}
        saasLabelFromCode={saasLabelFromCode}
        getExpiryStatus={getExpiryStatus}
        renderBadge={renderBadge}
        renderStatusBadge={renderStatusBadge}
        getProjectStatusLabel={getProjectStatusLabel}
        getProjectNoleggioState={getProjectNoleggioState}
        formatOperatoreRef={formatOperatoreRef}
      />
    </div>
  );
}
