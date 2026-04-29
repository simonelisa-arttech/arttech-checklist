"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
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

function closeDropdownOnNavigation(event: MouseEvent<HTMLElement>) {
  window.dispatchEvent(new CustomEvent("close-app-dropdowns"));
  const details = event.currentTarget.closest("details");
  if (details instanceof HTMLDetailsElement) {
    details.open = false;
  }
}

export default function AppShellHeader() {
  const pathname = usePathname();
  const menuDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const hiddenShellPaths = new Set(["/login", "/reset-password", "/auth/callback", "/operatori"]);

  useEffect(() => {
    const handleCloseAll = () => {
      if (menuDetailsRef.current) menuDetailsRef.current.open = false;
    };
    const handleOpen = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source !== "menu" && menuDetailsRef.current) {
        menuDetailsRef.current.open = false;
      }
    };
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (menuDetailsRef.current && target && !menuDetailsRef.current.contains(target)) {
        menuDetailsRef.current.open = false;
      }
    };

    window.addEventListener("close-app-dropdowns", handleCloseAll);
    window.addEventListener("open-app-dropdown", handleOpen as EventListener);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("close-app-dropdowns", handleCloseAll);
      window.removeEventListener("open-app-dropdown", handleOpen as EventListener);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

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
          <details
            ref={menuDetailsRef}
            style={{ position: "relative" }}
            onToggle={(event) => {
              const details = event.currentTarget;
              if (details.open) {
                window.dispatchEvent(
                  new CustomEvent("open-app-dropdown", { detail: { source: "menu" } })
                );
              }
            }}
          >
            <summary style={dropdownTriggerStyle}>Menu</summary>
            <div style={dropdownPanelStyle}>
              <Link href="/dashboard" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
                Dashboard
              </Link>
              <Link href="/cronoprogramma" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
                Cronoprogramma
              </Link>
              <Link href="/clienti-cockpit" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
                Clienti
              </Link>
              <Link href="/sim" style={dropdownLinkStyle} onClick={closeDropdownOnNavigation}>
                SIM
              </Link>
              <Link
                href="/operatori"
                style={dropdownLinkStyle}
                title="Accesso diretto operatori sul campo"
                onClick={closeDropdownOnNavigation}
              >
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
