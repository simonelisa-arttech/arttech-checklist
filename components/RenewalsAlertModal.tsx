"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildRenewalAlertRuleSummary,
  isValidEmail,
  normalizeRenewalAlertRule,
  RENEWAL_ALERT_DAY_PRESETS,
  RENEWAL_ALERT_STOP_OPTIONS,
  RENEWAL_ALERT_STOP_STATUS_OPTIONS,
  type RenewalAlertRuleRow,
  type RenewalAlertStage,
} from "@/lib/renewalAlertRules";

type OperatoreOption = {
  id: string;
  nome?: string | null;
  ruolo?: string | null;
  email?: string | null;
  attivo?: boolean | null;
};

type ManualSubmitPayload = {
  toCliente: boolean;
  toArtTech: boolean;
  artTechMode: "operatore" | "email";
  operatoreId: string;
  manualEmail: string;
  manualName: string;
  subject: string;
  message: string;
  sendEmail: boolean;
};

type Props = {
  open: boolean;
  cliente: string;
  stage: RenewalAlertStage;
  title: string;
  customerEmail: string | null;
  operators: OperatoreOption[];
  defaultOperatorId: string;
  initialSubject: string;
  initialMessage: string;
  rule: RenewalAlertRuleRow | null;
  loadingRule?: boolean;
  manualSending?: boolean;
  ruleSaving?: boolean;
  error?: string | null;
  success?: string | null;
  onClose: () => void;
  onSubmitManual: (payload: ManualSubmitPayload) => void;
  onSaveRule: (rule: RenewalAlertRuleRow) => void;
};

export default function RenewalsAlertModal({
  open,
  cliente,
  stage,
  title,
  customerEmail,
  operators,
  defaultOperatorId,
  initialSubject,
  initialMessage,
  rule,
  loadingRule = false,
  manualSending = false,
  ruleSaving = false,
  error = null,
  success = null,
  onClose,
  onSubmitManual,
  onSaveRule,
}: Props) {
  const [mode, setMode] = useState<"MANUALE" | "AUTOMATICO">("MANUALE");
  const [toCliente, setToCliente] = useState(false);
  const [toArtTech, setToArtTech] = useState(true);
  const [artTechMode, setArtTechMode] = useState<"operatore" | "email">("operatore");
  const [operatoreId, setOperatoreId] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [ruleDraft, setRuleDraft] = useState<RenewalAlertRuleRow>(
    normalizeRenewalAlertRule(rule, cliente, stage)
  );

  useEffect(() => {
    if (!open) return;
    const normalizedRule = normalizeRenewalAlertRule(rule, cliente, stage);
    setMode(stage === "stage1" && normalizedRule.mode === "AUTOMATICO" ? "AUTOMATICO" : "MANUALE");
    setToCliente(false);
    setToArtTech(true);
    setArtTechMode("operatore");
    setOperatoreId(defaultOperatorId);
    setManualEmail("");
    setManualName("");
    setSubject(initialSubject);
    setMessage(initialMessage);
    setSendEmail(true);
    setRuleDraft(normalizedRule);
  }, [open, rule, cliente, stage, defaultOperatorId, initialSubject, initialMessage]);

  const canUseAutomatic = stage === "stage1";
  const automaticSummary = useMemo(() => buildRenewalAlertRuleSummary(ruleDraft), [ruleDraft]);
  const canSendManual =
    (toCliente && isValidEmail(customerEmail)) ||
    (toArtTech &&
      (artTechMode === "operatore" ? Boolean(operatoreId) : isValidEmail(manualEmail)));

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          overflow: "auto",
          background: "white",
          borderRadius: 12,
          border: "1px solid #eee",
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
            }}
          >
            Chiudi
          </button>
        </div>

        <label style={{ display: "block", marginBottom: 10 }}>
          Modalità invio<br />
          <select
            value={mode}
            onChange={(e) =>
              setMode(
                canUseAutomatic && String(e.target.value).toUpperCase() === "AUTOMATICO"
                  ? "AUTOMATICO"
                  : "MANUALE"
              )
            }
            style={{ width: "100%", padding: 8 }}
          >
            <option value="MANUALE">MANUALE</option>
            {canUseAutomatic && <option value="AUTOMATICO">AUTOMATICO</option>}
          </select>
        </label>

        {mode === "MANUALE" ? (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={toArtTech}
                  onChange={(e) => setToArtTech(e.target.checked)}
                />
                Art Tech
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={toCliente}
                  onChange={(e) => setToCliente(e.target.checked)}
                />
                Cliente
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 10,
                fontSize: 12,
                opacity: toArtTech ? 1 : 0.55,
              }}
            >
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="renewals-alert-art-tech-mode"
                  checked={artTechMode === "operatore"}
                  onChange={() => setArtTechMode("operatore")}
                  disabled={!toArtTech}
                />
                Operatore
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="renewals-alert-art-tech-mode"
                  checked={artTechMode === "email"}
                  onChange={() => setArtTechMode("email")}
                  disabled={!toArtTech}
                />
                Email manuale
              </label>
            </div>

            {toCliente && (
              <div style={{ marginTop: -4, marginBottom: 10, fontSize: 12, opacity: 0.8 }}>
                Cliente {isValidEmail(customerEmail) ? "selezionato" : "senza email valida in anagrafica"}
              </div>
            )}

            {toArtTech && (
              <label style={{ display: "block", marginBottom: 10 }}>
                Destinatario Art Tech<br />
                {artTechMode === "operatore" ? (
                  <select
                    value={operatoreId}
                    onChange={(e) => setOperatoreId(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                  >
                    <option value="">—</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.nome ?? "—"}
                        {op.ruolo ? ` — ${op.ruolo}` : ""}
                        {op.email ? ` — ${op.email}` : " — (senza email)"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      placeholder="Email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      style={{ width: "100%", padding: 8 }}
                    />
                    <input
                      placeholder="Nome (opzionale)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>
                )}
              </label>
            )}

            <label style={{ display: "block", marginBottom: 10 }}>
              Subject<br />
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              Messaggio<br />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              Invia email
            </label>
          </>
        ) : (
          <>
            <div
              style={{
                whiteSpace: "pre-line",
                fontSize: 12,
                color: "#374151",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
              }}
            >
              {loadingRule ? "Caricamento regola automatica..." : automaticSummary}
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={ruleDraft.enabled}
                onChange={(e) => setRuleDraft((prev) => ({ ...prev, enabled: e.target.checked, mode: "AUTOMATICO" }))}
              />
              Regola automatica attiva
            </label>

            <label style={{ display: "block", marginBottom: 10 }}>
              Giorni prima della scadenza<br />
              <select
                value={ruleDraft.days_before}
                onChange={(e) =>
                  setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", days_before: Number(e.target.value) }))
                }
                style={{ width: "100%", padding: 8 }}
              >
                {RENEWAL_ALERT_DAY_PRESETS.map((days) => (
                  <option key={days} value={days}>
                    {days} giorni
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={ruleDraft.send_to_cliente}
                  onChange={(e) =>
                    setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", send_to_cliente: e.target.checked }))
                  }
                />
                Cliente
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={ruleDraft.send_to_art_tech}
                  onChange={(e) =>
                    setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", send_to_art_tech: e.target.checked }))
                  }
                />
                Art Tech
              </label>
            </div>

            {ruleDraft.send_to_art_tech && (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="renewals-rule-art-tech-mode"
                      checked={ruleDraft.art_tech_mode === "OPERATORE"}
                      onChange={() =>
                        setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", art_tech_mode: "OPERATORE" }))
                      }
                    />
                    Operatore
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="radio"
                      name="renewals-rule-art-tech-mode"
                      checked={ruleDraft.art_tech_mode === "EMAIL"}
                      onChange={() =>
                        setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", art_tech_mode: "EMAIL" }))
                      }
                    />
                    Email manuale
                  </label>
                </div>

                {ruleDraft.art_tech_mode === "OPERATORE" ? (
                  <label style={{ display: "block", marginBottom: 10 }}>
                    Operatore Art Tech<br />
                    <select
                      value={ruleDraft.art_tech_operatore_id || ""}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({
                          ...prev,
                          mode: "AUTOMATICO",
                          art_tech_operatore_id: e.target.value || null,
                        }))
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="">—</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.nome ?? "—"}
                          {op.ruolo ? ` — ${op.ruolo}` : ""}
                          {op.email ? ` — ${op.email}` : " — (senza email)"}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <input
                      placeholder="Email Art Tech"
                      value={ruleDraft.art_tech_email || ""}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", art_tech_email: e.target.value }))
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                    <input
                      placeholder="Nome (opzionale)"
                      value={ruleDraft.art_tech_name || ""}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({ ...prev, mode: "AUTOMATICO", art_tech_name: e.target.value }))
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>
                )}
              </>
            )}

            <label style={{ display: "block", marginBottom: 10 }}>
              Condizione stop invii<br />
              <select
                value={ruleDraft.stop_condition}
                onChange={(e) =>
                  setRuleDraft((prev) => ({
                    ...prev,
                    mode: "AUTOMATICO",
                    stop_condition: e.target.value as RenewalAlertRuleRow["stop_condition"],
                  }))
                }
                style={{ width: "100%", padding: 8 }}
              >
                {RENEWAL_ALERT_STOP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {ruleDraft.stop_condition === "ON_STATUS" && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10, fontSize: 12 }}>
                {RENEWAL_ALERT_STOP_STATUS_OPTIONS.map((status) => (
                  <label key={status} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={ruleDraft.stop_statuses.includes(status)}
                      onChange={(e) =>
                        setRuleDraft((prev) => ({
                          ...prev,
                          mode: "AUTOMATICO",
                          stop_statuses: e.target.checked
                            ? Array.from(new Set([...prev.stop_statuses, status]))
                            : prev.stop_statuses.filter((item) => item !== status),
                        }))
                      }
                    />
                    {status}
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
            }}
          >
            Annulla
          </button>
          {mode === "MANUALE" ? (
            <button
              type="button"
              onClick={() =>
                onSubmitManual({
                  toCliente,
                  toArtTech,
                  artTechMode,
                  operatoreId,
                  manualEmail,
                  manualName,
                  subject,
                  message,
                  sendEmail,
                })
              }
              disabled={manualSending || !canSendManual}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                opacity: manualSending || !canSendManual ? 0.6 : 1,
              }}
            >
              {manualSending ? "Invio..." : "Invia"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSaveRule({ ...ruleDraft, cliente, stage, mode: "AUTOMATICO" })}
              disabled={
                ruleSaving ||
                !ruleDraft.enabled ||
                (!ruleDraft.send_to_cliente && !ruleDraft.send_to_art_tech) ||
                (ruleDraft.send_to_art_tech &&
                  ruleDraft.art_tech_mode === "OPERATORE" &&
                  !ruleDraft.art_tech_operatore_id) ||
                (ruleDraft.send_to_art_tech &&
                  ruleDraft.art_tech_mode === "EMAIL" &&
                  !isValidEmail(ruleDraft.art_tech_email))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                opacity:
                  ruleSaving ||
                  !ruleDraft.enabled ||
                  (!ruleDraft.send_to_cliente && !ruleDraft.send_to_art_tech)
                    ? 0.6
                    : 1,
              }}
            >
              {ruleSaving ? "Salvataggio..." : "Salva regola automatica"}
            </button>
          )}
        </div>

        {error && <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>{error}</div>}
        {success && <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>{success}</div>}
      </div>
    </div>
  );
}

