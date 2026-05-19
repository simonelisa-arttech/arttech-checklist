export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import {
  estimatedMinutesToLegacyDays,
  getOperativiEstimatedMinutes,
  normalizeOperativiDate,
  normalizeOperativiDuration,
} from "@/lib/operativiSchedule";

type RowKind = "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO" | "CHECKLIST_TASK";
type PlanningStatus =
  | "BOZZA"
  | "DA_CONFERMARE"
  | "CONFERMATA"
  | "RIMANDATA"
  | "SVOLTA"
  | "ANNULLATA";
type VisualPlanningStatus = PlanningStatus | "NASCOSTA";
type RowRef = {
  row_kind: RowKind;
  row_ref_id: string;
  slot_id?: string | null;
  slot_hours?: number | null;
};
type OperativiInput = {
  data_inizio?: string | null;
  durata_giorni?: string | number | null;
  durata_prevista_minuti?: string | number | null;
  modalita_attivita?: string | null;
  personale_previsto?: string | null;
  personale_ids?: string[] | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
};
type OperativiSlotInput = OperativiInput & {
  position?: string | number | null;
};
type OperativiReferenteInput = {
  id?: string | null;
  nome?: string | null;
  contatto?: string | null;
  ruolo?: string | null;
  position?: string | number | null;
};
type CompletionReportInput = {
  esito_attivita: ReportOutcome;
  note_finali: string;
  problemi: string | null;
  materiali: string | null;
};
type RescheduleActivityInput = {
  motivo_rimando: string;
  ore_previste_label: string | null;
  data_inizio: string;
  durata_prevista_minuti: number | null;
  modalita_attivita: string | null;
  personale_previsto: string | null;
  personale_ids: string[];
  mezzi: string | null;
  descrizione_attivita: string | null;
  indirizzo: string | null;
  orario: string | null;
  referente_cliente_nome: string | null;
  referente_cliente_contatto: string | null;
  commerciale_art_tech_nome: string | null;
  commerciale_art_tech_contatto: string | null;
};
const CUTOFF = "2026-01-01";
const REPORT_COMMENT_PREFIX = "__REPORT__:";
const REPORT_OUTCOME_VALUES = new Set(["COMPLETATO", "PARZIALE", "NON_COMPLETATO"]);
const PLANNING_STATUS_VALUES = new Set([
  "BOZZA",
  "DA_CONFERMARE",
  "CONFERMATA",
  "RIMANDATA",
  "SVOLTA",
  "ANNULLATA",
]);
type ReportOutcome = "COMPLETATO" | "PARZIALE" | "NON_COMPLETATO";
const SHARED_OPERATIVI_META_FIELDS = [
  "modalita_attivita",
  "personale_previsto",
  "personale_ids",
  "mezzi",
  "descrizione_attivita",
  "indirizzo",
  "referente_cliente_nome",
  "referente_cliente_contatto",
  "commerciale_art_tech_nome",
  "commerciale_art_tech_contatto",
];
const SHARED_STATUS_META_FIELDS = [
  "status",
  "status_updated_at",
  "status_updated_by_operatore",
];

function rowKey(rowKind: string, rowRefId: string, slotId?: string | null) {
  return slotId ? `${rowKind}:${rowRefId}:${slotId}` : `${rowKind}:${rowRefId}`;
}

function isSharedBlockKind(rowKind: string) {
  return rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE";
}

function isValidRowKind(value: string): value is RowKind {
  return (
    value === "INSTALLAZIONE" ||
    value === "DISINSTALLAZIONE" ||
    value === "INTERVENTO" ||
    value === "CHECKLIST_TASK"
  );
}

function toIsoDay(value?: string | null) {
  return normalizeOperativiDate(value);
}

function isOnOrAfterCutoff(value?: string | null) {
  const day = toIsoDay(value);
  return !!day && day >= CUTOFF;
}

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function cleanPlanningStatus(value: unknown): PlanningStatus | null {
  const status = String(value || "").trim().toUpperCase();
  return PLANNING_STATUS_VALUES.has(status) ? (status as PlanningStatus) : null;
}

function deriveVisualPlanningStatus(input: {
  status?: unknown;
  fatto?: unknown;
  hidden?: unknown;
  latestEventType?: unknown;
}): VisualPlanningStatus {
  const storedStatus = cleanPlanningStatus(input?.status);
  if (storedStatus) return storedStatus;
  if (Boolean(input?.hidden)) return "NASCOSTA";
  if (Boolean(input?.fatto)) return "SVOLTA";
  if (String(input?.latestEventType || "").trim().toUpperCase() === "RIMANDATO") {
    return "RIMANDATA";
  }
  return "DA_CONFERMARE";
}

function parseStructuredReportOutcome(commentValue: unknown): ReportOutcome | null {
  const raw = String(commentValue || "");
  if (!raw.startsWith(REPORT_COMMENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(REPORT_COMMENT_PREFIX.length));
    const esito = String(parsed?.esito || "").trim().toUpperCase();
    return REPORT_OUTCOME_VALUES.has(esito) ? (esito as ReportOutcome) : null;
  } catch {
    return null;
  }
}

function buildStructuredReportComment(input: CompletionReportInput) {
  return `${REPORT_COMMENT_PREFIX}${JSON.stringify({
    esito: input.esito_attivita,
    problemi: input.problemi || "",
    materiali: input.materiali || "",
    note_finali: input.note_finali,
  })}`;
}

function buildReadableCompletionComment(input: CompletionReportInput) {
  const lines = [
    "[ATTIVITÀ COMPLETATA]",
    `Esito: ${input.esito_attivita}`,
    `Note: ${input.note_finali}`,
  ];
  if (input.problemi) lines.push(`Problemi: ${input.problemi}`);
  if (input.materiali) lines.push(`Materiali: ${input.materiali}`);
  return lines.join("\n");
}

function buildReadableRescheduleComment(input: RescheduleActivityInput) {
  const lines = [
    "[ATTIVITÀ RIMANDATA]",
    `Motivo: ${input.motivo_rimando}`,
    `Nuova data: ${input.data_inizio}`,
  ];
  if (input.ore_previste_label) lines.push(`Ore previste: ${input.ore_previste_label}`);
  if (input.personale_previsto) lines.push(`Personale: ${input.personale_previsto}`);
  if (input.mezzi) lines.push(`Mezzi: ${input.mezzi}`);
  return lines.join("\n");
}

function cleanModalitaAttivita(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "ONSITE" || normalized === "REMOTO" ? normalized : null;
}

function cleanNonNegativeInteger(value: unknown) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function getEffectiveNormalizedStatus(value?: string | null) {
  return normalizeUpper(getEffectiveProjectStatus({ stato_progetto: value }));
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanUuidArray(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => isUuidLike(value))
    )
  );
}

function cleanOptionalUuid(value: unknown) {
  const normalized = String(value || "").trim();
  return isUuidLike(normalized) ? normalized : null;
}

function hasMeaningfulMetaValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function applyMetaFallbackFields(target: Record<string, any>, source: Record<string, any> | null | undefined, fields: string[]) {
  if (!source) return target;
  for (const field of fields) {
    if (!hasMeaningfulMetaValue(target[field]) && hasMeaningfulMetaValue(source[field])) {
      target[field] = source[field];
    }
  }
  return target;
}

function hasAnyMetaField(row: Record<string, any> | null | undefined, fields: string[]) {
  if (!row) return false;
  return fields.some((field) => hasMeaningfulMetaValue(row[field]));
}

function applyExactSlotFilter<T extends { eq: Function; is: Function }>(query: T, slotId?: string | null) {
  return slotId ? query.eq("slot_id", slotId) : query.is("slot_id", null);
}

function matchesSlotAwareRow(
  row: { row_kind?: string | null; row_ref_id?: string | null; slot_id?: string | null; id?: string | null },
  target: { row_kind: string; row_ref_id: string; slot_id?: string | null }
) {
  return (
    String(row?.row_kind || "") === target.row_kind &&
    String(row?.row_ref_id || "") === target.row_ref_id &&
    String(row?.slot_id || row?.id || "") === String(target.slot_id || "")
  );
}

function isMissingColumnError(error: unknown, column: string) {
  const message = String((error as any)?.message || "").toLowerCase();
  const target = String(column || "").trim().toLowerCase();
  return (
    !!target &&
    message.includes(target) &&
    (message.includes("does not exist") || message.includes("column"))
  );
}

function toOperativiPayload(input: OperativiInput) {
  const durataPrevistaMinuti =
    input?.durata_prevista_minuti !== undefined
      ? cleanNonNegativeInteger(input?.durata_prevista_minuti)
      : undefined;
  const legacyDurataGiorni =
    durataPrevistaMinuti !== undefined
      ? estimatedMinutesToLegacyDays(durataPrevistaMinuti)
      : input?.durata_giorni !== undefined
        ? normalizeOperativiDuration(input?.durata_giorni)
        : undefined;
  return {
    data_inizio: normalizeOperativiDate(input?.data_inizio) || null,
    ...(legacyDurataGiorni !== undefined ? { durata_giorni: legacyDurataGiorni } : {}),
    ...(durataPrevistaMinuti !== undefined
      ? { durata_prevista_minuti: durataPrevistaMinuti }
      : {}),
    modalita_attivita: cleanModalitaAttivita(input?.modalita_attivita),
    personale_previsto: cleanText(input?.personale_previsto),
    personale_ids: cleanUuidArray(input?.personale_ids),
    mezzi: cleanText(input?.mezzi),
    descrizione_attivita: cleanText(input?.descrizione_attivita),
    indirizzo: cleanText(input?.indirizzo),
    orario: cleanText(input?.orario),
    referente_cliente_nome: cleanText(input?.referente_cliente_nome),
    referente_cliente_contatto: cleanText(input?.referente_cliente_contatto),
    commerciale_art_tech_nome: cleanText(input?.commerciale_art_tech_nome),
    commerciale_art_tech_contatto: cleanText(input?.commerciale_art_tech_contatto),
  };
}

function mapMetaRow(row: any) {
  return {
    slot_id: cleanOptionalUuid(row?.slot_id),
    fatto: Boolean(row?.fatto),
    hidden: Boolean(row?.hidden),
    status: cleanPlanningStatus(row?.status),
    status_visual: deriveVisualPlanningStatus({
      status: row?.status,
      fatto: row?.fatto,
      hidden: row?.hidden,
    }),
    status_updated_at: row?.status_updated_at || null,
    status_updated_by_operatore: row?.status_updated_by_operatore || null,
    updated_at: row?.updated_at || null,
    updated_by_operatore: row?.updated_by_operatore || null,
    updated_by_nome: row?.operatore?.nome || null,
    data_inizio: row?.data_inizio || null,
    durata_giorni:
      Number.isFinite(Number(row?.durata_giorni)) && Number(row?.durata_giorni) > 0
        ? Number(row?.durata_giorni)
        : null,
    durata_prevista_minuti:
      Number.isFinite(Number(row?.durata_prevista_minuti)) && Number(row?.durata_prevista_minuti) >= 0
        ? Number(row?.durata_prevista_minuti)
        : null,
    modalita_attivita: row?.modalita_attivita || null,
    personale_previsto: row?.personale_previsto || null,
    personale_ids: Array.isArray(row?.personale_ids)
      ? row.personale_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [],
    mezzi: row?.mezzi || null,
    descrizione_attivita: row?.descrizione_attivita || null,
    indirizzo: row?.indirizzo || null,
    orario: row?.orario || null,
    referente_cliente_nome: row?.referente_cliente_nome || null,
    referente_cliente_contatto: row?.referente_cliente_contatto || null,
    commerciale_art_tech_nome: row?.commerciale_art_tech_nome || null,
    commerciale_art_tech_contatto: row?.commerciale_art_tech_contatto || null,
  };
}

function mapCommentRow(row: any) {
  return {
    id: row?.id,
    slot_id: cleanOptionalUuid(row?.slot_id),
    commento: row?.commento || "",
    created_at: row?.created_at || null,
    created_by_operatore: row?.created_by_operatore || null,
    created_by_nome: row?.operatore?.nome || null,
  };
}

function mapSlotRow(row: any) {
  return {
    id: cleanOptionalUuid(row?.id),
    position:
      Number.isFinite(Number(row?.position)) && Number(row?.position) >= 0
        ? Number(row?.position)
        : 0,
    data_inizio: row?.data_inizio || null,
    durata_giorni:
      Number.isFinite(Number(row?.durata_giorni)) && Number(row?.durata_giorni) > 0
        ? Number(row?.durata_giorni)
        : null,
    durata_prevista_minuti:
      Number.isFinite(Number(row?.durata_prevista_minuti)) && Number(row?.durata_prevista_minuti) >= 0
        ? Number(row?.durata_prevista_minuti)
        : null,
    personale_previsto: row?.personale_previsto || null,
    personale_ids: Array.isArray(row?.personale_ids)
      ? row.personale_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [],
    mezzi: row?.mezzi || null,
    descrizione_attivita: row?.descrizione_attivita || null,
    indirizzo: row?.indirizzo || null,
    orario: row?.orario || null,
    referente_cliente_nome: row?.referente_cliente_nome || null,
    referente_cliente_contatto: row?.referente_cliente_contatto || null,
    commerciale_art_tech_nome: row?.commerciale_art_tech_nome || null,
    commerciale_art_tech_contatto: row?.commerciale_art_tech_contatto || null,
  };
}

type TimeBudgetState = "NON_INIZIATA" | "IN_CORSO" | "IN_PAUSA" | "COMPLETATA";
type TimeBudgetRow = {
  id?: string | null;
  row_kind?: string | null;
  row_ref_id?: string | null;
  slot_id?: string | null;
  operatore_id?: string | null;
  durata_effettiva_minuti?: number | null;
  stato?: string | null;
  started_at?: string | null;
};
type TimeBudgetIntervalRow = {
  timbratura_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  durata_minuti?: number | null;
};
type TimeBudgetSummary = {
  stimatoMinuti: number | null;
  realeMinuti: number | null;
  stato: TimeBudgetState;
  liveStartedAt: string[];
};

function buildTimeBudgetSummaries(params: {
  normalizedRows: Array<{
    row_kind: string;
    row_ref_id: string;
    slot_id?: string | null;
    slot_hours?: number | null;
  }>;
  wanted: Set<string>;
  metaByKey: Record<string, any>;
  timbratureRows: TimeBudgetRow[];
  intervalsByTimbraturaId: Record<string, TimeBudgetIntervalRow[]>;
  latestReportOutcomeByKey?: Record<string, ReportOutcome | null>;
  operatoreId?: string | null;
}) {
  const {
    normalizedRows,
    wanted,
    metaByKey,
    timbratureRows,
    intervalsByTimbraturaId,
    latestReportOutcomeByKey,
    operatoreId,
  } = params;
  const summaries: Record<string, TimeBudgetSummary> = {};

  for (const row of normalizedRows) {
    const key = rowKey(row.row_kind, row.row_ref_id, row.slot_id);
    const slotEstimatedMinutes =
      row.slot_id && Number.isFinite(Number(row.slot_hours)) && Number(row.slot_hours) >= 0
        ? Math.round(Number(row.slot_hours) * 60)
        : null;
    summaries[key] = {
      stimatoMinuti: slotEstimatedMinutes ?? getOperativiEstimatedMinutes(metaByKey[key]) ?? null,
      realeMinuti: null,
      stato: "NON_INIZIATA",
      liveStartedAt: [],
    };
  }

  for (const row of timbratureRows || []) {
    const key = rowKey(
      String(row?.row_kind || ""),
      String(row?.row_ref_id || ""),
      cleanOptionalUuid(row?.slot_id)
    );
    if (!wanted.has(key)) continue;
    if (operatoreId && String(row?.operatore_id || "").trim() !== operatoreId) continue;
    if (!summaries[key]) {
      summaries[key] = {
        stimatoMinuti: null,
        realeMinuti: null,
        stato: "NON_INIZIATA",
        liveStartedAt: [],
      };
    }

    const current = summaries[key];
    const timbraturaId = String(row?.id || "").trim();
    const intervals = intervalsByTimbraturaId[timbraturaId] || [];
    let closedMinutes = 0;
    let hasIntervalData = false;

    for (const interval of intervals) {
      const durationMinutes = Number(interval?.durata_minuti);
      const endedAt = String(interval?.ended_at || "").trim();
      const startedAt = String(interval?.started_at || "").trim();
      if (Number.isFinite(durationMinutes) && durationMinutes >= 0 && endedAt) {
        hasIntervalData = true;
        closedMinutes += durationMinutes;
      } else if (!endedAt && startedAt) {
        hasIntervalData = true;
        current.liveStartedAt.push(startedAt);
      }
    }

    const durataEffettivaMinuti = Number(row?.durata_effettiva_minuti);
    if (hasIntervalData) {
      current.realeMinuti = (current.realeMinuti ?? 0) + closedMinutes;
    } else if (Number.isFinite(durataEffettivaMinuti) && durataEffettivaMinuti >= 0) {
      current.realeMinuti = (current.realeMinuti ?? 0) + durataEffettivaMinuti;
    } else {
      const startedAt = String(row?.started_at || "").trim();
      const stato = String(row?.stato || "").trim().toUpperCase();
      if (stato === "IN_CORSO" && startedAt) {
        current.liveStartedAt.push(startedAt);
      }
    }

    const stato = String(row?.stato || "").trim().toUpperCase();
    if (stato === "IN_CORSO") current.stato = "IN_CORSO";
    else if (stato === "IN_PAUSA" && current.stato !== "IN_CORSO") current.stato = "IN_PAUSA";
    else if (stato === "COMPLETATA" && current.stato === "NON_INIZIATA") {
      if (operatoreId) {
        current.stato = "COMPLETATA";
      } else {
        const latestReportOutcome = latestReportOutcomeByKey?.[key];
        const shouldTreatActivityAsCompleted =
          latestReportOutcome == null || latestReportOutcome === "COMPLETATO";
        if (shouldTreatActivityAsCompleted) {
          current.stato = "COMPLETATA";
        }
      }
    }
  }

  return summaries;
}

function toOperativiSlotPayload(input: OperativiSlotInput, position: number) {
  const {
    durata_giorni: _legacyDurataGiorni,
    modalita_attivita: _modalitaAttivita,
    ...slotPayload
  } = toOperativiPayload(input);
  return {
    position,
    ...slotPayload,
  };
}

function mapReferenteRow(row: any) {
  return {
    id: String(row?.id || "").trim() || null,
    nome: row?.nome || null,
    contatto: row?.contatto || null,
    ruolo: row?.ruolo || null,
    position:
      Number.isFinite(Number(row?.position)) && Number(row?.position) >= 0
        ? Number(row?.position)
        : 0,
  };
}

function toReferentePayload(input: OperativiReferenteInput, position: number) {
  return {
    position,
    nome: cleanText(input?.nome),
    contatto: cleanText(input?.contatto),
    ruolo: cleanText(input?.ruolo),
  };
}

async function loadOperatorePersonaleId(supabaseAdmin: any, operatoreId: string) {
  const { data, error } = await supabaseAdmin
    .from("operatori")
    .select("personale_id")
    .eq("id", operatoreId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.personale_id ? String(data.personale_id) : null;
}

function buildSyntheticMetaFromSlotRow(row: any) {
  const slot = mapSlotRow(row);
  return {
    slot_id: slot.id,
    fatto: false,
    hidden: false,
    status: null,
    status_visual: "DA_CONFERMARE" as VisualPlanningStatus,
    status_updated_at: null,
    status_updated_by_operatore: null,
    updated_at: null,
    updated_by_operatore: null,
    updated_by_nome: null,
    data_inizio: slot.data_inizio,
    durata_giorni: slot.durata_giorni,
    durata_prevista_minuti: slot.durata_prevista_minuti,
    modalita_attivita: null,
    personale_previsto: slot.personale_previsto,
    personale_ids: slot.personale_ids,
    mezzi: slot.mezzi,
    descrizione_attivita: slot.descrizione_attivita,
    indirizzo: slot.indirizzo,
    orario: slot.orario,
    referente_cliente_nome: slot.referente_cliente_nome,
    referente_cliente_contatto: slot.referente_cliente_contatto,
    commerciale_art_tech_nome: slot.commerciale_art_tech_nome,
    commerciale_art_tech_contatto: slot.commerciale_art_tech_contatto,
  };
}

function buildInheritedMetaForRow(params: {
  currentMeta?: Record<string, any> | null;
  blockMeta?: Record<string, any> | null;
  donorMeta?: Record<string, any> | null;
}) {
  const { currentMeta, blockMeta, donorMeta } = params;
  const merged = { ...(currentMeta || {}) };
  applyMetaFallbackFields(merged, blockMeta, SHARED_OPERATIVI_META_FIELDS);
  applyMetaFallbackFields(merged, donorMeta, SHARED_OPERATIVI_META_FIELDS);
  applyMetaFallbackFields(merged, blockMeta, SHARED_STATUS_META_FIELDS);
  applyMetaFallbackFields(merged, donorMeta, SHARED_STATUS_META_FIELDS);
  if (!Array.isArray(merged.referenti_cliente) && Array.isArray(blockMeta?.referenti_cliente)) {
    merged.referenti_cliente = blockMeta?.referenti_cliente;
  }
  if (!Array.isArray(merged.slots) && Array.isArray(blockMeta?.slots)) {
    merged.slots = blockMeta?.slots;
  }
  return merged;
}

async function loadAllBlockSlots(
  supabaseAdmin: any,
  rowKind: string,
  rowRefId: string
) {
  const { data, error } = await loadCurrentSlotsForActivity(supabaseAdmin, rowKind, rowRefId);
  if (
    error &&
    !String(error.message || "").toLowerCase().includes("cronoprogramma_meta_slots")
  ) {
    return { data: null, error };
  }
  return {
    data: (data || [])
      .map((row: any) => cleanOptionalUuid(row?.id))
      .filter(Boolean),
    error: null,
  };
}

async function writeMetaForScope(params: {
  supabaseAdmin: any;
  rowKind: string;
  rowRefId: string;
  slotId?: string | null;
  payload: Record<string, unknown>;
  includeBlockLegacy?: boolean;
}) {
  const { supabaseAdmin, rowKind, rowRefId, slotId, payload, includeBlockLegacy } = params;
  const isBlockScoped = isSharedBlockKind(rowKind);
  const { data: allSlotIds, error: slotsErr } =
    isBlockScoped ? await loadAllBlockSlots(supabaseAdmin, rowKind, rowRefId) : { data: null, error: null };
  if (slotsErr) {
    return { data: null, error: slotsErr, metas: [] as any[] };
  }

  const targetSlotIds =
    isBlockScoped && Array.isArray(allSlotIds) && allSlotIds.length > 0
      ? allSlotIds
      : [slotId ?? null];

  const metas: any[] = [];
  for (const targetSlotId of targetSlotIds) {
    const { data, error } = await writeExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      targetSlotId,
      payload
    );
    if (error) {
      return { data: null, error, metas };
    }
    if (data) metas.push(mapMetaRow(data));
  }

  if (includeBlockLegacy && isBlockScoped) {
    const { data, error } = await writeExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      null,
      payload
    );
    if (error) {
      return { data: null, error, metas };
    }
    if (data) metas.push(mapMetaRow(data));
  }

  const selectedMeta =
    metas.find((item) => cleanOptionalUuid(item?.slot_id) === cleanOptionalUuid(slotId)) ||
    metas.find((item) => cleanOptionalUuid(item?.slot_id) === null) ||
    metas[0] ||
    null;

  return { data: selectedMeta, error: null, metas };
}

async function loadExactMetaRow(
  supabaseAdmin: any,
  rowKind: string,
  rowRefId: string,
  slotId?: string | null
) {
  let query = supabaseAdmin
    .from("cronoprogramma_meta")
    .select("*, operatore:updated_by_operatore(nome)")
    .eq("row_kind", rowKind)
    .eq("row_ref_id", rowRefId);
  query = applyExactSlotFilter(query, slotId);
  return query.maybeSingle();
}

async function writeExactMetaRow(
  supabaseAdmin: any,
  rowKind: string,
  rowRefId: string,
  slotId: string | null,
  payload: Record<string, unknown>
) {
  const existingRes = await loadExactMetaRow(supabaseAdmin, rowKind, rowRefId, slotId);
  if (
    existingRes.error &&
    !String(existingRes.error.message || "").toLowerCase().includes("cronoprogramma_meta")
  ) {
    return { data: null, error: existingRes.error };
  }

  const basePayload = {
    row_kind: rowKind,
    row_ref_id: rowRefId,
    slot_id: slotId,
    ...payload,
  };

  const runWrite = async (writePayload: Record<string, unknown>) => {
    if (existingRes.data?.id) {
      return supabaseAdmin
        .from("cronoprogramma_meta")
        .update(writePayload)
        .eq("id", existingRes.data.id)
        .select("*, operatore:updated_by_operatore(nome)")
        .maybeSingle();
    }
    return supabaseAdmin
      .from("cronoprogramma_meta")
      .insert(writePayload)
      .select("*, operatore:updated_by_operatore(nome)")
      .maybeSingle();
  };

  let result = await runWrite(basePayload);
  if (result.error && String(result.error.message || "").toLowerCase().includes("personale_ids")) {
    const { personale_ids: _skip, ...legacyPayload } = basePayload as Record<string, unknown>;
    result = await runWrite(legacyPayload);
  }
  return result;
}

async function loadCurrentSlotsForActivity(
  supabaseAdmin: any,
  rowKind: string,
  rowRefId: string,
  slotId?: string | null
) {
  let query = supabaseAdmin
    .from("cronoprogramma_meta_slots")
    .select("*")
    .eq("row_kind", rowKind)
    .eq("row_ref_id", rowRefId)
    .order("position", { ascending: true });
  query = slotId ? query.eq("id", slotId) : query;
  return query;
}

export async function POST(request: Request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { adminClient: supabaseAdmin, operatore } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "load_events") {
    const CUTOFF_DATE = "2026-01-01";

    let checklists: any[] | null = null;
    let cErr: any = null;
    {
      const res = await supabaseAdmin
        .from("checklists")
        .select(
          "id, cliente, nome_checklist, proforma, data_prevista, data_tassativa, data_disinstallazione, stato_progetto, noleggio_vendita, tipo_impianto"
        )
        .order("created_at", { ascending: false });
      checklists = res.data as any[] | null;
      cErr = res.error;
    }
    if (cErr && String(cErr.message || "").toLowerCase().includes("data_disinstallazione")) {
      const res = await supabaseAdmin
        .from("checklists")
        .select("id, cliente, nome_checklist, proforma, data_prevista, data_tassativa, stato_progetto, noleggio_vendita, tipo_impianto")
        .order("created_at", { ascending: false });
      checklists = (res.data as any[] | null)?.map((row) => ({ ...row, data_disinstallazione: null })) ?? [];
      cErr = res.error;
    }
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    let interventi: any[] | null = null;
    let iErr: any = null;
    {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, ticket_no, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .order("data", { ascending: true });
      interventi = res.data as any[] | null;
      iErr = res.error;
    }
    if (iErr && String(iErr.message || "").toLowerCase().includes("data_tassativa")) {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, ticket_no, data, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .order("data", { ascending: true });
      interventi = (res.data as any[] | null)?.map((r) => ({ ...r, data_tassativa: null })) ?? [];
      iErr = res.error;
    }
    if (iErr && String(iErr.message || "").toLowerCase().includes("ticket_no")) {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .order("data", { ascending: true });
      interventi = (res.data as any[] | null)?.map((r) => ({ ...r, ticket_no: null, data_tassativa: r.data_tassativa ?? null })) ?? [];
      iErr = res.error;
    }
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    const checklistById = new Map<string, any>();
    const inCorsoChecklistIds = new Set<string>();
    for (const c of checklists || []) {
      const id = String((c as any).id || "");
      if (!id) continue;
      checklistById.set(id, c as any);
      if (["IN_CORSO", "IN_LAVORAZIONE"].includes(getEffectiveNormalizedStatus((c as any).stato_progetto))) {
        inCorsoChecklistIds.add(id);
      }
    }

    const activeChecklistIds = Array.from(
      new Set((checklists || []).map((row: any) => String(row?.id || "").trim()).filter(Boolean))
    );
    let slotRows: any[] = [];
    if (activeChecklistIds.length > 0) {
      const slotRes = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .select(
          "id, row_kind, row_ref_id, position, data_inizio, durata_prevista_minuti, personale_previsto, personale_ids, mezzi, descrizione_attivita, indirizzo, orario, referente_cliente_nome, referente_cliente_contatto, commerciale_art_tech_nome, commerciale_art_tech_contatto"
        )
        .in("row_ref_id", activeChecklistIds as any)
        .in("row_kind", ["INSTALLAZIONE", "DISINSTALLAZIONE"] as any)
        .order("position", { ascending: true });
      if (
        slotRes.error &&
        !String(slotRes.error.message || "").toLowerCase().includes("cronoprogramma_meta_slots")
      ) {
        return NextResponse.json({ error: slotRes.error.message }, { status: 500 });
      }
      slotRows = slotRes.data || [];
    }

    const slotsByChecklistAndKind = new Map<string, any[]>();
    for (const row of slotRows) {
      const slotId = cleanOptionalUuid((row as any).id);
      if (!slotId) continue;
      const key = rowKey(String((row as any).row_kind || ""), String((row as any).row_ref_id || ""));
      if (!slotsByChecklistAndKind.has(key)) slotsByChecklistAndKind.set(key, []);
      slotsByChecklistAndKind.get(key)?.push(mapSlotRow(row));
    }

    const timeline: any[] = [];

    for (const c of checklists || []) {
      const cc = c as any;
      const statoProgetto = getEffectiveNormalizedStatus(cc.stato_progetto);
      const isNoleggio = normalizeUpper(cc.noleggio_vendita) === "NOLEGGIO";

      if (["IN_CORSO", "IN_LAVORAZIONE"].includes(statoProgetto)) {
        const date = toIsoDay(cc.data_tassativa) || toIsoDay(cc.data_prevista);
        const installSlots = slotsByChecklistAndKind.get(rowKey("INSTALLAZIONE", String(cc.id))) || [];
        if (installSlots.length > 0) {
          for (const slot of installSlots) {
            const slotDate = toIsoDay(slot.data_inizio) || date;
            if (!slotDate || slotDate < CUTOFF_DATE) continue;
            timeline.push({
              kind: "INSTALLAZIONE",
              id: `install:${cc.id}:${slot.id}`,
              row_ref_id: cc.id,
              slot_id: slot.id,
              slot_date: slotDate,
              slot_hours:
                Number.isFinite(Number(slot.durata_prevista_minuti)) && Number(slot.durata_prevista_minuti) >= 0
                  ? Number(slot.durata_prevista_minuti) / 60
                  : null,
              slot_orario: slot.orario || null,
              data_prevista: slotDate,
              data_tassativa: slotDate,
              cliente: String(cc.cliente || "—"),
              checklist_id: cc.id,
              progetto: String(cc.nome_checklist || cc.id),
              proforma: cc.proforma ?? null,
              tipologia: normalizeUpper(cc.noleggio_vendita || "INSTALLAZIONE"),
              descrizione:
                [cc.tipo_impianto || "", cc.noleggio_vendita || ""].filter(Boolean).join(" · ") ||
                "Installazione pianificata",
              stato: "PIANIFICATA",
              fatto: false,
            });
          }
        } else if (date && date >= CUTOFF_DATE) {
          timeline.push({
            kind: "INSTALLAZIONE",
            id: `install:${cc.id}`,
            row_ref_id: cc.id,
            slot_id: null,
            slot_date: null,
            slot_hours: null,
            slot_orario: null,
            data_prevista: toIsoDay(cc.data_prevista) || date,
            data_tassativa: toIsoDay(cc.data_tassativa) || date,
            cliente: String(cc.cliente || "—"),
            checklist_id: cc.id,
            progetto: String(cc.nome_checklist || cc.id),
            proforma: cc.proforma ?? null,
            tipologia: normalizeUpper(cc.noleggio_vendita || "INSTALLAZIONE"),
            descrizione:
              [cc.tipo_impianto || "", cc.noleggio_vendita || ""].filter(Boolean).join(" · ") ||
              "Installazione pianificata",
            stato: "PIANIFICATA",
            fatto: false,
          });
        }
      }

      if (isNoleggio && ["IN_CORSO", "IN_LAVORAZIONE", "CONSEGNATO"].includes(statoProgetto)) {
        const disinstallDate = toIsoDay(cc.data_disinstallazione);
        const disinstallSlots =
          slotsByChecklistAndKind.get(rowKey("DISINSTALLAZIONE", String(cc.id))) || [];
        if (disinstallSlots.length > 0) {
          for (const slot of disinstallSlots) {
            const slotDate = toIsoDay(slot.data_inizio) || disinstallDate;
            if (!slotDate || slotDate < CUTOFF_DATE) continue;
            timeline.push({
              kind: "DISINSTALLAZIONE",
              id: `disinstall:${cc.id}:${slot.id}`,
              row_ref_id: cc.id,
              slot_id: slot.id,
              slot_date: slotDate,
              slot_hours:
                Number.isFinite(Number(slot.durata_prevista_minuti)) && Number(slot.durata_prevista_minuti) >= 0
                  ? Number(slot.durata_prevista_minuti) / 60
                  : null,
              slot_orario: slot.orario || null,
              data_prevista: slotDate,
              data_tassativa: slotDate,
              cliente: String(cc.cliente || "—"),
              checklist_id: cc.id,
              progetto: String(cc.nome_checklist || cc.id),
              proforma: cc.proforma ?? null,
              tipologia: "NOLEGGIO",
              descrizione:
                [cc.tipo_impianto || "", "SMONTAGGIO NOLEGGIO"].filter(Boolean).join(" · ") ||
                "Smontaggio noleggio pianificato",
              stato: "PIANIFICATA",
              fatto: false,
            });
          }
        } else if (disinstallDate && disinstallDate >= CUTOFF_DATE) {
          timeline.push({
            kind: "DISINSTALLAZIONE",
            id: `disinstall:${cc.id}`,
            row_ref_id: cc.id,
            slot_id: null,
            slot_date: null,
            slot_hours: null,
            slot_orario: null,
            data_prevista: disinstallDate,
            data_tassativa: disinstallDate,
            cliente: String(cc.cliente || "—"),
            checklist_id: cc.id,
            progetto: String(cc.nome_checklist || cc.id),
            proforma: cc.proforma ?? null,
            tipologia: "NOLEGGIO",
            descrizione:
              [cc.tipo_impianto || "", "SMONTAGGIO NOLEGGIO"].filter(Boolean).join(" · ") ||
              "Smontaggio noleggio pianificato",
            stato: "PIANIFICATA",
            fatto: false,
          });
        }
      }
    }

    for (const i of interventi || []) {
      const ii = i as any;
      const statoIntervento = String(ii.stato_intervento || "APERTO").trim().toUpperCase();
      if (statoIntervento !== "APERTO") continue;
      const date = toIsoDay(ii.data_tassativa) || toIsoDay(ii.data);
      if (!date || date < CUTOFF_DATE) continue;
      const c = ii.checklist_id ? checklistById.get(String(ii.checklist_id)) : null;
      const prevista = toIsoDay(ii.data) || toIsoDay(ii.data_tassativa) || date;
      const tassativa = toIsoDay(ii.data_tassativa) || toIsoDay(ii.data) || date;
      timeline.push({
        kind: "INTERVENTO",
        id: `intervento:${ii.id}`,
        row_ref_id: ii.id,
        slot_id: null,
        slot_date: null,
        slot_hours: null,
        slot_orario: null,
        data_prevista: prevista,
        data_tassativa: tassativa,
        cliente: String(ii.cliente || c?.cliente || "—"),
        checklist_id: ii.checklist_id,
        ticket_no: ii.ticket_no ?? null,
        proforma: ii.proforma ?? c?.proforma ?? null,
        progetto: String(c?.nome_checklist || ii.checklist_id || "—"),
        tipologia: String(ii.tipo || "INTERVENTO").toUpperCase(),
        descrizione: String(ii.descrizione || "Intervento"),
        stato: statoIntervento,
        fatto: false,
      });
    }

    timeline.sort((a, b) => (a.data_tassativa || a.data_prevista).localeCompare(b.data_tassativa || b.data_prevista));
    return NextResponse.json({
      ok: true,
      events: timeline,
      auth_mode: "service_role",
      ...(debug ? { debug: { auth_mode: "service_role" } } : {}),
    });
  }

  if (action === "load") {
    const inputRows = Array.isArray(body?.rows) ? (body.rows as RowRef[]) : [];
    let normalizedRows = inputRows
      .map((r) => ({
        row_kind: String(r?.row_kind || "").toUpperCase(),
        row_ref_id: String(r?.row_ref_id || "").trim(),
        slot_id: cleanOptionalUuid(r?.slot_id),
        slot_hours:
          Number.isFinite(Number(r?.slot_hours)) && Number(r?.slot_hours) >= 0
            ? Number(r?.slot_hours)
            : null,
      }))
      .filter((r) => isValidRowKind(r.row_kind) && r.row_ref_id);

    if (normalizedRows.length === 0) {
      return NextResponse.json({
        ok: true,
        meta: {},
        comments: {},
        time_budget: {},
        time_budget_current_operator: {},
      });
    }

    const installazioneIds = Array.from(
      new Set(
        normalizedRows
          .filter((r) => r.row_kind === "INSTALLAZIONE" || r.row_kind === "DISINSTALLAZIONE")
          .map((r) => r.row_ref_id)
      )
    );
    const interventoIds = Array.from(
      new Set(normalizedRows.filter((r) => r.row_kind === "INTERVENTO").map((r) => r.row_ref_id))
    );

    const allowedInstallazioni = new Set<string>();
    if (installazioneIds.length > 0) {
      const { data: checklistRows, error: checklistErr } = await supabaseAdmin
        .from("checklists")
        .select("id")
        .in("id", installazioneIds as any);
      if (checklistErr) {
        return NextResponse.json({ error: checklistErr.message }, { status: 500 });
      }
      for (const row of checklistRows || []) {
        allowedInstallazioni.add(String((row as any).id));
      }
    }

    const allowedInterventi = new Set<string>();
    if (interventoIds.length > 0) {
      let interventiRows: any[] | null = null;
      let interventiErr: any = null;
      {
        const res = await supabaseAdmin
          .from("saas_interventi")
          .select("id, stato_intervento, data, data_tassativa")
          .in("id", interventoIds as any);
        interventiRows = res.data as any[] | null;
        interventiErr = res.error;
      }
      if (interventiErr && String(interventiErr.message || "").toLowerCase().includes("data_tassativa")) {
        const res = await supabaseAdmin
          .from("saas_interventi")
          .select("id, stato_intervento, data")
          .in("id", interventoIds as any);
        interventiRows = (res.data as any[] | null)?.map((r) => ({ ...r, data_tassativa: null })) ?? [];
        interventiErr = res.error;
      }
      if (interventiErr) {
        return NextResponse.json({ error: interventiErr.message }, { status: 500 });
      }
      for (const row of interventiRows || []) {
        allowedInterventi.add(String((row as any).id));
      }
    }

    normalizedRows = normalizedRows.filter((r) => {
      if (r.row_kind === "INSTALLAZIONE" || r.row_kind === "DISINSTALLAZIONE") {
        return allowedInstallazioni.has(r.row_ref_id);
      }
      if (r.row_kind === "INTERVENTO") return allowedInterventi.has(r.row_ref_id);
      if (r.row_kind === "CHECKLIST_TASK") return true;
      return false;
    });

    if (normalizedRows.length === 0) {
      return NextResponse.json({
        ok: true,
        meta: {},
        comments: {},
        time_budget: {},
        time_budget_current_operator: {},
      });
    }

    const rowIds = Array.from(new Set(normalizedRows.map((r) => r.row_ref_id)));
    const rowKinds = Array.from(new Set(normalizedRows.map((r) => r.row_kind)));
    const wanted = new Set(normalizedRows.map((r) => rowKey(r.row_kind, r.row_ref_id, r.slot_id)));

    let metaRows: any[] | null = null;
    let metaErr: any = null;
    {
      const res = await supabaseAdmin
        .from("cronoprogramma_meta")
        .select("*, operatore:updated_by_operatore(nome)")
        .in("row_ref_id", rowIds)
        .in("row_kind", rowKinds as any);
      metaRows = res.data as any[] | null;
      metaErr = res.error;
    }
    if (metaErr && String(metaErr.message || "").toLowerCase().includes("hidden")) {
      const res = await supabaseAdmin
        .from("cronoprogramma_meta")
        .select("row_kind, row_ref_id, fatto, updated_at, updated_by_operatore, operatore:updated_by_operatore(nome)")
        .in("row_ref_id", rowIds)
        .in("row_kind", rowKinds as any);
      metaRows = (res.data as any[] | null)?.map((r) => ({ ...r, hidden: false })) ?? [];
      metaErr = res.error;
    }

    if (metaErr && !String(metaErr.message || "").toLowerCase().includes("cronoprogramma_meta")) {
      return NextResponse.json({ error: metaErr.message }, { status: 500 });
    }

    let slotRows: any[] | null = null;
    let slotsErr: any = null;
    {
      const res = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .select(
          "id, row_kind, row_ref_id, position, data_inizio, durata_prevista_minuti, personale_previsto, personale_ids, mezzi, descrizione_attivita, indirizzo, orario, referente_cliente_nome, referente_cliente_contatto, commerciale_art_tech_nome, commerciale_art_tech_contatto"
        )
        .in("row_ref_id", rowIds)
        .in("row_kind", rowKinds as any)
        .order("position", { ascending: true });
      slotRows = res.data as any[] | null;
      slotsErr = res.error;
    }

    if (
      slotsErr &&
      !String(slotsErr.message || "").toLowerCase().includes("cronoprogramma_meta_slots")
    ) {
      return NextResponse.json({ error: slotsErr.message }, { status: 500 });
    }

    let referentiRows: any[] | null = null;
    let referentiErr: any = null;
    {
      const res = await supabaseAdmin
        .from("cronoprogramma_meta_referenti")
        .select("id, row_kind, row_ref_id, nome, contatto, ruolo, position")
        .in("row_ref_id", rowIds)
        .in("row_kind", rowKinds as any)
        .order("position", { ascending: true });
      referentiRows = res.data as any[] | null;
      referentiErr = res.error;
    }

    if (
      referentiErr &&
      !String(referentiErr.message || "").toLowerCase().includes("cronoprogramma_meta_referenti")
    ) {
      return NextResponse.json({ error: referentiErr.message }, { status: 500 });
    }

    const { data: commentRows, error: commErr } = await supabaseAdmin
      .from("cronoprogramma_comments")
      .select("id, row_kind, row_ref_id, slot_id, commento, created_at, created_by_operatore, operatore:created_by_operatore(nome)")
      .in("row_ref_id", rowIds)
      .in("row_kind", rowKinds as any)
      .order("created_at", { ascending: false });

    if (commErr && !String(commErr.message || "").toLowerCase().includes("cronoprogramma_comments")) {
      return NextResponse.json({ error: commErr.message }, { status: 500 });
    }

    const { data: activityEventRows, error: activityEventErr } = await supabaseAdmin
      .from("cronoprogramma_activity_events")
      .select("row_kind, row_ref_id, slot_id, event_type, created_at")
      .in("row_ref_id", rowIds)
      .in("row_kind", rowKinds as any)
      .order("created_at", { ascending: false });

    if (
      activityEventErr &&
      !String(activityEventErr.message || "").toLowerCase().includes("cronoprogramma_activity_events")
    ) {
      return NextResponse.json({ error: activityEventErr.message }, { status: 500 });
    }

    const { data: timbratureRows, error: timbratureErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id, row_kind, row_ref_id, slot_id, operatore_id, durata_effettiva_minuti, stato, started_at")
      .in("row_ref_id", rowIds)
      .in("row_kind", rowKinds as any)
      .order("created_at", { ascending: false });

    if (
      timbratureErr &&
      !String(timbratureErr.message || "").toLowerCase().includes("cronoprogramma_timbrature")
    ) {
      return NextResponse.json({ error: timbratureErr.message }, { status: 500 });
    }

    const metaByKey: Record<string, any> = {};
    for (const row of metaRows || []) {
      const key = rowKey(
        String((row as any).row_kind),
        String((row as any).row_ref_id),
        cleanOptionalUuid((row as any).slot_id)
      );
      if (!wanted.has(key)) continue;
      metaByKey[key] = mapMetaRow(row as any);
    }

    const slotsByKey: Record<string, any[]> = {};
    const slotById = new Map<string, any>();
    for (const row of slotRows || []) {
      const slotId = cleanOptionalUuid((row as any).id);
      const key = rowKey(String((row as any).row_kind), String((row as any).row_ref_id));
      if (!slotsByKey[key]) slotsByKey[key] = [];
      const mappedSlot = mapSlotRow(row as any);
      slotsByKey[key].push(mappedSlot);
      if (slotId) {
        slotById.set(slotId, row as any);
      }
    }
    for (const [key, slots] of Object.entries(slotsByKey)) {
      if (slots.length > 0) {
        metaByKey[key] = {
          ...(metaByKey[key] || {}),
          slots,
        };
      }
    }

    const referentiByKey: Record<string, any[]> = {};
    for (const row of referentiRows || []) {
      const key = rowKey(String((row as any).row_kind), String((row as any).row_ref_id), null);
      if (!wanted.has(key)) continue;
      if (!referentiByKey[key]) referentiByKey[key] = [];
      referentiByKey[key].push(mapReferenteRow(row as any));
    }
    for (const [key, referenti] of Object.entries(referentiByKey)) {
      if (referenti.length > 0) {
        metaByKey[key] = {
          ...(metaByKey[key] || {}),
          referenti_cliente: referenti,
        };
      }
    }

    const donorMetaByBlockKey: Record<string, any> = {};
    for (const [blockKey, slots] of Object.entries(slotsByKey)) {
      const separatorIndex = blockKey.indexOf(":");
      const blockRowKind = separatorIndex >= 0 ? blockKey.slice(0, separatorIndex) : "";
      const blockRowRefId = separatorIndex >= 0 ? blockKey.slice(separatorIndex + 1) : "";
      const slotList = Array.isArray(slots) ? [...slots] : [];
      for (const slot of slotList.sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))) {
        const slotKey = rowKey(blockRowKind, blockRowRefId, cleanOptionalUuid((slot as any)?.id));
        const candidate = metaByKey[slotKey] || null;
        if (hasAnyMetaField(candidate, [...SHARED_OPERATIVI_META_FIELDS, ...SHARED_STATUS_META_FIELDS])) {
          donorMetaByBlockKey[blockKey] = candidate;
          break;
        }
      }
    }

    const commentsByKey: Record<string, any[]> = {};
    const latestReportOutcomeByKey: Record<string, ReportOutcome | null> = {};
    for (const row of commentRows || []) {
      const key = rowKey(
        String((row as any).row_kind),
        String((row as any).row_ref_id),
        cleanOptionalUuid((row as any).slot_id)
      );
      if (!wanted.has(key)) continue;
      if (!commentsByKey[key]) commentsByKey[key] = [];
      commentsByKey[key].push(mapCommentRow(row));
      if (!(key in latestReportOutcomeByKey)) {
        latestReportOutcomeByKey[key] = parseStructuredReportOutcome((row as any).commento);
      }
    }

    const latestEventTypeByKey: Record<string, string | null> = {};
    for (const row of activityEventRows || []) {
      const key = rowKey(
        String((row as any).row_kind),
        String((row as any).row_ref_id),
        cleanOptionalUuid((row as any).slot_id)
      );
      if (!wanted.has(key)) continue;
      if (!(key in latestEventTypeByKey)) {
        latestEventTypeByKey[key] = String((row as any).event_type || "").trim().toUpperCase() || null;
      }
    }

    for (const row of normalizedRows) {
      if (!row.slot_id) continue;
      const key = rowKey(row.row_kind, row.row_ref_id, row.slot_id);
      if (metaByKey[key]) continue;
      const slotRow = slotById.get(row.slot_id);
      if (slotRow && matchesSlotAwareRow(slotRow, row)) {
        metaByKey[key] = buildSyntheticMetaFromSlotRow(slotRow);
      }
    }

    for (const row of normalizedRows) {
      const key = rowKey(row.row_kind, row.row_ref_id, row.slot_id);
      const blockKey = rowKey(row.row_kind, row.row_ref_id, null);
      const inheritedMeta = row.slot_id
        ? buildInheritedMetaForRow({
            currentMeta: metaByKey[key] || null,
            blockMeta: metaByKey[blockKey] || null,
            donorMeta: donorMetaByBlockKey[blockKey] || null,
          })
        : metaByKey[key] || null;
      const currentMeta = inheritedMeta || {
        slot_id: row.slot_id ?? null,
        fatto: false,
        hidden: false,
        status: null,
        status_updated_at: null,
        status_updated_by_operatore: null,
      };
      metaByKey[key] = {
        ...currentMeta,
        status: cleanPlanningStatus(currentMeta?.status),
        status_visual: deriveVisualPlanningStatus({
          status: currentMeta?.status,
          fatto: currentMeta?.fatto,
          hidden: currentMeta?.hidden,
          latestEventType: latestEventTypeByKey[key],
        }),
      };
    }

    const timbraturaIds = (timbratureRows || [])
      .map((row) => String((row as any).id || "").trim())
      .filter(Boolean);

    let intervalRows: any[] = [];
    if (timbraturaIds.length > 0) {
      const intervalRes = await supabaseAdmin
        .from("cronoprogramma_timbrature_intervalli")
        .select("timbratura_id, started_at, ended_at, durata_minuti")
        .in("timbratura_id", timbraturaIds);

      if (
        intervalRes.error &&
        !String(intervalRes.error.message || "")
          .toLowerCase()
          .includes("cronoprogramma_timbrature_intervalli")
      ) {
        return NextResponse.json({ error: intervalRes.error.message }, { status: 500 });
      }

      intervalRows = intervalRes.data || [];
    }

    const intervalsByTimbraturaId: Record<string, any[]> = {};
    for (const row of intervalRows) {
      const timbraturaId = String((row as any).timbratura_id || "").trim();
      if (!timbraturaId) continue;
      if (!intervalsByTimbraturaId[timbraturaId]) intervalsByTimbraturaId[timbraturaId] = [];
      intervalsByTimbraturaId[timbraturaId].push(row);
    }

    const timeBudgetByKey = buildTimeBudgetSummaries({
      normalizedRows,
      wanted,
      metaByKey,
      timbratureRows: (timbratureRows || []) as TimeBudgetRow[],
      intervalsByTimbraturaId,
      latestReportOutcomeByKey,
    });
    const timeBudgetCurrentOperatorByKey = buildTimeBudgetSummaries({
      normalizedRows,
      wanted,
      metaByKey,
      timbratureRows: (timbratureRows || []) as TimeBudgetRow[],
      intervalsByTimbraturaId,
      operatoreId: operatore.id,
    });

    return NextResponse.json({
      ok: true,
      meta: metaByKey,
      comments: commentsByKey,
      time_budget: timeBudgetByKey,
      time_budget_current_operator: timeBudgetCurrentOperatorByKey,
    });
  }

  if (action === "set_status") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    const status = cleanPlanningStatus(body?.status);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: "Status non valido" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const payload = {
      status,
      status_updated_at: nowIso,
      status_updated_by_operatore: operatore.id,
      updated_at: nowIso,
      updated_by_operatore: operatore.id,
    };

    const { data, error, metas } = await writeMetaForScope({
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId,
      payload,
      includeBlockLegacy: isSharedBlockKind(rowKind),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: data,
      metas,
    });
  }

  if (action === "complete_activity") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    const esitoAttivita = String(body?.esito_attivita || "").trim().toUpperCase();
    const noteFinali = String(body?.note_finali || "").trim();
    const problemi = cleanText(body?.problemi);
    const materiali = cleanText(body?.materiali);

    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }
    if (!REPORT_OUTCOME_VALUES.has(esitoAttivita)) {
      return NextResponse.json({ error: "Esito attività non valido" }, { status: 400 });
    }
    if (!noteFinali) {
      return NextResponse.json({ error: "Inserisci le note finali dell'attività" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const report: CompletionReportInput = {
      esito_attivita: esitoAttivita as ReportOutcome,
      note_finali: noteFinali,
      problemi,
      materiali,
    };

    const { data: currentMeta, error: currentMetaErr } = await loadExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId
    );

    if (
      currentMetaErr &&
      !String(currentMetaErr.message || "").toLowerCase().includes("cronoprogramma_meta")
    ) {
      return NextResponse.json({ error: currentMetaErr.message }, { status: 500 });
    }

    const { data: currentSlots, error: currentSlotsErr } = await loadCurrentSlotsForActivity(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId
    );

    if (
      currentSlotsErr &&
      !String(currentSlotsErr.message || "").toLowerCase().includes("cronoprogramma_meta_slots")
    ) {
      return NextResponse.json({ error: currentSlotsErr.message }, { status: 500 });
    }

    const payload = {
      fatto: true,
      status: "SVOLTA" as PlanningStatus,
      status_updated_at: nowIso,
      status_updated_by_operatore: operatore.id,
      updated_at: nowIso,
      updated_by_operatore: operatore.id,
    };

    const { data, error, metas } = await writeMetaForScope({
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId,
      payload,
      includeBlockLegacy: isSharedBlockKind(rowKind),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: eventErr } = await supabaseAdmin.from("cronoprogramma_activity_events").insert({
      row_kind: rowKind,
      row_ref_id: rowRefId,
      slot_id: slotId,
      event_type: "COMPLETATO",
      esito_attivita: report.esito_attivita,
      note_finali: report.note_finali,
      problemi: report.problemi,
      materiali: report.materiali,
      old_meta: currentMeta || null,
      old_slots: currentSlots || [],
      created_by_operatore: operatore.id,
      created_at: nowIso,
    });

    if (eventErr) {
      return NextResponse.json({ error: eventErr.message }, { status: 500 });
    }

    const readableCommentCreatedAt = nowIso;
    const structuredCommentCreatedAt = new Date(Date.parse(nowIso) + 1).toISOString();
    const { data: insertedComments, error: commentErr } = await supabaseAdmin
      .from("cronoprogramma_comments")
      .insert([
        {
          row_kind: rowKind,
          row_ref_id: rowRefId,
          slot_id: slotId,
          commento: buildReadableCompletionComment(report),
          created_by_operatore: operatore.id,
          created_at: readableCommentCreatedAt,
        },
        {
          row_kind: rowKind,
          row_ref_id: rowRefId,
          slot_id: slotId,
          commento: buildStructuredReportComment(report),
          created_by_operatore: operatore.id,
          created_at: structuredCommentCreatedAt,
        },
      ])
      .select("id, row_kind, row_ref_id, slot_id, commento, created_at, created_by_operatore, operatore:created_by_operatore(nome)");

    if (commentErr) {
      return NextResponse.json({ error: commentErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: data,
      metas,
      comments: (insertedComments || []).map((row) => mapCommentRow(row)),
    });
  }

  if (action === "reschedule_activity") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const motivoRimando = String(body?.motivo_rimando || "").trim();
    const dataInizio = normalizeOperativiDate(body?.data_inizio);
    if (!motivoRimando) {
      return NextResponse.json({ error: "Inserisci il motivo del rimando" }, { status: 400 });
    }
    if (!dataInizio) {
      return NextResponse.json({ error: "Inserisci la nuova data" }, { status: 400 });
    }

    const durataPrevistaMinuti = cleanNonNegativeInteger(body?.durata_prevista_minuti);
    const rescheduleInput: RescheduleActivityInput = {
      motivo_rimando: motivoRimando,
      ore_previste_label: cleanText(body?.ore_previste_label),
      data_inizio: dataInizio,
      durata_prevista_minuti: durataPrevistaMinuti,
      modalita_attivita: cleanModalitaAttivita(body?.modalita_attivita),
      personale_previsto: cleanText(body?.personale_previsto),
      personale_ids: cleanUuidArray(body?.personale_ids),
      mezzi: cleanText(body?.mezzi),
      descrizione_attivita: cleanText(body?.descrizione_attivita),
      indirizzo: cleanText(body?.indirizzo),
      orario: cleanText(body?.orario),
      referente_cliente_nome: cleanText(body?.referente_cliente_nome),
      referente_cliente_contatto: cleanText(body?.referente_cliente_contatto),
      commerciale_art_tech_nome: cleanText(body?.commerciale_art_tech_nome),
      commerciale_art_tech_contatto: cleanText(body?.commerciale_art_tech_contatto),
    };

    const { data: currentMeta, error: currentMetaErr } = await loadExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId
    );

    if (
      currentMetaErr &&
      !String(currentMetaErr.message || "").toLowerCase().includes("cronoprogramma_meta")
    ) {
      return NextResponse.json({ error: currentMetaErr.message }, { status: 500 });
    }

    const { data: currentSlots, error: currentSlotsErr } = await loadCurrentSlotsForActivity(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId
    );

    if (
      currentSlotsErr &&
      !String(currentSlotsErr.message || "").toLowerCase().includes("cronoprogramma_meta_slots")
    ) {
      return NextResponse.json({ error: currentSlotsErr.message }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const metaPayload = {
      fatto: false,
      hidden: false,
      status: "RIMANDATA" as PlanningStatus,
      status_updated_at: nowIso,
      status_updated_by_operatore: operatore.id,
      ...toOperativiPayload({
        data_inizio: rescheduleInput.data_inizio,
        durata_prevista_minuti: rescheduleInput.durata_prevista_minuti,
        modalita_attivita: rescheduleInput.modalita_attivita,
        personale_previsto: rescheduleInput.personale_previsto,
        personale_ids: rescheduleInput.personale_ids,
        mezzi: rescheduleInput.mezzi,
        descrizione_attivita: rescheduleInput.descrizione_attivita,
        indirizzo: rescheduleInput.indirizzo,
        orario: rescheduleInput.orario,
        referente_cliente_nome: rescheduleInput.referente_cliente_nome,
        referente_cliente_contatto: rescheduleInput.referente_cliente_contatto,
        commerciale_art_tech_nome: rescheduleInput.commerciale_art_tech_nome,
        commerciale_art_tech_contatto: rescheduleInput.commerciale_art_tech_contatto,
      }),
      updated_at: nowIso,
      updated_by_operatore: operatore.id,
    };

    const { data: updatedMetaRow, error: metaErr } = await writeExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId,
      metaPayload
    );

    if (metaErr) {
      return NextResponse.json({ error: metaErr.message }, { status: 500 });
    }

    const currentSlotPosition =
      Number.isFinite(Number((currentSlots || [])[0]?.position)) && Number((currentSlots || [])[0]?.position) >= 0
        ? Number((currentSlots || [])[0]?.position)
        : 0;

    const newSlotPayload = toOperativiSlotPayload(
      {
        data_inizio: rescheduleInput.data_inizio,
        durata_prevista_minuti: rescheduleInput.durata_prevista_minuti,
        personale_previsto: rescheduleInput.personale_previsto,
        personale_ids: rescheduleInput.personale_ids,
        mezzi: rescheduleInput.mezzi,
        descrizione_attivita: rescheduleInput.descrizione_attivita,
        indirizzo: rescheduleInput.indirizzo,
        orario: rescheduleInput.orario,
        referente_cliente_nome: rescheduleInput.referente_cliente_nome,
        referente_cliente_contatto: rescheduleInput.referente_cliente_contatto,
        commerciale_art_tech_nome: rescheduleInput.commerciale_art_tech_nome,
        commerciale_art_tech_contatto: rescheduleInput.commerciale_art_tech_contatto,
      },
      slotId ? currentSlotPosition : 0
    );

    let insertedSlots: any[] = [];
    if (slotId) {
      const { data: insertedSlotRows, error: updateSlotErr } = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .update(newSlotPayload)
        .eq("id", slotId)
        .eq("row_kind", rowKind)
        .eq("row_ref_id", rowRefId)
        .select(
          "id, position, data_inizio, durata_giorni, durata_prevista_minuti, personale_previsto, personale_ids, mezzi, descrizione_attivita, indirizzo, orario, referente_cliente_nome, referente_cliente_contatto, commerciale_art_tech_nome, commerciale_art_tech_contatto"
        )
        .order("position", { ascending: true });
      if (updateSlotErr) {
        return NextResponse.json({ error: updateSlotErr.message }, { status: 500 });
      }
      insertedSlots = (insertedSlotRows || []).map((row) => mapSlotRow(row));
    } else {
      const { error: deleteSlotsErr } = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .delete()
        .eq("row_kind", rowKind)
        .eq("row_ref_id", rowRefId);

      if (deleteSlotsErr) {
        return NextResponse.json({ error: deleteSlotsErr.message }, { status: 500 });
      }

      const { data: insertedSlotRows, error: insertSlotErr } = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .insert([
          {
            row_kind: rowKind,
            row_ref_id: rowRefId,
            ...newSlotPayload,
          },
        ])
        .select(
          "id, position, data_inizio, durata_giorni, durata_prevista_minuti, personale_previsto, personale_ids, mezzi, descrizione_attivita, indirizzo, orario, referente_cliente_nome, referente_cliente_contatto, commerciale_art_tech_nome, commerciale_art_tech_contatto"
        )
        .order("position", { ascending: true });

      if (insertSlotErr) {
        return NextResponse.json({ error: insertSlotErr.message }, { status: 500 });
      }
      insertedSlots = (insertedSlotRows || []).map((row) => mapSlotRow(row));
    }

    if (rowKind === "DISINSTALLAZIONE") {
      let primaryDate = rescheduleInput.data_inizio || null;
      if (slotId) {
        const { data: allDisinstallSlots } = await supabaseAdmin
          .from("cronoprogramma_meta_slots")
          .select("data_inizio")
          .eq("row_kind", rowKind)
          .eq("row_ref_id", rowRefId)
          .order("data_inizio", { ascending: true });
        primaryDate =
          (allDisinstallSlots || [])
            .map((slot: any) => normalizeOperativiDate(slot?.data_inizio))
            .filter(Boolean)[0] || primaryDate;
      }

      const { error: checklistSyncErr } = await supabaseAdmin
        .from("checklists")
        .update({ data_disinstallazione: primaryDate })
        .eq("id", rowRefId);

      if (checklistSyncErr && !isMissingColumnError(checklistSyncErr, "data_disinstallazione")) {
        return NextResponse.json(
          { error: `Errore sync checklists.data_disinstallazione: ${checklistSyncErr.message}` },
          { status: 500 }
        );
      }

      const { error: impiantiSyncErr } = await supabaseAdmin
        .from("checklist_impianti")
        .update({ data_disinstallazione: primaryDate })
        .eq("checklist_id", rowRefId);

      if (impiantiSyncErr && !isMissingColumnError(impiantiSyncErr, "data_disinstallazione")) {
        return NextResponse.json(
          {
            error: `Errore sync checklist_impianti.data_disinstallazione: ${impiantiSyncErr.message}`,
          },
          { status: 500 }
        );
      }
    }

    const mappedMeta = mapMetaRow(updatedMetaRow as any);
    const newMeta = {
      ...mappedMeta,
      slots: insertedSlots,
    };

    const { error: eventErr } = await supabaseAdmin.from("cronoprogramma_activity_events").insert({
      row_kind: rowKind,
      row_ref_id: rowRefId,
      slot_id: slotId,
      event_type: "RIMANDATO",
      motivo_rimando: rescheduleInput.motivo_rimando,
      old_meta: currentMeta || null,
      old_slots: currentSlots || [],
      new_meta: newMeta,
      new_slots: insertedSlots,
      created_by_operatore: operatore.id,
      created_at: nowIso,
    });

    if (eventErr) {
      return NextResponse.json({ error: eventErr.message }, { status: 500 });
    }

    const { data: insertedComment, error: commentErr } = await supabaseAdmin
      .from("cronoprogramma_comments")
      .insert({
        row_kind: rowKind,
        row_ref_id: rowRefId,
        slot_id: slotId,
        commento: buildReadableRescheduleComment(rescheduleInput),
        created_by_operatore: operatore.id,
        created_at: nowIso,
      })
      .select("id, row_kind, row_ref_id, slot_id, commento, created_at, created_by_operatore, operatore:created_by_operatore(nome)")
      .single();

    if (commentErr) {
      return NextResponse.json({ error: commentErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: newMeta,
      comment: mapCommentRow(insertedComment as any),
    });
  }

  if (action === "set_fatto") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    const fatto = Boolean(body?.fatto);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const { data: currentMeta } = await loadExactMetaRow(supabaseAdmin, rowKind, rowRefId, slotId);
    const currentStoredStatus = cleanPlanningStatus((currentMeta as any)?.status);
    const payload = {
      fatto,
      ...(fatto
        ? {
            status: "SVOLTA" as PlanningStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by_operatore: operatore.id,
          }
        : currentStoredStatus === "SVOLTA"
          ? {
              status: "DA_CONFERMARE" as PlanningStatus,
              status_updated_at: new Date().toISOString(),
              status_updated_by_operatore: operatore.id,
            }
          : {}),
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    const { data, error } = await writeExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId,
      payload
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: mapMetaRow(data as any),
    });
  }

  if (action === "set_hidden") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    const hidden = Boolean(body?.hidden);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const payload = {
      hidden,
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    const { data, error } = await writeExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId,
      payload
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: mapMetaRow(data as any),
    });
  }

  if (action === "set_operativi") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const payload = {
      ...toOperativiPayload(body || {}),
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    const { data, error } = await writeExactMetaRow(
      supabaseAdmin,
      rowKind,
      rowRefId,
      slotId,
      payload
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let slotsResponse: any[] | undefined;
    let normalizedSlotsForSync: ReturnType<typeof toOperativiSlotPayload>[] | null = null;
    if (Array.isArray(body?.slots) && !slotId) {
      const { error: deleteSlotsErr } = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .delete()
        .eq("row_kind", rowKind)
        .eq("row_ref_id", rowRefId);

      if (deleteSlotsErr) {
        return NextResponse.json({ error: deleteSlotsErr.message }, { status: 500 });
      }

      const normalizedSlots = (body.slots as unknown[])
        .map((slot, index) =>
          toOperativiSlotPayload(
            slot && typeof slot === "object" ? (slot as OperativiSlotInput) : {},
            index
          )
        );
      normalizedSlotsForSync = normalizedSlots;

      if (normalizedSlots.length > 0) {
        const insertPayload = normalizedSlots.map((slot) => ({
          row_kind: rowKind,
          row_ref_id: rowRefId,
          ...slot,
        }));

        const { data: insertedSlots, error: insertSlotsErr } = await supabaseAdmin
          .from("cronoprogramma_meta_slots")
          .insert(insertPayload)
          .select(
            "id, position, data_inizio, durata_prevista_minuti, personale_previsto, personale_ids, mezzi, descrizione_attivita, indirizzo, orario, referente_cliente_nome, referente_cliente_contatto, commerciale_art_tech_nome, commerciale_art_tech_contatto"
          )
          .order("position", { ascending: true });

        if (insertSlotsErr) {
          return NextResponse.json({ error: insertSlotsErr.message }, { status: 500 });
        }

        slotsResponse = (insertedSlots || []).map((row) => mapSlotRow(row));
      } else {
        slotsResponse = [];
      }
    } else if (slotId) {
      const { data: currentSlotRows, error: currentSlotErr } = await loadCurrentSlotsForActivity(
        supabaseAdmin,
        rowKind,
        rowRefId,
        slotId
      );
      if (
        currentSlotErr &&
        !String(currentSlotErr.message || "").toLowerCase().includes("cronoprogramma_meta_slots")
      ) {
        return NextResponse.json({ error: currentSlotErr.message }, { status: 500 });
      }

      const currentSlotPosition =
        Number.isFinite(Number((currentSlotRows || [])[0]?.position)) &&
        Number((currentSlotRows || [])[0]?.position) >= 0
          ? Number((currentSlotRows || [])[0]?.position)
          : 0;
      const slotPayload = toOperativiSlotPayload(body || {}, currentSlotPosition);
      const { data: updatedSlotRows, error: updateSlotErr } = await supabaseAdmin
        .from("cronoprogramma_meta_slots")
        .update(slotPayload)
        .eq("id", slotId)
        .eq("row_kind", rowKind)
        .eq("row_ref_id", rowRefId)
        .select(
          "id, position, data_inizio, durata_prevista_minuti, personale_previsto, personale_ids, mezzi, descrizione_attivita, indirizzo, orario, referente_cliente_nome, referente_cliente_contatto, commerciale_art_tech_nome, commerciale_art_tech_contatto"
        )
        .order("position", { ascending: true });

      if (updateSlotErr) {
        return NextResponse.json({ error: updateSlotErr.message }, { status: 500 });
      }

      slotsResponse = (updatedSlotRows || []).map((row) => mapSlotRow(row));
    }

    if (rowKind === "DISINSTALLAZIONE") {
      let primaryDate =
        normalizedSlotsForSync?.find((slot) => String(slot.data_inizio || "").trim())?.data_inizio ||
        normalizeOperativiDate(body?.data_inizio) ||
        null;

      if (slotId) {
        const { data: allDisinstallSlots } = await supabaseAdmin
          .from("cronoprogramma_meta_slots")
          .select("data_inizio")
          .eq("row_kind", rowKind)
          .eq("row_ref_id", rowRefId)
          .order("data_inizio", { ascending: true });
        primaryDate =
          (allDisinstallSlots || [])
            .map((slot: any) => normalizeOperativiDate(slot?.data_inizio))
            .filter(Boolean)[0] || primaryDate;
      }

      const { error: checklistSyncErr } = await supabaseAdmin
        .from("checklists")
        .update({ data_disinstallazione: primaryDate })
        .eq("id", rowRefId);

      if (checklistSyncErr && !isMissingColumnError(checklistSyncErr, "data_disinstallazione")) {
        return NextResponse.json(
          { error: `Errore sync checklists.data_disinstallazione: ${checklistSyncErr.message}` },
          { status: 500 }
        );
      }

      const { error: impiantiSyncErr } = await supabaseAdmin
        .from("checklist_impianti")
        .update({ data_disinstallazione: primaryDate })
        .eq("checklist_id", rowRefId);

      if (impiantiSyncErr && !isMissingColumnError(impiantiSyncErr, "data_disinstallazione")) {
        return NextResponse.json(
          {
            error: `Errore sync checklist_impianti.data_disinstallazione: ${impiantiSyncErr.message}`,
          },
          { status: 500 }
        );
      }
    }

    let referentiResponse: any[] | undefined;
    if (Array.isArray(body?.referenti_cliente)) {
      const { error: deleteReferentiErr } = await supabaseAdmin
        .from("cronoprogramma_meta_referenti")
        .delete()
        .eq("row_kind", rowKind)
        .eq("row_ref_id", rowRefId);

      if (deleteReferentiErr) {
        return NextResponse.json({ error: deleteReferentiErr.message }, { status: 500 });
      }

      const normalizedReferenti = (body.referenti_cliente as unknown[])
        .map((referente, index) =>
          toReferentePayload(
            referente && typeof referente === "object" ? (referente as OperativiReferenteInput) : {},
            index
          )
        )
        .filter((referente) => referente.nome || referente.contatto || referente.ruolo);

      if (normalizedReferenti.length > 0) {
        const insertPayload = normalizedReferenti.map((referente) => ({
          row_kind: rowKind,
          row_ref_id: rowRefId,
          ...referente,
        }));

        const { data: insertedReferenti, error: insertReferentiErr } = await supabaseAdmin
          .from("cronoprogramma_meta_referenti")
          .insert(insertPayload)
          .select("id, nome, contatto, ruolo, position")
          .order("position", { ascending: true });

        if (insertReferentiErr) {
          return NextResponse.json({ error: insertReferentiErr.message }, { status: 500 });
        }

        referentiResponse = (insertedReferenti || []).map((row) => mapReferenteRow(row));
      } else {
        referentiResponse = [];
      }
    }

    return NextResponse.json({
      ok: true,
      meta: {
        ...mapMetaRow(data as any),
        ...(slotsResponse ? { slots: slotsResponse } : {}),
        ...(referentiResponse ? { referenti_cliente: referentiResponse } : {}),
      },
    });
  }

  if (action === "start_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    let existingOpenQuery = supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_CORSO")
      .order("created_at", { ascending: false })
      .limit(1);
    existingOpenQuery = applyExactSlotFilter(existingOpenQuery, slotId);
    const { data: existingOpen, error: existingErr } = await existingOpenQuery.maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    if (existingOpen?.id) {
      return NextResponse.json({ error: "Timbratura già in corso per questa attività" }, { status: 409 });
    }

    let personaleId: string | null = null;
    try {
      personaleId = await loadOperatorePersonaleId(supabaseAdmin, operatore.id);
    } catch (err: any) {
      return NextResponse.json({ error: String(err?.message || "Errore caricamento personale operatore") }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const { data: createdTimbratura, error } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .insert({
        row_kind: rowKind,
        row_ref_id: rowRefId,
        slot_id: slotId,
        operatore_id: operatore.id,
        personale_id: personaleId,
        started_at: nowIso,
        stato: "IN_CORSO",
        updated_at: nowIso,
      })
      .select("id")
      .single();

    if (error || !createdTimbratura?.id) {
      return NextResponse.json({ error: error?.message || "Timbratura non creata" }, { status: 500 });
    }

    const { error: createIntervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .insert({
        timbratura_id: createdTimbratura.id,
        started_at: nowIso,
      });

    if (createIntervalErr) {
      await supabaseAdmin.from("cronoprogramma_timbrature").delete().eq("id", createdTimbratura.id);
      return NextResponse.json({ error: createIntervalErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "pause_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    let openTimbraturaQuery = supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id, started_at")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_CORSO")
      .order("created_at", { ascending: false })
      .limit(1);
    openTimbraturaQuery = applyExactSlotFilter(openTimbraturaQuery, slotId);
    const { data: openTimbratura, error: openErr } = await openTimbraturaQuery.maybeSingle();

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }
    if (!openTimbratura?.id) {
      return NextResponse.json({ error: "Nessuna attività in corso da mettere in pausa" }, { status: 404 });
    }

    const { data: openInterval, error: intervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .select("id, started_at")
      .eq("timbratura_id", openTimbratura.id)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intervalErr) {
      return NextResponse.json({ error: intervalErr.message }, { status: 500 });
    }
    const now = new Date();
    const intervalStartedAt = String(openInterval?.started_at || openTimbratura.started_at || "").trim();
    if (!intervalStartedAt) {
      return NextResponse.json({ error: "Nessun intervallo attivo da mettere in pausa" }, { status: 404 });
    }

    const startedAt = new Date(intervalStartedAt);
    const durationMinutes = Number.isFinite(startedAt.getTime())
      ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000))
      : 0;

    const closeIntervalErr = openInterval?.id
      ? (
          await supabaseAdmin
            .from("cronoprogramma_timbrature_intervalli")
            .update({
              ended_at: now.toISOString(),
              durata_minuti: durationMinutes,
            })
            .eq("id", openInterval.id)
        ).error
      : (
          await supabaseAdmin
            .from("cronoprogramma_timbrature_intervalli")
            .insert({
              timbratura_id: openTimbratura.id,
              started_at: intervalStartedAt,
              ended_at: now.toISOString(),
              durata_minuti: durationMinutes,
            })
        ).error;

    if (closeIntervalErr) {
      return NextResponse.json({ error: closeIntervalErr.message }, { status: 500 });
    }

    const { error: pauseErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .update({
        stato: "IN_PAUSA",
        updated_at: now.toISOString(),
      })
      .eq("id", openTimbratura.id);

    if (pauseErr) {
      return NextResponse.json({ error: pauseErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "resume_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    let pausedTimbraturaQuery = supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_PAUSA")
      .order("created_at", { ascending: false })
      .limit(1);
    pausedTimbraturaQuery = applyExactSlotFilter(pausedTimbraturaQuery, slotId);
    const { data: pausedTimbratura, error: pausedErr } = await pausedTimbraturaQuery.maybeSingle();

    if (pausedErr) {
      return NextResponse.json({ error: pausedErr.message }, { status: 500 });
    }
    if (!pausedTimbratura?.id) {
      return NextResponse.json({ error: "Nessuna attività in pausa da riprendere" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const { error: createIntervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .insert({
        timbratura_id: pausedTimbratura.id,
        started_at: nowIso,
      });

    if (createIntervalErr) {
      return NextResponse.json({ error: createIntervalErr.message }, { status: 500 });
    }

    const { error: resumeErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .update({
        stato: "IN_CORSO",
        updated_at: nowIso,
      })
      .eq("id", pausedTimbratura.id);

    if (resumeErr) {
      return NextResponse.json({ error: resumeErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "stop_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    let openTimbraturaQuery = supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id, started_at")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_CORSO")
      .order("created_at", { ascending: false })
      .limit(1);
    openTimbraturaQuery = applyExactSlotFilter(openTimbraturaQuery, slotId);
    const { data: openTimbratura, error: openErr } = await openTimbraturaQuery.maybeSingle();

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }
    if (!openTimbratura?.id) {
      return NextResponse.json({ error: "Nessuna timbratura aperta per questa attività" }, { status: 404 });
    }

    const { data: openInterval, error: intervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .select("id, started_at")
      .eq("timbratura_id", openTimbratura.id)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intervalErr) {
      return NextResponse.json({ error: intervalErr.message }, { status: 500 });
    }

    const now = new Date();
    const intervalStartedAt = String(openInterval?.started_at || openTimbratura.started_at || "").trim();
    const startedAt = new Date(intervalStartedAt);
    const durationMinutes = Number.isFinite(startedAt.getTime())
      ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000))
      : 0;

    if (intervalStartedAt) {
      const closeIntervalErr = openInterval?.id
        ? (
            await supabaseAdmin
              .from("cronoprogramma_timbrature_intervalli")
              .update({
                ended_at: now.toISOString(),
                durata_minuti: durationMinutes,
              })
              .eq("id", openInterval.id)
          ).error
        : (
            await supabaseAdmin
              .from("cronoprogramma_timbrature_intervalli")
              .insert({
                timbratura_id: openTimbratura.id,
                started_at: intervalStartedAt,
                ended_at: now.toISOString(),
                durata_minuti: durationMinutes,
              })
          ).error;

      if (closeIntervalErr) {
        return NextResponse.json({ error: closeIntervalErr.message }, { status: 500 });
      }
    }

    const { error } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .update({
        ended_at: now.toISOString(),
        stato: "COMPLETATA",
        durata_effettiva_minuti: durationMinutes,
        updated_at: now.toISOString(),
      })
      .eq("id", openTimbratura.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let activityState: "COMPLETATA" | "NON_INIZIATA" = "COMPLETATA";
    const rawReport = body?.report && typeof body.report === "object" ? body.report : null;
    if (rawReport) {
      const esito = String((rawReport as any).esito || "").trim().toUpperCase();
      const problemi = String((rawReport as any).problemi || "").trim();
      const materiali = String((rawReport as any).materiali || "").trim();
      const noteFinali = String((rawReport as any).note_finali || "").trim();
      const hasReportContent = Boolean(esito || problemi || materiali || noteFinali);

      if (hasReportContent) {
        if (!REPORT_OUTCOME_VALUES.has(esito)) {
          return NextResponse.json({ error: "Esito report non valido" }, { status: 400 });
        }

        activityState = esito === "COMPLETATO" ? "COMPLETATA" : "NON_INIZIATA";

        const reportComment = `${REPORT_COMMENT_PREFIX}${JSON.stringify({
          esito,
          problemi,
          materiali,
          note_finali: noteFinali,
        })}`;

        const { error: reportErr } = await supabaseAdmin.from("cronoprogramma_comments").insert({
          row_kind: rowKind,
          row_ref_id: rowRefId,
          slot_id: slotId,
          commento: reportComment,
          created_by_operatore: operatore.id,
        });

        if (reportErr) {
          return NextResponse.json({ error: reportErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      durata_effettiva_minuti: durationMinutes,
      activity_state: activityState,
    });
  }

  if (action === "set_tempo_reale") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    const durataEffettivaMinuti = cleanNonNegativeInteger(body?.durata_effettiva_minuti);
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }
    if (!Number.isFinite(Number(durataEffettivaMinuti)) || Number(durataEffettivaMinuti) <= 0) {
      return NextResponse.json({ error: "Tempo reale non valido" }, { status: 400 });
    }

    let openTimbratureQuery = supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .in("stato", ["IN_CORSO", "IN_PAUSA"]);
    openTimbratureQuery = applyExactSlotFilter(openTimbratureQuery, slotId);
    const { data: openTimbrature, error: openErr } = await openTimbratureQuery;

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }
    if ((openTimbrature || []).length > 0) {
      return NextResponse.json(
        { error: "Chiudi prima eventuali timbrature attive o in pausa" },
        { status: 409 }
      );
    }

    let personaleId: string | null = null;
    try {
      personaleId = await loadOperatorePersonaleId(supabaseAdmin, operatore.id);
    } catch (err: any) {
      return NextResponse.json(
        { error: String(err?.message || "Errore caricamento personale operatore") },
        { status: 500 }
      );
    }

    const now = new Date();
    const startedAt = new Date(now.getTime() - Number(durataEffettivaMinuti) * 60000).toISOString();
    const endedAt = now.toISOString();

    const { data: createdTimbratura, error: insertErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .insert({
        row_kind: rowKind,
        row_ref_id: rowRefId,
        slot_id: slotId,
        operatore_id: operatore.id,
        personale_id: personaleId,
        started_at: startedAt,
        ended_at: endedAt,
        stato: "COMPLETATA",
        durata_effettiva_minuti: Number(durataEffettivaMinuti),
        updated_at: endedAt,
      })
      .select("id")
      .single();

    if (insertErr || !createdTimbratura?.id) {
      return NextResponse.json(
        { error: insertErr?.message || "Tempo reale non salvato" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      durata_effettiva_minuti: Number(durataEffettivaMinuti),
      activity_state: "COMPLETATA",
    });
  }

  if (action === "add_comment") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const slotId = cleanOptionalUuid(body?.slot_id);
    const commento = String(body?.commento || "").trim();
    if (!isValidRowKind(rowKind) || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }
    if (!commento) {
      return NextResponse.json({ error: "Commento vuoto" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("cronoprogramma_comments")
      .insert({
        row_kind: rowKind,
        row_ref_id: rowRefId,
        slot_id: slotId,
        commento,
        created_by_operatore: operatore.id,
      })
      .select("id, row_kind, row_ref_id, slot_id, commento, created_at, created_by_operatore, operatore:created_by_operatore(nome)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!(data as any)?.id) {
      return NextResponse.json({ error: "Commento non salvato" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      comment: mapCommentRow(data as any),
    });
  }

  if (action === "delete_comment") {
    const commentId = String(body?.comment_id || "").trim();
    if (!commentId) {
      return NextResponse.json({ error: "comment_id mancante" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("cronoprogramma_comments").delete().eq("id", commentId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comment_id: commentId });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
