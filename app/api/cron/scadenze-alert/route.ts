export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { requireOperatore } from "@/lib/adminAuth";
import { buildScadenzeAgenda, type ScadenzaAgendaRow } from "@/lib/scadenze/buildScadenzeAgenda";
import {
  addDaysIsoDay,
  buildScadenzeAlertHtml,
  buildScadenzeAlertSubject,
  buildScadenzeAlertText,
  findClienteDeliveryPreference,
  getDefaultOperatoreByRole,
  getDaysUntilScadenza,
  getRomeIsoDay,
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
import {
  normalizeScadenzaAlertGlobalRule,
  normalizeScadenzaAlertRuleType,
  renderTemplateText,
  type ScadenzaAlertGlobalRuleRow,
} from "@/lib/scadenzeAlertConfig";

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

function getClienteGroupKey(row: ScadenzaAgendaRow) {
  return `${String(row.cliente_id || "").trim()}::${String(row.cliente || "").trim().toLowerCase()}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildRuleContext(
  row: ScadenzaAgendaRow,
  step: number,
  rowCount: number
) {
  return {
    cliente: row.cliente || "",
    progetto: row.progetto || "",
    tipo_scadenza: normalizeScadenzaAlertRuleType(row.tipo) || row.tipo || "",
    step_days: step,
    totale_scadenze: rowCount,
  };
}

function buildCustomHtml(introText: string, fallbackHtml: string) {
  const trimmed = introText.trim();
  if (!trimmed) return fallbackHtml;
  const introHtml = escapeHtml(trimmed).replace(/\n/g, "<br/>");
  return `<div><p>${introHtml}</p>${fallbackHtml}</div>`;
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

  let globalRules: ScadenzaAlertGlobalRuleRow[] = [];
  try {
    const { data, error } = await supabase
      .from("scadenze_alert_global_rules")
      .select("*")
      .eq("attivo", true);
    if (error) throw error;
    globalRules = ((data || []) as any[]).map((row) =>
      normalizeScadenzaAlertGlobalRule(
        row,
        normalizeScadenzaAlertRuleType(row?.tipo_scadenza) || "SAAS"
      )
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore caricamento regole globali avvisi" },
      { status: 500 }
    );
  }

  const globalRuleByTipo = new Map<string, ScadenzaAlertGlobalRuleRow>();
  for (const rule of globalRules) {
    const tipo = normalizeScadenzaAlertRuleType(rule.tipo_scadenza);
    if (!tipo) continue;
    globalRuleByTipo.set(tipo, rule);
  }

  const presetIds = Array.from(
    new Set(
      globalRules
        .map((rule) => String(rule.default_template_id || "").trim())
        .filter(Boolean)
    )
  );
  const templatesById = new Map<
    string,
    { id: string; subject_template: string | null; body_template: string | null }
  >();
  if (presetIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from("alert_message_templates")
        .select("id,subject_template,body_template")
        .in("id", presetIds);
      if (error) throw error;
      for (const row of (data || []) as any[]) {
        const id = String(row?.id || "").trim();
        if (!id) continue;
        templatesById.set(id, {
          id,
          subject_template: row?.subject_template ?? null,
          body_template: row?.body_template ?? null,
        });
      }
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Errore caricamento preset avvisi" },
        { status: 500 }
      );
    }
  }

  const systemId = await getSystemOperatoreId(supabase);
  const internalRecipient = getDefaultOperatoreByRole(operatori || [], "SUPERVISORE");

  const candidateRows = scadenzeRows.filter((row) => {
    if (!isAlertSupportedSource(row)) return false;
    if (!row.scadenza) return false;
    if (isStoppedScadenza(row)) return false;
    const tipo = normalizeScadenzaAlertRuleType(row.tipo);
    if (!tipo) return false;
    const rule = globalRuleByTipo.get(tipo);
    if (!rule || rule.attivo === false) return false;
    const diff = getDaysUntilScadenza(row.scadenza, todayIso);
    return diff != null && rule.enabled_steps.includes(diff);
  });

  const grouped = new Map<string, ScadenzaAgendaRow[]>();
  for (const row of candidateRows) {
    const step = row.scadenza ? getDaysUntilScadenza(row.scadenza, todayIso) : null;
    if (step === null) continue;
    const tipo = normalizeScadenzaAlertRuleType(row.tipo);
    if (!tipo) continue;
    const key = `${getClienteGroupKey(row)}::${tipo}::${step}`;
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
    const step = first.scadenza ? getDaysUntilScadenza(first.scadenza, todayIso) : null;
    if (step === null) continue;
    const tipo = normalizeScadenzaAlertRuleType(first.tipo);
    if (!tipo) continue;
    const globalRule = globalRuleByTipo.get(tipo) || null;
    if (!globalRule || globalRule.attivo === false || !globalRule.enabled_steps.includes(step)) {
      continue;
    }

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
    const deliveryMode = prefs?.scadenze_delivery_mode || globalRule.default_delivery_mode;
    const recipients: ScadenzeAlertRecipient[] = [];

    const shouldSendToArtTech =
      deliveryMode === "MANUALE_INTERNO" ||
      globalRule.default_target === "ART_TECH" ||
      globalRule.default_target === "CLIENTE_E_ART_TECH";
    if (shouldSendToArtTech) {
      const email = String(internalRecipient?.email || "").trim();
      if (email.includes("@")) {
        recipients.push({
          email,
          name: internalRecipient?.nome || "Art Tech",
          operatoreId: internalRecipient?.id || null,
          target: "ART_TECH",
        });
      }
    }
    const shouldSendToCliente =
      deliveryMode === "AUTO_CLIENTE" &&
      (globalRule.default_target === "CLIENTE" ||
        globalRule.default_target === "CLIENTE_E_ART_TECH");
    if (shouldSendToCliente) {
      for (const email of prefs?.emails || []) {
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

    const template = globalRule.default_template_id
      ? templatesById.get(globalRule.default_template_id) || null
      : null;
    const context = buildRuleContext(first, step, unsentRows.length);
    const fallbackSubject = buildScadenzeAlertSubject(first.cliente || null, step);
    const fallbackText = buildScadenzeAlertText(first.cliente || null, step, unsentRows);
    const fallbackHtml = buildScadenzeAlertHtml(first.cliente || null, step, unsentRows);
    const customSubject = renderTemplateText(template?.subject_template, context).trim();
    const customBody =
      renderTemplateText(template?.body_template, context).trim() || String(globalRule.note || "").trim();
    const subject = customSubject || fallbackSubject;
    const text = customBody ? `${customBody}\n\n${fallbackText}` : fallbackText;
    const html = customBody ? buildCustomHtml(customBody, fallbackHtml) : fallbackHtml;

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
    steps: [30, 15, 7, 1],
    source: "buildScadenzeAgenda + scadenze_alert_global_rules",
    errors,
  });
}
