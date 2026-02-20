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

function getAccessToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearerToken) return bearerToken;

  const cookieToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="))
    ?.split("=")
    .slice(1)
    .join("=");

  return cookieToken || "";
}

async function requireUser(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false as const, response: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }) };
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { ok: true as const, adminClient };
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getBaseUrl(req: Request) {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://atsystem.arttechworld.com";
  return env.replace(/\/+$/, "");
}

function normalizeStatusSet(stopStatuses: string[] | null | undefined) {
  const source =
    Array.isArray(stopStatuses) && stopStatuses.length > 0
      ? stopStatuses
      : ["OK", "NON_NECESSARIO"];
  return new Set(source.map((s) => String(s || "").trim().toUpperCase()));
}

function buildManualPayloadHash(
  sentOn: string,
  checklistId: string,
  target: string,
  taskTitle: string,
  stamp: string
) {
  return createHash("sha256")
    .update(`MANUAL|${stamp}|${sentOn}|${checklistId}|${target}|${taskTitle}`)
    .digest("hex");
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const taskTemplateId = String(body?.task_template_id || "").trim();
  const taskTitle = String(body?.task_title || "").trim();
  const target = String(body?.target || "GENERICA")
    .trim()
    .toUpperCase();
  const ignoreOnlyFuture = body?.ignore_only_future === true;
  if (!taskTitle) {
    return NextResponse.json({ error: "Missing task_title" }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  // 1) Provo prima per task_template_id + target (se ho il template)
  let rule: any = null;
  let ruleErr: any = null;

  if (taskTemplateId) {
    const res = await auth.adminClient
      .from("notification_rules")
      .select("id, enabled, mode, task_template_id, task_title, target, recipients, stop_statuses, only_future")
      .eq("task_template_id", taskTemplateId)
      .eq("target", target)
      .maybeSingle();

    rule = res.data;
    ruleErr = res.error;
  }

  // 2) Fallback robusto: task_title + target (sempre)
  if (!rule && !ruleErr) {
    const res2 = await auth.adminClient
      .from("notification_rules")
      .select("id, enabled, mode, task_template_id, task_title, target, recipients, stop_statuses, only_future")
      .eq("task_title", taskTitle)
      .eq("target", target)
      .maybeSingle();

    rule = res2.data;
    ruleErr = res2.error;
  }

  // 3) Se esiste un errore dovuto a colonna task_template_id (compat), riprovo senza selezionarla
  if (ruleErr && String(ruleErr.message || "").toLowerCase().includes("task_template_id")) {
    const res3 = await auth.adminClient
      .from("notification_rules")
      .select("id, enabled, mode, task_title, target, recipients, stop_statuses, only_future")
      .eq("task_title", taskTitle)
      .eq("target", target)
      .maybeSingle();

    rule = res3.data ? { ...(res3.data as any), task_template_id: null } : null;
    ruleErr = res3.error;
  }
  if (ruleErr) return NextResponse.json({ error: ruleErr.message }, { status: 500 });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const recipients = Array.isArray(rule.recipients)
    ? rule.recipients.map((x: any) => String(x || "").trim().toLowerCase()).filter((x: string) => x.includes("@"))
    : [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients configured" }, { status: 400 });
  }

  const todayRome = getRomeDateString();
  const stamp = new Date().toISOString();
  const baseUrl = getBaseUrl(request);

  const { data: checklistsRaw, error: checklistsErr } = await auth.adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, data_prevista, data_tassativa");
  if (checklistsErr) return NextResponse.json({ error: checklistsErr.message }, { status: 500 });

  const checklists = (checklistsRaw || []) as ChecklistRow[];
  const allowedChecklistIds = checklists
    .filter((c) => {
      const installDate = getEffectiveInstallDate(c);
      if (!installDate) return false;

      const mode = String(rule.mode || "").toUpperCase();
      if (mode === "MANUALE" && ignoreOnlyFuture) {
        return true;
      }

      if (rule.only_future === true) {
        return installDate > todayRome;
      }
      return true;
    })
    .map((c) => c.id);

  if (allowedChecklistIds.length === 0) {
    return NextResponse.json({ ok: true, emails_sent: 0, checklists: 0 });
  }

  let tasksQuery = auth.adminClient
    .from("checklist_tasks")
    .select("checklist_id, task_template_id, titolo, stato")
    .in("checklist_id", allowedChecklistIds);
  if (taskTemplateId) {
    tasksQuery = tasksQuery.eq("task_template_id", taskTemplateId);
  } else {
    tasksQuery = tasksQuery.ilike("titolo", taskTitle);
  }
  const { data: tasksRaw, error: tasksErr } = await tasksQuery;
  if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 });

  const stopSet = normalizeStatusSet(rule.stop_statuses);
  const openTasks = ((tasksRaw || []) as TaskRow[]).filter((t) => {
    const stato = String(t.stato || "").trim().toUpperCase();
    return !stopSet.has(stato);
  });
  if (openTasks.length === 0) {
    return NextResponse.json({ ok: true, emails_sent: 0, checklists: 0 });
  }

  const checklistById = new Map(checklists.map((c) => [c.id, c]));
  const grouped = new Map<string, { checklist: ChecklistRow; tasks: TaskRow[] }>();
  for (const task of openTasks) {
    const checklist = checklistById.get(task.checklist_id);
    if (!checklist) continue;

    const effectiveTaskTitle = String((rule as any)?.task_title || taskTitle || "Attività").trim();
    const payloadHash = buildManualPayloadHash(
      todayRome,
      checklist.id,
      target,
      effectiveTaskTitle,
      stamp
    );
    const { error: logErr } = await auth.adminClient.from("notification_log").insert({
      sent_on: todayRome,
      checklist_id: checklist.id,
      target,
      task_title: effectiveTaskTitle,
      payload_hash: payloadHash,
    });
    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    const bucket = grouped.get(checklist.id) || { checklist, tasks: [] };
    bucket.tasks.push(task);
    grouped.set(checklist.id, bucket);
  }

  if (grouped.size === 0) {
    return NextResponse.json({ ok: true, emails_sent: 0, checklists: 0 });
  }

  const entries = Array.from(grouped.values());
  const effectiveTaskTitle = String((rule as any)?.task_title || taskTitle || "Attività").trim();
  const subject = `AT SYSTEM - Promemoria ${target} - ${effectiveTaskTitle}`;
  const text = entries
    .map((item) => {
      const nome = item.checklist.nome_checklist || "—";
      const cliente = item.checklist.cliente || "—";
      const dataRef = getEffectiveInstallDate(item.checklist) || "—";
      const link = `${baseUrl}/checklists/${item.checklist.id}`;
      const tasksList = item.tasks.map((t) => `- ${t.titolo || "—"}`).join("\n");
      return [
        `Checklist: ${nome}`,
        `Cliente: ${cliente}`,
        `Data riferimento: ${dataRef}`,
        "Task pendenti:",
        tasksList,
        `Link: ${link}`,
      ].join("\n");
    })
    .join("\n\n");
  const html = `<div><h2>${escapeHtml(subject)}</h2><ul>${entries
    .map((item) => {
      const nome = item.checklist.nome_checklist || "—";
      const cliente = item.checklist.cliente || "—";
      const dataRef = getEffectiveInstallDate(item.checklist) || "—";
      const link = `${baseUrl}/checklists/${item.checklist.id}`;
      const tasksList = item.tasks.map((t) => `<li>${escapeHtml(t.titolo || "—")}</li>`).join("");
      return `<li><p><strong>${escapeHtml(nome)}</strong><br/>Cliente: ${escapeHtml(
        cliente
      )}<br/>Data riferimento: ${escapeHtml(dataRef)}<br/><a href="${escapeHtml(
        link
      )}">Apri checklist</a></p><ul>${tasksList}</ul></li>`;
    })
    .join("")}</ul></div>`;

  const sends = await Promise.allSettled(
    recipients.map((to: string) => sendEmail({ to, subject, text, html }))
  );

  return NextResponse.json({
    ok: true,
    emails_attempted: recipients.length,
    emails_sent: sends.filter((r) => r.status === "fulfilled").length,
    checklists: grouped.size,
  });
}
