"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[checklist route error]", error);
  }, [error]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Si è verificato un problema nel caricamento del progetto
      </div>

      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
        Ricarica la pagina o contatta il supporto se il problema persiste.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            background: "#111827",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Riprova
        </button>

        <Link
          href="/"
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            background: "#f3f4f6",
            color: "#111827",
            textDecoration: "none",
          }}
        >
          Torna alla dashboard
        </Link>
      </div>
    </div>
  );
}
