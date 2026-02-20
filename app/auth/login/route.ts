import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || "").trim();
  const emailNorm = email.toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email e password obbligatorie" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.session) {
    return NextResponse.json({ error: "Sessione non creata" }, { status: 500 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Configurazione mancante. Contatta admin." },
      { status: 500 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authUserId = data.user?.id;
  if (!authUserId) {
    return NextResponse.json({ error: "Utente autenticato non valido" }, { status: 500 });
  }

  const { data: existingByEmail, error: byEmailErr } = await adminClient
    .from("operatori")
    .select("id, user_id, nome, ruolo, email")
    .ilike("email", emailNorm)
    .limit(1)
    .maybeSingle();

  if (byEmailErr) {
    return NextResponse.json(
      { error: `Errore associazione operatore: ${byEmailErr.message}` },
      { status: 500 }
    );
  }

  if (existingByEmail?.id) {
    const existingUserId = existingByEmail.user_id ? String(existingByEmail.user_id) : null;
    if (!existingUserId) {
      const { error: linkErr } = await adminClient
        .from("operatori")
        .update({ user_id: authUserId })
        .eq("id", existingByEmail.id);
      if (linkErr) {
        return NextResponse.json(
          { error: `Errore associazione operatore: ${linkErr.message}` },
          { status: 500 }
        );
      }
    } else if (existingUserId !== authUserId) {
      return NextResponse.json(
        { error: "Operatore associato ad altro account. Contatta admin." },
        { status: 403 }
      );
    }
  } else {
    const nomeDefault = emailNorm.includes("@") ? emailNorm.split("@")[0] : emailNorm;
    const { error: createErr } = await adminClient.from("operatori").insert({
      user_id: authUserId,
      nome: nomeDefault || "Operatore",
      ruolo: "ALTRO",
      email: emailNorm,
      attivo: true,
      alert_enabled: false,
      alert_tasks: { task_template_ids: [], all_task_status_change: false },
    });
    if (createErr) {
      return NextResponse.json(
        { error: `Errore creazione operatore: ${createErr.message}` },
        { status: 500 }
      );
    }
  }

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("sb-access-token", data.session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: data.session.expires_in ?? 3600,
  });
  response.cookies.set("sb-refresh-token", data.session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
