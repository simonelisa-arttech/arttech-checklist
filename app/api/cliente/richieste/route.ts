export const runtime = "nodejs";

/**
 * P5.4 — Creazione richiesta tracciata dalle CTA del Hub (scadenze/upsell).
 * Tipi: rinnovo | tagliando | upgrade | rinnovo_sim.
 * Riusa l'infrastruttura ticket (assistenza_tickets): la richiesta nasce come ticket
 * con tipo_richiesta dedicato, priorità automatica dal piano del progetto, e notifica staff.
 * Nessuna integrazione HubSpot aggiuntiva.
 */

import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";
import { computeSupportTierForProgetto } from "@/lib/supportTier";
import { prioritaDaTier } from "@/lib/ticketPriorita";
import { sendEmail } from "@/lib/email";

const TIPI_VALIDI = new Set(["rinnovo", "tagliando", "upgrade", "rinnovo_sim"]);

const ETICHETTA: Record<string, string> = {
  rinnovo: "Rinnovo",
  tagliando: "Prenota tagliando",
  upgrade: "Upgrade a CARE ULTRA",
  rinnovo_sim: "Rinnovo SIM",
};

export async function POST(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const tipo = String(body?.tipo || "").trim().toLowerCase();
  const checklistId = String(body?.checklist_id || "").trim() || null;
  const scadenzaTipo = String(body?.scadenza_tipo || "").trim() || null;
  const scadenzaData = String(body?.scadenza_data || "").trim() || null;
  const note = String(body?.note || "").trim().slice(0, 1000) || null;

  if (!TIPI_VALIDI.has(tipo)) {
    return NextResponse.json({ error: "Tipo richiesta non valido" }, { status: 400 });
  }
  if (!checklistId) {
    return NextResponse.json({ error: "Progetto mancante" }, { status: 400 });
  }

  const { data: ck, error: ckErr } = await auth.adminClient
    .from("checklists")
    .select("id, cliente_id, nome_checklist")
    .eq("id", checklistId)
    .maybeSingle();
  if (ckErr) return NextResponse.json({ error: ckErr.message }, { status: 500 });
  if (!ck || String(ck.cliente_id) !== String(auth.cliente.cliente_id)) {
    return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  }

  let tier = "NESSUNA";
  try {
    const prog = await computeSupportTierForProgetto(auth.adminClient, checklistId);
    tier = prog.tier;
  } catch {
    // fallback: NESSUNA
  }
  const priorita = prioritaDaTier(tier, tipo);

  const progettoNome = String(ck.nome_checklist || "").trim() || "progetto";
  const scadenzaTxt = scadenzaTipo
    ? `${scadenzaTipo}${scadenzaData ? ` in scadenza/scaduta il ${scadenzaData}` : ""}`
    : "copertura/servizio";
  const descrizione = [
    `[${ETICHETTA[tipo]}] Richiesta generata dall'Area Cliente per il progetto "${progettoNome}".`,
    `Riferimento: ${scadenzaTxt}.`,
    note ? `Note cliente: ${note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: inserted, error: insErr } = await auth.adminClient
    .from("assistenza_tickets")
    .insert({
      cliente_id: auth.cliente.cliente_id,
      checklist_id: checklistId,
      email: auth.cliente.email,
      tier,
      categoria: "other",
      impianto: progettoNome,
      descrizione,
      stato: "aperto",
      urgenza: "media",
      tipo_richiesta: tipo,
      priorita,
    })
    .select("id, numero")
    .maybeSingle();
  if (insErr || !inserted?.id) {
    return NextResponse.json({ error: insErr?.message || "Errore creazione richiesta" }, { status: 500 });
  }

  try {
    const staffTo =
      process.env.SUPPORT_TICKET_NOTIFY_EMAIL || process.env.EMAIL_FROM || "ticket@maxischermiled.it";
    await sendEmail({
      to: staffTo,
      replyTo: auth.cliente.email,
      subject: `[Richiesta #${inserted.numero}] ${ETICHETTA[tipo]} — ${progettoNome} — priorità ${priorita} — ${auth.cliente.email}`,
      text: `${descrizione}\n\nCliente: ${auth.cliente.email}\nPiano progetto: ${tier} · Priorità: ${priorita}`,
      html: `<p>${descrizione.replace(/\n/g, "<br />")}</p><p><strong>Cliente:</strong> ${auth.cliente.email}<br /><strong>Piano progetto:</strong> ${tier} · <strong>Priorità:</strong> ${priorita}</p>`,
    });
  } catch {
    // la notifica non blocca
  }

  return NextResponse.json({ ok: true, numero: inserted.numero, tipo, priorita });
}
