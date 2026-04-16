"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type TimelineRow = {
  kind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO";
  row_ref_id: string;
};

type TimeBudgetSummary = {
  stimatoMinuti: number | null;
  realeMinuti: number | null;
};

type CronoMeta = {
  personale_previsto?: string | null;
  personale_ids?: string[] | null;
};

type PersonaleRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
};

type OperatoreKpiRow = {
  id: string;
  nome: string;
  stimatoMinuti: number;
  realeMinuti: number;
  deltaMinuti: number;
};

function formatMinutesCompact(value?: number | null) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) return "—";
  const total = Math.round(Number(value));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function normalizeText(value?: string | null) {
  return String(value || "").trim();
}

function getDeltaState(stimatoMinuti: number, realeMinuti: number) {
  const deltaMinuti = realeMinuti - stimatoMinuti;
  const absoluteDelta = Math.abs(deltaMinuti);

  if (absoluteDelta <= 15) {
    return {
      label: "IN LINEA",
      detail: "In linea",
      colors: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
    };
  }

  if (deltaMinuti < 0) {
    return {
      label: "RISPARMIO",
      detail: `Risparmio: ${formatMinutesCompact(absoluteDelta)}`,
      colors: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
    };
  }

  if (stimatoMinuti > 0 && deltaMinuti <= stimatoMinuti * 0.25) {
    return {
      label: "FUORI STIMA",
      detail: `Ritardo: ${formatMinutesCompact(deltaMinuti)}`,
      colors: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
    };
  }

  return {
    label: "FORTE RITARDO",
    detail: `Ritardo: ${formatMinutesCompact(deltaMinuti)}`,
    colors: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
  };
}

function renderPill(
  label: string,
  colors: { bg: string; border: string; color: string }
) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function OperativiKpiPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperatoreKpiRow[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const eventsRes = await fetch("/api/cronoprogramma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "load_events" }),
        });
        const eventsData = await eventsRes.json().catch(() => ({}));
        if (!eventsRes.ok) {
          throw new Error(String(eventsData?.error || "Errore caricamento eventi cronoprogramma"));
        }

        const events = ((eventsData?.events as TimelineRow[]) || []).filter(
          (row) => String(row?.row_ref_id || "").trim() && String(row?.kind || "").trim()
        );

        if (!active) return;

        if (events.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        const loadRows = events.map((row) => ({
          row_kind: String(row.kind || "").trim().toUpperCase(),
          row_ref_id: String(row.row_ref_id || "").trim(),
        }));

        const stateRes = await fetch("/api/cronoprogramma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "load",
            rows: loadRows,
          }),
        });
        const stateData = await stateRes.json().catch(() => ({}));
        if (!stateRes.ok) {
          throw new Error(String(stateData?.error || "Errore caricamento KPI operativi"));
        }

        const metaByKey = (stateData?.meta || {}) as Record<string, CronoMeta>;
        const timeBudgetByKey = (stateData?.time_budget || {}) as Record<string, TimeBudgetSummary>;

        const { data: personaleData, error: personaleError } = await dbFrom("personale")
          .select("id,nome,cognome")
          .eq("attivo", true)
          .order("cognome", { ascending: true })
          .order("nome", { ascending: true });

        if (!active) return;
        if (personaleError) {
          throw new Error(`Errore caricamento personale: ${personaleError.message}`);
        }

        const personaleMap: Record<string, string> = {};
        for (const row of (((personaleData as any[]) || []) as Array<PersonaleRow & Record<string, unknown>>)) {
          const id = String(row.id || "").trim();
          if (!id) continue;
          const nome = [normalizeText(row.cognome), normalizeText(row.nome)].filter(Boolean).join(" ").trim();
          personaleMap[id] = nome || id;
        }

        const aggregate = new Map<string, OperatoreKpiRow>();

        for (const row of loadRows) {
          const key = `${row.row_kind}:${row.row_ref_id}`;
          const meta = metaByKey[key] || {};
          const budget = timeBudgetByKey[key] || { stimatoMinuti: 0, realeMinuti: 0 };
          const stimato = Number.isFinite(Number(budget.stimatoMinuti)) ? Math.round(Number(budget.stimatoMinuti)) : 0;
          const reale = Number.isFinite(Number(budget.realeMinuti)) ? Math.round(Number(budget.realeMinuti)) : 0;

          const personaleIds = Array.isArray(meta.personale_ids)
            ? meta.personale_ids.map((value) => String(value || "").trim()).filter(Boolean)
            : [];

          const assignees =
            personaleIds.length > 0
              ? personaleIds.map((id) => ({ id: `personale:${id}`, nome: personaleMap[id] || id }))
              : normalizeText(meta.personale_previsto)
                ? [{ id: `legacy:${normalizeText(meta.personale_previsto)}`, nome: normalizeText(meta.personale_previsto) }]
                : [];

          if (assignees.length === 0) continue;

          const shareStimato = stimato / assignees.length;
          const shareReale = reale / assignees.length;

          for (const assignee of assignees) {
            const current = aggregate.get(assignee.id) || {
              id: assignee.id,
              nome: assignee.nome,
              stimatoMinuti: 0,
              realeMinuti: 0,
              deltaMinuti: 0,
            };
            current.stimatoMinuti += shareStimato;
            current.realeMinuti += shareReale;
            current.deltaMinuti = current.realeMinuti - current.stimatoMinuti;
            aggregate.set(assignee.id, current);
          }
        }

        const nextRows = Array.from(aggregate.values())
          .map((row) => ({
            ...row,
            stimatoMinuti: Math.round(row.stimatoMinuti),
            realeMinuti: Math.round(row.realeMinuti),
            deltaMinuti: Math.round(row.deltaMinuti),
          }))
          .sort((a, b) => {
            if (b.deltaMinuti !== a.deltaMinuti) return b.deltaMinuti - a.deltaMinuti;
            return a.nome.localeCompare(b.nome, "it", { sensitivity: "base" });
          });

        setRows(nextRows);
      } catch (err: any) {
        if (!active) return;
        setError(String(err?.message || "Errore caricamento KPI operativi"));
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const totalStimato = useMemo(
    () => rows.reduce((sum, row) => sum + row.stimatoMinuti, 0),
    [rows]
  );
  const totalReale = useMemo(
    () => rows.reduce((sum, row) => sum + row.realeMinuti, 0),
    [rows]
  );
  const totalDelta = totalReale - totalStimato;
  const totalState = getDeltaState(totalStimato, totalReale);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px 48px" }}>
      <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>KPI Operativi</h1>
        <div style={{ fontSize: 14, color: "#6b7280" }}>
          Vista sintetica dei tempi stimati e reali aggregati per operatore.
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
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Totale ore stimate</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{formatMinutesCompact(totalStimato)}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Totale ore reali</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{formatMinutesCompact(totalReale)}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 16, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Delta complessivo</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {totalState.detail}
          </div>
          <div>{renderPill(totalState.label, totalState.colors)}</div>
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
          <div style={{ padding: 18, color: "#6b7280" }}>Nessun KPI operatore disponibile.</div>
        ) : (
          rows.map((row) => {
            const state = getDeltaState(row.stimatoMinuti, row.realeMinuti);
            return (
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
                    gridTemplateColumns: "minmax(0, 1.4fr) minmax(220px, 0.9fr)",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{row.nome}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {renderPill(state.label, state.colors)}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
                    <div style={{ fontSize: 13, color: "#475569" }}>Delta: {state.detail}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#6b7280" }}>Ore stimate</div>
                    <div style={{ fontWeight: 700 }}>{formatMinutesCompact(row.stimatoMinuti)}</div>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#6b7280" }}>Ore reali</div>
                    <div style={{ fontWeight: 700 }}>{formatMinutesCompact(row.realeMinuti)}</div>
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#6b7280" }}>Delta</div>
                    <div style={{ fontWeight: 700 }}>{state.detail}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
