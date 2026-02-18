"use client";

import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export default function ImpostazioniPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>IMPOSTAZIONI</div>
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

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: "100%", fontSize: 11, opacity: 0.65 }}>
          SETTINGS GUARD v1
        </div>
        <Link
          href="/clienti"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Clienti
        </Link>
        <Link
          href="/impostazioni/operatori"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Operatori
        </Link>
        <Link
          href="/catalogo"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Catalogo
        </Link>
        <Link
          href="/impostazioni/checklist-attivita"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Gestisci progetto operativo
        </Link>
        <Link
          href="/impostazioni/preset-avvisi"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Preset avvisi
        </Link>
      </div>
    </div>
  );
}
