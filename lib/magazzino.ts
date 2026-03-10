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

export function isMissingMagazzinoDriveColumnError(error: any) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    code === "pgrst204" ||
    message.includes("magazzino_drive_url") ||
    details.includes("magazzino_drive_url")
  );
}
