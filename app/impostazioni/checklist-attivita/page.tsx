"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type TaskTemplateRow = {
  id?: string;
  sezione: string;
  ordine: number | null;
  titolo: string;
  target: string;
  attivo: boolean;
  isNew?: boolean;
};

type RuleDraft = {
  id?: string;
  checklist_id: string | null;
  task_template_id: string | null;
  task_title: string;
  target: string;
  enabled: boolean;
  mode: "AUTOMATICA" | "MANUALE";
  recipients: string[]; // extra recipients only
  frequency: "DAILY" | "WEEKDAYS" | "WEEKLY";
  send_time: string;
  timezone: string;
  day_of_week: number | null;
  send_on_create: boolean;
  only_future: boolean;
};

export default function ChecklistAttivitaPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TaskTemplateRow[]>([]);
  const [targetOptions, setTargetOptions] = useState<string[]>([
    "GENERICA",
    "MAGAZZINO",
    "TECNICO_SW",
  ]);
  const [filterSezione, setFilterSezione] = useState<string>("TUTTE");
  const [filterTitolo, setFilterTitolo] = useState<string>("");
  const [ruleTask, setRuleTask] = useState<TaskTemplateRow | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleRecipientsInput, setRuleRecipientsInput] = useState("");
  const [ruleAutoRecipients, setRuleAutoRecipients] = useState<string[]>([]);
  const [ruleEffectiveRecipients, setRuleEffectiveRecipients] = useState<string[]>([]);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);

  async function loadRows() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/impostazioni/checklist-attivita", {
      method: "GET",
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("Errore caricamento attività: " + (json?.error || "Errore"));
      setLoading(false);
      return;
    }
    const data = Array.isArray(json?.data) ? json.data : [];
    const availableTargets = Array.isArray(json?.available_targets)
      ? json.available_targets.map((x: any) => String(x || "").trim().toUpperCase()).filter(Boolean)
      : [];
    setTargetOptions(
      Array.from(new Set(["GENERICA", "MAGAZZINO", "TECNICO_SW", ...availableTargets]))
    );

    const mapped = data.map((r: any) => ({
      id: r.id,
      sezione: r.sezione ?? "",
      ordine: Number.isFinite(Number(r.ordine)) ? Number(r.ordine) : null,
      titolo: r.titolo ?? "",
      target: String(r.target || "GENERICA").trim().toUpperCase() || "GENERICA",
      attivo: Boolean(r.attivo),
      isNew: false,
    }));
    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, []);

  function addRow() {
    setRows((prev) => [
      {
        sezione: "DOCUMENTI",
        ordine: null,
        titolo: "",
        target: "GENERICA",
        attivo: true,
        isNew: true,
      },
      ...prev,
    ]);
  }

  function updateRow(idx: number, patch: Partial<TaskTemplateRow>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  async function saveRow(row: TaskTemplateRow) {
    const payload = {
      sezione: row.sezione.trim() ? row.sezione.trim() : null,
      ordine: row.ordine != null ? row.ordine : null,
      titolo: row.titolo.trim() ? row.titolo.trim() : null,
      target: String(row.target || "GENERICA").trim().toUpperCase() || "GENERICA",
      attivo: Boolean(row.attivo),
    };

    if (!payload.sezione || !payload.titolo) {
      setError("Sezione e Titolo sono obbligatori.");
      return;
    }

    if (row.id) {
      const res = await fetch("/api/impostazioni/checklist-attivita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...payload, id: row.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Errore salvataggio attività: " + (json?.error || "Errore"));
        return;
      }
    } else {
      const res = await fetch("/api/impostazioni/checklist-attivita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("Errore inserimento attività: " + (json?.error || "Errore"));
        return;
      }
    }

    await loadRows();
  }

  function parseRecipientsInput(input: string) {
    return input
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function openGlobalRule(task: TaskTemplateRow) {
    setRuleTask(task);
    setRuleLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        task_title: task.titolo,
        target: String(task.target || "GENERICA").trim().toUpperCase(),
      });
      if (task.id) query.set("task_template_id", task.id);
      const res = await fetch(`/api/notification-rules?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Errore caricamento regola.");
      const row = json?.global_rule || json?.effective_rule || (Array.isArray(json?.data) ? json.data[0] : null);
      const target = String(task.target || "GENERICA").trim().toUpperCase() || "GENERICA";
      const next: RuleDraft = row
        ? {
            id: row.id,
            checklist_id: null,
            task_template_id: row.task_template_id || task.id || null,
            task_title: row.task_title || task.titolo,
            target: String(row.target || target).trim().toUpperCase() || "GENERICA",
            enabled: row.enabled !== false,
            mode: row.mode === "MANUALE" ? "MANUALE" : "AUTOMATICA",
            recipients: Array.isArray(row.recipients)
              ? (row.extra_recipients || row.recipients)
                  .map((x: any) => String(x || "").trim().toLowerCase())
                  .filter((x: string) => x.includes("@"))
              : [],
            frequency:
              row.frequency === "WEEKLY" || row.frequency === "WEEKDAYS"
                ? row.frequency
                : "DAILY",
            send_time: String(row.send_time || "07:30").slice(0, 5),
            timezone: String(row.timezone || "Europe/Rome"),
            day_of_week:
              row.day_of_week === null || row.day_of_week === undefined ? null : Number(row.day_of_week),
            send_on_create: row.send_on_create === true,
            only_future: row.only_future !== false,
          }
        : {
            checklist_id: null,
            task_template_id: task.id || null,
            task_title: task.titolo,
            target,
            enabled: true,
            mode: target === "MAGAZZINO" || target === "TECNICO_SW" ? "AUTOMATICA" : "MANUALE",
            recipients: [],
            frequency: "DAILY",
            send_time: "07:30",
            timezone: "Europe/Rome",
            day_of_week: null,
            send_on_create: false,
            only_future: true,
          };
      setRuleDraft(next);
      setRuleRecipientsInput(next.recipients.join(", "));
      setRuleAutoRecipients(
        Array.isArray(json?.auto_recipients)
          ? json.auto_recipients
              .map((x: any) => String(x || "").trim().toLowerCase())
              .filter((x: string) => x.includes("@"))
          : []
      );
      setRuleEffectiveRecipients(
        Array.isArray(json?.effective_recipients)
          ? json.effective_recipients
              .map((x: any) => String(x || "").trim().toLowerCase())
              .filter((x: string) => x.includes("@"))
          : []
      );
    } catch (err: any) {
      setError(err?.message || "Errore caricamento regola.");
      setRuleTask(null);
      setRuleDraft(null);
    } finally {
      setRuleLoading(false);
    }
  }

  function closeRuleModal() {
    setRuleTask(null);
    setRuleDraft(null);
    setRuleRecipientsInput("");
    setRuleAutoRecipients([]);
    setRuleEffectiveRecipients([]);
    setRuleLoading(false);
    setRuleSaving(false);
  }

  async function saveGlobalRule() {
    if (!ruleDraft) return;
    setRuleSaving(true);
    setError(null);
    try {
      const payload = {
        ...ruleDraft,
        checklist_id: null,
        recipients: parseRecipientsInput(ruleRecipientsInput),
        day_of_week: ruleDraft.frequency === "WEEKLY" ? ruleDraft.day_of_week ?? 1 : null,
      };
      const res = await fetch("/api/notification-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Errore salvataggio regola.");
      closeRuleModal();
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio regola.");
    } finally {
      setRuleSaving(false);
    }
  }

  const sezioneOptions = Array.from(
    new Set(
      ["DOCUMENTI", "SEZIONE 1", "SEZIONE 2", "SEZIONE 3"].concat(
        rows.map((r) => r.sezione).filter(Boolean)
      )
    )
  );

  const filteredRows = rows.filter((r) => {
    const okSezione = filterSezione === "TUTTE" || r.sezione === filterSezione;
    const q = filterTitolo.trim().toLowerCase();
    const okTitolo = !q || r.titolo.toLowerCase().includes(q);
    return okSezione && okTitolo;
  });

  return (
    <div style={{ maxWidth: 1240, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
            IMPOSTAZIONI ATTIVITA CHECKLIST
          </div>
        </div>
        <Link
          href="/"
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            background: "white",
            marginLeft: "auto",
          }}
        >
          ← Dashboard
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fee2e2",
            color: "#991b1b",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <label>
          Sezione<br />
          <select
            value={filterSezione}
            onChange={(e) => setFilterSezione(e.target.value)}
            style={{ padding: "6px 8px", minWidth: 180 }}
          >
            <option value="TUTTE">Tutte</option>
            {sezioneOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cerca titolo<br />
          <input
            value={filterTitolo}
            onChange={(e) => setFilterTitolo(e.target.value)}
            placeholder="Cerca..."
            style={{ padding: "6px 8px", minWidth: 220 }}
          />
        </label>
        <button
          type="button"
          onClick={addRow}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          + Nuova attività
        </button>
      </div>

      {loading ? (
        <div style={{ opacity: 0.7 }}>Caricamento...</div>
      ) : (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            overflowX: "auto",
            fontSize: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(120px,0.9fr) 72px minmax(360px,2.8fr) 170px 86px 92px 150px",
              padding: "10px 12px",
              fontWeight: 700,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
            }}
          >
            <div>Sezione</div>
            <div>Ordine</div>
            <div>Titolo</div>
            <div>Target</div>
            <div>Attivo</div>
            <div>Salva</div>
            <div>Regola globale</div>
          </div>
          {filteredRows.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Nessuna attività</div>
          ) : (
            filteredRows.map((row) => {
              const idx = rows.indexOf(row);
              return (
              <div
                key={row.id ?? `new-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(120px,0.9fr) 72px minmax(360px,2.8fr) 170px 86px 92px 150px",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <select
                  value={row.sezione}
                  onChange={(e) => updateRow(idx, { sezione: e.target.value })}
                  style={{ width: "100%", padding: "6px 8px", minWidth: 0, fontSize: 14 }}
                >
                  {sezioneOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={row.ordine ?? ""}
                  onChange={(e) =>
                    updateRow(idx, {
                      ordine: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  style={{ width: "100%", padding: "6px 8px", fontSize: 14 }}
                />
                <input
                  value={row.titolo}
                  onChange={(e) => updateRow(idx, { titolo: e.target.value })}
                  style={{ width: "100%", padding: "6px 8px", minWidth: 0, fontSize: 14 }}
                />
                <select
                  value={row.target || "GENERICA"}
                  onChange={(e) =>
                    updateRow(idx, { target: String(e.target.value || "GENERICA").toUpperCase() })
                  }
                  style={{ width: "100%", padding: "6px 8px", minWidth: 0, fontSize: 14 }}
                >
                  {targetOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={row.attivo}
                    onChange={(e) => updateRow(idx, { attivo: e.target.checked })}
                  />
                  {row.attivo ? "Si" : "No"}
                </label>
                <div>
                  <button
                    type="button"
                    onClick={() => saveRow(row)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Salva
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => openGlobalRule(row)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 8,
                      border: "1px solid #0f172a",
                      background: "#f8fafc",
                      cursor: "pointer",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⚙ Regola globale
                  </button>
                </div>
              </div>
            )})
          )}
        </div>
      )}
      {ruleTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 640,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Regola globale notifiche</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
              Task: {ruleTask.titolo}
              <br />
              Target: <strong>{ruleDraft?.target || ruleTask.target}</strong>
            </div>
            {ruleLoading || !ruleDraft ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Caricamento...</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={ruleDraft.enabled}
                      onChange={(e) =>
                        setRuleDraft((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))
                      }
                    />
                    Abilitata
                  </label>
                  <label>
                    Mode<br />
                    <select
                      value={ruleDraft.mode}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev
                            ? { ...prev, mode: e.target.value === "MANUALE" ? "MANUALE" : "AUTOMATICA" }
                            : prev
                        )
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="AUTOMATICA">AUTOMATICA</option>
                      <option value="MANUALE">MANUALE</option>
                    </select>
                  </label>
                </div>
                <label style={{ display: "block", marginTop: 10 }}>
                  Destinatari automatici (da target)<br />
                  <div
                    style={{
                      minHeight: 38,
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                      background: "#fafafa",
                    }}
                  >
                    {ruleAutoRecipients.length
                      ? ruleAutoRecipients.join(", ")
                      : "Nessun operatore attivo con riceve_notifiche per questo target."}
                  </div>
                </label>
                <label style={{ display: "block", marginTop: 10 }}>
                  Email extra (opzionali, puoi scrivere email o nome operatore)<br />
                  <textarea
                    value={ruleRecipientsInput}
                    onChange={(e) => setRuleRecipientsInput(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  Destinatari effettivi:{" "}
                  {ruleEffectiveRecipients.length ? ruleEffectiveRecipients.join(", ") : "—"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <label>
                    Frequenza<br />
                    <select
                      value={ruleDraft.frequency}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                frequency:
                                  e.target.value === "WEEKLY"
                                    ? "WEEKLY"
                                    : e.target.value === "WEEKDAYS"
                                      ? "WEEKDAYS"
                                      : "DAILY",
                              }
                            : prev
                        )
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="DAILY">DAILY</option>
                      <option value="WEEKDAYS">WEEKDAYS</option>
                      <option value="WEEKLY">WEEKLY</option>
                    </select>
                  </label>
                  <label>
                    Ora invio<br />
                    <input
                      type="time"
                      value={ruleDraft.send_time}
                      onChange={(e) =>
                        setRuleDraft((prev) => (prev ? { ...prev, send_time: e.target.value } : prev))
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <label>
                    Timezone<br />
                    <input
                      value={ruleDraft.timezone}
                      onChange={(e) =>
                        setRuleDraft((prev) => (prev ? { ...prev, timezone: e.target.value } : prev))
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </div>
                {ruleDraft.mode === "AUTOMATICA" && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={ruleDraft.send_on_create}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev ? { ...prev, send_on_create: e.target.checked } : prev
                        )
                      }
                    />
                    Invia anche alla creazione della checklist
                  </label>
                )}
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={ruleDraft.only_future}
                    onChange={(e) =>
                      setRuleDraft((prev) => (prev ? { ...prev, only_future: e.target.checked } : prev))
                    }
                  />
                  Solo checklist future
                </label>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={closeRuleModal}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                    }}
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    onClick={saveGlobalRule}
                    disabled={ruleSaving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      opacity: ruleSaving ? 0.7 : 1,
                    }}
                  >
                    {ruleSaving ? "Salvataggio..." : "Salva regola globale"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
