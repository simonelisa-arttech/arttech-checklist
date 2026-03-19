"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";
import {
  buildScadenzaAlertGlobalRuleSummary,
  getDefaultScadenzaAlertGlobalRule,
  normalizeScadenzaAlertGlobalRule,
  SCADENZE_ALERT_RULE_TYPES,
  SCADENZE_ALERT_STEP_OPTIONS,
  type ScadenzaAlertGlobalRuleRow,
  type ScadenzaAlertRuleType,
} from "@/lib/scadenzeAlertConfig";

type AlertTemplateRow = {
  id: string;
  titolo: string | null;
  tipo: string | null;
  attivo: boolean | null;
};

export default function RegoleGlobaliAvvisiPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [rules, setRules] = useState<Record<ScadenzaAlertRuleType, ScadenzaAlertGlobalRuleRow>>(() =>
    Object.fromEntries(
      SCADENZE_ALERT_RULE_TYPES.map((tipo) => [tipo, getDefaultScadenzaAlertGlobalRule(tipo)])
    ) as Record<ScadenzaAlertRuleType, ScadenzaAlertGlobalRuleRow>
  );
  const [templates, setTemplates] = useState<AlertTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTipo, setSavingTipo] = useState<ScadenzaAlertRuleType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    const [rulesRes, templatesRes] = await Promise.all([
      dbFrom("scadenze_alert_global_rules").select("*").order("tipo_scadenza", { ascending: true }),
      dbFrom("alert_message_templates")
        .select("id,titolo,tipo,attivo")
        .eq("attivo", true)
        .order("titolo", { ascending: true }),
    ]);

    if (rulesRes.error) {
      setError(`Errore caricamento regole globali: ${rulesRes.error.message}`);
      setLoading(false);
      return;
    }
    if (templatesRes.error) {
      setError(`Errore caricamento preset: ${templatesRes.error.message}`);
      setLoading(false);
      return;
    }

    const nextRules = Object.fromEntries(
      SCADENZE_ALERT_RULE_TYPES.map((tipo) => [tipo, getDefaultScadenzaAlertGlobalRule(tipo)])
    ) as Record<ScadenzaAlertRuleType, ScadenzaAlertGlobalRuleRow>;
    for (const tipo of SCADENZE_ALERT_RULE_TYPES) {
      const found = ((rulesRes.data as any[]) || []).find((row) => row?.tipo_scadenza === tipo) || null;
      nextRules[tipo] = normalizeScadenzaAlertGlobalRule(found, tipo);
    }
    setRules(nextRules);
    setTemplates(((templatesRes.data as any[]) || []) as AlertTemplateRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const templatesById = useMemo(() => {
    const map = new Map<string, AlertTemplateRow>();
    for (const row of templates) {
      if (row.id) map.set(row.id, row);
    }
    return map;
  }, [templates]);

  function updateRule(tipo: ScadenzaAlertRuleType, patch: Partial<ScadenzaAlertGlobalRuleRow>) {
    setRules((prev) => ({
      ...prev,
      [tipo]: normalizeScadenzaAlertGlobalRule({ ...prev[tipo], ...patch }, tipo),
    }));
  }

  async function saveRule(tipo: ScadenzaAlertRuleType) {
    setSavingTipo(tipo);
    setError(null);
    setNotice(null);
    const payload = normalizeScadenzaAlertGlobalRule(rules[tipo], tipo);
    const { data, error: saveErr } = await dbFrom("scadenze_alert_global_rules")
      .upsert(payload, { onConflict: "tipo_scadenza" })
      .select("*")
      .single();
    if (saveErr) {
      setError(`Errore salvataggio regola ${tipo}: ${saveErr.message}`);
      setSavingTipo(null);
      return;
    }
    setRules((prev) => ({
      ...prev,
      [tipo]: normalizeScadenzaAlertGlobalRule((data as any) || payload, tipo),
    }));
    setNotice(`✅ Regola globale ${tipo} salvata.`);
    setSavingTipo(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Regole globali avvisi</h1>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Default automatici per tipo scadenza. Gli override cliente hanno priorità su queste regole.
          </div>
        </div>
        <Link
          href="/impostazioni/preset-avvisi"
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Preset avvisi
        </Link>
        <Link
          href="/impostazioni"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ← Impostazioni
        </Link>
      </div>

      {error ? <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      {notice ? <div style={{ marginTop: 12, color: "#166534", fontSize: 13 }}>{notice}</div> : null}

      {loading ? (
        <div style={{ marginTop: 18, opacity: 0.7 }}>Caricamento…</div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {SCADENZE_ALERT_RULE_TYPES.map((tipo) => {
            const rule = rules[tipo];
            const presetTitle = rule.default_template_id
              ? templatesById.get(rule.default_template_id)?.titolo || "Preset selezionato"
              : null;
            return (
              <div
                key={tipo}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: "white",
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{tipo}</div>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={rule.attivo}
                      onChange={(e) => updateRule(tipo, { attivo: e.target.checked })}
                    />
                    Regola attiva
                  </label>
                </div>

                <div
                  style={{
                    whiteSpace: "pre-line",
                    fontSize: 12,
                    color: "#374151",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  {buildScadenzaAlertGlobalRuleSummary(rule, presetTitle)}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Step automatici</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                      {SCADENZE_ALERT_STEP_OPTIONS.map((step) => {
                        const checked = rule.enabled_steps.includes(step);
                        return (
                          <label key={step} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                updateRule(tipo, {
                                  enabled_steps: e.target.checked
                                    ? [...rule.enabled_steps, step]
                                    : rule.enabled_steps.filter((value) => value !== step),
                                })
                              }
                            />
                            {step} giorni
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label style={{ display: "block", fontSize: 12 }}>
                    Modalità invio default
                    <select
                      value={rule.default_delivery_mode}
                      onChange={(e) =>
                        updateRule(tipo, {
                          default_delivery_mode:
                            e.target.value === "MANUALE_INTERNO" ? "MANUALE_INTERNO" : "AUTO_CLIENTE",
                        })
                      }
                      style={{ width: "100%", padding: 8, marginTop: 6 }}
                    >
                      <option value="AUTO_CLIENTE">Automatico al cliente</option>
                      <option value="MANUALE_INTERNO">Manuale interno</option>
                    </select>
                  </label>

                  <label style={{ display: "block", fontSize: 12 }}>
                    Destinatario default
                    <select
                      value={rule.default_target}
                      onChange={(e) =>
                        updateRule(tipo, {
                          default_target:
                            e.target.value === "ART_TECH"
                              ? "ART_TECH"
                              : e.target.value === "CLIENTE_E_ART_TECH"
                              ? "CLIENTE_E_ART_TECH"
                              : "CLIENTE",
                        })
                      }
                      style={{ width: "100%", padding: 8, marginTop: 6 }}
                    >
                      <option value="CLIENTE">Cliente</option>
                      <option value="ART_TECH">Art Tech</option>
                      <option value="CLIENTE_E_ART_TECH">Cliente + Art Tech</option>
                    </select>
                  </label>

                  <label style={{ display: "block", fontSize: 12 }}>
                    Preset default
                    <select
                      value={rule.default_template_id || ""}
                      onChange={(e) =>
                        updateRule(tipo, { default_template_id: e.target.value || null })
                      }
                      style={{ width: "100%", padding: 8, marginTop: 6 }}
                    >
                      <option value="">— Nessun preset —</option>
                      {templates
                        .filter((template) => {
                          const templateTipo = String(template.tipo || "").toUpperCase();
                          return templateTipo === tipo || templateTipo === "GENERICO";
                        })
                        .map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.titolo || template.id}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <label style={{ display: "block", fontSize: 12 }}>
                  Note / testo default
                  <textarea
                    value={rule.note || ""}
                    onChange={(e) => updateRule(tipo, { note: e.target.value })}
                    rows={3}
                    style={{ width: "100%", padding: 8, marginTop: 6 }}
                  />
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => saveRule(tipo)}
                    disabled={savingTipo === tipo}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      opacity: savingTipo === tipo ? 0.6 : 1,
                      cursor: savingTipo === tipo ? "default" : "pointer",
                    }}
                  >
                    {savingTipo === tipo ? "Salvataggio..." : "Salva regola"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
