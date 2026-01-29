export const runtime = "nodejs";

import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  const body = await request.json();

  // Normalize payload fields (supports internal operator or external manual email)
  const toRaw = (body?.to ?? body?.email ?? body?.to_email ?? body?.destinatario_email ?? body?.destinatarioEmail ?? "") as any;
  const to = Array.isArray(toRaw) ? toRaw.join(",") : String(toRaw || "").trim();
  const subject = String(body?.subject ?? body?.oggetto ?? "Avviso AT SYSTEM").trim();
  const text = String(body?.message ?? body?.messaggio ?? body?.testo ?? "");
  const html = body?.html ? String(body.html) : undefined;
  const sendEmailRequested = Boolean(body?.send_email ?? body?.sendEmail ?? body?.invia_email ?? body?.inviaEmail ?? false);

  // Save alert/log to DB (existing logic)
  const { data, error } = await supabase.from("checklist_alert_log").insert({
    license_id: body.license_id ?? null,
    alert_type: body.alert_type ?? null,
    message: text,
    created_at: new Date().toISOString(),
    operator_id: body.operator_id ?? null,
    // additional fields if any...
  });

  let emailSent = false;
  let emailError: string | null = null;

  if (sendEmailRequested) {
    if (!resend || !mailFrom) {
      emailSent = false;
      emailError = !resendApiKey
        ? "Missing RESEND_API_KEY"
        : "Missing MAIL_FROM";
    } else if (!to) {
      emailSent = false;
      emailError = "Missing recipient email";
    } else {
      try {
        await resend.emails.send({
          from: mailFrom,
          to: to.split(",").map((s) => s.trim()).filter(Boolean),
          subject,
          text,
          ...(html ? { html } : {}),
        });
        emailSent = true;
      } catch (e: any) {
        emailSent = false;
        emailError = e?.message ? String(e.message) : "Resend send failed";
      }
    }
  }

  let message = "";
  if (emailSent === true) {
    message = "Email inviata, log salvato.";
  } else if (sendEmailRequested === true) {
    message = "Email non inviata, log salvato.";
    if (emailError) {
      message += ` Errore: ${emailError}`;
    }
  } else {
    message = "Log salvato.";
  }

  return NextResponse.json({
    success: !error,
    message,
    emailSent,
    emailError,
    data,
  });
}
