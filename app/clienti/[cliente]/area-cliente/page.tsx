"use client";

import { use, useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type PortalSettings = {
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

type PortalOverrideSettings = {
  override_show_progetti: boolean | null;
  override_show_riepilogo_progetto: boolean | null;
  override_show_impianti: boolean | null;
  override_show_scadenze: boolean | null;
  override_show_rinnovi: boolean | null;
  override_show_tagliandi: boolean | null;
  override_show_interventi: boolean | null;
  override_show_documenti: boolean | null;
  override_show_cronoprogramma: boolean | null;
};

const DEFAULT_SETTINGS: PortalSettings = {
  show_progetti: true,
  show_riepilogo_progetto: true,
  show_impianti: true,
  show_scadenze: true,
  show_rinnovi: false,
  show_tagliandi: false,
  show_interventi: false,
  show_documenti: true,
  show_cronoprogramma: false,
};

const DEFAULT_OVERRIDE_SETTINGS: PortalOverrideSettings = {
  override_show_progetti: null,
  override_show_riepilogo_progetto: null,
  override_show_impianti: null,
  override_show_scadenze: null,
  override_show_rinnovi: null,
  override_show_tagliandi: null,
  override_show_interventi: null,
  override_show_documenti: null,
  override_show_cronoprogramma: null,
};

const SECTIONS: Array<{
  key: keyof PortalSettings;
  overrideKey: keyof PortalOverrideSettings;
  label: string;
}> = [
  { key: "show_progetti", overrideKey: "override_show_progetti", label: "Progetti" },
  {
    key: "show_riepilogo_progetto",
    overrideKey: "override_show_riepilogo_progetto",
    label: "Riepilogo progetto",
  },
  { key: "show_impianti", overrideKey: "override_show_impianti", label: "Impianti" },
  { key: "show_scadenze", overrideKey: "override_show_scadenze", label: "Scadenze" },
  { key: "show_rinnovi", overrideKey: "override_show_rinnovi", label: "Rinnovi" },
  { key: "show_tagliandi", overrideKey: "override_show_tagliandi", label: "Tagliandi" },
  { key: "show_interventi", overrideKey: "override_show_interventi", label: "Interventi" },
  { key: "show_documenti", overrideKey: "override_show_documenti", label: "Documenti" },
  {
    key: "show_cronoprogramma",
    overrideKey: "override_show_cronoprogramma",
    label: "Cronoprogramma",
  },
];

function parseOverrideValue(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function formatGlobalValue(value: boolean) {
  return value ? "Visibile" : "Nascosto";
}

export default function ClienteAreaClienteSettingsPage({
  params,
}: {
  params: Promise<{ cliente: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const resolvedParams = use(params);
  const clienteId = decodeURIComponent(String(resolvedParams?.cliente || "").trim());

  const [loadingAccess, setLoadingAccess] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("Cliente");
  const [globalSettings, setGlobalSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [overrideSettings, setOverrideSettings] =
    useState<PortalOverrideSettings>(DEFAULT_OVERRIDE_SETTINGS);
  const [overrideId, setOverrideId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingAccess(true);
      try {
        const res = await fetch("/api/admin/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (!active) return;
        setCanAccess(res.ok);
      } catch {
        if (!active) return;
        setCanAccess(false);
      } finally {
        if (active) setLoadingAccess(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canAccess || !clienteId) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const [clienteRes, globalRes, overrideRes] = await Promise.all([
          dbFrom("clienti_anagrafica")
            .select("id, denominazione")
            .eq("id", clienteId)
            .maybeSingle(),
          dbFrom("area_cliente_settings_global")
            .select(
              [
                "singleton_key",
                "show_progetti",
                "show_riepilogo_progetto",
                "show_impianti",
                "show_scadenze",
                "show_rinnovi",
                "show_tagliandi",
                "show_interventi",
                "show_documenti",
                "show_cronoprogramma",
              ].join(", ")
            )
            .eq("singleton_key", "default")
            .maybeSingle(),
          dbFrom("clienti_area_cliente_settings")
            .select(
              [
                "id",
                "cliente_id",
                "override_show_progetti",
                "override_show_riepilogo_progetto",
                "override_show_impianti",
                "override_show_scadenze",
                "override_show_rinnovi",
                "override_show_tagliandi",
                "override_show_interventi",
                "override_show_documenti",
                "override_show_cronoprogramma",
              ].join(", ")
            )
            .eq("cliente_id", clienteId)
            .maybeSingle(),
        ]);

        if (!active) return;
        if (clienteRes.error) {
          throw new Error(clienteRes.error.message || "Errore caricamento cliente");
        }
        if (!clienteRes.data?.id) {
          throw new Error("Cliente non trovato");
        }
        if (globalRes.error) {
          throw new Error(globalRes.error.message || "Errore caricamento configurazione globale");
        }
        if (overrideRes.error) {
          throw new Error(overrideRes.error.message || "Errore caricamento override cliente");
        }

        setClienteNome(String(clienteRes.data?.denominazione || "Cliente").trim() || "Cliente");
        setGlobalSettings({
          show_progetti: globalRes.data?.show_progetti ?? DEFAULT_SETTINGS.show_progetti,
          show_riepilogo_progetto:
            globalRes.data?.show_riepilogo_progetto ?? DEFAULT_SETTINGS.show_riepilogo_progetto,
          show_impianti: globalRes.data?.show_impianti ?? DEFAULT_SETTINGS.show_impianti,
          show_scadenze: globalRes.data?.show_scadenze ?? DEFAULT_SETTINGS.show_scadenze,
          show_rinnovi: globalRes.data?.show_rinnovi ?? DEFAULT_SETTINGS.show_rinnovi,
          show_tagliandi: globalRes.data?.show_tagliandi ?? DEFAULT_SETTINGS.show_tagliandi,
          show_interventi: globalRes.data?.show_interventi ?? DEFAULT_SETTINGS.show_interventi,
          show_documenti: globalRes.data?.show_documenti ?? DEFAULT_SETTINGS.show_documenti,
          show_cronoprogramma:
            globalRes.data?.show_cronoprogramma ?? DEFAULT_SETTINGS.show_cronoprogramma,
        });
        setOverrideId(overrideRes.data?.id ? String(overrideRes.data.id) : null);
        setOverrideSettings({
          override_show_progetti: overrideRes.data?.override_show_progetti ?? null,
          override_show_riepilogo_progetto:
            overrideRes.data?.override_show_riepilogo_progetto ?? null,
          override_show_impianti: overrideRes.data?.override_show_impianti ?? null,
          override_show_scadenze: overrideRes.data?.override_show_scadenze ?? null,
          override_show_rinnovi: overrideRes.data?.override_show_rinnovi ?? null,
          override_show_tagliandi: overrideRes.data?.override_show_tagliandi ?? null,
          override_show_interventi: overrideRes.data?.override_show_interventi ?? null,
          override_show_documenti: overrideRes.data?.override_show_documenti ?? null,
          override_show_cronoprogramma:
            overrideRes.data?.override_show_cronoprogramma ?? null,
        });
      } catch (err: any) {
        if (!active) return;
        setError(String(err?.message || err || "Errore caricamento configurazione cliente"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canAccess, clienteId]);

  const hasClienteId = useMemo(() => clienteId.length > 0, [clienteId]);

  async function saveOverride() {
    if (!clienteId) {
      setError("ID cliente non valido");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        cliente_id: clienteId,
        ...overrideSettings,
      };

      if (overrideId) {
        const updateRes = await dbFrom("clienti_area_cliente_settings")
          .update(payload)
          .eq("id", overrideId);
        if (updateRes.error) {
          throw new Error(updateRes.error.message || "Errore salvataggio override cliente");
        }
      } else {
        const upsertRes = await dbFrom("clienti_area_cliente_settings").upsert(payload, {
          onConflict: "cliente_id",
        });
        if (upsertRes.error) {
          throw new Error(upsertRes.error.message || "Errore salvataggio override cliente");
        }
      }

      const refreshRes = await dbFrom("clienti_area_cliente_settings")
        .select("id")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (refreshRes.error) {
        throw new Error(refreshRes.error.message || "Errore ricaricamento override cliente");
      }
      setOverrideId(refreshRes.data?.id ? String(refreshRes.data.id) : overrideId);
      setNotice("Override salvato.");
    } catch (err: any) {
      setError(String(err?.message || err || "Errore salvataggio override cliente"));
    } finally {
      setSaving(false);
    }
  }

  if (loadingAccess) {
    return <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>Verifica accesso...</div>;
  }

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          Accesso non autorizzato
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 34 }}>Configurazione Area Cliente</h1>
        <div style={{ fontSize: 13, opacity: 0.7 }}>{clienteNome}</div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "white",
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        {loading ? (
          <div style={{ opacity: 0.7 }}>Caricamento configurazione...</div>
        ) : !hasClienteId ? (
          <div style={{ color: "#b91c1c", fontSize: 13 }}>ID cliente non valido</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {SECTIONS.map((section) => (
              <div
                key={section.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1.4fr) minmax(180px, 1fr) minmax(180px, 1fr)",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{section.label}</div>
                <div style={{ fontSize: 13, color: "#475569" }}>
                  Default globale: <strong>{formatGlobalValue(globalSettings[section.key])}</strong>
                </div>
                <select
                  value={
                    overrideSettings[section.overrideKey] === null
                      ? "default"
                      : String(overrideSettings[section.overrideKey])
                  }
                  onChange={(e) =>
                    setOverrideSettings((prev) => ({
                      ...prev,
                      [section.overrideKey]: parseOverrideValue(e.target.value),
                    }))
                  }
                  style={{
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    fontSize: 13,
                  }}
                >
                  <option value="default">Usa default</option>
                  <option value="true">Visibile</option>
                  <option value="false">Nascosto</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
        {notice ? <div style={{ color: "#166534", fontSize: 13 }}>{notice}</div> : null}

        <div>
          <button
            type="button"
            onClick={saveOverride}
            disabled={loading || saving || !hasClienteId}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 700,
              cursor: loading || saving || !hasClienteId ? "progress" : "pointer",
              opacity: loading || saving || !hasClienteId ? 0.7 : 1,
            }}
          >
            {saving ? "Salvataggio..." : "Salva override"}
          </button>
        </div>
      </div>
    </div>
  );
}
