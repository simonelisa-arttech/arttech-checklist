"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type ScadenzaAgendaRow = {
  id: string;
  origine: "rinnovi_servizi" | "tagliandi" | "licenses" | "checklists" | "saas_contratti";
  source: "rinnovi" | "tagliandi" | "licenze" | "saas" | "garanzie" | "saas_contratto";
  cliente: string | null;
  cliente_id: string | null;
  checklist_id: string | null;
  progetto: string | null;
  tipo: "GARANZIA" | "TAGLIANDO" | "LICENZA" | "SAAS" | "RINNOVO";
  sottotipo: string | null;
  riferimento: string | null;
  descrizione: string | null;
  scadenza: string | null;
  stato: string | null;
  workflow_stato:
    | "DA_AVVISARE"
    | "AVVISATO"
    | "CONFERMATO"
    | "DA_FATTURARE"
    | "FATTURATO"
    | "NON_RINNOVATO"
    | null;
  fatturazione: string | null;
  note: string | null;
  raw_id: string | null;
};

type FilterState = {
  from: string;
  to: string;
  cliente: string;
  tipo: string;
  stato: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString() : value;
}

function renderTipoBadge(value?: string | null) {
  const raw = String(value || "—").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (raw === "LICENZA") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (raw === "TAGLIANDO") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (raw === "SAAS") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (raw === "GARANZIA") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (raw === "RINNOVO") {
    bg = "#ede9fe";
    color = "#6d28d9";
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
        whiteSpace: "nowrap",
      }}
    >
      {raw}
    </span>
  );
}

function renderWorkflowBadge(value?: string | null) {
  const raw = String(value || "—").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (raw === "DA_AVVISARE") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (raw === "AVVISATO") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (raw === "CONFERMATO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (raw === "DA_FATTURARE") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (raw === "FATTURATO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (raw === "NON_RINNOVATO") {
    bg = "#f3f4f6";
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
        whiteSpace: "nowrap",
      }}
    >
      {raw}
    </span>
  );
}

const DEFAULT_FILTERS: FilterState = {
  from: "",
  to: "",
  cliente: "",
  tipo: "TUTTI",
  stato: "TUTTI",
};

export default function ScadenzeClient() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<ScadenzaAgendaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (appliedFilters.from) params.set("from", appliedFilters.from);
        if (appliedFilters.to) params.set("to", appliedFilters.to);
        if (appliedFilters.cliente.trim()) params.set("cliente", appliedFilters.cliente.trim());
        if (appliedFilters.tipo !== "TUTTI") params.set("tipo", appliedFilters.tipo);
        if (appliedFilters.stato !== "TUTTI") params.set("stato", appliedFilters.stato);
        const res = await fetch(`/api/scadenze${params.size ? `?${params.toString()}` : ""}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({} as any));
        if (!active) return;
        if (!res.ok || !json?.ok) {
          setError(json?.error || "Errore caricamento scadenze");
          setRows([]);
          return;
        }
        setRows((json.data || []) as ScadenzaAgendaRow[]);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Errore caricamento scadenze");
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [appliedFilters]);

  const countLabel = useMemo(() => {
    if (loading) return "Caricamento...";
    return `Totale risultati: ${rows.length}`;
  }, [loading, rows.length]);

  return (
    <div style={{ maxWidth: 1500, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>SCADENZE</div>
        </div>
        <Link
          href="/"
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedFilters({ ...filters });
        }}
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <label>
          Da<br />
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        <label>
          A<br />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        <label>
          Cliente<br />
          <input
            value={filters.cliente}
            onChange={(e) => setFilters((prev) => ({ ...prev, cliente: e.target.value }))}
            placeholder="Cerca cliente..."
            style={{ width: "100%", padding: 10 }}
          />
        </label>
        <label>
          Tipo<br />
          <select
            value={filters.tipo}
            onChange={(e) => setFilters((prev) => ({ ...prev, tipo: e.target.value }))}
            style={{ width: "100%", padding: 10 }}
          >
            <option value="TUTTI">TUTTI</option>
            <option value="GARANZIA">GARANZIA</option>
            <option value="TAGLIANDO">TAGLIANDO</option>
            <option value="LICENZA">LICENZA</option>
            <option value="SAAS">SAAS</option>
            <option value="RINNOVO">RINNOVO</option>
          </select>
        </label>
        <label>
          Stato<br />
          <select
            value={filters.stato}
            onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
            style={{ width: "100%", padding: 10 }}
          >
            <option value="TUTTI">TUTTI</option>
            <option value="DA_AVVISARE">DA_AVVISARE</option>
            <option value="SCADUTO">SCADUTO</option>
          </select>
        </label>
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          Filtra
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </form>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>{countLabel}</div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          border: "1px solid #eee",
          borderRadius: 12,
          overflowX: "auto",
          background: "white",
        }}
      >
        <table style={{ width: "100%", minWidth: 1260, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
              <th style={{ padding: "10px 12px" }}>Scadenza</th>
              <th style={{ padding: "10px 12px" }}>Cliente</th>
              <th style={{ padding: "10px 12px" }}>Progetto</th>
              <th style={{ padding: "10px 12px" }}>Tipo</th>
              <th style={{ padding: "10px 12px" }}>Riferimento</th>
              <th style={{ padding: "10px 12px" }}>Stato workflow</th>
              <th style={{ padding: "10px 12px" }}>Origine</th>
              <th style={{ padding: "10px 12px" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 16, textAlign: "center" }}>
                  Nessuna scadenza trovata
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #f1f1f1" }}>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{formatDate(row.scadenza)}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  {row.cliente || "—"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  {row.progetto || "—"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{renderTipoBadge(row.tipo)}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>
                  {row.riferimento || "—"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  {renderWorkflowBadge(row.workflow_stato)}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{row.origine}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                  {row.cliente ? (
                    <Link
                      href={`/clienti/${encodeURIComponent(row.cliente)}`}
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      Apri cliente
                    </Link>
                  ) : null}
                  {row.checklist_id ? (
                    <Link
                      href={`/checklists/${row.checklist_id}`}
                      style={{
                        display: "inline-block",
                        marginLeft: 8,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      Apri progetto
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
