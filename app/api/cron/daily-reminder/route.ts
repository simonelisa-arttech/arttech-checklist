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

type TaskRow = {
  checklist_id: string;
  task_template_id: string | null;
  titolo: string | null;
  stato: string | null;
};

type RuleRow = {
  id: string;
  checklist_id: string | null;
  enabled: boolean;
  mode: string | null;
  frequency: string | null;
  day_of_week: number | null;
  task_title: string | null;
  target: string | null;
  recipients: any;
  send_time: string | null;
  timezone: string | null;
  stop_statuses: string[] | null;
  only_future: boolean | null;
  last_sent_on: string | null;
};

function getBaseUrl(req: Request) {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "";
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

function toIsoDay(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "";
}

function getEffectiveInstallDate(checklist: ChecklistRow) {
  return toIsoDay(checklist.data_tassativa) || toIsoDay(checklist.data_prevista);
}

function getTimePartsInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());

  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const h = Number(byType.get("hour") || "0");
  const m = Number(byType.get("minute") || "0");
  const s = Number(byType.get("second") || "0");
  return { h, m, s };
}

function getWeekdayInTimezone(timezone: string) {
  const token = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(new Date());
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[token] ?? 0;
}

function parseHmsToSeconds(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3] || "0");
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return 0;
  return h * 3600 + m * 60 + s;
}

function shouldSendNow(sendTime: string | null | undefined, timezone: string | null | undefined) {
  const tz = String(timezone || "Europe/Rome").trim() || "Europe/Rome";
  const now = getTimePartsInTimezone(tz);
  const nowSec = now.h * 3600 + now.m * 60 + now.s;
  const sendSec = parseHmsToSeconds(sendTime);
  return nowSec >= sendSec;
}

function shouldRunByFrequency(rule: RuleRow) {
  const tz = String(rule.timezone || "Europe/Rome").trim() || "Europe/Rome";
  const weekday = getWeekdayInTimezone(tz);
  const freq = String(rule.frequency || "DAILY").trim().toUpperCase();
  if (freq === "DAILY") return true;
  if (freq === "WEEKDAYS") return weekday >= 1 && weekday <= 5;
  if (freq === "WEEKLY") {
    const targetDay =
      Number.isInteger(Number(rule.day_of_week)) && Number(rule.day_of_week) >= 0 && Number(rule.day_of_week) <= 6
        ? Number(rule.day_of_week)
        : 1;
    return weekday === targetDay;
  }
  return true;
}

function parseRecipients(input: any) {
  if (Array.isArray(input)) {
    return input
      .map((v) => String(v || "").trim().toLowerCase())
      .filter((v) => v.includes("@"));
  }
  return [];
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

function normalizeStatusSet(stopStatuses: string[] | null | undefined) {
  const source =
    Array.isArray(stopStatuses) && stopStatuses.length > 0
      ? stopStatuses
      : ["OK", "NON_NECESSARIO"];
  return new Set(source.map((s) => String(s || "").trim().toUpperCase()));
}

function buildEmailBody(
  rule: RuleRow,
  grouped: Map<string, { checklist: ChecklistRow; tasks: TaskRow[] }>,
  baseUrl: string
) {
  const entries = Array.from(grouped.values());
  const label = String(rule.target || "").toUpperCase() || "PROMEMORIA";
  const title = String(rule.task_title || "Attività");
  const subject = `Promemoria giornaliero - ${label} pendenti (${entries.length})`;
  const textLines = [subject, `Task: ${title}`, ""];
  let html = `<div><h2>${escapeHtml(subject)}</h2><p><strong>Task:</strong> ${escapeHtml(
    title
  )}</p><ul>`;

  for (const item of entries) {
    const cliente = item.checklist.cliente || "—";
    const nome = item.checklist.nome_checklist || "—";
    const dataInstallazione = getEffectiveInstallDate(item.checklist) || "—";
    const link = `${baseUrl}/checklists/${item.checklist.id}`;
    const tasksText = item.tasks.map((t) => `- ${t.titolo || "—"}`).join("\n");
    const tasksHtml = item.tasks.map((t) => `<li>${escapeHtml(t.titolo || "—")}</li>`).join("");

    textLines.push(
      `Checklist: ${nome}`,
      `Cliente: ${cliente}`,
      `Data installazione (tassativa/prevista): ${dataInstallazione}`,
      "Task pendenti:",
      tasksText,
      `Link: ${link}`,
      ""
    );

    html += `<li><p><strong>${escapeHtml(nome)}</strong><br/>Cliente: ${escapeHtml(
      cliente
    )}<br/>Data installazione (tassativa/prevista): ${escapeHtml(
      dataInstallazione
    )}<br/><a href="${escapeHtml(link)}">Apri checklist</a></p><p>Task pendenti:</p><ul>${tasksHtml}</ul></li>`;
  }

  html += "</ul></div>";
  return { subject, text: textLines.join("\n"), html };
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  const url = new URL(req.url);
  const debugMode = url.searchParams.get("debug") === "1";
  const querySecret = url.searchParams.get("secret") || "";
  const hasSecret =
    Boolean(cronSecret) &&
    (authHeader === `Bearer ${cronSecret}` ||
      headerSecret === cronSecret ||
      querySecret === cronSecret);
  if (!hasSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const todayRome = getRomeDateString();
  const baseUrl = getBaseUrl(req);

  const selectWithDay =
    "id, enabled, mode, frequency, day_of_week, checklist_id, task_title, target, recipients, send_time, timezone, stop_statuses, only_future, last_sent_on";
  const selectFallback =
    "id, enabled, mode, frequency, checklist_id, task_title, target, recipients, send_time, timezone, stop_statuses, only_future, last_sent_on";
  const selectFallbackNoTemplate =
    "id, enabled, mode, frequency, checklist_id, task_title, target, recipients, send_time, timezone, stop_statuses, only_future, last_sent_on";
  const selectWithDayNoLastSent =
    "id, enabled, mode, frequency, day_of_week, checklist_id, task_title, target, recipients, send_time, timezone, stop_statuses, only_future";
  const selectFallbackNoLastSent =
    "id, enabled, mode, frequency, checklist_id, task_title, target, recipients, send_time, timezone, stop_statuses, only_future";
  const selectFallbackNoTemplateNoLastSent =
    "id, enabled, mode, frequency, checklist_id, task_title, target, recipients, send_time, timezone, stop_statuses, only_future";

  let { data: rulesRaw, error: rulesErr } = await supabase
    .from("notification_rules")
    .select(selectWithDay)
    .eq("enabled", true)
    .eq("mode", "AUTOMATICA");
  if (rulesErr && String(rulesErr.message || "").toLowerCase().includes("last_sent_on")) {
    const noLastRes = await supabase
      .from("notification_rules")
      .select(selectWithDayNoLastSent)
      .eq("enabled", true)
      .eq("mode", "AUTOMATICA");
    rulesRaw = noLastRes.data as any;
    rulesErr = noLastRes.error as any;
    if (!rulesErr && Array.isArray(rulesRaw)) {
      rulesRaw = rulesRaw.map((r: any) => ({ ...r, last_sent_on: null }));
    }
  }
  if (rulesErr && String(rulesErr.message || "").toLowerCase().includes("day_of_week")) {
    const fallbackRes = await supabase
      .from("notification_rules")
      .select(selectFallbackNoLastSent)
      .eq("enabled", true)
      .eq("mode", "AUTOMATICA");
    rulesRaw = fallbackRes.data as any;
    rulesErr = fallbackRes.error as any;
    if (!rulesErr && Array.isArray(rulesRaw)) {
      rulesRaw = rulesRaw.map((r: any) => ({ ...r, day_of_week: null, last_sent_on: null }));
    }
  }
  if (rulesErr && String(rulesErr.message || "").toLowerCase().includes("task_template_id")) {
    const fallbackNoTplRes = await supabase
      .from("notification_rules")
      .select(selectFallbackNoTemplateNoLastSent)
      .eq("enabled", true)
      .eq("mode", "AUTOMATICA");
      rulesRaw = fallbackNoTplRes.data as any;
      rulesErr = fallbackNoTplRes.error as any;
      if (!rulesErr && Array.isArray(rulesRaw)) {
        rulesRaw = rulesRaw.map((r: any) => ({
          ...r,
          day_of_week: null,
          checklist_id: null,
          last_sent_on: null,
        }));
      }
  }
  if (rulesErr && String(rulesErr.message || "").toLowerCase().includes("checklist_id")) {
    const fallbackNoChecklistRes = await supabase
      .from("notification_rules")
      .select(
        "id, enabled, mode, frequency, task_title, target, recipients, send_time, timezone, stop_statuses, only_future, last_sent_on"
      )
      .eq("enabled", true)
      .eq("mode", "AUTOMATICA");
    rulesRaw = ((fallbackNoChecklistRes.data as any[] | null) || []).map((r: any) => ({
      ...r,
      checklist_id: null,
      day_of_week: null,
    }));
    rulesErr = fallbackNoChecklistRes.error as any;
  }
  if (rulesErr) {
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }

  const rules = (rulesRaw || []) as RuleRow[];
  if (rules.length === 0) {
    return NextResponse.json({
      ok: true,
      date: todayRome,
      future_checklists: 0,
      rules_total: 0,
      rules_processed: 0,
      rules_skipped_time: 0,
      rules_skipped_frequency: 0,
      skipped_no_recipients: 0,
      emails_attempted: 0,
      emails_sent: 0,
      skipped_already_sent: 0,
    });
  }

  const { data: checklistRaw, error: checklistErr } = await supabase
    .from("checklists")
    .select("id, cliente, nome_checklist, data_prevista, data_tassativa");
  if (checklistErr) {
    return NextResponse.json({ error: checklistErr.message }, { status: 500 });
  }

  const allChecklists = (checklistRaw || []) as ChecklistRow[];
  const futureChecklistsSet = new Set<string>();
  for (const c of allChecklists) {
    const prevista = toIsoDay(c.data_prevista);
    const tassativa = toIsoDay(c.data_tassativa);
    const isFuture = (prevista && prevista > todayRome) || (tassativa && tassativa > todayRome);
    if (isFuture) {
      futureChecklistsSet.add(c.id);
    }
  }

  const checklistById = new Map(allChecklists.map((c) => [c.id, c]));
  let rulesProcessed = 0;
  let rulesSkippedTime = 0;
  let rulesSkippedFrequency = 0;
  let skippedNoRecipients = 0;
  let emailsAttempted = 0;
  let emailsSent = 0;
  let skippedAlreadySent = 0;
  const rulesDebug: Array<{
    rule_id: string;
    target: string;
    task_title: string;
    recipients: string[];
    allowed_checklists: number;
    tasks_found: number;
    open_tasks: number;
    rule_subject: string;
    sent_now: number;
    skipped_reason: string | null;
  }> = [];

  const allOverrides = new Set<string>();
  {
    const { data: overrideRows, error: overrideErr } = await supabase
      .from("notification_rules")
      .select("checklist_id, target, task_title")
      .not("checklist_id", "is", null);
    if (overrideErr && !String(overrideErr.message || "").toLowerCase().includes("checklist_id")) {
      return NextResponse.json({ error: overrideErr.message }, { status: 500 });
    }
    for (const row of overrideRows || []) {
      const checklistId = String((row as any).checklist_id || "").trim();
      if (!checklistId) continue;
      const rowTarget = String((row as any).target || "").trim().toUpperCase();
      const rowTitle = String((row as any).task_title || "").trim();
      allOverrides.add(`${checklistId}|${rowTarget}|${rowTitle}`);
    }
  }

  for (const rule of rules) {
    const target = String(rule.target || "").trim().toUpperCase();
    const taskTemplateId = String((rule as any).task_template_id || "").trim();
    const taskTitle = String(rule.task_title || "").trim();
    const effectiveTaskTitle = taskTitle || "Attività";
    const ruleDbg = {
      rule_id: String(rule.id || ""),
      target,
      task_title: effectiveTaskTitle,
      recipients: [] as string[],
      allowed_checklists: 0,
      tasks_found: 0,
      open_tasks: 0,
      rule_subject: "",
      sent_now: 0,
      skipped_reason: null as string | null,
    };

    if (!shouldRunByFrequency(rule)) {
      rulesSkippedFrequency += 1;
      if (debugMode) {
        ruleDbg.skipped_reason = "frequency";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }
    if (!shouldSendNow(rule.send_time, rule.timezone)) {
      rulesSkippedTime += 1;
      if (debugMode) {
        ruleDbg.skipped_reason = "time";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }
    rulesProcessed += 1;

    if (!target) {
      if (debugMode) {
        ruleDbg.skipped_reason = "missing_target";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }

    const recipients = parseRecipients(rule.recipients);
    ruleDbg.recipients = recipients;
    if (recipients.length === 0) {
      skippedNoRecipients += 1;
      if (debugMode) {
        ruleDbg.skipped_reason = "no_recipients";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }
    if (toIsoDay(rule.last_sent_on) === todayRome) {
      skippedAlreadySent += 1;
      if (debugMode) {
        ruleDbg.skipped_reason = "rule_already_sent";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }

    let allowedChecklistIds = allChecklists
      .filter((c) => {
        if (rule.checklist_id && c.id !== rule.checklist_id) return false;
        if (rule.only_future === true) {
          const prevista = toIsoDay(c.data_prevista);
          const tassativa = toIsoDay(c.data_tassativa);
          const isFuture = (prevista && prevista > todayRome) || (tassativa && tassativa > todayRome);
          return Boolean(isFuture);
        }
        return true;
      })
      .map((c) => c.id);

    if (!rule.checklist_id && taskTitle) {
      const overrideChecklistIds = new Set(
        Array.from(allOverrides)
          .filter((k) => {
            const [checklistId, rowTarget, rowTitle] = k.split("|");
            return (
              Boolean(checklistId) &&
              rowTarget === target &&
              rowTitle === taskTitle
            );
          })
          .map((k) => k.split("|")[0])
      );
      allowedChecklistIds = allowedChecklistIds.filter((id) => !overrideChecklistIds.has(id));
    }
    ruleDbg.allowed_checklists = allowedChecklistIds.length;

    if (allowedChecklistIds.length === 0) {
      if (debugMode) {
        ruleDbg.skipped_reason = "no_allowed_checklists";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }

    let tasksQuery = supabase
      .from("checklist_tasks")
      .select("checklist_id, task_template_id, titolo, stato")
      .in("checklist_id", allowedChecklistIds);

    if (taskTemplateId) {
      tasksQuery = tasksQuery.eq("task_template_id", taskTemplateId);
    } else {
      if (!taskTitle) {
        if (debugMode) {
          ruleDbg.skipped_reason = "missing_task_title_fallback";
          rulesDebug.push(ruleDbg);
        }
        continue;
      }
      tasksQuery = tasksQuery.eq("titolo", taskTitle).eq("target", target);
    }

    const { data: taskRaw, error: taskErr } = await tasksQuery;
    if (taskErr) {
      return NextResponse.json({ error: taskErr.message }, { status: 500 });
    }
    ruleDbg.tasks_found = (taskRaw || []).length;

    const stopSet = normalizeStatusSet(rule.stop_statuses);
    const openTasks = ((taskRaw || []) as TaskRow[]).filter((t) => {
      const stato = String(t.stato || "").trim().toUpperCase();
      return !stopSet.has(stato);
    });
    ruleDbg.open_tasks = openTasks.length;
    if (openTasks.length === 0) {
      if (debugMode) {
        ruleDbg.skipped_reason = "no_open_tasks";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }

    const grouped = new Map<string, { checklist: ChecklistRow; tasks: TaskRow[] }>();
    for (const task of openTasks) {
      const checklist = checklistById.get(task.checklist_id);
      if (!checklist) continue;

      const ruleStableKey = String(rule.id || effectiveTaskTitle || "rule");
      const payloadHash = buildPayloadHash(todayRome, checklist.id, target, ruleStableKey);
      const { error: lockErr } = await supabase.from("notification_log").insert({
        sent_on: todayRome,
        checklist_id: checklist.id,
        target,
        task_title: effectiveTaskTitle,
        payload_hash: payloadHash,
      });
      if (lockErr) {
        if ((lockErr as any)?.code === "23505") {
          skippedAlreadySent += 1;
          continue;
        }
        return NextResponse.json({ error: lockErr.message }, { status: 500 });
      }

      const bucket = grouped.get(checklist.id) || { checklist, tasks: [] };
      bucket.tasks.push(task);
      grouped.set(checklist.id, bucket);
    }

    if (grouped.size === 0) {
      if (debugMode) {
        ruleDbg.skipped_reason = "already_sent";
        rulesDebug.push(ruleDbg);
      }
      continue;
    }

    const mail = buildEmailBody(rule, grouped, baseUrl);
    ruleDbg.rule_subject = mail.subject;
    emailsAttempted += recipients.length;
    const sends = await Promise.allSettled(
      recipients.map((to) => sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html }))
    );
    const sentNow = sends.filter((r) => r.status === "fulfilled").length;
    ruleDbg.sent_now = sentNow;
    if (debugMode) {
      ruleDbg.skipped_reason = sentNow > 0 ? null : "send_failed";
      rulesDebug.push(ruleDbg);
    }
    emailsSent += sentNow;

    if (sentNow > 0) {
      await supabase
        .from("notification_rules")
        .update({ last_sent_on: todayRome })
        .eq("id", rule.id);
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayRome,
    future_checklists: futureChecklistsSet.size,
    rules_total: rules.length,
    rules_processed: rulesProcessed,
    rules_skipped_time: rulesSkippedTime,
    rules_skipped_frequency: rulesSkippedFrequency,
    skipped_no_recipients: skippedNoRecipients,
    emails_attempted: emailsAttempted,
    emails_sent: emailsSent,
    skipped_already_sent: skippedAlreadySent,
    ...(debugMode ? { rules_debug: rulesDebug } : {}),
  });
}
