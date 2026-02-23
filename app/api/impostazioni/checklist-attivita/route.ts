export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Payload = {
  id?: string;
  sezione: string | null;
  ordine: number | null;
  titolo: string | null;
  attivo: boolean;
  target?: string | null;
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

function normalizeTarget(input: unknown) {
  const raw = String(input || "")
    .trim()
    .toUpperCase();
  if (!raw) return "GENERICA";
  if (raw === "ALTRO") return "GENERICA";
  return raw;
}

async function fetchRows(supabase: any) {
  const selectWithTarget = "id, sezione, ordine, titolo, attivo, target";
  const selectFallback = "id, sezione, ordine, titolo, attivo";

  let { data, error } = await supabase
    .from("checklist_task_templates")
    .select(selectWithTarget)
    .order("sezione", { ascending: true })
    .order("ordine", { ascending: true });

  if (error && String(error.message || "").toLowerCase().includes("target")) {
    const fallback = await supabase
      .from("checklist_task_templates")
      .select(selectFallback)
      .order("sezione", { ascending: true })
      .order("ordine", { ascending: true });
    data = (fallback.data || []) as any;
    error = fallback.error as any;
    if (!error && Array.isArray(data)) {
      data = data.map((r: any) => ({ ...r, target: "GENERICA" }));
    }
  }
  return { data, error };
}

export async function GET(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const rowsRes = await fetchRows(supabase);
  if (rowsRes.error) {
    return NextResponse.json({ error: rowsRes.error.message }, { status: 500 });
  }

  const baseTargets = ["GENERICA", "MAGAZZINO", "TECNICO_SW"];
  const existingTargets = new Set<string>();
  for (const row of rowsRes.data || []) {
    const t = normalizeTarget((row as any)?.target);
    if (t) existingTargets.add(t);
  }

  const { data: ops } = await supabase.from("operatori").select("ruolo").eq("attivo", true);
  for (const op of ops || []) {
    const role = normalizeTarget((op as any)?.ruolo);
    if (role) existingTargets.add(role);
  }

  const availableTargets = Array.from(new Set([...baseTargets, ...Array.from(existingTargets)]));
  return NextResponse.json({
    ok: true,
    data: (rowsRes.data || []).map((r: any) => ({ ...r, target: normalizeTarget(r.target) })),
    available_targets: availableTargets,
  });
}

export async function POST(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    sezione: body.sezione?.trim() || null,
    ordine: body.ordine != null ? Number(body.ordine) : null,
    titolo: body.titolo?.trim() || null,
    attivo: Boolean(body.attivo),
    target: normalizeTarget(body.target),
  };

  if (!payload.sezione || !payload.titolo) {
    return NextResponse.json({ error: "Missing sezione or titolo" }, { status: 400 });
  }

  if (body.id) {
    let { error } = await supabase.from("checklist_task_templates").update(payload).eq("id", body.id);
    if (error && String(error.message || "").toLowerCase().includes("target")) {
      const { target: _ignore, ...fallbackPayload } = payload;
      ({ error } = await supabase.from("checklist_task_templates").update(fallbackPayload).eq("id", body.id));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    let { error } = await supabase.from("checklist_task_templates").insert(payload);
    if (error && String(error.message || "").toLowerCase().includes("target")) {
      const { target: _ignore, ...fallbackPayload } = payload;
      ({ error } = await supabase.from("checklist_task_templates").insert(fallbackPayload));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
