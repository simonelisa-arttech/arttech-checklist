export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cliente_id: string }> }
) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const clienteId = String(params?.cliente_id || "").trim();
  if (!clienteId) {
    return badRequest("cliente_id mancante");
  }

  const { data, error } = await auth.adminClient
    .from("clienti_referenti")
    .select("id, cliente_id, nome, telefono, email, ruolo, note, attivo, indirizzo_preferito, created_at, updated_at")
    .eq("cliente_id", clienteId)
    .order("attivo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, referenti: data || [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ cliente_id: string }> }
) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const clienteId = String(params?.cliente_id || "").trim();
  if (!clienteId) {
    return badRequest("cliente_id mancante");
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const nome = String(body?.nome || "").trim();
  const telefono = String(body?.telefono || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const ruolo = String(body?.ruolo || "").trim();
  const note = String(body?.note || "").trim();

  if (!nome) {
    return badRequest("Nome referente obbligatorio");
  }

  const payload = {
    cliente_id: clienteId,
    nome,
    telefono: telefono || null,
    email: email || null,
    ruolo: ruolo || null,
    note: note || null,
    attivo: true,
  };

  const { data, error } = await auth.adminClient
    .from("clienti_referenti")
    .insert(payload)
    .select("id, cliente_id, nome, telefono, email, ruolo, note, attivo, indirizzo_preferito, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, referente: data });
}
