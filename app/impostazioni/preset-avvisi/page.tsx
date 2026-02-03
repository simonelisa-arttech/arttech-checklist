"use client";

import Link from "next/link";

export default function PresetAvvisiPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_SUPABASE_DASHBOARD_URL || "";
  const canOpen = Boolean(dashboardUrl);

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
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
          marginTop: 18,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Coming soon</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
          Qui potrai gestire i template degli avvisi senza uscire dall'app.
        </div>
        <button
          type="button"
          onClick={() => {
            if (canOpen) window.open(dashboardUrl, "_blank", "noopener,noreferrer");
          }}
          disabled={!canOpen}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: canOpen ? "#111" : "#e5e7eb",
            color: canOpen ? "white" : "#111",
            cursor: canOpen ? "pointer" : "default",
          }}
        >
          Apri in Supabase
        </button>
      </div>
    </div>
  );
}
