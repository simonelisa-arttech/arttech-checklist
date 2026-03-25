"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";
import {
  buildScadenzaAlertGlobalRulePayload,
  buildScadenzaAlertGlobalRulesSummary,
  expandScadenzaAlertGlobalRuleRows,
  getDefaultScadenzaAlertGlobalRule,
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

function buildDefaultRulesByTipo() {
  return Object.fromEntries(
    SCADENZE_ALERT_RULE_TYPES.map((tipo) => [
      tipo,
      [...SCADENZE_ALERT_STEP_OPTIONS].map((step) => getDefaultScadenzaAlertGlobalRule(tipo, step)),
    ])
  ) as Record<ScadenzaAlertRuleType, ScadenzaAlertGlobalRuleRow[]>;
}

export default function RegoleGlobaliAvvisiPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [rulesByTipo, setRulesByTipo] = useState<Record<ScadenzaAlertRuleType, ScadenzaAlertGlobalRuleRow[]>>(
    () => buildDefaultRulesByTipo()
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
      dbFrom("scadenze_alert_global_rules").select("*"),
      dbFrom("alert_message_templates")
        .select("id,titolo,tipo,attivo")
        .eq("attivo", true)
        .order("titolo", { ascending: true }),
    ]);

    const nextRules = buildDefaultRulesByTipo();
    if (!rulesRes.error) {
      const expanded = expandScadenzaAlertGlobalRuleRows(
        ((rulesRes.data as any[]) || []) as Record<string, unknown>[]
      );
      for (const tipo of SCADENZE_ALERT_RULE_TYPES) {
        const byTipo = expanded
          .filter((row) => row.tipo_scadenza === tipo)
          .sort((a, b) => b.giorni_preavviso - a.giorni_preavviso);
        if (byTipo.length > 0) {
          const merged = [...SCADENZE_ALERT_STEP_OPTIONS].map((step) => {
            return (
              byTipo.find((row) => row.giorni_preavviso === step) ||
              getDefaultScadenzaAlertGlobalRule(tipo, step)
            );
          });
          nextRules[tipo] = merged;
        }
      }
    }

    setRulesByTipo(nextRules);
    setTemplates(templatesRes.error ? [] : (((templatesRes.data as any[]) || []) as AlertTemplateRow[]));

    const errors: string[] = [];
    if (rulesRes.error) errors.push(`Errore caricamento regole globali: ${rulesRes.error.message}`);
    if (templatesRes.error) errors.push(`Errore caricamento preset: ${templatesRes.error.message}`);
    setError(errors.length > 0 ? errors.join(" • ") : null);
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

  function updateRuleRow(
    tipo: ScadenzaAlertRuleType,
    giorni_preavviso: number,
    patch: Partial<ScadenzaAlertGlobalRuleRow>
  ) {
    setRulesByTipo((prev) => ({
      ...prev,
      [tipo]: prev[tipo]
        .map((row) =>
          row.giorni_preavviso === giorni_preavviso ? { ...row, ...patch, tipo_scadenza: tipo } : row
        )
        .sort((a, b) => b.giorni_preavviso - a.giorni_preavviso),
    }));
  }

  async function saveTipo(tipo: ScadenzaAlertRuleType) {
    setSavingTipo(tipo);
    setError(null);
    setNotice(null);
    const payload = rulesByTipo[tipo].map((row) => buildScadenzaAlertGlobalRulePayload(row));
    const result = await dbFrom("scadenze_alert_global_rules")
      .upsert(payload, { onConflict: "tipo_scadenza,giorni_preavviso" })
      .select("*");

    if (result.error) {
      setError(`Errore salvataggio regole ${tipo}: ${result.error.message}`);
      setSavingTipo(null);
      return;
    }

    const normalized = expandScadenzaAlertGlobalRuleRows(
      ((result.data as any[]) || []) as Record<string, unknown>[]
    ).filter((row) => row.tipo_scadenza === tipo);
    setRulesByTipo((prev) => ({
      ...prev,
      [tipo]:
        normalized.length > 0
          ? [...SCADENZE_ALERT_STEP_OPTIONS].map((step) => {
              return (
                normalized.find((row) => row.giorni_preavviso === step) ||
                getDefaultScadenzaAlertGlobalRule(tipo, step)
              );
            })
          : prev[tipo],
    }));
    setNotice(`✅ Regole globali ${tipo} salvate.`);
    setSavingTipo(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Regole globali avvisi</h1>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Source of truth dei trigger automatici: una riga per tipo scadenza e giorni di preavviso.
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
            const rows = rulesByTipo[tipo];
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
                  <div
                    style={{
                      whiteSpace: "pre-line",
                      fontSize: 12,
                      color: "#374151",
                      background: "#f8fafc",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 10,
                      flex: 1,
                      minWidth: 260,
                    }}
                  >
                    {buildScadenzaAlertGlobalRulesSummary(rows, templatesById)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px minmax(260px, 1fr) 140px",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Giorni preavviso</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Preset associato</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Attivo</div>

                  {rows.map((row) => {
                    const matchingTemplates = templates.filter((template) => {
                      return String(template.tipo || "").trim().toUpperCase() === tipo;
                    });
                    const selectedTemplate =
                      row.preset_id && templatesById.get(row.preset_id)
                        ? templatesById.get(row.preset_id)
                        : null;
                    const selectOptions =
                      selectedTemplate && !matchingTemplates.some((template) => template.id === selectedTemplate.id)
                        ? [selectedTemplate, ...matchingTemplates]
                        : matchingTemplates;
                    return (
                      <>
                        <div
                          key={`${tipo}-${row.giorni_preavviso}-step`}
                          style={{ fontSize: 13, fontWeight: 700 }}
                        >
                          {row.giorni_preavviso} giorni
                        </div>
                        <label
                          key={`${tipo}-${row.giorni_preavviso}-preset`}
                          style={{ display: "block", fontSize: 12 }}
                        >
                          <select
                            value={row.preset_id || ""}
                            onChange={(e) =>
                              updateRuleRow(tipo, row.giorni_preavviso, {
                                preset_id: e.target.value || null,
                              })
                            }
                            style={{ width: "100%", padding: 8, marginTop: 2 }}
                          >
                            <option value="">— Nessun preset —</option>
                            {selectOptions.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.titolo || template.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label
                          key={`${tipo}-${row.giorni_preavviso}-attivo`}
                          style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}
                        >
                          <input
                            type="checkbox"
                            checked={row.attivo}
                            onChange={(e) =>
                              updateRuleRow(tipo, row.giorni_preavviso, { attivo: e.target.checked })
                            }
                          />
                          Attiva
                        </label>
                      </>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => saveTipo(tipo)}
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
                    {savingTipo === tipo ? "Salvataggio..." : "Salva regole"}
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
