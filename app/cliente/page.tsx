"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import ClienteAssistenzaSection from "@/components/ClienteAssistenzaSection";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type ClienteMe = {
  cliente_id: string;
  email: string;
  attivo: boolean;
  settings?: {
    show_progetti: boolean;
    show_riepilogo_progetto: boolean;
    show_impianti: boolean;
    show_scadenze: boolean;
    show_rinnovi: boolean;
    show_tagliandi: boolean;
    show_interventi: boolean;
    show_documenti: boolean;
    show_cronoprogramma: boolean;
  };
  impersonation?: boolean;
  impersonated_by_operatore_id?: string | null;
};

type ClienteProgetto = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  noleggio_vendita: string | null;
  stato_progetto: string | null;
  impianti?: ClienteImpianto[];
  fatture_emesse?: ClienteFatturaEmessa[];
};

type ClienteImpianto = {
  id?: string;
  position?: number | null;
  impianto_quantita?: number | null;
  dimensioni?: string | null;
  passo?: string | null;
  tipo_impianto?: string | null;
  impianto_descrizione?: string | null;
};

type ClienteFatturaEmessa = {
  data_intervento?: string | null;
  descrizione?: string | null;
  numero_fattura?: string | null;
  fatturato_il?: string | null;
};

type ClienteScadenza = {
  id: string;
  tipo: string | null;
  progetto: string | null;
  checklist_id: string | null;
  data_scadenza: string | null;
  stato: string | null;
  riferimento: string | null;
  source: string | null;
};

// P5.4 — CTA contestuali per tipo di scadenza (richieste tracciate).
type ScadenzaCta = { label: string; tipo: "rinnovo" | "tagliando" | "upgrade" | "rinnovo_sim"; primary?: boolean };
function ctaPerScadenza(tipo?: string | null): ScadenzaCta[] {
  const t = String(tipo || "").toUpperCase();
  if (t.includes("TAGLIANDO")) return [{ label: "Prenota tagliando", tipo: "tagliando", primary: true }];
  if (t.includes("GARANZIA"))
    return [
      { label: "Rinnova", tipo: "rinnovo", primary: true },
      { label: "Attiva CARE ULTRA", tipo: "upgrade" },
    ];
  if (t.includes("SIM")) return [{ label: "Rinnova SIM", tipo: "rinnovo_sim", primary: true }];
  if (t.includes("LICENZA")) return [{ label: "Rinnova", tipo: "rinnovo", primary: true }];
  if (t.includes("SAAS")) return [{ label: "Rinnova copertura", tipo: "rinnovo", primary: true }];
  return [];
}

type ClienteDocumento = {
  id: string;
  checklist_id: string | null;
  progetto_nome: string | null;
  label: string | null;
  source_type: string | null;
  data: string | null;
};

type ClienteIntervento = {
  id: string;
  checklist_id: string | null;
  progetto_nome?: string | null;
  titolo?: string | null;
  descrizione?: string | null;
  tipo?: string | null;
  stato?: string | null;
  data_intervento?: string | null;
  note?: string | null;
};

type ClienteRinnovo = {
  id: string;
  checklist_id: string | null;
  progetto_nome?: string | null;
  tipo?: string | null;
  descrizione?: string | null;
  data_scadenza?: string | null;
  stato?: string | null;
};

type ClienteTagliando = {
  id: string;
  checklist_id: string | null;
  progetto_nome?: string | null;
  tipo?: string | null;
  descrizione?: string | null;
  data_scadenza?: string | null;
  stato?: string | null;
};

function renderPill(
  label: string,
  colors: { border: string; background: string; color: string }
) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function formatDateLabel(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw.slice(0, 10) || "—";
  return date.toLocaleDateString("it-IT");
}

function formatImpiantoSummary(impianto?: ClienteImpianto) {
  if (!impianto) return "Impianto non specificato";
  const parts = [
    Number.isFinite(Number(impianto.impianto_quantita)) && Number(impianto.impianto_quantita) > 0
      ? `${Number(impianto.impianto_quantita)}x`
      : null,
    String(impianto.dimensioni || "").trim() || null,
    String(impianto.passo || "").trim() || null,
    String(impianto.tipo_impianto || "").trim() || null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "Impianto non specificato";
}

function sectionShell(title: string, subtitle: string, content: React.ReactNode) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        background: "white",
        padding: 18,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{subtitle}</div>
      </div>
      {content}
    </section>
  );
}

const DEFAULT_PORTAL_SETTINGS = {
  show_progetti: true,
  show_riepilogo_progetto: true,
  show_impianti: true,
  show_scadenze: true,
  show_rinnovi: false,
  show_tagliandi: false,
  show_interventi: false,
  show_documenti: true,
  show_cronoprogramma: false,
} as const;

// P3.4 — Art Tech Hub: le 5 sezioni del customer portal (card + top nav).
type HubSection = "home" | "dashboard" | "assistenza" | "marketplace" | "news" | "analytics";

const HUB_SECTIONS: Array<{
  id: Exclude<HubSection, "home">;
  label: string;
  icon: string;
  tagline: string;
}> = [
  { id: "dashboard", label: "Dashboard", icon: "▦", tagline: "Impianti, contratti, progetti e stato" },
  { id: "assistenza", label: "Assistenza", icon: "◈", tagline: "Ticket, diagnostica e coperture LedCare" },
  { id: "marketplace", label: "Marketplace", icon: "◎", tagline: "Rinnovi, upgrade e servizi Art Tech" },
  { id: "news", label: "News", icon: "◧", tagline: "AT Channel: video, case history, eventi" },
  { id: "analytics", label: "Analytics", icon: "◔", tagline: "Utilizzo, performance e storico" },
];

// P3.4 — Marketplace Art Tech: CTA contestuali (struttura; wiring commerciale in EPIC successiva).
const MARKETPLACE_ITEMS: Array<{
  id: string;
  icon: string;
  title: string;
  desc: string;
  cta: string;
  accent: string;
}> = [
  { id: "rinnovi", icon: "↻", title: "Rinnovi & coperture", desc: "Rinnova licenze, SaaS e garanzie in scadenza.", cta: "Gestisci rinnovi", accent: "#1d4ed8" },
  { id: "upgrade-esp", icon: "▲", title: "Upgrade EyeSmartPlayer", desc: "Potenzia il player e le funzioni di monitoraggio.", cta: "Scopri l'upgrade", accent: "#7e22ce" },
  { id: "at-channel", icon: "◧", title: "AT Channel", desc: "Porta i tuoi impianti nel network pubblicitario.", cta: "Attiva AT Channel", accent: "#0f766e" },
  { id: "mydooh", icon: "◑", title: "MyDOOH", desc: "Gestione self-service dei tuoi spazi DOOH.", cta: "Esplora MyDOOH", accent: "#c2410c" },
  { id: "doohbook", icon: "▤", title: "DOOHBook", desc: "Prenotazione campagne sul circuito.", cta: "Vai a DOOHBook", accent: "#b45309" },
  { id: "adledmarket", icon: "◆", title: "AdLedMarket", desc: "Marketplace degli spazi LED del network.", cta: "Apri AdLedMarket", accent: "#be123c" },
  { id: "promozioni", icon: "★", title: "Promozioni", desc: "Offerte dedicate ai clienti Art Tech.", cta: "Vedi promozioni", accent: "#15803d" },
  { id: "voucher", icon: "▣", title: "Voucher & crediti", desc: "Utilizza voucher e crediti servizi.", cta: "I miei voucher", accent: "#4338ca" },
];

function isHubSection(value: string | null | undefined): value is HubSection {
  return (
    value === "home" ||
    value === "dashboard" ||
    value === "assistenza" ||
    value === "marketplace" ||
    value === "news" ||
    value === "analytics"
  );
}

export default function ClientePortalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<ClienteMe | null>(null);
  const [progetti, setProgetti] = useState<ClienteProgetto[]>([]);
  const [scadenze, setScadenze] = useState<ClienteScadenza[]>([]);
  const [documenti, setDocumenti] = useState<ClienteDocumento[]>([]);
  const [interventi, setInterventi] = useState<ClienteIntervento[]>([]);
  const [rinnovi, setRinnovi] = useState<ClienteRinnovo[]>([]);
  const [tagliandi, setTagliandi] = useState<ClienteTagliando[]>([]);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  // P5.4 — stato invio richieste dalle CTA scadenze. Chiave: `${scadenzaId}:${tipo}`.
  const [richiestaStato, setRichiestaStato] = useState<Record<string, "invio" | "fatto" | "errore">>({});
  const [impersonationToken, setImpersonationToken] = useState("");
  // P3.2: deep-link letti dalla query string (CTA landing LedCare). Fallback: tutti null.
  const [deepLink, setDeepLink] = useState<{
    azione: string | null;
    ticket: string | null;
    progetto: string | null;
    impianto: string | null;
    sezione: string | null;
  }>({ azione: null, ticket: null, progetto: null, impianto: null, sezione: null });
  // P3.4: sezione Hub attiva (home = griglia delle 5 card).
  const [activeSection, setActiveSection] = useState<HubSection>("home");
  const clienteApiSuffix = impersonationToken
    ? `?impersonation_token=${encodeURIComponent(impersonationToken)}`
    : "";

  // P5.4 — invio richiesta tracciata da una CTA di scadenza.
  async function inviaRichiestaScadenza(scadenza: ClienteScadenza, tipo: ScadenzaCta["tipo"]) {
    const key = `${scadenza.id}:${tipo}`;
    if (!scadenza.checklist_id) {
      setRichiestaStato((s) => ({ ...s, [key]: "errore" }));
      return;
    }
    setRichiestaStato((s) => ({ ...s, [key]: "invio" }));
    try {
      const res = await fetch(`/api/cliente/richieste${clienteApiSuffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tipo,
          checklist_id: scadenza.checklist_id,
          scadenza_tipo: scadenza.tipo,
          scadenza_data: scadenza.data_scadenza,
        }),
      });
      setRichiestaStato((s) => ({ ...s, [key]: res.ok ? "fatto" : "errore" }));
    } catch {
      setRichiestaStato((s) => ({ ...s, [key]: "errore" }));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setImpersonationToken(String(sp.get("impersonation_token") || "").trim());
    setDeepLink({
      azione: sp.get("azione"),
      ticket: sp.get("ticket"),
      progetto: sp.get("progetto"),
      impianto: sp.get("impianto"),
      sezione: sp.get("sezione"),
    });
  }, []);

  // P3.2: intento derivato dai deep-link (assistenza/preventivo/ticket nuovo → apri sezione assistenza).
  const assistenzaMode: "assistenza" | "preventivo" | null =
    deepLink.azione === "preventivo"
      ? "preventivo"
      : deepLink.azione === "assistenza"
      ? "assistenza"
      : null;
  const autoFocusTicket =
    assistenzaMode !== null || deepLink.ticket === "nuovo";

  // P3.4: apri la sezione Hub giusta dal deep-link (assistenza/ticket → Assistenza; ?sezione=<id>).
  useEffect(() => {
    if (assistenzaMode !== null || deepLink.ticket === "nuovo") {
      setActiveSection("assistenza");
      return;
    }
    if (deepLink.sezione && isHubSection(deepLink.sezione)) {
      setActiveSection(deepLink.sezione);
    }
  }, [assistenzaMode, deepLink.ticket, deepLink.sezione]);

  async function openDocumento(documentId: string) {
    try {
      setOpeningDocumentId(documentId);
      const res = await fetch(
        `/api/cliente/documenti/${encodeURIComponent(documentId)}/download${clienteApiSuffix}`,
        {
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(String(data?.error || "Errore apertura documento"));
      }
      window.open(String(data.url), "_blank", "noopener,noreferrer");
    } catch (err: any) {
      window.alert(String(err?.message || err || "Errore apertura documento"));
    } finally {
      setOpeningDocumentId(null);
    }
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          meRes,
          progettiRes,
          scadenzeRes,
          documentiRes,
          interventiRes,
          rinnoviRes,
          tagliandiRes,
        ] = await Promise.all([
          fetch(`/api/cliente/me${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/progetti${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/scadenze${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/documenti${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/interventi${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/rinnovi${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/tagliandi${clienteApiSuffix}`, { credentials: "include" }),
        ]);

        const [
          meData,
          progettiData,
          scadenzeData,
          documentiData,
          interventiData,
          rinnoviData,
          tagliandiData,
        ] = await Promise.all([
          meRes.json().catch(() => ({})),
          progettiRes.json().catch(() => ({})),
          scadenzeRes.json().catch(() => ({})),
          documentiRes.json().catch(() => ({})),
          interventiRes.json().catch(() => ({})),
          rinnoviRes.json().catch(() => ({})),
          tagliandiRes.json().catch(() => ({})),
        ]);

        if (!meRes.ok) {
          throw new Error(String(meData?.error || "Errore caricamento profilo cliente"));
        }
        if (!progettiRes.ok) {
          throw new Error(String(progettiData?.error || "Errore caricamento progetti cliente"));
        }
        if (!scadenzeRes.ok) {
          throw new Error(String(scadenzeData?.error || "Errore caricamento scadenze cliente"));
        }
        if (!documentiRes.ok) {
          throw new Error(String(documentiData?.error || "Errore caricamento documenti cliente"));
        }
        if (!interventiRes.ok) {
          throw new Error(String(interventiData?.error || "Errore caricamento interventi cliente"));
        }
        if (!rinnoviRes.ok) {
          throw new Error(String(rinnoviData?.error || "Errore caricamento rinnovi cliente"));
        }
        if (!tagliandiRes.ok) {
          throw new Error(String(tagliandiData?.error || "Errore caricamento tagliandi cliente"));
        }

        if (!active) return;

        setMe(
          meData?.cliente
            ? ({
                ...(meData.cliente as ClienteMe),
                settings: {
                  show_progetti:
                    meData?.settings?.show_progetti ?? DEFAULT_PORTAL_SETTINGS.show_progetti,
                  show_riepilogo_progetto:
                    meData?.settings?.show_riepilogo_progetto ??
                    DEFAULT_PORTAL_SETTINGS.show_riepilogo_progetto,
                  show_impianti:
                    meData?.settings?.show_impianti ?? DEFAULT_PORTAL_SETTINGS.show_impianti,
                  show_scadenze:
                    meData?.settings?.show_scadenze ?? DEFAULT_PORTAL_SETTINGS.show_scadenze,
                  show_rinnovi:
                    meData?.settings?.show_rinnovi ?? DEFAULT_PORTAL_SETTINGS.show_rinnovi,
                  show_tagliandi:
                    meData?.settings?.show_tagliandi ?? DEFAULT_PORTAL_SETTINGS.show_tagliandi,
                  show_interventi:
                    meData?.settings?.show_interventi ?? DEFAULT_PORTAL_SETTINGS.show_interventi,
                  show_documenti:
                    meData?.settings?.show_documenti ?? DEFAULT_PORTAL_SETTINGS.show_documenti,
                  show_cronoprogramma:
                    meData?.settings?.show_cronoprogramma ??
                    DEFAULT_PORTAL_SETTINGS.show_cronoprogramma,
                },
                impersonation: meData?.impersonation === true,
                impersonated_by_operatore_id:
                  String(meData?.impersonated_by_operatore_id || "").trim() || null,
              } as ClienteMe)
            : null
        );
        setProgetti(((progettiData?.progetti as ClienteProgetto[]) || []).filter(Boolean));
        setScadenze(((scadenzeData?.scadenze as ClienteScadenza[]) || []).filter(Boolean));
        setDocumenti(((documentiData?.documenti as ClienteDocumento[]) || []).filter(Boolean));
        setInterventi(((interventiData?.interventi as ClienteIntervento[]) || []).filter(Boolean));
        setRinnovi(((rinnoviData?.rinnovi as ClienteRinnovo[]) || []).filter(Boolean));
        setTagliandi(((tagliandiData?.tagliandi as ClienteTagliando[]) || []).filter(Boolean));
      } catch (err: any) {
        if (!active) return;
        setError(String(err?.message || err || "Errore caricamento area cliente"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [clienteApiSuffix]);

  const clienteLabel = useMemo(() => {
    const firstProjectCliente = progetti.find((item) => String(item.cliente || "").trim())?.cliente;
    const firstScadenzaCliente = scadenze.find((item: any) => String(item?.cliente || "").trim()) as
      | { cliente?: string | null }
      | undefined;
    return (
      String(firstProjectCliente || firstScadenzaCliente?.cliente || "").trim() ||
      "Area cliente"
    );
  }, [progetti, scadenze]);

  const effectiveSettings = me?.settings || DEFAULT_PORTAL_SETTINGS;
  const visibleSectionsCount = [
    effectiveSettings.show_progetti,
    effectiveSettings.show_scadenze,
    effectiveSettings.show_documenti,
  ].filter(Boolean).length;

  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  // P3.4 — Art Tech Hub: stato sintetico per le card della home.
  const hubStatus: Record<Exclude<HubSection, "home">, string> = {
    dashboard: `${progetti.length} progetti · ${scadenze.length} scadenze`,
    assistenza: "Apri un ticket o consulta la copertura",
    marketplace: "Rinnovi, upgrade e servizi",
    news: "Novità dal network Art Tech",
    analytics: "In arrivo",
  };

  const topNav = (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 8,
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        type="button"
        onClick={() => setActiveSection("home")}
        style={{
          padding: "9px 14px",
          borderRadius: 12,
          border: "none",
          background: activeSection === "home" ? "#0f172a" : "transparent",
          color: activeSection === "home" ? "#fff" : "#334155",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Hub
      </button>
      {HUB_SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setActiveSection(s.id)}
          style={{
            padding: "9px 14px",
            borderRadius: 12,
            border: "none",
            background: activeSection === s.id ? "#0f172a" : "transparent",
            color: activeSection === s.id ? "#fff" : "#334155",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span aria-hidden style={{ opacity: 0.85 }}>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </nav>
  );

  const homeView = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
      }}
    >
      {HUB_SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setActiveSection(s.id)}
          style={{
            textAlign: "left",
            cursor: "pointer",
            border: "1px solid #e2e8f0",
            borderRadius: 22,
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            padding: 20,
            display: "grid",
            gap: 10,
            boxShadow: "0 12px 34px rgba(15,23,42,0.05)",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "#0f172a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
            aria-hidden
          >
            {s.icon}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{s.label}</div>
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{s.tagline}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{hubStatus[s.id]}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8" }}>Apri →</div>
        </button>
      ))}
    </div>
  );

  const marketplaceView = (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 13, color: "#64748b" }}>
        Servizi e opportunità dedicati al tuo account. Le attivazioni saranno progressivamente abilitate.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {MARKETPLACE_ITEMS.map((m) => (
          <div
            key={m.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              background: "#fff",
              padding: 16,
              display: "grid",
              gap: 8,
              boxShadow: "0 10px 26px rgba(15,23,42,0.04)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: `${m.accent}14`,
                color: m.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
              aria-hidden
            >
              {m.icon}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{m.title}</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{m.desc}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: m.accent }}>{m.cta}</span>
              {renderPill("PRESTO", { border: "#e2e8f0", background: "#f8fafc", color: "#64748b" })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const placeholderView = (title: string, body: string) => (
    <div
      style={{
        border: "1px dashed #cbd5e1",
        borderRadius: 22,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        padding: 40,
        textAlign: "center",
        display: "grid",
        gap: 10,
        justifyItems: "center",
      }}
    >
      <div style={{ fontSize: 30 }} aria-hidden>{title === "News" ? "◧" : "◔"}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{title}</div>
      <div style={{ fontSize: 14, color: "#64748b", maxWidth: 460, lineHeight: 1.6 }}>{body}</div>
      {renderPill("IN ARRIVO", { border: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" })}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f8fafc 220px, #eef2f7 100%)",
        padding: "24px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 18 }}>
        <header
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 24,
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            padding: 22,
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.05)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{clienteLabel}</div>
            {me
              ? renderPill(me.attivo ? "ACCOUNT ATTIVO" : "ACCOUNT NON ATTIVO", {
                  border: me.attivo ? "#86efac" : "#fca5a5",
                  background: me.attivo ? "#f0fdf4" : "#fef2f2",
                  color: me.attivo ? "#166534" : "#b91c1c",
                })
              : null}
          </div>
          <div style={{ fontSize: 14, color: "#475569" }}>
            {me?.email || "Profilo cliente"}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Progetti</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{progetti.length}</div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Scadenze</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{scadenze.length}</div>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Documenti visibili</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{documenti.length}</div>
            </div>
          </div>
        </header>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 16,
              padding: 14,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {me?.impersonation ? (
          <div
            style={{
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              borderRadius: 16,
              padding: 14,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, maxWidth: 760 }}>
              Modalità assistenza: stai visualizzando l’area cliente come operatore interno. Il
              cliente non vede questo banner.
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.assign("/clienti");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #f59e0b",
                background: "white",
                color: "#92400e",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Esci assistenza
            </button>
          </div>
        ) : null}

        {topNav}

        {activeSection === "home" ? homeView : null}
        {activeSection === "marketplace" ? marketplaceView : null}
        {activeSection === "news"
          ? placeholderView(
              "News",
              "Video, case history, webinar ed eventi dal network Art Tech e AT Channel. Sezione in arrivo."
            )
          : null}
        {activeSection === "analytics"
          ? placeholderView(
              "Analytics",
              "Utilizzo, performance e storico dei tuoi impianti e servizi. Sezione in arrivo."
            )
          : null}

        {activeSection === "dashboard" ? (
          visibleSectionsCount === 0 ? (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "white",
              padding: 18,
              color: "#475569",
              fontSize: 14,
            }}
          >
            Nessun contenuto disponibile al momento. Contatta Art Tech per maggiori informazioni.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
              alignItems: "start",
            }}
          >
          {effectiveSettings.show_progetti
            ? sectionShell(
            "Progetti",
            "I progetti associati al tuo account cliente.",
            loading ? (
              <div style={{ fontSize: 14, color: "#64748b" }}>Caricamento progetti...</div>
            ) : progetti.length === 0 ? (
              <div style={{ fontSize: 14, color: "#64748b" }}>Nessun progetto disponibile.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {progetti.map((progetto) => {
                  const projectInterventi = interventi.filter(
                    (item) => String(item.checklist_id || "").trim() === progetto.id
                  );
                  const projectRinnovi = rinnovi.filter(
                    (item) => String(item.checklist_id || "").trim() === progetto.id
                  );
                  const projectTagliandi = tagliandi.filter(
                    (item) => String(item.checklist_id || "").trim() === progetto.id
                  );
                  const projectFattureEmesse = Array.isArray(progetto.fatture_emesse)
                    ? progetto.fatture_emesse
                    : [];
                  return (
                  <div
                    key={progetto.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                      {progetto.nome_checklist || "Progetto"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {renderPill(String(progetto.stato_progetto || "—").toUpperCase(), {
                        border: "#cbd5e1",
                        background: "#f8fafc",
                        color: "#334155",
                      })}
                      {progetto.noleggio_vendita
                        ? renderPill(String(progetto.noleggio_vendita).toUpperCase(), {
                            border: "#bfdbfe",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                          })
                        : null}
                    </div>
                    {effectiveSettings.show_impianti &&
                    Array.isArray(progetto.impianti) &&
                    progetto.impianti.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                          Impianti
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {progetto.impianti.map((impianto, index) => (
                            <div
                              key={impianto.id || `${progetto.id}-impianto-${index}`}
                              style={{
                                fontSize: 13,
                                color: "#334155",
                                lineHeight: 1.4,
                              }}
                            >
                              {formatImpiantoSummary(impianto)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {effectiveSettings.show_interventi && projectInterventi.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                          Interventi
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {projectInterventi.map((intervento) => (
                            <div
                              key={intervento.id}
                              style={{
                                fontSize: 13,
                                color: "#334155",
                                lineHeight: 1.45,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {formatDateLabel(intervento.data_intervento)} •{" "}
                              {String(intervento.tipo || intervento.titolo || "Intervento").trim()} •{" "}
                              {String(intervento.stato || "—").trim().toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {effectiveSettings.show_rinnovi && projectRinnovi.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                          Rinnovi
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {projectRinnovi.map((rinnovo) => (
                            <div
                              key={rinnovo.id}
                              style={{
                                fontSize: 13,
                                color: "#334155",
                                lineHeight: 1.45,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {formatDateLabel(rinnovo.data_scadenza)} •{" "}
                              {String(rinnovo.tipo || rinnovo.descrizione || "Rinnovo").trim()} •{" "}
                              {String(rinnovo.stato || "—").trim().toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {effectiveSettings.show_tagliandi && projectTagliandi.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                          Tagliandi
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {projectTagliandi.map((tagliando) => (
                            <div
                              key={tagliando.id}
                              style={{
                                fontSize: 13,
                                color: "#334155",
                                lineHeight: 1.45,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {formatDateLabel(tagliando.data_scadenza)} •{" "}
                              {String(tagliando.tipo || tagliando.descrizione || "Tagliando").trim()} •{" "}
                              {String(tagliando.stato || "—").trim().toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {effectiveSettings.show_documenti && projectFattureEmesse.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                          Fatture emesse
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          {projectFattureEmesse.map((fattura, index) => (
                            <div
                              key={`${progetto.id}-fattura-${index}-${
                                fattura.numero_fattura || fattura.fatturato_il || fattura.data_intervento || "row"
                              }`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "#334155",
                                  lineHeight: 1.45,
                                  overflowWrap: "anywhere",
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {formatDateLabel(fattura.fatturato_il || fattura.data_intervento)} • Intervento
                                {String(fattura.numero_fattura || "").trim()
                                  ? ` • Fattura ${String(fattura.numero_fattura).trim()}`
                                  : ""}
                              </div>
                              {String(fattura.numero_fattura || "").trim() ? (
                                <a
                                  href={`/api/cliente/fatture/${encodeURIComponent(
                                    String(fattura.numero_fattura).trim()
                                  )}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "1px solid #cbd5e1",
                                    background: "white",
                                    color: "#0f172a",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                  }}
                                >
                                  Scarica
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "1px solid #e5e7eb",
                                    background: "#f8fafc",
                                    color: "#94a3b8",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    cursor: "not-allowed",
                                  }}
                                >
                                  Scarica
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            )
          )
            : null}

          {effectiveSettings.show_scadenze
            ? sectionShell(
            "Scadenze",
            "Licenze, rinnovi, garanzie e tagliandi del tuo perimetro.",
            loading ? (
              <div style={{ fontSize: 14, color: "#64748b" }}>Caricamento scadenze...</div>
            ) : scadenze.length === 0 ? (
              <div style={{ fontSize: 14, color: "#64748b" }}>Nessuna scadenza disponibile.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {scadenze.map((scadenza) => (
                  <div
                    key={scadenza.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      {renderPill(String(scadenza.tipo || "SCADENZA").toUpperCase(), {
                        border: "#cbd5e1",
                        background: "#f8fafc",
                        color: "#334155",
                      })}
                      {renderPill(String(scadenza.stato || "—").toUpperCase(), {
                        border: scadenza.stato === "SCADUTA" ? "#fca5a5" : "#fcd34d",
                        background: scadenza.stato === "SCADUTA" ? "#fef2f2" : "#fffbeb",
                        color: scadenza.stato === "SCADUTA" ? "#b91c1c" : "#b45309",
                      })}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {scadenza.progetto || scadenza.riferimento || "Progetto"}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569" }}>
                      Scadenza: {formatDateLabel(scadenza.data_scadenza)}
                    </div>
                    {scadenza.checklist_id && ctaPerScadenza(scadenza.tipo).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                        {ctaPerScadenza(scadenza.tipo).map((cta) => {
                          const key = `${scadenza.id}:${cta.tipo}`;
                          const st = richiestaStato[key];
                          const done = st === "fatto";
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={st === "invio" || done}
                              onClick={() => inviaRichiestaScadenza(scadenza, cta.tipo)}
                              style={{
                                padding: "7px 14px",
                                borderRadius: 9,
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: st === "invio" || done ? "default" : "pointer",
                                border: cta.primary ? "1px solid #C9142B" : "1px solid #cbd5e1",
                                background: done ? "#f0fdf4" : cta.primary ? "#C9142B" : "#fff",
                                color: done ? "#15803d" : cta.primary ? "#fff" : "#334155",
                              }}
                            >
                              {done
                                ? "✓ Richiesta inviata"
                                : st === "invio"
                                ? "Invio..."
                                : st === "errore"
                                ? "Riprova"
                                : cta.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )
            : null}

          {effectiveSettings.show_documenti
            ? sectionShell(
            "Documenti",
            "Solo documenti e allegati marcati come visibili al cliente.",
            loading ? (
              <div style={{ fontSize: 14, color: "#64748b" }}>Caricamento documenti...</div>
            ) : documenti.length === 0 ? (
              <div style={{ fontSize: 14, color: "#64748b" }}>Nessun documento disponibile.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {documenti.map((documento) => (
                  <div
                    key={documento.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      {renderPill(String(documento.source_type || "documento").toUpperCase(), {
                        border: "#d1fae5",
                        background: "#ecfdf5",
                        color: "#047857",
                      })}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {documento.label || "Documento"}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569" }}>
                      {documento.progetto_nome || "Progetto non specificato"}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => openDocumento(documento.id)}
                        disabled={openingDocumentId === documento.id}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: openingDocumentId === documento.id ? "#f8fafc" : "white",
                          color: "#0f172a",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: openingDocumentId === documento.id ? "progress" : "pointer",
                          opacity: openingDocumentId === documento.id ? 0.7 : 1,
                        }}
                      >
                        {openingDocumentId === documento.id ? "Apro..." : "Apri"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )
            : null}

          </div>
          )
        ) : null}

        {activeSection === "assistenza"
          ? sectionShell(
              "Assistenza",
              "Apri un ticket: ti guidiamo in base alla copertura attiva sul tuo impianto.",
              <ClienteAssistenzaSection
                apiSuffix={clienteApiSuffix}
                initialProjectId={deepLink.progetto}
                initialImpiantoId={deepLink.impianto}
                autoFocusTicket={autoFocusTicket}
                mode={assistenzaMode}
              />
            )
          : null}
      </div>
    </div>
  );
}
