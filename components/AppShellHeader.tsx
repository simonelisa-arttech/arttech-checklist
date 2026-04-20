"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import LogoutButton from "@/components/LogoutButton";

const navLinkStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  textDecoration: "none",
  color: "inherit",
  background: "white",
};

export default function AppShellHeader() {
  const pathname = usePathname();
  const operatorMode = pathname === "/operatori";

  return (
    <header
      style={{
        maxWidth: operatorMode ? 760 : 1100,
        margin: "16px auto 0",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 0 }}>
        <Link href={operatorMode ? "/operatori" : "/"} style={{ display: "inline-flex", alignItems: "center" }}>
          <img
            src="/at-logo.png"
            alt="AT SYSTEM"
            style={{ height: 48, width: "auto", objectFit: "contain" }}
          />
        </Link>
        {operatorMode ? (
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, color: "#64748b", textTransform: "uppercase" }}>
              App operatore
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Attività assegnate</div>
          </div>
        ) : (
          <nav
            aria-label="Navigazione principale"
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
          >
            <Link href="/dashboard" style={navLinkStyle}>
              Dashboard
            </Link>
            <Link href="/clienti-cockpit" style={navLinkStyle}>
              Clienti
            </Link>
            <Link href="/operatori" style={navLinkStyle}>
              Operatori
            </Link>
            <Link href="/operativi-kpi" style={navLinkStyle}>
              KPI Operativi
            </Link>
            <Link href="/sim" style={navLinkStyle}>
              SIM
            </Link>
            <Link href="/fatturazione" style={navLinkStyle}>
              Fatturazione
            </Link>
            <Link href="/cronoprogramma" style={navLinkStyle}>
              Cronoprogramma
            </Link>
          </nav>
        )}
      </div>
      <div style={{ marginLeft: "auto" }}>
        <LogoutButton />
      </div>
    </header>
  );
}
