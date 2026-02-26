export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSiteUrl, requireAdmin } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email";

type CreateOperatorBody = {
  email?: string;
  nome?: string;
  ruolo?: string;
};

function isAlreadyRegisteredError(message: string) {
  const text = message.toLowerCase();
  return text.includes("already") || text.includes("registered") || text.includes("exists");
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: CreateOperatorBody;
  try {
    body = (await request.json()) as CreateOperatorBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  const ruolo = String(body.ruolo || "").trim().toUpperCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email non valida" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }
  if (!ruolo) {
    return NextResponse.json({ error: "Ruolo obbligatorio" }, { status: 400 });
  }

  const redirectTo = `${getSiteUrl()}/auth/callback`;
  const adminClient = auth.adminClient;
  let createdNewUser = false;

  const { data: createdUserData, error: createUserErr } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome, ruolo },
  });

  if (createUserErr && !isAlreadyRegisteredError(createUserErr.message || "")) {
    return NextResponse.json({ error: createUserErr.message }, { status: 500 });
  }
  if (!createUserErr) {
    createdNewUser = true;
  }

  const { data: recoveryData, error: recoveryErr } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  } as any);

  if (recoveryErr) {
    return NextResponse.json({ error: recoveryErr.message }, { status: 500 });
  }

  const userId =
    recoveryData?.user?.id || createdUserData?.user?.id || null;
  const actionLink = recoveryData?.properties?.action_link || "";

  if (!userId) {
    return NextResponse.json(
      { error: "Impossibile determinare user id da Supabase Auth" },
      { status: 500 }
    );
  }
  if (!actionLink) {
    return NextResponse.json({ error: "Recovery link non disponibile" }, { status: 500 });
  }

  const { data: existing, error: existingErr } = await adminClient
    .from("operatori")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  if (existing?.id) {
    let { error: updErr } = await adminClient
      .from("operatori")
      .update({
        nome,
        ruolo,
        email,
        attivo: true,
        user_id: userId,
        riceve_notifiche: true,
      })
      .eq("id", existing.id);
    if (updErr && String(updErr.message || "").toLowerCase().includes("riceve_notifiche")) {
      const fallback = await adminClient
        .from("operatori")
        .update({
          nome,
          ruolo,
          email,
          attivo: true,
          user_id: userId,
        })
        .eq("id", existing.id);
      updErr = fallback.error as any;
    }
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    let { error: insErr } = await adminClient.from("operatori").insert({
      nome,
      ruolo,
      email,
      attivo: true,
      user_id: userId,
      alert_enabled: true,
      riceve_notifiche: true,
      alert_tasks: { task_template_ids: [], all_task_status_change: false },
    });
    if (insErr && String(insErr.message || "").toLowerCase().includes("riceve_notifiche")) {
      const fallback = await adminClient.from("operatori").insert({
        nome,
        ruolo,
        email,
        attivo: true,
        user_id: userId,
        alert_enabled: true,
        alert_tasks: { task_template_ids: [], all_task_status_change: false },
      });
      insErr = fallback.error as any;
    }
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  try {
    await sendEmail({
      to: email,
      subject: "Attiva le tue credenziali - AT SYSTEM",
      text: `Ciao ${nome}, imposta la tua password dal link: ${actionLink}`,
      html: `<p>Ciao ${nome},</p><p>imposta la tua password cliccando qui:</p><p><a href="${actionLink}">Imposta password</a></p>`,
    });
  } catch (emailErr: any) {
    return NextResponse.json(
      { error: emailErr?.message || "Errore invio email invito" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    user_id: userId,
    email,
    created_new_user: createdNewUser,
  });
}
