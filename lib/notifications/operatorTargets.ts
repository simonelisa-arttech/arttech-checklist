export type NotificationOperatorTargetRow = {
  email?: string | null;
  ruolo?: string | null;
  reparto?: string | null;
  attivo?: boolean | null;
  riceve_notifiche?: boolean | null;
};

function normalizeOptionalNotificationTarget(input: unknown) {
  const raw = String(input || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw === "TECNICO SW" || raw === "TECNICO-SW") return "TECNICO_SW";
  if (raw === "ALTRO") return "GENERICA";
  return raw;
}

export function normalizeNotificationTarget(input: unknown) {
  return normalizeOptionalNotificationTarget(input) || "GENERICA";
}

export function getOperatorTargetCandidates(row: NotificationOperatorTargetRow) {
  return Array.from(
    new Set(
      [normalizeOptionalNotificationTarget(row.reparto), normalizeOptionalNotificationTarget(row.ruolo)].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
}

export function matchesOperatorTarget(row: NotificationOperatorTargetRow, target: unknown) {
  const normalizedTarget = normalizeNotificationTarget(target);
  return getOperatorTargetCandidates(row).includes(normalizedTarget);
}

export function buildNotificationAutoRecipients(
  target: unknown,
  operatori: NotificationOperatorTargetRow[]
) {
  return Array.from(
    new Set(
      operatori
        .filter((row) => row.attivo !== false)
        .filter((row) => row.riceve_notifiche !== false)
        .filter((row) => matchesOperatorTarget(row, target))
        .map((row) => String(row.email || "").trim().toLowerCase())
        .filter((email) => email.includes("@"))
    )
  );
}
