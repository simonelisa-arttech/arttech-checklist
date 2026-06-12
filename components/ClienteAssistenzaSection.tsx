"use client";

import { useEffect, useState } from "react";

type TierInfo = {
  tier: "expired" | "standard" | "plus" | "premium";
  saas_active: boolean;
  saas_expiry: string | null;
  saas_type: string | null;
  ore_residue: number | null;
  whatsapp: string | null;
  referente_tecnico: string | null;
  impianti: Array<{
    nome: string;
    seriale: string | null;
    garanzia: string | null;
    stato: "ok" | "warn" | "exp";
    checklist_id: string | null;
    progetto_nome: string | null;
  }>;
};

type Ticket = {
  id: string;
  numero: number;
  categoria: string;
  descrizione: string;
  stato: string;
  created_at: string;
};

const PROBLEMI = [
  { id: "noimage", icon: "📺", label: "Schermo senza immagine" },
  { id: "brightness", icon: "🔆", label: "Luminosità / colori anomali" },
  { id: "pixels", icon: "🔴", label: "Pixel / zone spente" },
  { id: "control", icon: "🖥", label: "CMS / controllo" },
  { id: "power", icon: "⚡", label: "Alimentazione" },
  { id: "other", icon: "🔧", label: "Altro problema" },
] as const;

const VERIFICHE_RAPIDE: Record<string, string> = {
  noimage:
    "VERIFICA RAPIDA prima di aprire il ticket:\n1. Verifica che l'alimentazione sia attiva (interruttore e quadro elettrico)\n2. Controlla che il player/sorgente segnale sia acceso\n3. Osserva i LED di stato sul retro del pannello\n4. Prepara una foto dello stato attuale\n\nNOTA: la risoluzione può richiedere più di un intervento in base a disponibilità ricambi.",
  brightness:
    "VERIFICA RAPIDA:\n1. Accedi al CMS e controlla le impostazioni di luminosità\n2. Verifica che il sensore automatico di luminosità non sia ostruito\n3. Identifica se il problema è localizzato o diffuso\n4. Prepara foto del problema\n\nNOTA: la sostituzione di moduli LED dipende dalla disponibilità a magazzino.",
  pixels:
    "VERIFICA RAPIDA:\n1. Fotografa la zona interessata indicando le coordinate approssimative\n2. Conta il numero di moduli/pixel coinvolti\n3. Verifica se il danno è fisico (impatto) o elettrico (zone nere regolari)\n\nNOTA: i costi di analisi e diagnostica sono addebitati indipendentemente dall'esito della riparazione.",
  control:
    "VERIFICA RAPIDA:\n1. Riavvia il player (spegni, attendi 30 secondi, riaccendi)\n2. Controlla la connessione di rete del player\n3. Verifica che il software CMS sia aggiornato\n4. Annota eventuali messaggi di errore\n\nIl team proverà prima un accesso remoto per risolvere senza intervento fisico.",
  power:
    "⚠️ ATTENZIONE: non intervenire autonomamente sull'impianto elettrico.\n1. Controlla l'interruttore dedicato nel quadro elettrico\n2. Verifica eventuali scatti di protezione\n3. Osserva i LED di stato sull'alimentatore\n4. NON effettuare interventi sull'impianto\n\nIl tecnico verificherà alimentatori e cablaggi durante l'intervento.",
  other:
    "Descrivi il problema nel dettaglio qui sotto, allegando se possibile riferimenti precisi (zona dello schermo, orari, messaggi di errore). Il team valuterà la segnalazione e ti contatterà.",
};

const TIER_STYLE: Record<TierInfo["tier"], { label: string; bg: string; border: string; color: string }> = {
  expired: { label: "Garanzia / contratto scaduto", bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  standard: { label: "Garanzia Standard attiva", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  plus: { label: "Contratto Plus/Ultra attivo", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  premium: { label: "Contratto Premium attivo", bg: "#fefce8", border: "#fde68a", color: "#a16207" },
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

export default function ClienteAssistenzaSection({ apiSuffix }: { apiSuffix: string }) {
  const [info, setInfo] = useState<TierInfo | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoria, setCategoria] = useState<string | null>(null);
  const [descrizione, setDescrizione] = useState("");
  const [impianto, setImpianto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ numero: number } | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`/api/cliente/assistenza${apiSuffix}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Errore caricamento assistenza"));
      setInfo(data?.assistenza || null);
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiSuffix]);

  async function submitTicket() {
    setSendError(null);
    if (descrizione.trim().length < 10) {
      setSendError("Descrivi il problema (almeno 10 caratteri).");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/cliente/assistenza${apiSuffix}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: categoria || "other",
          descrizione,
          impianto,
          telefono,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Errore apertura ticket"));
      setConfirmed({ numero: Number(data?.ticket?.numero || 0) });
      setDescrizione("");
      setCategoria(null);
      void load();
    } catch (err: any) {
      setSendError(String(err?.message || err));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: "#64748b" }}>Caricamento assistenza…</div>;
  }
  if (error || !info) {
    return (
      <div style={{ fontSize: 13, color: "#b91c1c" }}>
        {error || "Assistenza non disponibile al momento."}
      </div>
    );
  }

  const ts = TIER_STYLE[info.tier];
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stato copertura */}
      <div
        style={{
          border: `1px solid ${ts.border}`,
          background: ts.bg,
          color: ts.color,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{ts.label}</span>
        <span style={{ fontWeight: 500 }}>
          {info.saas_type ? `${info.saas_type}` : ""}
          {info.saas_expiry ? ` · scadenza ${formatDate(info.saas_expiry)}` : ""}
          {info.ore_residue != null ? ` · ${info.ore_residue} interventi residui` : ""}
        </span>
      </div>

      {/* Premium: contatto diretto */}
      {info.tier === "premium" && info.whatsapp ? (
        <a
          href={`https://wa.me/${info.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            background: "#16a34a",
            color: "white",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          💬 WhatsApp diretto {info.referente_tecnico ? `— ${info.referente_tecnico}` : ""} (H24)
        </a>
      ) : null}

      {/* Expired: avviso preventivo */}
      {info.tier === "expired" ? (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            color: "#92400e",
            lineHeight: 1.6,
          }}
        >
          Il tuo impianto non risulta coperto da garanzia o contratto attivo: l&apos;assistenza è
          erogabile <strong>a pagamento previo preventivo</strong>. Apri comunque la segnalazione
          qui sotto: riceverai un&apos;offerta entro 1 giorno lavorativo. L&apos;uscita del tecnico
          è addebitata anche in caso di mancata riparazione per cause non dipendenti dalla nostra
          volontà.
        </div>
      ) : null}

      {confirmed ? (
        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 14,
            color: "#15803d",
          }}
        >
          ✅ Ticket <strong>#{confirmed.numero}</strong> aperto correttamente. Il team tecnico ti
          contatterà entro 1 giorno lavorativo (salvo SLA contrattuale dedicato).{" "}
          <button
            onClick={() => setConfirmed(null)}
            style={{
              border: "none",
              background: "transparent",
              color: "#15803d",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Apri un altro ticket
          </button>
        </div>
      ) : (
        <>
          {/* Griglia problemi */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
              Che problema riscontri?
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {PROBLEMI.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setCategoria(p.id)}
                  style={{
                    border: categoria === p.id ? "2px solid #0f172a" : "1px solid #e2e8f0",
                    background: categoria === p.id ? "#f8fafc" : "white",
                    borderRadius: 12,
                    padding: "12px 8px",
                    cursor: "pointer",
                    textAlign: "center",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{p.icon}</div>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Verifica rapida */}
          {categoria ? (
            <div
              style={{
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 12.5,
                color: "#475569",
                whiteSpace: "pre-line",
                lineHeight: 1.6,
              }}
            >
              {VERIFICHE_RAPIDE[categoria]}
            </div>
          ) : null}

          {/* Form ticket */}
          {categoria ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {info.impianti.length > 1 ? (
                <select value={impianto} onChange={(e) => setImpianto(e.target.value)} style={inputStyle}>
                  <option value="">Seleziona impianto interessato (facoltativo)</option>
                  {info.impianti.map((i, idx) => (
                    <option key={idx} value={`${i.nome}${i.seriale ? ` [${i.seriale}]` : ""}`}>
                      {i.nome} {i.seriale ? `— ${i.seriale}` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              <textarea
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                placeholder="Descrivi il problema: da quando si verifica, zona dello schermo, eventuali messaggi di errore…"
                style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              />
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Telefono per ricontatto (facoltativo)"
                style={inputStyle}
              />
              {sendError ? (
                <div style={{ fontSize: 13, color: "#b91c1c" }}>{sendError}</div>
              ) : null}
              <button
                onClick={() => void submitTicket()}
                disabled={sending}
                style={{
                  alignSelf: "flex-start",
                  border: "none",
                  borderRadius: 10,
                  background: sending ? "#94a3b8" : "#0f172a",
                  color: "white",
                  padding: "11px 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: sending ? "not-allowed" : "pointer",
                }}
              >
                {sending
                  ? "Invio…"
                  : info.tier === "expired"
                  ? "Richiedi preventivo →"
                  : "Apri ticket →"}
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* Storico ticket */}
      {tickets.length > 0 ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "6px 0 8px" }}>
            I tuoi ticket recenti
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tickets.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12.5,
                  color: "#475569",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <strong>#{t.numero}</strong> · {formatDate(t.created_at)} ·{" "}
                  {String(t.descrizione || "").slice(0, 60)}
                  {String(t.descrizione || "").length > 60 ? "…" : ""}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: t.stato === "aperto" ? "#1d4ed8" : t.stato === "chiuso" ? "#15803d" : "#64748b",
                  }}
                >
                  {String(t.stato || "").toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
