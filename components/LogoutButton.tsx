"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { canAccessSettingsRole } from "@/lib/adminRoles";

const dropdownTriggerStyle = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  listStyle: "none" as const,
};

const dropdownPanelStyle = {
  position: "absolute" as const,
  top: "calc(100% + 8px)",
  right: 0,
  width: "min(280px, calc(100vw - 32px))",
  padding: 10,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "white",
  boxShadow: "0 18px 36px rgba(15,23,42,0.14)",
  display: "grid",
  gap: 8,
  zIndex: 30,
};

const dropdownLinkStyle = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

function closeDropdownOnNavigation(event: MouseEvent<HTMLElement>) {
  const details = event.currentTarget.closest("details");
  if (details instanceof HTMLDetailsElement) {
    details.open = false;
  }
}

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [operatoreLabel, setOperatoreLabel] = useState("");
  const [canAccessSettings, setCanAccessSettings] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    const controller = new AbortController();

    async function loadOperatore() {
      try {
        const res = await fetch("/api/me-operatore", { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        const operatore = data?.operatore;
        if (!res.ok || !operatore?.id) {
          setOperatoreLabel("");
          setCanAccessSettings(false);
          return;
        }
        const nome = operatore.nome ?? "—";
        const ruolo = operatore.ruolo ? ` (${operatore.ruolo})` : "";
        const roleNormalized = String(operatore.ruolo || "")
          .trim()
          .toUpperCase();
        setOperatoreLabel(`Operatore: ${nome}${ruolo}`);
        setCanAccessSettings(
          operatore.can_access_impostazioni === true || canAccessSettingsRole(roleNormalized)
        );
      } catch {
        setOperatoreLabel("");
        setCanAccessSettings(false);
      }
    }

    void loadOperatore();
    return () => controller.abort();
  }, [pathname]);

  if (pathname === "/login") return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {operatoreLabel ? (
        <div style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>
          {operatoreLabel}
        </div>
      ) : null}
      {canAccessSettings ? (
        <details style={{ position: "relative" }}>
          <summary style={dropdownTriggerStyle}>Impostazioni</summary>
          <div style={dropdownPanelStyle}>
            <Link href="/impostazioni" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Panoramica impostazioni
            </Link>
            <Link href="/impostazioni/operatori" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Anagrafica operatori
            </Link>
            <Link href="/impostazioni/personale" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Personale
            </Link>
            <Link href="/impostazioni/aziende" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Aziende
            </Link>
            <Link href="/impostazioni/documenti" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Doc sicurezza
            </Link>
            <Link
              href="/impostazioni/checklist-attivita"
              style={dropdownLinkStyle}
              onClick={closeDropdownOnNavigation}
            >
              Gestisci progetto operativo
            </Link>
            <Link href="/impostazioni/preset-avvisi" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Preset avvisi
            </Link>
            <Link
              href="/impostazioni/regole-globali-avvisi"
              style={dropdownLinkStyle}
              onClick={closeDropdownOnNavigation}
            >
              Regole globali avvisi
            </Link>
            <Link href="/catalogo" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Catalogo
            </Link>
            <Link href="/fatturazione-globale" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Fatturazione globale
            </Link>
            <Link href="/import-progetti" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
              Importa progetti
            </Link>
          </div>
        </details>
      ) : null}
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}
