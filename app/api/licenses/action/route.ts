import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ActionBody = {
  action: "SET_STATUS" | "SEND_ALERT";
  licenseId: string;
  status?: string;
  alertTo?: string | null;
  alertNote?: string | null;
  updatedByOperatoreId?: string | null;
};

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: Request) {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRateLimit(ip: string, limit = 30, windowMs = 60_000) {
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

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function isValidStatus(status?: string) {
  if (!status) return false;
  const s = status.toUpperCase();
  return ["ATTIVA", "AVVISATO", "DA_FATTURARE", "FATTURATO", "ANNULLATO"].includes(s);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const hasSecret =
    cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

  if (!hasSecret) {
    if (process.env.NODE_ENV !== "production") {
      // dev ok
    } else {
      if (!isAllowedOrigin(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const ip = getClientIp(request);
      if (!allowRateLimit(ip)) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.licenseId || !body.action) {
    return NextResponse.json({ error: "Missing licenseId/action" }, { status: 400 });
  }

  if (body.action === "SET_STATUS") {
    if (!body.status || !isValidStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { error } = await supabase
      .from("licenses")
      .update({
        status: body.status.toUpperCase(),
        updated_by_operatore: body.updatedByOperatoreId ?? null,
      })
      .eq("id", body.licenseId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "SEND_ALERT") {
    const patch: Record<string, any> = {
      alert_sent_at: new Date().toISOString(),
      alert_to: body.alertTo ?? null,
      alert_note: body.alertNote ?? null,
      updated_by_operatore: body.updatedByOperatoreId ?? null,
    };
    if (body.status && isValidStatus(body.status)) {
      patch.status = body.status.toUpperCase();
    }
    const { error } = await supabase.from("licenses").update(patch).eq("id", body.licenseId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
