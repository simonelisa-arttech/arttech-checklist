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
import {
  computeSupportTierForCliente,
  computeSupportForCliente,
  computeSupportTierForProgetto,
} from "@/lib/supportTier";
import { sendEmail } from "@/lib/email";
import { hubspotEnabled, upsertTicket } from "@/lib/hubspot";

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
    // Legacy invariato: tier aggregato cliente-level (campo `assistenza`).
    const info = await computeSupportTierForCliente(auth.adminClient, auth.cliente.cliente_id);

    // P2.1 (additivo): copertura PER PROGETTO + aggregato, senza toccare `assistenza`.
    const aggregato = await computeSupportForCliente(auth.adminClient, auth.cliente.cliente_id);

    // Nomi progetto per le label (sola lettura).
    const { data: ckNames } = await auth.adminClient
      .from("checklists")
      .select("id, nome_checklist")
      .eq("cliente_id", auth.cliente.cliente_id);
    const nomeById = new Map(
      ((ckNames || []) as any[]).map((c) => [String(c.id || ""), String(c.nome_checklist || "")])
    );

    const progetti = aggregato.progetti.map((p) => ({
      progettoId: p.progettoId,
      progettoNome: nomeById.get(p.progettoId) || null,
      tier: p.tier,
      source: p.source,
      premiumClient: p.premiumClient,
      garanziaAttiva: p.garanziaAttiva,
      supportoAttivo: p.supportoAttivo,
      supportoScaduto: p.supportoScaduto,
      scadenzaPiano: p.scadenzaPiano,
      scadenzaGaranzia: p.scadenzaGaranzia,
      interventi: p.interventi,
      impianti: p.impianti.map((i) => ({
        id: i.id,
        nome: i.nome,
        seriale: i.seriale,
        stato: i.stato,
        garanzia: i.garanzia,
      })),
    }));

    // ultimi ticket del cliente (storico)
    const { data: tickets } = await auth.adminClient
      .from("assistenza_tickets")
      .select(
        "id, numero, categoria, tier, urgenza, impianto, descrizione, stato, created_at, updated_at, tipo_richiesta"
      )
      .eq("cliente_id", auth.cliente.cliente_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      ok: true,
      assistenza: info, // legacy invariato (contratto attuale preservato)
      aggregato: {
        bestTier: aggregato.bestTier,
        premiumClientAttivo: aggregato.premiumClientAttivo,
      },
      progetti,
      tickets: tickets || [],
    });
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
    progettoId?: string;
    checklist_id?: string;
    impiantoId?: string;
    impianto?: string;
    telefono?: string;
    // P4.1 — screening avanzato
    urgenza?: string;
    accesso_quota?: boolean;
    referente_presente?: boolean;
    dvr_dpi?: boolean;
    ricambio?: string;
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
  // P2.2.1: `progettoId` è alias di `checklist_id` (tolleranza retro-compatibile).
  const checklistId =
    String(body?.progettoId || body?.checklist_id || "").trim() || null;
  const impiantoId = String(body?.impiantoId || "").trim() || null;
  let impianto = String(body?.impianto || "").trim().slice(0, 300) || null;
  const telefono = String(body?.telefono || "").trim().slice(0, 50) || null;
  // P4.1 — screening avanzato (normalizzazione lato server)
  const URGENZE_VALIDE = new Set(["bassa", "media", "alta"]);
  const urgenzaRaw = String(body?.urgenza || "").trim().toLowerCase();
  const urgenza = URGENZE_VALIDE.has(urgenzaRaw) ? urgenzaRaw : "media";
  const accessoQuota = body?.accesso_quota === true;
  const referentePresente = body?.referente_presente === true;
  const dvrDpi = body?.dvr_dpi === true;
  const ricambio = String(body?.ricambio || "").trim().slice(0, 300) || null;
  let progettoNome: string | null = null;

  // P2.2.1 — Validazione di appartenenza (sicurezza). Se progettoId/checklist_id è assente
  // → fallback legacy (comportamento attuale invariato, nessun blocco apertura ticket).
  if (checklistId) {
    const { data: ownCk } = await auth.adminClient
      .from("checklists")
      .select("id, nome_checklist")
      .eq("id", checklistId)
      .eq("cliente_id", auth.cliente.cliente_id)
      .maybeSingle();
    if (!ownCk) {
      return NextResponse.json(
        { error: "Progetto non valido per questo cliente" },
        { status: 403 }
      );
    }
    progettoNome = String((ownCk as any).nome_checklist || "").trim() || null;
    if (impiantoId) {
      const { data: ownImp } = await auth.adminClient
        .from("checklist_impianti")
        .select("id, impianto_codice, impianto_descrizione, tipo_impianto, dimensioni")
        .eq("id", impiantoId)
        .eq("checklist_id", checklistId)
        .maybeSingle();
      if (!ownImp) {
        return NextResponse.json(
          { error: "Impianto non valido per il progetto" },
          { status: 400 }
        );
      }
      // Decisione f: valorizza la stringa `impianto` col nome/seriale risolto (stessa colonna).
      const imp = ownImp as any;
      const nomeImp =
        [imp.impianto_descrizione, imp.tipo_impianto, imp.dimensioni].filter(Boolean).join(" — ") ||
        "Impianto LED";
      const serImp = String(imp.impianto_codice || "").trim();
      impianto = (serImp ? `${nomeImp} [${serImp}]` : nomeImp).slice(0, 300);
    }
  } else if (impiantoId) {
    // impiantoId senza progetto non è validabile → richiedi il progetto.
    return NextResponse.json(
      { error: "Specificare il progetto dell'impianto" },
      { status: 400 }
    );
  }

  try {
    // P2.2.2: tier PER-PROGETTO se checklistId valido; altrimenti fallback legacy invariato.
    let tierToSave: string;
    let premiumAttivo = false;
    let premiumOrigine: string | null = null;
    let tierSource: string;
    if (checklistId) {
      const prog = await computeSupportTierForProgetto(auth.adminClient, checklistId);
      tierToSave = prog.tier;
      premiumAttivo = prog.premiumClient.attivo;
      premiumOrigine = prog.premiumClient.origine;
      tierSource = prog.source;
    } else {
      const info = await computeSupportTierForCliente(auth.adminClient, auth.cliente.cliente_id);
      tierToSave = info.tier;
      premiumAttivo = !!info.whatsapp;
      premiumOrigine = premiumAttivo ? "cliente-level" : null;
      tierSource = "cliente-level";
    }

    // P4.3 — nessuna copertura attiva → la richiesta è un preventivo (autoritativo lato server).
    const noCoverage = tierToSave === "NESSUNA" || tierToSave === "expired";
    const tipoRichiesta = noCoverage ? "preventivo" : "assistenza";

    const { data: inserted, error: insertErr } = await auth.adminClient
      .from("assistenza_tickets")
      .insert({
        cliente_id: auth.cliente.cliente_id,
        checklist_id: checklistId,
        email: auth.cliente.email,
        tier: tierToSave,
        categoria,
        impianto,
        telefono,
        descrizione,
        stato: "aperto",
        // P4.1 — screening avanzato
        urgenza,
        accesso_quota: accessoQuota,
        referente_presente: referentePresente,
        dvr_dpi: dvrDpi,
        ricambio,
        // P4.3 — tipo richiesta
        tipo_richiesta: tipoRichiesta,
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
        subject: `[Ticket #${inserted.numero}]${tipoRichiesta === "preventivo" ? " [PREVENTIVO]" : ""}${urgenza === "alta" ? " [URGENZA ALTA]" : ""} ${CATEGORIA_LABEL[categoria]} — tier ${tierToSave.toUpperCase()} — urgenza ${urgenza} — ${auth.cliente.email}`,
        text: [
          `Nuovo ticket assistenza dall'area cliente.`,
          ``,
          `Numero: #${inserted.numero}`,
          `Cliente ID: ${auth.cliente.cliente_id}`,
          `Email cliente: ${auth.cliente.email}`,
          `Progetto: ${progettoNome || checklistId || "-"}`,
          `Tier: ${tierToSave}`,
          `Tier Source: ${tierSource}`,
          `Premium Client: ${premiumAttivo ? "SÌ" : "NO"}`,
          `Origine Premium Client: ${premiumOrigine || "-"}`,
          `Categoria: ${CATEGORIA_LABEL[categoria]}`,
          `Tipo richiesta: ${tipoRichiesta.toUpperCase()}`,
          `Urgenza: ${urgenza.toUpperCase()}`,
          `Ricambio/componente: ${ricambio || "-"}`,
          `Accesso in quota: ${accessoQuota ? "SÌ" : "no"} · Referente in loco: ${referentePresente ? "SÌ" : "no"} · DVR/DPI: ${dvrDpi ? "SÌ" : "no"}`,
          `Impianto: ${impianto || "-"}`,
          `Telefono: ${telefono || "-"}`,
          ...(tipoRichiesta === "preventivo"
            ? ["Richiesta PREVENTIVO — nessuna copertura attiva. Template consigliato: T7."]
            : []),
          ``,
          `Descrizione:`,
          descrizione,
        ].join("\n"),
        html: [
          `<p>Nuovo ticket assistenza dall'area cliente.</p>`,
          `<ul>`,
          `<li><strong>Numero:</strong> #${inserted.numero}</li>`,
          `<li><strong>Email cliente:</strong> ${auth.cliente.email}</li>`,
          `<li><strong>Progetto:</strong> ${progettoNome || checklistId || "-"}</li>`,
          `<li><strong>Tier:</strong> ${tierToSave}</li>`,
          `<li><strong>Tier Source:</strong> ${tierSource}</li>`,
          `<li><strong>Premium Client:</strong> ${premiumAttivo ? "SÌ" : "NO"}</li>`,
          `<li><strong>Origine Premium Client:</strong> ${premiumOrigine || "-"}</li>`,
          `<li><strong>Categoria:</strong> ${CATEGORIA_LABEL[categoria]}</li>`,
          `<li><strong>Tipo richiesta:</strong> ${tipoRichiesta.toUpperCase()}</li>`,
          `<li><strong>Urgenza:</strong> ${urgenza.toUpperCase()}</li>`,
          `<li><strong>Ricambio/componente:</strong> ${ricambio || "-"}</li>`,
          `<li><strong>Accesso in quota:</strong> ${accessoQuota ? "SÌ" : "no"} · <strong>Referente in loco:</strong> ${referentePresente ? "SÌ" : "no"} · <strong>DVR/DPI:</strong> ${dvrDpi ? "SÌ" : "no"}</li>`,
          `<li><strong>Impianto:</strong> ${impianto || "-"}</li>`,
          `<li><strong>Telefono:</strong> ${telefono || "-"}</li>`,
          `</ul>`,
          ...(tipoRichiesta === "preventivo"
            ? ["<p><strong>Richiesta PREVENTIVO</strong> — nessuna copertura attiva. Template consigliato: <strong>T7</strong>.</p>"]
            : []),
          `<p><strong>Descrizione:</strong></p>`,
          `<p>${descrizione.replace(/\n/g, "<br />")}</p>`,
        ].join(""),
      });
    } catch {
      // la notifica email non deve bloccare l'apertura del ticket
    }

    // P4.4 — sincronizzazione HubSpot (best-effort; no-op senza token, nessuna regressione)
    if (hubspotEnabled()) {
      try {
        await upsertTicket({
          atsystemId: String(inserted.id),
          subject: `[#${inserted.numero}]${tipoRichiesta === "preventivo" ? " [PREVENTIVO]" : ""}${urgenza === "alta" ? " [URGENZA ALTA]" : ""} ${CATEGORIA_LABEL[categoria]}`,
          content: descrizione,
          urgenza,
          categoria,
          tier: tierToSave,
          tipoRichiesta,
          impianto,
          ricambio,
          accessoSicurezza: `in quota: ${accessoQuota ? "sì" : "no"} · referente: ${referentePresente ? "sì" : "no"} · DVR/DPI: ${dvrDpi ? "sì" : "no"}`,
          stato: "aperto",
          email: auth.cliente.email,
          telefono,
        });
      } catch {
        // sync HubSpot best-effort: non blocca l'apertura del ticket
      }
    }

    return NextResponse.json({
      ok: true,
      ticket: {
        id: inserted.id,
        numero: inserted.numero,
        created_at: inserted.created_at,
        tier: tierToSave,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore apertura ticket" },
      { status: 500 }
    );
  }
}
