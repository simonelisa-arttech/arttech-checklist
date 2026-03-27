"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type SimCardRow = {
  id: string;
  numero_telefono: string;
  intestatario: string;
  piano_attivo: string;
  operatore: string;
  tariffa: number | null;
  data_scadenza: string;
  billing_status: string;
  attiva: boolean;
};

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleDateString("it-IT");
}

function formatCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function renderBillingBadge(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  let background = "#f3f4f6";
  let color = "#374151";

  if (raw === "DA_FATTURARE") {
    background = "#fef3c7";
    color = "#92400e";
  } else if (raw === "FATTURATO") {
    background = "#dcfce7";
    color = "#166534";
  } else if (raw === "INCLUSO") {
    background = "#dbeafe";
    color = "#1d4ed8";
  } else if (raw === "NON_APPLICABILE") {
    background = "#e5e7eb";
    color = "#4b5563";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {raw || "—"}
    </span>
  );
}

export default function SimPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SimCardRow[]>([]);
  const [search, setSearch] = useState("");
  const [attiveFilter, setAttiveFilter] = useState<"ATTIVE" | "TUTTE">("ATTIVE");
  const [operatoreFilter, setOperatoreFilter] = useState("TUTTI");
  const [billingStatusFilter, setBillingStatusFilter] = useState("TUTTI");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: loadError } = await dbFrom("sim_cards")
        .select(
          "id, numero_telefono, intestatario, piano_attivo, operatore, tariffa, data_scadenza, billing_status, attiva"
        )
        .order("numero_telefono", { ascending: true });

      if (!active) return;

      if (loadError) {
        setError(`Errore caricamento SIM: ${loadError.message}`);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(
        (((data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
          id: String(row.id || ""),
          numero_telefono: String(row.numero_telefono || ""),
          intestatario: String(row.intestatario || ""),
          piano_attivo: String(row.piano_attivo || ""),
          operatore: String(row.operatore || ""),
          tariffa:
            typeof row.tariffa === "number"
              ? row.tariffa
              : row.tariffa == null || row.tariffa === ""
                ? null
                : Number(row.tariffa),
          data_scadenza: String(row.data_scadenza || ""),
          billing_status: String(row.billing_status || ""),
          attiva: row.attiva !== false,
        }))
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const operatoreOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => String(row.operatore || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [rows]);

  const billingStatusOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => String(row.billing_status || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);
    return rows.filter((row) => {
      if (attiveFilter === "ATTIVE" && !row.attiva) return false;
      if (operatoreFilter !== "TUTTI" && row.operatore !== operatoreFilter) return false;
      if (billingStatusFilter !== "TUTTI" && row.billing_status !== billingStatusFilter) return false;

      if (!query) return true;
      const haystack = normalizeText(
        [row.numero_telefono, row.intestatario, row.operatore, row.piano_attivo].join(" ")
      );
      return haystack.includes(query);
    });
  }, [rows, search, attiveFilter, operatoreFilter, billingStatusFilter]);

  return (
    <div style={{ maxWidth: 1280, margin: "24px auto", padding: "0 16px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>Censimento SIM</h1>
        <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
          Inventario SIM centralizzato con ricerca e filtri minimi.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px,1.4fr) minmax(160px,0.7fr) minmax(180px,0.8fr) minmax(180px,0.8fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Cerca
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Numero, intestatario, operatore, piano"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Stato SIM
          <select
            value={attiveFilter}
            onChange={(e) => setAttiveFilter(e.target.value as "ATTIVE" | "TUTTE")}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="ATTIVE">Solo attive</option>
            <option value="TUTTE">Tutte</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Operatore
          <select
            value={operatoreFilter}
            onChange={(e) => setOperatoreFilter(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="TUTTI">Tutti</option>
            {operatoreOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Stato fatturazione
          <select
            value={billingStatusFilter}
            onChange={(e) => setBillingStatusFilter(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="TUTTI">Tutti</option>
            {billingStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px minmax(180px,1fr) minmax(180px,1fr) 140px 110px 130px 170px 90px",
            gap: 12,
            padding: "14px 16px",
            fontSize: 12,
            fontWeight: 800,
            color: "#374151",
            background: "#f8fafc",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div>Numero</div>
          <div>Intestatario</div>
          <div>Piano attivo</div>
          <div>Operatore</div>
          <div>Tariffa</div>
          <div>Scadenza</div>
          <div>Fatturazione</div>
          <div>Attiva</div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Nessuna SIM trovata.</div>
        ) : (
          filteredRows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px minmax(180px,1fr) minmax(180px,1fr) 140px 110px 130px 170px 90px",
                gap: 12,
                padding: "14px 16px",
                borderBottom: "1px solid #f3f4f6",
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 700 }}>{row.numero_telefono || "—"}</div>
              <div>{row.intestatario || "—"}</div>
              <div>{row.piano_attivo || "—"}</div>
              <div>{row.operatore || "—"}</div>
              <div>{formatCurrency(row.tariffa)}</div>
              <div>{formatDate(row.data_scadenza)}</div>
              <div>{renderBillingBadge(row.billing_status)}</div>
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: row.attiva ? "#dcfce7" : "#e5e7eb",
                    color: row.attiva ? "#166534" : "#4b5563",
                  }}
                >
                  {row.attiva ? "ATTIVA" : "OFF"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
