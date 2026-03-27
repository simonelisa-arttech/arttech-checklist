export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { requireOperatore } from "@/lib/adminAuth";
import {
  buildAziendeDocumentAlertMessage,
  collectAziendeDocumentAlertDigest,
} from "@/lib/aziendeDocumentAlerts";
import {
  getDefaultOperatoreByRole,
  listOperatoriForNotifications,
  type OperatoreRow,
} from "@/lib/scadenze/scadenzeAlertCron";

function getCronSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorizedCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const querySecret = new URL(request.url).searchParams.get("secret");
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
}

function isVercelCronRequest(request: Request) {
  return Boolean(request.headers.get("x-vercel-cron"));
}

export async function GET(request: Request) {
  let supabase: ReturnType<typeof getCronSupabaseClient>;
  if (isVercelCronRequest(request) || isAuthorizedCron(request)) {
    try {
      supabase = getCronSupabaseClient();
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: err?.message || "Missing Supabase envs" },
        { status: 500 }
      );
    }
  } else {
    const auth = await requireOperatore(request);
    if (!auth.ok) return auth.response;
    supabase = auth.adminClient as ReturnType<typeof getCronSupabaseClient>;
  }

  let operatori: OperatoreRow[];
  try {
    operatori = await listOperatoriForNotifications(supabase);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Errore caricamento operatori" },
      { status: 500 }
    );
  }

  const internalRecipient = getDefaultOperatoreByRole(operatori || [], "SUPERVISORE");
  const to = String(internalRecipient?.email || "").trim();
  if (!to.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "Destinatario SUPERVISORE mancante" },
      { status: 500 }
    );
  }

  try {
    const digest = await collectAziendeDocumentAlertDigest();
    const total = digest.scaduti.length + digest.in_scadenza.length;
    if (total === 0) {
      return NextResponse.json({ ok: true, reason: "no documents to notify", notified: 0 });
    }

    const message = buildAziendeDocumentAlertMessage(digest);
    await sendEmail({
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    const documentoIds = Array.from(
      new Set([...digest.scaduti, ...digest.in_scadenza].map((item) => item.documento_id).filter(Boolean))
    );

    if (documentoIds.length > 0) {
      const { error } = await supabase
        .from("aziende_documenti")
        .update({ last_notified_at: new Date().toISOString() })
        .in("id", documentoIds);
      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: `Email inviata ma aggiornamento last_notified_at fallito: ${error.message}`,
            notified: total,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      notified: total,
      updated_last_notified_at: documentoIds.length,
      to,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Errore cron alert documenti aziende" },
      { status: 500 }
    );
  }
}
