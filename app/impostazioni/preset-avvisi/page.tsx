"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import ConfigMancante from "@/components/ConfigMancante";

type AlertTemplate = {
  id: string;
  codice: string | null;
  titolo: string | null;
  tipo: string | null;
  trigger: string | null;
  subject_template: string | null;
  body_template: string | null;
  attivo: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type ToastState = { message: string; variant: "success" | "error" };

type ModalState = {
  open: boolean;
  mode: "create" | "edit";
  data: AlertTemplate;
};

const EMPTY_TEMPLATE: AlertTemplate = {
  id: "",
  codice: "",
  titolo: "",
  tipo: "GENERICO",
  trigger: "MANUALE",
  subject_template: "",
  body_template: "",
  attivo: true,
  created_at: null,
  updated_at: null,
};

export default function PresetAvvisiPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [currentOperatoreId, setCurrentOperatoreId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterTrigger, setFilterTrigger] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "create",
    data: { ...EMPTY_TEMPLATE },
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(message: string, variant: "success" | "error" = "success", duration = 2500) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }

  async function loadTemplates() {
    if (!currentOperatoreId) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/alert-templates", {
      headers: { "x-operatore-id": currentOperatoreId },
    });
    if (!res.ok) {
      let msg = "Errore caricamento preset";
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
    setTemplates((payload?.data || []) as AlertTemplate[]);
    setLoading(false);
  }

  useEffect(() => {
    if (currentOperatoreId) {
      loadTemplates();
    }
    if (currentOperatoreId === null) {
      setLoading(false);
      setError("Operatore non selezionato.");
    }
  }, [currentOperatoreId]);

  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.tipo) set.add(String(t.tipo));
    });
    return Array.from(set).sort();
  }, [templates]);

  const triggerOptions = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.trigger) set.add(String(t.trigger));
    });
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      const titolo = String(t.titolo || "").toLowerCase();
      const codice = String(t.codice || "").toLowerCase();
      if (q && !titolo.includes(q) && !codice.includes(q)) return false;
      if (filterTipo && String(t.tipo || "") !== filterTipo) return false;
      if (filterTrigger && String(t.trigger || "") !== filterTrigger) return false;
      return true;
    });
  }, [templates, search, filterTipo, filterTrigger]);

  function openCreate() {
    setModal({ open: true, mode: "create", data: { ...EMPTY_TEMPLATE } });
  }

  function openEdit(row: AlertTemplate) {
    setModal({
      open: true,
      mode: "edit",
      data: { ...row },
    });
  }

  function openDuplicate(row: AlertTemplate) {
    const baseCode = String(row.codice || "PRESET");
    const newCode = baseCode.includes("COPY") ? `${baseCode}-NEW` : `${baseCode}-COPY`;
    setModal({
      open: true,
      mode: "create",
      data: {
        ...row,
        id: "",
        codice: newCode,
        titolo: row.titolo ? `${row.titolo} (copia)` : "Copia preset",
      },
    });
  }

  function updateModal(patch: Partial<AlertTemplate>) {
    setModal((prev) => ({
      ...prev,
      data: { ...prev.data, ...patch },
    }));
  }

  async function saveModal() {
    if (!currentOperatoreId) {
      showToast("Operatore non selezionato", "error");
      return;
    }
    const payload = {
      id: modal.mode === "edit" ? modal.data.id : undefined,
      codice: modal.data.codice?.trim() || "",
      titolo: modal.data.titolo?.trim() || "",
      tipo: modal.data.tipo?.trim() || "",
      trigger: modal.data.trigger?.trim() || "",
      subject_template: modal.data.subject_template ?? "",
      body_template: modal.data.body_template ?? "",
      attivo: Boolean(modal.data.attivo),
    };
    if (!payload.codice || !payload.titolo) {
      showToast("Titolo e codice sono obbligatori", "error");
      return;
    }
    setSaving(true);
    const method = modal.mode === "edit" ? "PATCH" : "POST";
    const res = await fetch("/api/alert-templates", {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-operatore-id": currentOperatoreId,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let msg = "Errore salvataggio preset";
      try {
        const data = await res.json();
        msg = data?.error || msg;
      } catch {
        // ignore
      }
      showToast(msg, "error");
      setSaving(false);
      return;
    }
    await loadTemplates();
    setSaving(false);
    setModal((prev) => ({ ...prev, open: false }));
    showToast("Preset salvato", "success");
  }

  async function toggleAttivo(row: AlertTemplate) {
    if (!currentOperatoreId) {
      showToast("Operatore non selezionato", "error");
      return;
    }
    const res = await fetch("/api/alert-templates", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-operatore-id": currentOperatoreId,
      },
      body: JSON.stringify({
        id: row.id,
        codice: row.codice,
        titolo: row.titolo,
        tipo: row.tipo,
        trigger: row.trigger,
        subject_template: row.subject_template,
        body_template: row.body_template,
        attivo: !row.attivo,
      }),
    });
    if (!res.ok) {
      let msg = "Errore aggiornamento preset";
      try {
        const data = await res.json();
        msg = data?.error || msg;
      } catch {
        // ignore
      }
      showToast(msg, "error");
      return;
    }
    await loadTemplates();
    showToast("Preset aggiornato", "success");
  }

  const dashboardUrl = process.env.NEXT_PUBLIC_SUPABASE_DASHBOARD_URL || "";
  const canOpen = Boolean(dashboardUrl);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Preset avvisi</h1>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            Gestione template per email avvisi (LICENZA / TAGLIANDO / GENERICO)
          </div>
        </div>
        <Link
          href="/impostazioni/operatori"
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
          ← Operatori
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            placeholder="Cerca titolo o codice"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          >
            <option value="">Tutti i tipi</option>
            {tipoOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filterTrigger}
            onChange={(e) => setFilterTrigger(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          >
            <option value="">Tutti i trigger</option>
            {triggerOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            style={{
              marginLeft: "auto",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            + Nuovo preset
          </button>
          <button
            type="button"
            onClick={() => {
              if (canOpen) window.open(dashboardUrl, "_blank", "noopener,noreferrer");
            }}
            disabled={!canOpen}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: canOpen ? "pointer" : "default",
            }}
          >
            Apri in Supabase
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              borderRadius: 8,
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 12, opacity: 0.7 }}>Caricamento...</div>
        ) : (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              overflowX: "auto",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(200px, 1.6fr) minmax(140px, 1fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) 100px minmax(160px, 1fr) minmax(180px, 1fr)",
                padding: "10px 12px",
                fontWeight: 700,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
                fontSize: 13,
              }}
            >
              <div>Titolo</div>
              <div>Codice</div>
              <div>Tipo</div>
              <div>Trigger</div>
              <div>Attivo</div>
              <div>Updated</div>
              <div>Azioni</div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, opacity: 0.7 }}>
                Nessun preset trovato.
              </div>
            ) : (
              filtered.map((row) => {
                const updatedAt = row.updated_at
                  ? new Date(row.updated_at).toLocaleString()
                  : "—";
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(200px, 1.6fr) minmax(140px, 1fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) 100px minmax(160px, 1fr) minmax(180px, 1fr)",
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f1f1",
                      fontSize: 13,
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div>{row.titolo || "—"}</div>
                    <div>{row.codice || "—"}</div>
                    <div>{row.tipo || "—"}</div>
                    <div>{row.trigger || "—"}</div>
                    <div>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: row.attivo ? "#dcfce7" : "#e5e7eb",
                          color: row.attivo ? "#166534" : "#111",
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-block",
                        }}
                      >
                        {row.attivo ? "ATTIVO" : "OFF"}
                      </span>
                    </div>
                    <div>{updatedAt}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => openDuplicate(row)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Duplica
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttivo(row)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        {row.attivo ? "Disattiva" : "Attiva"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {modal.open && (
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
              maxWidth: 720,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {modal.mode === "edit" ? "Modifica preset" : "Nuovo preset"}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Titolo *</label>
                <input
                  value={modal.data.titolo || ""}
                  onChange={(e) => updateModal({ titolo: e.target.value })}
                  style={{ width: "100%", padding: 8 }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Codice *</label>
                <input
                  value={modal.data.codice || ""}
                  onChange={(e) => updateModal({ codice: e.target.value })}
                  style={{ width: "100%", padding: 8 }}
                />
              </div>
              <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Tipo</label>
                  <input
                    value={modal.data.tipo || ""}
                    onChange={(e) => updateModal({ tipo: e.target.value })}
                    style={{ width: "100%", padding: 8 }}
                    placeholder="LICENZA / TAGLIANDO / GENERICO"
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Trigger</label>
                  <input
                    value={modal.data.trigger || ""}
                    onChange={(e) => updateModal({ trigger: e.target.value })}
                    style={{ width: "100%", padding: 8 }}
                    placeholder="MANUALE / AUTO_60 / AUTO_30 / AUTO_15"
                  />
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Subject</label>
                <input
                  value={modal.data.subject_template || ""}
                  onChange={(e) => updateModal({ subject_template: e.target.value })}
                  style={{ width: "100%", padding: 8 }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Messaggio</label>
                <textarea
                  value={modal.data.body_template || ""}
                  onChange={(e) => updateModal({ body_template: e.target.value })}
                  style={{ width: "100%", padding: 8, minHeight: 140 }}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(modal.data.attivo)}
                  onChange={(e) => updateModal({ attivo: e.target.checked })}
                />
                Attivo
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setModal((prev) => ({ ...prev, open: false }))}
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
                onClick={saveModal}
                disabled={saving}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            padding: "10px 14px",
            borderRadius: 10,
            background: toast.variant === "success" ? "#dcfce7" : "#fee2e2",
            color: toast.variant === "success" ? "#166534" : "#991b1b",
            boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
            zIndex: 2000,
            fontSize: 13,
            maxWidth: 360,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
