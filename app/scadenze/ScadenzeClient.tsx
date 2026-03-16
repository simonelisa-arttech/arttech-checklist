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
  progetto: string;
  tipo: string[];
  stato: string;
};

type SortDirection = "asc" | "desc";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString() : value;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getScadenzaDiffDays(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  const due = startOfDay(dt);
  const today = startOfDay(new Date());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function getScadenzaSortValue(value?: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  return startOfDay(dt).getTime();
}

function compareScadenzaValues(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
  direction: SortDirection
) {
  const left = getScadenzaSortValue(leftValue);
  const right = getScadenzaSortValue(rightValue);

  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  return direction === "asc" ? left - right : right - left;
}

function getScadenzaRowStyle(value?: string | null) {
  const diffDays = getScadenzaDiffDays(value);
  if (diffDays == null) return { background: "white" };
  if (diffDays < 0) return { background: "#fef2f2" };
  if (diffDays <= 7) return { background: "#fff7ed" };
  if (diffDays <= 30) return { background: "#fefce8" };
  return { background: "white" };
}

function renderDiffDays(value?: string | null) {
  const diffDays = getScadenzaDiffDays(value);
  if (diffDays == null) return "—";
  if (diffDays < 0) return "SCADUTO";
  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "tra 1 giorno";
  return `tra ${diffDays} giorni`;
}

function csvEscape(value: any) {
  if (value == null) return "";
  const raw = String(value);
  if (/[\";\n]/.test(raw)) {
    return `"${raw.replace(/\"/g, '""')}"`;
  }
  return raw;
}

function toCsv(rows: Record<string, any>[], headers: string[]) {
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(";"));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  progetto: "",
  tipo: [],
  stato: "TUTTI",
};

const TIPO_OPTIONS = ["GARANZIA", "TAGLIANDO", "LICENZA", "SAAS", "RINNOVO"] as const;

export default function ScadenzeClient() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<ScadenzaAgendaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scadenzaSort, setScadenzaSort] = useState<SortDirection>("asc");

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
        if (appliedFilters.progetto.trim()) params.set("progetto", appliedFilters.progetto.trim());
        if (appliedFilters.tipo.length > 0) params.set("tipo", appliedFilters.tipo.join(","));
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

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const byScadenza = compareScadenzaValues(a.scadenza, b.scadenza, scadenzaSort);
      if (byScadenza !== 0) return byScadenza;
      return a.id.localeCompare(b.id);
    });
  }, [rows, scadenzaSort]);

  const exportFilename = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (appliedFilters.from || appliedFilters.to) {
      return `scadenze_${appliedFilters.from || "TUTTE"}_${appliedFilters.to || "TUTTE"}.csv`;
    }
    return `scadenze_${today}.csv`;
  }, [appliedFilters]);

  function exportCsv() {
    const csvRows = rows.map((row) => ({
      scadenza: row.scadenza || "",
      cliente: row.cliente || "",
      progetto: row.progetto || "",
      tipo: row.tipo || "",
      sottotipo: row.sottotipo || "",
      riferimento: row.riferimento || "",
      descrizione: row.descrizione || "",
      workflow_stato: row.workflow_stato || "",
      origine: row.origine || "",
      note: row.note || "",
    }));
    const csv = toCsv(csvRows, [
      "scadenza",
      "cliente",
      "progetto",
      "tipo",
      "sottotipo",
      "riferimento",
      "descrizione",
      "workflow_stato",
      "origine",
      "note",
    ]);
    downloadCsv(exportFilename, csv);
  }

  function applyQuickRange(days: number) {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + days);
    const to = toDate.toISOString().slice(0, 10);
    setFilters((prev) => ({ ...prev, from, to }));
  }

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
          Progetto<br />
          <input
            value={filters.progetto}
            onChange={(e) => setFilters((prev) => ({ ...prev, progetto: e.target.value }))}
            placeholder="Cerca progetto..."
            style={{ width: "100%", padding: 10 }}
          />
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
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Tipo</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {TIPO_OPTIONS.map((tipo) => (
              <label key={tipo} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={filters.tipo.includes(tipo)}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      tipo: e.target.checked
                        ? [...prev.tipo, tipo]
                        : prev.tipo.filter((current) => current !== tipo),
                    }))
                  }
                />
                {tipo}
              </label>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Preset periodo</span>
          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              setFilters((prev) => ({ ...prev, from: today, to: today }));
            }}
            style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
          >
            Oggi
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange(7)}
            style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
          >
            7 giorni
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange(30)}
            style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
          >
            30 giorni
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange(90)}
            style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
          >
            90 giorni
          </button>
        </div>
      </form>

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{countLabel}</div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || rows.length === 0}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: loading || rows.length === 0 ? "default" : "pointer",
            opacity: loading || rows.length === 0 ? 0.6 : 1,
          }}
        >
          Esporta CSV
        </button>
      </div>

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
        <table style={{ width: "100%", minWidth: 1360, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
              <th
                aria-sort={scadenzaSort === "asc" ? "ascending" : "descending"}
                style={{ padding: "10px 12px" }}
              >
                <button
                  type="button"
                  onClick={() => setScadenzaSort((prev) => (prev === "asc" ? "desc" : "asc"))}
                  title={`Ordina per scadenza (${scadenzaSort === "asc" ? "asc" : "desc"})`}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    font: "inherit",
                    color: "inherit",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Scadenza {scadenzaSort === "asc" ? "↑" : "↓"}
                </button>
              </th>
              <th style={{ padding: "10px 12px" }}>Giorni</th>
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
                <td colSpan={9} style={{ padding: 16, textAlign: "center" }}>
                  Nessuna scadenza trovata
                </td>
              </tr>
            )}
            {sortedRows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderTop: "1px solid #f1f1f1",
                  ...getScadenzaRowStyle(row.scadenza),
                }}
              >
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{formatDate(row.scadenza)}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontWeight: 600 }}>
                  {renderDiffDays(row.scadenza)}
                </td>
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
