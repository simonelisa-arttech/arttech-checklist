"use client";

import { useEffect, useState } from "react";
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

const FIELD_LABELS: Array<{ key: keyof PortalSettings; label: string }> = [
  { key: "show_progetti", label: "Progetti" },
  { key: "show_riepilogo_progetto", label: "Riepilogo progetto" },
  { key: "show_impianti", label: "Impianti" },
  { key: "show_scadenze", label: "Scadenze" },
  { key: "show_rinnovi", label: "Rinnovi" },
  { key: "show_tagliandi", label: "Tagliandi" },
  { key: "show_interventi", label: "Interventi" },
  { key: "show_documenti", label: "Documenti" },
  { key: "show_cronoprogramma", label: "Cronoprogramma" },
];

export default function AreaClienteSettingsPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loadingAccess, setLoadingAccess] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);

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
    if (!canAccess) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: loadErr } = await dbFrom("area_cliente_settings_global")
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
          .maybeSingle();
        if (!active) return;
        if (loadErr) {
          throw new Error(loadErr.message || "Errore caricamento configurazione");
        }
        setSettings({
          show_progetti: data?.show_progetti ?? DEFAULT_SETTINGS.show_progetti,
          show_riepilogo_progetto:
            data?.show_riepilogo_progetto ?? DEFAULT_SETTINGS.show_riepilogo_progetto,
          show_impianti: data?.show_impianti ?? DEFAULT_SETTINGS.show_impianti,
          show_scadenze: data?.show_scadenze ?? DEFAULT_SETTINGS.show_scadenze,
          show_rinnovi: data?.show_rinnovi ?? DEFAULT_SETTINGS.show_rinnovi,
          show_tagliandi: data?.show_tagliandi ?? DEFAULT_SETTINGS.show_tagliandi,
          show_interventi: data?.show_interventi ?? DEFAULT_SETTINGS.show_interventi,
          show_documenti: data?.show_documenti ?? DEFAULT_SETTINGS.show_documenti,
          show_cronoprogramma: data?.show_cronoprogramma ?? DEFAULT_SETTINGS.show_cronoprogramma,
        });
      } catch (err: any) {
        if (!active) return;
        setError(String(err?.message || err || "Errore caricamento configurazione"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canAccess]);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { ...settings };
      const updateRes = await dbFrom("area_cliente_settings_global")
        .update(payload)
        .eq("singleton_key", "default");
      if (updateRes.error) {
        throw new Error(updateRes.error.message || "Errore salvataggio configurazione");
      }

      const updatedRows = Array.isArray(updateRes.data) ? updateRes.data : [];
      if (updatedRows.length === 0) {
        const upsertRes = await dbFrom("area_cliente_settings_global").upsert(
          {
            singleton_key: "default",
            ...payload,
          },
          { onConflict: "singleton_key" }
        );
        if (upsertRes.error) {
          throw new Error(upsertRes.error.message || "Errore salvataggio configurazione");
        }
      }

      setNotice("Configurazione salvata.");
    } catch (err: any) {
      setError(String(err?.message || err || "Errore salvataggio configurazione"));
    } finally {
      setSaving(false);
    }
  }

  if (loadingAccess) {
    return <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>Verifica accesso...</div>;
  }

  if (!canAccess) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
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
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 34 }}>Configurazione Area Cliente</h1>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Definisci i default globali delle sezioni visibili nel portale cliente.
        </div>
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
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {FIELD_LABELS.map((item) => (
              <label
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        )}

        {error ? (
          <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
        ) : null}
        {notice ? (
          <div style={{ color: "#166534", fontSize: 13 }}>{notice}</div>
        ) : null}

        <div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={loading || saving}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 700,
              cursor: loading || saving ? "progress" : "pointer",
              opacity: loading || saving ? 0.7 : 1,
            }}
          >
            {saving ? "Salvataggio..." : "Salva configurazione"}
          </button>
        </div>
      </div>
    </div>
  );
}
