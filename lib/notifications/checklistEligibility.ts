export type ChecklistEligibilityRow = {
  data_installazione_reale?: string | null;
  data_tassativa?: string | null;
  data_prevista?: string | null;
};

export function toIsoDay(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "";
}

export function getChecklistEligibilityDate(checklist: ChecklistEligibilityRow) {
  return (
    toIsoDay(checklist.data_installazione_reale) ||
    toIsoDay(checklist.data_tassativa) ||
    toIsoDay(checklist.data_prevista)
  );
}

export function isChecklistEligibleFromToday(
  checklist: ChecklistEligibilityRow,
  todayRome: string
) {
  const effectiveDate = getChecklistEligibilityDate(checklist);
  return Boolean(effectiveDate && effectiveDate >= todayRome);
}
