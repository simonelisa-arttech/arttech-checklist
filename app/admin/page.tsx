import Link from "next/link";

const cards = [
  {
    title: "SCADENZE",
    description: "Apri la vista operativa delle scadenze e dei rinnovi.",
    href: "/scadenze",
  },
  {
    title: "CLIENTI SENZA EMAIL",
    description: "Verifica i clienti che bloccano gli avvisi automatici.",
    href: "/clienti",
  },
  {
    title: "INTERVENTI DA CHIUDERE",
    description: "Area placeholder per i prossimi controlli amministrativi.",
    href: null,
  },
  {
    title: "FATTURE DA EMETTERE",
    description: "Area placeholder per la gestione fatture ancora aperte.",
    href: null,
  },
] as const;

export default function AdminPage() {
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
        {cards.map((card) =>
          card.href ? (
            <Link
              key={card.title}
              href={card.href}
              style={{
                display: "block",
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>{card.title}</div>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: "#374151" }}>
                {card.description}
              </div>
            </Link>
          ) : (
            <div
              key={card.title}
              style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>{card.title}</div>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: "#4b5563" }}>
                {card.description}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
