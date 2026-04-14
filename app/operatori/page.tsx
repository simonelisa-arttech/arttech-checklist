"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isTimelineRowOverdueNotDone } from "@/lib/cronoprogrammaStatus";
import {
  buildOperativiSchedule,
  dateToOperativiIsoDay,
  durationToInputValue,
  formatOperativiDateLabel,
  normalizeOperativiDate,
} from "@/lib/operativiSchedule";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type TimelineRow = {
  kind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO";
  id: string;
  row_ref_id: string;
  data_prevista: string;
  data_tassativa: string;
  cliente: string;
  checklist_id: string | null;
  ticket_no?: string | null;
  proforma?: string | null;
  progetto: string;
  tipologia: string;
  descrizione: string;
  stato: string;
  fatto: boolean;
};

type CronoMeta = {
  fatto: boolean;
  hidden: boolean;
  data_inizio?: string | null;
  durata_giorni?: number | null;
  modalita_attivita?: string | null;
  personale_previsto?: string | null;
  personale_ids?: string[] | null;
};

type OperativiFields = {
  data_inizio: string;
  durata_giorni: string;
  modalita_attivita: string;
  personale_previsto: string;
  personale_ids: string[];
};

type TimeBudgetSummary = {
  stimatoMinuti: number | null;
  realeMinuti: number | null;
};

const BADGE_COLORS = {
  statusExpired: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
  statusDueSoon: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  statusOk: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  activityInstall: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  activityIntervento: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  activityRemote: { bg: "#f3e8ff", border: "#d8b4fe", color: "#7e22ce" },
  activityDisinstall: { bg: "#ffedd5", border: "#fdba74", color: "#c2410c" },
} as const;

function renderPill(
  label: string,
  colors: { bg: string; border: string; color: string },
  icon?: string
) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
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
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
    </span>
  );
}

function extractOperativi(meta?: CronoMeta | null): OperativiFields {
  return {
    data_inizio: normalizeOperativiDate(meta?.data_inizio),
    durata_giorni: durationToInputValue(meta?.durata_giorni),
    modalita_attivita: String(meta?.modalita_attivita || ""),
    personale_previsto: String(meta?.personale_previsto || ""),
    personale_ids: Array.isArray(meta?.personale_ids)
      ? meta.personale_ids.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
  };
}

function getRowKey(rowKind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO", rowRefId: string) {
  return `${rowKind}:${rowRefId}`;
}

function getRowSchedule(row: TimelineRow, value?: { data_inizio?: string | null; durata_giorni?: string | number | null } | null) {
  return buildOperativiSchedule(value?.data_inizio ?? null, row.data_tassativa || row.data_prevista, value?.durata_giorni ?? null);
}

function getActivityModeLabel(operativi: OperativiFields | null | undefined) {
  const raw = String(operativi?.modalita_attivita || "").trim().toUpperCase();
  return raw === "REMOTO" ? "REMOTO" : "ONSITE";
}

function getActivityKindLabel(row: TimelineRow, operativi: OperativiFields | null | undefined) {
  const mode = getActivityModeLabel(operativi);
  if (row.kind === "INTERVENTO" && mode === "REMOTO") return "ASSISTENZA REMOTA";
  return String(row.kind || "ATTIVITA").toUpperCase();
}

function renderActivityKindBadge(label: string) {
  if (label === "INSTALLAZIONE") return renderPill(label, BADGE_COLORS.activityInstall, "🔵");
  if (label === "INTERVENTO") return renderPill(label, BADGE_COLORS.activityIntervento, "🟢");
  if (label === "ASSISTENZA REMOTA") return renderPill(label, BADGE_COLORS.activityRemote, "🟣");
  if (label === "DISINSTALLAZIONE") return renderPill(label, BADGE_COLORS.activityDisinstall, "🟠");
  return renderPill(label, BADGE_COLORS.statusDueSoon);
}

function renderModeBadge(mode: string) {
  return mode === "REMOTO"
    ? renderPill("REMOTO", BADGE_COLORS.activityRemote)
    : renderPill("ONSITE", BADGE_COLORS.activityInstall);
}

function formatMinutesCompact(value?: number | null) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) return "—";
  const total = Math.round(Number(value));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function renderBudgetBadge(stimatoMinuti: number | null, realeMinuti: number | null) {
  if (!Number.isFinite(Number(stimatoMinuti)) || stimatoMinuti == null) return null;
  const actual = Number.isFinite(Number(realeMinuti)) && realeMinuti != null ? Number(realeMinuti) : 0;
  if (actual <= stimatoMinuti) return renderPill("IN LINEA", BADGE_COLORS.statusOk, "🟢");
  if (actual <= stimatoMinuti * 1.3) return renderPill("FUORI STIMA", BADGE_COLORS.statusDueSoon, "🟠");
  return renderPill("MOLTO FUORI", BADGE_COLORS.statusExpired, "🔴");
}

export default function OperatoreAttivitaPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatoreLabel, setOperatoreLabel] = useState<string>("");
  const [personaleId, setPersonaleId] = useState<string | null>(null);
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [metaByKey, setMetaByKey] = useState<Record<string, CronoMeta>>({});
  const [timeBudgetByKey, setTimeBudgetByKey] = useState<Record<string, TimeBudgetSummary>>({});
  const [timbraturaStateByKey, setTimbraturaStateByKey] = useState<
    Record<string, "NON_INIZIATA" | "IN_CORSO" | "COMPLETATA">
  >({});
  const [timbraturaLoadingKey, setTimbraturaLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const meRes = await fetch("/api/me-operatore", { credentials: "include" });
        const meData = await meRes.json().catch(() => ({}));
        if (!meRes.ok || !meData?.operatore?.id) {
          throw new Error(String(meData?.error || "Operatore non autenticato"));
        }

        const operatoreId = String(meData.operatore.id);
        setOperatoreLabel(String(meData.operatore.nome || "Operatore"));

        const { data: operatoreRow, error: operatoreErr } = await dbFrom("operatori")
          .select("id,nome,personale_id")
          .eq("id", operatoreId)
          .maybeSingle();
        if (operatoreErr) throw new Error(operatoreErr.message);

        const linkedPersonaleId = String((operatoreRow as any)?.personale_id || "").trim() || null;
        if (!linkedPersonaleId) {
          throw new Error("Operatore non collegato a personale.");
        }
        if (!active) return;
        setPersonaleId(linkedPersonaleId);

        const eventsRes = await fetch("/api/cronoprogramma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "load_events" }),
        });
        const eventsData = await eventsRes.json().catch(() => ({}));
        if (!eventsRes.ok) {
          throw new Error(String(eventsData?.error || "Errore caricamento cronoprogramma"));
        }

        const timeline = ((eventsData?.events as TimelineRow[]) || []).filter(Boolean);
        const loadRes = await fetch("/api/cronoprogramma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "load",
            rows: timeline.map((row) => ({
              row_kind: row.kind,
              row_ref_id: row.row_ref_id,
            })),
          }),
        });
        const loadData = await loadRes.json().catch(() => ({}));
        if (!loadRes.ok) {
          throw new Error(String(loadData?.error || "Errore caricamento meta cronoprogramma"));
        }

        const nextMeta = (loadData?.meta || {}) as Record<string, CronoMeta>;
        const assignedRows = timeline.filter((row) => {
          const key = getRowKey(row.kind, row.row_ref_id);
          const meta = nextMeta[key];
          if (meta?.hidden) return false;
          const ids = Array.isArray(meta?.personale_ids) ? meta.personale_ids.map(String) : [];
          return ids.includes(linkedPersonaleId);
        });

        const rowKinds = Array.from(new Set(assignedRows.map((row) => row.kind)));
        const rowRefIds = Array.from(new Set(assignedRows.map((row) => row.row_ref_id)));
        const wanted = new Set(assignedRows.map((row) => getRowKey(row.kind, row.row_ref_id)));

        const [budgetMetaRes, timbratureRes] = await Promise.all([
          supabase
            .from("cronoprogramma_meta")
            .select("row_kind,row_ref_id,durata_prevista_minuti")
            .in("row_kind", rowKinds)
            .in("row_ref_id", rowRefIds),
          supabase
            .from("cronoprogramma_timbrature")
            .select("row_kind,row_ref_id,durata_effettiva_minuti,stato,created_at")
            .eq("operatore_id", operatoreId)
            .in("row_kind", rowKinds)
            .in("row_ref_id", rowRefIds)
            .order("created_at", { ascending: false }),
        ]);

        if (budgetMetaRes.error) {
          console.error("Errore caricamento durata prevista operatore", budgetMetaRes.error);
        }
        if (timbratureRes.error) {
          console.error("Errore caricamento timbrature operatore", timbratureRes.error);
        }

        const nextTimeBudget: Record<string, TimeBudgetSummary> = {};
        const nextTimbraturaState: Record<string, "NON_INIZIATA" | "IN_CORSO" | "COMPLETATA"> = {};
        for (const row of assignedRows) {
          const key = getRowKey(row.kind, row.row_ref_id);
          nextTimeBudget[key] = { stimatoMinuti: null, realeMinuti: null };
          nextTimbraturaState[key] = "NON_INIZIATA";
        }

        for (const row of budgetMetaRes.data || []) {
          const key = `${String((row as any).row_kind || "")}:${String((row as any).row_ref_id || "")}`;
          if (!wanted.has(key)) continue;
          nextTimeBudget[key] = {
            ...(nextTimeBudget[key] || { stimatoMinuti: null, realeMinuti: null }),
            stimatoMinuti:
              Number.isFinite(Number((row as any).durata_prevista_minuti)) && Number((row as any).durata_prevista_minuti) >= 0
                ? Number((row as any).durata_prevista_minuti)
                : null,
          };
        }

        for (const row of timbratureRes.data || []) {
          const key = `${String((row as any).row_kind || "")}:${String((row as any).row_ref_id || "")}`;
          if (!wanted.has(key)) continue;
          if (nextTimeBudget[key]?.realeMinuti == null) {
            nextTimeBudget[key] = {
              ...(nextTimeBudget[key] || { stimatoMinuti: null, realeMinuti: null }),
              realeMinuti:
                Number.isFinite(Number((row as any).durata_effettiva_minuti)) && Number((row as any).durata_effettiva_minuti) >= 0
                  ? Number((row as any).durata_effettiva_minuti)
                  : 0,
            };
          }
          if (nextTimbraturaState[key] === "NON_INIZIATA") {
            const stato = String((row as any).stato || "").trim().toUpperCase();
            nextTimbraturaState[key] =
              stato === "IN_CORSO" ? "IN_CORSO" : stato === "COMPLETATA" ? "COMPLETATA" : "NON_INIZIATA";
          }
        }

        if (!active) return;
        setMetaByKey(nextMeta);
        setRows(assignedRows);
        setTimeBudgetByKey(nextTimeBudget);
        setTimbraturaStateByKey(nextTimbraturaState);
      } catch (err: any) {
        if (!active) return;
        setError(String(err?.message || "Errore caricamento attività operatore"));
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const sortedRows = useMemo(() => {
    const todayIso = dateToOperativiIsoDay(new Date());
    const list = [...rows];
    list.sort((a, b) => {
      const aSchedule = getRowSchedule(a, metaByKey[getRowKey(a.kind, a.row_ref_id)] || null);
      const bSchedule = getRowSchedule(b, metaByKey[getRowKey(b.kind, b.row_ref_id)] || null);
      const aDate = String(aSchedule.data_inizio || a.data_tassativa || a.data_prevista || "");
      const bDate = String(bSchedule.data_inizio || b.data_tassativa || b.data_prevista || "");
      const aBucket = aDate === todayIso ? 0 : aDate > todayIso ? 1 : 2;
      const bBucket = bDate === todayIso ? 0 : bDate > todayIso ? 1 : 2;
      if (aBucket !== bBucket) return aBucket - bBucket;
      return aDate.localeCompare(bDate);
    });
    return list;
  }, [metaByKey, rows]);

  async function handleTimbraturaAction(
    row: TimelineRow,
    key: string,
    action: "start_timbratura" | "stop_timbratura"
  ) {
    try {
      setTimbraturaLoadingKey(key);
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Errore timbratura operatore", data);
        return;
      }
      setTimbraturaStateByKey((prev) => ({
        ...prev,
        [key]: action === "start_timbratura" ? "IN_CORSO" : "COMPLETATA",
      }));
      if (action === "start_timbratura") {
        setTimeBudgetByKey((prev) => ({
          ...prev,
          [key]: {
            stimatoMinuti: prev[key]?.stimatoMinuti ?? null,
            realeMinuti: prev[key]?.realeMinuti ?? 0,
          },
        }));
      } else {
        setTimeBudgetByKey((prev) => ({
          ...prev,
          [key]: {
            stimatoMinuti: prev[key]?.stimatoMinuti ?? null,
            realeMinuti:
              Number.isFinite(Number(data?.durata_effettiva_minuti)) && Number(data?.durata_effettiva_minuti) >= 0
                ? Number(data.durata_effettiva_minuti)
                : prev[key]?.realeMinuti ?? 0,
          },
        }));
      }
    } catch (err) {
      console.error("Errore timbratura operatore", err);
    } finally {
      setTimbraturaLoadingKey((prev) => (prev === key ? null : prev));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>LE MIE ATTIVITÀ</h1>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.72 }}>
            {operatoreLabel ? `Operatore: ${operatoreLabel}` : "Attività assegnate al collaboratore loggato"}
          </div>
        </div>
        {personaleId ? (
          <div
            style={{
              marginLeft: "auto",
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              fontSize: 12,
              fontWeight: 700,
              color: "#475569",
            }}
          >
            Personale collegato
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>
      ) : null}

      {loading ? (
        <div>Caricamento…</div>
      ) : sortedRows.length === 0 ? (
        <div>Nessuna attività assegnata.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sortedRows.map((row) => {
            const key = getRowKey(row.kind, row.row_ref_id);
            const meta = metaByKey[key] || null;
            const operativi = extractOperativi(meta);
            const schedule = getRowSchedule(row, meta);
            const modeLabel = getActivityModeLabel(operativi);
            const kindLabel = getActivityKindLabel(row, operativi);
            const timbraturaState = timbraturaStateByKey[key] || "NON_INIZIATA";
            const timbraturaLoading = timbraturaLoadingKey === key;
            const timeBudget = timeBudgetByKey[key] || { stimatoMinuti: null, realeMinuti: null };
            const overdue = isTimelineRowOverdueNotDone(row, meta);

            return (
              <div
                key={row.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: overdue ? "#fffaf5" : "white",
                  padding: "12px 14px",
                  display: "grid",
                  gap: 10,
                  borderLeft: overdue ? "4px solid #f59e0b" : "4px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {renderActivityKindBadge(kindLabel)}
                      {renderModeBadge(modeLabel)}
                      {overdue ? renderPill("SCADUTO", BADGE_COLORS.statusExpired) : renderPill("IN PROGRAMMA", BADGE_COLORS.statusOk)}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", wordBreak: "break-word" }}>
                      {row.progetto || "Attività cronoprogramma"}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "#475569" }}>
                      <span>Cliente: {row.cliente || "—"}</span>
                      <span>Data: {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}</span>
                      <span>Rif: {row.ticket_no || row.proforma || "—"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#475569" }}>
                      <span>Stimato: {formatMinutesCompact(timeBudget.stimatoMinuti)}</span>
                      <span>Reale: {formatMinutesCompact(timeBudget.realeMinuti)}</span>
                      {renderBudgetBadge(timeBudget.stimatoMinuti, timeBudget.realeMinuti)}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {timbraturaState === "IN_CORSO" ? renderPill("IN CORSO", BADGE_COLORS.activityRemote, "⏸") : null}
                      {timbraturaState === "COMPLETATA" ? renderPill("COMPLETATA", BADGE_COLORS.statusOk, "✓") : null}
                      {timbraturaState === "NON_INIZIATA" ? (
                        <button
                          type="button"
                          onClick={() => void handleTimbraturaAction(row, key, "start_timbratura")}
                          disabled={timbraturaLoading}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "1px solid #86efac",
                            background: "#f0fdf4",
                            color: "#166534",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: timbraturaLoading ? "wait" : "pointer",
                            opacity: timbraturaLoading ? 0.7 : 1,
                          }}
                        >
                          ▶ Inizia
                        </button>
                      ) : null}
                      {timbraturaState === "IN_CORSO" ? (
                        <button
                          type="button"
                          onClick={() => void handleTimbraturaAction(row, key, "stop_timbratura")}
                          disabled={timbraturaLoading}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: "1px solid #fca5a5",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: timbraturaLoading ? "wait" : "pointer",
                            opacity: timbraturaLoading ? 0.7 : 1,
                          }}
                        >
                          ⏹ Termina
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8, justifyItems: "end", textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {schedule.data_fine ? `Fine ${formatOperativiDateLabel(schedule.data_fine)}` : "Fine —"}
                    </div>
                    {row.checklist_id ? (
                      <Link
                        href={`/checklists/${row.checklist_id}`}
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          background: "white",
                          color: "inherit",
                          textDecoration: "none",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Apri progetto
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
