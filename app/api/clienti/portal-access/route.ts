export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireClientPortalManager } from "@/lib/adminAuth";

function isValidEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return !!email && email.includes("@");
}

function generateTemporaryPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}

function normalizeClienteIdsParam(value: string | null) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(request: Request) {
  const auth = await requireClientPortalManager(request);
  if (!auth.ok) return auth.response;

  const clienteIds = normalizeClienteIdsParam(new URL(request.url).searchParams.get("cliente_ids"));

  let query = auth.adminClient
    .from("clienti_portale_auth")
    .select("id, cliente_id, user_id, email, attivo, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (clienteIds.length > 0) {
    query = query.in("cliente_id", clienteIds);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireClientPortalManager(request);
  if (!auth.ok) return auth.response;

  let body: { cliente_id?: string };
  try {
    body = (await request.json()) as { cliente_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clienteId = String(body?.cliente_id || "").trim();
  if (!clienteId) {
    return NextResponse.json({ error: "cliente_id mancante" }, { status: 400 });
  }

  const { data: existingAccess, error: existingAccessErr } = await auth.adminClient
    .from("clienti_portale_auth")
    .select("id, cliente_id, email, attivo")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (existingAccessErr) {
    return NextResponse.json({ error: existingAccessErr.message }, { status: 500 });
  }
  if (existingAccess?.id) {
    return NextResponse.json(
      {
        error:
          existingAccess.attivo === false
            ? "Accesso cliente già presente ma non attivo"
            : "Accesso cliente già attivo",
      },
      { status: 409 }
    );
  }

  const { data: cliente, error: clienteErr } = await auth.adminClient
    .from("clienti_anagrafica")
    .select("id, denominazione, email")
    .eq("id", clienteId)
    .maybeSingle();
  if (clienteErr) {
    return NextResponse.json({ error: clienteErr.message }, { status: 500 });
  }
  if (!cliente?.id) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const email = String(cliente.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Il cliente non ha un'email valida in anagrafica" }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: createdUserData, error: createUserErr } = await auth.adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      ruolo_portale: "CLIENTE",
      cliente_id: clienteId,
      cliente_denominazione: cliente.denominazione || null,
    },
  });

  if (createUserErr || !createdUserData?.user?.id) {
    const message = String(createUserErr?.message || "Impossibile creare utente Auth cliente");
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const userId = createdUserData.user.id;
  const { data: insertedAccess, error: insertAccessErr } = await auth.adminClient
    .from("clienti_portale_auth")
    .insert({
      cliente_id: clienteId,
      user_id: userId,
      email,
      attivo: true,
    })
    .select("id, cliente_id, email, attivo")
    .maybeSingle();

  if (insertAccessErr) {
    await auth.adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: insertAccessErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accesso: insertedAccess || {
      cliente_id: clienteId,
      email,
      attivo: true,
    },
    credenziali: {
      email,
      password_temporanea: temporaryPassword,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireClientPortalManager(request);
  if (!auth.ok) return auth.response;

  let body: { cliente_id?: string; action?: string };
  try {
    body = (await request.json()) as { cliente_id?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clienteId = String(body?.cliente_id || "").trim();
  const action = String(body?.action || "").trim().toLowerCase();
  if (!clienteId) {
    return NextResponse.json({ error: "cliente_id mancante" }, { status: 400 });
  }
  if (!(action === "deactivate" || action === "reset_password")) {
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  }

  const { data: accesso, error: accessoErr } = await auth.adminClient
    .from("clienti_portale_auth")
    .select("id, cliente_id, user_id, email, attivo")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (accessoErr) {
    return NextResponse.json({ error: accessoErr.message }, { status: 500 });
  }
  if (!accesso?.id) {
    return NextResponse.json({ error: "Accesso cliente non trovato" }, { status: 404 });
  }

  if (action === "deactivate") {
    const { data: updated, error: updateErr } = await auth.adminClient
      .from("clienti_portale_auth")
      .update({ attivo: false, updated_at: new Date().toISOString() })
      .eq("id", accesso.id)
      .select("id, cliente_id, email, attivo")
      .maybeSingle();
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      accesso: updated || {
        id: accesso.id,
        cliente_id: accesso.cliente_id,
        email: accesso.email,
        attivo: false,
      },
    });
  }

  const userId = String(accesso.user_id || "").trim();
  const email = String(accesso.email || "").trim().toLowerCase();
  if (!userId) {
    return NextResponse.json({ error: "user_id mancante per l'accesso cliente" }, { status: 500 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email accesso cliente non valida" }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: resetErr } = await auth.adminClient.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });
  if (resetErr) {
    return NextResponse.json({ error: resetErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accesso: {
      id: accesso.id,
      cliente_id: accesso.cliente_id,
      email,
      attivo: accesso.attivo !== false,
    },
    credenziali: {
      email,
      password_temporanea: temporaryPassword,
    },
  });
}
