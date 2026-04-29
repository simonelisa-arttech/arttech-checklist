"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
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
};

type ClienteScadenza = {
  id: string;
  tipo: string | null;
  progetto: string | null;
  data_scadenza: string | null;
  stato: string | null;
  riferimento: string | null;
  source: string | null;
};

type ClienteDocumento = {
  id: string;
  checklist_id: string | null;
  progetto_nome: string | null;
  label: string | null;
  source_type: string | null;
  data: string | null;
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

export default function ClientePortalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<ClienteMe | null>(null);
  const [progetti, setProgetti] = useState<ClienteProgetto[]>([]);
  const [scadenze, setScadenze] = useState<ClienteScadenza[]>([]);
  const [documenti, setDocumenti] = useState<ClienteDocumento[]>([]);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [impersonationToken, setImpersonationToken] = useState("");
  const clienteApiSuffix = impersonationToken
    ? `?impersonation_token=${encodeURIComponent(impersonationToken)}`
    : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = new URLSearchParams(window.location.search).get("impersonation_token");
    setImpersonationToken(String(token || "").trim());
  }, []);

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

        const [meRes, progettiRes, scadenzeRes, documentiRes] = await Promise.all([
          fetch(`/api/cliente/me${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/progetti${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/scadenze${clienteApiSuffix}`, { credentials: "include" }),
          fetch(`/api/cliente/documenti${clienteApiSuffix}`, { credentials: "include" }),
        ]);

        const [meData, progettiData, scadenzeData, documentiData] = await Promise.all([
          meRes.json().catch(() => ({})),
          progettiRes.json().catch(() => ({})),
          scadenzeRes.json().catch(() => ({})),
          documentiRes.json().catch(() => ({})),
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

        {visibleSectionsCount === 0 ? (
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
                {progetti.map((progetto) => (
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
                  </div>
                ))}
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
        )}
      </div>
    </div>
  );
}
