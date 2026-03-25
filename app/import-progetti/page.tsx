"use client";

import { useState } from "react";
import Link from "next/link";

type ImportErrorRow = {
  row: number;
  reason: string;
};

type ImportResponse = {
  delimiter?: string;
  dry_run?: boolean;
  on_conflict?: string;
  inserted: number;
  skipped: number;
  errors: ImportErrorRow[];
  warnings: ImportErrorRow[];
};

export default function ImportProgettiPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function onImport() {
    if (!file) {
      setError("Seleziona un file CSV.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("dry_run", "false");
      form.append("on_conflict", "skip");

      const endpoint = "/api/import/progetti-csv";
      console.log("[import-progetti-ui] submit", {
        endpoint,
        filename: file.name,
      });

      const res = await fetch(endpoint, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || "Errore import CSV"));
      }

      setResult({
        delimiter: typeof json?.delimiter === "string" ? json.delimiter : undefined,
        dry_run: Boolean(json?.dry_run),
        on_conflict: typeof json?.on_conflict === "string" ? json.on_conflict : undefined,
        inserted: Number(json?.inserted || 0),
        skipped: Number(json?.skipped || 0),
        errors: Array.isArray(json?.errors) ? json.errors : [],
        warnings: Array.isArray(json?.warnings) ? json.warnings : [],
      });
    } catch (err: any) {
      setError(String(err?.message || "Errore import CSV"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>IMPORTA PROGETTI DA CSV</h1>
          <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
            Carica un file CSV/TSV per creare piu progetti. Colonne supportate incluse:
            <code style={{ marginLeft: 6 }}>
              cliente;nome_progetto;po;indirizzo;saas_scadenza;licenza_scadenza
            </code>
          </div>
        </div>
        <Link
          href="/"
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
          ← Dashboard
        </Link>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <input
            type="file"
            accept=".csv,.tsv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError(null);
              setResult(null);
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
            }}
          />
          <button
            type="button"
            onClick={onImport}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: loading ? "#f3f4f6" : "#111",
              color: loading ? "#6b7280" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
            }}
          >
            IMPORTA FILE
          </button>
          {file ? (
            <div style={{ fontSize: 13, opacity: 0.75 }}>File selezionato: {file.name}</div>
          ) : null}
        </div>

        {loading ? <div style={{ fontWeight: 700 }}>Import in corso...</div> : null}
        {error ? <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div> : null}

        {result ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>✔ PROGETTI CREATI</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{result.inserted}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #fde68a",
                  background: "#fffbeb",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>⚠ DUPLICATI</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{result.skipped}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>❌ ERRORI</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{result.errors.length}</div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>ℹ WARNING</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>{result.warnings.length}</div>
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Endpoint: <code>/api/import/progetti-csv</code>
              {result.delimiter ? (
                <>
                  {" "}
                  · Delimitatore rilevato: <strong>{result.delimiter}</strong>
                </>
              ) : null}
            </div>

            {result.errors.length > 0 ? (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead style={{ background: "#f9fafb" }}>
                    <tr>
                      <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Riga</th>
                      <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Errore</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((row, index) => (
                      <tr key={`${row.row}-${index}`}>
                        <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                          {row.row}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", color: "#991b1b" }}>
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {result.warnings.length > 0 ? (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead style={{ background: "#f9fafb" }}>
                    <tr>
                      <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Riga</th>
                      <th style={{ padding: 10, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Warning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.warnings.map((row, index) => (
                      <tr key={`${row.row}-warning-${index}`}>
                        <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                          {row.row}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6", color: "#92400e" }}>
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
