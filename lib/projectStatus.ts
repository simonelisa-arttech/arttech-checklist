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

export type ProjectFilterValue =
  | ProjectDisplayStatus
  | "MERCE_RIENTRATA_SENZA_DANNI"
  | "MERCE_RIENTRATA_CON_DANNI";

export type ProjectFilterOption = {
  value: ProjectFilterValue;
  label: string;
  kindScope?: "ALL" | "NOLEGGIO" | "VENDITA";
  storageValue?: RawProjectStatus;
  allowWhenClosedOnly?: boolean;
};

export const PROJECT_STATUS_FILTER_OPTIONS: Record<
  "compactDashboard" | "projectEdit",
  readonly ProjectFilterOption[]
> = {
  compactDashboard: [
    { value: "IN_LAVORAZIONE", label: "IN_LAVORAZIONE", kindScope: "ALL" },
    { value: "NOLEGGIO_IN_CORSO", label: "NOLEGGIO_IN_CORSO", kindScope: "NOLEGGIO" },
    { value: "CONSEGNATO", label: "CONSEGNATO", kindScope: "ALL" },
    { value: "MERCE_RIENTRATA_SENZA_DANNI", label: "MERCE_RIENTRATA_SENZA_DANNI", kindScope: "NOLEGGIO" },
    { value: "MERCE_RIENTRATA_CON_DANNI", label: "MERCE_RIENTRATA_CON_DANNI", kindScope: "NOLEGGIO" },
    { value: "RIENTRATO", label: "RIENTRATO", kindScope: "ALL" },
    { value: "OPERATIVO", label: "OPERATIVO", kindScope: "ALL" },
    { value: "SOSPESO", label: "SOSPESO", kindScope: "ALL" },
    { value: "CHIUSO", label: "CHIUSO", kindScope: "ALL" },
  ],
  projectEdit: [
    { value: "IN_LAVORAZIONE", label: "IN_LAVORAZIONE", kindScope: "ALL", storageValue: "IN_CORSO" },
    { value: "CONSEGNATO", label: "CONSEGNATO", kindScope: "ALL", storageValue: "CONSEGNATO" },
    { value: "RIENTRATO", label: "RIENTRATO", kindScope: "ALL", storageValue: "RIENTRATO" },
    { value: "OPERATIVO", label: "OPERATIVO", kindScope: "ALL", storageValue: "OPERATIVO" },
    { value: "SOSPESO", label: "SOSPESO", kindScope: "ALL", storageValue: "SOSPESO" },
    {
      value: "CHIUSO",
      label: "CHIUSO",
      kindScope: "ALL",
      storageValue: "CHIUSO",
      allowWhenClosedOnly: true,
    },
  ],
};

export function getProjectStatusOptionsForContext(
  context: keyof typeof PROJECT_STATUS_FILTER_OPTIONS,
  options?: { projectKind?: ProjectKind | null; allowClosed?: boolean }
) {
  const projectKind = options?.projectKind ?? null;
  const allowClosed = options?.allowClosed ?? false;
  return PROJECT_STATUS_FILTER_OPTIONS[context].filter((option) => {
    if (option.allowWhenClosedOnly && !allowClosed) return false;
    if (option.kindScope && option.kindScope !== "ALL" && projectKind && option.kindScope !== projectKind) {
      return false;
    }
    return true;
  });
}

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
  noleggio_vendita?: string | null;
  data_prevista?: string | null;
  data_inizio?: string | null;
  fine_noleggio?: string | null;
  data_fine_noleggio?: string | null;
  data_disinstallazione?: string | null;
}): RawProjectStatus | null {
  const raw = normalizeProjectStatusValue(input.stato_progetto);
  const isClosed =
    input.checklistCompleted === true || isChecklistOperativaCompletedFromPercent(input.pct_complessivo);
  const projectKind: ProjectKind = isNoleggioValue(input.noleggio_vendita) ? "NOLEGGIO" : "VENDITA";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venditaDate = parseLocalDay(input.data_prevista);
  const noleggioStart = parseLocalDay(input.data_inizio) || parseLocalDay(input.data_prevista);
  const noleggioEnd =
    parseLocalDay(input.data_fine_noleggio) ||
    parseLocalDay(input.fine_noleggio) ||
    parseLocalDay(input.data_disinstallazione);

  if (isClosed) return "CHIUSO";
  if (raw === "RIENTRATO") return "RIENTRATO";
  if (raw === "CHIUSO") return "OPERATIVO";
  if (raw === "IN_CORSO") {
    if (projectKind === "VENDITA" && venditaDate && venditaDate <= today) {
      return "OPERATIVO";
    }
    if (
      projectKind === "NOLEGGIO" &&
      noleggioStart &&
      noleggioEnd &&
      noleggioStart <= today &&
      today <= noleggioEnd
    ) {
      return "IN_CORSO";
    }
  }
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
  data_prevista?: string | null;
  data_inizio?: string | null;
  fine_noleggio?: string | null;
  data_fine_noleggio?: string | null;
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
  const noleggioStart = parseLocalDay(input.data_inizio) || parseLocalDay(input.data_prevista);
  const disinstallazione =
    parseLocalDay(input.data_fine_noleggio) ||
    parseLocalDay(input.fine_noleggio) ||
    parseLocalDay(input.data_disinstallazione);
  const isNoleggioInCorso =
    projectKind === "NOLEGGIO" &&
    effectiveStatus !== "CHIUSO" &&
    effectiveStatus !== "RIENTRATO" &&
    raw !== "ANNULLATO" &&
    noleggioStart != null &&
    disinstallazione != null &&
    noleggioStart <= today &&
    today <= disinstallazione &&
    (effectiveStatus === "CONSEGNATO" ||
      effectiveStatus === "IN_CORSO" ||
      raw === "NOLEGGIO_ATTIVO" ||
      raw === "NOLEGGIO_IN_CORSO");

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
