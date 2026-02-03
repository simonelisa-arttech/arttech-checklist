export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AlertTemplatePayload = {
  id?: string;
  codice: string | null;
  titolo: string | null;
  tipo: string | null;
  trigger: string | null;
  subject_template: string | null;
  body_template: string | null;
  attivo: boolean;
};

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: Request) {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRateLimit(ip: string, limit = 40, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) return true;
  if (origin && host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  if (!origin && referer && host && referer.includes(host)) return true;
  if (!origin && host) return true;
  return false;
}

function assertAuth(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const hasSecret =
    cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);
  if (hasSecret) return true;
  if (process.env.NODE_ENV !== "production") return true;
  if (!isAllowedOrigin(request)) return false;
  const ip = getClientIp(request);
  return allowRateLimit(ip);
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function requireAdminOrSupervisor(request: Request, supabase: ReturnType<typeof createClient>) {
  const operatoreId = request.headers.get("x-operatore-id");
  if (!operatoreId) {
    return { ok: false, response: NextResponse.json({ error: "Missing operatore id" }, { status: 401 }) };
  }
  const { data, error } = await supabase
    .from("operatori")
    .select("id, ruolo, attivo")
    .eq("id", operatoreId)
    .single<{ id: string; ruolo: string | null; attivo: boolean | null }>();
  if (error || !data) {
    return { ok: false, response: NextResponse.json({ error: "Operatore not found" }, { status: 403 }) };
  }
  if (data.attivo === false) {
    return { ok: false, response: NextResponse.json({ error: "Operatore inactive" }, { status: 403 }) };
  }
  const role = String(data.ruolo || "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPERVISORE") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, operatore: data };
}

const SELECT_FIELDS =
  "id,codice,titolo,tipo,trigger,subject_template,body_template,attivo,created_at,updated_at";

export async function GET(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const allowed = await requireAdminOrSupervisor(request, supabase);
  if (!allowed.ok) return allowed.response;

  const { data, error } = await supabase
    .from("alert_message_templates")
    .select(SELECT_FIELDS)
    .order("titolo", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const allowed = await requireAdminOrSupervisor(request, supabase);
  if (!allowed.ok) return allowed.response;

  let body: AlertTemplatePayload;
  try {
    body = (await request.json()) as AlertTemplatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload: AlertTemplatePayload = {
    codice: body.codice?.trim() || null,
    titolo: body.titolo?.trim() || null,
    tipo: body.tipo?.trim() || null,
    trigger: body.trigger?.trim() || null,
    subject_template: body.subject_template ?? null,
    body_template: body.body_template ?? null,
    attivo: Boolean(body.attivo),
  };

  if (!payload.codice || !payload.titolo) {
    return NextResponse.json({ error: "Missing codice or titolo" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("alert_message_templates")
    .insert(payload)
    .select(SELECT_FIELDS)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const allowed = await requireAdminOrSupervisor(request, supabase);
  if (!allowed.ok) return allowed.response;

  let body: AlertTemplatePayload;
  try {
    body = (await request.json()) as AlertTemplatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const payload: AlertTemplatePayload = {
    id: body.id,
    codice: body.codice?.trim() || null,
    titolo: body.titolo?.trim() || null,
    tipo: body.tipo?.trim() || null,
    trigger: body.trigger?.trim() || null,
    subject_template: body.subject_template ?? null,
    body_template: body.body_template ?? null,
    attivo: Boolean(body.attivo),
  };

  if (!payload.codice || !payload.titolo) {
    return NextResponse.json({ error: "Missing codice or titolo" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("alert_message_templates")
    .update(payload)
    .eq("id", payload.id)
    .select(SELECT_FIELDS)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}
