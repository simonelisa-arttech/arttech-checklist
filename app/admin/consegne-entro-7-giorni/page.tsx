"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ConsegnaRow = {
  id: string;
  nome_checklist: string;
  cliente: string;
  data_consegna: string | null;
  stato_progetto: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("it-IT");
}

export default function ConsegneEntro7GiorniPage() {
  const [rows, setRows] = useState<ConsegnaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/consegne/entro-7-giorni", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.error || "Errore caricamento consegne entro 7 giorni");
        }
        setRows(data as ConsegnaRow[]);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(String(err?.message || "Errore caricamento consegne entro 7 giorni"));
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>CONSEGNE ENTRO 7 GIORNI</h1>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
            Progetti non consegnati né chiusi con data operativa nei prossimi 7 giorni.
          </div>
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
            fontWeight: 600,
          }}
        >
          Torna alla Dashboard
        </Link>
      </div>

      {error ? <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}

      {loading ? (
        <div>Caricamento…</div>
      ) : rows.length === 0 ? (
        <div>Nessuna consegna entro 7 giorni.</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.6fr 1fr 1fr 0.7fr",
              gap: 12,
              padding: "12px 14px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 700,
            }}
          >
            <div>Cliente</div>
            <div>Progetto</div>
            <div>Data operativa</div>
            <div>Stato</div>
            <div>Apri</div>
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 1.6fr 1fr 1fr 0.7fr",
                gap: 12,
                padding: "12px 14px",
                borderTop: "1px solid #f3f4f6",
                alignItems: "center",
              }}
            >
              <div>{row.cliente}</div>
              <div style={{ fontWeight: 600 }}>{row.nome_checklist}</div>
              <div>{formatDate(row.data_consegna)}</div>
              <div>{row.stato_progetto || "—"}</div>
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
          ))}
        </div>
      )}
    </div>
  );
}
