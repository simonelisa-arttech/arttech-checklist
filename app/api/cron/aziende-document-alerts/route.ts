export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { requireOperatore } from "@/lib/adminAuth";
import { buildClienteEmailList } from "@/lib/clientiEmail";
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

function stripSelectColumn(selectClause: string, column: string) {
  return selectClause
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== column)
    .join(",");
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
  const supervisorEmail = String(internalRecipient?.email || "").trim();
  if (!supervisorEmail.includes("@")) {
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

    const companyNames = Array.from(
      new Set(
        digest.grouped
          .map((group) => String(group.azienda_nome || "").trim())
          .filter((value) => value && value !== "—")
      )
    );
    let recipientEmails = buildClienteEmailList(supervisorEmail, null);

    if (companyNames.length > 0) {
      let selectClause = "denominazione, email, email_secondarie";
      let clientiData: Array<{ denominazione?: string | null; email?: string | null; email_secondarie?: string | null }> = [];
      let clientiError: { message?: string | null } | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await supabase
          .from("clienti_anagrafica")
          .select(selectClause)
          .in("denominazione", companyNames);

        clientiData = (result.data || []) as Array<{
          denominazione?: string | null;
          email?: string | null;
          email_secondarie?: string | null;
        }>;
        clientiError = result.error;
        if (!clientiError) break;

        const errorMessage = String(clientiError.message || "").toLowerCase();
        if (selectClause.includes("email_secondarie") && errorMessage.includes("email_secondarie")) {
          selectClause = stripSelectColumn(selectClause, "email_secondarie") || "denominazione, email";
          continue;
        }
        break;
      }

      if (clientiError) {
        console.warn("[aziende-document-alerts] unable to load company emails", {
          message: clientiError.message,
          aziende: companyNames.length,
        });
      } else {
        const clientiByName = new Map(
          clientiData.map((row) => [String(row.denominazione || "").trim().toLowerCase(), row])
        );
        for (const companyName of companyNames) {
          const cliente = clientiByName.get(companyName.toLowerCase());
          if (!cliente) continue;
          recipientEmails = buildClienteEmailList(
            recipientEmails.join(","),
            [cliente.email || null, cliente.email_secondarie || null].filter(Boolean).join(",")
          );
        }
      }
    }

    const to = recipientEmails.join(",");
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
