"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const SAAS_PIANI = [
  { code: "SAS-PL", label: "CARE PLUS (ASSISTENZA BASE)" },
  { code: "SAS-PR", label: "CARE PREMIUM (ASSISTENZA AVANZATA + MONITORAGGIO)" },
  { code: "SAS-UL", label: "CARE ULTRA (ASSISTENZA PRIORITARIA / H24 SE PREVISTA)" },
  { code: "SAS-PR4", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H4)" },
  { code: "SAS-PR8", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H8)" },
  { code: "SAS-PR12", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H12)" },
  { code: "SAS-PR24", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H24)" },
  { code: "SAS-PR36", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H36)" },
  { code: "SAS-UL4", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAS-UL8", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAS-UL12", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAS-UL24", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAS-UL36", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAS-EVTF", label: "ART TECH EVENT (assistenza remota durante eventi)" },
  { code: "SAS-EVTO", label: "ART TECH EVENT (assistenza onsite durante eventi)" },
  { code: "SAS-MON", label: "MONITORAGGIO REMOTO & ALERT" },
  { code: "SAS-TCK", label: "TICKETING / HELP DESK" },
  { code: "SAS-SIM", label: "CONNETTIVITÀ SIM DATI" },
  { code: "SAS-CMS", label: "LICENZA CMS / SOFTWARE TERZI" },
  { code: "SAS-BKP", label: "BACKUP CONFIGURAZIONI / RIPRISTINO" },
  { code: "SAS-RPT", label: "REPORTISTICA (LOG, UPTIME, ON-AIR)" },
  { code: "SAS-SLA", label: "SLA RIPRISTINO (ES. ENTRO 2H) – OPZIONE" },
  { code: "SAS-EXT", label: "ESTENSIONE GARANZIA / COPERTURE" },
  { code: "SAS-CYB", label: "CYBER / ANTIVIRUS / HARDENING PLAYER" },
];

function saasLabelFromCode(code?: string | null) {
  if (!code) return "";
  const found = SAAS_PIANI.find((p) => p.code === code);
  return found ? found.label : "";
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
  m2_inclusi: number | null;
  m2_allocati: number | null;

  // date & campi progetto
  data_prevista: string | null;
  data_tassativa: string | null;
  tipo_impianto: string | null;
  dimensioni: string | null;
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
  nome: string | null;
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

function calcM2(dimensioni: string | null): number | null {
  if (!dimensioni) return null;
  const raw = dimensioni.replace(/\s+/g, "").replace(/,/g, ".");
  const parts = raw.split("x");
  if (parts.length !== 2) return null;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const m2 = w * h;
  return Math.round(m2 * 100) / 100;
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
  const [operatori, setOperatori] = useState<OperatoreRow[]>([]);
  const [currentOperatoreId, setCurrentOperatoreId] = useState<string>("");
  const [expandedSaasNoteId, setExpandedSaasNoteId] = useState<string | null>(null);
  const scrollTopRef = useRef<HTMLDivElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const [serialsByChecklistId, setSerialsByChecklistId] = useState<
    Record<string, { seriali: string[] }>
  >({});

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

  const operatoriById = useMemo(() => {
    const map = new Map<string, OperatoreRow>();
    operatori.forEach((o) => {
      if (o.id) map.set(o.id, o);
    });
    return map;
  }, [operatori]);

  const isUltraOrPremium =
    saasPiano.startsWith("SAS-UL") || saasPiano.startsWith("SAS-PR");

  const strutturaOptions = useMemo(() => {
    return catalogItems.filter((item) => {
      const code = (item.codice ?? "").toUpperCase();
      return code.startsWith("STR-") || code === "TEC-STRCT";
    });
  }, [catalogItems]);

  // dashboard: ricerca + ordinamento
  const [q, setQ] = useState("");
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<
    | "created_at"
    | "nome_checklist"
    | "cliente"
    | "codice"
    | "descrizione"
    | "passo"
    | "tipo_impianto"
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
    if (key === "m2_calcolati") return calcM2(row.dimensioni);
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
        c.dimensioni ?? "",
        calcM2(c.dimensioni) != null ? calcM2(c.dimensioni)?.toFixed(2) ?? "" : "",
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
  }, [items, q, sortKey, sortDir, serialsByChecklistId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("checklists")
      .select(
        `
        *,
        checklist_documents:checklist_documents (
          id,
          tipo,
          filename,
          uploaded_at
        )
      `
      )
      .order("created_at", { ascending: false });

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

      const merged = (data as Checklist[]).map((c) => ({
        ...c,
        ...(sectionsByChecklistId[c.id] || {}),
        ...(licenzeByChecklistId[c.id] || {}),
        ...(mainByChecklistId[c.id] || {}),
        license_search: licenseSearchByChecklistId.get(c.id) || null,
      }));
      setItems(merged as Checklist[]);
    }

    const { data: catalogItems, error: catalogErr } = await supabase
      .from("catalog_items")
      .select("id, codice, descrizione, tipo, categoria, attivo")
      .eq("attivo", true)
      .order("descrizione", { ascending: true });

    if (catalogErr) {
      console.error("Errore caricamento catalogo", catalogErr);
    } else {
      console.log("catalogItems", catalogItems);
      setCatalogItems((catalogItems || []) as CatalogItem[]);
    }

    const { data: operatoriData, error: operatoriErr } = await supabase
      .from("operatori")
      .select("id, nome, attivo")
      .eq("attivo", true)
      .order("nome", { ascending: true });

    if (operatoriErr) {
      console.error("Errore caricamento operatori", operatoriErr);
    } else {
      setOperatori((operatoriData || []) as OperatoreRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const top = scrollTopRef.current;
    const body = scrollBodyRef.current;
    if (!top || !body) return;
    const syncFromTop = () => {
      if (body.scrollLeft !== top.scrollLeft) body.scrollLeft = top.scrollLeft;
    };
    const syncFromBody = () => {
      if (top.scrollLeft !== body.scrollLeft) top.scrollLeft = body.scrollLeft;
    };
    top.addEventListener("scroll", syncFromTop);
    body.addEventListener("scroll", syncFromBody);
    return () => {
      top.removeEventListener("scroll", syncFromTop);
      body.removeEventListener("scroll", syncFromBody);
    };
  }, []);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentOperatoreId) {
      window.localStorage.setItem("current_operatore_id", currentOperatoreId);
    } else {
      window.localStorage.removeItem("current_operatore_id");
    }
  }, [currentOperatoreId]);

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
      m2_inclusi: null,
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
      const { data: tpl, error: tplErr } = await supabase
        .from("checklist_template_items")
        .select("sezione, ordine, voce")
        .eq("attivo", true)
        .order("sezione", { ascending: true })
        .order("ordine", { ascending: true });

      if (tplErr) {
        logSupabaseError(tplErr);
        throw tplErr;
      }

      const rows = (tpl ?? []).map((t: any) => {
        console.log("TEMPLATE sezione raw:", t.sezione, "mapped:", mapSezioneToInt(t.sezione));
        return {
        checklist_id: checklistId,
        sezione: mapSezioneToInt(t.sezione), // int4
        ordine: t.ordine, // int4
        titolo: t.voce ?? t.titolo, // testo task
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

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>DASH BOARD</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            Operatore corrente<br />
            <select
              value={currentOperatoreId}
              onChange={(e) => setCurrentOperatoreId(e.target.value)}
              style={{ padding: "6px 8px", minWidth: 200 }}
            >
              <option value="">—</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome ?? o.id}
                </option>
              ))}
            </select>
          </label>

          <Link
            href="/catalogo"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Catalogo
          </Link>

          <Link
            href="/impostazioni/operatori"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Operatori
          </Link>

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
        </div>
      </div>

      {!currentOperatoreId && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b" }}>
          Seleziona operatore per tracciare le modifiche.
        </div>
      )}

      {/* Nuova checklist spostata su /checklists/nuova */}

      {!showForm && (
        <div style={{ marginTop: 20 }}>
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

                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Risultati: {displayRows.length}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 14,
                  background: "white",
                }}
              >
                <div
                  ref={scrollTopRef}
                  style={{
                    overflowX: "auto",
                    overflowY: "hidden",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ width: 4480, height: 10 }} />
                </div>
                <div ref={scrollBodyRef} style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 4480,
                      tableLayout: "fixed",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                <colgroup>
                  <col style={{ width: 220 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 240 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 260 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 110 }} />
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
                          {c.magazzino_importazione ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.dimensioni ?? "—"}</td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.passo ?? "—"}</td>
                        <td style={{ padding: "10px 12px", opacity: 0.85, textAlign: "right" }}>
                          {calcM2(c.dimensioni) != null
                            ? calcM2(c.dimensioni)!.toFixed(2)
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.tipo_impianto ?? "—"}
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
                          {c.data_installazione_reale
                            ? new Date(c.data_installazione_reale).toLocaleDateString()
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.codice ?? "—"}</td>
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
                        <td style={{ padding: "10px 12px" }}>
                          {renderBadge(getExpiryStatus(c.saas_scadenza))}
                        </td>
                        <td style={{ padding: "10px 12px", overflow: "hidden" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            <span>
                              {c.garanzia_scadenza
                                ? new Date(c.garanzia_scadenza).toLocaleDateString()
                                : "—"}
                            </span>
                            <span style={{ flexShrink: 0 }}>
                              {renderBadge(getExpiryStatus(c.garanzia_scadenza))}
                            </span>
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
                          {c.created_by_operatore
                            ? operatoriById.get(c.created_by_operatore)?.nome ?? "—"
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                          {c.updated_by_operatore
                            ? operatoriById.get(c.updated_by_operatore)?.nome ?? "—"
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
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
                </div>

                {displayRows.length === 0 && (
                  <div style={{ padding: 14, opacity: 0.7 }}>Nessun risultato</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
