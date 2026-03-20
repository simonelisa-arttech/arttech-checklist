export function normalizeOperativiDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
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

export function computeOperativiEndDate(
  dataInizio?: string | null,
  durataGiorni?: string | number | null
) {
  const start = normalizeOperativiDate(dataInizio);
  if (!start) return "";
  const duration = getOperativiDurationDays(durataGiorni);
  const dt = new Date(`${start}T00:00:00`);
  dt.setDate(dt.getDate() + duration - 1);
  return dt.toISOString().slice(0, 10);
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
