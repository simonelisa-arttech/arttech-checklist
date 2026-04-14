"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export default function ImpostazioniPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loadingAccess, setLoadingAccess] = useState(true);
  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingAccess(true);
      try {
        const res = await fetch("/api/me-operatore", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({} as any));
        if (!active) return;
        setCanAccess(Boolean(json?.ok && json?.operatore?.can_access_impostazioni === true));
      } catch {
        if (!active) return;
        setCanAccess(false);
      } finally {
        if (active) setLoadingAccess(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loadingAccess) {
    return <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>Verifica accesso...</div>;
  }

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          Accesso non autorizzato
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>IMPOSTAZIONI</div>
        </div>
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
          Anagrafica clienti
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
          Anagrafica operatori
        </Link>
        <Link
          href="/impostazioni/aziende"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Aziende
        </Link>
        <Link
          href="/impostazioni/personale"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Personale
        </Link>
        <Link
          href="/impostazioni/documenti"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Doc sicurezza
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
          href="/import-progetti"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Importa progetti
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
        <Link
          href="/impostazioni/regole-globali-avvisi"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Regole globali avvisi
        </Link>
      </div>
    </div>
  );
}
