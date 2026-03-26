"use client";

import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import CronoprogrammaPanel from "@/components/cronoprogramma/CronoprogrammaPanel";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  buildOperativiSchedule,
  dateToOperativiIsoDay,
  durationToInputValue,
  normalizeOperativiDate,
} from "@/lib/operativiSchedule";
import { checkOperativiConflicts } from "@/lib/operativiConflicts";

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
  durata_giorni?: number | null;
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
};

type CronoComment = {
  id: string;
  commento: string;
  created_at: string | null;
  created_by_operatore: string | null;
  created_by_nome: string | null;
};

type OperativiFields = {
  data_inizio: string;
  durata_giorni: string;
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
};

const EMPTY_OPERATIVI: OperativiFields = {
  data_inizio: "",
  durata_giorni: "",
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
};

function extractOperativi(meta?: CronoMeta | null): OperativiFields {
  return {
    data_inizio: normalizeOperativiDate(meta?.data_inizio),
    durata_giorni: durationToInputValue(meta?.durata_giorni),
    personale_previsto: String(meta?.personale_previsto || ""),
    personale_ids: Array.isArray(meta?.personale_ids)
      ? meta.personale_ids.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
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

type OperativiScheduleLike = {
  data_inizio?: string | null;
  durata_giorni?: string | number | null;
};

function getRowSchedule(row: TimelineRow, value?: OperativiScheduleLike | null) {
  return buildOperativiSchedule(
    value?.data_inizio ?? null,
    row.data_tassativa || row.data_prevista,
    value?.durata_giorni ?? null
  );
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
  if (personale.length) {
    details.push(`Personale già impegnato: ${personale.join(", ")}`);
  }
  if (mezzi.length) {
    details.push(`Mezzi già impegnati: ${mezzi.join(", ")}`);
  }
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

function downloadCsv(
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

export default function CronoprogrammaPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TimelineRow[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [clienteFilter, setClienteFilter] = useState("TUTTI");
  const [kindFilter, setKindFilter] = useState<"TUTTI" | "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO">("TUTTI");
  const [quickRangeDays, setQuickRangeDays] = useState<7 | 15 | 30 | null>(null);
  const [showFatto, setShowFatto] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [q, setQ] = useState("");
  const [personaleFilter, setPersonaleFilter] = useState("");
  const [sortBy, setSortBy] = useState<"data_prevista" | "data_tassativa">("data_tassativa");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [metaByKey, setMetaByKey] = useState<Record<string, CronoMeta>>({});
  const [commentsByKey, setCommentsByKey] = useState<Record<string, CronoComment[]>>({});
  const [noteDraftByKey, setNoteDraftByKey] = useState<Record<string, string>>({});
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [savingFattoKey, setSavingFattoKey] = useState<string | null>(null);
  const [savingHiddenKey, setSavingHiddenKey] = useState<string | null>(null);
  const [savingCommentKey, setSavingCommentKey] = useState<string | null>(null);
  const [savingOperativiKey, setSavingOperativiKey] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [noteHistoryKey, setNoteHistoryKey] = useState<string | null>(null);
  const [operativiDraftByKey, setOperativiDraftByKey] = useState<Record<string, OperativiFields>>({});
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"top" | "main" | "bottom" | null>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState(4320);

  async function loadRowState(timelineRows: TimelineRow[]) {
    if (!timelineRows.length) {
      setMetaByKey({});
      setCommentsByKey({});
      return;
    }
    setStateLoading(true);
    setStateError(null);
    try {
      const payload = {
        action: "load",
        rows: timelineRows.map((r) => ({
          row_kind: r.kind,
          row_ref_id: r.row_ref_id,
        })),
      };
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data?.error || "");
        if (
          msg.toLowerCase().includes("cronoprogramma_meta") ||
          msg.toLowerCase().includes("cronoprogramma_comments")
        ) {
          setStateError(
            "Funzioni note/fatto non attive: esegui script scripts/20260227_add_cronoprogramma_meta_comments.sql"
          );
        } else {
          setStateError(msg || "Errore caricamento stato cronoprogramma");
        }
        setMetaByKey({});
        setCommentsByKey({});
        return;
      }
      const nextMeta = (data?.meta as Record<string, CronoMeta>) || {};
      setMetaByKey(nextMeta);
      setOperativiDraftByKey((prev) => {
        const next = { ...prev };
        for (const r of timelineRows) {
          const key = getRowKey(r.kind, r.row_ref_id);
          if (!next[key]) {
            next[key] = extractOperativi(nextMeta[key]);
          }
        }
        return next;
      });
      setCommentsByKey((data?.comments as Record<string, CronoComment[]>) || {});
    } finally {
      setStateLoading(false);
    }
  }

  async function setFatto(row: TimelineRow, fatto: boolean) {
    const key = getRowKey(row.kind, row.row_ref_id);
    setSavingFattoKey(key);
    setStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_fatto",
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
          fatto,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStateError(data?.error || "Errore salvataggio stato fatto");
        return;
      }
      setMetaByKey((prev) => ({ ...prev, [key]: data?.meta }));
      setRows((prev) =>
        prev.map((r) =>
          r.kind === row.kind && r.row_ref_id === row.row_ref_id ? { ...r, fatto } : r
        )
      );
    } finally {
      setSavingFattoKey(null);
    }
  }

  async function setHidden(row: TimelineRow, hidden: boolean) {
    const key = getRowKey(row.kind, row.row_ref_id);
    setSavingHiddenKey(key);
    setStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_hidden",
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
          hidden,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStateError(data?.error || "Errore salvataggio stato nascosta");
        return;
      }
      setMetaByKey((prev) => ({ ...prev, [key]: data?.meta }));
    } finally {
      setSavingHiddenKey(null);
    }
  }

  async function addComment(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const commento = String(noteDraftByKey[key] || "").trim();
    if (!commento) return;
    setSavingCommentKey(key);
    setStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_comment",
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
          commento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStateError(data?.error || "Errore salvataggio commento");
        return;
      }
      setNoteDraftByKey((prev) => ({ ...prev, [key]: "" }));
      setCommentsByKey((prev) => ({
        ...prev,
        [key]: [data?.comment, ...(prev[key] || [])].filter(Boolean),
      }));
    } finally {
      setSavingCommentKey(null);
    }
  }

  async function saveOperativi(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const draft = operativiDraftByKey[key] || EMPTY_OPERATIVI;
    setSavingOperativiKey(key);
    setStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_operativi",
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
          ...draft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStateError(data?.error || "Errore salvataggio dati operativi");
        return;
      }
      setMetaByKey((prev) => ({ ...prev, [key]: data?.meta }));
      setOperativiDraftByKey((prev) => ({ ...prev, [key]: extractOperativi(data?.meta || null) }));
    } finally {
      setSavingOperativiKey(null);
    }
  }

  async function deleteComment(row: TimelineRow, commentId: string) {
    const safeId = String(commentId || "").trim();
    if (!safeId) return;
    setDeletingCommentId(safeId);
    setStateError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_comment",
          comment_id: safeId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStateError(data?.error || "Errore eliminazione commento");
        return;
      }
      const key = getRowKey(row.kind, row.row_ref_id);
      setCommentsByKey((prev) => ({
        ...prev,
        [key]: (prev[key] || []).filter((c) => c.id !== safeId),
      }));
    } finally {
      setDeletingCommentId(null);
    }
  }

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getTime());
    from.setDate(from.getDate() - 7);
    const to = new Date(now.getTime());
    to.setDate(to.getDate() + 60);
    setFromDate(dateToOperativiIsoDay(from));
    setToDate(dateToOperativiIsoDay(to));
  }, []);

  function applyQuickRange(days: 7 | 15 | 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = new Date(today.getTime());
    to.setDate(to.getDate() + days);
    setFromDate(dateToOperativiIsoDay(today));
    setToDate(dateToOperativiIsoDay(to));
    setQuickRangeDays(days);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/cronoprogramma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "load_events" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(String(data?.error || "Errore caricamento cronoprogramma"));
          setRows([]);
          return;
        }
        const timeline = ((data?.events as TimelineRow[]) || []).map((r) => ({
          ...r,
          tipologia: String(r.tipologia || inferInterventoTipologia(r.descrizione)).toUpperCase(),
        }));
        setRows(timeline);
        await loadRowState(timeline);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clienti = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.cliente).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [rows]);

  function onTopScroll(e: UIEvent<HTMLDivElement>) {
    if (syncingScrollRef.current === "main" || syncingScrollRef.current === "bottom") return;
    syncingScrollRef.current = "top";
    if (mainScrollRef.current) mainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (bottomScrollRef.current) bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    syncingScrollRef.current = null;
  }

  function onMainScroll(e: UIEvent<HTMLDivElement>) {
    if (syncingScrollRef.current === "top" || syncingScrollRef.current === "bottom") return;
    syncingScrollRef.current = "main";
    if (topScrollRef.current) topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (bottomScrollRef.current) bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    syncingScrollRef.current = null;
  }

  function onBottomScroll(e: UIEvent<HTMLDivElement>) {
    if (syncingScrollRef.current === "top" || syncingScrollRef.current === "main") return;
    syncingScrollRef.current = "bottom";
    if (topScrollRef.current) topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (mainScrollRef.current) mainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    syncingScrollRef.current = null;
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const personaleNeedle = normalizePersonaleText(personaleFilter);
    return rows.filter((r) => {
      const key = getRowKey(r.kind, r.row_ref_id);
      const fatto = Boolean(metaByKey[key]?.fatto ?? r.fatto);
      const hidden = Boolean(metaByKey[key]?.hidden);
      const operativi = extractOperativi(metaByKey[key] || null);
      const personalePrevisto = operativi.personale_previsto;
      const schedule = getRowSchedule(r, metaByKey[key] || null);
      if (hidden && !showHidden) return false;
      if (fatto && !showFatto) return false;
      if (clienteFilter !== "TUTTI" && r.cliente !== clienteFilter) return false;
      if (kindFilter !== "TUTTI" && r.kind !== kindFilter) return false;
      if (
        personaleNeedle &&
        !normalizePersonaleText(personalePrevisto).includes(personaleNeedle)
      ) {
        return false;
      }
      if (needle) {
        const matchesSearch = `${r.cliente} ${r.progetto} ${r.ticket_no || ""} ${r.descrizione} ${r.stato}`
          .toLowerCase()
          .includes(needle);
        if (!matchesSearch) return false;
      }
      // Se chiedo esplicitamente di vedere i "Fatto", li mostro sempre
      // (indipendentemente dal range date) per permettere il reset del flag.
      if (fatto && showFatto) return true;
      if (fromDate && schedule.data_fine < fromDate) return false;
      if (toDate && schedule.data_inizio > toDate) return false;
      return true;
    });
  }, [
    rows,
    fromDate,
    toDate,
    clienteFilter,
    kindFilter,
    q,
    personaleFilter,
    metaByKey,
    showFatto,
    showHidden,
  ]);

  const filteredSorted = useMemo(() => {
    const sorted = [...filtered];
    const field = sortBy;
    sorted.sort((a, b) => {
      const avSchedule = getRowSchedule(a, metaByKey[getRowKey(a.kind, a.row_ref_id)] || null);
      const bvSchedule = getRowSchedule(b, metaByKey[getRowKey(b.kind, b.row_ref_id)] || null);
      const av = field === "data_prevista" ? avSchedule.data_inizio : avSchedule.data_fine;
      const bv = field === "data_prevista" ? bvSchedule.data_inizio : bvSchedule.data_fine;
      const cmp = String(av || "").localeCompare(String(bv || ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filtered, sortBy, sortDir, metaByKey]);

  const conflictByKey = useMemo(() => {
    return checkOperativiConflicts(
      rows.map((row) => {
        const key = getRowKey(row.kind, row.row_ref_id);
        const operativi = operativiDraftByKey[key] || extractOperativi(metaByKey[key] || null);
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
  }, [rows, metaByKey, operativiDraftByKey]);

  useEffect(() => {
    const updateScrollWidth = () => {
      const w = scrollContentRef.current?.scrollWidth || 4320;
      setScrollContentWidth(w);
    };
    updateScrollWidth();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScrollWidth);
      return () => window.removeEventListener("resize", updateScrollWidth);
    }
  }, [filteredSorted.length, loading]);

  function toggleSort(field: "data_prevista" | "data_tassativa") {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortDir("asc");
  }

  const rowByKey = useMemo(() => {
    const map: Record<string, TimelineRow> = {};
    for (const r of rows) {
      map[getRowKey(r.kind, r.row_ref_id)] = r;
    }
    return map;
  }, [rows]);

  return (
    <div style={{ maxWidth: 1250, margin: "28px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>CRONOPROGRAMMA</div>
        </div>
        <Link
          href="/"
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            background: "white",
          }}
        >
          ← Dashboard
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fee2e2",
            color: "#991b1b",
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}
      {stateError && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7ed",
            color: "#9a3412",
            marginBottom: 10,
          }}
        >
          {stateError}
        </div>
      )}
      <CronoprogrammaPanel
        fromDate={fromDate}
        setFromDate={(value) => {
          setFromDate(typeof value === "function" ? value(fromDate) : value);
          setQuickRangeDays(null);
        }}
        toDate={toDate}
        setToDate={(value) => {
          setToDate(typeof value === "function" ? value(toDate) : value);
          setQuickRangeDays(null);
        }}
        clienteFilter={clienteFilter}
        setClienteFilter={setClienteFilter}
        kindFilter={kindFilter}
        setKindFilter={setKindFilter}
        q={q}
        setQ={setQ}
        personaleFilter={personaleFilter}
        setPersonaleFilter={setPersonaleFilter}
        clienti={clienti}
        quickRangeDays={quickRangeDays}
        applyQuickRange={applyQuickRange}
        showFatto={showFatto}
        setShowFatto={setShowFatto}
        showHidden={showHidden}
        setShowHidden={setShowHidden}
        filteredSorted={filteredSorted}
        onExportCsv={() =>
          downloadCsv(
            `cronoprogramma_${new Date().toISOString().slice(0, 10)}.csv`,
            filteredSorted,
            metaByKey,
            commentsByKey
          )
        }
        topScrollRef={topScrollRef}
        mainScrollRef={mainScrollRef}
        bottomScrollRef={bottomScrollRef}
        scrollContentRef={scrollContentRef}
        onTopScroll={onTopScroll}
        onMainScroll={onMainScroll}
        onBottomScroll={onBottomScroll}
        scrollContentWidth={scrollContentWidth}
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        toggleSort={toggleSort}
        metaByKey={metaByKey}
        commentsByKey={commentsByKey}
        noteDraftByKey={noteDraftByKey}
        setNoteDraftByKey={setNoteDraftByKey}
        stateLoading={stateLoading}
        savingFattoKey={savingFattoKey}
        savingHiddenKey={savingHiddenKey}
        savingCommentKey={savingCommentKey}
        savingOperativiKey={savingOperativiKey}
        deletingCommentId={deletingCommentId}
        noteHistoryKey={noteHistoryKey}
        setNoteHistoryKey={setNoteHistoryKey}
        operativiDraftByKey={operativiDraftByKey}
        setOperativiDraftByKey={setOperativiDraftByKey}
        conflictByKey={conflictByKey}
        rowByKey={rowByKey}
        setFatto={setFatto}
        setHidden={setHidden}
        addComment={addComment}
        saveOperativi={saveOperativi}
        deleteComment={deleteComment}
        getRowKey={getRowKey}
        getRowSchedule={getRowSchedule}
        extractOperativi={extractOperativi}
        buildConflictTooltip={buildConflictTooltip}
        hasDefinedOperativi={hasDefinedOperativi}
        emptyOperativi={EMPTY_OPERATIVI}
      />
    </div>
  );
}
