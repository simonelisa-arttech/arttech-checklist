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
  titolo: string | null;
  stato: string | null;
};

type RuleRow = {
  id: string;
  enabled: boolean;
  mode: string | null;
  task_title: string | null;
  target: string | null;
  recipients: any;
  send_time: string | null;
  timezone: string | null;
  stop_statuses: string[] | null;
  only_future: boolean | null;
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

function buildPayloadHash(sentOn: string, checklistId: string, target: string, taskTitle: string) {
  return createHash("sha256")
    .update(`${sentOn}|${checklistId}|${target}|${taskTitle}`)
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

  const { data: rulesRaw, error: rulesErr } = await supabase
    .from("notification_rules")
    .select(
      "id, enabled, mode, task_title, target, recipients, send_time, timezone, stop_statuses, only_future"
    )
    .eq("enabled", true)
    .eq("mode", "AUTOMATICA");
  if (rulesErr) {
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }

  const rules = (rulesRaw || []) as RuleRow[];
  if (rules.length === 0) {
    return NextResponse.json({
      ok: true,
      date: todayRome,
      future_checklists: 0,
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
    const effective = getEffectiveInstallDate(c);
    if (effective && effective > todayRome) {
      futureChecklistsSet.add(c.id);
    }
  }

  const checklistById = new Map(allChecklists.map((c) => [c.id, c]));
  let emailsSent = 0;
  let skippedAlreadySent = 0;

  for (const rule of rules) {
    if (!shouldSendNow(rule.send_time, rule.timezone)) continue;

    const target = String(rule.target || "").trim().toUpperCase();
    const taskTitle = String(rule.task_title || "").trim();
    if (!target || !taskTitle) continue;

    const recipients = parseRecipients(rule.recipients);
    if (recipients.length === 0) continue;

    const allowedChecklistIds = allChecklists
      .filter((c) => {
        if (rule.only_future === true) {
          return futureChecklistsSet.has(c.id);
        }
        return true;
      })
      .map((c) => c.id);

    if (allowedChecklistIds.length === 0) continue;

    const { data: taskRaw, error: taskErr } = await supabase
      .from("checklist_tasks")
      .select("checklist_id, titolo, stato")
      .in("checklist_id", allowedChecklistIds)
      .ilike("titolo", taskTitle);
    if (taskErr) {
      return NextResponse.json({ error: taskErr.message }, { status: 500 });
    }

    const stopSet = normalizeStatusSet(rule.stop_statuses);
    const openTasks = ((taskRaw || []) as TaskRow[]).filter((t) => {
      const stato = String(t.stato || "").trim().toUpperCase();
      return !stopSet.has(stato);
    });
    if (openTasks.length === 0) continue;

    const grouped = new Map<string, { checklist: ChecklistRow; tasks: TaskRow[] }>();
    for (const task of openTasks) {
      const checklist = checklistById.get(task.checklist_id);
      if (!checklist) continue;

      const payloadHash = buildPayloadHash(todayRome, checklist.id, target, taskTitle);
      const { error: lockErr } = await supabase.from("notification_log").insert({
        sent_on: todayRome,
        checklist_id: checklist.id,
        target,
        task_title: taskTitle,
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

    if (grouped.size === 0) continue;

    const mail = buildEmailBody(rule, grouped, baseUrl);
    const sends = await Promise.allSettled(
      recipients.map((to) => sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html }))
    );
    emailsSent += sends.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({
    ok: true,
    date: todayRome,
    future_checklists: futureChecklistsSet.size,
    emails_sent: emailsSent,
    skipped_already_sent: skippedAlreadySent,
  });
}
