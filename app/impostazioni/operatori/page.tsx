"use client";

import { useEffect, useMemo, useState } from "react";
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
  alert_tasks?: {
    task_template_ids: string[];
    all_task_status_change: boolean;
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

export default function OperatoriPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperatoreRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<
    { id: string; sezione: string | null; titolo: string | null; ordine: number | null }[]
  >([]);
  const [taskSearch, setTaskSearch] = useState("");
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

  function normalizeAlertTasks(input: any) {
    if (!input) {
      return { task_template_ids: [], all_task_status_change: false };
    }
    if (Array.isArray(input)) {
      return {
        task_template_ids: input.filter(Boolean).map(String),
        all_task_status_change: false,
      };
    }
    if (typeof input === "object") {
      const ids = Array.isArray(input.task_template_ids)
        ? input.task_template_ids.filter(Boolean).map(String)
        : [];
      const all = Boolean(input.all_task_status_change);
      return { task_template_ids: ids, all_task_status_change: all };
    }
    return { task_template_ids: [], all_task_status_change: false };
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
      alert_tasks: normalizeAlertTasks(r.alert_tasks),
      isNew: false,
    }));
    setRows(mapped);
    setLoading(false);
  }

  async function loadTaskTemplates() {
    const { data, error: err } = await supabase
      .from("checklist_task_templates")
      .select("id, sezione, titolo, ordine, attivo")
      .eq("attivo", true)
      .order("sezione", { ascending: true })
      .order("ordine", { ascending: true });

    if (err) {
      setError("Errore caricamento attività operative: " + err.message);
      return;
    }

    setTaskTemplates((data || []) as any[]);
  }

  useEffect(() => {
    loadOperatori();
    loadTaskTemplates();
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
        alert_tasks: { task_template_ids: [], all_task_status_change: false },
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

  async function saveRow(row: OperatoreRow) {
    const payload = {
      id: row.id,
      nome: row.nome.trim() ? row.nome.trim() : null,
      ruolo: row.ruolo.trim() ? row.ruolo.trim() : null,
      email: row.email.trim() ? row.email.trim() : null,
      attivo: row.attivo,
      alert_enabled: Boolean(row.alert_enabled),
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
        alert_tasks: { task_template_ids: [], all_task_status_change: false },
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
    if (!res.ok) {
      let msg = "Errore eliminazione operatore";
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

  const groupedTemplates = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    const filtered = taskTemplates.filter((t) =>
      !q ? true : String(t.titolo ?? "").toLowerCase().includes(q)
    );
    const map = new Map<string, typeof taskTemplates>();
    for (const t of filtered) {
      const key = t.sezione || "ALTRO";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [taskTemplates, taskSearch]);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
            IMPOSTAZIONI OPERATORI
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
              gridTemplateColumns:
                "minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(220px, 1.6fr) 90px 110px minmax(220px, 1fr)",
              padding: "10px 12px",
              fontWeight: 700,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
            }}
          >
            <div>Nome</div>
            <div>Ruolo</div>
            <div>Email</div>
            <div>Attivo</div>
            <div>Alert</div>
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
                    gridTemplateColumns:
                      "minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(220px, 1.6fr) 90px 110px minmax(220px, 1fr)",
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
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={row.attivo}
                      onChange={(e) => updateRow(idx, { attivo: e.target.checked })}
                    />
                    {row.attivo ? "Si" : "No"}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(row.alert_enabled)}
                      onChange={(e) =>
                        updateRow(idx, { alert_enabled: e.target.checked })
                      }
                    />
                    {row.alert_enabled ? "ON" : "OFF"}
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id || null))}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Preferenze alert
                    </button>
                    <button
                      type="button"
                      onClick={() => saveRow(row)}
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
                {expandedId && expandedId === row.id && (
                  <div
                    style={{
                      padding: "10px 12px 14px",
                      borderBottom: "1px solid #f3f4f6",
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Preferenze alert</div>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Cerca attività..."
                        style={{ padding: "6px 8px", minWidth: 240 }}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {Array.from(groupedTemplates.entries()).map(([section, templates]) => (
                        <div key={section}>
                          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
                            {section}
                          </div>
                          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                            {templates.map((t) => {
                              const checked = Boolean(
                                row.alert_tasks?.task_template_ids?.includes(t.id)
                              );
                              return (
                                <label
                                  key={t.id}
                                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!row.alert_enabled}
                                    checked={checked}
                                    onChange={(e) => {
                                      const current = normalizeAlertTasks(row.alert_tasks);
                                      const set = new Set<string>(current.task_template_ids);
                                      if (e.target.checked) {
                                        set.add(t.id);
                                      } else {
                                        set.delete(t.id);
                                      }
                                      updateRow(idx, {
                                        alert_tasks: {
                                          ...current,
                                          task_template_ids: Array.from(set),
                                        },
                                      });
                                    }}
                                  />
                                  {t.titolo ?? "—"}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          disabled={!row.alert_enabled}
                          checked={Boolean(row.alert_tasks?.all_task_status_change)}
                          onChange={(e) => {
                            const current = normalizeAlertTasks(row.alert_tasks);
                            updateRow(idx, {
                              alert_tasks: {
                                ...current,
                                all_task_status_change: e.target.checked,
                              },
                            });
                          }}
                        />
                        ALL_TASK_STATUS_CHANGE
                      </label>
                    </div>
                  </div>
                )}
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
