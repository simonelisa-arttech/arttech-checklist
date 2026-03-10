export function isHttpUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function splitMagazzinoFields(
  codiceValue?: string | null,
  driveUrlValue?: string | null
) {
  const codice = String(codiceValue || "").trim();
  const driveUrl = String(driveUrlValue || "").trim();
  if (driveUrl) {
    return { codice, driveUrl };
  }
  if (isHttpUrl(codice)) {
    return { codice: "", driveUrl: codice };
  }
  return { codice, driveUrl: "" };
}
