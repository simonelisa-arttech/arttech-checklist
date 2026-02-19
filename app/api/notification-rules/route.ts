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

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const taskTitle = url.searchParams.get("task_title");
  const target = url.searchParams.get("target");

  const selectWithDay =
    "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, day_of_week, stop_statuses, only_future, created_at, updated_at";
  const selectFallback =
    "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at";

  const runQuery = async (selectExpr: string) => {
    let query = auth.adminClient
      .from("notification_rules")
      .select(selectExpr)
      .order("created_at", { ascending: false });
    if (taskTitle) query = query.eq("task_title", taskTitle);
    if (target) query = query.eq("target", target);
    return query;
  };

  let { data, error } = await runQuery(selectWithDay);
  if (error && String(error.message || "").toLowerCase().includes("day_of_week")) {
    ({ data, error } = await runQuery(selectFallback));
    if (!error && Array.isArray(data)) {
      data = data.map((row: any) => ({ ...row, day_of_week: null }));
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: data || [] });
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

  const taskTitle = String(body?.task_title || "").trim();
  const target = String(body?.target || "").trim().toUpperCase();
  if (!taskTitle || !target) {
    return NextResponse.json({ error: "Missing task_title or target" }, { status: 400 });
  }

  const recipients = Array.isArray(body?.recipients)
    ? body.recipients.map((x: any) => String(x || "").trim().toLowerCase()).filter((x: string) => x.includes("@"))
    : [];
  const frequency = String(body?.frequency || "DAILY").trim().toUpperCase();
  const payloadBase = {
    enabled: body?.enabled !== false,
    mode: String(body?.mode || "AUTOMATICA").trim().toUpperCase(),
    task_title: taskTitle,
    target,
    recipients,
    frequency,
    send_time: String(body?.send_time || "07:30").trim(),
    timezone: String(body?.timezone || "Europe/Rome").trim() || "Europe/Rome",
    stop_statuses:
      Array.isArray(body?.stop_statuses) && body.stop_statuses.length > 0
        ? body.stop_statuses.map((x: any) => String(x || "").trim().toUpperCase()).filter(Boolean)
        : ["OK", "NON_NECESSARIO"],
    only_future: body?.only_future !== false,
  };
  const dayOfWeek =
    body?.day_of_week === null || body?.day_of_week === undefined || body?.day_of_week === ""
      ? null
      : Number(body.day_of_week);

  const payloadWithDay = { ...payloadBase, day_of_week: dayOfWeek };
  const payloadFallback = { ...payloadBase };

  const selectWithDay =
    "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, day_of_week, stop_statuses, only_future, created_at, updated_at";
  const selectFallback =
    "id, enabled, mode, task_title, target, recipients, frequency, send_time, timezone, stop_statuses, only_future, created_at, updated_at";

  let { data, error } = await auth.adminClient
    .from("notification_rules")
    .upsert(payloadWithDay, { onConflict: "task_title,target" })
    .select(selectWithDay)
    .single();

  if (error && String(error.message || "").toLowerCase().includes("day_of_week")) {
    ({ data, error } = await auth.adminClient
      .from("notification_rules")
      .upsert(payloadFallback, { onConflict: "task_title,target" })
      .select(selectFallback)
      .single());
    if (!error && data) {
      data = { ...(data as any), day_of_week: null };
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
