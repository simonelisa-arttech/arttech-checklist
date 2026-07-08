export const runtime = "nodejs";

/**
 * P5.3 — Thread ticket lato OPERATORE (dashboard staff).
 * GET  → elenco messaggi del ticket + marca come letti i messaggi del cliente
 * POST → l'operatore risponde. Imposta presa_in_carico_at/assegnatario e prima_risposta_at
 *        se mancanti, porta lo stato a "in_lavorazione" (o allo stato passato nel body:
 *        in_lavorazione|risolto|chiuso) e notifica il cliente via email.
 */

import { NextResponse } from "next/server";
import { resolveOperatoreAuth } from "@/lib/operatoreAuth";
import { sendEmail } from "@/lib/email";

type Ctx = { params: Promise<{ ticketId: string }> };

const STATI_VALIDI = new Set(["aperto", "in_lavorazione", "risolto", "chiuso"]);

export async function GET(request: Request, ctx: Ctx) {
  const auth = await resolveOperatoreAuth(request);
  if (!auth.ok) return auth.response;
  const { ticketId } = await ctx.params;

  const { data: messaggi, error } = await auth.adminClient
    .from("assistenza_ticket_messaggi")
    .select("id, autore_tipo, autore_id, corpo, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auth.adminClient
    .from("assistenza_ticket_messaggi")
    .update({ letto_operatore: true })
    .eq("ticket_id", ticketId)
    .eq("autore_tipo", "cliente")
    .eq("letto_operatore", false);

  return NextResponse.json({ ok: true, messaggi: messaggi || [] });
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveOperatoreAuth(request);
  if (!auth.ok) return auth.response;
  const { ticketId } = await ctx.params;

  const body = await request.json().catch(() => ({}));
  const corpo = String(body?.corpo || "").trim();
  const nuovoStatoRaw = String(body?.stato || "").trim().toLowerCase();
  const nuovoStato = STATI_VALIDI.has(nuovoStatoRaw) ? nuovoStatoRaw : null;
  if (!corpo && !nuovoStato) {
    return NextResponse.json({ error: "Nessun contenuto o cambio stato" }, { status: 400 });
  }
  if (corpo.length > 5000) return NextResponse.json({ error: "Messaggio troppo lungo" }, { status: 400 });

  const { data: ticket, error: tErr } = await auth.adminClient
    .from("assistenza_tickets")
    .select("id, numero, email, stato, assegnatario_id, presa_in_carico_at, prima_risposta_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "Ticket non trovato" }, { status: 404 });

  const now = new Date().toISOString();

  if (corpo) {
    const { error: insErr } = await auth.adminClient.from("assistenza_ticket_messaggi").insert({
      ticket_id: ticketId,
      autore_tipo: "operatore",
      autore_id: auth.operatore.id,
      corpo,
      letto_cliente: false,
      letto_operatore: true,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Aggiornamenti ticket: presa in carico, prima risposta, stato.
  const patch: Record<string, unknown> = { updated_at: now };
  if (!ticket.assegnatario_id) patch.assegnatario_id = auth.operatore.id;
  if (!ticket.presa_in_carico_at) patch.presa_in_carico_at = now;
  if (corpo && !ticket.prima_risposta_at) patch.prima_risposta_at = now;
  if (nuovoStato) {
    patch.stato = nuovoStato;
    if (nuovoStato === "risolto") patch.risolto_at = now;
  } else if (ticket.stato === "aperto") {
    patch.stato = "in_lavorazione";
  }
  await auth.adminClient.from("assistenza_tickets").update(patch).eq("id", ticketId);

  // Notifica cliente (best-effort) quando l'operatore scrive.
  if (corpo && ticket.email) {
    try {
      await sendEmail({
        to: ticket.email,
        subject: `Aggiornamento sulla tua richiesta di assistenza (#${ticket.numero})`,
        text: [
          "Gentile cliente,",
          "",
          `hai ricevuto una risposta dal nostro team di assistenza sul ticket #${ticket.numero}:`,
          "",
          corpo,
          "",
          "Puoi rispondere e seguire lo stato dalla tua Area Cliente:",
          "https://atsystem.arttechworld.com/login?next=/cliente?azione=assistenza",
        ].join("\n"),
        html: [
          "<p>Gentile cliente,</p>",
          `<p>hai ricevuto una risposta dal nostro team di assistenza sul ticket #${ticket.numero}:</p>`,
          `<blockquote>${corpo.replace(/\n/g, "<br />")}</blockquote>`,
          `<p><a href="https://atsystem.arttechworld.com/login?next=/cliente?azione=assistenza">Vai alla tua Area Cliente</a></p>`,
        ].join(""),
      });
    } catch {
      // la notifica non blocca
    }
  }

  return NextResponse.json({ ok: true });
}
