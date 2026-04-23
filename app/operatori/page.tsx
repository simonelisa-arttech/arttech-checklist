"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  liveStartedAt?: string[];
};

type StopReportDraft = {
  esito: "COMPLETATO" | "PARZIALE" | "NON_COMPLETATO" | "";
  problemi: string;
  materiali: string;
  note_finali: string;
  parziale_cosa_fatto: string;
  parziale_cosa_manca: string;
  parziale_serve_altro_intervento: boolean;
  non_completato_motivo: "" | "Cliente assente" | "Materiale mancante" | "Problema tecnico" | "Altro";
  non_completato_note: string;
};

type CronoComment = {
  id: string;
  commento: string;
  created_at: string | null;
  created_by_operatore: string | null;
  created_by_nome: string | null;
};

type StructuredReport = {
  esito: "COMPLETATO" | "PARZIALE" | "NON_COMPLETATO";
  problemi: string;
  materiali: string;
  note_finali: string;
};

type ActivityFilter = "ATTIVE" | "FATTE" | "TUTTE";

const REPORT_COMMENT_PREFIX = "__REPORT__:";

const BADGE_COLORS = {
  statusExpired: { bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" },
  statusDueSoon: { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  statusOk: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  statusInProgress: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  statusNeutral: { bg: "#f8fafc", border: "#cbd5e1", color: "#475569" },
  activityInstall: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  activityIntervento: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  activityRemote: { bg: "#f3e8ff", border: "#d8b4fe", color: "#7e22ce" },
  activityDisinstall: { bg: "#ffedd5", border: "#fdba74", color: "#c2410c" },
} as const;

const EMPTY_STOP_REPORT: StopReportDraft = {
  esito: "COMPLETATO",
  problemi: "",
  materiali: "",
  note_finali: "",
  parziale_cosa_fatto: "",
  parziale_cosa_manca: "",
  parziale_serve_altro_intervento: false,
  non_completato_motivo: "",
  non_completato_note: "",
};

function getStopReportValidationMessage(draft: StopReportDraft) {
  if (!draft.esito) return "Seleziona un esito prima di terminare l'attività.";
  if (draft.esito === "PARZIALE") {
    if (!draft.parziale_cosa_fatto.trim() || !draft.parziale_cosa_manca.trim()) {
      return "Compila i campi obbligatori per continuare.";
    }
  }
  if (draft.esito === "NON_COMPLETATO") {
    if (!draft.non_completato_motivo || !draft.non_completato_note.trim()) {
      return "Compila i campi obbligatori per continuare.";
    }
  }
  return null;
}

function buildGuidedStopReportPayload(draft: StopReportDraft) {
  if (draft.esito === "PARZIALE") {
    const guidedNoteSections = [
      `Cosa è stato fatto:\n${draft.parziale_cosa_fatto.trim()}`,
      `Cosa manca:\n${draft.parziale_cosa_manca.trim()}`,
      `Serve altro intervento: ${draft.parziale_serve_altro_intervento ? "SI" : "NO"}`,
      draft.note_finali.trim() ? `Note finali:\n${draft.note_finali.trim()}` : "",
    ].filter(Boolean);

    return {
      esito: draft.esito,
      problemi: draft.problemi,
      materiali: draft.materiali,
      note_finali: guidedNoteSections.join("\n\n"),
    };
  }

  if (draft.esito === "NON_COMPLETATO") {
    const guidedNoteSections = [
      `Motivo: ${draft.non_completato_motivo}`,
      `Note:\n${draft.non_completato_note.trim()}`,
      draft.note_finali.trim() ? `Note finali:\n${draft.note_finali.trim()}` : "",
    ].filter(Boolean);

    return {
      esito: draft.esito,
      problemi: draft.problemi,
      materiali: draft.materiali,
      note_finali: guidedNoteSections.join("\n\n"),
    };
  }

  return {
    esito: draft.esito,
    problemi: draft.problemi,
    materiali: draft.materiali,
    note_finali: draft.note_finali,
  };
}

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
        {renderPill(
          `ESITO ${report.esito.replaceAll("_", " ")}`,
          report.esito === "COMPLETATO"
            ? BADGE_COLORS.statusOk
            : report.esito === "PARZIALE"
              ? BADGE_COLORS.statusDueSoon
              : BADGE_COLORS.statusExpired
        )}
        {renderPill("REPORT ATTIVITÀ", BADGE_COLORS.statusNeutral)}
      </div>
      {report.problemi ? (
        <div>
          <strong>Problemi:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{report.problemi}</span>
        </div>
      ) : null}
      {report.materiali ? (
        <div>
          <strong>Materiali:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{report.materiali}</span>
        </div>
      ) : null}
      {report.note_finali ? (
        <div>
          <strong>Note finali:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{report.note_finali}</span>
        </div>
      ) : null}
      <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
        {(comment.created_by_nome || "Operatore") +
          " · " +
          (comment.created_at ? new Date(comment.created_at).toLocaleString("it-IT") : "—")}
      </div>
    </div>
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

function formatMinutesTight(value?: number | null) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) return "—";
  const total = Math.round(Number(value));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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

function formatLiveElapsed(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function renderBudgetBadge(stimatoMinuti: number | null, realeMinuti: number | null) {
  if (!Number.isFinite(Number(stimatoMinuti)) || stimatoMinuti == null) return null;
  const actual = Number.isFinite(Number(realeMinuti)) && realeMinuti != null ? Number(realeMinuti) : 0;
  if (actual <= stimatoMinuti) return renderPill("IN LINEA", BADGE_COLORS.statusOk, "🟢");
  if (actual <= stimatoMinuti * 1.3) return renderPill("FUORI STIMA", BADGE_COLORS.statusDueSoon, "🟠");
  return renderPill("MOLTO FUORI", BADGE_COLORS.statusExpired, "🔴");
}

function getActivityDateKey(row: TimelineRow, meta?: CronoMeta | null) {
  const schedule = getRowSchedule(row, meta || null);
  return String(schedule.data_inizio || row.data_tassativa || row.data_prevista || "");
}

function renderMainStatusBadge(
  activityDate: string,
  timbraturaState: "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA",
  todayIso: string
) {
  if (timbraturaState === "IN_CORSO") {
    return renderPill("IN CORSO", BADGE_COLORS.statusInProgress, "⏸");
  }
  if (timbraturaState === "IN_PAUSA") {
    return renderPill("IN PAUSA", BADGE_COLORS.statusDueSoon, "⏸");
  }
  if (activityDate && activityDate < todayIso) {
    return renderPill("SCADUTA", BADGE_COLORS.statusExpired, "●");
  }
  if (activityDate === todayIso) {
    return renderPill("OGGI", BADGE_COLORS.statusDueSoon, "●");
  }
  return renderPill("PROSSIMA", BADGE_COLORS.statusNeutral, "●");
}

export default function OperatoreAttivitaPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const router = useRouter();
  const todayIso = dateToOperativiIsoDay(new Date());
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(currentMonthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatoreLabel, setOperatoreLabel] = useState<string>("");
  const [personaleId, setPersonaleId] = useState<string | null>(null);
  const [monthlyWorkedMinutes, setMonthlyWorkedMinutes] = useState<number>(0);
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [metaByKey, setMetaByKey] = useState<Record<string, CronoMeta>>({});
  const [timeBudgetByKey, setTimeBudgetByKey] = useState<Record<string, TimeBudgetSummary>>({});
  const [timbraturaStateByKey, setTimbraturaStateByKey] = useState<
    Record<string, "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA">
  >({});
  const [timbraturaLoadingKey, setTimbraturaLoadingKey] = useState<string | null>(null);
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());
  const [commentsByKey, setCommentsByKey] = useState<Record<string, CronoComment[]>>({});
  const [noteDraftByKey, setNoteDraftByKey] = useState<Record<string, string>>({});
  const [savingCommentKey, setSavingCommentKey] = useState<string | null>(null);
  const [notePanelKey, setNotePanelKey] = useState<string | null>(null);
  const [stopReportRowKey, setStopReportRowKey] = useState<string | null>(null);
  const [stopReportDraftByKey, setStopReportDraftByKey] = useState<Record<string, StopReportDraft>>({});
  const [stopReportError, setStopReportError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("ATTIVE");

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const meRes = await fetch("/api/me-operatore", { credentials: "include" });
        const meData = await meRes.json().catch(() => ({}));
        if (meRes.status === 401 || meRes.status === 403) {
          router.replace("/login?redirect=%2Foperatori");
          return;
        }
        if (!meRes.ok || !meData?.operatore?.id) {
          throw new Error(String(meData?.error || "Operatore non autenticato"));
        }
        if (meData?.operatore?.can_access_operator_app === false) {
          if (!active) return;
          setPersonaleId(null);
          setError("Accesso non autorizzato all'app operatori. Contatta l'amministrazione.");
          setRows([]);
          return;
        }

        const operatoreId = String(meData.operatore.id);
        setOperatoreLabel(String(meData.operatore.nome || "Operatore"));
        const personaleIdFromAuth =
          String(meData?.operatore?.personale_id || "").trim() || null;

        let linkedPersonaleId = personaleIdFromAuth;
        if (!linkedPersonaleId) {
          const { data: operatoreRow, error: operatoreErr } = await dbFrom("operatori")
            .select("id,nome,personale_id")
            .eq("id", operatoreId)
            .maybeSingle();
          if (operatoreErr) throw new Error(operatoreErr.message);
          linkedPersonaleId = String((operatoreRow as any)?.personale_id || "").trim() || null;
        }
        if (!linkedPersonaleId) {
          if (!active) return;
          setPersonaleId(null);
          setError("Profilo operatore non collegato al personale. Contatta l'amministrazione.");
          setRows([]);
          return;
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

        const [monthlyTimbratureRes] = await Promise.all([
          supabase
            .from("cronoprogramma_timbrature")
            .select("durata_effettiva_minuti")
            .eq("operatore_id", operatoreId)
            .eq("stato", "COMPLETATA")
            .gte("ended_at", currentMonthStart.toISOString())
            .lt("ended_at", nextMonthStart.toISOString()),
        ]);

        if (monthlyTimbratureRes.error) {
          console.error("Errore caricamento consuntivo mensile operatore", monthlyTimbratureRes.error);
        }

        const nextTimeBudget: Record<string, TimeBudgetSummary> = {};
        const nextTimbraturaState: Record<string, "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA"> = {};
        for (const row of assignedRows) {
          const key = getRowKey(row.kind, row.row_ref_id);
          nextTimeBudget[key] = { stimatoMinuti: null, realeMinuti: null, liveStartedAt: [] };
          nextTimbraturaState[key] = "NON_INIZIATA";
        }

        const serverBudget =
          loadData?.time_budget && typeof loadData.time_budget === "object" ? loadData.time_budget : {};
        for (const [key, value] of Object.entries(serverBudget)) {
          if (!nextTimeBudget[key]) continue;
          const summary = value as Record<string, unknown>;
          nextTimeBudget[key] = {
            stimatoMinuti:
              Number.isFinite(Number(summary?.stimatoMinuti)) && Number(summary?.stimatoMinuti) >= 0
                ? Number(summary?.stimatoMinuti)
                : null,
            realeMinuti:
              Number.isFinite(Number(summary?.realeMinuti)) && Number(summary?.realeMinuti) >= 0
                ? Number(summary?.realeMinuti)
                : null,
            liveStartedAt: Array.isArray(summary?.liveStartedAt)
              ? summary.liveStartedAt.map((item) => String(item || "").trim()).filter(Boolean)
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

        const totalMonthlyMinutes = (monthlyTimbratureRes.data || []).reduce((sum, row: any) => {
          const minutes =
            Number.isFinite(Number(row?.durata_effettiva_minuti)) && Number(row?.durata_effettiva_minuti) >= 0
              ? Number(row.durata_effettiva_minuti)
              : 0;
          return sum + minutes;
        }, 0);

        if (!active) return;
        setMetaByKey(nextMeta);
        setCommentsByKey((loadData?.comments || {}) as Record<string, CronoComment[]>);
        setRows(assignedRows);
        setTimeBudgetByKey(nextTimeBudget);
        setTimbraturaStateByKey(nextTimbraturaState);
        setMonthlyWorkedMinutes(totalMonthlyMinutes);
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
  }, [router]);

  useEffect(() => {
    const hasLive = Object.values(timbraturaStateByKey).some((state) => state === "IN_CORSO");
    if (!hasLive) return;
    const timer = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timbraturaStateByKey]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const key = getRowKey(row.kind, row.row_ref_id);
      const meta = metaByKey[key];
      const comments = commentsByKey[key] || [];
      const latestReportComment = comments.find((comment) => Boolean(parseStructuredReport(comment))) || null;
      const latestReport = latestReportComment ? parseStructuredReport(latestReportComment) : null;
      const timbraturaState = timbraturaStateByKey[key] || "NON_INIZIATA";
      const isCompleted =
        latestReport?.esito === "COMPLETATO"
          ? true
          : latestReport?.esito === "PARZIALE" || latestReport?.esito === "NON_COMPLETATO"
            ? false
            : Boolean(meta?.fatto ?? row.fatto) || timbraturaState === "COMPLETATA";
      if (activityFilter === "ATTIVE") return !isCompleted;
      if (activityFilter === "FATTE") return isCompleted;
      return true;
    });
  }, [activityFilter, commentsByKey, metaByKey, rows, timbraturaStateByKey]);

  const groupedRows = useMemo(() => {
    const groups = {
      IN_CORSO: [] as TimelineRow[],
      SCADUTE: [] as TimelineRow[],
      OGGI: [] as TimelineRow[],
      PROSSIME: [] as TimelineRow[],
    };

    for (const row of filteredRows) {
      const key = getRowKey(row.kind, row.row_ref_id);
      const activityDate = getActivityDateKey(row, metaByKey[key] || null);
      const timbraturaState = timbraturaStateByKey[key] || "NON_INIZIATA";
      if (timbraturaState === "IN_CORSO") {
        groups.IN_CORSO.push(row);
      } else if (activityDate < todayIso) {
        groups.SCADUTE.push(row);
      } else if (activityDate === todayIso) {
        groups.OGGI.push(row);
      } else {
        groups.PROSSIME.push(row);
      }
    }

    const sortByDate = (a: TimelineRow, b: TimelineRow) => {
      const aDate = getActivityDateKey(a, metaByKey[getRowKey(a.kind, a.row_ref_id)] || null);
      const bDate = getActivityDateKey(b, metaByKey[getRowKey(b.kind, b.row_ref_id)] || null);
      return aDate.localeCompare(bDate);
    };

    groups.IN_CORSO.sort(sortByDate);
    groups.SCADUTE.sort(sortByDate);
    groups.OGGI.sort(sortByDate);
    groups.PROSSIME.sort(sortByDate);

    return [
      { key: "IN_CORSO", title: "In corso", rows: groups.IN_CORSO },
      { key: "SCADUTE", title: "Urgenti / scadute", rows: groups.SCADUTE },
      { key: "OGGI", title: "Oggi", rows: groups.OGGI },
      { key: "PROSSIME", title: "Prossime", rows: groups.PROSSIME },
    ].filter((group) => group.rows.length > 0);
  }, [filteredRows, metaByKey, timbraturaStateByKey, todayIso]);

  const sortedRows = useMemo(() => {
    return groupedRows.flatMap((group) => group.rows);
  }, [groupedRows]);

  const summaryCounts = useMemo(() => {
    const findCount = (key: string) => groupedRows.find((group) => group.key === key)?.rows.length || 0;
    return {
      inCorso: findCount("IN_CORSO"),
      oggi: findCount("OGGI"),
      scadute: findCount("SCADUTE"),
    };
  }, [groupedRows]);

  async function refreshActivityDetails(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const res = await fetch("/api/cronoprogramma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "load",
        rows: [{ row_kind: row.kind, row_ref_id: row.row_ref_id }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || "Errore aggiornamento attività"));
    }

    const nextMeta = (data?.meta || {}) as Record<string, CronoMeta>;
    const nextComments = (data?.comments || {}) as Record<string, CronoComment[]>;
    const summary = ((data?.time_budget || {}) as Record<string, Record<string, unknown>>)[key] || {};
    const stato = String(summary?.stato || "").trim().toUpperCase();

    setMetaByKey((prev) => ({
      ...prev,
      ...(nextMeta[key] ? { [key]: nextMeta[key] } : {}),
    }));
    setCommentsByKey((prev) => ({
      ...prev,
      [key]: Array.isArray(nextComments[key]) ? nextComments[key] : [],
    }));
    setTimeBudgetByKey((prev) => ({
      ...prev,
      [key]: {
        stimatoMinuti:
          Number.isFinite(Number(summary?.stimatoMinuti)) && Number(summary?.stimatoMinuti) >= 0
            ? Number(summary?.stimatoMinuti)
            : null,
        realeMinuti:
          Number.isFinite(Number(summary?.realeMinuti)) && Number(summary?.realeMinuti) >= 0
            ? Number(summary?.realeMinuti)
            : null,
        liveStartedAt: Array.isArray(summary?.liveStartedAt)
          ? summary.liveStartedAt.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
      },
    }));
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

  async function handleTimbraturaAction(
    row: TimelineRow,
    key: string,
    action: "start_timbratura" | "pause_timbratura" | "resume_timbratura" | "stop_timbratura",
    extraPayload?: Record<string, unknown>
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
          ...(extraPayload || {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Errore timbratura operatore", data);
        setStopReportError(String(data?.error || "Errore salvataggio report attività"));
        return false;
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
        const completedMinutes =
          Number.isFinite(Number(data?.durata_effettiva_minuti)) && Number(data?.durata_effettiva_minuti) >= 0
            ? Number(data.durata_effettiva_minuti)
            : 0;
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
        setMonthlyWorkedMinutes((prev) => prev + completedMinutes);
      }
      return true;
    } catch (err) {
      console.error("Errore timbratura operatore", err);
      setStopReportError("Errore salvataggio report attività");
      return false;
    } finally {
      setTimbraturaLoadingKey((prev) => (prev === key ? null : prev));
    }
  }

  function openStopReport(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    setStopReportError(null);
    setNotePanelKey(key);
    setStopReportDraftByKey((prev) => ({
      ...prev,
      [key]: prev[key] || { ...EMPTY_STOP_REPORT },
    }));
    setStopReportRowKey(key);
  }

  async function submitStopReport(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const draft = stopReportDraftByKey[key] || EMPTY_STOP_REPORT;
    const validationMessage = getStopReportValidationMessage(draft);
    if (validationMessage) {
      setStopReportError(validationMessage);
      return;
    }
    const reportPayload = buildGuidedStopReportPayload(draft);
    const ok = await handleTimbraturaAction(row, key, "stop_timbratura", {
      report: reportPayload,
    });
    if (!ok) return;
    setStopReportDraftByKey((prev) => ({
      ...prev,
      [key]: { ...EMPTY_STOP_REPORT },
    }));
    setStopReportError(null);
    await refreshActivityDetails(row);
    setStopReportRowKey(null);
  }

  async function addInlineComment(row: TimelineRow) {
    const key = getRowKey(row.kind, row.row_ref_id);
    const commento = String(noteDraftByKey[key] || "").trim();
    if (!commento) return;
    try {
      setSavingCommentKey(key);
      setStopReportError(null);
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "add_comment",
          row_kind: row.kind,
          row_ref_id: row.row_ref_id,
          commento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.comment?.id) {
        throw new Error(String(data?.error || "Errore salvataggio nota"));
      }
      setCommentsByKey((prev) => ({
        ...prev,
        [key]: [data.comment as CronoComment, ...(prev[key] || [])],
      }));
      setNoteDraftByKey((prev) => ({
        ...prev,
        [key]: "",
      }));
    } catch (err: any) {
      setStopReportError(String(err?.message || "Errore salvataggio nota"));
      setNotePanelKey(key);
    } finally {
      setSavingCommentKey((prev) => (prev === key ? null : prev));
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "20px auto", padding: 16, paddingBottom: 72 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <img
          src="/at-logo.png"
          alt="ART TECH"
          style={{ height: 38, width: "auto", objectFit: "contain", flexShrink: 0 }}
        />
        <div style={{ display: "grid", gap: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: "#64748b",
              textTransform: "uppercase",
            }}
          >
            Art Tech
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", lineHeight: 1.05 }}>
            APP OPERATORI
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>
            Operatore
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1.05 }}>
            {operatoreLabel || "Operatore"}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>
            Attività assegnate, timbrature e note operative essenziali.
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              background: "#eff6ff",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.4 }}>
              In corso
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{summaryCounts.inCorso}</div>
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Oggi
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{summaryCounts.oggi}</div>
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Scadute
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{summaryCounts.scadute}</div>
          </div>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #bfdbfe",
              background: "#f8fafc",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Tempo lavorato mese
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
              {formatMinutesTight(monthlyWorkedMinutes)}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>{error}</div>
      ) : null}

      {loading ? (
        <div>Caricamento…</div>
      ) : !personaleId ? (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 16,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#991b1b" }}>
              Profilo operatore non collegato al personale
            </div>
            <div style={{ fontSize: 13, color: "#7f1d1d" }}>
              L'accesso all'app operatori usa solo il collegamento associato alle tue credenziali.
              Contatta l'amministrazione per completare l'associazione corretta e attivare la vista delle attività assegnate.
            </div>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div>Nessuna attività assegnata.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {([
              { key: "ATTIVE", label: "Attive" },
              { key: "FATTE", label: "Fatte" },
              { key: "TUTTE", label: "Tutte" },
            ] as Array<{ key: ActivityFilter; label: string }>).map((option) => {
              const active = activityFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActivityFilter(option.key)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: active ? "1px solid #111827" : "1px solid #d1d5db",
                    background: active ? "#111827" : "white",
                    color: active ? "white" : "#111827",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    minHeight: 40,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {sortedRows.length === 0 ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                borderRadius: 14,
                padding: 16,
                fontSize: 14,
                color: "#64748b",
              }}
            >
              {activityFilter === "ATTIVE"
                ? "Nessuna attività attiva."
                : activityFilter === "FATTE"
                  ? "Nessuna attività completata."
                  : "Nessuna attività disponibile."}
            </div>
          ) : (
            groupedRows.map((group) => (
              <div key={group.key} style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.title}
                  </div>
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                </div>
                {group.rows.map((row) => {
                const key = getRowKey(row.kind, row.row_ref_id);
                const meta = metaByKey[key] || null;
                const operativi = extractOperativi(meta);
                const schedule = getRowSchedule(row, meta);
                const comments = commentsByKey[key] || [];
                const latestReportComment = comments.find((comment) => Boolean(parseStructuredReport(comment))) || null;
                const latestReport = latestReportComment ? parseStructuredReport(latestReportComment) : null;
                const noteDraft = String(noteDraftByKey[key] || "");
                const canSaveNote = noteDraft.trim().length > 0 && savingCommentKey !== key;
                const stopReportDraft = stopReportDraftByKey[key] || EMPTY_STOP_REPORT;
                const timbraturaState = timbraturaStateByKey[key] || "NON_INIZIATA";
                const timbraturaLoading = timbraturaLoadingKey === key;
                const stopReportValidationMessage = getStopReportValidationMessage(stopReportDraft);
                const canSubmitStopReport = !stopReportValidationMessage && !timbraturaLoading;
                const showNotesPanel = notePanelKey === key;
                const modeLabel = getActivityModeLabel(operativi);
                const kindLabel = getActivityKindLabel(row, operativi);
                const timeBudget = timeBudgetByKey[key] || { stimatoMinuti: null, realeMinuti: null };
                const displayedActualMinutes = getDisplayedActualMinutes(timeBudget, liveNowMs);
                const liveElapsedMs = getLiveElapsedMs(timeBudget.liveStartedAt, liveNowMs);
                const overdue = isTimelineRowOverdueNotDone(row, meta);
                const activityDate = getActivityDateKey(row, meta);
                const deltaMinuti =
                  timeBudget.stimatoMinuti != null
                    ? displayedActualMinutes - timeBudget.stimatoMinuti
                    : null;
                const deltaLabel =
                  deltaMinuti == null
                    ? "Delta: —"
                    : Math.abs(deltaMinuti) <= 15
                      ? "Delta: In linea"
                      : deltaMinuti < 0
                        ? `Risparmio: ${formatMinutesCompact(Math.abs(deltaMinuti))}`
                        : `Ritardo: ${formatMinutesCompact(deltaMinuti)}`;

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
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {renderMainStatusBadge(activityDate, timbraturaState, todayIso)}
                          {renderActivityKindBadge(kindLabel)}
                          {renderModeBadge(modeLabel)}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", wordBreak: "break-word" }}>
                          {row.progetto || "Attività cronoprogramma"}
                        </div>
                        <div style={{ display: "grid", gap: 4, fontSize: 13, color: "#475569" }}>
                          <span>Cliente / progetto: {row.cliente || "—"}</span>
                          <span>Data: {schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}</span>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#475569" }}>
                            <span>Stimato: {formatMinutesCompact(timeBudget.stimatoMinuti)}</span>
                            <span>Reale: {formatMinutesCompact(displayedActualMinutes)}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#475569" }}>
                            <span>{deltaLabel}</span>
                            {timeBudget.stimatoMinuti != null ? renderBudgetBadge(timeBudget.stimatoMinuti, displayedActualMinutes) : null}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 8,
                          }}
                        >
                          {timbraturaState === "NON_INIZIATA" ? (
                            <button
                              type="button"
                              onClick={() => void handleTimbraturaAction(row, key, "start_timbratura")}
                              disabled={timbraturaLoading}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 12,
                                border: "1px solid #86efac",
                                background: "#f0fdf4",
                                color: "#166534",
                                fontSize: 14,
                                fontWeight: 800,
                                cursor: timbraturaLoading ? "wait" : "pointer",
                                opacity: timbraturaLoading ? 0.7 : 1,
                              }}
                            >
                              ▶ Inizia
                            </button>
                          ) : null}
                          {timbraturaState === "IN_PAUSA" ? (
                            <button
                              type="button"
                              onClick={() => void handleTimbraturaAction(row, key, "resume_timbratura")}
                              disabled={timbraturaLoading}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 12,
                                border: "1px solid #93c5fd",
                                background: "#dbeafe",
                                color: "#1d4ed8",
                                fontSize: 14,
                                fontWeight: 800,
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
                              onClick={() => openStopReport(row)}
                              disabled={timbraturaLoading}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 12,
                                border: "1px solid #fca5a5",
                                background: "#fee2e2",
                                color: "#b91c1c",
                                fontSize: 14,
                                fontWeight: 800,
                                cursor: timbraturaLoading ? "wait" : "pointer",
                                opacity: timbraturaLoading ? 0.7 : 1,
                              }}
                            >
                              ⏹ Termina
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setStopReportError(null);
                              setNotePanelKey((prev) => (prev === key ? null : key));
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "12px 14px",
                              borderRadius: 12,
                              border: showNotesPanel ? "1px solid #111827" : "1px solid #d1d5db",
                              background: showNotesPanel ? "#f8fafc" : "white",
                              color: "inherit",
                              fontSize: 14,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            {showNotesPanel ? "Chiudi note / report" : "Note / report"}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#64748b" }}>
                          {timbraturaState === "IN_CORSO" ? renderPill("IN CORSO", BADGE_COLORS.activityRemote, "⏸") : null}
                          {timbraturaState === "IN_PAUSA" ? renderPill("IN PAUSA", BADGE_COLORS.statusDueSoon, "⏸") : null}
                          {timbraturaState === "COMPLETATA" ? renderPill("COMPLETATA", BADGE_COLORS.statusOk, "✓") : null}
                          {timbraturaState === "IN_CORSO" ? renderPill(`LIVE ${formatLiveElapsed(liveElapsedMs)}`, BADGE_COLORS.activityRemote, "⏱") : null}
                          {timbraturaState === "IN_PAUSA" ? renderPill(`Accumulato ${formatMinutesCompact(displayedActualMinutes)}`, BADGE_COLORS.statusDueSoon, "⏱") : null}
                          {schedule.data_fine ? <span>Fine {formatOperativiDateLabel(schedule.data_fine)}</span> : null}
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
                          {overdue ? renderPill("Urgente", BADGE_COLORS.statusExpired) : null}
                        </div>
                        {showNotesPanel ? (
                          <div
                            style={{
                              display: "grid",
                              gap: 12,
                              borderTop: "1px solid #e5e7eb",
                              paddingTop: 12,
                            }}
                          >
                            {stopReportError && notePanelKey === key ? (
                              <div style={{ fontSize: 13, color: "#b91c1c" }}>{stopReportError}</div>
                            ) : null}
                            {latestReport && latestReportComment ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>
                                  Ultimo report finale
                                </div>
                                <div
                                  style={{
                                    border: "1px solid #e2e8f0",
                                    background: "#f8fafc",
                                    borderRadius: 12,
                                    padding: 12,
                                  }}
                                >
                                  {renderStructuredReportBlock(latestReportComment, latestReport)}
                                </div>
                              </div>
                            ) : null}

                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>
                                Aggiungi nota
                              </div>
                              <textarea
                                value={noteDraft}
                                onChange={(e) =>
                                  setNoteDraftByKey((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="Scrivi aggiornamenti, materiali, problemi o istruzioni operative..."
                                style={{
                                  width: "100%",
                                  padding: 12,
                                  borderRadius: 12,
                                  border: "1px solid #d1d5db",
                                  resize: "vertical",
                                  background: "white",
                                }}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  onClick={() => void addInlineComment(row)}
                                  disabled={!canSaveNote}
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    border: "1px solid #111827",
                                    background: canSaveNote ? "#111827" : "#e5e7eb",
                                    color: canSaveNote ? "white" : "#6b7280",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: canSaveNote ? "pointer" : "not-allowed",
                                  }}
                                >
                                  {savingCommentKey === key ? "Salvo..." : "Salva nota"}
                                </button>
                              </div>
                            </div>

                            {timbraturaState === "IN_CORSO" ? (
                              <div style={{ display: "grid", gap: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>
                                  Report finale
                                </div>
                                <label style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Esito</span>
                                  <select
                                    value={stopReportDraft.esito}
                                    onChange={(e) =>
                                      setStopReportDraftByKey((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || EMPTY_STOP_REPORT),
                                          esito: e.target.value as StopReportDraft["esito"],
                                        },
                                      }))
                                    }
                                    style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
                                  >
                                    <option value="COMPLETATO">COMPLETATO</option>
                                    <option value="PARZIALE">PARZIALE</option>
                                    <option value="NON_COMPLETATO">NON_COMPLETATO</option>
                                  </select>
                                </label>
                                <label style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Problemi</span>
                                  <textarea
                                    value={stopReportDraft.problemi}
                                    onChange={(e) =>
                                      setStopReportDraftByKey((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || EMPTY_STOP_REPORT),
                                          problemi: e.target.value,
                                        },
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Problemi riscontrati"
                                    style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }}
                                  />
                                </label>
                                <label style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Materiali utilizzati</span>
                                  <textarea
                                    value={stopReportDraft.materiali}
                                    onChange={(e) =>
                                      setStopReportDraftByKey((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || EMPTY_STOP_REPORT),
                                          materiali: e.target.value,
                                        },
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Materiali utilizzati"
                                    style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }}
                                  />
                                </label>
                                <label style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Note finali</span>
                                  <textarea
                                    value={stopReportDraft.note_finali}
                                    onChange={(e) =>
                                      setStopReportDraftByKey((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || EMPTY_STOP_REPORT),
                                          note_finali: e.target.value,
                                        },
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Note finali"
                                    style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }}
                                  />
                                </label>
                                {stopReportDraft.esito === "PARZIALE" ? (
                                  <>
                                    <label style={{ display: "grid", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Cosa è stato fatto</span>
                                      <textarea
                                        value={stopReportDraft.parziale_cosa_fatto}
                                        onChange={(e) =>
                                          setStopReportDraftByKey((prev) => ({
                                            ...prev,
                                            [key]: {
                                              ...(prev[key] || EMPTY_STOP_REPORT),
                                              parziale_cosa_fatto: e.target.value,
                                            },
                                          }))
                                        }
                                        rows={3}
                                        placeholder="Campo obbligatorio"
                                        style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }}
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Cosa manca</span>
                                      <textarea
                                        value={stopReportDraft.parziale_cosa_manca}
                                        onChange={(e) =>
                                          setStopReportDraftByKey((prev) => ({
                                            ...prev,
                                            [key]: {
                                              ...(prev[key] || EMPTY_STOP_REPORT),
                                              parziale_cosa_manca: e.target.value,
                                            },
                                          }))
                                        }
                                        rows={3}
                                        placeholder="Campo obbligatorio"
                                        style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }}
                                      />
                                    </label>
                                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#475569" }}>
                                      <input
                                        type="checkbox"
                                        checked={stopReportDraft.parziale_serve_altro_intervento}
                                        onChange={(e) =>
                                          setStopReportDraftByKey((prev) => ({
                                            ...prev,
                                            [key]: {
                                              ...(prev[key] || EMPTY_STOP_REPORT),
                                              parziale_serve_altro_intervento: e.target.checked,
                                            },
                                          }))
                                        }
                                      />
                                      Serve altro intervento?
                                    </label>
                                  </>
                                ) : null}
                                {stopReportDraft.esito === "NON_COMPLETATO" ? (
                                  <>
                                    <label style={{ display: "grid", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Motivo</span>
                                      <select
                                        value={stopReportDraft.non_completato_motivo}
                                        onChange={(e) =>
                                          setStopReportDraftByKey((prev) => ({
                                            ...prev,
                                            [key]: {
                                              ...(prev[key] || EMPTY_STOP_REPORT),
                                              non_completato_motivo: e.target.value as StopReportDraft["non_completato_motivo"],
                                            },
                                          }))
                                        }
                                        style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db" }}
                                      >
                                        <option value="">Seleziona motivo</option>
                                        <option value="Cliente assente">Cliente assente</option>
                                        <option value="Materiale mancante">Materiale mancante</option>
                                        <option value="Problema tecnico">Problema tecnico</option>
                                        <option value="Altro">Altro</option>
                                      </select>
                                    </label>
                                    <label style={{ display: "grid", gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Note</span>
                                      <textarea
                                        value={stopReportDraft.non_completato_note}
                                        onChange={(e) =>
                                          setStopReportDraftByKey((prev) => ({
                                            ...prev,
                                            [key]: {
                                              ...(prev[key] || EMPTY_STOP_REPORT),
                                              non_completato_note: e.target.value,
                                            },
                                          }))
                                        }
                                        rows={3}
                                        placeholder="Campo obbligatorio"
                                        style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #d1d5db", resize: "vertical" }}
                                      />
                                    </label>
                                  </>
                                ) : null}
                                {stopReportValidationMessage && stopReportDraft.esito !== "COMPLETATO" ? (
                                  <div style={{ fontSize: 13, color: "#b45309" }}>
                                    {stopReportValidationMessage}
                                  </div>
                                ) : null}
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                  <button
                                    type="button"
                                    onClick={() => void submitStopReport(row)}
                                    disabled={!canSubmitStopReport}
                                    style={{
                                      padding: "12px 14px",
                                      borderRadius: 12,
                                      border: "1px solid #111827",
                                      background: canSubmitStopReport ? "#111827" : "#e5e7eb",
                                      color: canSubmitStopReport ? "white" : "#6b7280",
                                      fontSize: 14,
                                      fontWeight: 800,
                                      cursor: canSubmitStopReport ? "pointer" : "not-allowed",
                                      opacity: timbraturaLoading ? 0.7 : 1,
                                    }}
                                  >
                                    {timbraturaLoading ? "Salvo..." : "Salva e termina"}
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>
                                Storico attività
                              </div>
                              {comments.length === 0 ? (
                                <div
                                  style={{
                                    border: "1px dashed #cbd5e1",
                                    borderRadius: 12,
                                    padding: 12,
                                    background: "#f8fafc",
                                    fontSize: 13,
                                    color: "#64748b",
                                  }}
                                >
                                  Nessuna nota o report presente.
                                </div>
                              ) : (
                                comments.map((comment) => {
                                  const structuredReport = parseStructuredReport(comment);
                                  return (
                                    <div
                                      key={comment.id}
                                      style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 12,
                                        background: "white",
                                        padding: 12,
                                      }}
                                    >
                                      {structuredReport ? (
                                        renderStructuredReportBlock(comment, structuredReport)
                                      ) : (
                                        <div style={{ display: "grid", gap: 6 }}>
                                          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#0f172a" }}>
                                            {comment.commento}
                                          </div>
                                          <div style={{ fontSize: 12, color: "#64748b" }}>
                                            {(comment.created_by_nome || "Operatore") +
                                              " · " +
                                              (comment.created_at
                                                ? new Date(comment.created_at).toLocaleString("it-IT")
                                                : "—")}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
