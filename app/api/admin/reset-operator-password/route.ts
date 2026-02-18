export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSiteUrl, requireAdmin } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email";

type ResetBody = {
  operatore_id?: string;
  email?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const operatoreId = String(body.operatore_id || "").trim();
  const emailInput = String(body.email || "").trim().toLowerCase();
  if (!operatoreId && !emailInput) {
    return NextResponse.json({ error: "operatore_id o email obbligatori" }, { status: 400 });
  }

  const adminClient = auth.adminClient;
  let operatore: {
    id: string;
    email: string | null;
    nome: string | null;
    user_id: string | null;
  } | null = null;

  if (operatoreId) {
    const { data, error } = await adminClient
      .from("operatori")
      .select("id, email, nome, user_id")
      .eq("id", operatoreId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    operatore = (data as any) || null;
  } else {
    const { data, error } = await adminClient
      .from("operatori")
      .select("id, email, nome, user_id")
      .ilike("email", emailInput)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    operatore = (data as any) || null;
  }

  const email = String(operatore?.email || emailInput || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email operatore non valida" }, { status: 400 });
  }

  const { data: recoveryData, error: recoveryErr } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${getSiteUrl()}/auth/callback` },
  } as any);

  if (recoveryErr) {
    return NextResponse.json({ error: recoveryErr.message }, { status: 500 });
  }

  const actionLink = recoveryData?.properties?.action_link || "";
  const userId = recoveryData?.user?.id || null;

  if (!actionLink) {
    return NextResponse.json({ error: "Recovery link non disponibile" }, { status: 500 });
  }

  if (operatore?.id && userId && !operatore.user_id) {
    const { error: updErr } = await adminClient
      .from("operatori")
      .update({ user_id: userId })
      .eq("id", operatore.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  try {
    await sendEmail({
      to: email,
      subject: "Reset password - AT SYSTEM",
      text: `Clicca qui per reimpostare la password: ${actionLink}`,
      html: `<p>Clicca qui per reimpostare la password:</p><p><a href="${actionLink}">Reset Password</a></p>`,
    });
  } catch (emailErr: any) {
    return NextResponse.json(
      { error: emailErr?.message || "Errore invio email reset" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    email,
    user_id: userId,
  });
}
