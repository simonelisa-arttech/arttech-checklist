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
      note = null,
      tagliando_id = null,
      id = null,
      trigger = null,

      destinatario = null,
      email_manuale = null,
      to_operatore_id: toOperatoreIdRaw = null,
      toOperatoreId: toOperatoreIdAlt = null,
      to_email: toEmailRaw = null,
      toEmail: toEmailAlt = null,

      subject = null,
      from_operatore_id = null,
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

    const toOperatoreId = toOperatoreIdRaw ?? toOperatoreIdAlt ?? null;
    const toEmailInput = toEmailRaw ?? toEmailAlt ?? null;
    const toEmailFromBody = typeof toEmailInput === "string" ? toEmailInput.trim() : null;
    const toEmailFromOther = extractEmail(email_manuale) || extractEmail(destinatario);
    const toEmailNorm = toEmailFromBody || toEmailFromOther || null;
    const toEmailOk = toEmailNorm && toEmailNorm.length > 3 ? toEmailNorm : null;
    const tipoRaw = String(tipo || "").trim().toUpperCase();
    const inferredLicense =
      Boolean((body as any)?.license_id) ||
      Boolean((body as any)?.licenza_id) ||
      tipoRaw === "LICENZA" ||
      (typeof riferimento === "string" &&
        riferimento.trim().length > 0 &&
        !Number.isNaN(Number(riferimento.trim())));
    const tipoNorm = tipoRaw || (inferredLicense ? "LICENZA" : null);
    const tipoUpper = String(tipoNorm || "");
    const tagliandoId = tagliando_id ?? id ?? null;
    const finalSubject =
      subject ||
      `AVVISO ${tipoNorm ?? "RINNOVO"} — ${riferimento ?? ""}`.trim();
    const triggerValue = String(trigger || "MANUALE").trim().toUpperCase();

    if (!toOperatoreId && !toEmailOk) {
      return NextResponse.json(
        { error: "Missing recipient" },
        { status: 400 }
      );
    }
    if (tipoUpper === "TAGLIANDO" && !tagliandoId) {
      return NextResponse.json(
        { error: "Missing tagliando_id for TAGLIANDO" },
        { status: 400 }
      );
    }

    const logRow: Record<string, any> = {
      checklist_id,
      intervento_id,
      tipo: tipoNorm,
      riferimento: riferimento ?? null,
      scadenza,
      modalita,
      stato: stato ?? null,
      destinatario: destinatario ?? null,
      to_operatore_id: toOperatoreId,
      to_email: toEmailOk,
      subject: finalSubject,
      messaggio: message,
      inviato_email: false,
      trigger: triggerValue,
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

    if (send_email && toEmailOk) {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        emailError = "Missing RESEND_API_KEY";
      } else {
        try {
          const resend = new Resend(resendKey);

          const emailFrom = process.env.EMAIL_FROM || "Art Tech <noreply@maxischermiled.it>";
          await resend.emails.send({
            from: emailFrom,
            to: [toEmailOk],
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
    } else if (send_email && !toEmailOk) {
      emailError = "No recipient email (destinatario/email_manuale missing)";
    }

    let updated: { tipo: "TAGLIANDO"; id: string; stato: "AVVISATO" } | null = null;
    if (tipoUpper === "TAGLIANDO" && (!send_email || emailSent)) {
      const updatePayload = {
        stato: "AVVISATO",
        alert_last_sent_at: new Date().toISOString(),
        alert_last_sent_by_operatore: from_operatore_id ?? null,
      };
      const { data: updData, error: updErr } = await supabaseAdmin
        .from("tagliandi")
        .update(updatePayload)
        .eq("id", tagliandoId)
        .select("id");
      if (updErr) {
        return NextResponse.json(
          { ok: false, error: `Tagliando update failed: ${updErr.message}` },
          { status: 500 }
        );
      }
      if (!updData || updData.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Tagliando not found for id" },
          { status: 500 }
        );
      }
      updated = { tipo: "TAGLIANDO", id: tagliandoId, stato: "AVVISATO" };
    }

    return NextResponse.json({
      ok: true,
      log_saved: true,
      log_id: logId,
      email_sent: emailSent,
      message: emailSent ? "Email inviata." : "Email non inviata, log salvato.",
      email_error: emailError,
      updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
