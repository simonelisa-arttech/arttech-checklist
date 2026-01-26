"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OperatoreRow = {
  id?: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OperatoreRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<
    { id: string; sezione: string | null; titolo: string | null; ordine: number | null }[]
  >([]);
  const [taskSearch, setTaskSearch] = useState("");

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
    const { data, error: err } = await supabase
      .from("operatori")
      .select("*")
      .order("ruolo", { ascending: true })
      .order("nome", { ascending: true });

    if (err) {
      setError("Errore caricamento operatori: " + err.message);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map((r: any) => ({
      id: r.id,
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
  }, []);

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

    if (row.id) {
      const { error: err } = await supabase
        .from("operatori")
        .update(payload)
        .eq("id", row.id);
      if (err) {
        setError("Errore salvataggio operatore: " + err.message);
        return;
      }
    } else {
      const { error: err } = await supabase.from("operatori").insert(payload);
      if (err) {
        setError("Errore inserimento operatore: " + err.message);
        return;
      }
    }

    await loadOperatori();
  }

  async function deleteRow(row: OperatoreRow) {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r !== row));
      return;
    }
    const ok = window.confirm("Eliminare questo operatore?");
    if (!ok) return;
    const { error: err } = await supabase.from("operatori").delete().eq("id", row.id);
    if (err) {
      setError("Errore eliminazione operatore: " + err.message);
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
        <Link
          href="/impostazioni/checklist-attivita"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Gestisci checklist operativa
        </Link>
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
                                      const set = new Set(current.task_template_ids);
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
    </div>
  );
}
