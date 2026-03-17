"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [interventiDaChiudereCount, setInterventiDaChiudereCount] = useState(0);
  const [fattureDaEmettereCount, setFattureDaEmettereCount] = useState(0);
  const [scadenzeCount, setScadenzeCount] = useState(0);
  const [clientiMissingEmailCount, setClientiMissingEmailCount] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCount() {
      try {
        const res = await fetch("/api/interventi/da-chiudere", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          setInterventiDaChiudereCount(0);
          return;
        }
        setInterventiDaChiudereCount(data.length);
      } catch {
        setInterventiDaChiudereCount(0);
      }
    }

    void loadCount();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCount() {
      try {
        const res = await fetch("/api/fatture/da-emettere", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data)) {
          setFattureDaEmettereCount(0);
          return;
        }
        setFattureDaEmettereCount(data.length);
      } catch {
        setFattureDaEmettereCount(0);
      }
    }

    void loadCount();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCount() {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const toDate = new Date(today);
      toDate.setDate(toDate.getDate() + 7);
      const to = toDate.toISOString().slice(0, 10);

      try {
        const res = await fetch(`/api/scadenze?from=${from}&to=${to}`, {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data?.count !== "number") {
          setScadenzeCount(0);
          return;
        }
        setScadenzeCount(data.count);
      } catch {
        setScadenzeCount(0);
      }
    }

    void loadCount();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCount() {
      try {
        const res = await fetch("/api/clienti/missing-email-count", {
          signal: controller.signal,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data?.count !== "number") {
          setClientiMissingEmailCount(0);
          return;
        }
        setClientiMissingEmailCount(data.count);
      } catch {
        setClientiMissingEmailCount(0);
      }
    }

    void loadCount();
    return () => controller.abort();
  }, []);

  const cards = [
    {
      title: "INTERVENTI DA CHIUDERE",
      count: interventiDaChiudereCount,
      description: "Progetti in ritardo o non completati",
      href: "/admin/interventi-da-chiudere",
    },
    {
      title: "FATTURE DA EMETTERE",
      count: fattureDaEmettereCount,
      description: "Progetti completati pronti per fatturazione",
      href: "/admin/fatture-da-emettere",
    },
    {
      title: "SCADENZE",
      count: scadenzeCount,
      description: "Controlla garanzie, licenze e tagliandi in scadenza",
      href: "/scadenze",
    },
    {
      title: "CLIENTI SENZA EMAIL",
      count: clientiMissingEmailCount,
      description: "Clienti senza email: avvisi automatici disattivati",
      href: "/clienti",
    },
  ] as const;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, paddingBottom: 60 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 34, whiteSpace: "nowrap" }}>AREA ADMIN</h1>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
          Shortcut operativi e aree di controllo.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {cards.map((card) => {
          const isHovered = hoveredCard === card.title;
          return (
            <Link
              key={card.title}
              href={card.href}
              onMouseEnter={() => setHoveredCard(card.title)}
              onMouseLeave={() => setHoveredCard((current) => (current === card.title ? null : current))}
              style={{
                display: "block",
                padding: "18px 20px",
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "white",
                textDecoration: "none",
                color: "inherit",
                boxShadow: isHovered
                  ? "0 12px 28px rgba(15, 23, 42, 0.14)"
                  : "0 4px 14px rgba(15, 23, 42, 0.06)",
                transform: isHovered ? "scale(1.02)" : "scale(1)",
                transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                borderColor: isHovered ? "#cbd5e1" : "#e5e7eb",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, color: "#6b7280" }}>
                {card.title}
              </div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 800, lineHeight: 1, color: "#111827" }}>
                {card.count}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: "#374151" }}>
                {card.description}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
