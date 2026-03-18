export function normalizeEmailValue(value?: string | null) {
  return String(value || "").trim();
}

export function isValidClienteEmail(value?: string | null) {
  return normalizeEmailValue(value).includes("@");
}

export function splitEmailSecondarie(value?: string | null) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeEmailSecondarieInput(value?: string | null) {
  const entries = splitEmailSecondarie(value);
  if (entries.length === 0) {
    return { value: null as string | null, error: null as string | null };
  }
  const invalid = entries.find((email) => !isValidClienteEmail(email));
  if (invalid) {
    return {
      value: null,
      error: `Email secondaria non valida: ${invalid}`,
    };
  }
  return { value: Array.from(new Set(entries.map((email) => email.toLowerCase()))).join("\n"), error: null };
}

export function buildClienteEmailList(
  emailPrincipale?: string | null,
  emailSecondarie?: string | null
) {
  const merged = [
    normalizeEmailValue(emailPrincipale),
    ...splitEmailSecondarie(emailSecondarie),
  ].filter(isValidClienteEmail);

  const dedup = new Map<string, string>();
  for (const email of merged) {
    const normalized = normalizeEmailValue(email);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, normalized);
  }
  return Array.from(dedup.values());
}

export function formatClienteEmailList(
  emailPrincipale?: string | null,
  emailSecondarie?: string | null
) {
  return buildClienteEmailList(emailPrincipale, emailSecondarie).join(", ");
}
