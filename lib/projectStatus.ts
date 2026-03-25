export type RawProjectStatus =
  | "IN_CORSO"
  | "CONSEGNATO"
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
