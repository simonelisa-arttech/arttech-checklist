"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Dispatch, MutableRefObject, SetStateAction, UIEvent } from "react";
import OperationalBlockEditor, {
  type OperationalBlockFormState,
  type OperationalBlockPlanningStatusOption,
} from "@/components/cronoprogramma/OperationalBlockEditor";
import { isTimelineRowOverdueNotDone } from "@/lib/cronoprogrammaStatus";
import { formatOperativiDateLabel } from "@/lib/operativiSchedule";

type TimelineRow = any;
type CronoMeta = any;
type CronoComment = any;
type OperativiFields = any;
type TimeBudgetSummary = {
  stimatoMinuti: number | null;
  realeMinuti: number | null;
  liveStartedAt?: string[];
};
type OperatorTimeEntry = {
  operatore_id: string | null;
  nome_operatore: string;
  stato: "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA";
  durata_totale_minuti: number;
  live_started_at?: string[];
  slot_id?: string | null;
  row_kind: string;
  row_ref_id: string;
};

type OperativiDraft = OperationalBlockFormState;

const REPORT_COMMENT_PREFIX = "__REPORT__:";

type StructuredReport = {
  esito: "COMPLETATO" | "PARZIALE" | "NON_COMPLETATO";
  problemi: string;
  materiali: string;
  note_finali: string;
};

type OutcomeFilter = "TUTTI" | "COMPLETATO" | "PARZIALE" | "NON_COMPLETATO";
type PlanningStatus =
  | "BOZZA"
  | "DA_CONFERMARE"
  | "CONFERMATA"
  | "RIMANDATA"
  | "SVOLTA"
  | "ANNULLATA";
type VisualPlanningStatus = PlanningStatus | "NASCOSTA";
type PlanningStatusFilter =
  | "TUTTE"
  | "BOZZA"
  | "DA_CONFERMARE"
  | "CONFERMATA"
  | "RIMANDATA"
  | "SVOLTA";

const BADGE_COLORS = {
  statusExpired: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
  statusDueSoon: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  statusOk: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  statusNeutral: { bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
  activityInstall: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  activityIntervento: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  activityRemote: { bg: "#f3e8ff", border: "#d8b4fe", color: "#7e22ce" },
  activityDisinstall: { bg: "#ffedd5", border: "#fdba74", color: "#c2410c" },
  planningDraft: { bg: "#f3f4f6", border: "#d1d5db", color: "#4b5563" },
  planningPending: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  planningConfirmed: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  planningRescheduled: { bg: "#ffedd5", border: "#fdba74", color: "#c2410c" },
  planningDone: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  planningCancelled: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
  planningHidden: { bg: "#f8fafc", border: "#cbd5e1", color: "#475569" },
} as const;

const VISUAL_PLANNING_STATUS_VALUES = new Set([
  "BOZZA",
  "DA_CONFERMARE",
  "CONFERMATA",
  "RIMANDATA",
  "SVOLTA",
  "ANNULLATA",
  "NASCOSTA",
]);
const EDITABLE_PLANNING_STATUSES: PlanningStatus[] = [
  "BOZZA",
  "DA_CONFERMARE",
  "CONFERMATA",
  "RIMANDATA",
  "SVOLTA",
  "ANNULLATA",
];
const MANUAL_PLANNING_STATUSES: PlanningStatus[] = [
  "BOZZA",
  "DA_CONFERMARE",
  "CONFERMATA",
  "RIMANDATA",
  "ANNULLATA",
];

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
  statusFilter?: PlanningStatusFilter;
  setStatusFilter?: Dispatch<SetStateAction<PlanningStatusFilter>>;
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
  savingStatusKey?: string | null;
  savingCommentKey: string | null;
  savingOperativiKey: string | null;
  savingRescheduleKey?: string | null;
  deletingCommentId: string | null;
  noteHistoryKey: string | null;
  setNoteHistoryKey: Dispatch<SetStateAction<string | null>>;
  operativiDraftByKey: Record<string, any>;
  setOperativiDraftByKey: Dispatch<SetStateAction<Record<string, any>>>;
  conflictByKey: Record<string, any>;
  rowByKey: Record<string, TimelineRow>;
  setFatto: (row: TimelineRow, fatto: boolean) => void;
  setStatus?: (row: TimelineRow, status: PlanningStatus) => void;
  openRescheduleModal?: (row: TimelineRow) => void;
  setHidden: (row: TimelineRow, hidden: boolean) => void;
  addComment: (row: TimelineRow) => void;
  saveOperativi: (row: TimelineRow) => void;
  deleteComment: (row: TimelineRow, commentId: string) => void;
  getRowKey: (
    kind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO",
    rowRefId: string,
    slotId?: string | null
  ) => string;
  getRowSchedule: (row: TimelineRow, value?: any) => {
    data_inizio: string;
    data_fine: string;
    durata_giorni: number;
  };
  extractOperativi: (meta?: CronoMeta | null) => OperativiFields;
  extractOperationalBlockForm?: (row: TimelineRow, meta?: CronoMeta | null) => OperativiDraft;
  buildConflictTooltip: (personale: string[], mezzi: string[]) => string;
  hasDefinedOperativi: (meta?: CronoMeta | null) => boolean;
  emptyOperativi?: any;
  emptyOperationalBlockForm?: OperativiDraft;
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

function ensureOperationalBlockForm(
  operativi: OperativiFields | null | undefined,
  emptyDraft?: OperativiDraft
): OperativiDraft {
  return {
    ...(emptyDraft || {
      slots: [{ data_inizio: "", durata_prevista_minuti: null, orario: "" }],
      data_inizio: "",
      durata_giorni: "",
      personale_previsto: "",
      personale_ids: [],
      mezzi: "",
      descrizione_attivita: "",
      indirizzo: "",
      orario: "",
      referenti_cliente: [{ nome: "", contatto: "", ruolo: "" }],
      referente_cliente_nome: "",
      referente_cliente_contatto: "",
      commerciale_art_tech_nome: "",
      commerciale_art_tech_contatto: "",
    }),
    ...operativi,
  };
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

function normalizeVisualPlanningStatus(value: unknown): VisualPlanningStatus {
  const status = String(value || "").trim().toUpperCase();
  return VISUAL_PLANNING_STATUS_VALUES.has(status)
    ? (status as VisualPlanningStatus)
    : "DA_CONFERMARE";
}

function getVisualPlanningStatus(meta?: CronoMeta | null): VisualPlanningStatus {
  return normalizeVisualPlanningStatus(meta?.status_visual);
}

function getEditablePlanningStatus(meta?: CronoMeta | null): PlanningStatus {
  const stored = String(meta?.status || "").trim().toUpperCase();
  if (EDITABLE_PLANNING_STATUSES.includes(stored as PlanningStatus)) {
    return stored as PlanningStatus;
  }
  const visual = getVisualPlanningStatus(meta);
  return visual === "NASCOSTA" ? "DA_CONFERMARE" : (visual as PlanningStatus);
}

function renderPlanningStatusBadge(status: VisualPlanningStatus) {
  if (status === "BOZZA") return renderPill("BOZZA", BADGE_COLORS.planningDraft);
  if (status === "DA_CONFERMARE") return renderPill("DA CONFERMARE", BADGE_COLORS.planningPending);
  if (status === "CONFERMATA") return renderPill("CONFERMATA", BADGE_COLORS.planningConfirmed);
  if (status === "RIMANDATA") return renderPill("RIMANDATA", BADGE_COLORS.planningRescheduled);
  if (status === "SVOLTA") return renderPill("SVOLTA", BADGE_COLORS.planningDone);
  if (status === "ANNULLATA") return renderPill("ANNULLATA", BADGE_COLORS.planningCancelled);
  return null;
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

function renderOperatorTimbraturaStateBadge(
  state: "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA"
) {
  if (state === "IN_CORSO") return renderPill("IN CORSO", BADGE_COLORS.planningConfirmed, "⏱");
  if (state === "IN_PAUSA") return renderPill("IN PAUSA", BADGE_COLORS.planningPending, "⏸");
  if (state === "COMPLETATA") return renderPill("COMPLETATA", BADGE_COLORS.planningDone, "✓");
  return renderPill("NON INIZIATA", BADGE_COLORS.statusNeutral);
}

function getLiveElapsedMs(startedAtList: string[] | undefined, nowMs: number) {
  return (startedAtList || []).reduce((sum, value) => {
    const parsed = new Date(String(value || "")).getTime();
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > nowMs) return sum;
    return sum + Math.max(0, nowMs - parsed);
  }, 0);
}

function getDisplayedActualMinutes(summary: TimeBudgetSummary, nowMs: number) {
  const baseMinutes =
    Number.isFinite(Number(summary.realeMinuti)) && summary.realeMinuti != null
      ? Number(summary.realeMinuti)
      : 0;
  const liveMinutes = Math.round(getLiveElapsedMs(summary.liveStartedAt, nowMs) / 60000);
  return baseMinutes + liveMinutes;
}

function getSlotEstimatedMinutes(row: TimelineRow | null | undefined) {
  return row &&
    Number.isFinite(Number(row.slot_hours)) &&
    row.slot_hours != null &&
    Number(row.slot_hours) >= 0
    ? Math.round(Number(row.slot_hours) * 60)
    : null;
}

function formatLiveElapsed(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function parseStructuredReport(comment: CronoComment | null | undefined): StructuredReport | null {
  const raw = String(comment?.commento || "");
  if (!raw.startsWith(REPORT_COMMENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(REPORT_COMMENT_PREFIX.length));
    const esito = String(parsed?.esito || "").trim().toUpperCase();
    if (esito !== "COMPLETATO" && esito !== "PARZIALE" && esito !== "NON_COMPLETATO") return null;
    return {
      esito,
      problemi: String(parsed?.problemi || "").trim(),
      materiali: String(parsed?.materiali || "").trim(),
      note_finali: String(parsed?.note_finali || "").trim(),
    };
  } catch {
    return null;
  }
}

function renderStructuredReportBlock(comment: CronoComment, report: StructuredReport) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {renderPill(`ESITO ${report.esito.replaceAll("_", " ")}`, report.esito === "COMPLETATO"
          ? BADGE_COLORS.statusOk
          : report.esito === "PARZIALE"
            ? BADGE_COLORS.statusDueSoon
            : BADGE_COLORS.statusExpired)}
        {renderPill("REPORT ATTIVITÀ", BADGE_COLORS.statusNeutral)}
      </div>
      {report.problemi ? <div><strong>Problemi:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{report.problemi}</span></div> : null}
      {report.materiali ? <div><strong>Materiali:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{report.materiali}</span></div> : null}
      {report.note_finali ? <div><strong>Note finali:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{report.note_finali}</span></div> : null}
      <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
        {(comment.created_by_nome || "Operatore") +
          " · " +
          (comment.created_at ? new Date(comment.created_at).toLocaleString("it-IT") : "—")}
      </div>
    </div>
  );
}

function getBudgetDeltaSummary(stimatoMinuti: number | null, realeMinuti: number | null) {
  if (!Number.isFinite(Number(stimatoMinuti)) || stimatoMinuti == null) return null;
  const actual =
    Number.isFinite(Number(realeMinuti)) && realeMinuti != null ? Math.round(Number(realeMinuti)) : 0;
  if (actual <= 0) return null;
  const estimated = Math.round(Number(stimatoMinuti));
  const deltaMinuti = actual - estimated;
  const absoluteDelta = Math.abs(deltaMinuti);

  if (absoluteDelta <= 15) {
    return {
      badge: renderPill("IN LINEA", BADGE_COLORS.statusOk, "🟢"),
      deltaLabel: "In linea",
    };
  }

  if (deltaMinuti < 0) {
    return {
      badge: renderPill("RISPARMIO", BADGE_COLORS.statusOk, "🟢"),
      deltaLabel: `Risparmio: ${formatMinutesCompact(absoluteDelta)}`,
    };
  }

  if (estimated > 0 && deltaMinuti <= estimated * 0.25) {
    return {
      badge: renderPill("FUORI STIMA", BADGE_COLORS.statusDueSoon, "🟠"),
      deltaLabel: `Ritardo: ${formatMinutesCompact(deltaMinuti)}`,
    };
  }

  return {
    badge: renderPill("FORTE RITARDO", BADGE_COLORS.statusExpired, "🔴"),
    deltaLabel: `Ritardo: ${formatMinutesCompact(deltaMinuti)}`,
  };
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
  statusFilter = "TUTTE",
  setStatusFilter = () => undefined,
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
  savingStatusKey = null,
  savingCommentKey,
  savingOperativiKey,
  savingRescheduleKey,
  deletingCommentId,
  noteHistoryKey,
  setNoteHistoryKey,
  operativiDraftByKey,
  setOperativiDraftByKey,
  conflictByKey,
  rowByKey,
  setFatto,
  setStatus = () => undefined,
  openRescheduleModal,
  setHidden,
  addComment,
  saveOperativi,
  deleteComment,
  getRowKey,
  getRowSchedule,
  extractOperativi,
  extractOperationalBlockForm,
  buildConflictTooltip,
  hasDefinedOperativi,
  emptyOperativi,
  emptyOperationalBlockForm,
}: CronoprogrammaPanelProps) {
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [timbraturaStateByKey, setTimbraturaStateByKey] = useState<
    Record<string, "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA">
  >({});
  const [timbraturaLoadingKey, setTimbraturaLoadingKey] = useState<string | null>(null);
  const [timeBudgetByKey, setTimeBudgetByKey] = useState<Record<string, TimeBudgetSummary>>({});
  const [operatorTimeEntriesByKey, setOperatorTimeEntriesByKey] = useState<
    Record<string, OperatorTimeEntry[]>
  >({});
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("TUTTI");
  const [manualActualOpenKey, setManualActualOpenKey] = useState<string | null>(null);
  const [manualActualHoursByKey, setManualActualHoursByKey] = useState<Record<string, string>>({});
  const [manualActualSavingKey, setManualActualSavingKey] = useState<string | null>(null);
  const planningStatusOptions: OperationalBlockPlanningStatusOption[] = useMemo(
    () =>
      MANUAL_PLANNING_STATUSES.map((status) => ({
        value: status,
        label: status === "DA_CONFERMARE" ? "DA CONFERMARE" : status,
      })),
    []
  );

  useEffect(() => {
    let active = true;
    if (filteredSorted.length === 0) {
      setTimeBudgetByKey({});
      setOperatorTimeEntriesByKey({});
      setTimbraturaStateByKey({});
      return;
    }

    const rows = filteredSorted.map((row) => ({
      row_kind: String(row.kind || "").trim().toUpperCase(),
      row_ref_id: String(row.row_ref_id || "").trim(),
      slot_id: String(row.slot_id || "").trim() || null,
      slot_hours:
        Number.isFinite(Number(row.slot_hours)) && row.slot_hours != null && Number(row.slot_hours) >= 0
          ? Number(row.slot_hours)
          : null,
    }));

    void (async () => {
      const next: Record<string, TimeBudgetSummary> = {};
      const nextOperatorEntries: Record<string, OperatorTimeEntry[]> = {};
      const nextTimbraturaState: Record<string, "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA"> = {};
      for (const row of rows) {
        const key = row.slot_id
          ? `${row.row_kind}:${row.row_ref_id}:${row.slot_id}`
          : `${row.row_kind}:${row.row_ref_id}`;
        next[key] = { stimatoMinuti: null, realeMinuti: null, liveStartedAt: [] };
        nextOperatorEntries[key] = [];
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
          setOperatorTimeEntriesByKey(nextOperatorEntries);
          setTimbraturaStateByKey(nextTimbraturaState);
          return;
        }

        const serverBudget = data?.time_budget && typeof data.time_budget === "object" ? data.time_budget : {};
        const serverOperatorEntries =
          data?.operator_time_entries && typeof data.operator_time_entries === "object"
            ? data.operator_time_entries
            : {};
        for (const [key, value] of Object.entries(serverBudget)) {
          if (!next[key]) continue;
          const summary = value as Record<string, unknown>;
          const row = rowByKey[key] || null;
          const slotEstimatedMinutes = getSlotEstimatedMinutes(row);
          next[key] = {
            stimatoMinuti: slotEstimatedMinutes != null
              ? slotEstimatedMinutes
              : Number.isFinite(Number(summary?.stimatoMinuti)) && Number(summary?.stimatoMinuti) >= 0
                ? Number(summary?.stimatoMinuti)
                : null,
            realeMinuti:
              Number.isFinite(Number(summary?.realeMinuti)) && Number(summary?.realeMinuti) >= 0
                ? Number(summary?.realeMinuti)
                : null,
            liveStartedAt: Array.isArray(summary?.liveStartedAt)
              ? summary.liveStartedAt.map((value) => String(value || "").trim()).filter(Boolean)
              : [],
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
        for (const [key, value] of Object.entries(serverOperatorEntries)) {
          if (!nextOperatorEntries[key]) continue;
          nextOperatorEntries[key] = Array.isArray(value)
            ? value.map((entry) => {
                const row = entry as Record<string, unknown>;
                return {
                  operatore_id: String(row?.operatore_id || "").trim() || null,
                  nome_operatore: String(row?.nome_operatore || "Operatore"),
                  stato:
                    String(row?.stato || "").trim().toUpperCase() === "IN_CORSO"
                      ? "IN_CORSO"
                      : String(row?.stato || "").trim().toUpperCase() === "IN_PAUSA"
                        ? "IN_PAUSA"
                        : String(row?.stato || "").trim().toUpperCase() === "COMPLETATA"
                          ? "COMPLETATA"
                          : "NON_INIZIATA",
                  durata_totale_minuti:
                    Number.isFinite(Number(row?.durata_totale_minuti)) &&
                    Number(row?.durata_totale_minuti) >= 0
                      ? Number(row?.durata_totale_minuti)
                      : 0,
                  live_started_at: Array.isArray(row?.live_started_at)
                    ? row.live_started_at.map((item) => String(item || "").trim()).filter(Boolean)
                    : [],
                  slot_id: String(row?.slot_id || "").trim() || null,
                  row_kind: String(row?.row_kind || ""),
                  row_ref_id: String(row?.row_ref_id || ""),
                } satisfies OperatorTimeEntry;
              })
            : [];
        }
      } catch (error) {
        if (!active) return;
        console.error("Errore caricamento riepilogo cronoprogramma", error);
      }

      setTimeBudgetByKey(next);
      setOperatorTimeEntriesByKey(nextOperatorEntries);
      setTimbraturaStateByKey(nextTimbraturaState);
    })();

    return () => {
      active = false;
    };
  }, [filteredSorted]);

  async function refreshOperatorTimeDetails(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id, row.slot_id);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "load",
          rows: [
            {
              row_kind: row.kind,
              row_ref_id: row.row_ref_id,
              slot_id: row.slot_id ?? null,
              slot_hours:
                Number.isFinite(Number(row.slot_hours)) && row.slot_hours != null
                  ? Number(row.slot_hours)
                  : null,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Errore refresh dettaglio timbrature operatori", data);
        return;
      }

      const summary =
        data?.time_budget && typeof data.time_budget === "object"
          ? (data.time_budget as Record<string, Record<string, unknown>>)[key]
          : null;
      if (summary) {
        const sourceRow = rowByKey[key] || row;
        const slotEstimatedMinutes = getSlotEstimatedMinutes(sourceRow);
        setTimeBudgetByKey((prev) => ({
          ...prev,
          [key]: {
            stimatoMinuti:
              slotEstimatedMinutes != null
                ? slotEstimatedMinutes
                : Number.isFinite(Number(summary?.stimatoMinuti)) &&
                    Number(summary?.stimatoMinuti) >= 0
                  ? Number(summary?.stimatoMinuti)
                  : null,
            realeMinuti:
              Number.isFinite(Number(summary?.realeMinuti)) && Number(summary?.realeMinuti) >= 0
                ? Number(summary?.realeMinuti)
                : null,
            liveStartedAt: Array.isArray(summary?.liveStartedAt)
              ? summary.liveStartedAt.map((value) => String(value || "").trim()).filter(Boolean)
              : [],
          },
        }));
        const stato = String(summary?.stato || "").trim().toUpperCase();
        setTimbraturaStateByKey((prev) => ({
          ...prev,
          [key]:
            stato === "IN_CORSO"
              ? "IN_CORSO"
              : stato === "IN_PAUSA"
                ? "IN_PAUSA"
                : stato === "COMPLETATA"
                  ? "COMPLETATA"
                  : "NON_INIZIATA",
        }));
      }

      const entries =
        data?.operator_time_entries && typeof data.operator_time_entries === "object"
          ? (data.operator_time_entries as Record<string, unknown[]>)[key]
          : [];
      setOperatorTimeEntriesByKey((prev) => ({
        ...prev,
        [key]: Array.isArray(entries)
          ? entries.map((entry) => {
              const operatorRow = entry as Record<string, unknown>;
              return {
                operatore_id: String(operatorRow?.operatore_id || "").trim() || null,
                nome_operatore: String(operatorRow?.nome_operatore || "Operatore"),
                stato:
                  String(operatorRow?.stato || "").trim().toUpperCase() === "IN_CORSO"
                    ? "IN_CORSO"
                    : String(operatorRow?.stato || "").trim().toUpperCase() === "IN_PAUSA"
                      ? "IN_PAUSA"
                      : String(operatorRow?.stato || "").trim().toUpperCase() === "COMPLETATA"
                        ? "COMPLETATA"
                        : "NON_INIZIATA",
                durata_totale_minuti:
                  Number.isFinite(Number(operatorRow?.durata_totale_minuti)) &&
                  Number(operatorRow?.durata_totale_minuti) >= 0
                    ? Number(operatorRow?.durata_totale_minuti)
                    : 0,
                live_started_at: Array.isArray(operatorRow?.live_started_at)
                  ? operatorRow.live_started_at
                      .map((item) => String(item || "").trim())
                      .filter(Boolean)
                  : [],
                slot_id: String(operatorRow?.slot_id || "").trim() || null,
                row_kind: String(operatorRow?.row_kind || ""),
                row_ref_id: String(operatorRow?.row_ref_id || ""),
              } satisfies OperatorTimeEntry;
            })
          : [],
      }));
    } catch (error) {
      console.error("Errore refresh dettaglio timbrature operatori", error);
    }
  }

  useEffect(() => {
    const hasLive = Object.values(timbraturaStateByKey).some((state) => state === "IN_CORSO");
    if (!hasLive) return;
    const timer = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timbraturaStateByKey]);

  const outcomeFilteredRows = useMemo(() => {
    if (outcomeFilter === "TUTTI") return filteredSorted;
    return filteredSorted.filter((row) => {
      const key = getRowKey(
        String(row.kind || "").trim().toUpperCase() as any,
        String(row.row_ref_id || "").trim(),
        String(row.slot_id || "").trim() || null
      );
      const comments = commentsByKey[key] || [];
      const latestReport = comments.find((comment) => Boolean(parseStructuredReport(comment)));
      const report = latestReport ? parseStructuredReport(latestReport) : null;
      return report?.esito === outcomeFilter;
    });
  }, [commentsByKey, filteredSorted, getRowKey, outcomeFilter]);

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
          slot_id: row.slot_id ?? null,
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
              : String(data?.activity_state || "").trim().toUpperCase() === "NON_INIZIATA"
                ? "NON_INIZIATA"
                : "COMPLETATA",
      }));
      if (action === "start_timbratura" || action === "pause_timbratura" || action === "resume_timbratura") {
        setTimeBudgetByKey((prev) => {
          const current = prev[key] || { stimatoMinuti: null, realeMinuti: 0, liveStartedAt: [] };
          const nowMs = Date.now();
          const currentLiveMs = getLiveElapsedMs(current.liveStartedAt, nowMs);
          const currentClosedMinutes =
            Number.isFinite(Number(current.realeMinuti)) && current.realeMinuti != null ? Number(current.realeMinuti) : 0;
          return {
            ...prev,
            [key]: {
              stimatoMinuti: current.stimatoMinuti ?? null,
              realeMinuti:
                action === "pause_timbratura"
                  ? currentClosedMinutes + Math.round(currentLiveMs / 60000)
                  : currentClosedMinutes,
              liveStartedAt:
                action === "pause_timbratura"
                  ? []
                  : [
                      ...(action === "resume_timbratura" || action === "start_timbratura"
                        ? [new Date(nowMs).toISOString()]
                        : current.liveStartedAt || []),
                    ],
            },
          };
        });
      } else {
        setTimeBudgetByKey((prev) => {
          const current = prev[key] || { stimatoMinuti: null, realeMinuti: 0, liveStartedAt: [] };
          const nowMs = Date.now();
          return {
            ...prev,
            [key]: {
              stimatoMinuti: current.stimatoMinuti ?? null,
              realeMinuti: getDisplayedActualMinutes(current, nowMs),
              liveStartedAt: [],
            },
          };
        });
      }
      await refreshOperatorTimeDetails(row);
    } catch (err) {
      console.error("Errore timbratura cronoprogramma", err);
    } finally {
      setTimbraturaLoadingKey((prev) => (prev === key ? null : prev));
    }
  }

  async function handleSaveManualActual(row: TimelineRow, key: string) {
    try {
      const rawValue = String(manualActualHoursByKey[key] || "").trim().replace(",", ".");
      const parsedHours = Number(rawValue);
      if (!Number.isFinite(parsedHours) || parsedHours <= 0) return;
      const minutes = Math.round(parsedHours * 60);
      if (minutes <= 0) return;

      setManualActualSavingKey(key);
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "set_tempo_reale",
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
          slot_id: row.slot_id ?? null,
          durata_effettiva_minuti: minutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Errore salvataggio tempo reale cronoprogramma", data);
        window.alert(String(data?.error || "Errore salvataggio tempo reale"));
        return;
      }

      setTimeBudgetByKey((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || { stimatoMinuti: null, realeMinuti: null, liveStartedAt: [] }),
          realeMinuti:
            Number.isFinite(Number(data?.durata_effettiva_minuti)) && Number(data?.durata_effettiva_minuti) > 0
              ? Number(data.durata_effettiva_minuti)
              : minutes,
          liveStartedAt: [],
        },
      }));
      setTimbraturaStateByKey((prev) => ({
        ...prev,
        [key]:
          String(data?.activity_state || "").trim().toUpperCase() === "COMPLETATA"
            ? "COMPLETATA"
            : prev[key] || "NON_INIZIATA",
      }));
      await refreshOperatorTimeDetails(row);
      setManualActualOpenKey((prev) => (prev === key ? null : prev));
      setManualActualHoursByKey((prev) => ({
        ...prev,
        [key]: rawValue,
      }));
    } catch (err) {
      console.error("Errore salvataggio tempo reale cronoprogramma", err);
      window.alert("Errore salvataggio tempo reale");
    } finally {
      setManualActualSavingKey((prev) => (prev === key ? null : prev));
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
          <label style={{ minWidth: 190 }}>
            Stato operativo
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PlanningStatusFilter)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="TUTTE">Tutte</option>
              <option value="BOZZA">Bozze</option>
              <option value="DA_CONFERMARE">Da confermare</option>
              <option value="CONFERMATA">Confermate</option>
              <option value="RIMANDATA">Rimandate</option>
              <option value="SVOLTA">Svolte</option>
            </select>
          </label>
          <label style={{ minWidth: 180 }}>
            Esito finale
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            >
              <option value="TUTTI">Tutti</option>
              <option value="COMPLETATO">Completato</option>
              <option value="PARZIALE">Parziale</option>
              <option value="NON_COMPLETATO">Non completato</option>
            </select>
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
          <div style={{ fontSize: 13, opacity: 0.8, whiteSpace: "nowrap" }}>Risultati: {outcomeFilteredRows.length}</div>
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
        ) : outcomeFilteredRows.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Nessun risultato</div>
        ) : (
          <div style={{ display: "grid", gap: 10, padding: 12 }}>
            {outcomeFilteredRows.map((r: TimelineRow) => {
              const key = getRowKey(r.kind, r.row_ref_id, r.slot_id);
              const meta = metaByKey[key];
              const operativi =
                operativiDraftByKey[key] ||
                (extractOperationalBlockForm
                  ? extractOperationalBlockForm(r, meta)
                  : ensureOperationalBlockForm(extractOperativi(meta), emptyOperationalBlockForm));
              const schedule = getRowSchedule(r, meta);
              const fatto = Boolean(meta?.fatto ?? r.fatto);
              const overdueNotDone = isTimelineRowOverdueNotDone(r, meta);
              const hidden = Boolean(meta?.hidden);
              const visualPlanningStatus = getVisualPlanningStatus(meta);
              const editablePlanningStatus = getEditablePlanningStatus(meta);
              const operativoDefinito = hasDefinedOperativi(meta);
              const comments = commentsByKey[key] || [];
              const latestReportComment = comments.find((comment) => Boolean(parseStructuredReport(comment))) || null;
              const latestReport = latestReportComment ? parseStructuredReport(latestReportComment) : null;
              const noteDraft = String(noteDraftByKey[key] || "");
              const canSaveNote = noteDraft.trim().length > 0 && savingCommentKey !== key && !stateLoading;
              const conflict = conflictByKey[key];
              const conflictTitle = buildConflictTooltip(
                conflict?.conflictDetails.personale || [],
                conflict?.conflictDetails.mezzi || []
              );
              const modeLabel = getActivityModeLabel(operativi);
              const kindLabel = getActivityKindLabel(r, operativi);
              const expanded = expandedRowKey === key;
              const usesSharedOperationalEditor =
                r.kind === "INSTALLAZIONE" || r.kind === "DISINSTALLAZIONE";
              const timbraturaState = timbraturaStateByKey[key] || "NON_INIZIATA";
              const timbraturaLoading = timbraturaLoadingKey === key;
              const timeBudget = timeBudgetByKey[key] || { stimatoMinuti: null, realeMinuti: null };
              const operatorTimeEntries = operatorTimeEntriesByKey[key] || [];
              const displayedActualMinutes = getDisplayedActualMinutes(timeBudget, liveNowMs);
              const liveElapsedMs = getLiveElapsedMs(timeBudget.liveStartedAt, liveNowMs);
              const budgetDelta = getBudgetDeltaSummary(timeBudget.stimatoMinuti, displayedActualMinutes);
              const hasRealMinutes = displayedActualMinutes > 0;
              const manualActualOpen = manualActualOpenKey === key;
              const manualActualSaving = manualActualSavingKey === key;
              const manualActualValue = manualActualHoursByKey[key] ?? "";

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
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8, flex: "1 1 420px", minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {renderActivityKindBadge(kindLabel)}
                          {renderModeBadge(modeLabel)}
                          {renderPlanningStatusBadge(visualPlanningStatus)}
                          {renderRowStatusBadge({ fatto, overdueNotDone, operativoDefinito, hidden })}
                          {conflict?.hasConflict
                            ? renderPill("CONFLITTO", { bg: "#fff1f2", border: "#fca5a5", color: "#b91c1c" }, "⚠")
                            : null}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", wordBreak: "break-word" }}>
                            {r.progetto || "Attività cronoprogramma"}
                          </div>
                          {r.checklist_id ? (
                            <Link
                              href={`/checklists/${r.checklist_id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#2563eb",
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Apri progetto →
                            </Link>
                          ) : null}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            fontSize: 13,
                            color: "#475569",
                            minWidth: 0,
                          }}
                        >
                          <span>Cliente: {r.cliente || "—"}</span>
                          <span>Rif: {r.ticket_no || r.proforma || "—"}</span>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            minWidth: 0,
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>Persone:</strong> {operativi.personale_previsto || "—"}
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
                          {timbraturaState === "IN_CORSO"
                            ? renderPill(`LIVE ${formatLiveElapsed(liveElapsedMs)}`, BADGE_COLORS.activityRemote, "⏱")
                            : null}
                          {timbraturaState === "IN_PAUSA"
                            ? renderPill(`Accumulato ${formatMinutesCompact(displayedActualMinutes)}`, BADGE_COLORS.statusDueSoon, "⏱")
                            : null}
                          {latestReport
                            ? renderPill(
                                `Esito ${latestReport.esito.replaceAll("_", " ")}`,
                                latestReport.esito === "COMPLETATO"
                                  ? BADGE_COLORS.statusOk
                                  : latestReport.esito === "PARZIALE"
                                    ? BADGE_COLORS.statusDueSoon
                                    : BADGE_COLORS.statusExpired
                              )
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
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          flex: "0 1 280px",
                          minWidth: 220,
                          marginLeft: "auto",
                          justifyItems: "end",
                          alignContent: "start",
                          textAlign: "right",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4, fontSize: 13, color: "#475569", justifyItems: "end" }}>
                          {r.kind === "INTERVENTO" ? (
                            <span>
                              Data intervento:{" "}
                              {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}
                            </span>
                          ) : (
                            <span>
                              Slot: {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}
                              {timeBudget.stimatoMinuti != null ? ` · ${formatMinutesCompact(timeBudget.stimatoMinuti)}` : ""}
                              {r.slot_id
                                ? r.slot_orario
                                  ? ` · ${r.slot_orario}`
                                  : operativi.orario
                                    ? ` · ${operativi.orario}`
                                    : ""
                                : operativi.orario
                                  ? ` · ${operativi.orario}`
                                  : r.slot_orario
                                    ? ` · ${r.slot_orario}`
                                    : ""}
                            </span>
                          )}
                          <span>{schedule.data_fine ? `Fine ${formatOperativiDateLabel(schedule.data_fine)}` : "Fine —"}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            fontSize: 12,
                            color: "#475569",
                          }}
                        >
                          <span>Stimato: {formatMinutesCompact(timeBudget.stimatoMinuti)}</span>
                          {hasRealMinutes ? <span>Reale: {formatMinutesCompact(displayedActualMinutes)}</span> : <span>Reale: —</span>}
                          {hasRealMinutes ? <span>Delta: {budgetDelta?.deltaLabel || "—"}</span> : <span>Delta: —</span>}
                          {hasRealMinutes ? budgetDelta?.badge || null : null}
                        </div>
                        {!hasRealMinutes ? (
                          manualActualOpen ? (
                            <span
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "inline-flex",
                                gap: 8,
                                alignItems: "center",
                                justifyContent: "flex-end",
                                flexWrap: "wrap",
                              }}
                            >
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                value={manualActualValue}
                                onChange={(e) =>
                                  setManualActualHoursByKey((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                placeholder="Ore"
                                style={{
                                  width: 88,
                                  padding: "6px 8px",
                                  borderRadius: 10,
                                  border: "1px solid #d1d5db",
                                  background: "white",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveManualActual(r, key)}
                                disabled={manualActualSaving || !String(manualActualValue).trim()}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  border: "1px solid #93c5fd",
                                  background: "#dbeafe",
                                  color: "#1d4ed8",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor:
                                    manualActualSaving || !String(manualActualValue).trim()
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity: manualActualSaving || !String(manualActualValue).trim() ? 0.7 : 1,
                                }}
                              >
                                {manualActualSaving ? "Salvataggio..." : "Salva"}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setManualActualOpenKey(key);
                                setManualActualHoursByKey((prev) => ({
                                  ...prev,
                                  [key]: prev[key] ?? "",
                                }));
                              }}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid #cbd5e1",
                                background: "white",
                                color: "#0f172a",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Inserisci tempo impiegato
                            </button>
                          )
                        ) : null}
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
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: usesSharedOperationalEditor
                            ? "minmax(0, 1.2fr) minmax(320px, 0.8fr)"
                            : "minmax(0, 1fr)",
                          gap: 14,
                          alignItems: "start",
                        }}
                      >
                        {usesSharedOperationalEditor ? (
                          <OperationalBlockEditor
                            title={r.kind === "DISINSTALLAZIONE" ? "BLOCCO DISINSTALLAZIONE" : "BLOCCO ATTIVITÀ"}
                            attachmentTitle={
                              r.kind === "DISINSTALLAZIONE"
                                ? "Allegati blocco disinstallazione (link Drive)"
                                : "Allegati blocco attività (link Drive)"
                            }
                            attachmentEntityType={
                              r.kind === "DISINSTALLAZIONE"
                                ? "CHECKLIST_DISINSTALLAZIONE"
                                : "CHECKLIST_OPERATIVI"
                            }
                            attachmentEntityId={r.checklist_id || r.row_ref_id}
                            attachmentSlotId={r.slot_id || null}
                            attachmentMode={r.slot_id ? "combined" : "block"}
                            form={
                              operativiDraftByKey[key] ||
                              (extractOperationalBlockForm
                                ? extractOperationalBlockForm(r, meta)
                                : ensureOperationalBlockForm(extractOperativi(meta), emptyOperationalBlockForm))
                            }
                            onChange={(value) =>
                              setOperativiDraftByKey((prev) => ({
                                ...prev,
                                [key]:
                                  typeof value === "function"
                                    ? value(
                                        prev[key] ||
                                          (extractOperationalBlockForm
                                            ? extractOperationalBlockForm(r, meta)
                                            : ensureOperationalBlockForm(
                                                extractOperativi(meta),
                                                emptyOperationalBlockForm
                                              ))
                                      )
                                    : value,
                              }))
                            }
                            onSave={() => saveOperativi(r)}
                            saving={savingOperativiKey === key}
                            meta={meta}
                            fallbackStartDate={schedule.data_inizio || r.data_prevista || ""}
                            warningMessage={
                              conflict?.hasConflict ? `Conflitto pianificazione: ${conflictTitle}` : null
                            }
                            planningStatus={editablePlanningStatus === "SVOLTA" ? null : editablePlanningStatus}
                            planningStatusOptions={
                              visualPlanningStatus === "SVOLTA" ? undefined : planningStatusOptions
                            }
                            onPlanningStatusChange={
                              visualPlanningStatus === "SVOLTA" || !setStatus
                                ? undefined
                                : (value) => setStatus(r, value as PlanningStatus)
                            }
                          />
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Data inizio</span>
                              <input
                                type="date"
                                value={operativi.data_inizio ?? ""}
                                onChange={(e) =>
                                  setOperativiDraftByKey((prev) => ({
                                    ...prev,
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), data_inizio: e.target.value },
                                  }))
                                }
                                style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                              />
                            </label>

                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Ore previste</span>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={operativi.durata_giorni ?? ""}
                                onChange={(e) =>
                                  setOperativiDraftByKey((prev) => ({
                                    ...prev,
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), durata_giorni: e.target.value },
                                  }))
                                }
                                placeholder="8"
                                style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                              />
                            </label>

                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Personale previsto / incarico</span>
                              <input
                                value={operativi.personale_previsto ?? ""}
                                onChange={(e) =>
                                  setOperativiDraftByKey((prev) => ({
                                    ...prev,
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), personale_previsto: e.target.value },
                                  }))
                                }
                                placeholder="Personale previsto / incarico"
                                style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                              />
                            </label>

                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Mezzi</span>
                              <textarea
                                value={operativi.mezzi ?? ""}
                                onChange={(e) =>
                                  setOperativiDraftByKey((prev) => ({
                                    ...prev,
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), mezzi: e.target.value },
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
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), descrizione_attivita: e.target.value },
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
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), indirizzo: e.target.value },
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
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), orario: e.target.value },
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
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), referente_cliente_nome: e.target.value },
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
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), referente_cliente_contatto: e.target.value },
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
                                    [key]: { ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)), commerciale_art_tech_nome: e.target.value },
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
                                      ...(prev[key] || ensureOperationalBlockForm(undefined, emptyOperationalBlockForm)),
                                      commerciale_art_tech_contatto: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Contatto commerciale Art Tech"
                                style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                              />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                            Timbrature operatori
                          </div>
                          <div
                            style={{
                              background: "white",
                              border: "1px solid #eef2f7",
                              borderRadius: 8,
                              padding: "10px 12px",
                              display: "grid",
                              gap: 10,
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                              Stimato gruppo: {formatMinutesCompact(timeBudget.stimatoMinuti)}
                            </div>
                            {operatorTimeEntries.length === 0 ? (
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Nessuna timbratura operatore
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 8 }}>
                                {operatorTimeEntries.map((entry, index) => {
                                  const liveMinutes =
                                    entry.stato === "IN_CORSO"
                                      ? Math.round(getLiveElapsedMs(entry.live_started_at, liveNowMs) / 60000)
                                      : 0;
                                  const totalMinutes = entry.durata_totale_minuti + liveMinutes;
                                  return (
                                    <div
                                      key={`${entry.operatore_id || entry.nome_operatore}-${index}`}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "minmax(0, 1fr) auto auto",
                                        gap: 8,
                                        alignItems: "center",
                                        borderBottom:
                                          index < operatorTimeEntries.length - 1
                                            ? "1px solid #f1f5f9"
                                            : undefined,
                                        paddingBottom:
                                          index < operatorTimeEntries.length - 1 ? 8 : 0,
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          color: "#0f172a",
                                          minWidth: 0,
                                          overflowWrap: "anywhere",
                                        }}
                                      >
                                        {entry.nome_operatore || "Operatore"}
                                      </div>
                                      <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
                                        {formatMinutesCompact(totalMinutes)}
                                      </div>
                                      <div>{renderOperatorTimbraturaStateBadge(entry.stato)}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                              Totale gruppo: {formatMinutesCompact(displayedActualMinutes)}
                            </div>
                          </div>
                        </div>
                        {latestReport && latestReportComment ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Report intervento</div>
                            <div
                              style={{
                                background: "white",
                                border: "1px solid #eef2f7",
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              {renderStructuredReportBlock(latestReportComment, latestReport)}
                            </div>
                          </div>
                        ) : null}
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Note</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input
                            value={noteDraft}
                            onChange={(e) => setNoteDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="Aggiungi nota..."
                            style={{ flex: "1 1 260px", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                          />
                          <button
                            type="button"
                            onClick={() => addComment(r)}
                            disabled={!canSaveNote}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #111",
                              background: canSaveNote ? "#111" : "#e5e7eb",
                              color: canSaveNote ? "white" : "#6b7280",
                              cursor: canSaveNote ? "pointer" : "not-allowed",
                              opacity: savingCommentKey === key ? 0.7 : 1,
                            }}
                          >
                            {savingCommentKey === key ? "Salvo..." : "Salva nota"}
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
                              {parseStructuredReport(comments[0])
                                ? renderStructuredReportBlock(comments[0], parseStructuredReport(comments[0]) as StructuredReport)
                                : (
                                  <>
                                    <div style={{ whiteSpace: "pre-wrap" }}>{comments[0].commento}</div>
                                    <div style={{ opacity: 0.7, marginTop: 4 }}>
                                      {(comments[0].created_by_nome || "Operatore") +
                                        " · " +
                                        (comments[0].created_at
                                          ? new Date(comments[0].created_at).toLocaleString("it-IT")
                                          : "—")}
                                    </div>
                                  </>
                                )}
                              {comments.length > 1 ? (
                                <div style={{ opacity: 0.7, marginTop: 4 }}>
                                  {comments.length} note nello storico
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ opacity: 0.7 }}>Nessuna nota</span>
                          )}
                        </div>
                      </div>

                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            {!usesSharedOperationalEditor && visualPlanningStatus !== "SVOLTA" ? (
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                                <span>Stato</span>
                                <select
                                  value={editablePlanningStatus === "SVOLTA" ? "DA_CONFERMARE" : editablePlanningStatus}
                                  onChange={(e) => setStatus(r, e.target.value as PlanningStatus)}
                                  disabled={savingStatusKey === key || stateLoading}
                                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
                                >
                                  {MANUAL_PLANNING_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status === "DA_CONFERMARE" ? "DA CONFERMARE" : status}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}
                            {visualPlanningStatus === "SVOLTA" ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>
                                Stato gestito da FATTO
                              </span>
                            ) : null}
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
                            {openRescheduleModal ? (
                              <button
                                type="button"
                                onClick={() => openRescheduleModal(r)}
                                disabled={savingRescheduleKey === key || stateLoading}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #b45309",
                                  background: savingRescheduleKey === key ? "#ffedd5" : "#fff7ed",
                                  color: "#9a3412",
                                  fontWeight: 700,
                                  cursor: savingRescheduleKey === key ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {savingRescheduleKey === key ? "..." : "Rimandato"}
                              </button>
                            ) : null}
                            {!usesSharedOperationalEditor ? (
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
                            ) : null}
                            {r.checklist_id ? (
                              <Link
                                href={`/checklists/${r.checklist_id}`}
                                style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                              >
                                Apri progetto
                              </Link>
                            ) : null}
                            {!usesSharedOperationalEditor && meta?.updated_at ? (
                              <div style={{ fontSize: 11, opacity: 0.75 }}>
                                {meta.updated_by_nome || "Operatore"} · {new Date(meta.updated_at).toLocaleString("it-IT")}
                              </div>
                            ) : null}
                          </div>
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
                  const structuredReport = parseStructuredReport(c);
                  return (
                    <div
                      key={c.id}
                      style={{ border: "1px solid #eef2f7", borderRadius: 8, padding: "8px 10px", background: "#f9fafb" }}
                    >
                      {structuredReport ? (
                        renderStructuredReportBlock(c, structuredReport)
                      ) : (
                        <>
                          <div style={{ whiteSpace: "pre-wrap" }}>{c.commento}</div>
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                            {(c.created_by_nome || "Operatore") +
                              " · " +
                              (c.created_at ? new Date(c.created_at).toLocaleString("it-IT") : "—")}
                          </div>
                        </>
                      )}
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
