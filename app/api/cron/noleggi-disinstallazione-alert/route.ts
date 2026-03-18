export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { requireOperatore } from "@/lib/adminAuth";
import {
  getDaysUntilScadenza,
  getRomeIsoDay,
  getDefaultOperatoreByRole,
  getSystemOperatoreId,
  listOperatoriForNotifications,
  type OperatoreRow,
} from "@/lib/scadenze/scadenzeAlertCron";

const NOLEGGIO_ALERT_STEPS = [30, 15, 7, 1] as const;

type NoleggioChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  stato_progetto: string | null;
  noleggio_vendita: string | null;
  data_disinstallazione: string | null;
};

type RentalAlertRowRaw = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  stato_progetto: string | null;
  noleggio_vendita: string | null;
  data_disinstallazione?: string | null;
};

function getCronSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorizedCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const querySecret = new URL(request.url).searchParams.get("secret");
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
}

function isVercelCronRequest(request: Request) {
  return Boolean(request.headers.get("x-vercel-cron"));
}

function getNoleggioAlertStep(dataDisinstallazione: string | null, todayIso: string) {
  if (!dataDisinstallazione) return null;
  const diff = getDaysUntilScadenza(dataDisinstallazione, todayIso);
  if (diff === null) return null;
  return NOLEGGIO_ALERT_STEPS.includes(diff as (typeof NOLEGGIO_ALERT_STEPS)[number]) ? diff : null;
}

function buildSubject(cliente: string | null, stepDays: number) {
  return `[Art Tech] Disinstallazione tra ${stepDays} giorni – ${cliente || "—"}`;
}

function buildText(row: NoleggioChecklistRow, stepDays: number) {
  return [
    "DISINSTALLAZIONE PROGRAMMATA",
    "",
    `Cliente: ${row.cliente || "—"}`,
    `Progetto: ${row.nome_checklist || "—"}`,
    `Data disinstallazione: ${row.data_disinstallazione || "—"}`,
    "",
    `Link: /checklists/${row.id}`,
    "",
    `Promemoria automatico Art Tech (${stepDays} giorni).`,
  ].join("\n");
}

function buildHtml(row: NoleggioChecklistRow, stepDays: number) {
  const cliente = escapeHtml(row.cliente || "—");
  const progetto = escapeHtml(row.nome_checklist || "—");
  const data = escapeHtml(row.data_disinstallazione || "—");
  const checklistId = escapeHtml(row.id);
  return `<div><h2>DISINSTALLAZIONE PROGRAMMATA</h2><p><strong>Cliente:</strong> ${cliente}<br /><strong>Progetto:</strong> ${progetto}<br /><strong>Data disinstallazione:</strong> ${data}</p><p><a href="/checklists/${checklistId}">/checklists/${checklistId}</a></p><p style="font-size:12px;color:#6b7280">Promemoria automatico Art Tech (${stepDays} giorni).</p></div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function hasExistingLog(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  checklistId: string,
  trigger: string
) {
  const { data, error } = await supabase
    .from("checklist_alert_log")
    .select("id")
    .eq("checklist_id", checklistId)
    .eq("trigger", trigger)
    .eq("canale", "noleggi_disinstallazione")
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function GET(request: Request) {
  let supabase: ReturnType<typeof getCronSupabaseClient>;
  if (isVercelCronRequest(request) || isAuthorizedCron(request)) {
    try {
      supabase = getCronSupabaseClient();
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Missing Supabase envs" }, { status: 500 });
    }
  } else {
    const auth = await requireOperatore(request);
    if (!auth.ok) return auth.response;
    supabase = auth.adminClient as ReturnType<typeof getCronSupabaseClient>;
  }

  const todayIso = getRomeIsoDay();

  let data: NoleggioChecklistRow[] = [];
  let error: { message: string } | null = null;

  let res = await supabase
    .from("checklists")
    .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita, data_disinstallazione")
    .eq("stato_progetto", "CONSEGNATO")
    .eq("noleggio_vendita", "NOLEGGIO")
    .order("data_disinstallazione", { ascending: true });

  let missingDataDisinstallazione = false;
  if (res.error && String(res.error.message || "").toLowerCase().includes("data_disinstallazione")) {
    missingDataDisinstallazione = true;
    res = await supabase
      .from("checklists")
      .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita")
      .eq("stato_progetto", "CONSEGNATO")
      .eq("noleggio_vendita", "NOLEGGIO")
      .order("created_at", { ascending: false });
  }

  error = res.error ? { message: res.error.message } : null;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawRows: RentalAlertRowRaw[] = Array.isArray(res.data)
    ? res.data.map((row) => ({
        id: row.id,
        cliente: row.cliente ?? null,
        nome_checklist: row.nome_checklist ?? null,
        stato_progetto: row.stato_progetto ?? null,
        noleggio_vendita: row.noleggio_vendita ?? null,
        data_disinstallazione: "data_disinstallazione" in row ? row.data_disinstallazione ?? null : null,
      }))
    : [];

  data = rawRows.map((row) => ({
    id: row.id,
    cliente: row.cliente,
    nome_checklist: row.nome_checklist,
    stato_progetto: row.stato_progetto,
    noleggio_vendita: row.noleggio_vendita,
    data_disinstallazione: missingDataDisinstallazione ? null : row.data_disinstallazione ?? null,
  }));

  let operatori: OperatoreRow[];
  try {
    operatori = await listOperatoriForNotifications(supabase);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento operatori" }, { status: 500 });
  }

  const internalRecipient = getDefaultOperatoreByRole(operatori || [], "SUPERVISORE");
  const internalEmail = String(internalRecipient?.email || "").trim();
  if (!internalEmail.includes("@")) {
    return NextResponse.json({ error: "Destinatario SUPERVISORE mancante" }, { status: 500 });
  }

  const systemId = await getSystemOperatoreId(supabase);
  const rows = data.filter(
    (row) => String(row.data_disinstallazione || "").trim() !== ""
  );

  let processed = 0;
  let emailsSent = 0;
  let logged = 0;
  let skippedExisting = 0;
  let skippedNoStep = 0;
  const errors: Array<{ checklist_id: string; error: string }> = [];

  for (const row of rows) {
    const step = getNoleggioAlertStep(row.data_disinstallazione, todayIso);
    if (step === null) {
      skippedNoStep += 1;
      continue;
    }

    const trigger = `NOLEGGIO_${step}GG`;
    const alreadySent = await hasExistingLog(supabase, row.id, trigger);
    if (alreadySent) {
      skippedExisting += 1;
      continue;
    }

    const subject = buildSubject(row.cliente, step);
    const text = buildText(row, step);
    const html = buildHtml(row, step);

    try {
      await sendEmail({ to: internalEmail, subject, text, html });
      emailsSent += 1;

      const { error: logErr } = await supabase.from("checklist_alert_log").insert({
        checklist_id: row.id,
        tipo: "NOLEGGIO",
        riferimento: `noleggio_disinstallazione:${row.id}`,
        scadenza: row.data_disinstallazione,
        stato: row.stato_progetto || null,
        destinatario: `Disinstallazione noleggio ${step}gg`,
        to_operatore_id: internalRecipient?.id || null,
        to_email: internalEmail,
        to_nome: internalRecipient?.nome || "Art Tech",
        from_operatore_id: systemId,
        subject,
        messaggio: text,
        inviato_email: true,
        trigger,
        canale: "noleggi_disinstallazione",
      });

      if (logErr) {
        errors.push({ checklist_id: row.id, error: `Log insert failed: ${logErr.message}` });
        continue;
      }

      processed += 1;
      logged += 1;
    } catch (err: any) {
      const errorMessage = String(err?.message || "Errore invio email");
      errors.push({ checklist_id: row.id, error: errorMessage });
      await supabase.from("checklist_alert_log").insert({
        checklist_id: row.id,
        tipo: "NOLEGGIO",
        riferimento: `noleggio_disinstallazione:${row.id}`,
        scadenza: row.data_disinstallazione,
        stato: row.stato_progetto || null,
        destinatario: `Disinstallazione noleggio ${step}gg`,
        to_operatore_id: internalRecipient?.id || null,
        to_email: internalEmail,
        to_nome: internalRecipient?.nome || "Art Tech",
        from_operatore_id: systemId,
        subject,
        messaggio: errorMessage,
        inviato_email: false,
        trigger: `${trigger}_ERROR`,
        canale: "noleggi_disinstallazione_error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    today: todayIso,
    processed,
    emailsSent,
    logged,
    skippedExisting,
    skippedNoStep,
    recipient: {
      operatore_id: internalRecipient?.id || null,
      nome: internalRecipient?.nome || "Art Tech",
      email: internalEmail,
    },
    errors,
  });
}
