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
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
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
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 2fr 180px 120px 140px",
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
                  gridTemplateColumns: "1fr 120px 2fr 180px 120px 140px",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <select
                  value={row.sezione}
                  onChange={(e) => updateRow(idx, { sezione: e.target.value })}
                  style={{ width: "100%", padding: 8, minWidth: 0 }}
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
                  style={{ width: "100%", padding: 8 }}
                />
                <input
                  value={row.titolo}
                  onChange={(e) => updateRow(idx, { titolo: e.target.value })}
                  style={{ width: "100%", padding: 8, minWidth: 0 }}
                />
                <select
                  value={row.target || "GENERICA"}
                  onChange={(e) =>
                    updateRow(idx, { target: String(e.target.value || "GENERICA").toUpperCase() })
                  }
                  style={{ width: "100%", padding: 8, minWidth: 0 }}
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
                </div>
              </div>
            )})
          )}
        </div>
      )}
    </div>
  );
}
