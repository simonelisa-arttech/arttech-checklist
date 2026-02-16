"use client";

import { useEffect, useState } from "react";

export type ClienteRecord = {
  id?: string;
  denominazione: string;
  attivo?: boolean;
  codice_interno?: string | null;
  comune?: string | null;
  provincia?: string | null;
  piva?: string | null;
  codice_fiscale?: string | null;
  email?: string | null;
  telefono?: string | null;
  codice_sdi?: string | null;
  pec?: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  paese?: string | null;
};

type ClienteModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: ClienteRecord | null;
  onSaved?: (cliente: ClienteRecord) => void;
};

export default function ClienteModal({ open, onClose, initial, onSaved }: ClienteModalProps) {
  const [form, setForm] = useState<ClienteRecord>({
    denominazione: "",
    codice_interno: "",
    comune: "",
    provincia: "",
    piva: "",
    codice_fiscale: "",
    email: "",
    telefono: "",
    codice_sdi: "",
    pec: "",
    indirizzo: "",
    cap: "",
    paese: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      denominazione: initial?.denominazione || "",
      codice_interno: initial?.codice_interno || "",
      comune: initial?.comune || "",
      provincia: initial?.provincia || "",
      piva: initial?.piva || "",
      codice_fiscale: initial?.codice_fiscale || "",
      email: initial?.email || "",
      telefono: initial?.telefono || "",
      codice_sdi: initial?.codice_sdi || "",
      pec: initial?.pec || "",
      indirizzo: initial?.indirizzo || "",
      cap: initial?.cap || "",
      paese: initial?.paese || "",
    });
  }, [open, initial]);

  if (!open) return null;

  async function onSubmit() {
    if (!form.denominazione.trim()) {
      setError("Denominazione obbligatoria.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ClienteRecord = {
        denominazione: form.denominazione.trim(),
        codice_interno: form.codice_interno?.trim() || null,
        comune: form.comune?.trim() || null,
        provincia: form.provincia?.trim() || null,
        piva: form.piva?.trim() || null,
        codice_fiscale: form.codice_fiscale?.trim() || null,
        email: form.email?.trim() || null,
        telefono: form.telefono?.trim() || null,
        codice_sdi: form.codice_sdi?.trim() || null,
        pec: form.pec?.trim() || null,
        indirizzo: form.indirizzo?.trim() || null,
        cap: form.cap?.trim() || null,
        paese: form.paese?.trim() || null,
      };

      const res = await fetch("/api/clienti", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initial?.id ? { id: initial.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Errore salvataggio cliente");
        setSaving(false);
        return;
      }
      onSaved?.(json.data as ClienteRecord);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          background: "white",
          borderRadius: 14,
          padding: 20,
          border: "1px solid #eee",
          boxShadow: "0 18px 50px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>
            {initial?.id ? "Modifica cliente" : "Nuovo cliente"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "1px solid #ddd",
              background: "white",
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Chiudi
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <label>
            Denominazione*<br />
            <input
              value={form.denominazione}
              onChange={(e) => setForm({ ...form, denominazione: e.target.value })}
              style={{ width: "100%", padding: 10 }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Codice interno<br />
              <input
                value={form.codice_interno || ""}
                onChange={(e) => setForm({ ...form, codice_interno: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Email<br />
              <input
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Telefono<br />
              <input
                value={form.telefono || ""}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              P.IVA<br />
              <input
                value={form.piva || ""}
                onChange={(e) => setForm({ ...form, piva: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Codice fiscale<br />
              <input
                value={form.codice_fiscale || ""}
                onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Codice SDI<br />
              <input
                value={form.codice_sdi || ""}
                onChange={(e) => setForm({ ...form, codice_sdi: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              PEC<br />
              <input
                value={form.pec || ""}
                onChange={(e) => setForm({ ...form, pec: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Comune<br />
              <input
                value={form.comune || ""}
                onChange={(e) => setForm({ ...form, comune: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Provincia<br />
              <input
                value={form.provincia || ""}
                onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              CAP<br />
              <input
                value={form.cap || ""}
                onChange={(e) => setForm({ ...form, cap: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
            <label>
              Paese<br />
              <input
                value={form.paese || ""}
                onChange={(e) => setForm({ ...form, paese: e.target.value })}
                style={{ width: "100%", padding: 10 }}
              />
            </label>
          </div>
          <label>
            Indirizzo<br />
            <input
              value={form.indirizzo || ""}
              onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
              style={{ width: "100%", padding: 10 }}
            />
          </label>
        </div>

        {error && (
          <div style={{ color: "#b91c1c", marginTop: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#111827",
              color: "white",
              cursor: "pointer",
            }}
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
