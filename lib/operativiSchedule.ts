function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export const OPERATIVI_STANDARD_DAY_MINUTES = 8 * 60;

function formatIsoDayParts(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function dateToOperativiIsoDay(value: Date) {
  return formatIsoDayParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

export function normalizeOperativiDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return "";
  return dateToOperativiIsoDay(dt);
}

export function normalizeOperativiDuration(value?: string | number | null) {
  const raw = typeof value === "number" ? value : Number(String(value || "").trim());
  if (!Number.isFinite(raw)) return null;
  const normalized = Math.max(1, Math.floor(raw));
  return normalized;
}

export function getOperativiDurationDays(value?: string | number | null) {
  return normalizeOperativiDuration(value) ?? 1;
}

export function durationToInputValue(value?: string | number | null) {
  const normalized = normalizeOperativiDuration(value);
  return normalized == null ? "" : String(normalized);
}

function trimTrailingZeros(value: number) {
  return String(Math.round(value * 100) / 100)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function hoursInputToMinutes(value?: string | number | null) {
  const hours = Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
}

export function minutesToHoursInput(value?: number | null) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) return "";
  return trimTrailingZeros(Number(value) / 60);
}

export function estimatedMinutesToLegacyDays(value?: number | null) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return null;
  return Math.max(1, Math.ceil(Number(value) / OPERATIVI_STANDARD_DAY_MINUTES));
}

export function getOperativiEstimatedMinutes(value?: {
  durata_prevista_minuti?: string | number | null;
  durata_giorni?: string | number | null;
} | null) {
  const minutes = Number(value?.durata_prevista_minuti);
  if (Number.isFinite(minutes) && minutes >= 0) return Math.round(minutes);
  const days = normalizeOperativiDuration(value?.durata_giorni);
  return days == null ? null : days * OPERATIVI_STANDARD_DAY_MINUTES;
}

export function computeOperativiEndDate(
  dataInizio?: string | null,
  durataGiorni?: string | number | null
) {
  const start = normalizeOperativiDate(dataInizio);
  if (!start) return "";
  const duration = getOperativiDurationDays(durataGiorni);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!parts) return "";
  const dt = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  dt.setUTCDate(dt.getUTCDate() + duration - 1);
  return formatIsoDayParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function formatOperativiDateLabel(value?: string | null, locale = "it-IT") {
  const iso = normalizeOperativiDate(value);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return "";
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])))
  );
}

export function buildOperativiSchedule(
  explicitStart?: string | null,
  fallbackStart?: string | null,
  durataGiorni?: string | number | null
) {
  const data_inizio = normalizeOperativiDate(explicitStart) || normalizeOperativiDate(fallbackStart);
  const durata_giorni = getOperativiDurationDays(durataGiorni);
  const data_fine = computeOperativiEndDate(data_inizio, durata_giorni);
  return {
    data_inizio,
    durata_giorni,
    data_fine,
  };
}
