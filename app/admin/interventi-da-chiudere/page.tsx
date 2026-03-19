"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InterventoDaChiudereRow = {
  id: string;
  nome_checklist: string;
  cliente: string;
  data_installazione: string | null;
  percentuale_completamento: number;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("it-IT");
}

export default function InterventiDaChiuderePage() {
  const [rows, setRows] = useState<InterventoDaChiudereRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/interventi/da-chiudere", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data?.error || "Errore caricamento interventi da chiudere");
        }
        setRows(data as InterventoDaChiudereRow[]);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(String(err?.message || "Errore caricamento interventi da chiudere"));
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const todayIso = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 10);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>INTERVENTI DA CHIUDERE</h1>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
            Progetti in corso con task aperte e data installazione scaduta o odierna.
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
          Dashboard
        </Link>
        <Link
          href="/admin"
          style={{
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

      {error ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>
      ) : null}

      {loading ? (
        <div>Caricamento…</div>
      ) : rows.length === 0 ? (
        <div>Nessun intervento da chiudere.</div>
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

          {rows.map((row) => {
            const isToday = row.data_installazione === todayIso;
            const isPast = !!row.data_installazione && row.data_installazione < todayIso;
            const background = isPast && row.percentuale_completamento < 100
              ? "#fef2f2"
              : isToday
              ? "#fff7ed"
              : "white";
            const color = isPast && row.percentuale_completamento < 100
              ? "#991b1b"
              : isToday
              ? "#9a3412"
              : "#111827";

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
      )}
    </div>
  );
}
