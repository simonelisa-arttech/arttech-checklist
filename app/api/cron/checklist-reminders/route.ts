export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type JobRow = {
  id: string;
  checklist_id: string;
  task_id: string;
};

type TaskRow = {
  id: string;
  titolo: string | null;
  stato: string | null;
};

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
};

type OperatoreRow = {
  id: string;
  nome: string | null;
  email: string | null;
};

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

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const hasSecret =
    cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);
  if (!hasSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: jobs, error: jobsErr } = await supabase
    .from("notification_jobs")
    .select("id, checklist_id, task_id")
    .eq("stato", "PENDING");

  if (jobsErr) {
    return NextResponse.json({ error: jobsErr.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  const byChecklist = new Map<string, JobRow[]>();
  for (const j of jobs as JobRow[]) {
    const list = byChecklist.get(j.checklist_id) || [];
    list.push(j);
    byChecklist.set(j.checklist_id, list);
  }

  const baseUrl = getBaseUrl(req);
  let sentCount = 0;
  let skipped = 0;

  for (const [checklistId, list] of byChecklist.entries()) {
    const taskIds = list.map((j) => j.task_id);
    const { data: tasks, error: tasksErr } = await supabase
      .from("checklist_tasks")
      .select("id, titolo, stato")
      .in("id", taskIds);
    if (tasksErr || !tasks) {
      skipped += 1;
      continue;
    }

    const pendingTasks = (tasks as TaskRow[]).filter(
      (t) => !["OK", "NON_NECESSARIO"].includes(String(t.stato || "").toUpperCase())
    );

    if (pendingTasks.length === 0) {
      await supabase
        .from("notification_jobs")
        .update({ stato: "DONE", updated_at: new Date().toISOString() })
        .in("id", list.map((j) => j.id));
      continue;
    }

    const { data: checklist } = await supabase
      .from("checklists")
      .select("id, cliente, nome_checklist")
      .eq("id", checklistId)
      .maybeSingle();

    const cliente = (checklist as ChecklistRow | null)?.cliente ?? "—";
    const nome = (checklist as ChecklistRow | null)?.nome_checklist ?? "—";

    const { data: ops } = await supabase
      .from("operatori")
      .select("id, nome, email, ruolo, attivo, cliente")
      .eq("cliente", cliente)
      .in("ruolo", ["TECNICO", "MAGAZZINO"])
      .eq("attivo", true);

    const recipients = (ops || []).filter((o: any) => o?.email && String(o.email).includes("@"));
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }

    const subject = `[Art Tech] Attività operative da completare – ${nome}`;
    const link = `${baseUrl}/checklists/${checklistId}`;
    const listText = pendingTasks.map((t) => `- ${t.titolo ?? "—"}`).join("\n");
    const message = [
      `Cliente: ${cliente}`,
      `Progetto: ${nome}`,
      "Attività DA_FARE:",
      listText,
      `Link: ${link}`,
    ].join("\n");

    for (const op of recipients as OperatoreRow[]) {
      const res = await fetch(`${baseUrl}/api/send-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canale: "auto_task",
          subject,
          message,
          to_email: op.email,
          to_nome: op.nome ?? null,
          to_operatore_id: op.id,
          checklist_id: checklistId,
          trigger: "AUTO",
          send_email: true,
        }),
      });
      if (res.ok) {
        sentCount += 1;
      }
    }

    await supabase
      .from("notification_jobs")
      .update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", list.map((j) => j.id));
  }

  return NextResponse.json({ ok: true, sent: sentCount, skipped });
}
