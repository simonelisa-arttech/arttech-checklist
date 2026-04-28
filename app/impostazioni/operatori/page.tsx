"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type OperatoreRow = {
  id?: string;
  user_id?: string | null;
  nome: string;
  ruolo: string;
  email: string;
  attivo: boolean;
  alert_enabled?: boolean;
  riceve_notifiche?: boolean;
  can_access_impostazioni?: boolean;
  can_access_backoffice?: boolean;
  can_access_operator_app?: boolean;
  alert_tasks?: {
    task_template_ids: string[];
    all_task_status_change: boolean;
    on_checklist_open: boolean;
    allow_manual: boolean;
    allow_automatic: boolean;
    allow_scheduled: boolean;
  };
  isNew?: boolean;
};

const RUOLI = [
  "MAGAZZINO",
  "TECNICO_SW",
  "TECNICO_HW",
  "SUPERVISORE",
  "COMMERCIALE",
  "AMMINISTRAZIONE",
];

const OPERATORI_GRID_COLUMNS =
  "minmax(180px, 1.35fr) minmax(120px, 0.9fr) minmax(220px, 1.45fr) 84px 84px 94px 94px 94px 84px minmax(220px, 1fr)";

const compactBooleanBadgeStyle = (enabled: boolean) =>
  ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 26,
    padding: "2px 6px",
    borderRadius: 999,
    border: `1px solid ${enabled ? "#86efac" : "#d1d5db"}`,
    background: enabled ? "#dcfce7" : "#f3f4f6",
    color: enabled ? "#166534" : "#4b5563",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1,
  }) satisfies CSSProperties;

export default function OperatoriPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperatoreRow[]>([]);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [credenzialiNome, setCredenzialiNome] = useState("");
  const [credenzialiEmail, setCredenzialiEmail] = useState("");
  const [credenzialiRuolo, setCredenzialiRuolo] = useState("TECNICO_SW");
  const [credenzialiSaving, setCredenzialiSaving] = useState(false);
  const [credenzialiMsg, setCredenzialiMsg] = useState<string | null>(null);
  const [credenzialiErr, setCredenzialiErr] = useState<string | null>(null);
  const [resettingOperatoreId, setResettingOperatoreId] = useState<string | null>(null);
  const [realigning, setRealigning] = useState(false);

  function defaultAlertTasks() {
    return {
      task_template_ids: [] as string[],
      all_task_status_change: false,
      on_checklist_open: false,
      allow_manual: true,
      allow_automatic: true,
      allow_scheduled: true,
    };
  }

  function normalizeAlertTasks(input: any) {
    if (!input) {
      return defaultAlertTasks();
    }
    if (Array.isArray(input)) {
      return {
        task_template_ids: input.filter(Boolean).map(String),
        all_task_status_change: false,
        on_checklist_open: false,
        allow_manual: true,
        allow_automatic: true,
        allow_scheduled: true,
      };
    }
    if (typeof input === "object") {
      const ids = Array.isArray(input.task_template_ids)
        ? input.task_template_ids.filter(Boolean).map(String)
        : [];
      const all = Boolean(input.all_task_status_change);
      return {
        task_template_ids: ids,
        all_task_status_change: all,
        on_checklist_open: Boolean(input.on_checklist_open),
        allow_manual: input.allow_manual !== false,
        allow_automatic: input.allow_automatic !== false,
        allow_scheduled: input.allow_scheduled !== false,
      };
    }
    return defaultAlertTasks();
  }

  async function loadOperatori() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/operatori");
    if (!res.ok) {
      let msg = "Errore caricamento operatori";
      try {
        const data = await res.json();
        msg = data?.error || msg;
      } catch {
        // ignore
      }
      setError(msg);
      setLoading(false);
      return;
    }
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    const data = payload?.data || [];
    const mapped = (data || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id ?? null,
      nome: r.nome ?? "",
      ruolo: r.ruolo ?? "",
      email: r.email ?? "",
      attivo: Boolean(r.attivo),
      alert_enabled: Boolean(r.alert_enabled),
      riceve_notifiche: r.riceve_notifiche !== false,
      can_access_impostazioni: r.can_access_impostazioni === true,
      can_access_backoffice: r.can_access_backoffice === true,
      can_access_operator_app: r.can_access_operator_app !== false,
      alert_tasks: normalizeAlertTasks(r.alert_tasks),
      isNew: false,
    }));
    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    loadOperatori();
    loadAdminAccess();
  }, []);

  async function loadAdminAccess() {
    setAdminLoading(true);
    const res = await fetch("/api/admin/me");
    setIsAdmin(res.ok);
    setAdminLoading(false);
  }


  function addRow() {
    setRows((prev) => [
      {
        nome: "",
        ruolo: "",
        email: "",
        attivo: true,
        alert_enabled: false,
        riceve_notifiche: true,
        can_access_impostazioni: false,
        can_access_backoffice: false,
        can_access_operator_app: true,
        alert_tasks: defaultAlertTasks(),
        isNew: true,
      },
      ...prev,
    ]);
  }

  function updateRow(idx: number, patch: Partial<OperatoreRow>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  async function saveRowByIndex(idx: number) {
    const row = rows[idx];
    if (!row) return;
    const payload = {
      id: row.id,
      nome: row.nome.trim() ? row.nome.trim() : null,
      ruolo: row.ruolo.trim() ? row.ruolo.trim() : null,
      email: row.email.trim() ? row.email.trim() : null,
      attivo: row.attivo,
      alert_enabled: Boolean(row.alert_enabled),
      riceve_notifiche: row.riceve_notifiche !== false,
      can_access_impostazioni: row.can_access_impostazioni === true,
      can_access_backoffice: row.can_access_backoffice === true,
      can_access_operator_app: row.can_access_operator_app !== false,
      alert_tasks: normalizeAlertTasks(row.alert_tasks),
    };

    if (!payload.nome || !payload.ruolo) {
      setError("Nome e ruolo sono obbligatori.");
      return;
    }

    if (payload.email && !payload.email.includes("@")) {
      setError("Email non valida.");
      return;
    }

    const method = row.id ? "PATCH" : "POST";
    const res = await fetch("/api/operatori", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = "Errore salvataggio operatore";
      try {
        const data = await res.json();
        msg = data?.error || msg;
      } catch {
        // ignore
      }
      setError(msg);
      return;
    }

    await loadOperatori();
  }

  async function createQuickAdmin() {
    setQuickError(null);
    const name = quickName.trim();
    const email = quickEmail.trim();
    if (!name || !email) {
      setQuickError("Nome ed email sono obbligatori.");
      return;
    }
    if (!email.includes("@")) {
      setQuickError("Email non valida.");
      return;
    }
    const hasAdminRole = rows.some(
      (r) => String(r.ruolo || "").toUpperCase() === "ADMIN"
    );
    const ruolo = hasAdminRole ? "ADMIN" : "AMMINISTRAZIONE";
    setQuickSaving(true);
    try {
      const payload = {
        nome: name,
        ruolo,
        email,
        attivo: true,
        alert_enabled: true,
        riceve_notifiche: true,
        alert_tasks: defaultAlertTasks(),
      };
      const res = await fetch("/api/operatori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = "Errore salvataggio operatore";
        try {
          const data = await res.json();
          msg = data?.error || msg;
        } catch {
          // ignore
        }
        setQuickError(msg);
        return;
      }
      await loadOperatori();
      setShowQuickStart(false);
      setQuickName("");
      setQuickEmail("");
    } finally {
      setQuickSaving(false);
    }
  }

  async function createOperatorCredentials() {
    setCredenzialiErr(null);
    setCredenzialiMsg(null);
    const nome = credenzialiNome.trim();
    const email = credenzialiEmail.trim().toLowerCase();
    const ruolo = credenzialiRuolo.trim().toUpperCase();
    if (!nome || !email || !ruolo) {
      setCredenzialiErr("Nome, email e ruolo sono obbligatori.");
      return;
    }
    if (!email.includes("@")) {
      setCredenzialiErr("Email non valida.");
      return;
    }
    setCredenzialiSaving(true);
    try {
      const res = await fetch("/api/admin/create-operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, ruolo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCredenzialiErr(data?.error || "Errore creazione credenziali");
        return;
      }
      setCredenzialiMsg(`Invito inviato a ${email}`);
      setCredenzialiNome("");
      setCredenzialiEmail("");
      await loadOperatori();
    } finally {
      setCredenzialiSaving(false);
    }
  }

  async function sendResetPassword(row: OperatoreRow) {
    if (!row.id && !row.email) return;
    const ok = window.confirm(
      `Inviare reset password a ${row.email || "questo operatore"}?`
    );
    if (!ok) return;
    setError(null);
    setCredenzialiMsg(null);
    setResettingOperatoreId(row.id || null);
    try {
      const res = await fetch("/api/admin/reset-operator-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatore_id: row.id,
          email: row.email || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore invio reset password");
        return;
      }
      setCredenzialiMsg(`Reset password inviato a ${row.email || data?.email || "operatore"}`);
      await loadOperatori();
    } finally {
      setResettingOperatoreId(null);
    }
  }

  async function realignOperatoriNow() {
    setError(null);
    setCredenzialiErr(null);
    setCredenzialiMsg(null);
    setRealigning(true);
    try {
      const res = await fetch("/api/admin/realign-operatori", { method: "POST" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setError(data?.error || "Errore riallineamento operatori");
        return;
      }
      const issues = Array.isArray(data?.update_errors) ? data.update_errors.length : 0;
      setCredenzialiMsg(
        `Riallineamento completato: aggiornati ${data?.updated ?? 0}, già allineati ${data?.already_aligned ?? 0}, senza utente auth ${data?.missing_auth_user ?? 0}${issues ? `, errori ${issues}` : ""}.`
      );
      await loadOperatori();
    } finally {
      setRealigning(false);
    }
  }

  async function deleteRow(row: OperatoreRow) {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r !== row));
      return;
    }
    const ok = window.confirm("Eliminare questo operatore?");
    if (!ok) return;
    const res = await fetch(`/api/operatori?id=${encodeURIComponent(row.id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      let msg = "Errore eliminazione operatore";
      msg = data?.error || msg;
      setError(msg);
      return;
    }
    if (data?.mode === "deactivated") {
      setCredenzialiMsg(
        data?.message || "Operatore disattivato (referenziato da checklist, non eliminabile)."
      );
    }
    await loadOperatori();
  }

  function renderBooleanCell(
    checked: boolean,
    onChange: (next: boolean) => void,
    ariaLabel: string
  ) {
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minWidth: 0,
        }}
      >
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={ariaLabel} />
        <span style={compactBooleanBadgeStyle(checked)}>{checked ? "SI" : "NO"}</span>
      </label>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
            ANAGRAFICA OPERATORI
          </div>
        </div>
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

      {!adminLoading && isAdmin && (
        <div
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Crea credenziali operatore
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 180px auto" }}>
            <input
              placeholder="Nome"
              value={credenzialiNome}
              onChange={(e) => setCredenzialiNome(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
            <input
              placeholder="Email"
              value={credenzialiEmail}
              onChange={(e) => setCredenzialiEmail(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
            <select
              value={credenzialiRuolo}
              onChange={(e) => setCredenzialiRuolo(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              {["ADMIN", ...RUOLI].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createOperatorCredentials}
              disabled={credenzialiSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
                opacity: credenzialiSaving ? 0.7 : 1,
              }}
            >
              {credenzialiSaving ? "Invio..." : "Crea + Invia invito"}
            </button>
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={realignOperatoriNow}
              disabled={realigning}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                opacity: realigning ? 0.7 : 1,
              }}
            >
              {realigning ? "Riallineamento..." : "Riallinea operatori ora"}
            </button>
          </div>
          {credenzialiErr && (
            <div style={{ marginTop: 8, color: "#991b1b", fontSize: 13 }}>
              {credenzialiErr}
            </div>
          )}
          {credenzialiMsg && (
            <div style={{ marginTop: 8, color: "#166534", fontSize: 13 }}>
              {credenzialiMsg}
            </div>
          )}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #fde68a",
            background: "#fffbeb",
          }}
        >
          <div style={{ fontWeight: 700 }}>📌 Primo avvio</div>
          <div style={{ marginTop: 6, marginBottom: 10 }}>
            Crea il primo operatore per iniziare a usare la piattaforma.
          </div>
          <button
            type="button"
            onClick={() => setShowQuickStart(true)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            Crea Admin rapido
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
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
          + Nuovo operatore
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
            paddingBottom: 6,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: OPERATORI_GRID_COLUMNS,
              padding: "10px 12px",
              fontWeight: 700,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
              fontSize: 13,
              gap: 8,
              alignItems: "center",
            }}
          >
            <div>Nome</div>
            <div>Ruolo</div>
            <div>Email</div>
            <div>Attivo</div>
            <div>Alert</div>
            <div>Notif.</div>
            <div>Impost.</div>
            <div>Backoffice</div>
            <div>App</div>
            <div>Azioni</div>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Nessun operatore</div>
          ) : (
            rows.map((row, idx) => (
              <div key={row.id ?? `new-${idx}`}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: OPERATORI_GRID_COLUMNS,
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    value={row.nome}
                    onChange={(e) => updateRow(idx, { nome: e.target.value })}
                    style={{ width: "100%", padding: 8, minWidth: 0 }}
                  />
                  <select
                    value={row.ruolo}
                    onChange={(e) => updateRow(idx, { ruolo: e.target.value })}
                    style={{ width: "100%", padding: 8, minWidth: 0 }}
                  >
                    <option value="">—</option>
                    {RUOLI.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    value={row.email}
                    onChange={(e) => updateRow(idx, { email: e.target.value })}
                    style={{ width: "100%", padding: 8, minWidth: 0 }}
                  />
                  {renderBooleanCell(row.attivo, (next) => updateRow(idx, { attivo: next }), "Attivo")}
                  {renderBooleanCell(
                    Boolean(row.alert_enabled),
                    (next) => updateRow(idx, { alert_enabled: next }),
                    "Alert attivi"
                  )}
                  {renderBooleanCell(
                    row.riceve_notifiche !== false,
                    (next) => updateRow(idx, { riceve_notifiche: next }),
                    "Riceve notifiche"
                  )}
                  {renderBooleanCell(
                    row.can_access_impostazioni === true,
                    (next) => updateRow(idx, { can_access_impostazioni: next }),
                    "Accesso impostazioni"
                  )}
                  {renderBooleanCell(
                    row.can_access_backoffice === true,
                    (next) => updateRow(idx, { can_access_backoffice: next }),
                    "Accesso backoffice"
                  )}
                  {renderBooleanCell(
                    row.can_access_operator_app !== false,
                    (next) => updateRow(idx, { can_access_operator_app: next }),
                    "Accesso app operatori"
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => saveRowByIndex(idx)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: "#111",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      Salva
                    </button>
                    {!adminLoading && isAdmin && (
                      <button
                        type="button"
                        onClick={() => sendResetPassword(row)}
                        disabled={resettingOperatoreId === row.id || !row.email}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                          opacity: resettingOperatoreId === row.id || !row.email ? 0.6 : 1,
                        }}
                      >
                        {resettingOperatoreId === row.id
                          ? "Invio reset..."
                          : "Invia reset password"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showQuickStart && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Crea Admin rapido
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
              Ruolo predefinito:{" "}
              {rows.some((r) => String(r.ruolo || "").toUpperCase() === "ADMIN")
                ? "ADMIN"
                : "AMMINISTRAZIONE"}
            </div>
            {quickError && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#fee2e2",
                  color: "#991b1b",
                  marginBottom: 10,
                  fontSize: 13,
                }}
              >
                {quickError}
              </div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              <input
                placeholder="Nome"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
              <input
                placeholder="Email"
                value={quickEmail}
                onChange={(e) => setQuickEmail(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowQuickStart(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={createQuickAdmin}
                disabled={quickSaving}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: "pointer",
                  opacity: quickSaving ? 0.7 : 1,
                }}
              >
                {quickSaving ? "Salvataggio..." : "Crea"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
