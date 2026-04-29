import { createClient } from "@supabase/supabase-js";

export type ClientePortalSettings = {
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

type GlobalSettingsRow = Partial<ClientePortalSettings> & {
  singleton_key?: string | null;
};

type OverrideSettingsRow = {
  override_show_progetti?: boolean | null;
  override_show_riepilogo_progetto?: boolean | null;
  override_show_impianti?: boolean | null;
  override_show_scadenze?: boolean | null;
  override_show_rinnovi?: boolean | null;
  override_show_tagliandi?: boolean | null;
  override_show_interventi?: boolean | null;
  override_show_documenti?: boolean | null;
  override_show_cronoprogramma?: boolean | null;
};

const DEFAULT_CLIENTE_PORTAL_SETTINGS: ClientePortalSettings = {
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

function isMissingTableError(message?: string | null) {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function resolveClientePortalSettings(
  cliente_id: string
): Promise<ClientePortalSettings> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { ...DEFAULT_CLIENTE_PORTAL_SETTINGS };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let globalRow: GlobalSettingsRow | null = null;
  let overrideRow: OverrideSettingsRow | null = null;

  const globalRes = await adminClient
    .from("area_cliente_settings_global")
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

  if (!globalRes.error) {
    globalRow = (globalRes.data as GlobalSettingsRow | null) || null;
  } else if (!isMissingTableError(globalRes.error.message)) {
    console.error("[clientePortalVisibility] global settings load error", globalRes.error.message);
  }

  const overrideRes = await adminClient
    .from("clienti_area_cliente_settings")
    .select(
      [
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
    .eq("cliente_id", cliente_id)
    .maybeSingle();

  if (!overrideRes.error) {
    overrideRow = (overrideRes.data as OverrideSettingsRow | null) || null;
  } else if (!isMissingTableError(overrideRes.error.message)) {
    console.error("[clientePortalVisibility] cliente override load error", overrideRes.error.message);
  }

  const effectiveGlobal: ClientePortalSettings = {
    show_progetti: normalizeBoolean(globalRow?.show_progetti, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_progetti),
    show_riepilogo_progetto: normalizeBoolean(
      globalRow?.show_riepilogo_progetto,
      DEFAULT_CLIENTE_PORTAL_SETTINGS.show_riepilogo_progetto
    ),
    show_impianti: normalizeBoolean(globalRow?.show_impianti, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_impianti),
    show_scadenze: normalizeBoolean(globalRow?.show_scadenze, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_scadenze),
    show_rinnovi: normalizeBoolean(globalRow?.show_rinnovi, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_rinnovi),
    show_tagliandi: normalizeBoolean(globalRow?.show_tagliandi, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_tagliandi),
    show_interventi: normalizeBoolean(globalRow?.show_interventi, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_interventi),
    show_documenti: normalizeBoolean(globalRow?.show_documenti, DEFAULT_CLIENTE_PORTAL_SETTINGS.show_documenti),
    show_cronoprogramma: normalizeBoolean(
      globalRow?.show_cronoprogramma,
      DEFAULT_CLIENTE_PORTAL_SETTINGS.show_cronoprogramma
    ),
  };

  return {
    show_progetti: overrideRow?.override_show_progetti ?? effectiveGlobal.show_progetti,
    show_riepilogo_progetto:
      overrideRow?.override_show_riepilogo_progetto ?? effectiveGlobal.show_riepilogo_progetto,
    show_impianti: overrideRow?.override_show_impianti ?? effectiveGlobal.show_impianti,
    show_scadenze: overrideRow?.override_show_scadenze ?? effectiveGlobal.show_scadenze,
    show_rinnovi: overrideRow?.override_show_rinnovi ?? effectiveGlobal.show_rinnovi,
    show_tagliandi: overrideRow?.override_show_tagliandi ?? effectiveGlobal.show_tagliandi,
    show_interventi: overrideRow?.override_show_interventi ?? effectiveGlobal.show_interventi,
    show_documenti: overrideRow?.override_show_documenti ?? effectiveGlobal.show_documenti,
    show_cronoprogramma: overrideRow?.override_show_cronoprogramma ?? effectiveGlobal.show_cronoprogramma,
  };
}
