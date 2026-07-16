export function normalizeLifecycleStatus(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  return raw || "ATTIVO";
}

export function isLifecycleAttivo(value?: string | null) {
  return normalizeLifecycleStatus(value) === "ATTIVO";
}

export function isMissingLifecycleStatusColumnError(error: any) {
  return String(error?.message || "").toLowerCase().includes("lifecycle_status");
}
