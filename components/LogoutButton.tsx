"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdminRole } from "@/lib/adminRoles";

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
        setCanAccessSettings(isAdminRole(operatore.ruolo) || roleNormalized === "MAGAZZINO");
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
      <Link
        href="/admin"
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          textDecoration: "none",
          color: "inherit",
          fontWeight: 600,
        }}
      >
        ADMIN
      </Link>
      {canAccessSettings ? (
        <Link
          href="/impostazioni"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            textDecoration: "none",
            color: "inherit",
            fontWeight: 600,
          }}
        >
          Impostazioni
        </Link>
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
