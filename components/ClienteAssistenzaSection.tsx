"use client";

import { useEffect, useRef, useState } from "react";

type TierInfo = {
  tier: "expired" | "standard" | "plus" | "premium" | "ultra" | "events";
  saas_active: boolean;
  saas_expiry: string | null;
  saas_type: string | null;
  ore_residue: number | null;
  interventi_periodo_stato?: "OK" | "NESSUN_CONTRATTO" | "PERIODO_NON_IMPOSTATO" | null;
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

// P2.3.1: shape dei dati PER-PROGETTO già esposti dalla GET (consumati visivamente in P2.3.2).
type ProgettoTierVoce = "GARANZIA" | "PLUS" | "ULTRA" | "EVENT" | "NESSUNA";

type ProgettoCopertura = {
  progettoId: string;
  progettoNome: string | null;
  tier: ProgettoTierVoce;
  source: string;
  premiumClient: {
    attivo: boolean;
    origine: string | null;
    referente: string | null;
    whatsapp: string | null;
  };
  garanziaAttiva: boolean;
  supportoAttivo: boolean;
  supportoScaduto: boolean;
  scadenzaPiano: string | null;
  scadenzaGaranzia: string | null;
  interventi: {
    inclusiAnno: number | null;
    illimitati: boolean;
    usati: number | null;
    residui: number | null;
    periodoStato?: "OK" | "NESSUN_CONTRATTO" | "PERIODO_NON_IMPOSTATO";
    dataInizio?: string | null;
    dataFine?: string | null;
  } | null;
  impianti: Array<{
    id: string | null;
    nome: string;
    seriale: string | null;
    stato: "ok" | "warn" | "exp";
    garanzia: string | null;
  }>;
};

type AggregatoCliente = {
  bestTier: ProgettoTierVoce;
  premiumClientAttivo: boolean;
};

type Ticket = {
  id: string;
  numero: number;
  categoria: string;
  descrizione: string;
  stato: string;
  created_at: string;
  // P4.2 — tracking arricchito
  tier?: string | null;
  urgenza?: string | null;
  impianto?: string | null;
  updated_at?: string | null;
  // P4.3 — tipo richiesta (assistenza | preventivo)
  tipo_richiesta?: string | null;
};

const PROBLEMI = [
  { id: "noimage", icon: "📺", label: "Schermo senza immagine" },
  { id: "brightness", icon: "🔆", label: "Luminosità / colori anomali" },
  { id: "pixels", icon: "🔴", label: "Pixel / zone spente" },
  { id: "control", icon: "🖥", label: "CMS / controllo" },
  { id: "power", icon: "⚡", label: "Alimentazione" },
  { id: "other", icon: "🔧", label: "Altro problema" },
] as const;

// P4.2 — label categoria e stili stato/urgenza per il pannello "I miei ticket".
const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  PROBLEMI.map((p) => [p.id, p.label])
);
const STATO_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  aperto: { label: "Aperto", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  in_lavorazione: { label: "In lavorazione", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  in_attesa: { label: "In attesa", bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff" },
  chiuso: { label: "Chiuso", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};
const URGENZA_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  bassa: { label: "Urgenza bassa", bg: "#f1f5f9", color: "#475569" },
  media: { label: "Urgenza media", bg: "#fff7ed", color: "#c2410c" },
  alta: { label: "Urgenza alta", bg: "#fef2f2", color: "#b91c1c" },
};

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
  plus: { label: "Art Tech PLUS attivo", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  premium: { label: "Art Tech PREMIUM attivo", bg: "#fefce8", border: "#fde68a", color: "#a16207" },
  ultra: { label: "CARE ULTRA attivo — priorità assoluta", bg: "#faf5ff", border: "#e9d5ff", color: "#7e22ce" },
  events: { label: "Art Tech EVENTS attivo — supporto evento", bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" },
};

// P2.3.2: stile/label UFFICIALI per i tier per-progetto.
const TIER_STYLE_PROGETTO: Record<ProgettoTierVoce, { label: string; bg: string; border: string; color: string }> = {
  GARANZIA: { label: "Garanzia", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  PLUS: { label: "CARE PLUS", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
  ULTRA: { label: "CARE ULTRA", bg: "#faf5ff", border: "#e9d5ff", color: "#7e22ce" },
  EVENT: { label: "ART TECH EVENT", bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" },
  NESSUNA: { label: "Nessuna copertura", bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
};

function formatDate(d?: string | null) {
  if (!d) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function formatInterventiInfo(interventi: ProgettoCopertura["interventi"]) {
  if (!interventi) return "";
  if (interventi.periodoStato === "PERIODO_NON_IMPOSTATO") return "Periodo non impostato";
  if (interventi.illimitati) return `Usati ${interventi.usati ?? 0} / illimitati`;
  if (interventi.inclusiAnno != null) {
    return `Usati ${interventi.usati ?? 0} / Totale ${interventi.inclusiAnno} / Residui ${
      interventi.residui ?? 0
    }`;
  }
  return "";
}

export default function ClienteAssistenzaSection({
  apiSuffix,
  initialProjectId = null,
  initialImpiantoId = null,
  autoFocusTicket = false,
  mode = null,
}: {
  apiSuffix: string;
  // P3.2: deep-link dalla landing LedCare (tutti opzionali, fallback = comportamento attuale).
  initialProjectId?: string | null;
  initialImpiantoId?: string | null;
  autoFocusTicket?: boolean;
  mode?: "assistenza" | "preventivo" | null;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);
  const [info, setInfo] = useState<TierInfo | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Dati per-progetto letti dalla GET.
  const [progetti, setProgetti] = useState<ProgettoCopertura[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [aggregato, setAggregato] = useState<AggregatoCliente | null>(null);
  // P2.3.2: selezione progetto/impianto (UI per-progetto).
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedImpiantoId, setSelectedImpiantoId] = useState<string | null>(null);

  const [categoria, setCategoria] = useState<string | null>(null);
  const [descrizione, setDescrizione] = useState("");
  const [impianto, setImpianto] = useState("");
  const [telefono, setTelefono] = useState("");
  // P4.1 — screening avanzato ticket.
  const [urgenza, setUrgenza] = useState<"bassa" | "media" | "alta">("media");
  const [accessoQuota, setAccessoQuota] = useState(false);
  const [referentePresente, setReferentePresente] = useState(false);
  const [dvrDpi, setDvrDpi] = useState(false);
  const [ricambio, setRicambio] = useState("");
  // P4.5 — allegati foto/video
  const [files, setFiles] = useState<File[]>([]);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ numero: number; preventivo?: boolean } | null>(null);
  // P5.6 — thread bidirezionale per ticket nel Hub cliente.
  type ClienteMessaggio = { id: string; autore_tipo: string; corpo: string; created_at: string };
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<Record<string, ClienteMessaggio[]>>({});
  const [threadReply, setThreadReply] = useState<Record<string, string>>({});
  const [threadBusy, setThreadBusy] = useState(false);

  async function toggleThread(ticketId: string) {
    if (openThreadId === ticketId) {
      setOpenThreadId(null);
      return;
    }
    setOpenThreadId(ticketId);
    try {
      const res = await fetch(`/api/cliente/assistenza/${ticketId}/messaggi${apiSuffix}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setThreadMsgs((m) => ({ ...m, [ticketId]: (data?.messaggi as ClienteMessaggio[]) || [] }));
      }
    } catch {
      // ignore
    }
  }

  async function inviaRispostaCliente(ticketId: string) {
    const corpo = String(threadReply[ticketId] || "").trim();
    if (!corpo) return;
    setThreadBusy(true);
    try {
      const res = await fetch(`/api/cliente/assistenza/${ticketId}/messaggi${apiSuffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ corpo }),
      });
      if (res.ok) {
        setThreadReply((r) => ({ ...r, [ticketId]: "" }));
        const rr = await fetch(`/api/cliente/assistenza/${ticketId}/messaggi${apiSuffix}`, {
          credentials: "include",
        });
        const dd = await rr.json().catch(() => ({}));
        if (rr.ok) setThreadMsgs((m) => ({ ...m, [ticketId]: (dd?.messaggi as ClienteMessaggio[]) || [] }));
      }
    } finally {
      setThreadBusy(false);
    }
  }

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`/api/cliente/assistenza${apiSuffix}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Errore caricamento assistenza"));
      setInfo(data?.assistenza || null);
      // P2.3.1: legge i nuovi campi per-progetto; `assistenza` resta il fallback visivo attuale.
      setProgetti(Array.isArray(data?.progetti) ? (data.progetti as ProgettoCopertura[]) : []);
      setAggregato((data?.aggregato as AggregatoCliente) || null);
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

  // P2.3.2: con un solo progetto, selezione automatica.
  useEffect(() => {
    if (progetti.length === 1) setSelectedProjectId(progetti[0].progettoId);
  }, [progetti]);

  // P3.2: applica una sola volta il deep-link (?progetto/?impianto) se combacia coi dati caricati.
  useEffect(() => {
    if (deepLinkApplied) return;
    if (progetti.length === 0) return;
    if (initialProjectId) {
      const match = progetti.find((p) => p.progettoId === initialProjectId);
      if (match) {
        setSelectedProjectId(match.progettoId);
        if (initialImpiantoId && match.impianti.some((i) => i.id === initialImpiantoId)) {
          setSelectedImpiantoId(initialImpiantoId);
        }
      }
    }
    setDeepLinkApplied(true);
  }, [progetti, initialProjectId, initialImpiantoId, deepLinkApplied]);

  // P3.2: se la landing chiede assistenza/preventivo/ticket, porta la sezione in vista.
  useEffect(() => {
    if (loading) return;
    if (!autoFocusTicket) return;
    if (typeof window === "undefined") return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, autoFocusTicket]);

  async function submitTicket() {
    setSendError(null);
    if (descrizione.trim().length < 10) {
      setSendError("Descrivi il problema (almeno 10 caratteri).");
      return;
    }
    setSending(true);
    try {
      const perProgetto = progetti.length > 0 && !!selectedProjectId;
      // P4.1 — campi screening comuni a entrambi i percorsi.
      const screening = {
        urgenza,
        accesso_quota: accessoQuota,
        referente_presente: referentePresente,
        dvr_dpi: dvrDpi,
        ricambio: ricambio.trim() || null,
      };
      const payload = perProgetto
        ? {
            categoria: categoria || "other",
            descrizione,
            telefono,
            progettoId: selectedProjectId,
            ...(selectedImpiantoId ? { impiantoId: selectedImpiantoId } : {}),
            ...screening,
          }
        : { categoria: categoria || "other", descrizione, impianto, telefono, ...screening };
      const res = await fetch(`/api/cliente/assistenza${apiSuffix}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Errore apertura ticket"));
      const isPreventivo = usaPerProgetto
        ? selectedProject?.tier === "NESSUNA"
        : info?.tier === "expired";
      setConfirmed({ numero: Number(data?.ticket?.numero || 0), preventivo: isPreventivo });
      setDescrizione("");
      setCategoria(null);
      setRicambio("");
      setUrgenza("media");
      setAccessoQuota(false);
      setReferentePresente(false);
      setDvrDpi(false);
      // P4.5 — carica gli allegati selezionati, referenziati all'id del ticket appena creato.
      const newTicketId = String(data?.ticket?.id || "");
      const toUpload = files;
      if (newTicketId && toUpload.length > 0) {
        setUploadInfo(`Caricamento allegati (0/${toUpload.length})…`);
        let ok = 0;
        for (const f of toUpload) {
          try {
            const fd = new FormData();
            fd.append("ticketId", newTicketId);
            fd.append("file", f);
            const up = await fetch(`/api/cliente/assistenza/allegati${apiSuffix}`, {
              method: "POST",
              credentials: "include",
              body: fd,
            });
            if (up.ok) ok += 1;
          } catch {
            // continua con gli altri file
          }
        }
        setUploadInfo(`${ok}/${toUpload.length} allegati caricati`);
        setFiles([]);
      }
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

  // P2.3.2: derivati per-progetto.
  const usaPerProgetto = progetti.length > 0;
  const selectedProject = progetti.find((p) => p.progettoId === selectedProjectId) || null;
  const tsProg = selectedProject ? TIER_STYLE_PROGETTO[selectedProject.tier] : null;

  return (
    <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {mode ? (
        <div
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#1e40af",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          {mode === "preventivo"
            ? "Hai richiesto un preventivo: seleziona il progetto e descrivi l'intervento. Se non hai una copertura attiva, l'assistenza sarà a pagamento previo preventivo."
            : "Apri una richiesta di assistenza: seleziona il progetto interessato e descrivi il problema."}
        </div>
      ) : null}
      {usaPerProgetto ? (
        <>
          {/* Selettore progetto (per-progetto) */}
          {progetti.length > 1 ? (
            <select
              value={selectedProjectId || ""}
              onChange={(e) => {
                setSelectedProjectId(e.target.value || null);
                setSelectedImpiantoId(null);
                setImpianto("");
              }}
              style={inputStyle}
            >
              <option value="">Seleziona il progetto…</option>
              {progetti.map((p) => (
                <option key={p.progettoId} value={p.progettoId}>
                  {p.progettoNome || p.progettoId}
                </option>
              ))}
            </select>
          ) : selectedProject ? (
            <div style={{ fontSize: 13, color: "#475569" }}>
              Progetto: <strong>{selectedProject.progettoNome || selectedProject.progettoId}</strong>
            </div>
          ) : null}

          {selectedProject && tsProg ? (
            <>
              {/* Badge copertura per-progetto + PREMIUM CLIENT */}
              <div
                style={{
                  border: `1px solid ${tsProg.border}`,
                  background: tsProg.bg,
                  color: tsProg.color,
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
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {tsProg.label}
                  {selectedProject.premiumClient.attivo ? (
                    <span
                      style={{
                        background: "#0f172a",
                        color: "white",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      PREMIUM CLIENT
                    </span>
                  ) : null}
                </span>
                <span style={{ fontWeight: 500 }}>
                  {selectedProject.scadenzaPiano ? `scadenza ${formatDate(selectedProject.scadenzaPiano)}` : ""}
                  {formatInterventiInfo(selectedProject.interventi)
                    ? ` · ${formatInterventiInfo(selectedProject.interventi)}`
                    : ""}
                </span>
              </div>

              {/* WhatsApp / referente per-progetto */}
              {selectedProject.premiumClient.whatsapp ? (
                <a
                  href={`https://wa.me/${selectedProject.premiumClient.whatsapp.replace(/\D/g, "")}`}
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
                  💬 WhatsApp diretto{" "}
                  {selectedProject.premiumClient.referente ? `— ${selectedProject.premiumClient.referente}` : ""} (H24)
                </a>
              ) : null}

              {/* Nessuna copertura */}
              {selectedProject.tier === "NESSUNA" ? (
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
                  Questo impianto non risulta coperto da garanzia o contratto attivo: l&apos;assistenza è
                  erogabile <strong>a pagamento previo preventivo</strong>. Apri comunque la segnalazione:
                  riceverai un&apos;offerta entro 1 giorno lavorativo. L&apos;uscita del tecnico è addebitata
                  anche in caso di mancata riparazione per cause non dipendenti dalla nostra volontà.
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          {/* Stato copertura (legacy) */}
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
              {info.interventi_periodo_stato === "PERIODO_NON_IMPOSTATO"
                ? " · Periodo non impostato"
                : info.ore_residue != null
                ? ` · ${info.ore_residue} interventi residui`
                : ""}
            </span>
          </div>

          {info.whatsapp ? (
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
        </>
      )}

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
          {confirmed.preventivo ? (
            <>
              ✅ Richiesta di preventivo <strong>#{confirmed.numero}</strong> inviata. Non essendoci una
              copertura attiva, riceverai un&apos;offerta di assistenza a preventivo entro 1 giorno
              lavorativo.{" "}
            </>
          ) : (
            <>
              ✅ Ticket <strong>#{confirmed.numero}</strong> aperto correttamente. Il team tecnico ti
              contatterà entro 1 giorno lavorativo (salvo SLA contrattuale dedicato).{" "}
            </>
          )}
          {uploadInfo ? (
            <div style={{ marginTop: 6, fontSize: 12.5, color: "#166534", fontWeight: 600 }}>
              📎 {uploadInfo}
            </div>
          ) : null}
          <div style={{ marginTop: 6 }}>
            <button
              onClick={() => {
                setConfirmed(null);
                setUploadInfo(null);
              }}
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
        </div>
      ) : usaPerProgetto && !selectedProjectId ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13,
            color: "#475569",
          }}
        >
          Seleziona un progetto qui sopra per aprire una segnalazione di assistenza.
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
              {usaPerProgetto ? (
                selectedProject && selectedProject.impianti.length > 1 ? (
                  <select
                    value={selectedImpiantoId || ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      setSelectedImpiantoId(id);
                      const imp = selectedProject.impianti.find((x) => x.id === id) || null;
                      setImpianto(
                        imp ? `${imp.nome}${imp.seriale ? ` [${imp.seriale}]` : ""}` : ""
                      );
                    }}
                    style={inputStyle}
                  >
                    <option value="">Seleziona impianto interessato (facoltativo)</option>
                    {selectedProject.impianti.map((i, idx) => (
                      <option key={i.id || idx} value={i.id || ""}>
                        {i.nome} {i.seriale ? `— ${i.seriale}` : ""}
                      </option>
                    ))}
                  </select>
                ) : null
              ) : info.impianti.length > 1 ? (
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

              {/* P4.1 — Urgenza */}
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                Urgenza
                <select
                  value={urgenza}
                  onChange={(e) => setUrgenza(e.target.value as "bassa" | "media" | "alta")}
                  style={{ ...inputStyle, marginTop: 6 }}
                >
                  <option value="bassa">Bassa — nessun disservizio operativo</option>
                  <option value="media">Media — disservizio parziale</option>
                  <option value="alta">Alta — impianto fermo / evento imminente</option>
                </select>
              </label>

              {/* P4.1 — Ricambio / componente */}
              <input
                type="text"
                value={ricambio}
                onChange={(e) => setRicambio(e.target.value)}
                placeholder="Ricambio o componente coinvolto, se noto (facoltativo)"
                style={inputStyle}
              />

              {/* P4.1 — Accesso e sicurezza al sito */}
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: "#334155",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700 }}>Accesso e sicurezza al sito</div>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={accessoQuota}
                    onChange={(e) => setAccessoQuota(e.target.checked)}
                  />
                  Impianto in quota / in altezza (richiede piattaforma o DPI anticaduta)
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={referentePresente}
                    onChange={(e) => setReferentePresente(e.target.checked)}
                  />
                  Referente disponibile in loco durante l&apos;intervento
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={dvrDpi}
                    onChange={(e) => setDvrDpi(e.target.checked)}
                  />
                  DVR / DPI disponibili sul sito
                </label>
              </div>

              {/* P4.5 — allegati foto/video */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                  Foto / video del problema (facoltativo, max 10MB ciascuno)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,video/mp4,video/quicktime"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  style={{ fontSize: 12.5 }}
                />
                {files.length > 0 ? (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {files.length} file selezionati
                  </div>
                ) : null}
              </div>

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
                  : (usaPerProgetto ? selectedProject?.tier === "NESSUNA" : info.tier === "expired")
                  ? "Richiedi preventivo →"
                  : "Apri ticket →"}
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* P4.2 — Pannello "I miei ticket" con stato/tracking */}
      {tickets.length > 0 ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "6px 0 8px" }}>
            I miei ticket
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tickets.map((t) => {
              const st =
                STATO_STYLE[String(t.stato || "").toLowerCase()] || {
                  label: String(t.stato || "—"),
                  bg: "#f1f5f9",
                  color: "#475569",
                  border: "#e2e8f0",
                };
              const urg = t.urgenza ? URGENZA_STYLE[String(t.urgenza).toLowerCase()] : null;
              const catLabel = CATEGORIA_LABEL[String(t.categoria || "")] || t.categoria || "—";
              const aggiornato =
                t.updated_at && t.updated_at !== t.created_at
                  ? formatDate(t.updated_at)
                  : null;
              return (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 12.5,
                    color: "#475569",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: "#0f172a" }}>#{t.numero}</span>
                      {String(t.tipo_richiesta || "").toLowerCase() === "preventivo" ? (
                        <span
                          style={{
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px solid #fde68a",
                            borderRadius: 999,
                            padding: "1px 8px",
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          PREVENTIVO
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        border: `1px solid ${st.border}`,
                        background: st.bg,
                        color: st.color,
                        borderRadius: 999,
                        padding: "2px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>{catLabel}</span>
                    {urg ? (
                      <span
                        style={{
                          background: urg.bg,
                          color: urg.color,
                          borderRadius: 999,
                          padding: "1px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {urg.label}
                      </span>
                    ) : null}
                    {t.tier && String(t.tier).toUpperCase() !== "NESSUNA" ? (
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        · copertura {String(t.tier).toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  {t.impianto ? (
                    <div style={{ fontSize: 12, color: "#64748b" }}>Impianto: {t.impianto}</div>
                  ) : null}
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {String(t.descrizione || "").slice(0, 120)}
                    {String(t.descrizione || "").length > 120 ? "…" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Aperto il {formatDate(t.created_at)}
                    {aggiornato ? ` · ultimo aggiornamento ${aggiornato}` : ""}
                  </div>

                  {/* P5.6 — conversazione bidirezionale con l'assistenza */}
                  <button
                    type="button"
                    onClick={() => toggleThread(t.id)}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 2,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#334155",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {openThreadId === t.id ? "Nascondi conversazione" : "Conversazione / rispondi"}
                  </button>

                  {openThreadId === t.id ? (
                    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                      {(threadMsgs[t.id] || []).length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          Nessun messaggio. Scrivi qui sotto per aggiungere informazioni alla tua richiesta.
                        </div>
                      ) : (
                        (threadMsgs[t.id] || []).map((m) => (
                          <div
                            key={m.id}
                            style={{
                              justifySelf: m.autore_tipo === "cliente" ? "end" : "start",
                              maxWidth: "85%",
                              background: m.autore_tipo === "cliente" ? "#eff6ff" : "#f1f5f9",
                              borderRadius: 12,
                              padding: "8px 12px",
                              fontSize: 12.5,
                              color: "#0f172a",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                              {m.autore_tipo === "cliente" ? "Tu" : "Assistenza Art Tech"}
                            </div>
                            {m.corpo}
                          </div>
                        ))
                      )}
                      <textarea
                        value={threadReply[t.id] || ""}
                        onChange={(e) => setThreadReply((r) => ({ ...r, [t.id]: e.target.value }))}
                        placeholder="Scrivi una risposta..."
                        rows={2}
                        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", resize: "vertical", fontSize: 12.5 }}
                      />
                      <button
                        type="button"
                        disabled={threadBusy || !String(threadReply[t.id] || "").trim()}
                        onClick={() => inviaRispostaCliente(t.id)}
                        style={{
                          alignSelf: "flex-start",
                          padding: "7px 14px",
                          borderRadius: 8,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {threadBusy ? "Invio..." : "Invia"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
