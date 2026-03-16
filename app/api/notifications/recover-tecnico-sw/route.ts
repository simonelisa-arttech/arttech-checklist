export const runtime = "nodejs";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import {
  getChecklistEligibilityDate,
  isChecklistEligibleFromToday,
} from "@/lib/notifications/checklistEligibility";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  data_prevista: string | null;
  data_tassativa: string | null;
  data_installazione_reale: string | null;
  stato_progetto: string | null;
};

type RuleRow = {
  id: string;
  checklist_id: string | null;
  task_template_id: string | null;
  task_title: string | null;
  target: string | null;
  recipients: any;
  only_future: boolean | null;
  enabled: boolean | null;
  mode: string | null;
  send_on_create: boolean | null;
};

type TaskRow = {
  id: string;
  checklist_id: string;
  titolo: string | null;
  stato: string | null;
  target: string | null;
  task_template_id: string | null;
};

type OperatoreRow = {
  email: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  riceve_notifiche?: boolean | null;
  alert_enabled?: boolean | null;
};

function getAccessTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  const raw = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="));
  if (!raw) return "";
  return raw.split("=").slice(1).join("=");
}

function getRomeDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function parseRecipients(input: any) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v: any) => String(v || "").trim().toLowerCase())
        .filter((v: string) => v.includes("@"))
    )
  );
}

function normalizeTarget(value: string | null | undefined) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (raw === "TECNICO SW" || raw === "TECNICO-SW") return "TECNICO_SW";
  if (raw === "ALTRO") return "GENERICA";
  return raw || "GENERICA";
}

function isMissingColumn(error: any, column: string) {
  return String(error?.message || "").toLowerCase().includes(column.toLowerCase());
}

async function listOperatoriForNotifications(adminClient: any): Promise<OperatoreRow[]> {
  const withRiceve = await adminClient
    .from("operatori")
    .select("email, ruolo, attivo, riceve_notifiche")
    .eq("attivo", true);
  if (!withRiceve.error) return (withRiceve.data || []) as OperatoreRow[];
  if (!String(withRiceve.error.message || "").toLowerCase().includes("riceve_notifiche")) {
    throw new Error(withRiceve.error.message);
  }
  const fallback = await adminClient
    .from("operatori")
    .select("email, ruolo, attivo, alert_enabled")
    .eq("attivo", true);
  if (fallback.error) throw new Error(fallback.error.message);
  return ((fallback.data || []) as OperatoreRow[]).map((o) => ({
    ...o,
    riceve_notifiche: o.alert_enabled !== false,
  }));
}

function getAutoRecipients(target: string, operatori: OperatoreRow[]) {
  const normalizedTarget = normalizeTarget(target);
  return Array.from(
    new Set(
      operatori
        .filter((o) => o.riceve_notifiche !== false)
        .filter((o) => normalizeTarget(o.ruolo) === normalizedTarget)
        .map((o) => String(o.email || "").trim().toLowerCase())
        .filter((email) => email.includes("@"))
    )
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPayloadHash(sentOn: string, checklistId: string, target: string, ruleStableKey: string) {
  return createHash("sha256")
    .update(`${sentOn}|${checklistId}|${target}|${ruleStableKey}`)
    .digest("hex");
}

function normalizeTaskKey(title: string | null | undefined, target: string | null | undefined) {
  return `${String(title || "").trim().toLowerCase()}::${normalizeTarget(target)}`;
}

function shouldSendOnChecklistCreate(rule: RuleRow) {
  if (rule.enabled === false) return false;
  if (normalizeTarget(rule.target) === "AMMINISTRAZIONE") return true;
  return rule.send_on_create === true;
}

function getMatchingRuleForTask(task: TaskRow, checklistId: string, rules: RuleRow[]) {
  const key = normalizeTaskKey(task.titolo, task.target);
  const templateId = String(task.task_template_id || "").trim();
  const matching = rules.filter((rule) => {
    if (normalizeTaskKey(rule.task_title, rule.target) !== key) return false;
    const ruleTemplateId = String(rule.task_template_id || "").trim();
    if (ruleTemplateId && templateId) return ruleTemplateId === templateId;
    return true;
  });
  if (!matching.length) return null;

  const overrideRule =
    matching.find((rule) => String(rule.checklist_id || "").trim() === checklistId) || null;
  if (overrideRule) return overrideRule;
  return matching.find((rule) => !String(rule.checklist_id || "").trim()) || null;
}

async function authAdminClient(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }) };
  }

  const accessToken = getAccessTokenFromCookieHeader(request.headers.get("cookie"));
  if (!accessToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { adminClient };
}

function getBaseUrl(req: Request) {
  const env =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "https://atsystem.arttechworld.com";
}

export async function POST(request: Request) {
  const auth = await authAdminClient(request);
  if ("error" in auth) return auth.error;
  const { adminClient } = auth;

  const body = await request.json().catch(() => ({} as any));
  const checklistId = String(body?.checklist_id || "").trim();

  let checklistsQuery = adminClient
    .from("checklists")
    .select(
      "id, cliente, nome_checklist, data_prevista, data_tassativa, data_installazione_reale, stato_progetto"
    )
    .eq("stato_progetto", "IN_CORSO");
  if (checklistId) {
    checklistsQuery = checklistsQuery.eq("id", checklistId);
  }
  const { data: checklistRows, error: checklistErr } = await checklistsQuery;
  if (checklistErr) {
    return NextResponse.json({ error: checklistErr.message }, { status: 500 });
  }

  const todayRome = getRomeDateString();
  const eligibleChecklists = ((checklistRows || []) as ChecklistRow[]).filter((checklist) =>
    isChecklistEligibleFromToday(checklist, todayRome)
  );
  if (!eligibleChecklists.length) {
    return NextResponse.json({
      ok: true,
      eligible_checklists: 0,
      recovered_checklists: 0,
      emails_sent: 0,
      tasks_locked: 0,
      skipped_already_sent: 0,
    });
  }

  let { data: rulesRaw, error: rulesErr } = await adminClient
    .from("notification_rules")
    .select(
      "id, checklist_id, task_template_id, task_title, target, recipients, only_future, enabled, mode, send_on_create"
    )
    .eq("enabled", true);
  if (rulesErr && isMissingColumn(rulesErr, "task_template_id")) {
    const fallback = await adminClient
      .from("notification_rules")
      .select(
        "id, checklist_id, task_title, target, recipients, only_future, enabled, mode, send_on_create"
      )
      .eq("enabled", true);
    rulesRaw = (fallback.data || []).map((row: any) => ({ ...row, task_template_id: null }));
    rulesErr = fallback.error;
  }
  if (rulesErr && String(rulesErr.message || "").toLowerCase().includes("send_on_create")) {
    return NextResponse.json({ ok: true, eligible_checklists: 0, recovered_checklists: 0, emails_sent: 0 });
  }
  if (rulesErr) {
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }

  const rules = ((rulesRaw || []) as RuleRow[]).filter(
    (rule) => shouldSendOnChecklistCreate(rule) && normalizeTarget(rule.target) === "TECNICO_SW"
  );
  if (!rules.length) {
    return NextResponse.json({
      ok: true,
      eligible_checklists: eligibleChecklists.length,
      recovered_checklists: 0,
      emails_sent: 0,
      tasks_locked: 0,
      skipped_already_sent: 0,
    });
  }

  let operatori: OperatoreRow[] = [];
  try {
    operatori = await listOperatoriForNotifications(adminClient);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento operatori" }, { status: 500 });
  }

  const eligibleChecklistIds = eligibleChecklists.map((checklist) => checklist.id);
  const { data: tasksRaw, error: tasksErr } = await adminClient
    .from("checklist_tasks")
    .select("id, checklist_id, titolo, stato, target, task_template_id")
    .in("checklist_id", eligibleChecklistIds);
  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }

  const { data: logRows, error: logErr } = await adminClient
    .from("notification_log")
    .select("checklist_id, target, task_title")
    .eq("target", "TECNICO_SW")
    .in("checklist_id", eligibleChecklistIds);
  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  const alreadySentKeys = new Set(
    (logRows || []).map((row: any) => {
      const taskTitle = String(row?.task_title || "").trim();
      return `${String(row?.checklist_id || "").trim()}::TECNICO_SW::${taskTitle}`;
    })
  );

  const CLOSED = new Set(["OK", "NON_NECESSARIO"]);
  const baseUrl = getBaseUrl(request);
  const tasksByChecklist = new Map<string, TaskRow[]>();
  for (const task of (tasksRaw || []) as TaskRow[]) {
    const bucket = tasksByChecklist.get(task.checklist_id) || [];
    bucket.push(task);
    tasksByChecklist.set(task.checklist_id, bucket);
  }

  let emailsSent = 0;
  let tasksLocked = 0;
  let skippedAlreadySent = 0;
  let recoveredChecklists = 0;

  for (const checklist of eligibleChecklists) {
    const openTasks = (tasksByChecklist.get(checklist.id) || []).filter(
      (task) => !CLOSED.has(String(task.stato || "").trim().toUpperCase())
    );
    if (!openTasks.length) continue;

    const byRecipientAndTarget = new Map<
      string,
      { recipient: string; target: string; taskTitles: Set<string>; ruleIds: Set<string> }
    >();

    for (const task of openTasks) {
      const effectiveRule = getMatchingRuleForTask(task, checklist.id, rules);
      if (!effectiveRule) continue;
      if (effectiveRule.only_future === false) continue;
      const target = normalizeTarget(effectiveRule.target || task.target);
      if (target !== "TECNICO_SW") continue;

      const taskTitle = String(task.titolo || effectiveRule.task_title || "Attività").trim();
      if (!taskTitle) continue;

      const alreadySentKey = `${checklist.id}::${target}::${taskTitle}`;
      if (alreadySentKeys.has(alreadySentKey)) {
        skippedAlreadySent += 1;
        continue;
      }

      const extraRecipients = parseRecipients(effectiveRule.recipients);
      const autoRecipients = getAutoRecipients(target, operatori);
      const recipients = Array.from(new Set([...autoRecipients, ...extraRecipients]));
      if (!recipients.length) continue;

      const payloadHash = buildPayloadHash(
        todayRome,
        checklist.id,
        target,
        `${String(effectiveRule.id || taskTitle)}::${String(task.id || taskTitle)}`
      );
      const { error: lockErr } = await adminClient.from("notification_log").insert({
        sent_on: todayRome,
        checklist_id: checklist.id,
        target,
        task_title: taskTitle,
        payload_hash: payloadHash,
      });
      if (lockErr) {
        if ((lockErr as any)?.code === "23505") continue;
        return NextResponse.json({ error: lockErr.message }, { status: 500 });
      }

      alreadySentKeys.add(alreadySentKey);
      tasksLocked += 1;
      for (const recipient of recipients) {
        const bucketKey = `${recipient}::${target}`;
        const bucket = byRecipientAndTarget.get(bucketKey) || {
          recipient,
          target,
          taskTitles: new Set<string>(),
          ruleIds: new Set<string>(),
        };
        bucket.taskTitles.add(taskTitle);
        bucket.ruleIds.add(String(effectiveRule.id || taskTitle));
        byRecipientAndTarget.set(bucketKey, bucket);
      }
    }

    if (!byRecipientAndTarget.size) continue;

    let checklistSent = false;
    for (const bucket of byRecipientAndTarget.values()) {
      const taskTitles = Array.from(bucket.taskTitles);
      if (!taskTitles.length) continue;

      const installDate = getChecklistEligibilityDate(checklist);
      const subject = `AT SYSTEM - Promemoria ${bucket.target} - ${checklist.nome_checklist || checklist.id}`;
      const lines: string[] = [
        `Cliente: ${checklist.cliente || "—"}`,
        `Checklist: ${checklist.nome_checklist || checklist.id}`,
        `Data installazione: ${installDate || "—"}`,
        `Link: ${baseUrl}/checklists/${checklist.id}`,
        "",
        "Task pendenti di pertinenza:",
      ];
      let html = `<div><p><strong>Cliente:</strong> ${escapeHtml(
        checklist.cliente || "—"
      )}<br/><strong>Checklist:</strong> ${escapeHtml(
        checklist.nome_checklist || checklist.id
      )}<br/><strong>Data installazione:</strong> ${escapeHtml(
        installDate || "—"
      )}<br/><a href="${escapeHtml(baseUrl + `/checklists/${checklist.id}`)}">Apri checklist</a></p><ul>`;
      for (const taskTitle of taskTitles) {
        lines.push(`- ${taskTitle}`);
        html += `<li>${escapeHtml(taskTitle)}</li>`;
      }
      html += "</ul></div>";

      const sendResult = await Promise.allSettled([
        sendEmail({
          to: bucket.recipient,
          subject,
          text: lines.join("\n"),
          html,
        }),
      ]);
      const sentNow = sendResult.filter((s) => s.status === "fulfilled").length;
      emailsSent += sentNow;
      if (sentNow > 0) {
        checklistSent = true;
        await Promise.all(
          Array.from(bucket.ruleIds)
            .filter((ruleId) => ruleId && !ruleId.includes("::"))
            .map((ruleId) =>
              adminClient
                .from("notification_rules")
                .update({ last_sent_on: todayRome })
                .eq("id", ruleId)
            )
        );
      }
    }

    if (checklistSent) {
      recoveredChecklists += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    eligible_checklists: eligibleChecklists.length,
    recovered_checklists: recoveredChecklists,
    emails_sent: emailsSent,
    tasks_locked: tasksLocked,
    skipped_already_sent: skippedAlreadySent,
    target: "TECNICO_SW",
  });
}
