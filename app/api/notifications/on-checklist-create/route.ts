export const runtime = "nodejs";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  data_prevista: string | null;
  data_tassativa: string | null;
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

function toIsoDay(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "";
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

function getEffectiveInstallDate(checklist: ChecklistRow) {
  return toIsoDay(checklist.data_tassativa) || toIsoDay(checklist.data_prevista);
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
  if (!checklistId) {
    return NextResponse.json({ error: "Missing checklist_id" }, { status: 400 });
  }

  const { data: checklist, error: checklistErr } = await adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, data_prevista, data_tassativa")
    .eq("id", checklistId)
    .single();
  if (checklistErr || !checklist) {
    return NextResponse.json({ error: checklistErr?.message || "Checklist not found" }, { status: 404 });
  }

  const todayRome = getRomeDateString();
  const installDate = getEffectiveInstallDate(checklist as ChecklistRow);
  if (!installDate || !(installDate > todayRome)) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "not_future" });
  }

  let { data: rulesRaw, error: rulesErr } = await adminClient
    .from("notification_rules")
    .select(
      "id, checklist_id, task_template_id, task_title, target, recipients, only_future, enabled, mode, send_on_create"
    )
    .eq("enabled", true)
    .or(`checklist_id.is.null,checklist_id.eq.${checklistId}`);
  if (rulesErr && String(rulesErr.message || "").toLowerCase().includes("send_on_create")) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "missing_send_on_create_column" });
  }
  if (rulesErr) {
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }

  const rules = ((rulesRaw || []) as RuleRow[]).filter(shouldSendOnChecklistCreate);
  if (!rules.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "no_matching_rules" });
  }

  let operatori: OperatoreRow[] = [];
  try {
    operatori = await listOperatoriForNotifications(adminClient);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Errore caricamento operatori" }, { status: 500 });
  }

  const CLOSED = new Set(["OK", "NON_NECESSARIO"]);
  const baseUrl = getBaseUrl(request);

  const { data: tasksRaw, error: tasksErr } = await adminClient
    .from("checklist_tasks")
    .select("id, titolo, stato, target, task_template_id")
    .eq("checklist_id", checklistId);
  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }

  const openTasks = ((tasksRaw || []) as TaskRow[]).filter(
    (task) => !CLOSED.has(String(task.stato || "").trim().toUpperCase())
  );
  if (!openTasks.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "no_open_tasks" });
  }

  const byRecipientAndTarget = new Map<
    string,
    { recipient: string; target: string; taskTitles: Set<string>; ruleIds: Set<string> }
  >();
  let locksAcquired = 0;

  for (const task of openTasks) {
    const effectiveRule = getMatchingRuleForTask(task, checklistId, rules);
    if (!effectiveRule) continue;
    if (effectiveRule.only_future === false) continue;
    const target = normalizeTarget(effectiveRule.target || task.target);
    const taskTitle = String(task.titolo || effectiveRule.task_title || "Attività").trim();
    if (!target || !taskTitle) continue;

    const payloadHash = buildPayloadHash(
      todayRome,
      checklistId,
      target,
      `${String(effectiveRule.id || taskTitle)}::${String(task.id || taskTitle)}`
    );
    const { error: lockErr } = await adminClient.from("notification_log").insert({
      sent_on: todayRome,
      checklist_id: checklistId,
      target,
      task_title: taskTitle,
      payload_hash: payloadHash,
    });
    if (lockErr) {
      if ((lockErr as any)?.code === "23505") continue;
      return NextResponse.json({ error: lockErr.message }, { status: 500 });
    }
    locksAcquired += 1;

    const extraRecipients = parseRecipients(effectiveRule.recipients);
    const autoRecipients = getAutoRecipients(target, operatori);
    const recipients = Array.from(new Set([...autoRecipients, ...extraRecipients]));
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

  let emailsSent = 0;
  for (const bucket of byRecipientAndTarget.values()) {
    const taskTitles = Array.from(bucket.taskTitles);
    if (!taskTitles.length) continue;
    const subject = `AT SYSTEM - Promemoria ${bucket.target} - ${checklist.nome_checklist || checklist.id}`;
    const lines: string[] = [
      `Cliente: ${checklist.cliente || "—"}`,
      `Checklist: ${checklist.nome_checklist || checklist.id}`,
      `Data installazione: ${installDate}`,
      `Link: ${baseUrl}/checklists/${checklistId}`,
      "",
      "Task pendenti di pertinenza:",
    ];
    let html = `<div><p><strong>Cliente:</strong> ${escapeHtml(
      checklist.cliente || "—"
    )}<br/><strong>Checklist:</strong> ${escapeHtml(
      checklist.nome_checklist || checklist.id
    )}<br/><strong>Data installazione:</strong> ${escapeHtml(
      installDate
    )}<br/><a href="${escapeHtml(baseUrl + `/checklists/${checklistId}`)}">Apri checklist</a></p><ul>`;
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

  return NextResponse.json({
    ok: true,
    sent: emailsSent,
    rules_locked: locksAcquired,
    targets: Array.from(new Set(Array.from(byRecipientAndTarget.values()).map((bucket) => bucket.target))),
  });
}
