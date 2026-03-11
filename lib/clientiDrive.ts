export function isMissingClientiDriveColumnError(error: any) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return code === "pgrst204" || message.includes("drive_url") || details.includes("drive_url");
}
