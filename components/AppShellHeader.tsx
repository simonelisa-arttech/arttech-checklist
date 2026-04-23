"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import LogoutButton from "@/components/LogoutButton";

const dropdownTriggerStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  color: "#111827",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  listStyle: "none",
};

const dropdownPanelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
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

const dropdownLinkStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  textDecoration: "none",
  color: "#0f172a",
  background: "white",
  fontSize: 13,
  fontWeight: 700,
  width: "100%",
  boxSizing: "border-box",
};

export default function AppShellHeader() {
  const pathname = usePathname();
  const hiddenShellPaths = new Set(["/login", "/reset-password", "/auth/callback", "/operatori"]);

  if (hiddenShellPaths.has(pathname)) {
    return null;
  }

  return (
    <header
      style={{
        maxWidth: 1100,
        margin: "16px auto 0",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 0 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center" }}>
          <img
            src="/at-logo.png"
            alt="AT SYSTEM"
            style={{ height: 48, width: "auto", objectFit: "contain" }}
          />
        </Link>
        <nav
          aria-label="Navigazione principale"
          style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
        >
          <details style={{ position: "relative" }}>
            <summary style={dropdownTriggerStyle}>Menu</summary>
            <div style={dropdownPanelStyle}>
              <Link href="/dashboard" style={dropdownLinkStyle}>
                Dashboard
              </Link>
              <Link href="/cronoprogramma" style={dropdownLinkStyle}>
                Cronoprogramma
              </Link>
              <Link href="/clienti-cockpit" style={dropdownLinkStyle}>
                Clienti
              </Link>
              <Link href="/sim" style={dropdownLinkStyle}>
                SIM
              </Link>
              <Link href="/fatturazione" style={dropdownLinkStyle}>
                Fatturazione
              </Link>
              <Link href="/operatori" style={dropdownLinkStyle} title="Accesso diretto operatori sul campo">
                App operatori
              </Link>
            </div>
          </details>
        </nav>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <LogoutButton />
      </div>
    </header>
  );
}
