type TimelineLikeRow = {
  data_prevista?: string | null;
  data_tassativa?: string | null;
  fatto?: boolean | null;
};

type TimelineLikeMeta = {
  fatto?: boolean | null;
};

function normalizeToDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function parseIsoDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(date.getTime())) return null;
  return normalizeToDay(date);
}

export function isTimelineRowOverdueNotDone(
  row: TimelineLikeRow,
  meta?: TimelineLikeMeta | null,
  todayArg?: Date
) {
  const fatto = Boolean(meta?.fatto ?? row.fatto);
  if (fatto) return false;

  const today = normalizeToDay(todayArg ? new Date(todayArg) : new Date());

  const prevista = parseIsoDateOnly(row.data_prevista);
  const tassativa = parseIsoDateOnly(row.data_tassativa);
  if (!prevista && !tassativa) return false;

  return Boolean(
    (prevista && prevista.getTime() < today.getTime()) ||
      (tassativa && tassativa.getTime() < today.getTime())
  );
}
