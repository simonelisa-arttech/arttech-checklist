export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assistenza area cliente.
 *
 * GET  → tier assistenza del cliente loggato (expired/standard/plus/premium)
 *        calcolato server-side dai dati reali (contratti, rinnovi, garanzie).
 * POST → apertura ticket assistenza: salva su assistenza_tickets e notifica
 *        lo staff via email interna. Nessuna email automatica al cliente.
 */

import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";
import { computeSupportTierForCliente } from "@/lib/supportTier";
import { sendEmail } from "@/lib/email";

const CATEGORIE_VALIDE = new Set([
  "noimage",
  "brightness",
  "pixels",
  "control",
  "power",
  "other",
]);

const CATEGORIA_LABEL: Record<string, string> = {
  noimage: "Schermo senza immagine",
  brightness: "Luminosità / colori anomali",
  pixels: "Pixel / zone spente",
  control: "CMS / sistema di controllo",
  power: "Alimentazione",
  other: "Altro problema",
};

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  try {
    const info = await computeSupportTierForCliente(auth.adminClient, auth.cliente.cliente_id);

    // ultimi ticket del cliente (storico)
    const { data: tickets } = await auth.adminClient
      .from("assistenza_tickets")
      .select("id, numero, categoria, descrizione, stato, created_at")
      .eq("cliente_id", auth.cliente.cliente_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ ok: true, assistenza: info, tickets: tickets || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore caricamento assistenza" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  let body: {
    categoria?: string;
    descrizione?: string;
    checklist_id?: string;
    impianto?: string;
    telefono?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const categoria = String(body?.categoria || "other").trim().toLowerCase();
  if (!CATEGORIE_VALIDE.has(categoria)) {
    return NextResponse.json({ error: "Categoria non valida" }, { status: 400 });
  }
  const descrizione = String(body?.descrizione || "").trim().slice(0, 4000);
  if (descrizione.length < 10) {
    return NextResponse.json(
      { error: "Descrivi il problema (almeno 10 caratteri)" },
      { status: 400 }
    );
  }
  const checklistId = String(body?.checklist_id || "").trim() || null;
  const impianto = String(body?.impianto || "").trim().slice(0, 300) || null;
  const telefono = String(body?.telefono || "").trim().slice(0, 50) || null;

  try {
    const info = await computeSupportTierForCliente(auth.adminClient, auth.cliente.cliente_id);

    const { data: inserted, error: insertErr } = await auth.adminClient
      .from("assistenza_tickets")
      .insert({
        cliente_id: auth.cliente.cliente_id,
        checklist_id: checklistId,
        email: auth.cliente.email,
        tier: info.tier,
        categoria,
        impianto,
        telefono,
        descrizione,
        stato: "aperto",
      })
      .select("id, numero, created_at")
      .maybeSingle();

    if (insertErr || !inserted?.id) {
      return NextResponse.json(
        { error: insertErr?.message || "Errore apertura ticket" },
        { status: 500 }
      );
    }

    // Notifica interna allo staff (non blocca la risposta)
    const staffTo =
      process.env.SUPPORT_TICKET_NOTIFY_EMAIL ||
      process.env.EMAIL_FROM ||
      "ticket@maxischermiled.it";
    try {
      await sendEmail({
        to: staffTo,
        // Reply-To = email del cliente: HubSpot (email-to-ticket) associa cosi'
        // la conversazione al contatto giusto e lo staff risponde direttamente.
        replyTo: auth.cliente.email,
        subject: `[Ticket #${inserted.numero}] ${CATEGORIA_LABEL[categoria]} — tier ${info.tier.toUpperCase()} — ${auth.cliente.email}`,
        text: [
          `Nuovo ticket assistenza dall'area cliente.`,
          ``,
          `Numero: #${inserted.numero}`,
          `Cliente ID: ${auth.cliente.cliente_id}`,
          `Email cliente: ${auth.cliente.email}`,
          `Tier: ${info.tier}`,
          `Categoria: ${CATEGORIA_LABEL[categoria]}`,
          `Impianto: ${impianto || "-"}`,
          `Telefono: ${telefono || "-"}`,
          ``,
          `Descrizione:`,
          descrizione,
        ].join("\n"),
        html: [
          `<p>Nuovo ticket assistenza dall'area cliente.</p>`,
          `<ul>`,
          `<li><strong>Numero:</strong> #${inserted.numero}</li>`,
          `<li><strong>Email cliente:</strong> ${auth.cliente.email}</li>`,
          `<li><strong>Tier:</strong> ${info.tier}</li>`,
          `<li><strong>Categoria:</strong> ${CATEGORIA_LABEL[categoria]}</li>`,
          `<li><strong>Impianto:</strong> ${impianto || "-"}</li>`,
          `<li><strong>Telefono:</strong> ${telefono || "-"}</li>`,
          `</ul>`,
          `<p><strong>Descrizione:</strong></p>`,
          `<p>${descrizione.replace(/\n/g, "<br />")}</p>`,
        ].join(""),
      });
    } catch {
      // la notifica email non deve bloccare l'apertura del ticket
    }

    return NextResponse.json({
      ok: true,
      ticket: {
        id: inserted.id,
        numero: inserted.numero,
        created_at: inserted.created_at,
        tier: info.tier,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore apertura ticket" },
      { status: 500 }
    );
  }
}
