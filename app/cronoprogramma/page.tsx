"use client";

import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  buildOperativiSchedule,
  computeOperativiEndDate,
  dateToOperativiIsoDay,
  durationToInputValue,
  formatOperativiDateLabel,
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,minmax(120px,1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <label>
          Da
          <br />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setQuickRangeDays(null);
            }}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          A
          <br />
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setQuickRangeDays(null);
            }}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          Cliente
          <br />
          <select
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="TUTTI">Tutti</option>
            {clienti.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo evento
          <br />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="TUTTI">Tutti</option>
            <option value="INSTALLAZIONE">Installazioni</option>
            <option value="DISINSTALLAZIONE">Smontaggi noleggio</option>
            <option value="INTERVENTO">Interventi</option>
          </select>
        </label>
        <label>
          Cerca
          <br />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="cliente/progetto/ticket/descrizione"
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          Personale previsto
          <br />
          <input
            value={personaleFilter}
            onChange={(e) => setPersonaleFilter(e.target.value)}
            placeholder="Nome o incarico"
            style={{ width: "100%", padding: 8 }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[7, 15, 30].map((days) => {
          const active = quickRangeDays === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => applyQuickRange(days as 7 | 15 | 30)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: active ? "1px solid #111" : "1px solid #ddd",
                background: active ? "#111" : "white",
                color: active ? "white" : "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {days} giorni
            </button>
          );
        })}
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={showFatto}
          onChange={(e) => setShowFatto(e.target.checked)}
        />
        Mostra righe fatte (per poter togliere il flag)
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12, marginLeft: 16 }}>
        <input
          type="checkbox"
          checked={showHidden}
          onChange={(e) => setShowHidden(e.target.checked)}
        />
        Mostra righe nascoste
      </label>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.8 }}>Risultati: {filteredSorted.length}</div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `cronoprogramma_${new Date().toISOString().slice(0, 10)}.csv`,
              filteredSorted,
              metaByKey,
              commentsByKey
            )
          }
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          ref={topScrollRef}
          onScroll={onTopScroll}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            borderBottom: "1px solid #eee",
            background: "#fafafa",
            height: 16,
          }}
          aria-label="Scrollbar orizzontale superiore cronoprogramma"
        >
          <div style={{ width: scrollContentWidth, height: 1 }} />
        </div>
        <div
          ref={mainScrollRef}
          onScroll={onMainScroll}
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <div
            ref={scrollContentRef}
            style={{
              display: "grid",
              gridTemplateColumns:
                "110px 110px 90px 180px 240px 220px 260px 140px 130px 120px 260px 150px 150px 260px 260px 220px 260px 160px 140px 300px 300px 120px",
              gap: 12,
              padding: "10px 12px",
              fontWeight: 700,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
              minWidth: 4320,
            }}
          >
            <button
              type="button"
              onClick={() => toggleSort("data_prevista")}
              style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 700 }}
              title="Ordina per data prevista"
            >
              Data inizio {sortBy === "data_prevista" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("data_tassativa")}
              style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 700 }}
              title="Ordina per data tassativa"
            >
              Data fine {sortBy === "data_tassativa" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
            <div>Durata</div>
            <div style={{ paddingRight: 18, whiteSpace: "nowrap" }}>Evento</div>
            <div style={{ paddingLeft: 6 }}>Cliente</div>
            <div>Progetto</div>
            <div>Dettaglio</div>
            <div>Ticket/Pf</div>
            <div>Fatto</div>
            <div>Nascosta</div>
            <div>Note</div>
            <div>Data inizio op.</div>
            <div>Durata / fine</div>
            <div>Personale previsto / incarico</div>
            <div>Mezzi</div>
            <div>Descrizione attività</div>
            <div>Indirizzo</div>
            <div>Orario</div>
            <div>Referente cliente</div>
            <div>Commerciale Art Tech</div>
            <div>Azioni</div>
          </div>
          {loading ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Caricamento...</div>
          ) : filteredSorted.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Nessun risultato</div>
          ) : (
            filteredSorted.map((r) => {
            const key = getRowKey(r.kind, r.row_ref_id);
            const meta = metaByKey[key];
            const schedule = getRowSchedule(r, meta);
            const fatto = Boolean(meta?.fatto ?? r.fatto);
            const hidden = Boolean(meta?.hidden);
            const operativoDefinito = hasDefinedOperativi(meta);
            const comments = commentsByKey[key] || [];
            const conflict = conflictByKey[key];
            const conflictTitle = buildConflictTooltip(
              conflict?.conflictDetails.personale || [],
              conflict?.conflictDetails.mezzi || []
            );
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "110px 110px 90px 180px 240px 220px 260px 140px 130px 120px 260px 150px 150px 260px 260px 220px 260px 160px 140px 300px 300px 120px",
                  gap: 12,
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "start",
                  opacity: hidden && showHidden ? 0.6 : 1,
                  fontStyle: hidden && showHidden ? "italic" : "normal",
                  background: conflict?.hasConflict ? "#fff7f7" : "white",
                  boxShadow: conflict?.hasConflict ? "inset 3px 0 0 #ef4444" : "none",
                  minWidth: 4320,
                }}
                title={conflict?.hasConflict ? conflictTitle : undefined}
              >
                <div>
                  {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}
                </div>
                <div>
                  {schedule.data_fine ? formatOperativiDateLabel(schedule.data_fine) : "—"}
                </div>
                <div>{schedule.durata_giorni} gg</div>
                <div style={{ paddingRight: 18 }}>
                  <div style={{ whiteSpace: "nowrap" }}>{r.kind}</div>
                  {operativoDefinito ? (
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 999,
                        border: "1px solid #86efac",
                        background: "#f0fdf4",
                        color: "#166534",
                        padding: "3px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Operativo definito
                    </div>
                  ) : null}
                  {conflict?.hasConflict ? (
                    <div
                      title={conflictTitle}
                      style={{
                        marginTop: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 999,
                        border: "1px solid #fca5a5",
                        background: "#fff1f2",
                        color: "#b91c1c",
                        padding: "3px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ⚠ Conflitto
                    </div>
                  ) : null}
                </div>
                <div style={{ paddingLeft: 6 }}>{r.cliente}</div>
                <div>
                  {r.checklist_id ? (
                    <Link
                      href={`/checklists/${r.checklist_id}`}
                      style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                    >
                      {r.progetto}
                    </Link>
                  ) : (
                    r.progetto
                  )}
                </div>
                <div>{r.descrizione}</div>
                <div>{r.ticket_no || r.proforma || "—"}</div>
                <div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={fatto}
                      onChange={(e) => setFatto(r, e.target.checked)}
                      disabled={savingFattoKey === key || stateLoading}
                    />
                    Fatto
                  </label>
                  {meta?.updated_at && (
                    <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
                      {meta.updated_by_nome || "Operatore"} ·{" "}
                      {new Date(meta.updated_at).toLocaleString("it-IT")}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={hidden}
                      onChange={(e) => setHidden(r, e.target.checked)}
                      disabled={savingHiddenKey === key || stateLoading}
                    />
                    Nascosta
                  </label>
                </div>
                <div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={noteDraftByKey[key] || ""}
                      onChange={(e) =>
                        setNoteDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="Aggiungi nota..."
                      style={{ width: "100%", padding: 6 }}
                    />
                    <button
                      type="button"
                      onClick={() => addComment(r)}
                      disabled={savingCommentKey === key || stateLoading}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: "#111",
                        color: "white",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        opacity: savingCommentKey === key ? 0.7 : 1,
                      }}
                    >
                      Salva
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteHistoryKey(key)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                      title="Storico note"
                    >
                      +
                    </button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                    {comments[0] ? (
                      <div
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #eef2f7",
                          borderRadius: 8,
                          padding: "6px 8px",
                        }}
                      >
                        <div style={{ whiteSpace: "pre-wrap" }}>{comments[0].commento}</div>
                        <div style={{ opacity: 0.7, marginTop: 4 }}>
                          {(comments[0].created_by_nome || "Operatore") +
                            " · " +
                            (comments[0].created_at
                              ? new Date(comments[0].created_at).toLocaleString("it-IT")
                              : "—")}
                        </div>
                      </div>
                    ) : (
                      <span style={{ opacity: 0.7 }}>Nessuna nota</span>
                    )}
                  </div>
                </div>
                <div>
                  <input
                    type="date"
                    value={operativiDraftByKey[key]?.data_inizio ?? ""}
                    onChange={(e) =>
                      setOperativiDraftByKey((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || EMPTY_OPERATIVI), data_inizio: e.target.value },
                      }))
                    }
                    style={{ width: "100%", padding: 6 }}
                  />
                  {!(operativiDraftByKey[key]?.data_inizio ?? "") && (r.data_tassativa || r.data_prevista) ? (
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                      Fallback: {formatOperativiDateLabel(r.data_tassativa || r.data_prevista)}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={operativiDraftByKey[key]?.durata_giorni ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || EMPTY_OPERATIVI), durata_giorni: e.target.value },
                        }))
                      }
                      placeholder="1"
                      style={{ width: "100%", padding: 6 }}
                    />
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {(() => {
                        const draftEndDate = computeOperativiEndDate(
                          operativiDraftByKey[key]?.data_inizio || r.data_tassativa || r.data_prevista,
                          operativiDraftByKey[key]?.durata_giorni
                        );
                        return `Fine: ${draftEndDate ? formatOperativiDateLabel(draftEndDate) : "—"}`;
                      })()}
                    </div>
                  </div>
                </div>
                <div>
                  <textarea
                    value={operativiDraftByKey[key]?.personale_previsto ?? ""}
                    onChange={(e) =>
                      setOperativiDraftByKey((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || EMPTY_OPERATIVI), personale_previsto: e.target.value },
                      }))
                    }
                    placeholder="Nominativi + incarichi"
                    style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                  />
                </div>
                <div>
                  <textarea
                    value={operativiDraftByKey[key]?.mezzi ?? ""}
                    onChange={(e) =>
                      setOperativiDraftByKey((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || EMPTY_OPERATIVI), mezzi: e.target.value },
                      }))
                    }
                    placeholder="Mezzi"
                    style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                  />
                </div>
                <div>
                  <textarea
                    value={operativiDraftByKey[key]?.descrizione_attivita ?? ""}
                    onChange={(e) =>
                      setOperativiDraftByKey((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || EMPTY_OPERATIVI), descrizione_attivita: e.target.value },
                      }))
                    }
                    placeholder="Descrizione attività"
                    style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                  />
                </div>
                <div>
                  <textarea
                    value={operativiDraftByKey[key]?.indirizzo ?? ""}
                    onChange={(e) =>
                      setOperativiDraftByKey((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || EMPTY_OPERATIVI), indirizzo: e.target.value },
                      }))
                    }
                    placeholder="Indirizzo"
                    style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                  />
                </div>
                <div>
                  <input
                    value={operativiDraftByKey[key]?.orario ?? ""}
                    onChange={(e) =>
                      setOperativiDraftByKey((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || EMPTY_OPERATIVI), orario: e.target.value },
                      }))
                    }
                    placeholder="Orario"
                    style={{ width: "100%", padding: 6 }}
                  />
                </div>
                <div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <input
                      value={operativiDraftByKey[key]?.referente_cliente_nome ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || EMPTY_OPERATIVI), referente_cliente_nome: e.target.value },
                        }))
                      }
                      placeholder="Nome referente cliente"
                      style={{ width: "100%", padding: 6 }}
                    />
                    <input
                      value={operativiDraftByKey[key]?.referente_cliente_contatto ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || EMPTY_OPERATIVI), referente_cliente_contatto: e.target.value },
                        }))
                      }
                      placeholder="Contatto referente cliente"
                      style={{ width: "100%", padding: 6 }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <input
                      value={operativiDraftByKey[key]?.commerciale_art_tech_nome ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || EMPTY_OPERATIVI), commerciale_art_tech_nome: e.target.value },
                        }))
                      }
                      placeholder="Nome commerciale Art Tech"
                      style={{ width: "100%", padding: 6 }}
                    />
                    <input
                      value={operativiDraftByKey[key]?.commerciale_art_tech_contatto ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: {
                            ...(prev[key] || EMPTY_OPERATIVI),
                            commerciale_art_tech_contatto: e.target.value,
                          },
                        }))
                      }
                      placeholder="Contatto commerciale Art Tech"
                      style={{ width: "100%", padding: 6 }}
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => saveOperativi(r)}
                    disabled={savingOperativiKey === key || stateLoading}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: savingOperativiKey === key ? "#f3f4f6" : "#111",
                      color: savingOperativiKey === key ? "#111" : "white",
                      cursor: savingOperativiKey === key ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {savingOperativiKey === key ? "..." : "Salva"}
                  </button>
                </div>
              </div>
            );
            })
          )}
        </div>
        <div
          ref={bottomScrollRef}
          onScroll={onBottomScroll}
          style={{
            overflowX: "scroll",
            overflowY: "hidden",
            borderTop: "1px solid #eee",
            background: "#fafafa",
            height: 16,
          }}
          aria-label="Scrollbar orizzontale cronoprogramma"
        >
          <div style={{ width: scrollContentWidth, height: 1 }} />
        </div>
      </div>
      {noteHistoryKey && (
        <div
          onClick={() => setNoteHistoryKey(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "white",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Storico note</div>
              <button
                type="button"
                onClick={() => setNoteHistoryKey(null)}
                style={{ border: "1px solid #ddd", background: "white", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
              >
                Chiudi
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
              {rowByKey[noteHistoryKey]?.progetto || "Riga"}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {(commentsByKey[noteHistoryKey] || []).length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nessuna nota presente</div>
              ) : (
                (commentsByKey[noteHistoryKey] || []).map((c) => {
                  const row = rowByKey[noteHistoryKey];
                  return (
                    <div
                      key={c.id}
                      style={{ border: "1px solid #eef2f7", borderRadius: 8, padding: "8px 10px", background: "#f9fafb" }}
                    >
                      <div style={{ whiteSpace: "pre-wrap" }}>{c.commento}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                        {(c.created_by_nome || "Operatore") +
                          " · " +
                          (c.created_at ? new Date(c.created_at).toLocaleString("it-IT") : "—")}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => row && deleteComment(row, c.id)}
                          disabled={deletingCommentId === c.id || !row}
                          style={{
                            border: "1px solid #ef4444",
                            background: "white",
                            color: "#b91c1c",
                            borderRadius: 8,
                            padding: "4px 8px",
                            cursor: row ? "pointer" : "not-allowed",
                            opacity: deletingCommentId === c.id ? 0.7 : 1,
                          }}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
