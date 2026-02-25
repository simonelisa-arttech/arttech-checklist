export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }),
    };
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { ok: true as const, adminClient };
}

function normalizeTarget(input: any) {
  const raw = String(input || "")
    .trim()
    .toUpperCase();
  if (raw === "MAGAZZINO") return "MAGAZZINO";
  if (raw === "TECNICO_SW" || raw === "TECNICO SW" || raw === "TECNICO-SW") return "TECNICO_SW";
  if (raw === "ALTRO") return "GENERICA";
  return raw || "GENERICA";
}

function sanitizeRecipients(input: any) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((x: any) => String(x || "").trim().toLowerCase())
        .filter((x: string) => x.includes("@"))
    )
  );
}

function parseOnlyFuture(input: any) {
  if (typeof input === "boolean") return input;
  const raw = String(input ?? "")
    .trim()
    .toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}

function defaultModeByTarget(target: string) {
  return target === "MAGAZZINO" || target === "TECNICO_SW" ? "AUTOMATICA" : "MANUALE";
}

function isMissingColumn(err: any, col: string) {
  return String(err?.message || "").toLowerCase().includes(col.toLowerCase());
}

async function getAvailableTargets(adminClient: any) {
  const base = ["GENERICA", "MAGAZZINO", "TECNICO_SW"];
  const out = new Set<string>(base);
  const { data } = await adminClient.from("operatori").select("ruolo").eq("attivo", true);
  for (const row of data || []) {
    const role = normalizeTarget((row as any)?.ruolo);
    if (role) out.add(role);
  }
  return Array.from(out);
}

async function listRulesForTask(
  adminClient: any,
  taskTitle: string,
  target: string,
  taskTemplateId: string | null
) {
  const selectWithChecklist =
    "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, stop_statuses, only_future, created_at, updated_at";
  const selectFallback =
    "id, enabled, mode, task_template_id, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at";

  let q = adminClient
    .from("notification_rules")
    .select(selectWithChecklist)
    .eq("task_title", taskTitle)
    .eq("target", target)
    .order("created_at", { ascending: false });
  if (taskTemplateId) q = q.eq("task_template_id", taskTemplateId);

  let { data, error } = await q;
  if (error && isMissingColumn(error, "day_of_week")) {
    let q2 = adminClient
      .from("notification_rules")
      .select(selectFallback)
      .eq("task_title", taskTitle)
      .eq("target", target)
      .order("created_at", { ascending: false });
    if (taskTemplateId) q2 = q2.eq("task_template_id", taskTemplateId);
    const res = await q2;
    data = (res.data || []).map((r: any) => ({ ...r, day_of_week: null, checklist_id: null }));
    error = res.error;
  }
  if (error && isMissingColumn(error, "checklist_id")) {
    let q3 = adminClient
      .from("notification_rules")
      .select(selectFallback)
      .eq("task_title", taskTitle)
      .eq("target", target)
      .order("created_at", { ascending: false });
    if (taskTemplateId) q3 = q3.eq("task_template_id", taskTemplateId);
    const res = await q3;
    data = (res.data || []).map((r: any) => ({ ...r, checklist_id: null, day_of_week: null }));
    error = res.error;
  }
  return { data: (data || []) as any[], error };
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const taskTemplateId = String(url.searchParams.get("task_template_id") || "").trim() || null;
  const taskTitle = String(url.searchParams.get("task_title") || "").trim();
  const target = normalizeTarget(url.searchParams.get("target"));
  const checklistId = String(url.searchParams.get("checklist_id") || "").trim() || null;

  const availableTargets = await getAvailableTargets(auth.adminClient);

  if (!taskTitle) {
    return NextResponse.json({
      ok: true,
      effective_rule: null,
      global_rule: null,
      override_rule: null,
      data: [],
      available_targets: availableTargets,
    });
  }

  const { data: rows, error } = await listRulesForTask(
    auth.adminClient,
    taskTitle,
    target,
    taskTemplateId
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const globalRule = rows.find((r: any) => !r.checklist_id) || null;
  const overrideRule = checklistId
    ? rows.find((r: any) => String(r.checklist_id || "") === checklistId) || null
    : null;

  const virtualRule = {
    id: null,
    checklist_id: checklistId,
    task_template_id: taskTemplateId,
    enabled: true,
    mode: defaultModeByTarget(target),
    task_title: taskTitle,
    target,
    recipients: [],
    frequency: "DAILY",
    send_time: "07:30",
    timezone: "Europe/Rome",
    day_of_week: null,
    stop_statuses: ["OK", "NON_NECESSARIO"],
    only_future: true,
    created_at: null,
    updated_at: null,
  };

  const effectiveRule = overrideRule || globalRule || virtualRule;

  return NextResponse.json({
    ok: true,
    effective_rule: effectiveRule,
    global_rule: globalRule,
    override_rule: overrideRule,
    data: [effectiveRule],
    available_targets: availableTargets,
  });
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

  const taskTemplateId = String(body?.task_template_id || "").trim() || null;
  const taskTitle = String(body?.task_title || "").trim();
  const checklistId = String(body?.checklist_id || "").trim() || null;
  const target = normalizeTarget(body?.target);
  if (!taskTitle) {
    return NextResponse.json({ error: "Missing task_title" }, { status: 400 });
  }

  const recipients = sanitizeRecipients(body?.recipients);
  const frequency = String(body?.frequency || "DAILY").trim().toUpperCase();
  const dayOfWeek =
    body?.day_of_week === null || body?.day_of_week === undefined || body?.day_of_week === ""
      ? null
      : Number(body.day_of_week);

  const payload = {
    checklist_id: checklistId,
    enabled: body?.enabled !== false,
    mode: String(body?.mode || defaultModeByTarget(target)).trim().toUpperCase(),
    task_template_id: taskTemplateId,
    task_title: taskTitle,
    target,
    recipients,
    frequency,
    send_time: String(body?.send_time || "07:30").trim(),
    timezone: String(body?.timezone || "Europe/Rome").trim() || "Europe/Rome",
    day_of_week: dayOfWeek,
    stop_statuses:
      Array.isArray(body?.stop_statuses) && body.stop_statuses.length > 0
        ? body.stop_statuses.map((x: any) => String(x || "").trim().toUpperCase()).filter(Boolean)
        : ["OK", "NON_NECESSARIO"],
    only_future: parseOnlyFuture(body?.only_future),
  };

  let existingQuery = auth.adminClient
    .from("notification_rules")
    .select("id")
    .eq("task_title", taskTitle)
    .eq("target", target)
    .limit(1);
  if (checklistId) {
    existingQuery = existingQuery.eq("checklist_id", checklistId);
  } else {
    existingQuery = existingQuery.is("checklist_id", null);
  }

  let { data: existing, error: existingErr } = await existingQuery.maybeSingle();
  if (existingErr && isMissingColumn(existingErr, "checklist_id")) {
    if (checklistId) {
      return NextResponse.json(
        { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
        { status: 500 }
      );
    }
    existing = null;
    existingErr = null;
  }
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  const selectSaved =
    "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, day_of_week, stop_statuses, only_future, created_at, updated_at";

  if (existing?.id) {
    const { data, error } = await auth.adminClient
      .from("notification_rules")
      .update(payload)
      .eq("id", existing.id)
      .select(selectSaved)
      .single();
    if (error && isMissingColumn(error, "checklist_id")) {
      const compatPayload = { ...payload } as any;
      delete compatPayload.checklist_id;
      delete compatPayload.day_of_week;
      const res = await auth.adminClient
        .from("notification_rules")
        .update(compatPayload)
        .eq("id", existing.id)
        .select(
          "id, enabled, mode, task_template_id, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at"
        )
        .single();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: { ...(res.data as any), checklist_id: null, day_of_week: null } });
    }
    if (error && isMissingColumn(error, "day_of_week")) {
      const compatPayload = { ...payload } as any;
      delete compatPayload.day_of_week;
      const res = await auth.adminClient
        .from("notification_rules")
        .update(compatPayload)
        .eq("id", existing.id)
        .select(
          "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at"
        )
        .single();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data: { ...(res.data as any), day_of_week: null } });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  const { data, error } = await auth.adminClient
    .from("notification_rules")
    .insert(payload)
    .select(selectSaved)
    .single();
  if (error && isMissingColumn(error, "checklist_id")) {
    if (checklistId) {
      return NextResponse.json(
        { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
        { status: 500 }
      );
    }
    const compatPayload = { ...payload } as any;
    delete compatPayload.checklist_id;
    delete compatPayload.day_of_week;
    const res = await auth.adminClient
      .from("notification_rules")
      .insert(compatPayload)
      .select(
        "id, enabled, mode, task_template_id, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at"
      )
      .single();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { ...(res.data as any), checklist_id: null, day_of_week: null } });
  }
  if (error && isMissingColumn(error, "day_of_week")) {
    const compatPayload = { ...payload } as any;
    delete compatPayload.day_of_week;
    const res = await auth.adminClient
      .from("notification_rules")
      .insert(compatPayload)
      .select(
        "id, enabled, mode, checklist_id, task_template_id, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at"
      )
      .single();
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: { ...(res.data as any), day_of_week: null } });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const checklistId = String(url.searchParams.get("checklist_id") || "").trim();
  const taskTitle = String(url.searchParams.get("task_title") || "").trim();
  const target = normalizeTarget(url.searchParams.get("target"));

  if (!checklistId || !taskTitle) {
    return NextResponse.json({ error: "Missing checklist_id or task_title" }, { status: 400 });
  }

  const { error } = await auth.adminClient
    .from("notification_rules")
    .delete()
    .eq("checklist_id", checklistId)
    .eq("task_title", taskTitle)
    .eq("target", target);

  if (error && isMissingColumn(error, "checklist_id")) {
    return NextResponse.json(
      { error: "Schema DB non aggiornato: manca notification_rules.checklist_id" },
      { status: 500 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
