export type PersonaleSelectionOption = {
  id: string;
  label: string;
  display: string;
  search: string;
};

export type ResolvedPersonaleSelection = {
  selectedIds: string[];
  unresolvedLegacyTokens: string[];
  displayValue: string;
};

export function normalizePersonaleSearchText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitLegacyPersonaleValue(value?: string | null) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[;\n,|]+/g)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function findOptionByLegacyToken(token: string, options: PersonaleSelectionOption[]) {
  const normalized = normalizePersonaleSearchText(token);
  if (!normalized) return null;
  return (
    options.find((option) => normalizePersonaleSearchText(option.label) === normalized) ||
    options.find((option) => normalized.includes(normalizePersonaleSearchText(option.label))) ||
    options.find((option) => normalizePersonaleSearchText(option.search).includes(normalized)) ||
    null
  );
}

export function buildPersonaleDisplayValue(
  selectedIds: string[],
  options: PersonaleSelectionOption[],
  unresolvedLegacyTokens: string[] = []
) {
  const labels = selectedIds
    .map((id) => options.find((option) => option.id === id)?.label || "")
    .filter(Boolean);
  return [...labels, ...unresolvedLegacyTokens].join("; ");
}

export function resolvePersonaleSelection(
  selectedIds: string[] | null | undefined,
  legacyValue: string | null | undefined,
  options: PersonaleSelectionOption[]
): ResolvedPersonaleSelection {
  const nextIds = Array.from(new Set((selectedIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  const unresolvedLegacyTokens: string[] = [];
  for (const token of splitLegacyPersonaleValue(legacyValue)) {
    const match = findOptionByLegacyToken(token, options);
    if (match) {
      if (!nextIds.includes(match.id)) nextIds.push(match.id);
    } else {
      unresolvedLegacyTokens.push(token);
    }
  }
  return {
    selectedIds: nextIds,
    unresolvedLegacyTokens,
    displayValue: buildPersonaleDisplayValue(nextIds, options, unresolvedLegacyTokens),
  };
}

export function arraysEqualAsSets(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}
