"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  proforma: string | null;
  data_prevista: string | null;
  data_tassativa: string | null;
  noleggio_vendita: string | null;
  tipo_impianto: string | null;
};

type InterventoRow = {
  id: string;
  cliente: string | null;
  checklist_id: string | null;
  ticket_no?: string | null;
  data: string | null;
  data_tassativa?: string | null;
  descrizione: string | null;
  tipo?: string | null;
  proforma: string | null;
  stato_intervento: string | null;
  fatturazione_stato: string | null;
};

type TimelineRow = {
  kind: "INSTALLAZIONE" | "INTERVENTO";
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
  updated_at: string | null;
  updated_by_operatore: string | null;
  updated_by_nome: string | null;
};

type CronoComment = {
  id: string;
  commento: string;
  created_at: string | null;
  created_by_operatore: string | null;
  created_by_nome: string | null;
};

function toIsoDay(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
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

function getRowKey(rowKind: "INSTALLAZIONE" | "INTERVENTO", rowRefId: string) {
  return `${rowKind}:${rowRefId}`;
}

function downloadCsv(
  filename: string,
  rows: TimelineRow[],
  metaByKey: Record<string, CronoMeta>,
  commentsByKey: Record<string, CronoComment[]>
) {
  const header = [
    "tipo_evento",
    "data_prevista",
    "data_tassativa",
    "cliente",
    "progetto",
    "ticket_no",
    "fatto",
    "nota_ultima",
    "descrizione",
    "checklist_link",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const key = getRowKey(r.kind, r.row_ref_id);
    const fatto = Boolean(metaByKey[key]?.fatto ?? r.fatto);
    const latestComment = commentsByKey[key]?.[0];
    const cells = [
      r.kind,
      r.data_prevista,
      r.data_tassativa,
      r.cliente,
      r.progetto,
      r.ticket_no || "",
      fatto ? "FATTO" : "DA_FINIRE",
      latestComment?.commento || "",
      r.descrizione,
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
  const [kindFilter, setKindFilter] = useState<"TUTTI" | "INSTALLAZIONE" | "INTERVENTO">("TUTTI");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"data_prevista" | "data_tassativa">("data_tassativa");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [metaByKey, setMetaByKey] = useState<Record<string, CronoMeta>>({});
  const [commentsByKey, setCommentsByKey] = useState<Record<string, CronoComment[]>>({});
  const [noteDraftByKey, setNoteDraftByKey] = useState<Record<string, string>>({});
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [savingFattoKey, setSavingFattoKey] = useState<string | null>(null);
  const [savingCommentKey, setSavingCommentKey] = useState<string | null>(null);
  const [noteHistoryKey, setNoteHistoryKey] = useState<string | null>(null);

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
      setMetaByKey((data?.meta as Record<string, CronoMeta>) || {});
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

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getTime());
    from.setDate(from.getDate() - 7);
    const to = new Date(now.getTime());
    to.setDate(to.getDate() + 60);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: checklists, error: cErr } = await supabase
        .from("checklists")
        .select("id, cliente, nome_checklist, proforma, data_prevista, data_tassativa, noleggio_vendita, tipo_impianto")
        .order("created_at", { ascending: false });

      if (cErr) {
        setError("Errore caricamento installazioni: " + cErr.message);
        setLoading(false);
        return;
      }

      let interventi: InterventoRow[] | null = null;
      let iErr: any = null;
      {
        const res = await supabase
          .from("saas_interventi")
          .select(
            "id, cliente, checklist_id, ticket_no, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato"
          )
          .order("data", { ascending: true });
        interventi = res.data as InterventoRow[] | null;
        iErr = res.error;
      }
      if (iErr && String(iErr.message || "").toLowerCase().includes("data_tassativa")) {
        const res = await supabase
          .from("saas_interventi")
          .select(
            "id, cliente, checklist_id, ticket_no, data, descrizione, tipo, proforma, stato_intervento, fatturazione_stato"
          )
          .order("data", { ascending: true });
        interventi = (res.data as InterventoRow[] | null)?.map((r) => ({ ...r, data_tassativa: null })) ?? [];
        iErr = res.error;
      }
      if (iErr && String(iErr.message || "").toLowerCase().includes("ticket_no")) {
        const res = await supabase
          .from("saas_interventi")
          .select("id, cliente, checklist_id, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
          .order("data", { ascending: true });
        interventi =
          (res.data as InterventoRow[] | null)?.map((r) => ({ ...r, ticket_no: null, data_tassativa: r.data_tassativa ?? null })) ??
          [];
        iErr = res.error;
      }

      if (iErr) {
        setError("Errore caricamento interventi: " + iErr.message);
        setLoading(false);
        return;
      }

      const checklistById = new Map<string, ChecklistRow>();
      for (const c of (checklists || []) as ChecklistRow[]) {
        checklistById.set(c.id, c);
      }

      const timeline: TimelineRow[] = [];

      for (const c of (checklists || []) as ChecklistRow[]) {
        const date = toIsoDay(c.data_tassativa) || toIsoDay(c.data_prevista);
        if (!date) continue;
        timeline.push({
          kind: "INSTALLAZIONE",
          id: `install:${c.id}`,
          row_ref_id: c.id,
          data_prevista: toIsoDay(c.data_prevista) || date,
          data_tassativa: toIsoDay(c.data_tassativa) || date,
          cliente: String(c.cliente || "—"),
          checklist_id: c.id,
          progetto: String(c.nome_checklist || c.id),
          proforma: c.proforma ?? null,
          tipologia: String(c.noleggio_vendita || "INSTALLAZIONE").toUpperCase(),
          descrizione:
            [c.tipo_impianto || "", c.noleggio_vendita || ""].filter(Boolean).join(" · ") ||
            "Installazione pianificata",
          stato: "PIANIFICATA",
          fatto: false,
        });
      }

      for (const i of (interventi || []) as InterventoRow[]) {
        const date = toIsoDay(i.data_tassativa) || toIsoDay(i.data);
        if (!date) continue;
        const c = i.checklist_id ? checklistById.get(i.checklist_id) : null;
        const prevista = toIsoDay(i.data) || toIsoDay(i.data_tassativa) || date;
        const tassativa = toIsoDay(i.data_tassativa) || toIsoDay(i.data) || date;
        timeline.push({
          kind: "INTERVENTO",
          id: `intervento:${i.id}`,
          row_ref_id: i.id,
          data_prevista: prevista,
          data_tassativa: tassativa,
          cliente: String(i.cliente || c?.cliente || "—"),
          checklist_id: i.checklist_id,
          ticket_no: i.ticket_no ?? null,
          proforma: i.proforma ?? c?.proforma ?? null,
          progetto: String(c?.nome_checklist || i.checklist_id || "—"),
          tipologia: String(i.tipo || inferInterventoTipologia(i.descrizione)).toUpperCase(),
          descrizione: String(i.descrizione || "Intervento"),
          stato: String(i.stato_intervento || i.fatturazione_stato || "APERTO").toUpperCase(),
          fatto: false,
        });
      }

      timeline.sort((a, b) =>
        (a.data_tassativa || a.data_prevista).localeCompare(b.data_tassativa || b.data_prevista)
      );
      setRows(timeline);
      await loadRowState(timeline);
      setLoading(false);
    })();
  }, []);

  const clienti = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.cliente).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const alwaysVisibleThreshold = "2026-01-01";
    return rows.filter((r) => {
      const rifDate = r.data_tassativa || r.data_prevista;
      const key = getRowKey(r.kind, r.row_ref_id);
      const fatto = Boolean(metaByKey[key]?.fatto ?? r.fatto);
      if (fatto) return false;
      if (clienteFilter !== "TUTTI" && r.cliente !== clienteFilter) return false;
      if (kindFilter !== "TUTTI" && r.kind !== kindFilter) return false;
      if (needle) {
        const matchesSearch = `${r.cliente} ${r.progetto} ${r.ticket_no || ""} ${r.descrizione} ${r.stato}`
          .toLowerCase()
          .includes(needle);
        if (!matchesSearch) return false;
      }
      const isAlwaysVisible = !fatto && rifDate > alwaysVisibleThreshold;
      if (isAlwaysVisible) return true;
      if (fromDate && rifDate < fromDate) return false;
      if (toDate && rifDate > toDate) return false;
      return true;
    });
  }, [rows, fromDate, toDate, clienteFilter, kindFilter, q, metaByKey]);

  const filteredSorted = useMemo(() => {
    const sorted = [...filtered];
    const field = sortBy;
    sorted.sort((a, b) => {
      const av = field === "data_prevista" ? a.data_prevista : a.data_tassativa;
      const bv = field === "data_prevista" ? b.data_prevista : b.data_tassativa;
      const cmp = String(av || "").localeCompare(String(bv || ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filtered, sortBy, sortDir]);

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
            onChange={(e) => setFromDate(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          A
          <br />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
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
      </div>

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
          style={{
            display: "grid",
            gridTemplateColumns: "110px 110px 110px 1fr 1fr 1fr 120px 130px 1.6fr",
            gap: 10,
            padding: "10px 12px",
            fontWeight: 700,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <button
            type="button"
            onClick={() => toggleSort("data_prevista")}
            style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 700 }}
            title="Ordina per data prevista"
          >
            Data prevista {sortBy === "data_prevista" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("data_tassativa")}
            style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 700 }}
            title="Ordina per data tassativa"
          >
            Data tassativa {sortBy === "data_tassativa" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
          <div>Evento</div>
          <div>Cliente</div>
          <div>Progetto</div>
          <div>Dettaglio</div>
          <div>Ticket/Pf</div>
          <div>Fatto</div>
          <div>Note</div>
        </div>
        {loading ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Caricamento...</div>
        ) : filteredSorted.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Nessun risultato</div>
        ) : (
          filteredSorted.map((r) => {
            const key = getRowKey(r.kind, r.row_ref_id);
            const meta = metaByKey[key];
            const fatto = Boolean(meta?.fatto ?? r.fatto);
            const comments = commentsByKey[key] || [];
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 110px 110px 1fr 1fr 1fr 120px 130px 1.6fr",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "start",
                }}
              >
                <div>{r.data_prevista ? new Date(r.data_prevista).toLocaleDateString("it-IT") : "—"}</div>
                <div>{r.data_tassativa ? new Date(r.data_tassativa).toLocaleDateString("it-IT") : "—"}</div>
                <div>{r.kind}</div>
                <div>{r.cliente}</div>
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
              </div>
            );
          })
        )}
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
                (commentsByKey[noteHistoryKey] || []).map((c) => (
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
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
