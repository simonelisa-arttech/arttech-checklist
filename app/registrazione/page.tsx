"use client";

import { useState } from "react";

type RegisterStatus = "activated" | "pending" | "exists";

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: "28px 26px",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const fieldWrap: React.CSSProperties = { marginBottom: 14 };

export default function RegistrazionePage() {
  const [email, setEmail] = useState("");
  const [denominazione, setDenominazione] = useState("");
  const [piva, setPiva] = useState("");
  const [telefono, setTelefono] = useState("");
  const [codiceOrdine, setCodiceOrdine] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: RegisterStatus; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !denominazione.trim()) {
      setError("Email e ragione sociale sono obbligatorie.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/portal-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          denominazione,
          piva,
          telefono,
          codice_ordine: codiceOrdine,
          messaggio,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Errore durante la registrazione. Riprova più tardi.");
        return;
      }
      setResult({ status: (data?.status || "pending") as RegisterStatus, message: data?.message || "" });
    } catch {
      setError("Errore di rete. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "linear-gradient(180deg, #f8fafc 0%, #f8fafc 220px, #eef2f7 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, display: "grid", justifyItems: "center" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 10, marginBottom: 14, textAlign: "center" }}>
          <img
            src="/at-logo.png"
            alt="Art Tech"
            style={{ width: "100%", maxWidth: 120, height: "auto", objectFit: "contain" }}
          />
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
            Registrazione area cliente
          </div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>
            Accedi a progetti, documenti, scadenze e assistenza del tuo impianto.
          </div>
        </div>

        <div style={card}>
          {result ? (
            <div style={{ textAlign: "center", padding: "10px 4px" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>
                {result.status === "activated" ? "✅" : result.status === "exists" ? "ℹ️" : "🕐"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
                {result.status === "activated"
                  ? "Registrazione completata"
                  : result.status === "exists"
                  ? "Accesso già attivo"
                  : "Richiesta in verifica"}
              </div>
              <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6, marginBottom: 18 }}>
                {result.message}
              </div>
              {(result.status === "activated" || result.status === "exists") && (
                <a
                  href="/login"
                  style={{
                    display: "inline-block",
                    padding: "10px 22px",
                    borderRadius: 10,
                    background: "#111827",
                    color: "#ffffff",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Vai al login →
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="reg-email">
                  Email aziendale *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  style={inputStyle}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                  autoComplete="email"
                  required
                />
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Usa l&apos;email comunicata in fase d&apos;ordine: se corrisponde ai nostri archivi
                  l&apos;accesso è immediato.
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="reg-den">
                  Ragione sociale *
                </label>
                <input
                  id="reg-den"
                  type="text"
                  style={inputStyle}
                  value={denominazione}
                  onChange={(e) => setDenominazione(e.target.value)}
                  placeholder="Es. Rossi S.r.l."
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor="reg-piva">
                    Partita IVA
                  </label>
                  <input
                    id="reg-piva"
                    type="text"
                    style={inputStyle}
                    value={piva}
                    onChange={(e) => setPiva(e.target.value)}
                    placeholder="11 cifre"
                  />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor="reg-tel">
                    Telefono
                  </label>
                  <input
                    id="reg-tel"
                    type="tel"
                    style={inputStyle}
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+39 ..."
                  />
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="reg-ordine">
                  Numero ordine / conferma d&apos;ordine
                </label>
                <input
                  id="reg-ordine"
                  type="text"
                  style={inputStyle}
                  value={codiceOrdine}
                  onChange={(e) => setCodiceOrdine(e.target.value)}
                  placeholder="Es. 149-2026"
                />
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Facoltativo: aiuta lo staff a identificare il tuo progetto se l&apos;email non
                  corrisponde.
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle} htmlFor="reg-msg">
                  Note (facoltative)
                </label>
                <textarea
                  id="reg-msg"
                  style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                  value={messaggio}
                  onChange={(e) => setMessaggio(e.target.value)}
                  placeholder="Eventuali informazioni utili"
                />
              </div>

              {/* Honeypot anti-bot: nascosto agli utenti reali */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0 }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {error && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: loading ? "#6b7280" : "#111827",
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Invio in corso…" : "Registrati"}
              </button>

              <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#6b7280" }}>
                Hai già un accesso?{" "}
                <a href="/login" style={{ color: "#111827", fontWeight: 600 }}>
                  Accedi
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
