export const runtime = "nodejs";

/**
 * P5.3 — Thread ticket lato CLIENTE (Hub "I miei ticket").
 * GET  → elenco messaggi del ticket (solo se appartiene al cliente autenticato)
 * POST → il cliente aggiunge un messaggio al thread. Notifica lo staff via email.
 *        Se il ticket era risolto/chiuso, la risposta del cliente lo riapre.
 */

import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";
import { sendEmail } from "@/lib/email";

type Ctx = { params: Promise<{ ticketId: string }> };

async function loadOwnedTicket(auth: Awaited<ReturnType<typeof resolveClientePortalAuth>> & { ok: true }, ticketId: string) {
  const { data, error } = await auth.adminClient
    .from("assistenza_tickets")
    .select("id, numero, cliente_id, email, stato")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!data || String(data.cliente_id) !== String(auth.cliente.cliente_id)) {
    return { error: NextResponse.json({ error: "Ticket non trovato" }, { status: 404 }) };
  }
  return { ticket: data };
}

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  const { ticketId } = await ctx.params;

  const owned = await loadOwnedTicket(auth, ticketId);
  if (owned.error) return owned.error;

  const { data: messaggi, error } = await auth.adminClient
    .from("assistenza_ticket_messaggi")
    .select("id, autore_tipo, corpo, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marca come letti dal cliente i messaggi dell'operatore.
  await auth.adminClient
    .from("assistenza_ticket_messaggi")
    .update({ letto_cliente: true })
    .eq("ticket_id", ticketId)
    .eq("autore_tipo", "operatore")
    .eq("letto_cliente", false);

  return NextResponse.json({ ok: true, messaggi: messaggi || [] });
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  const { ticketId } = await ctx.params;

  const body = await request.json().catch(() => ({}));
  const corpo = String(body?.corpo || "").trim();
  if (!corpo) return NextResponse.json({ error: "Messaggio vuoto" }, { status: 400 });
  if (corpo.length > 5000) return NextResponse.json({ error: "Messaggio troppo lungo" }, { status: 400 });

  const owned = await loadOwnedTicket(auth, ticketId);
  if (owned.error) return owned.error;
  const ticket = owned.ticket;

  const { error: insErr } = await auth.adminClient.from("assistenza_ticket_messaggi").insert({
    ticket_id: ticketId,
    autore_tipo: "cliente",
    autore_id: auth.cliente.cliente_id,
    corpo,
    letto_cliente: true,
    letto_operatore: false,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Risposta del cliente su ticket risolto/chiuso → riapre.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (ticket.stato === "risolto" || ticket.stato === "chiuso") patch.stato = "in_lavorazione";
  await auth.adminClient.from("assistenza_tickets").update(patch).eq("id", ticketId);

  // Notifica staff (best-effort).
  try {
    const staffTo =
      process.env.SUPPORT_TICKET_NOTIFY_EMAIL || process.env.EMAIL_FROM || "ticket@maxischermiled.it";
    await sendEmail({
      to: staffTo,
      replyTo: auth.cliente.email,
      subject: `[Ticket #${ticket.numero}] Nuova risposta dal cliente`,
      text: `Il cliente ${auth.cliente.email} ha risposto al ticket #${ticket.numero}:\n\n${corpo}`,
      html: `<p>Il cliente <strong>${auth.cliente.email}</strong> ha risposto al ticket #${ticket.numero}:</p><p>${corpo.replace(/\n/g, "<br />")}</p>`,
    });
  } catch {
    // la notifica non blocca
  }

  return NextResponse.json({ ok: true });
}
