"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type AlertLogRow = {
  id: string;
  created_at: string | null;
  tipo: string | null;
  riferimento: string | null;
  to_nome: string | null;
  to_email: string | null;
  trigger: string | null;
  subject: string | null;
  inviato_email: boolean | null;
  checklist_id: string | null;
  checklist?: { cliente?: string | null } | null;
};

function parseLocalDay(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    dt.setHours(0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function toCsv(rows: Record<string, any>[], headerOrder?: string[]) {
  const headers = headerOrder && headerOrder.length > 0 ? headerOrder : Object.keys(rows[0] || {});
  const escapeCell = (val: any) => {
    if (val == null) return "";
    const str = String(val);
    if (/[\";\n]/.test(str)) {
      return `"${str.replace(/\"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(";"));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderTipoBadge(label?: string | null) {
  const upper = String(label || "—").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "LICENZA") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (upper === "TAGLIANDO") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "SAAS") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (upper === "GARANZIA") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (upper === "SAAS_ULTRA") {
    bg = "#ede9fe";
    color = "#6d28d9";
  } else if (upper === "GENERICA" || upper === "GENERICO") {
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
      {upper}
    </span>
  );
}

function renderTriggerBadge(label?: string | null) {
  const upper = String(label || "—").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "MANUALE") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (upper === "60GG") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "30GG") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (upper === "15GG") {
    bg = "#dcfce7";
    color = "#166534";
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
      {upper}
    </span>
  );
}

function renderStatoBadge(value?: boolean | null) {
  const ok = value === true;
  const label = ok ? "INVIATO" : "ERRORE";
  const bg = ok ? "#dcfce7" : "#fee2e2";
  const color = ok ? "#166534" : "#991b1b";
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
      {label}
    </span>
  );
}

export default function AvvisiClient() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const searchParams = useSearchParams();
  const clienteParam = searchParams?.get("cliente") || "";
  const checklistParam = searchParams?.get("checklist_id") || "";
  const tipoParam = searchParams?.get("tipo") || "";

  const [rows, setRows] = useState<AlertLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clienteFilter, setClienteFilter] = useState(clienteParam);
  const [checklistIdFilter, setChecklistIdFilter] = useState(checklistParam);
  const [tipoFilter, setTipoFilter] = useState<string[]>(
    tipoParam ? [String(tipoParam).toUpperCase()] : []
  );
  const [triggerFilter, setTriggerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statoFilter, setStatoFilter] = useState<"tutti" | "inviati" | "errori">("tutti");

  useEffect(() => {
    if (clienteParam && clienteParam !== clienteFilter) {
      setClienteFilter(clienteParam);
    }
    if (checklistParam && checklistParam !== checklistIdFilter) {
      setChecklistIdFilter(checklistParam);
    }
    if (tipoParam) {
      const upper = String(tipoParam).toUpperCase();
      if (!tipoFilter.includes(upper)) {
        setTipoFilter([upper]);
      }
    }
  }, [clienteParam, checklistParam, tipoParam]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("checklist_alert_log")
        .select(
          "id, created_at, tipo, riferimento, to_nome, to_email, trigger, subject, inviato_email, checklist_id"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      if (err) {
        setError("Errore caricamento storico avvisi: " + err.message);
        setRows([]);
      } else {
        const baseRows = (data || []) as AlertLogRow[];
        const checklistIds = Array.from(
          new Set(baseRows.map((r) => r.checklist_id).filter(Boolean))
        ) as string[];
        let checklistMap = new Map<string, { cliente?: string | null }>();
        if (checklistIds.length > 0) {
          const { data: checklistsData, error: checklistsErr } = await supabase
            .from("checklists")
            .select("id, cliente")
            .in("id", checklistIds);
          if (!checklistsErr && checklistsData) {
            for (const c of checklistsData as any[]) {
              checklistMap.set(c.id, { cliente: c.cliente ?? null });
            }
          }
        }
        const merged = baseRows.map((r) => ({
          ...r,
          checklist: r.checklist_id ? checklistMap.get(r.checklist_id) ?? null : null,
        }));
        setRows(merged);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const clienteOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = r.checklist?.cliente || "";
      if (c) set.add(c);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const tipoOptions = useMemo(() => {
    const base = ["LICENZA", "TAGLIANDO", "SAAS", "GARANZIA", "SAAS_ULTRA", "GENERICA"];
    const set = new Set(base);
    for (const r of rows) {
      const t = String(r.tipo || "").toUpperCase();
      if (t) set.add(t);
    }
    return Array.from(set.values());
  }, [rows]);

  const triggerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const t = String(r.trigger || "").toUpperCase();
      if (t) set.add(t);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const from = fromDate ? parseLocalDay(fromDate) : null;
    const to = toDate ? parseLocalDay(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    return rows.filter((r) => {
      if (clienteFilter) {
        const c = String(r.checklist?.cliente || "").toLowerCase();
        if (!c.includes(clienteFilter.toLowerCase())) return false;
      }
      if (checklistIdFilter) {
        if (String(r.checklist_id || "") !== checklistIdFilter) return false;
      }
      if (tipoFilter.length > 0) {
        const t = String(r.tipo || "").toUpperCase();
        if (!tipoFilter.includes(t)) return false;
      }
      if (triggerFilter) {
        if (String(r.trigger || "").toUpperCase() !== triggerFilter.toUpperCase()) return false;
      }
      if (statoFilter === "inviati" && r.inviato_email !== true) return false;
      if (statoFilter === "errori" && r.inviato_email !== false) return false;
      if (from || to) {
        const dt = parseLocalDay(r.created_at);
        if (!dt) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
      }
      return true;
    });
  }, [rows, clienteFilter, checklistIdFilter, tipoFilter, triggerFilter, fromDate, toDate, statoFilter]);

  function toggleTipo(value: string) {
    setTipoFilter((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      return [...prev, value];
    });
  }

  function exportCsv() {
    const today = new Date().toISOString().slice(0, 10);
    const csvRows = filteredRows.map((r) => ({
      DataInvio: r.created_at ? new Date(r.created_at).toLocaleString("it-IT") : "",
      Cliente: r.checklist?.cliente ?? "",
      Tipo: String(r.tipo || "").toUpperCase(),
      Riferimento: r.riferimento ?? "",
      Destinatario: r.to_nome ?? "",
      Email: r.to_email ?? "",
      Trigger: String(r.trigger || "").toUpperCase(),
      Oggetto: r.subject ?? "",
      Stato: r.inviato_email === true ? "INVIATO" : "ERRORE",
      ChecklistId: r.checklist_id ?? "",
    }));
    const csv = toCsv(csvRows, [
      "DataInvio",
      "Cliente",
      "Tipo",
      "Riferimento",
      "Destinatario",
      "Email",
      "Trigger",
      "Oggetto",
      "Stato",
      "ChecklistId",
    ]);
    downloadCsv(`storico-avvisi_${today}.csv`, csv);
  }

  function applyQuickRange(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  }

  if (loading) return <div style={{ padding: 20 }}>Caricamento…</div>;
  if (error) return <div style={{ padding: 20, color: "crimson" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Storico avvisi</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
            Log invii email da checklist_alert_log
          </div>
        </div>
        <Link
          href="/"
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            background: "white",
            marginLeft: "auto",
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #eee",
          background: "white",
          display: "grid",
          gridTemplateColumns: "1.3fr 1.3fr 1.4fr 1fr 1fr 1fr",
          gap: 10,
          fontSize: 12,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Cliente
          <input
            list="clienti-list"
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            placeholder="Cerca cliente..."
            style={{ padding: "6px 8px" }}
          />
          <datalist id="clienti-list">
            {clienteOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Checklist ID
          <input
            value={checklistIdFilter}
            onChange={(e) => setChecklistIdFilter(e.target.value)}
            placeholder="ID checklist..."
            style={{ padding: "6px 8px" }}
          />
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Tipo
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tipoOptions.map((t) => (
              <label key={t} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={tipoFilter.includes(t)}
                  onChange={() => toggleTipo(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Trigger
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            style={{ padding: "6px 8px" }}
          >
            <option value="">Tutti</option>
            {triggerOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Da
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: "6px 8px" }}
          />
          A
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: "6px 8px" }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyQuickRange(d)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {d}gg
              </button>
            ))}
          </div>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Stato
          <select
            value={statoFilter}
            onChange={(e) => setStatoFilter(e.target.value as any)}
            style={{ padding: "6px 8px" }}
          >
            <option value="tutti">Tutti</option>
            <option value="inviati">Solo inviati</option>
            <option value="errori">Solo errori</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            style={{
              marginTop: 6,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "white",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            Esporta CSV
          </button>
        </label>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Totale risultati: {filteredRows.length}
      </div>

      {filteredRows.length === 0 ? (
        <div style={{ marginTop: 12, opacity: 0.7 }}>Nessun avviso trovato</div>
      ) : (
        <div className="overflow-x-auto" style={{ marginTop: 10 }}>
          <table className="w-full table-fixed" style={{ borderCollapse: "collapse" }}>
            <thead className="sticky top-0 bg-white z-10">
              <tr style={{ background: "#fafafa" }}>
                <th className="w-[140px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Data invio
                </th>
                <th className="w-[120px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Cliente
                </th>
                <th className="w-[110px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Tipo
                </th>
                <th className="w-[200px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Riferimento / Destinatario
                </th>
                <th className="w-[110px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Trigger
                </th>
                <th className="w-[260px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Oggetto email
                </th>
                <th className="w-[110px]" style={{ textAlign: "left", padding: "10px 12px" }}>
                  Stato
                </th>
                <th
                  className="w-[90px] text-right"
                  style={{ textAlign: "right", padding: "10px 12px" }}
                >
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const cliente = r.checklist?.cliente ?? "—";
                const subject = r.subject || "—";
                const created = r.created_at
                  ? new Date(r.created_at).toLocaleString("it-IT")
                  : "—";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{created}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600 }}>
                      {cliente}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      {renderTipoBadge(r.tipo)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      <div className="truncate max-w-[200px]" title={r.riferimento ?? "—"}>
                        {r.riferimento ?? "—"}
                      </div>
                      <div style={{ marginTop: 4 }}>{r.to_nome ?? "—"}</div>
                      <div
                        className="truncate max-w-[200px]"
                        title={r.to_email ?? "—"}
                        style={{ opacity: 0.7 }}
                      >
                        {r.to_email ?? "—"}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      {renderTriggerBadge(r.trigger)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      <div className="truncate max-w-[260px]" title={subject}>
                        {subject}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      {renderStatoBadge(r.inviato_email)}
                    </td>
                    <td
                      className="text-right whitespace-nowrap"
                      style={{ padding: "10px 12px", fontSize: 12 }}
                    >
                      {r.checklist_id ? (
                        <Link href={`/checklists/${r.checklist_id}`} style={{ color: "#111" }}>
                          Apri
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
