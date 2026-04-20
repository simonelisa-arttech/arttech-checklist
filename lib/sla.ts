export type SlaPriority = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export function extractSlaHours(code?: string | null): number | null {
  const raw = String(code || "").trim().toUpperCase();
  const match = raw.match(/^SAAS-(?:PR|UL)(\d+)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  return Number.isFinite(hours) ? hours : null;
}

export function getSlaPriority(hours: number | null): SlaPriority | null {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours <= 8) return "HIGH";
  if (hours <= 24) return "MEDIUM";
  if (hours <= 48) return "LOW";
  return "VERY_LOW";
}

export function getSlaPriorityColors(priority: SlaPriority | null) {
  if (priority === "HIGH") {
    return { border: "#fca5a5", background: "#fee2e2", color: "#b91c1c" };
  }
  if (priority === "MEDIUM") {
    return { border: "#fdba74", background: "#fff7ed", color: "#c2410c" };
  }
  if (priority === "LOW") {
    return { border: "#fde68a", background: "#fffbeb", color: "#b45309" };
  }
  return { border: "#86efac", background: "#f0fdf4", color: "#166534" };
}

export function getSlaBadgeLabel(code?: string | null) {
  const hours = extractSlaHours(code);
  return hours == null ? null : `H${hours}`;
}
