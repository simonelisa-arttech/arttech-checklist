export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

type Body = { email?: string };
type RateLimitEntry = { count: number; resetAt: number };

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: Request) {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRateLimit(ip: string, limit = 8, windowMs = 60_000) {
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

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://atsystem.arttechworld.com"
  ).replace(/\/+$/, "");
}

function isUserMissingError(msg: string) {
  const s = String(msg || "").toLowerCase();
  return (
    s.includes("user not found") ||
    s.includes("email not found") ||
    s.includes("email does not exist")
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!allowRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email non valida" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: operatore } = await adminClient
    .from("operatori")
    .select("id, nome, ruolo, user_id")
    .ilike("email", email)
    .maybeSingle();

  const redirectTo = `${getSiteUrl()}/auth/callback`;

  let recoveryData: any = null;
  let recoveryErr: any = null;
  {
    const res = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    } as any);
    recoveryData = res.data;
    recoveryErr = res.error;
  }

  if (recoveryErr && isUserMissingError(recoveryErr.message || "")) {
    // If auth user is missing, create it and retry recovery link.
    const { error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        nome: (operatore as any)?.nome ?? null,
        ruolo: (operatore as any)?.ruolo ?? null,
      },
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
    const resRetry = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    } as any);
    recoveryData = resRetry.data;
    recoveryErr = resRetry.error;
  }

  if (recoveryErr) {
    return NextResponse.json({ error: recoveryErr.message }, { status: 500 });
  }

  const actionLink = recoveryData?.properties?.action_link || "";
  const userId = recoveryData?.user?.id || null;
  if (!actionLink) {
    return NextResponse.json({ error: "Recovery link non disponibile" }, { status: 500 });
  }

  if ((operatore as any)?.id && userId) {
    const currentUserId = (operatore as any)?.user_id ?? null;
    if (!currentUserId || currentUserId !== userId) {
      await adminClient
        .from("operatori")
        .update({ user_id: userId })
        .eq("id", (operatore as any).id);
    }
  }

  await sendEmail({
    to: email,
    subject: "Reset password - AT SYSTEM",
    text: `Clicca qui per reimpostare la password: ${actionLink}`,
    html: `<p>Clicca qui per reimpostare la password:</p><p><a href="${actionLink}">Reset Password</a></p>`,
  });

  return NextResponse.json({ ok: true });
}

