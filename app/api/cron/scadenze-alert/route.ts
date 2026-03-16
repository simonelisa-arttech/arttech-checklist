export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { buildScadenzeAgenda, type ScadenzaAgendaRow } from "@/lib/scadenze/buildScadenzeAgenda";
import {
  addDaysIsoDay,
  buildScadenzeAlertHtml,
  buildScadenzeAlertSubject,
  buildScadenzeAlertText,
  findClienteDeliveryPreference,
  getDefaultOperatoreByRole,
  getRomeIsoDay,
  getScadenzaAlertStep,
  getScadenzaLogReference,
  getSystemOperatoreId,
  hasScadenzaAlertLog,
  isAlertSupportedSource,
  isStoppedScadenza,
  listOperatoriForNotifications,
  loadClienteDeliveryPreferences,
  type ClienteDeliveryPreferenceRow,
  type OperatoreRow,
  type ScadenzeAlertRecipient,
} from "@/lib/scadenze/scadenzeAlertCron";

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

function getClienteGroupKey(row: ScadenzaAgendaRow) {
  return `${String(row.cliente_id || "").trim()}::${String(row.cliente || "").trim().toLowerCase()}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof getCronSupabaseClient>;
  try {
    supabase = getCronSupabaseClient();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Missing Supabase envs" }, { status: 500 });
  }

  const todayIso = getRomeIsoDay();
  const toIso = addDaysIsoDay(todayIso, 30);

  let scadenzeRows: ScadenzaAgendaRow[];
  try {
    scadenzeRows = await buildScadenzeAgenda(supabase, { from: todayIso, to: toIso });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore caricamento agenda scadenze" },
      { status: 500 }
    );
  }

  let operatori: OperatoreRow[];
  try {
    operatori = await listOperatoriForNotifications(supabase);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento operatori" }, { status: 500 });
  }

  let clientPrefs: {
    byId: Map<string, ClienteDeliveryPreferenceRow>;
    byName: Map<string, ClienteDeliveryPreferenceRow>;
  };
  try {
    clientPrefs = await loadClienteDeliveryPreferences(supabase);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento clienti" }, { status: 500 });
  }

  const systemId = await getSystemOperatoreId(supabase);
  const internalRecipient = getDefaultOperatoreByRole(operatori || [], "SUPERVISORE");

  const candidateRows = scadenzeRows.filter((row) => {
    if (!isAlertSupportedSource(row)) return false;
    if (!row.scadenza) return false;
    if (isStoppedScadenza(row)) return false;
    return getScadenzaAlertStep(row.scadenza, todayIso) !== null;
  });

  const grouped = new Map<string, ScadenzaAgendaRow[]>();
  for (const row of candidateRows) {
    const step = getScadenzaAlertStep(row.scadenza, todayIso);
    if (step === null) continue;
    const key = `${getClienteGroupKey(row)}::${step}`;
    const bucket = grouped.get(key) || [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  let processedGroups = 0;
  let emailsSent = 0;
  let loggedRows = 0;
  let skippedExisting = 0;
  let skippedStopped = scadenzeRows.filter((row) => isAlertSupportedSource(row) && isStoppedScadenza(row)).length;
  let skippedMissingRecipient = 0;
  const errors: Array<{ cliente: string | null; step: number | null; error: string }> = [];

  for (const rows of grouped.values()) {
    const first = rows[0];
    const step = getScadenzaAlertStep(first.scadenza, todayIso);
    if (step === null) continue;

    const unsentRows: ScadenzaAgendaRow[] = [];
    for (const row of rows) {
      const alreadySent = await hasScadenzaAlertLog(supabase, {
        checklistId: row.checklist_id || null,
        tipo: row.tipo,
        riferimento: getScadenzaLogReference(row),
        trigger: `SCADENZE_${step}GG`,
      });
      if (alreadySent) {
        skippedExisting += 1;
        continue;
      }
      unsentRows.push(row);
    }
    if (unsentRows.length === 0) continue;

    const prefs = findClienteDeliveryPreference(clientPrefs, first);
    const deliveryMode = prefs?.scadenze_delivery_mode || "AUTO_CLIENTE";
    const recipients: ScadenzeAlertRecipient[] = [];

    if (deliveryMode === "MANUALE_INTERNO") {
      const email = String(internalRecipient?.email || "").trim();
      if (email.includes("@")) {
        recipients.push({
          email,
          name: internalRecipient?.nome || "Art Tech",
          operatoreId: internalRecipient?.id || null,
          target: "ART_TECH",
        });
      }
    } else {
      const email = String(prefs?.email || "").trim();
      if (email.includes("@")) {
        recipients.push({
          email,
          name: first.cliente || "Cliente",
          operatoreId: null,
          target: "CLIENTE",
        });
      }
    }

    if (recipients.length === 0) {
      skippedMissingRecipient += unsentRows.length;
      errors.push({
        cliente: first.cliente || null,
        step,
        error:
          deliveryMode === "MANUALE_INTERNO"
            ? "Destinatario interno Art Tech mancante"
            : "Email cliente mancante per AUTO_CLIENTE",
      });
      await supabase.from("checklist_alert_log").insert({
        checklist_id: first.checklist_id || null,
        tipo: first.tipo,
        riferimento: getScadenzaLogReference(first),
        scadenza: first.scadenza,
        stato: first.workflow_stato || first.stato || null,
        destinatario: `Scadenze auto ${step}gg`,
        to_operatore_id: internalRecipient?.id || null,
        to_email: recipients[0]?.email || null,
        to_nome: recipients[0]?.name || internalRecipient?.nome || null,
        from_operatore_id: systemId,
        subject: buildScadenzeAlertSubject(first.cliente || null, step),
        messaggio:
          deliveryMode === "MANUALE_INTERNO"
            ? "Destinatario interno Art Tech mancante"
            : "Email cliente mancante per AUTO_CLIENTE",
        inviato_email: false,
        trigger: `SCADENZE_${step}GG_ERROR`,
        canale: "scadenze_auto_error",
      });
      continue;
    }

    const subject = buildScadenzeAlertSubject(first.cliente || null, step);
    const text = buildScadenzeAlertText(first.cliente || null, step, unsentRows);
    const html = buildScadenzeAlertHtml(first.cliente || null, step, unsentRows);

    for (const recipient of recipients) {
      try {
        await sendEmail({ to: recipient.email, subject, text, html });
        emailsSent += 1;

        for (const row of unsentRows) {
          const { error: logErr } = await supabase.from("checklist_alert_log").insert({
            checklist_id: row.checklist_id || null,
            tipo: row.tipo,
            riferimento: getScadenzaLogReference(row),
            scadenza: row.scadenza,
            stato: row.workflow_stato || row.stato || null,
            destinatario: `Scadenze auto ${step}gg`,
            to_operatore_id: recipient.operatoreId,
            to_email: recipient.email,
            to_nome: recipient.name,
            from_operatore_id: systemId,
            subject,
            messaggio: text,
            inviato_email: true,
            trigger: `SCADENZE_${step}GG`,
            canale: "scadenze_auto",
          });
          if (logErr) {
            errors.push({
              cliente: row.cliente || null,
              step,
              error: `Log insert failed: ${logErr.message}`,
            });
            continue;
          }
          loggedRows += 1;
        }
      } catch (err: any) {
        const errorMessage = String(err?.message || "Errore invio email");
        errors.push({
          cliente: first.cliente || null,
          step,
          error: errorMessage,
        });
        await supabase.from("checklist_alert_log").insert({
          checklist_id: first.checklist_id || null,
          tipo: first.tipo,
          riferimento: getScadenzaLogReference(first),
          scadenza: first.scadenza,
          stato: first.workflow_stato || first.stato || null,
          destinatario: `Scadenze auto ${step}gg`,
          to_operatore_id: recipient.operatoreId,
          to_email: recipient.email,
          to_nome: recipient.name,
          from_operatore_id: systemId,
          subject,
          messaggio: `ERRORE INVIO EMAIL: ${errorMessage}\n\n${text}`,
          inviato_email: false,
          trigger: `SCADENZE_${step}GG_ERROR`,
          canale: "scadenze_auto_error",
        });
      }
    }

    processedGroups += 1;
  }

  return NextResponse.json({
    ok: true,
    processedGroups,
    candidateRows: candidateRows.length,
    emailsSent,
    loggedRows,
    skippedExisting,
    skippedStopped,
    skippedMissingRecipient,
    steps: [30, 15, 7],
    source: "buildScadenzeAgenda",
    errors,
  });
}
