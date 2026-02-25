"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
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
  descrizione: string | null;
  tipo?: string | null;
  proforma: string | null;
  stato_intervento: string | null;
  fatturazione_stato: string | null;
};

type TimelineRow = {
  kind: "INSTALLAZIONE" | "INTERVENTO";
  id: string;
  data_prevista: string;
  data_tassativa: string;
  cliente: string;
  checklist_id: string | null;
  ticket_no?: string | null;
  progetto: string;
  tipologia: string;
  descrizione: string;
  stato: string;
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

function downloadCsv(filename: string, rows: TimelineRow[]) {
  const header = [
    "tipo_evento",
    "data_prevista",
    "data_tassativa",
    "cliente",
    "progetto",
    "ticket_no",
    "descrizione",
    "checklist_link",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cells = [
      r.kind,
      r.data_prevista,
      r.data_tassativa,
      r.cliente,
      r.progetto,
      r.ticket_no || "",
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
        .select("id, cliente, nome_checklist, data_prevista, data_tassativa, noleggio_vendita, tipo_impianto")
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
            "id, cliente, checklist_id, ticket_no, data, descrizione, tipo, proforma, stato_intervento, fatturazione_stato"
          )
          .order("data", { ascending: true });
        interventi = res.data as InterventoRow[] | null;
        iErr = res.error;
      }
      if (iErr && String(iErr.message || "").toLowerCase().includes("ticket_no")) {
        const res = await supabase
          .from("saas_interventi")
          .select("id, cliente, checklist_id, data, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
          .order("data", { ascending: true });
        interventi = (res.data as InterventoRow[] | null)?.map((r) => ({ ...r, ticket_no: null })) ?? [];
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
          data_prevista: toIsoDay(c.data_prevista) || date,
          data_tassativa: toIsoDay(c.data_tassativa) || date,
          cliente: String(c.cliente || "—"),
          checklist_id: c.id,
          progetto: String(c.nome_checklist || c.id),
          tipologia: String(c.noleggio_vendita || "INSTALLAZIONE").toUpperCase(),
          descrizione:
            [c.tipo_impianto || "", c.noleggio_vendita || ""].filter(Boolean).join(" · ") ||
            "Installazione pianificata",
          stato: "PIANIFICATA",
        });
      }

      for (const i of (interventi || []) as InterventoRow[]) {
        const date = toIsoDay(i.data);
        if (!date) continue;
        const c = i.checklist_id ? checklistById.get(i.checklist_id) : null;
        const prevista = toIsoDay(c?.data_prevista) || date;
        const tassativa = toIsoDay(c?.data_tassativa) || date;
        timeline.push({
          kind: "INTERVENTO",
          id: `intervento:${i.id}`,
          data_prevista: prevista,
          data_tassativa: tassativa,
          cliente: String(i.cliente || c?.cliente || "—"),
          checklist_id: i.checklist_id,
          ticket_no: i.ticket_no ?? null,
          progetto: String(c?.nome_checklist || i.checklist_id || "—"),
          tipologia: String(i.tipo || inferInterventoTipologia(i.descrizione)).toUpperCase(),
          descrizione: String(i.descrizione || "Intervento"),
          stato: String(i.stato_intervento || i.fatturazione_stato || "APERTO").toUpperCase(),
        });
      }

      timeline.sort((a, b) =>
        (a.data_tassativa || a.data_prevista).localeCompare(b.data_tassativa || b.data_prevista)
      );
      setRows(timeline);
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
    return rows.filter((r) => {
      const rifDate = r.data_tassativa || r.data_prevista;
      if (fromDate && rifDate < fromDate) return false;
      if (toDate && rifDate > toDate) return false;
      if (clienteFilter !== "TUTTI" && r.cliente !== clienteFilter) return false;
      if (kindFilter !== "TUTTI" && r.kind !== kindFilter) return false;
      if (!needle) return true;
      return `${r.cliente} ${r.progetto} ${r.ticket_no || ""} ${r.descrizione} ${r.stato}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, fromDate, toDate, clienteFilter, kindFilter, q]);

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
        <div style={{ fontSize: 13, opacity: 0.8 }}>Risultati: {filtered.length}</div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(`cronoprogramma_${new Date().toISOString().slice(0, 10)}.csv`, filtered)
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
            gridTemplateColumns: "120px 120px 120px 1.1fr 1.1fr 1fr 140px",
            gap: 10,
            padding: "10px 12px",
            fontWeight: 700,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <div>Data prevista</div>
          <div>Data tassativa</div>
          <div>Evento</div>
          <div>Cliente</div>
          <div>Progetto</div>
          <div>Dettaglio</div>
          <div>Ticket</div>
        </div>
        {loading ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Nessun risultato</div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 120px 120px 1.1fr 1.1fr 1fr 140px",
                gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid #f3f4f6",
                alignItems: "center",
              }}
            >
              <div>{r.data_prevista ? new Date(r.data_prevista).toLocaleDateString("it-IT") : "—"}</div>
              <div>{r.data_tassativa ? new Date(r.data_tassativa).toLocaleDateString("it-IT") : "—"}</div>
              <div>{r.kind}</div>
              <div>{r.cliente}</div>
              <div>
                {r.checklist_id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      href={`/checklists/${r.checklist_id}`}
                      style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                    >
                      {r.progetto}
                    </Link>
                  </div>
                ) : (
                  r.progetto
                )}
              </div>
              <div>{r.descrizione}</div>
              <div>{r.ticket_no || "—"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
