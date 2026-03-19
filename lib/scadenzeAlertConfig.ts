export const SCADENZE_ALERT_RULE_TYPES = ["LICENZA", "TAGLIANDO", "GARANZIA", "SAAS"] as const;
export const SCADENZE_ALERT_STEP_OPTIONS = [30, 15, 7, 1] as const;
export const SCADENZE_ALERT_DEFAULT_TEMPLATE_TYPES = [
  "LICENZA",
  "TAGLIANDO",
  "GARANZIA",
  "SAAS",
  "GENERICO",
] as const;
export const SCADENZE_ALERT_DEFAULT_TEMPLATE_TRIGGERS = [
  "MANUALE",
  "60GG",
  "30GG",
  "15GG",
  "7GG",
  "1GG",
] as const;

export type ScadenzaAlertRuleType = (typeof SCADENZE_ALERT_RULE_TYPES)[number];
export type ScadenzaAlertStep = (typeof SCADENZE_ALERT_STEP_OPTIONS)[number];
export type ScadenzaAlertDefaultTemplateType =
  (typeof SCADENZE_ALERT_DEFAULT_TEMPLATE_TYPES)[number];
export type ScadenzaAlertDefaultTemplateTrigger =
  (typeof SCADENZE_ALERT_DEFAULT_TEMPLATE_TRIGGERS)[number];

export type ScadenzaAlertGlobalRuleRow = {
  id?: string;
  tipo_scadenza: ScadenzaAlertRuleType;
  attivo: boolean;
  enabled_steps: number[];
  default_delivery_mode: "AUTO_CLIENTE" | "MANUALE_INTERNO";
  default_target: "CLIENTE" | "ART_TECH" | "CLIENTE_E_ART_TECH";
  default_template_id: string | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function normalizeScadenzaAlertRuleType(
  value?: string | null
): ScadenzaAlertRuleType | null {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (raw === "LICENZA") return "LICENZA";
  if (raw === "TAGLIANDO") return "TAGLIANDO";
  if (raw === "GARANZIA") return "GARANZIA";
  if (raw === "SAAS" || raw === "SAAS_ULTRA" || raw === "RINNOVO") return "SAAS";
  return null;
}

export function getDefaultScadenzaAlertGlobalRule(
  tipo_scadenza: ScadenzaAlertRuleType
): ScadenzaAlertGlobalRuleRow {
  return {
    tipo_scadenza,
    attivo: true,
    enabled_steps: [...SCADENZE_ALERT_STEP_OPTIONS],
    default_delivery_mode: "AUTO_CLIENTE",
    default_target: "CLIENTE",
    default_template_id: null,
    note: null,
  };
}

export function normalizeScadenzaAlertGlobalRule(
  row: Partial<ScadenzaAlertGlobalRuleRow> | null | undefined,
  tipo_scadenza: ScadenzaAlertRuleType
): ScadenzaAlertGlobalRuleRow {
  const base = getDefaultScadenzaAlertGlobalRule(tipo_scadenza);
  const enabled_steps = Array.isArray(row?.enabled_steps)
    ? Array.from(
        new Set(
          row!.enabled_steps
            .map((value) => Number(value))
            .filter((value) =>
              SCADENZE_ALERT_STEP_OPTIONS.includes(value as ScadenzaAlertStep)
            )
        )
      )
    : base.enabled_steps;
  return {
    ...base,
    ...(row || {}),
    tipo_scadenza,
    attivo: row?.attivo !== false,
    enabled_steps: enabled_steps.length > 0 ? enabled_steps : [...base.enabled_steps],
    default_delivery_mode:
      String(row?.default_delivery_mode || base.default_delivery_mode).toUpperCase() ===
      "MANUALE_INTERNO"
        ? "MANUALE_INTERNO"
        : "AUTO_CLIENTE",
    default_target:
      String(row?.default_target || base.default_target).toUpperCase() === "ART_TECH"
        ? "ART_TECH"
        : String(row?.default_target || base.default_target).toUpperCase() ===
          "CLIENTE_E_ART_TECH"
        ? "CLIENTE_E_ART_TECH"
        : "CLIENTE",
    default_template_id: row?.default_template_id || null,
    note: row?.note ? String(row.note) : null,
  };
}

export function getAlertTemplateAssociationLabel(tipo?: string | null) {
  const normalized = normalizeScadenzaAlertRuleType(tipo);
  if (normalized) return normalized;
  if (String(tipo || "").trim().toUpperCase() === "GENERICO") return "Override locale";
  return "Non associato";
}

export function getAlertTemplateUsageLabel(tipo?: string | null) {
  const normalized = normalizeScadenzaAlertRuleType(tipo);
  if (normalized) return `Disponibile per la regola globale ${normalized}`;
  return "Usabile come preset manuale / override locale";
}

export function buildScadenzaAlertGlobalRuleSummary(
  rule: ScadenzaAlertGlobalRuleRow | null | undefined,
  templateTitle?: string | null
) {
  if (!rule || !rule.attivo) {
    return "Nessuna regola globale attiva.";
  }
  const steps = [...rule.enabled_steps].sort((a, b) => b - a).join(" / ");
  const targetLabel =
    rule.default_target === "CLIENTE_E_ART_TECH"
      ? "Cliente + Art Tech"
      : rule.default_target === "ART_TECH"
      ? "Art Tech"
      : "Cliente";
  const deliveryLabel =
    rule.default_delivery_mode === "MANUALE_INTERNO"
      ? "Manuale interno"
      : "Automatico al cliente";
  return [
    `Tipo: ${rule.tipo_scadenza}`,
    `Step automatici: ${steps} giorni`,
    `Modalità default: ${deliveryLabel}`,
    `Destinatario default: ${targetLabel}`,
    `Preset default: ${templateTitle || "nessuno"}`,
  ].join("\n");
}

export function renderTemplateText(
  template: string | null | undefined,
  context: Record<string, string | number | null | undefined>
) {
  const raw = String(template || "");
  if (!raw) return "";
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token) => {
    const value = context[token];
    return value == null ? "" : String(value);
  });
}
