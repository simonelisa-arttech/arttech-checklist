export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

/**
 * Payload atteso (tollerante):
 * {
 *   checklist_id?: string | null
 *   intervento_id?: string | null
 *   tipo?: string | null                // es: "TAGLIANDO" | "LICENZA" | "RINNOVO"
 *   riferimento?: string | null         // es: "Tagliando annuale impianto" | numero licenza
 *   scadenza?: string | null            // YYYY-MM-DD oppure dd/mm/yyyy (accettiamo entrambi, lo salviamo come testo)
 *   modalita?: string | null            // es: "EXTRA" | "INCLUSO" | "AUTORIZZATO_CLIENTE" | null
 *   stato?: string | null               // es: "DA_AVVISARE" ecc
 *
 *   // destinatario:
 *   destinatario?: string | null        // es: "Nome — RUOLO — email@dominio.it"
 *   email_manuale?: string | null       // es: "cliente@dominio.it"
 *
 *   // contenuto:
 *   subject?: string | null
 *   message: string
 *
 *   // flags:
 *   send_email?: boolean                // se true prova a inviare email via Resend
 * }
 */

function extractEmail(input?: string | null) {
  if (!input) return null;
  const m = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      checklist_id = null,
      intervento_id = null,
      tipo = null,
      riferimento = null,
      scadenza = null,
      modalita = null,
      stato = null,

      destinatario = null,
      email_manuale = null,

      subject = null,
      message,
      send_email = true,
    } = body ?? {};

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing message" },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const toEmail = extractEmail(email_manuale) || extractEmail(destinatario);
    const finalSubject =
      subject ||
      `AVVISO ${tipo ?? "RINNOVO"} — ${riferimento ?? ""}`.trim();

    const logRow: Record<string, any> = {
      checklist_id,
      intervento_id,
      tipo,
      riferimento,
      scadenza,
      modalita,
      stato,
      destinatario: destinatario ?? null,
      email: toEmail ?? null,
      subject: finalSubject,
      messaggio: message,
      inviato_email: false,
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("checklist_alert_log")
      .insert(logRow)
      .select("id")
      .single();

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: `DB log insert failed: ${insErr.message}` },
        { status: 500 }
      );
    }

    const logId = inserted?.id ?? null;

    let emailSent = false;
    let emailError: string | null = null;

    if (send_email && toEmail) {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        emailError = "Missing RESEND_API_KEY";
      } else {
        try {
          const resend = new Resend(resendKey);

          const fromEmail =
            process.env.ALERT_FROM_EMAIL || "onboarding@resend.dev";
          const fromName = process.env.ALERT_FROM_NAME || "Art Tech";
          const from = `${fromName} <${fromEmail}>`;

          await resend.emails.send({
            from,
            to: [toEmail],
            subject: finalSubject,
            text: message,
          });

          emailSent = true;

          await supabaseAdmin
            .from("checklist_alert_log")
            .update({ inviato_email: true })
            .eq("id", logId);
        } catch (e: any) {
          emailError = e?.message ?? "Resend error";
        }
      }
    } else if (send_email && !toEmail) {
      emailError = "No recipient email (destinatario/email_manuale missing)";
    }

    return NextResponse.json({
      ok: true,
      log_saved: true,
      log_id: logId,
      email_sent: emailSent,
      message: emailSent ? "Email inviata." : "Email non inviata, log salvato.",
      email_error: emailError,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
