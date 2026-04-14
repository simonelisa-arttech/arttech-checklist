export type RawProjectStatus =
  | "IN_CORSO"
  | "CONSEGNATO"
  | "RIENTRATO"
  | "SOSPESO"
  | "OPERATIVO"
  | "CHIUSO";

export type ProjectKind = "VENDITA" | "NOLEGGIO";
export type ProjectDisplayStatus =
  | "IN_LAVORAZIONE"
  | "CONSEGNATO"
  | "NOLEGGIO_IN_CORSO"
  | "RIENTRATO"
  | "SOSPESO"
  | "OPERATIVO"
  | "CHIUSO";

type TaskLike = {
  stato?: string | null;
};

function normalizeUpper(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function parseLocalDay(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    dt.setHours(0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function isNoleggioValue(value?: string | null) {
  return normalizeUpper(value) === "NOLEGGIO";
}

export function normalizeProjectStatusValue(value?: string | null): RawProjectStatus | null {
  const raw = normalizeUpper(value);
  if (!raw) return null;
  if (raw === "IN_LAVORAZIONE") return "IN_CORSO";
  if (raw === "IN_CORSO") return "IN_CORSO";
  if (raw === "CONSEGNATO") return "CONSEGNATO";
  if (raw === "RIENTRATO") return "RIENTRATO";
  if (raw === "SOSPESO") return "SOSPESO";
  if (raw === "OPERATIVO") return "OPERATIVO";
  if (raw === "CHIUSO") return "CHIUSO";
  return null;
}

export function isChecklistTaskCompleted(stato?: string | null) {
  const normalized = normalizeUpper(stato);
  return normalized === "OK" || normalized === "NON_NECESSARIO";
}

export function isChecklistOperativaCompletedFromTasks(tasks: TaskLike[]) {
  if (!Array.isArray(tasks) || tasks.length === 0) return false;
  return tasks.every((task) => isChecklistTaskCompleted(task?.stato));
}

export function isChecklistOperativaCompletedFromPercent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 100;
}

export function getEffectiveProjectStatus(input: {
  stato_progetto?: string | null;
  checklistCompleted?: boolean;
  pct_complessivo?: number | null;
}): RawProjectStatus | null {
  const raw = normalizeProjectStatusValue(input.stato_progetto);
  const isClosed =
    input.checklistCompleted === true || isChecklistOperativaCompletedFromPercent(input.pct_complessivo);

  if (isClosed) return "CHIUSO";
  if (raw === "CHIUSO") return "OPERATIVO";
  return raw;
}

export function normalizeProjectStatusForStorage(
  value?: string | null,
  options?: { checklistCompleted?: boolean; pct_complessivo?: number | null }
): RawProjectStatus | null {
  const raw = normalizeProjectStatusValue(value);
  if (!raw) return null;
  const isClosed =
    options?.checklistCompleted === true ||
    isChecklistOperativaCompletedFromPercent(options?.pct_complessivo);

  if (raw === "CHIUSO" && !isClosed) return "OPERATIVO";
  return raw;
}

export function getProjectPresentation(input: {
  stato_progetto?: string | null;
  checklistCompleted?: boolean;
  pct_complessivo?: number | null;
  noleggio_vendita?: string | null;
  data_disinstallazione?: string | null;
}): {
  effectiveStatus: RawProjectStatus | null;
  displayStatus: ProjectDisplayStatus | null;
  projectKind: ProjectKind;
  isNoleggioInCorso: boolean;
} {
  const effectiveStatus = getEffectiveProjectStatus(input);
  const raw = normalizeUpper(input.stato_progetto);
  const projectKind: ProjectKind = isNoleggioValue(input.noleggio_vendita) ? "NOLEGGIO" : "VENDITA";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const disinstallazione = parseLocalDay(input.data_disinstallazione);
  const isNoleggioInCorso =
    projectKind === "NOLEGGIO" &&
    effectiveStatus !== "CHIUSO" &&
    raw !== "ANNULLATO" &&
    (disinstallazione == null || disinstallazione >= today) &&
    (effectiveStatus === "CONSEGNATO" || raw === "NOLEGGIO_ATTIVO" || raw === "NOLEGGIO_IN_CORSO");

  const displayStatus: ProjectDisplayStatus | null = isNoleggioInCorso
    ? "NOLEGGIO_IN_CORSO"
    : effectiveStatus === "IN_CORSO"
      ? "IN_LAVORAZIONE"
      : effectiveStatus;

  return {
    effectiveStatus,
    displayStatus,
    projectKind,
    isNoleggioInCorso,
  };
}
