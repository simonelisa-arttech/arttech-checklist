import type { ScadenzaAgendaRow } from "@/lib/scadenze/buildScadenzeAgenda";
import { buildClienteEmailList } from "@/lib/clientiEmail";

export const SCADENZE_ALERT_STEPS = [30, 15, 7] as const;
export const SCADENZE_ALERT_STOP_STATUSES = new Set([
  "CONFERMATO",
  "CONFERMATA",
  "RINNOVATO",
  "RINNOVATA",
  "NON_RINNOVATO",
  "NON_RINNOVATA",
]);

export type ScadenzeDeliveryMode = "AUTO_CLIENTE" | "MANUALE_INTERNO";

export type OperatoreRow = {
  id: string;
  nome: string | null;
  ruolo: string | null;
  email: string | null;
  attivo: boolean | null;
  alert_enabled?: boolean | null;
  riceve_notifiche?: boolean | null;
};

export type ClienteDeliveryPreferenceRow = {
  id: string;
  denominazione: string | null;
  emails: string[];
  scadenze_delivery_mode: ScadenzeDeliveryMode;
};

export type ScadenzeAlertRecipient = {
  email: string;
  name: string | null;
  operatoreId: string | null;
  target: "CLIENTE" | "ART_TECH";
};

function normalizeUpper(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function normalizeClienteKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeScadenzeDeliveryMode(value: unknown): ScadenzeDeliveryMode {
  return normalizeUpper(String(value || "")) === "MANUALE_INTERNO"
    ? "MANUALE_INTERNO"
    : "AUTO_CLIENTE";
}

export function getRomeIsoDay(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function parseIsoDay(value?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setHours(0, 0, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function addDaysIsoDay(isoDay: string, days: number) {
  const dt = parseIsoDay(isoDay);
  if (!dt) return isoDay;
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDaysUntilScadenza(scadenza: string, todayIso: string) {
  const scadenzaDate = parseIsoDay(scadenza);
  const todayDate = parseIsoDay(todayIso);
  if (!scadenzaDate || !todayDate) return null;
  return Math.round((scadenzaDate.getTime() - todayDate.getTime()) / 86400000);
}

export function getScadenzaAlertStep(scadenza: string | null, todayIso: string) {
  if (!scadenza) return null;
  const diff = getDaysUntilScadenza(scadenza, todayIso);
  if (diff === null) return null;
  return SCADENZE_ALERT_STEPS.includes(diff as (typeof SCADENZE_ALERT_STEPS)[number])
    ? diff
    : null;
}

export function isStoppedScadenza(row: ScadenzaAgendaRow) {
  return (
    SCADENZE_ALERT_STOP_STATUSES.has(normalizeUpper(row.workflow_stato)) ||
    SCADENZE_ALERT_STOP_STATUSES.has(normalizeUpper(row.stato))
  );
}

export function isAlertSupportedSource(row: ScadenzaAgendaRow) {
  return row.source === "garanzie" || row.source === "licenze" || row.source === "tagliandi";
}

export function getScadenzaLogReference(row: ScadenzaAgendaRow) {
  return `${row.source}:${row.raw_id || row.checklist_id || row.id}`;
}

export function buildScadenzeAlertSubject(cliente: string | null, stepDays: number) {
  return `[Art Tech] Scadenze ${stepDays}gg – ${cliente || "—"}`;
}

export function buildScadenzeAlertText(
  cliente: string | null,
  stepDays: number,
  rows: ScadenzaAgendaRow[]
) {
  const lines = rows.map((row) => {
    const parts = [
      `- ${row.tipo}`,
      row.sottotipo ? `(${row.sottotipo})` : null,
      row.riferimento || row.progetto || "—",
      `Scadenza: ${row.scadenza || "—"}`,
      `Progetto: ${row.progetto || "—"}`,
      row.checklist_id ? `Link: /checklists/${row.checklist_id}` : null,
    ].filter(Boolean);
    return parts.join(" | ");
  });

  return [
    `SCADENZE IN ARRIVO (${stepDays} giorni) — Cliente: ${cliente || "—"}`,
    "",
    ...lines,
  ].join("\n");
}

export function buildScadenzeAlertHtml(
  cliente: string | null,
  stepDays: number,
  rows: ScadenzaAgendaRow[]
) {
  const items = rows
    .map((row) => {
      const parts = [
        `<strong>${escapeHtml(row.tipo)}</strong>`,
        row.sottotipo ? `(${escapeHtml(row.sottotipo)})` : "",
        escapeHtml(row.riferimento || row.progetto || "—"),
        `Scadenza: ${escapeHtml(row.scadenza || "—")}`,
        `Progetto: ${escapeHtml(row.progetto || "—")}`,
        row.checklist_id
          ? `Link: <a href="/checklists/${escapeHtml(row.checklist_id)}">/checklists/${escapeHtml(
              row.checklist_id
            )}</a>`
          : "",
      ]
        .filter(Boolean)
        .join(" • ");
      return `<li>${parts}</li>`;
    })
    .join("");

  return `<div><h2>Scadenze in arrivo (${stepDays} giorni) — ${escapeHtml(
    cliente || "—"
  )}</h2><ul>${items}</ul><p style="font-size:12px;color:#6b7280">Messaggio automatico Art Tech.</p></div>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function listOperatoriForNotifications(supabase: any): Promise<OperatoreRow[]> {
  const withRiceve = await supabase
    .from("operatori")
    .select("id, nome, ruolo, email, attivo, alert_enabled, riceve_notifiche");
  if (!withRiceve.error) return (withRiceve.data || []) as OperatoreRow[];
  if (!String(withRiceve.error.message || "").toLowerCase().includes("riceve_notifiche")) {
    throw new Error(withRiceve.error.message);
  }
  const fallback = await supabase
    .from("operatori")
    .select("id, nome, ruolo, email, attivo, alert_enabled");
  if (fallback.error) throw new Error(fallback.error.message);
  return ((fallback.data || []) as OperatoreRow[]).map((row) => ({
    ...row,
    riceve_notifiche: row.alert_enabled !== false,
  }));
}

export function getDefaultOperatoreByRole(ops: OperatoreRow[], role: string) {
  const wanted = normalizeUpper(role);
  const target = ops.find(
    (row) =>
      row.attivo !== false &&
      row.riceve_notifiche !== false &&
      normalizeUpper(row.ruolo) === wanted &&
      String(row.email || "").includes("@")
  );
  if (target) return target;
  return (
    ops.find(
      (row) =>
        row.attivo !== false &&
        row.riceve_notifiche !== false &&
        String(row.email || "").includes("@")
    ) || null
  );
}

export async function getSystemOperatoreId(supabase: any) {
  const { data: row, error } = await supabase
    .from("operatori")
    .select("id")
    .or("nome.ilike.SYSTEM,ruolo.ilike.SYSTEM")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (row?.id) return String(row.id);

  const { data: inserted, error: insertErr } = await supabase
    .from("operatori")
    .insert({
      nome: "SYSTEM",
      ruolo: "SYSTEM",
      attivo: false,
      alert_enabled: false,
    } as any)
    .select("id")
    .single();
  if (insertErr) return null;
  return String(inserted?.id || "") || null;
}

export async function loadClienteDeliveryPreferences(supabase: any) {
  let selectClause = "id, denominazione, email, email_secondarie, scadenze_delivery_mode";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from("clienti_anagrafica").select(selectClause);
    if (!error) {
      const byId = new Map<string, ClienteDeliveryPreferenceRow>();
      const byName = new Map<string, ClienteDeliveryPreferenceRow>();
      for (const row of (data || []) as any[]) {
        const normalized = {
          id: String(row?.id || "").trim(),
          denominazione: row?.denominazione || null,
          emails: buildClienteEmailList(row?.email || null, row?.email_secondarie || null),
          scadenze_delivery_mode: normalizeScadenzeDeliveryMode(row?.scadenze_delivery_mode),
        } satisfies ClienteDeliveryPreferenceRow;
        if (normalized.id) byId.set(normalized.id, normalized);
        const key = normalizeClienteKey(normalized.denominazione);
        if (key) byName.set(key, normalized);
      }
      return { byId, byName };
    }
    const msg = String(error.message || "").toLowerCase();
    const isOptionalColumnReadError =
      msg.includes("does not exist") || msg.includes("column") || msg.includes("schema cache");
    if (!isOptionalColumnReadError) {
      throw error;
    }
    if (
      selectClause.includes("email_secondarie") &&
      msg.includes("email_secondarie")
    ) {
      selectClause = "id, denominazione, email, scadenze_delivery_mode";
      continue;
    }
    if (
      selectClause.includes("scadenze_delivery_mode") &&
      msg.includes("scadenze_delivery_mode")
    ) {
      selectClause = "id, denominazione, email";
      continue;
    }
    throw error;
  }

  return { byId: new Map<string, ClienteDeliveryPreferenceRow>(), byName: new Map<string, ClienteDeliveryPreferenceRow>() };
}

export function findClienteDeliveryPreference(
  maps: {
    byId: Map<string, ClienteDeliveryPreferenceRow>;
    byName: Map<string, ClienteDeliveryPreferenceRow>;
  },
  row: ScadenzaAgendaRow
) {
  const byId = String(row.cliente_id || "").trim();
  if (byId && maps.byId.has(byId)) return maps.byId.get(byId) || null;
  const byName = normalizeClienteKey(row.cliente);
  if (byName && maps.byName.has(byName)) return maps.byName.get(byName) || null;
  return null;
}

export async function hasScadenzaAlertLog(
  supabase: any,
  params: {
    checklistId: string | null;
    tipo: string;
    riferimento: string;
    trigger: string;
  }
) {
  let query = supabase
    .from("checklist_alert_log")
    .select("id")
    .eq("tipo", params.tipo)
    .eq("riferimento", params.riferimento)
    .eq("trigger", params.trigger)
    .eq("canale", "scadenze_auto")
    .limit(1);
  query =
    params.checklistId
      ? query.eq("checklist_id", params.checklistId)
      : query.is("checklist_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).length > 0;
}
