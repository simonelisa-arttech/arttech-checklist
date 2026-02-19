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

type OperatoreRow = {
  ruolo: string | null;
  email: string | null;
};

const MAGAZZINO_TITLE_TOKEN = "preparazione / riserva disponibilita / ordine merce";
const TECNICO_SW_TITLE_TOKEN = "elettronica di controllo: schemi dati ed elettrici";

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

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classifyTargetByTitle(title: string | null | undefined): "MAGAZZINO" | "TECNICO_SW" | null {
  const normalized = normalizeText(title);
  if (!normalized) return null;
  if (normalized.includes(MAGAZZINO_TITLE_TOKEN)) return "MAGAZZINO";
  if (normalized.includes(TECNICO_SW_TITLE_TOKEN)) return "TECNICO_SW";
  return null;
}

function buildPayloadHash(
  sentOn: string,
  checklistId: string,
  target: "MAGAZZINO" | "TECNICO_SW",
  taskTitle: string
) {
  return createHash("sha256")
    .update(`${sentOn}|${checklistId}|${target}|${taskTitle}`)
    .digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function targetLabel(target: "MAGAZZINO" | "TECNICO_SW") {
  return target === "MAGAZZINO" ? "Magazzino" : "Tecnico SW";
}

function buildRoleEmailBody(
  target: "MAGAZZINO" | "TECNICO_SW",
  grouped: Map<string, { checklist: ChecklistRow; tasks: TaskRow[] }>,
  baseUrl: string
) {
  const label = targetLabel(target);
  const entries = Array.from(grouped.values());
  const subject = `Promemoria giornaliero - Attività ${label} pendenti (${entries.length})`;

  const textLines = [subject, ""];
  let html = `<div><h2>${escapeHtml(subject)}</h2><ul>`;

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

  const { data: checklistRaw, error: checklistErr } = await supabase
    .from("checklists")
    .select("id, cliente, nome_checklist, data_prevista, data_tassativa");
  if (checklistErr) {
    return NextResponse.json({ error: checklistErr.message }, { status: 500 });
  }

  const futureChecklists = ((checklistRaw || []) as ChecklistRow[]).filter((c) => {
    const effective = getEffectiveInstallDate(c);
    return Boolean(effective) && effective > todayRome;
  });
  if (futureChecklists.length === 0) {
    return NextResponse.json({
      ok: true,
      date: todayRome,
      future_checklists: 0,
      magazzino_open_tasks: 0,
      tecnico_sw_open_tasks: 0,
      emails_sent: 0,
      skipped_already_sent: 0,
    });
  }

  const checklistById = new Map(futureChecklists.map((c) => [c.id, c]));
  const checklistIds = futureChecklists.map((c) => c.id);

  const { data: taskRaw, error: taskErr } = await supabase
    .from("checklist_tasks")
    .select("checklist_id, titolo, stato")
    .in("checklist_id", checklistIds)
    .not("stato", "in", "(OK,NON_NECESSARIO)");
  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  const openTasks = (taskRaw || []) as TaskRow[];
  const openByTarget = {
    MAGAZZINO: [] as TaskRow[],
    TECNICO_SW: [] as TaskRow[],
  };
  for (const t of openTasks) {
    const target = classifyTargetByTitle(t.titolo);
    if (!target) continue;
    openByTarget[target].push(t);
  }

  const { data: opsRaw, error: opsErr } = await supabase
    .from("operatori")
    .select("ruolo, email")
    .eq("attivo", true)
    .not("email", "is", null)
    .in("ruolo", ["MAGAZZINO", "TECNICO_SW"]);
  if (opsErr) {
    return NextResponse.json({ error: opsErr.message }, { status: 500 });
  }

  const recipients = {
    MAGAZZINO: new Set<string>(),
    TECNICO_SW: new Set<string>(),
  };
  for (const op of (opsRaw || []) as OperatoreRow[]) {
    const role = String(op.ruolo || "").toUpperCase();
    const email = String(op.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    if (role === "MAGAZZINO" || role === "TECNICO_SW") {
      recipients[role].add(email);
    }
  }

  let emailsSent = 0;
  let skippedAlreadySent = 0;

  for (const target of ["MAGAZZINO", "TECNICO_SW"] as const) {
    const grouped = new Map<string, { checklist: ChecklistRow; tasks: TaskRow[] }>();

    for (const task of openByTarget[target]) {
      const checklist = checklistById.get(task.checklist_id);
      if (!checklist) continue;

      const taskTitle = (task.titolo || "Attività senza titolo").trim();
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
    const toList = Array.from(recipients[target]);
    if (toList.length === 0) continue;

    const mail = buildRoleEmailBody(target, grouped, baseUrl);
    const sends = await Promise.allSettled(
      toList.map((to) => sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html }))
    );
    emailsSent += sends.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({
    ok: true,
    date: todayRome,
    future_checklists: futureChecklists.length,
    magazzino_open_tasks: openByTarget.MAGAZZINO.length,
    tecnico_sw_open_tasks: openByTarget.TECNICO_SW.length,
    emails_sent: emailsSent,
    skipped_already_sent: skippedAlreadySent,
  });
}
