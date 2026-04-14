"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dispatch, MutableRefObject, SetStateAction, UIEvent } from "react";
import PersonaleMultiSelect from "@/components/PersonaleMultiSelect";
import SafetyComplianceBadge from "@/components/SafetyComplianceBadge";
import { isTimelineRowOverdueNotDone } from "@/lib/cronoprogrammaStatus";
import { formatOperativiDateLabel } from "@/lib/operativiSchedule";

type TimelineRow = any;
type CronoMeta = any;
type CronoComment = any;
type OperativiFields = any;
type TimeBudgetSummary = {
  stimatoMinuti: number | null;
  realeMinuti: number | null;
};

const BADGE_COLORS = {
  statusExpired: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
  statusDueSoon: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  statusOk: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  statusNeutral: { bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
  activityInstall: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  activityIntervento: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  activityRemote: { bg: "#f3e8ff", border: "#d8b4fe", color: "#7e22ce" },
  activityDisinstall: { bg: "#ffedd5", border: "#fdba74", color: "#c2410c" },
} as const;

type CronoprogrammaPanelProps = {
  fromDate: string;
  setFromDate: Dispatch<SetStateAction<string>>;
  toDate: string;
  setToDate: Dispatch<SetStateAction<string>>;
  clienteFilter: string;
  setClienteFilter: Dispatch<SetStateAction<string>>;
  kindFilter: "TUTTI" | "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO";
  setKindFilter: Dispatch<
    SetStateAction<"TUTTI" | "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO">
  >;
  q: string;
  setQ: Dispatch<SetStateAction<string>>;
  personaleFilter: string;
  setPersonaleFilter: Dispatch<SetStateAction<string>>;
  clienti: string[];
  quickRangeDays: 7 | 15 | 30 | null;
  applyQuickRange: (days: 7 | 15 | 30) => void;
  showFatto: boolean;
  setShowFatto: Dispatch<SetStateAction<boolean>>;
  showHidden: boolean;
  setShowHidden: Dispatch<SetStateAction<boolean>>;
  filteredSorted: TimelineRow[];
  onExportCsv: () => void;
  topScrollRef: MutableRefObject<HTMLDivElement | null>;
  mainScrollRef: MutableRefObject<HTMLDivElement | null>;
  bottomScrollRef: MutableRefObject<HTMLDivElement | null>;
  scrollContentRef: MutableRefObject<HTMLDivElement | null>;
  onTopScroll: (e: UIEvent<HTMLDivElement>) => void;
  onMainScroll: (e: UIEvent<HTMLDivElement>) => void;
  onBottomScroll: (e: UIEvent<HTMLDivElement>) => void;
  scrollContentWidth: number;
  loading: boolean;
  sortBy: "data_prevista" | "data_tassativa";
  sortDir: "asc" | "desc";
  toggleSort: (field: "data_prevista" | "data_tassativa") => void;
  metaByKey: Record<string, CronoMeta>;
  commentsByKey: Record<string, CronoComment[]>;
  noteDraftByKey: Record<string, string>;
  setNoteDraftByKey: Dispatch<SetStateAction<Record<string, string>>>;
  stateLoading: boolean;
  savingFattoKey: string | null;
  savingHiddenKey: string | null;
  savingCommentKey: string | null;
  savingOperativiKey: string | null;
  deletingCommentId: string | null;
  noteHistoryKey: string | null;
  setNoteHistoryKey: Dispatch<SetStateAction<string | null>>;
  operativiDraftByKey: Record<string, OperativiFields>;
  setOperativiDraftByKey: Dispatch<SetStateAction<Record<string, OperativiFields>>>;
  conflictByKey: Record<string, any>;
  rowByKey: Record<string, TimelineRow>;
  setFatto: (row: TimelineRow, fatto: boolean) => void;
  setHidden: (row: TimelineRow, hidden: boolean) => void;
  addComment: (row: TimelineRow) => void;
  saveOperativi: (row: TimelineRow) => void;
  deleteComment: (row: TimelineRow, commentId: string) => void;
  getRowKey: (kind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO", rowRefId: string) => string;
  getRowSchedule: (row: TimelineRow, value?: any) => {
    data_inizio: string;
    data_fine: string;
    durata_giorni: number;
  };
  extractOperativi: (meta?: CronoMeta | null) => OperativiFields;
  buildConflictTooltip: (personale: string[], mezzi: string[]) => string;
  hasDefinedOperativi: (meta?: CronoMeta | null) => boolean;
  emptyOperativi: OperativiFields;
};

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

function getActivityModeLabel(operativi: OperativiFields | null | undefined) {
  const raw = String(operativi?.modalita_attivita || "")
    .trim()
    .toUpperCase();
  return raw === "REMOTO" ? "REMOTO" : "ONSITE";
}

function getActivityKindLabel(row: TimelineRow, operativi: OperativiFields | null | undefined) {
  const mode = getActivityModeLabel(operativi);
  if (row.kind === "INTERVENTO" && mode === "REMOTO") return "ASSISTENZA REMOTA";
  return String(row.kind || "ATTIVITA").toUpperCase();
}

function renderActivityKindBadge(label: string) {
  if (label === "INSTALLAZIONE") {
    return renderPill(label, BADGE_COLORS.activityInstall, "🔵");
  }
  if (label === "INTERVENTO") {
    return renderPill(label, BADGE_COLORS.activityIntervento, "🟢");
  }
  if (label === "ASSISTENZA REMOTA") {
    return renderPill(label, BADGE_COLORS.activityRemote, "🟣");
  }
  if (label === "DISINSTALLAZIONE") {
    return renderPill(label, BADGE_COLORS.activityDisinstall, "🟠");
  }
  return renderPill(label, { bg: "#f3f4f6", border: "#d1d5db", color: "#374151" });
}

function renderModeBadge(mode: string) {
  return mode === "REMOTO"
    ? renderPill("REMOTO", BADGE_COLORS.activityRemote)
    : renderPill("ONSITE", BADGE_COLORS.activityInstall);
}

function renderRowStatusBadge({
  fatto,
  overdueNotDone,
  operativoDefinito,
  hidden,
}: {
  fatto: boolean;
  overdueNotDone: boolean;
  operativoDefinito: boolean;
  hidden: boolean;
}) {
  if (hidden) {
    return renderPill("NASCOSTA", BADGE_COLORS.statusNeutral);
  }
  if (fatto) {
    return renderPill("OK", BADGE_COLORS.statusOk);
  }
  if (overdueNotDone) {
    return renderPill("SCADUTO", BADGE_COLORS.statusExpired);
  }
  if (operativoDefinito) {
    return renderPill("OK", BADGE_COLORS.statusOk);
  }
  return renderPill("ATTENZIONE", BADGE_COLORS.statusDueSoon);
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
  if (actual <= stimatoMinuti) {
    return renderPill("IN LINEA", BADGE_COLORS.statusOk, "🟢");
  }
  if (actual <= stimatoMinuti * 1.3) {
    return renderPill("FUORI STIMA", BADGE_COLORS.statusDueSoon, "🟠");
  }
  return renderPill("MOLTO FUORI", BADGE_COLORS.statusExpired, "🔴");
}

export default function CronoprogrammaPanel({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  clienteFilter,
  setClienteFilter,
  kindFilter,
  setKindFilter,
  q,
  setQ,
  personaleFilter,
  setPersonaleFilter,
  clienti,
  quickRangeDays,
  applyQuickRange,
  showFatto,
  setShowFatto,
  showHidden,
  setShowHidden,
  filteredSorted,
  onExportCsv,
  topScrollRef,
  mainScrollRef,
  bottomScrollRef,
  scrollContentRef,
  onTopScroll,
  onMainScroll,
  onBottomScroll,
  scrollContentWidth,
  loading,
  sortBy,
  sortDir,
  toggleSort,
  metaByKey,
  commentsByKey,
  noteDraftByKey,
  setNoteDraftByKey,
  stateLoading,
  savingFattoKey,
  savingHiddenKey,
  savingCommentKey,
  savingOperativiKey,
  deletingCommentId,
  noteHistoryKey,
  setNoteHistoryKey,
  operativiDraftByKey,
  setOperativiDraftByKey,
  conflictByKey,
  rowByKey,
  setFatto,
  setHidden,
  addComment,
  saveOperativi,
  deleteComment,
  getRowKey,
  getRowSchedule,
  extractOperativi,
  buildConflictTooltip,
  hasDefinedOperativi,
  emptyOperativi,
}: CronoprogrammaPanelProps) {
  const [openConflictKey, setOpenConflictKey] = useState<string | null>(null);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [timbraturaStateByKey, setTimbraturaStateByKey] = useState<
    Record<string, "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA">
  >({});
  const [timbraturaLoadingKey, setTimbraturaLoadingKey] = useState<string | null>(null);
  const [timeBudgetByKey, setTimeBudgetByKey] = useState<Record<string, TimeBudgetSummary>>({});

  useEffect(() => {
    let active = true;
    if (filteredSorted.length === 0) {
      setTimeBudgetByKey({});
      setTimbraturaStateByKey({});
      return;
    }

    const rows = filteredSorted.map((row) => ({
      row_kind: String(row.kind || "").trim().toUpperCase(),
      row_ref_id: String(row.row_ref_id || "").trim(),
    }));

    void (async () => {
      const next: Record<string, TimeBudgetSummary> = {};
      const nextTimbraturaState: Record<string, "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA"> = {};
      for (const row of rows) {
        const key = `${row.row_kind}:${row.row_ref_id}`;
        next[key] = { stimatoMinuti: null, realeMinuti: null };
        nextTimbraturaState[key] = "NON_INIZIATA";
      }

      try {
        const res = await fetch("/api/cronoprogramma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "load",
            rows,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          console.error("Errore caricamento riepilogo cronoprogramma", data);
          setTimeBudgetByKey(next);
          setTimbraturaStateByKey(nextTimbraturaState);
          return;
        }

        const serverBudget = data?.time_budget && typeof data.time_budget === "object" ? data.time_budget : {};
        for (const [key, value] of Object.entries(serverBudget)) {
          if (!next[key]) continue;
          const summary = value as Record<string, unknown>;
          next[key] = {
            stimatoMinuti:
              Number.isFinite(Number(summary?.stimatoMinuti)) && Number(summary?.stimatoMinuti) >= 0
                ? Number(summary?.stimatoMinuti)
                : null,
            realeMinuti:
              Number.isFinite(Number(summary?.realeMinuti)) && Number(summary?.realeMinuti) >= 0
                ? Number(summary?.realeMinuti)
                : null,
          };
          const stato = String(summary?.stato || "").trim().toUpperCase();
          nextTimbraturaState[key] =
            stato === "IN_CORSO"
              ? "IN_CORSO"
              : stato === "IN_PAUSA"
                ? "IN_PAUSA"
                : stato === "COMPLETATA"
                  ? "COMPLETATA"
                  : "NON_INIZIATA";
        }
      } catch (error) {
        if (!active) return;
        console.error("Errore caricamento riepilogo cronoprogramma", error);
      }

      setTimeBudgetByKey(next);
      setTimbraturaStateByKey(nextTimbraturaState);
    })();

    return () => {
      active = false;
    };
  }, [filteredSorted]);

  async function handleTimbraturaAction(
    row: TimelineRow,
    key: string,
    action: "start_timbratura" | "pause_timbratura" | "resume_timbratura" | "stop_timbratura"
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
        console.error("Errore timbratura cronoprogramma", data);
        return;
      }
      setTimbraturaStateByKey((prev) => ({
        ...prev,
        [key]:
          action === "start_timbratura" || action === "resume_timbratura"
            ? "IN_CORSO"
            : action === "pause_timbratura"
              ? "IN_PAUSA"
              : "COMPLETATA",
      }));
      if (action === "start_timbratura" || action === "pause_timbratura" || action === "resume_timbratura") {
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
      console.error("Errore timbratura cronoprogramma", err);
    } finally {
      setTimbraturaLoadingKey((prev) => (prev === key ? null : prev));
    }
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,minmax(140px,1fr))",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <label>
          Da
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
            }}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          A
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
            }}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Cliente
          <select
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            <option value="TUTTI">Tutti</option>
            {clienti.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo evento
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            <option value="TUTTI">Tutti</option>
            <option value="INSTALLAZIONE">Installazioni</option>
            <option value="DISINSTALLAZIONE">Smontaggi noleggio</option>
            <option value="INTERVENTO">Interventi</option>
          </select>
        </label>
        <label>
          Cerca
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="cliente/progetto/ticket/descrizione"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", flex: 1 }}>
          <label style={{ minWidth: 220, flex: "1 1 240px" }}>
            Personale previsto
            <input
              value={personaleFilter}
              onChange={(e) => setPersonaleFilter(e.target.value)}
              placeholder="Nome o incarico"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[7, 15, 30].map((days) => {
              const active = quickRangeDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => applyQuickRange(days as 7 | 15 | 30)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: active ? "1px solid #111" : "1px solid #ddd",
                    background: active ? "#111" : "white",
                    color: active ? "white" : "#111",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {days} giorni
                </button>
              );
            })}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 38 }}>
            <input type="checkbox" checked={showFatto} onChange={(e) => setShowFatto(e.target.checked)} />
            Mostra righe fatte
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 38 }}>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Mostra righe nascoste
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <div style={{ fontSize: 13, opacity: 0.8, whiteSpace: "nowrap" }}>Risultati: {filteredSorted.length}</div>
        <button
          type="button"
          onClick={onExportCsv}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
          }}
        >
          ⬇ Export CSV
        </button>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, background: "white", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: "#fafafa",
            borderBottom: "1px solid #eee",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: "#475569" }}>
            Vista compatta: data, tipo attività, modalità, cliente/progetto, persone, stato
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => toggleSort("data_prevista")}
              style={{
                border: sortBy === "data_prevista" ? "1px solid #111" : "1px solid #d1d5db",
                background: "white",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Ordina per data prevista"
            >
              Data inizio {sortBy === "data_prevista" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("data_tassativa")}
              style={{
                border: sortBy === "data_tassativa" ? "1px solid #111" : "1px solid #d1d5db",
                background: "white",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Ordina per data tassativa"
            >
              Data fine {sortBy === "data_tassativa" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Caricamento...</div>
        ) : filteredSorted.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Nessun risultato</div>
        ) : (
          <div style={{ display: "grid", gap: 10, padding: 12 }}>
            {filteredSorted.map((r) => {
              const key = getRowKey(r.kind, r.row_ref_id);
              const meta = metaByKey[key];
              const operativi = operativiDraftByKey[key] || extractOperativi(meta);
              const schedule = getRowSchedule(r, meta);
              const fatto = Boolean(meta?.fatto ?? r.fatto);
              const overdueNotDone = isTimelineRowOverdueNotDone(r, meta);
              const hidden = Boolean(meta?.hidden);
              const operativoDefinito = hasDefinedOperativi(meta);
              const comments = commentsByKey[key] || [];
              const conflict = conflictByKey[key];
              const conflictTitle = buildConflictTooltip(
                conflict?.conflictDetails.personale || [],
                conflict?.conflictDetails.mezzi || []
              );
              const modeLabel = getActivityModeLabel(operativi);
              const kindLabel = getActivityKindLabel(r, operativi);
              const expanded = expandedRowKey === key;
              const timbraturaState = timbraturaStateByKey[key] || "NON_INIZIATA";
              const timbraturaLoading = timbraturaLoadingKey === key;
              const timeBudget = timeBudgetByKey[key] || { stimatoMinuti: null, realeMinuti: null };

              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: overdueNotDone ? "#fffaf5" : hidden ? "#fafafa" : "white",
                    boxShadow: operativoDefinito ? "0 0 0 1px #bbf7d0 inset" : "none",
                    opacity: hidden && showHidden ? 0.72 : 1,
                  }}
                  title={conflict?.hasConflict ? conflictTitle : undefined}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedRowKey((prev) => (prev === key ? null : key))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedRowKey((prev) => (prev === key ? null : key));
                      }
                    }}
                    style={{
                      padding: "12px 14px",
                      display: "grid",
                      gap: 10,
                      cursor: "pointer",
                      borderLeft: overdueNotDone ? "4px solid #f59e0b" : "4px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {renderActivityKindBadge(kindLabel)}
                          {renderModeBadge(modeLabel)}
                          {renderRowStatusBadge({ fatto, overdueNotDone, operativoDefinito, hidden })}
                          {conflict?.hasConflict
                            ? renderPill("CONFLITTO", { bg: "#fff1f2", border: "#fca5a5", color: "#b91c1c" }, "⚠")
                            : null}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
                          {r.progetto || "Attività cronoprogramma"}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "#475569" }}>
                          {r.kind === "INTERVENTO" ? (
                            <span>
                              Data intervento:{" "}
                              {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}
                            </span>
                          ) : null}
                          <span>Cliente: {r.cliente || "—"}</span>
                          <span>Persone: {operativi.personale_previsto || "—"}</span>
                          <span>Rif: {r.ticket_no || r.proforma || "—"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#475569" }}>
                          <span>Stimato: {formatMinutesCompact(timeBudget.stimatoMinuti)}</span>
                          <span>Reale: {formatMinutesCompact(timeBudget.realeMinuti)}</span>
                          {renderBudgetBadge(timeBudget.stimatoMinuti, timeBudget.realeMinuti)}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {timbraturaState === "IN_CORSO"
                            ? renderPill("IN CORSO", BADGE_COLORS.activityRemote, "⏸")
                            : null}
                          {timbraturaState === "IN_PAUSA"
                            ? renderPill("IN PAUSA", BADGE_COLORS.statusDueSoon, "⏸")
                            : null}
                          {timbraturaState === "COMPLETATA"
                            ? renderPill("COMPLETATA", BADGE_COLORS.statusOk, "✓")
                            : null}
                          {timbraturaState === "NON_INIZIATA" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTimbraturaAction(r, key, "start_timbratura");
                              }}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTimbraturaAction(r, key, "pause_timbratura");
                              }}
                              disabled={timbraturaLoading}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid #fcd34d",
                                background: "#fffbeb",
                                color: "#b45309",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: timbraturaLoading ? "wait" : "pointer",
                                opacity: timbraturaLoading ? 0.7 : 1,
                              }}
                            >
                              ⏸ Pausa
                            </button>
                          ) : null}
                          {timbraturaState === "IN_PAUSA" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTimbraturaAction(r, key, "resume_timbratura");
                              }}
                              disabled={timbraturaLoading}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid #93c5fd",
                                background: "#dbeafe",
                                color: "#1d4ed8",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: timbraturaLoading ? "wait" : "pointer",
                                opacity: timbraturaLoading ? 0.7 : 1,
                              }}
                            >
                              ▶ Riprendi
                            </button>
                          ) : null}
                          {timbraturaState === "IN_CORSO" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTimbraturaAction(r, key, "stop_timbratura");
                              }}
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
                      <div style={{ display: "grid", gap: 6, justifyItems: "end", textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {schedule.data_fine ? `Fine ${formatOperativiDateLabel(schedule.data_fine)}` : "Fine —"}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{schedule.durata_giorni} gg</div>
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        borderTop: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        padding: 14,
                        display: "grid",
                        gap: 14,
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Personale previsto / incarico</span>
                          <div
                            title={operativi.personale_previsto || undefined}
                            style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "white", padding: 8 }}
                          >
                            <PersonaleMultiSelect
                              personaleIds={operativi.personale_ids ?? []}
                              legacyValue={operativi.personale_previsto}
                              compact
                              onChange={({ personaleIds, personaleDisplay }) =>
                                setOperativiDraftByKey((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...(prev[key] || emptyOperativi),
                                    personale_ids: personaleIds,
                                    personale_previsto: personaleDisplay,
                                  },
                                }))
                              }
                            />
                            {conflict?.hasConflict ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setOpenConflictKey((prev) => (prev === key ? null : key))}
                                  style={{
                                    marginTop: 8,
                                    borderRadius: 999,
                                    border: "1px solid #fca5a5",
                                    background: "#fff1f2",
                                    color: "#b91c1c",
                                    padding: "4px 10px",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  ⚠ Conflitto
                                </button>
                                {openConflictKey === key ? (
                                  <div
                                    style={{
                                      marginTop: 8,
                                      border: "1px solid #fca5a5",
                                      background: "white",
                                      color: "#374151",
                                      borderRadius: 10,
                                      padding: "8px 10px",
                                      fontSize: 12,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {conflictTitle}
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                            <div style={{ marginTop: 8 }}>
                              <SafetyComplianceBadge
                                personaleIds={operativi.personale_ids}
                                personaleText={operativi.personale_previsto}
                                showSummary={false}
                                detailsOnClick
                              />
                            </div>
                          </div>
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Mezzi</span>
                          <textarea
                            value={operativi.mezzi ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), mezzi: e.target.value },
                              }))
                            }
                            placeholder="Mezzi"
                            style={{ width: "100%", minHeight: 64, padding: 8, resize: "vertical", borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Descrizione attività</span>
                          <textarea
                            value={operativi.descrizione_attivita ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), descrizione_attivita: e.target.value },
                              }))
                            }
                            placeholder="Descrizione attività"
                            style={{ width: "100%", minHeight: 64, padding: 8, resize: "vertical", borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Indirizzo</span>
                          <textarea
                            value={operativi.indirizzo ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), indirizzo: e.target.value },
                              }))
                            }
                            placeholder="Indirizzo"
                            style={{ width: "100%", minHeight: 64, padding: 8, resize: "vertical", borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Orario</span>
                          <input
                            value={operativi.orario ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), orario: e.target.value },
                              }))
                            }
                            placeholder="Orario"
                            style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                        </label>

                        <div style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Referente cliente</span>
                          <input
                            value={operativi.referente_cliente_nome ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), referente_cliente_nome: e.target.value },
                              }))
                            }
                            placeholder="Nome referente cliente"
                            style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                          <input
                            value={operativi.referente_cliente_contatto ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), referente_cliente_contatto: e.target.value },
                              }))
                            }
                            placeholder="Contatto referente cliente"
                            style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Commerciale Art Tech</span>
                          <input
                            value={operativi.commerciale_art_tech_nome ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || emptyOperativi), commerciale_art_tech_nome: e.target.value },
                              }))
                            }
                            placeholder="Nome commerciale Art Tech"
                            style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                          <input
                            value={operativi.commerciale_art_tech_contatto ?? ""}
                            onChange={(e) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]: {
                                  ...(prev[key] || emptyOperativi),
                                  commerciale_art_tech_contatto: e.target.value,
                                },
                              }))
                            }
                            placeholder="Contatto commerciale Art Tech"
                            style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Note</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input
                            value={noteDraftByKey[key] || ""}
                            onChange={(e) => setNoteDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="Aggiungi nota..."
                            style={{ flex: "1 1 260px", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                          <button
                            type="button"
                            onClick={() => addComment(r)}
                            disabled={savingCommentKey === key || stateLoading}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #111",
                              background: "#111",
                              color: "white",
                              cursor: "pointer",
                              opacity: savingCommentKey === key ? 0.7 : 1,
                            }}
                          >
                            Salva nota
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoteHistoryKey(key)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #d1d5db",
                              background: "white",
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                            title="Storico note"
                          >
                            Storico
                          </button>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.9 }}>
                          {comments[0] ? (
                            <div
                              style={{
                                background: "white",
                                border: "1px solid #eef2f7",
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div style={{ whiteSpace: "pre-wrap" }}>{comments[0].commento}</div>
                              <div style={{ opacity: 0.7, marginTop: 4 }}>
                                {(comments[0].created_by_nome || "Operatore") +
                                  " · " +
                                  (comments[0].created_at
                                    ? new Date(comments[0].created_at).toLocaleString("it-IT")
                                    : "—")}
                              </div>
                            </div>
                          ) : (
                            <span style={{ opacity: 0.7 }}>Nessuna nota</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={fatto}
                            onChange={(e) => setFatto(r, e.target.checked)}
                            disabled={savingFattoKey === key || stateLoading}
                          />
                          Fatto
                        </label>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={hidden}
                            onChange={(e) => setHidden(r, e.target.checked)}
                            disabled={savingHiddenKey === key || stateLoading}
                          />
                          Nascosta
                        </label>
                        <button
                          type="button"
                          onClick={() => saveOperativi(r)}
                          disabled={savingOperativiKey === key || stateLoading}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #111",
                            background: savingOperativiKey === key ? "#f3f4f6" : "#111",
                            color: savingOperativiKey === key ? "#111" : "white",
                            cursor: savingOperativiKey === key ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {savingOperativiKey === key ? "..." : "Salva"}
                        </button>
                        {r.checklist_id ? (
                          <Link
                            href={`/checklists/${r.checklist_id}`}
                            style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                          >
                            Apri progetto
                          </Link>
                        ) : null}
                        {meta?.updated_at ? (
                          <div style={{ fontSize: 11, opacity: 0.75 }}>
                            {meta.updated_by_nome || "Operatore"} · {new Date(meta.updated_at).toLocaleString("it-IT")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {noteHistoryKey && (
        <div
          onClick={() => setNoteHistoryKey(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "white",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 14,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
            >
              <div style={{ fontWeight: 800 }}>Storico note</div>
              <button
                type="button"
                onClick={() => setNoteHistoryKey(null)}
                style={{
                  border: "1px solid #ddd",
                  background: "white",
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                Chiudi
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
              {rowByKey[noteHistoryKey]?.progetto || "Riga"}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {(commentsByKey[noteHistoryKey] || []).length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nessuna nota presente</div>
              ) : (
                (commentsByKey[noteHistoryKey] || []).map((c) => {
                  const row = rowByKey[noteHistoryKey];
                  return (
                    <div
                      key={c.id}
                      style={{ border: "1px solid #eef2f7", borderRadius: 8, padding: "8px 10px", background: "#f9fafb" }}
                    >
                      <div style={{ whiteSpace: "pre-wrap" }}>{c.commento}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                        {(c.created_by_nome || "Operatore") +
                          " · " +
                          (c.created_at ? new Date(c.created_at).toLocaleString("it-IT") : "—")}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => row && deleteComment(row, c.id)}
                          disabled={deletingCommentId === c.id || !row}
                          style={{
                            border: "1px solid #ef4444",
                            background: "white",
                            color: "#b91c1c",
                            borderRadius: 8,
                            padding: "4px 8px",
                            cursor: row ? "pointer" : "not-allowed",
                            opacity: deletingCommentId === c.id ? 0.7 : 1,
                          }}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
