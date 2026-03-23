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

export type ScadenzaAlertGlobalRuleStorageMode = "legacy" | "modern" | "unknown";

type ScadenzaAlertGlobalRuleCompatRow = Partial<ScadenzaAlertGlobalRuleRow> &
  Record<string, unknown>;

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

function normalizeDeliveryModeCompat(value: unknown) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  return raw === "MANUALE_INTERNO" || raw === "MANUALE" || raw === "MANUALE INTERNO"
    ? "MANUALE_INTERNO"
    : "AUTO_CLIENTE";
}

function normalizeTargetCompat(value: unknown) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (raw === "ART_TECH" || raw === "ARTTECH") return "ART_TECH";
  if (raw === "CLIENTE_E_ART_TECH" || raw === "CLIENTE+ART_TECH") return "CLIENTE_E_ART_TECH";
  return "CLIENTE";
}

export function getScadenzaAlertGlobalRuleTipo(row: Record<string, unknown> | null | undefined) {
  return normalizeScadenzaAlertRuleType(
    typeof row?.tipo_scadenza === "string" && row.tipo_scadenza
      ? row.tipo_scadenza
      : typeof row?.tipo === "string"
      ? row.tipo
      : null
  );
}

export function detectScadenzaAlertGlobalRuleStorageMode(
  rows: Array<Record<string, unknown>> | null | undefined
): ScadenzaAlertGlobalRuleStorageMode {
  for (const row of rows || []) {
    if (
      row &&
      (Object.prototype.hasOwnProperty.call(row, "tipo_scadenza") ||
        Object.prototype.hasOwnProperty.call(row, "enabled_steps") ||
        Object.prototype.hasOwnProperty.call(row, "default_template_id"))
    ) {
      return "legacy";
    }
    if (
      row &&
      (Object.prototype.hasOwnProperty.call(row, "tipo") ||
        Object.prototype.hasOwnProperty.call(row, "step_giorni") ||
        Object.prototype.hasOwnProperty.call(row, "preset_default"))
    ) {
      return "modern";
    }
  }
  return "unknown";
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
  row: ScadenzaAlertGlobalRuleCompatRow | null | undefined,
  tipo_scadenza: ScadenzaAlertRuleType
): ScadenzaAlertGlobalRuleRow {
  const base = getDefaultScadenzaAlertGlobalRule(tipo_scadenza);
  const compatSteps = Array.isArray(row?.enabled_steps)
    ? row.enabled_steps
    : Array.isArray(row?.step_giorni)
    ? row.step_giorni
    : null;
  const enabled_steps = Array.isArray(compatSteps)
    ? Array.from(
        new Set(
          compatSteps
            .map((value) => Number(value))
            .filter((value) =>
              SCADENZE_ALERT_STEP_OPTIONS.includes(value as ScadenzaAlertStep)
            )
        )
      )
    : base.enabled_steps;
  const raw = (row || {}) as Record<string, unknown>;
  const defaultTemplateId =
    typeof raw.default_template_id === "string" && raw.default_template_id.trim()
      ? raw.default_template_id.trim()
      : typeof raw.preset_default === "string" && raw.preset_default.trim()
      ? raw.preset_default.trim()
      : null;
  const noteValue =
    typeof raw.note === "string" && raw.note.trim()
      ? raw.note
      : typeof raw.note_default === "string" && raw.note_default.trim()
      ? raw.note_default
      : null;
  return {
    ...base,
    ...(row || {}),
    tipo_scadenza,
    attivo:
      typeof raw.attivo === "boolean"
        ? raw.attivo
        : typeof raw.attiva === "boolean"
        ? raw.attiva
        : true,
    enabled_steps: enabled_steps.length > 0 ? enabled_steps : [...base.enabled_steps],
    default_delivery_mode: normalizeDeliveryModeCompat(
      raw.default_delivery_mode ?? raw.modalita_invio ?? base.default_delivery_mode
    ),
    default_target: normalizeTargetCompat(
      raw.default_target ?? raw.destinatario_default ?? base.default_target
    ),
    default_template_id: defaultTemplateId,
    note: noteValue,
  };
}

export function buildLegacyScadenzaAlertGlobalRulePayload(rule: ScadenzaAlertGlobalRuleRow) {
  const normalized = normalizeScadenzaAlertGlobalRule(rule, rule.tipo_scadenza);
  return {
    tipo_scadenza: normalized.tipo_scadenza,
    attivo: normalized.attivo,
    enabled_steps: normalized.enabled_steps,
    default_delivery_mode: normalized.default_delivery_mode,
    default_target: normalized.default_target,
    default_template_id: normalized.default_template_id,
    note: normalized.note,
  };
}

export function buildModernScadenzaAlertGlobalRulePayload(rule: ScadenzaAlertGlobalRuleRow) {
  const normalized = normalizeScadenzaAlertGlobalRule(rule, rule.tipo_scadenza);
  return {
    tipo: normalized.tipo_scadenza,
    attiva: normalized.attivo,
    step_giorni: normalized.enabled_steps,
    modalita_invio:
      normalized.default_delivery_mode === "MANUALE_INTERNO"
        ? "manuale_interno"
        : "automatico_cliente",
    destinatario_default:
      normalized.default_target === "CLIENTE_E_ART_TECH"
        ? "cliente_e_art_tech"
        : normalized.default_target === "ART_TECH"
        ? "art_tech"
        : "cliente",
    preset_default: normalized.default_template_id,
    note_default: normalized.note,
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
