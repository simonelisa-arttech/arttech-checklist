"use client";

/**
 * P5.5 — Dashboard operatore ticket assistenza (staff).
 * Lista con filtri + indicatori + dettaglio con thread bidirezionale (P5.3).
 * Accesso operatore: le API (/api/assistenza*) validano il ruolo; i clienti vengono
 * reindirizzati dal middleware fuori da questa rotta.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

type Ticket = {
  id: string;
  numero: number;
  email: string | null;
  progetto: string | null;
  categoria: string | null;
  urgenza: string | null;
  priorita: string | null;
  stato: string | null;
  tipo_richiesta: string | null;
  descrizione: string | null;
  attesa_ore: number | null;
  oltre_sla: boolean;
  assegnatario_nome: string | null;
  prima_risposta_at: string | null;
};

type Indicatori = {
  totale: number;
  aperti: number;
  pending: number;
  oltre_sla: number;
  tempo_medio_prima_risposta_ore: number | null;
};

type Messaggio = { id: string; autore_tipo: string; corpo: string; created_at: string };

const PRIORITA_STYLE: Record<string, { bg: string; color: string }> = {
  alta: { bg: "#fef2f2", color: "#b91c1c" },
  media: { bg: "#fff7ed", color: "#c2410c" },
  standard: { bg: "#eff6ff", color: "#1d4ed8" },
  bassa: { bg: "#f1f5f9", color: "#475569" },
};
const STATO_LABEL: Record<string, string> = {
  aperto: "Aperto",
  in_lavorazione: "In lavorazione",
  risolto: "Risolto",
  chiuso: "Chiuso",
};

function pill(text: string, bg: string, color: string) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 11.5,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function attesaLabel(h: number | null) {
  if (h === null) return "-";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} gg`;
}

export default function AssistenzaOperatorePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [indicatori, setIndicatori] = useState<Indicatori | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fStato, setFStato] = useState("tutti");
  const [fPriorita, setFPriorita] = useState("tutte");
  const [q, setQ] = useState("");

  const [sel, setSel] = useState<Ticket | null>(null);
  const [thread, setThread] = useState<Messaggio[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assistenza", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore caricamento ticket");
      setTickets((data.tickets as Ticket[]) || []);
      setIndicatori((data.indicatori as Indicatori) || null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openThread = useCallback(async (t: Ticket) => {
    setSel(t);
    setThread([]);
    setReply("");
    try {
      const res = await fetch(`/api/assistenza/${t.id}/messaggi`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setThread((data.messaggi as Messaggio[]) || []);
    } catch {
      // ignore
    }
  }, []);

  async function invia(nuovoStato?: string) {
    if (!sel) return;
    if (!reply.trim() && !nuovoStato) return;
    setSending(true);
    try {
      const res = await fetch(`/api/assistenza/${sel.id}/messaggi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ corpo: reply.trim(), stato: nuovoStato }),
      });
      if (res.ok) {
        setReply("");
        await openThread(sel);
        await load();
      }
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (fStato !== "tutti" && t.stato !== fStato) return false;
      if (fPriorita !== "tutte" && t.priorita !== fPriorita) return false;
      if (needle) {
        const hay = `${t.email || ""} ${t.progetto || ""} ${t.numero}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [tickets, fStato, fPriorita, q]);

  const card = (label: string, value: string | number, accent?: string) => (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "14px 16px",
        background: "#fff",
        minWidth: 150,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || "#0f172a" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "16px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
        Assistenza — Dashboard operatore
      </h1>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Ticket e richieste dei clienti. Priorità e SLA calcolati dal piano attivo.
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {card("Aperti", indicatori?.aperti ?? "—")}
        {card("Pending (da prendere in carico)", indicatori?.pending ?? "—", "#c2410c")}
        {card(
          "Oltre SLA",
          indicatori?.oltre_sla ?? "—",
          (indicatori?.oltre_sla || 0) > 0 ? "#b91c1c" : "#0f172a"
        )}
        {card(
          "Tempo medio 1ª risposta",
          indicatori?.tempo_medio_prima_risposta_ore != null
            ? `${indicatori.tempo_medio_prima_risposta_ore} h`
            : "—"
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <select
          value={fStato}
          onChange={(e) => setFStato(e.target.value)}
          style={{ padding: 8, borderRadius: 8 }}
        >
          <option value="tutti">Tutti gli stati</option>
          <option value="aperto">Aperto</option>
          <option value="in_lavorazione">In lavorazione</option>
          <option value="risolto">Risolto</option>
          <option value="chiuso">Chiuso</option>
        </select>
        <select
          value={fPriorita}
          onChange={(e) => setFPriorita(e.target.value)}
          style={{ padding: 8, borderRadius: 8 }}
        >
          <option value="tutte">Tutte le priorità</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="standard">Standard</option>
          <option value="bassa">Bassa</option>
        </select>
        <input
          placeholder="Cerca cliente / progetto / #"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            padding: 8,
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            minWidth: 220,
          }}
        />
        <button
          onClick={load}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Aggiorna
        </button>
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {loading ? (
        <div style={{ fontSize: 14, color: "#64748b" }}>Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 14, color: "#64748b" }}>Nessun ticket.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => openThread(t)}
              style={{
                border: "1px solid #e5e7eb",
                borderLeft: `4px solid ${t.oltre_sla ? "#b91c1c" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: 12,
                background: sel?.id === t.id ? "#f8fafc" : "#fff",
                cursor: "pointer",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>#{t.numero}</strong>
                {pill(
                  String(t.priorita || "bassa").toUpperCase(),
                  (PRIORITA_STYLE[t.priorita || "bassa"] || PRIORITA_STYLE.bassa).bg,
                  (PRIORITA_STYLE[t.priorita || "bassa"] || PRIORITA_STYLE.bassa).color
                )}
                {pill(STATO_LABEL[t.stato || ""] || String(t.stato || "-"), "#f1f5f9", "#334155")}
                {t.tipo_richiesta && t.tipo_richiesta !== "assistenza"
                  ? pill(String(t.tipo_richiesta).toUpperCase(), "#ecfeff", "#0e7490")
                  : null}
                {t.oltre_sla ? pill("OLTRE SLA", "#fef2f2", "#b91c1c") : null}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
                  Attesa: {attesaLabel(t.attesa_ore)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#0f172a" }}>
                {t.progetto || "—"} · <span style={{ color: "#64748b" }}>{t.email || "—"}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#475569" }}>
                {t.categoria || "—"} · urgenza {t.urgenza || "—"}
                {t.assegnatario_nome
                  ? ` · assegnato a ${t.assegnatario_nome}`
                  : " · non assegnato"}
              </div>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <div
          style={{
            marginTop: 18,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong>Ticket #{sel.numero}</strong>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {sel.progetto || "—"} · {sel.email || "—"}
            </span>
            <button
              onClick={() => setSel(null)}
              style={{
                marginLeft: "auto",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
                color: "#94a3b8",
              }}
            >
              ×
            </button>
          </div>
          {sel.descrizione && (
            <div
              style={{
                fontSize: 13,
                color: "#334155",
                background: "#f8fafc",
                borderRadius: 10,
                padding: 10,
                marginBottom: 10,
                whiteSpace: "pre-wrap",
              }}
            >
              {sel.descrizione}
            </div>
          )}
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {thread.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Nessun messaggio nel thread.</div>
            ) : (
              thread.map((m) => (
                <div
                  key={m.id}
                  style={{
                    justifySelf: m.autore_tipo === "operatore" ? "end" : "start",
                    maxWidth: "80%",
                    background: m.autore_tipo === "operatore" ? "#eff6ff" : "#f1f5f9",
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "#0f172a",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "#64748b", marginBottom: 2 }}>
                    {m.autore_tipo === "operatore" ? "Operatore" : "Cliente"}
                  </div>
                  {m.corpo}
                </div>
              ))
            )}
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Scrivi una risposta al cliente..."
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button
              disabled={sending || !reply.trim()}
              onClick={() => invia()}
              style={{
                padding: "9px 16px",
                borderRadius: 9,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {sending ? "Invio..." : "Invia risposta"}
            </button>
            <button
              disabled={sending}
              onClick={() => invia("in_lavorazione")}
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Prendi in carico
            </button>
            <button
              disabled={sending}
              onClick={() => invia("risolto")}
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#15803d",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Segna risolto
            </button>
            <button
              disabled={sending}
              onClick={() => invia("chiuso")}
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: "1px solid #cbd5e1",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
