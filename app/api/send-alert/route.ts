import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

type SendAlertBody = {
  canale:
    | "manual_task"
    | "fatturazione_row"
    | "fatturazione_bulk"
    | "rinnovo_stage1"
    | "rinnovo_stage2"
    | "manual"
    | string;
  subject?: string;
  text?: string;
  html?: string;
  to_email?: string | null;
  to_nome?: string | null;
  to_operatore_id?: string | null;
  from_operatore_id?: string | null;
  cliente?: string | null;
  checklist_id?: string | null;
  task_id?: string | null;
  task_template_id?: string | null;
  intervento_id?: string | null;
  rinnovo_id?: string | null;
  meta?: any;
  send_email?: boolean;
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

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing service role key" },
      { status: 500 }
    );
  }

  let body: SendAlertBody;
  try {
    body = (await request.json()) as SendAlertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sendEmailFlag = body.send_email !== false;
  const toEmail = body.to_email?.trim() || null;
  const subject = (body.subject || "").trim();
  const html = (body.html || "").trim();
  const text = (body.text || "").trim() || (html ? stripHtml(html) : "");

  if (!body.canale) {
    return NextResponse.json({ error: "Missing canale" }, { status: 400 });
  }
  if (sendEmailFlag && (!toEmail || !subject || !html)) {
    return NextResponse.json(
      { error: "Missing to_email/subject/html" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const logPayload = {
    checklist_id: body.checklist_id ?? null,
    task_id: body.task_id ?? null,
    task_template_id: body.task_template_id ?? null,
    intervento_id: body.intervento_id ?? null,
    to_operatore_id: body.to_operatore_id ?? null,
    to_email: toEmail,
    to_nome: body.to_nome ?? null,
    from_operatore_id: body.from_operatore_id ?? null,
    messaggio: subject ? `${subject}\n${text}`.trim() : text || null,
    canale: body.canale,
  };

  if (!sendEmailFlag) {
    const { data: logData, error: logErr } = await supabase
      .from("checklist_alert_log")
      .insert(logPayload)
      .select("id")
      .single();
    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      email_sent: false,
      log_id: logData?.id ?? null,
    });
  }

  try {
    await sendEmail({ to: toEmail!, subject, text, html });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Email send failed";
    const { data: logData, error: logErr } = await supabase
      .from("checklist_alert_log")
      .insert({
        ...logPayload,
        messaggio: `ERRORE INVIO EMAIL: ${errorMsg}\n\n${logPayload.messaggio || ""}`.trim(),
        canale: `${body.canale}_error`,
      })
      .select("id")
      .single();
    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }
    return NextResponse.json(
      { ok: false, email_sent: false, log_id: logData?.id ?? null, error: errorMsg },
      { status: 502 }
    );
  }

  const { data: logData, error: logErr } = await supabase
    .from("checklist_alert_log")
    .insert(logPayload)
    .select("id")
    .single();
  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email_sent: true,
    log_id: logData?.id ?? null,
  });
}
