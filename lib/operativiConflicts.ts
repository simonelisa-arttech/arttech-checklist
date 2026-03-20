import { normalizeOperativiDate } from "@/lib/operativiSchedule";

export type OperativiConflictEvent = {
  key: string;
  start: string;
  end: string;
  personale?: string | null;
  mezzi?: string | null;
};

export type OperativiConflictResult = {
  hasConflict: boolean;
  conflictDetails: {
    personale: string[];
    mezzi: string[];
  };
};

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitOperativiResources(value?: string | null) {
  return String(value || "")
    .split(/[\n,;+\/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectSharedResources(left?: string | null, right?: string | null) {
  const rightMap = new Map<string, string>();
  for (const item of splitOperativiResources(right)) {
    const normalized = normalizeToken(item);
    if (normalized && !rightMap.has(normalized)) {
      rightMap.set(normalized, item);
    }
  }
  const shared = new Map<string, string>();
  for (const item of splitOperativiResources(left)) {
    const normalized = normalizeToken(item);
    if (!normalized) continue;
    if (rightMap.has(normalized)) {
      shared.set(normalized, item);
    }
  }
  return Array.from(shared.values());
}

function rangesOverlap(
  leftStart?: string | null,
  leftEnd?: string | null,
  rightStart?: string | null,
  rightEnd?: string | null
) {
  const aStart = normalizeOperativiDate(leftStart);
  const aEnd = normalizeOperativiDate(leftEnd);
  const bStart = normalizeOperativiDate(rightStart);
  const bEnd = normalizeOperativiDate(rightEnd);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

export function checkOperativiConflicts(events: OperativiConflictEvent[]) {
  const byKey: Record<string, OperativiConflictResult> = {};
  for (const event of events) {
    byKey[event.key] = {
      hasConflict: false,
      conflictDetails: { personale: [], mezzi: [] },
    };
  }

  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    for (let compareIndex = index + 1; compareIndex < events.length; compareIndex += 1) {
      const other = events[compareIndex];
      if (!rangesOverlap(current.start, current.end, other.start, other.end)) continue;

      const personaleShared = collectSharedResources(current.personale, other.personale);
      const mezziShared = collectSharedResources(current.mezzi, other.mezzi);
      if (!personaleShared.length && !mezziShared.length) continue;

      const currentResult = byKey[current.key];
      const otherResult = byKey[other.key];
      currentResult.hasConflict = true;
      otherResult.hasConflict = true;

      currentResult.conflictDetails.personale = Array.from(
        new Set([...currentResult.conflictDetails.personale, ...personaleShared])
      );
      currentResult.conflictDetails.mezzi = Array.from(
        new Set([...currentResult.conflictDetails.mezzi, ...mezziShared])
      );
      otherResult.conflictDetails.personale = Array.from(
        new Set([...otherResult.conflictDetails.personale, ...personaleShared])
      );
      otherResult.conflictDetails.mezzi = Array.from(
        new Set([...otherResult.conflictDetails.mezzi, ...mezziShared])
      );
    }
  }

  return byKey;
}
