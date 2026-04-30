"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FatturaDaEmettereRow = {
  id: string;
  nome_checklist: string;
  cliente: string;
  data_installazione: string | null;
  percentuale_completamento: number;
};

type FatturaInterventoRow = {
  id: string;
  checklist_id: string | null;
  cliente: string;
  progetto_nome: string;
  descrizione: string;
  data_intervento: string | null;
  esito_fatturazione: string;
  note_amministrazione: string | null;
  ticket_no: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("it-IT");
}

function diffDays(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export default function FattureDaEmetterePage() {
  const [activeTab, setActiveTab] = useState<"progetti" | "interventi">("progetti");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FatturaDaEmettereRow[]>([]);
  const [interventiRows, setInterventiRows] = useState<FatturaInterventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingInterventoId, setSavingInterventoId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/fatture/da-emettere?type=${activeTab}`, {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.error || "Errore caricamento fatture da emettere");
        }
        if (activeTab === "progetti") {
          setRows(data as FatturaDaEmettereRow[]);
        } else {
          setInterventiRows(data as FatturaInterventoRow[]);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(String(err?.message || "Errore caricamento fatture da emettere"));
        if (activeTab === "progetti") setRows([]);
        else setInterventiRows([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [activeTab]);

  const todayIso = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return activeTab === "progetti" ? rows : interventiRows;
    }

    if (activeTab === "progetti") {
      return rows.filter((row) => {
        return (
          row.cliente?.toLowerCase().includes(query) ||
          row.nome_checklist?.toLowerCase().includes(query)
        );
      });
    }

    return interventiRows.filter((row) => {
      return (
        row.cliente?.toLowerCase().includes(query) ||
        row.progetto_nome?.toLowerCase().includes(query) ||
        row.descrizione?.toLowerCase().includes(query) ||
        row.ticket_no?.toLowerCase().includes(query)
      );
    });
  }, [activeTab, interventiRows, rows, search]);

  async function markInterventoFatturato(row: FatturaInterventoRow) {
    try {
      setSavingInterventoId(row.id);
      setError(null);
      const res = await fetch("/api/fatture/da-emettere", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: row.id,
          action: "mark_fatturato",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Errore aggiornamento fatturazione intervento");
      }
      setInterventiRows((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err: any) {
      setError(String(err?.message || "Errore aggiornamento fatturazione intervento"));
    } finally {
      setSavingInterventoId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>FATTURE DA EMETTERE</h1>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
            {activeTab === "progetti"
              ? "Progetti completati e non ancora esclusi dalla gestione fatturazione."
              : "Interventi chiusi che risultano ancora da fatturare."}
          </div>
        </div>
        <Link
          href="/admin"
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
            fontWeight: 600,
          }}
        >
          Torna ad Admin
        </Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { key: "progetti" as const, label: "Progetti" },
          { key: "interventi" as const, label: "Interventi" },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: active ? "1px solid #111827" : "1px solid #d1d5db",
                background: active ? "#111827" : "white",
                color: active ? "white" : "#111827",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Cerca cliente, progetto, ticket..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
      </div>

      {error ? <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}

      {loading ? (
        <div>Caricamento…</div>
      ) : activeTab === "progetti" ? (
        filteredData.length === 0 ? (
        <div>Nessuna fattura da emettere.</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.6fr 1fr 0.7fr 0.7fr",
              gap: 12,
              padding: "12px 14px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 700,
            }}
          >
            <div>Cliente</div>
            <div>Progetto</div>
            <div>Data installazione</div>
            <div>%</div>
            <div>Apri</div>
          </div>

          {(filteredData as FatturaDaEmettereRow[]).map((row) => {
            const daysSinceCompletion =
              row.data_installazione && row.data_installazione <= todayIso
                ? diffDays(row.data_installazione, todayIso)
                : null;
            const isRed = daysSinceCompletion !== null && daysSinceCompletion > 7;
            const isOrange = daysSinceCompletion !== null && daysSinceCompletion >= 0 && daysSinceCompletion <= 7;
            const background = isRed ? "#fef2f2" : isOrange ? "#fff7ed" : "white";
            const color = isRed ? "#991b1b" : isOrange ? "#9a3412" : "#111827";

            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1.6fr 1fr 0.7fr 0.7fr",
                  gap: 12,
                  padding: "12px 14px",
                  borderTop: "1px solid #f3f4f6",
                  background,
                  color,
                  alignItems: "center",
                }}
              >
                <div>{row.cliente}</div>
                <div style={{ fontWeight: 600 }}>{row.nome_checklist}</div>
                <div>{formatDate(row.data_installazione)}</div>
                <div>{Math.round(row.percentuale_completamento)}%</div>
                <div>
                  <Link
                    href={`/checklists/${row.id}`}
                    style={{
                      display: "inline-block",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "white",
                      textDecoration: "none",
                      color: "inherit",
                      fontWeight: 600,
                    }}
                  >
                    Apri
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )
      ) : filteredData.length === 0 ? (
        <div>Nessun intervento da fatturare.</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.2fr 1.2fr 1.5fr 1.4fr 0.9fr",
              gap: 12,
              padding: "12px 14px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 700,
            }}
          >
            <div>Data</div>
            <div>Cliente</div>
            <div>Progetto</div>
            <div>Descrizione</div>
            <div>Note amministrazione</div>
            <div>Azioni</div>
          </div>

          {(filteredData as FatturaInterventoRow[]).map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "0.9fr 1.2fr 1.2fr 1.5fr 1.4fr 0.9fr",
                gap: 12,
                padding: "12px 14px",
                borderTop: "1px solid #f3f4f6",
                alignItems: "center",
              }}
            >
              <div>{formatDate(row.data_intervento)}</div>
              <div>{row.cliente}</div>
              <div style={{ fontWeight: 600 }}>{row.progetto_nome}</div>
              <div>
                <div>{row.descrizione}</div>
                {row.ticket_no ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Ticket: {row.ticket_no}</div>
                ) : null}
              </div>
              <div
                title={row.note_amministrazione || undefined}
                style={{
                  fontSize: 12,
                  color: "#374151",
                  maxWidth: 240,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  lineHeight: 1.35,
                }}
              >
                {row.note_amministrazione || "—"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => markInterventoFatturato(row)}
                  disabled={savingInterventoId === row.id}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "white",
                    color: "inherit",
                    fontWeight: 600,
                    cursor: savingInterventoId === row.id ? "default" : "pointer",
                    opacity: savingInterventoId === row.id ? 0.6 : 1,
                  }}
                >
                  Segna come fatturato
                </button>
                {row.checklist_id ? (
                  <Link
                    href={`/checklists/${row.checklist_id}`}
                    style={{
                      display: "inline-block",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "white",
                      textDecoration: "none",
                      color: "inherit",
                      fontWeight: 600,
                    }}
                  >
                    Apri
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
