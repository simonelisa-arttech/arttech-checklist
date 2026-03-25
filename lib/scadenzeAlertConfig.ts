export const SCADENZE_ALERT_RULE_TYPES = [
  "LICENZA",
  "TAGLIANDO",
  "GARANZIA",
  "SAAS",
  "CMS",
] as const;

export const SCADENZE_ALERT_STEP_OPTIONS = [60, 30, 15, 7, 1] as const;

export const SCADENZE_ALERT_DEFAULT_TEMPLATE_TYPES = [...SCADENZE_ALERT_RULE_TYPES] as const;
export const SCADENZE_ALERT_COMPAT_TEMPLATE_TYPES = [
  ...SCADENZE_ALERT_RULE_TYPES,
  "GENERICO",
] as const;

export type ScadenzaAlertRuleType = (typeof SCADENZE_ALERT_RULE_TYPES)[number];
export type ScadenzaAlertStep = (typeof SCADENZE_ALERT_STEP_OPTIONS)[number];
export type ScadenzaAlertDefaultTemplateType =
  | ScadenzaAlertRuleType
  | "GENERICO";

export type ScadenzaAlertGlobalRuleRow = {
  id?: string;
  tipo_scadenza: ScadenzaAlertRuleType;
  giorni_preavviso: number;
  preset_id: string | null;
  attivo: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type ScadenzaAlertGlobalRuleCompatRow = Partial<ScadenzaAlertGlobalRuleRow> &
  Record<string, unknown>;

function normalizeInteger(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
}

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
  if (raw === "CMS") return "CMS";
  return null;
}

export function normalizeScadenzaAlertTemplateType(
  value?: string | null
): ScadenzaAlertDefaultTemplateType | null {
  const normalizedRuleType = normalizeScadenzaAlertRuleType(value);
  if (normalizedRuleType) return normalizedRuleType;
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (raw === "GENERICO") return "GENERICO";
  return null;
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

export function getDefaultScadenzaAlertGlobalRule(
  tipo_scadenza: ScadenzaAlertRuleType,
  giorni_preavviso: number
): ScadenzaAlertGlobalRuleRow {
  return {
    tipo_scadenza,
    giorni_preavviso,
    preset_id: null,
    attivo: true,
  };
}

export function normalizeScadenzaAlertGlobalRule(
  row: ScadenzaAlertGlobalRuleCompatRow | null | undefined,
  fallbackTipo: ScadenzaAlertRuleType,
  fallbackGiorni = 30
): ScadenzaAlertGlobalRuleRow {
  const tipo_scadenza = getScadenzaAlertGlobalRuleTipo(row) || fallbackTipo;
  const giorni_preavviso =
    normalizeInteger(row?.giorni_preavviso) ??
    normalizeInteger(row?.step) ??
    normalizeInteger(fallbackGiorni) ??
    30;
  const presetRaw =
    typeof row?.preset_id === "string" && row.preset_id.trim()
      ? row.preset_id.trim()
      : typeof row?.default_template_id === "string" && row.default_template_id.trim()
      ? row.default_template_id.trim()
      : typeof row?.preset_default === "string" && row.preset_default.trim()
      ? row.preset_default.trim()
      : null;
  return {
    ...getDefaultScadenzaAlertGlobalRule(tipo_scadenza, giorni_preavviso),
    ...(row || {}),
    tipo_scadenza,
    giorni_preavviso,
    preset_id: presetRaw,
    attivo:
      typeof row?.attivo === "boolean"
        ? row.attivo
        : typeof row?.attiva === "boolean"
        ? row.attiva
        : true,
  };
}

function normalizeStepList(values: unknown) {
  const rawList = Array.isArray(values)
    ? values
    : typeof values === "number"
    ? [values]
    : typeof values === "string" && values.trim()
    ? values
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  return Array.from(
    new Set(
      rawList
        .map((value) => normalizeInteger(value))
        .filter(
          (value): value is number =>
            value != null &&
            SCADENZE_ALERT_STEP_OPTIONS.includes(value as ScadenzaAlertStep)
        )
    )
  ).sort((a, b) => b - a);
}

export function expandScadenzaAlertGlobalRuleRows(
  rows: Array<Record<string, unknown>> | null | undefined
): ScadenzaAlertGlobalRuleRow[] {
  const out: ScadenzaAlertGlobalRuleRow[] = [];
  for (const row of rows || []) {
    const tipo_scadenza = getScadenzaAlertGlobalRuleTipo(row);
    if (!tipo_scadenza) continue;

    const hasSingleStep =
      Object.prototype.hasOwnProperty.call(row, "giorni_preavviso") ||
      Object.prototype.hasOwnProperty.call(row, "preset_id");
    if (hasSingleStep) {
      out.push(normalizeScadenzaAlertGlobalRule(row, tipo_scadenza));
      continue;
    }

    const legacySteps = normalizeStepList(
      row?.enabled_steps ?? row?.step_giorni ?? row?.giorni_preavviso
    );
    const steps = legacySteps.length > 0 ? legacySteps : [...SCADENZE_ALERT_STEP_OPTIONS];
    for (const step of steps) {
      out.push(normalizeScadenzaAlertGlobalRule(row, tipo_scadenza, step));
    }
  }

  const dedup = new Map<string, ScadenzaAlertGlobalRuleRow>();
  for (const row of out) {
    dedup.set(`${row.tipo_scadenza}:${row.giorni_preavviso}`, row);
  }
  return Array.from(dedup.values()).sort((a, b) => {
    if (a.tipo_scadenza !== b.tipo_scadenza) {
      return a.tipo_scadenza.localeCompare(b.tipo_scadenza);
    }
    return b.giorni_preavviso - a.giorni_preavviso;
  });
}

export function buildScadenzaAlertGlobalRulePayload(rule: ScadenzaAlertGlobalRuleRow) {
  const normalized = normalizeScadenzaAlertGlobalRule(
    rule,
    rule.tipo_scadenza,
    rule.giorni_preavviso
  );
  return {
    tipo_scadenza: normalized.tipo_scadenza,
    giorni_preavviso: normalized.giorni_preavviso,
    preset_id: normalized.preset_id,
    attivo: normalized.attivo,
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
    return "Regola non attiva.";
  }
  return [
    `Tipo: ${rule.tipo_scadenza}`,
    `Preavviso: ${rule.giorni_preavviso} giorni`,
    `Preset associato: ${templateTitle || "nessuno"}`,
  ].join("\n");
}

export function buildScadenzaAlertGlobalRulesSummary(
  rules: ScadenzaAlertGlobalRuleRow[] | null | undefined,
  templatesById?: Map<string, { titolo?: string | null }>
) {
  const list = (rules || []).filter((rule) => rule.attivo !== false);
  if (list.length === 0) {
    return "Nessuna regola globale attiva.";
  }
  return list
    .slice()
    .sort((a, b) => b.giorni_preavviso - a.giorni_preavviso)
    .map((rule) => {
      const title = rule.preset_id
        ? templatesById?.get(rule.preset_id)?.titolo || "Preset selezionato"
        : "nessuno";
      return `${rule.giorni_preavviso} giorni → ${title}`;
    })
    .join("\n");
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
