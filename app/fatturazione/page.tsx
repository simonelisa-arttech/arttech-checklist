"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type SimRechargeRow = {
  id: string;
  sim_id: string;
  data_ricarica: string;
  importo: number | null;
  billing_status: string;
  note: string;
};

type SimCardRow = {
  id: string;
  checklist_id: string;
  numero_telefono: string;
};

type ChecklistRow = {
  id: string;
  nome_checklist: string;
  cliente: string;
};

type BillingRow = {
  id: string;
  sim_id: string;
  checklist_id: string;
  cliente: string;
  progetto: string;
  numero_sim: string;
  data_ricarica: string;
  importo: number | null;
  billing_status: string;
  note: string;
};

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

function toTime(value?: string | null) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function shortNote(value?: string | null) {
  const note = String(value || "").trim();
  if (!note) return "—";
  return note.length > 120 ? `${note.slice(0, 117)}...` : note;
}

export default function FatturazionePage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rows, setRows] = useState<BillingRow[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      const { data: rechargeData, error: rechargeError } = await dbFrom("sim_recharges")
        .select("id, sim_id, data_ricarica, importo, billing_status, note")
        .eq("billing_status", "DA_FATTURARE")
        .order("data_ricarica", { ascending: false });

      if (!active) return;

      if (rechargeError) {
        setError(`Errore caricamento fatturazione SIM: ${rechargeError.message}`);
        setRows([]);
        setLoading(false);
        return;
      }

      const recharges = (((rechargeData as any[]) || []) as Array<Record<string, any>>).map(
        (row) =>
          ({
            id: String(row.id || ""),
            sim_id: String(row.sim_id || ""),
            data_ricarica: String(row.data_ricarica || ""),
            importo:
              typeof row.importo === "number"
                ? row.importo
                : row.importo == null || row.importo === ""
                  ? null
                  : Number(row.importo),
            billing_status: String(row.billing_status || ""),
            note: String(row.note || ""),
          }) satisfies SimRechargeRow
      );

      const simIds = Array.from(new Set(recharges.map((row) => row.sim_id).filter(Boolean)));
      const simMap: Record<string, SimCardRow> = {};
      const checklistMap: Record<string, ChecklistRow> = {};

      if (simIds.length) {
        const { data: simData, error: simError } = await dbFrom("sim_cards")
          .select("id, checklist_id, numero_telefono")
          .in("id", simIds);

        if (!active) return;

        if (simError) {
          setError(`Errore caricamento SIM collegate: ${simError.message}`);
          setRows([]);
          setLoading(false);
          return;
        }

        for (const row of (((simData as any[]) || []) as Array<Record<string, any>>)) {
          const id = String(row.id || "");
          if (!id) continue;
          simMap[id] = {
            id,
            checklist_id: String(row.checklist_id || ""),
            numero_telefono: String(row.numero_telefono || ""),
          };
        }

        const checklistIds = Array.from(
          new Set(Object.values(simMap).map((row) => row.checklist_id).filter(Boolean))
        );

        if (checklistIds.length) {
          const { data: checklistData, error: checklistError } = await dbFrom("checklists")
            .select("id, nome_checklist, cliente")
            .in("id", checklistIds);

          if (!active) return;

          if (checklistError) {
            setError(`Errore caricamento progetti collegati: ${checklistError.message}`);
            setRows([]);
            setLoading(false);
            return;
          }

          for (const row of (((checklistData as any[]) || []) as Array<Record<string, any>>)) {
            const id = String(row.id || "");
            if (!id) continue;
            checklistMap[id] = {
              id,
              nome_checklist: String(row.nome_checklist || ""),
              cliente: String(row.cliente || ""),
            };
          }
        }
      }

      const nextRows = recharges
        .map((row) => {
          const sim = simMap[row.sim_id];
          const checklist = sim?.checklist_id ? checklistMap[sim.checklist_id] : null;
          return {
            id: row.id,
            sim_id: row.sim_id,
            checklist_id: sim?.checklist_id || "",
            cliente: checklist?.cliente || "—",
            progetto: checklist?.nome_checklist || "SIM libera",
            numero_sim: sim?.numero_telefono || "—",
            data_ricarica: row.data_ricarica,
            importo: row.importo,
            billing_status: row.billing_status,
            note: row.note,
          } satisfies BillingRow;
        })
        .sort((a, b) => toTime(b.data_ricarica) - toTime(a.data_ricarica));

      setRows(nextRows);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const totalImporto = useMemo(
    () => rows.reduce((sum, row) => sum + (row.importo && Number.isFinite(row.importo) ? row.importo : 0), 0),
    [rows]
  );

  const clientiCoinvolti = useMemo(
    () => new Set(rows.map((row) => row.cliente).filter((value) => value && value !== "—")).size,
    [rows]
  );

  async function markAsBilled(row: BillingRow) {
    setSavingId(row.id);
    setError(null);
    setNotice(null);

    const { error: updateError } = await dbFrom("sim_recharges")
      .update({ billing_status: "FATTURATO" })
      .eq("id", row.id);

    setSavingId(null);

    if (updateError) {
      setError(`Errore aggiornamento fatturazione: ${updateError.message}`);
      return;
    }

    setRows((prev) => prev.filter((item) => item.id !== row.id));
    setNotice("Ricarica segnata come fatturata.");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px 48px" }}>
      <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Fatturazione SIM</h1>
          <Link
            href="/sim"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 38,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Torna a SIM
          </Link>
        </div>
        <div style={{ fontSize: 14, color: "#6b7280" }}>
          Vista dedicata alle sole ricariche SIM da fatturare, senza includere altre fatturazioni future.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Totale da fatturare</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{formatCurrency(totalImporto)}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Ricariche da fatturare</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{rows.length}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Clienti coinvolti</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{clientiCoinvolti}</div>
        </div>
      </div>

      {error ? (
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
      ) : null}

      {notice ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: 14,
          }}
        >
          {notice}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
        }}
      >
        {loading ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Nessuna ricarica SIM da fatturare.</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid #f3f4f6",
                display: "grid",
                gap: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.6fr) minmax(220px, 0.9fr)",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{row.cliente}</div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "5px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        background: "#fef3c7",
                        color: "#92400e",
                      }}
                    >
                      {row.billing_status || "DA_FATTURARE"}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>{row.progetto}</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>SIM {row.numero_sim}</div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <div style={{ color: "#6b7280" }}>Data ricarica</div>
                    <div style={{ fontWeight: 700 }}>{formatDate(row.data_ricarica)}</div>
                  </div>
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <div style={{ color: "#6b7280" }}>Importo</div>
                    <div style={{ fontWeight: 700 }}>{formatCurrency(row.importo)}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <div style={{ color: "#6b7280" }}>Note</div>
                  <div>{shortNote(row.note)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => markAsBilled(row)}
                  disabled={savingId === row.id}
                  style={{
                    height: 38,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "1px solid #0f172a",
                    background: "#0f172a",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: savingId === row.id ? "wait" : "pointer",
                    opacity: savingId === row.id ? 0.8 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {savingId === row.id ? "Aggiornamento..." : "Segna come fatturato"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
