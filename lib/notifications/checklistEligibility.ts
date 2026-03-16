export type ChecklistEligibilityRow = {
  stato_progetto?: string | null;
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

export function isChecklistProjectInCorso(checklist: ChecklistEligibilityRow) {
  return String(checklist.stato_progetto || "").trim().toUpperCase() === "IN_CORSO";
}

export function isChecklistEligibleFromToday(
  checklist: ChecklistEligibilityRow,
  todayRome: string
) {
  if (!isChecklistProjectInCorso(checklist)) return false;
  const effectiveDate = getChecklistEligibilityDate(checklist);
  return Boolean(effectiveDate && effectiveDate >= todayRome);
}
