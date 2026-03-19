export const RENEWAL_ALERT_PROGRESSIVE_DAYS = [30, 15, 7, 1] as const;

export const RENEWAL_ALERT_STOP_OPTIONS = [
  { value: "AT_EXPIRY", label: "Alla scadenza" },
  { value: "AFTER_FIRST_SEND", label: "Dopo il primo invio" },
  { value: "ON_STATUS", label: "Quando lo stato entra nei valori selezionati" },
] as const;

export const RENEWAL_ALERT_STOP_STATUS_OPTIONS = [
  "AVVISATO",
  "CONFERMATO",
  "NON_RINNOVATO",
  "FATTURATO",
] as const;

export type RenewalAlertStage = "stage1" | "stage2";
export type RenewalAlertMode = "MANUALE" | "AUTOMATICO";
export type RenewalAlertRecipientMode = "OPERATORE" | "EMAIL";
export type RenewalAlertStopCondition = "AT_EXPIRY" | "AFTER_FIRST_SEND" | "ON_STATUS";

export type RenewalAlertRuleRow = {
  id?: string;
  cliente: string;
  stage: RenewalAlertStage;
  enabled: boolean;
  mode: RenewalAlertMode;
  days_before: number;
  send_to_cliente: boolean;
  send_to_art_tech: boolean;
  art_tech_mode: RenewalAlertRecipientMode;
  art_tech_operatore_id: string | null;
  art_tech_email: string | null;
  art_tech_name: string | null;
  stop_condition: RenewalAlertStopCondition;
  stop_statuses: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export function getDefaultRenewalAlertRule(
  cliente: string,
  stage: RenewalAlertStage
): RenewalAlertRuleRow {
  return {
    cliente,
    stage,
    enabled: false,
    mode: "MANUALE",
    days_before: RENEWAL_ALERT_PROGRESSIVE_DAYS[0],
    send_to_cliente: true,
    send_to_art_tech: false,
    art_tech_mode: "OPERATORE",
    art_tech_operatore_id: null,
    art_tech_email: null,
    art_tech_name: null,
    stop_condition: "AT_EXPIRY",
    stop_statuses: ["CONFERMATO", "NON_RINNOVATO", "FATTURATO"],
  };
}

export function normalizeRenewalAlertRule(
  row: Partial<RenewalAlertRuleRow> | null | undefined,
  cliente: string,
  stage: RenewalAlertStage
): RenewalAlertRuleRow {
  const base = getDefaultRenewalAlertRule(cliente, stage);
  return {
    ...base,
    ...(row || {}),
    cliente,
    stage,
    enabled: row?.enabled === true,
    mode: String(row?.mode || base.mode).toUpperCase() === "AUTOMATICO" ? "AUTOMATICO" : "MANUALE",
    days_before: RENEWAL_ALERT_PROGRESSIVE_DAYS.includes(Number(row?.days_before) as any)
      ? Number(row?.days_before)
      : base.days_before,
    send_to_cliente: row?.send_to_cliente !== false,
    send_to_art_tech: row?.send_to_art_tech === true,
    art_tech_mode: String(row?.art_tech_mode || base.art_tech_mode).toUpperCase() === "EMAIL"
      ? "EMAIL"
      : "OPERATORE",
    art_tech_operatore_id: row?.art_tech_operatore_id || null,
    art_tech_email: row?.art_tech_email || null,
    art_tech_name: row?.art_tech_name || null,
    stop_condition:
      String(row?.stop_condition || base.stop_condition).toUpperCase() === "ON_STATUS"
        ? "ON_STATUS"
        : "AT_EXPIRY",
    stop_statuses: Array.from(
      new Set(
        Array.isArray(row?.stop_statuses)
          ? row!.stop_statuses
              .map((value) => String(value || "").toUpperCase().trim())
              .filter(Boolean)
          : base.stop_statuses
      )
    ),
  };
}

export function buildRenewalAlertRuleSummary(rule: RenewalAlertRuleRow | null | undefined) {
  if (!rule || rule.mode !== "AUTOMATICO" || !rule.enabled) {
    return "Nessun override cliente salvato.";
  }
  const recipients: string[] = [];
  if (rule.send_to_cliente) recipients.push("Cliente");
  if (rule.send_to_art_tech) recipients.push("Art Tech");
  let stopLabel = "alla scadenza";
  if (rule.stop_condition === "ON_STATUS") {
    stopLabel =
      rule.stop_statuses.length > 0
        ? `quando stato = ${rule.stop_statuses.join(" / ")}`
        : "al cambio stato";
  }
  return [
    "Override cliente attivo:",
    `invii progressivi: ${RENEWAL_ALERT_PROGRESSIVE_DAYS.join(" / ")} giorni prima della scadenza`,
    `destinatario: ${recipients.length > 0 ? recipients.join(" + ") : "—"}`,
    `stop: ${stopLabel}`,
  ].join("\n");
}

export function buildRenewalAlertRuleLogLabel(rule: RenewalAlertRuleRow | null | undefined) {
  if (!rule || rule.mode !== "AUTOMATICO" || !rule.enabled) return null;
  const recipients: string[] = [];
  if (rule.send_to_cliente) recipients.push("Cliente");
  if (rule.send_to_art_tech) recipients.push("Art Tech");
  const stop =
    rule.stop_condition === "ON_STATUS"
      ? `stop=stato:${rule.stop_statuses.join("|")}`
      : "stop=alla scadenza";
  return `Regola auto ${RENEWAL_ALERT_PROGRESSIVE_DAYS.join("-")}gg • dest=${recipients.join("+") || "—"} • ${stop}`;
}

export function isValidEmail(value?: string | null) {
  const raw = String(value || "").trim();
  return raw.includes("@") && raw.includes(".");
}
