export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

type AssociateSimBody = {
  sim_id?: string;
  checklist_id?: string;
};

type SimRow = {
  id: string;
  checklist_id: string | null;
  numero_telefono: string | null;
  intestatario: string | null;
  operatore: string | null;
  piano_attivo: string | null;
  device_installato: string | null;
  data_scadenza: string | null;
};

type ChecklistRow = {
  id: string;
  cliente: string | null;
};

type RinnovoRow = {
  id: string;
};

function normalizeString(value?: string | null) {
  return String(value || "").trim();
}

function buildRiferimento(sim: Pick<SimRow, "numero_telefono" | "intestatario">) {
  return normalizeString(sim.numero_telefono) || normalizeString(sim.intestatario) || "SIM";
}

function buildDescrizione(
  sim: Pick<SimRow, "operatore" | "piano_attivo" | "device_installato">
) {
  const parts = [sim.operatore, sim.piano_attivo, sim.device_installato]
    .map((value) => normalizeString(value))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export async function POST(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  let body: AssociateSimBody;
  try {
    body = (await request.json()) as AssociateSimBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const simId = normalizeString(body?.sim_id);
  const checklistId = normalizeString(body?.checklist_id);

  if (!simId) {
    return NextResponse.json({ error: "sim_id obbligatorio" }, { status: 400 });
  }
  if (!checklistId) {
    return NextResponse.json({ error: "checklist_id obbligatorio" }, { status: 400 });
  }

  const supabase = auth.adminClient;

  const { data: sim, error: simError } = await supabase
    .from("sim_cards")
    .select(
      "id, checklist_id, numero_telefono, intestatario, operatore, piano_attivo, device_installato, data_scadenza"
    )
    .eq("id", simId)
    .maybeSingle();

  if (simError) {
    return NextResponse.json({ error: simError.message }, { status: 500 });
  }
  if (!sim?.id) {
    return NextResponse.json({ error: "SIM non trovata" }, { status: 404 });
  }

  const { data: checklist, error: checklistError } = await supabase
    .from("checklists")
    .select("id, cliente")
    .eq("id", checklistId)
    .maybeSingle();

  if (checklistError) {
    return NextResponse.json({ error: checklistError.message }, { status: 500 });
  }
  if (!checklist?.id) {
    return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  }

  const cliente = normalizeString(checklist.cliente);
  if (!cliente) {
    return NextResponse.json(
      { error: "Il progetto selezionato non ha un cliente valido" },
      { status: 400 }
    );
  }

  const { data: updatedSim, error: updateSimError } = await supabase
    .from("sim_cards")
    .update({ checklist_id: checklistId })
    .eq("id", simId)
    .select(
      "id, checklist_id, numero_telefono, intestatario, operatore, piano_attivo, device_installato, data_scadenza"
    )
    .single();

  if (updateSimError || !updatedSim) {
    return NextResponse.json(
      { error: updateSimError?.message || "Errore aggiornamento SIM" },
      { status: 500 }
    );
  }

  const rinnovoPayload = {
    item_tipo: "SIM",
    sim_id: simId,
    checklist_id: checklistId,
    cliente,
    scadenza: updatedSim.data_scadenza || null,
    riferimento: buildRiferimento(updatedSim as SimRow),
    descrizione: buildDescrizione(updatedSim as SimRow),
  };

  const { data: existingRinnovo, error: existingRinnovoError } = await supabase
    .from("rinnovi_servizi")
    .select("id")
    .eq("item_tipo", "SIM")
    .eq("sim_id", simId)
    .maybeSingle();

  if (existingRinnovoError) {
    return NextResponse.json({ error: existingRinnovoError.message }, { status: 500 });
  }

  let rinnovo: Record<string, any> | null = null;

  const existingRinnovoId = String((existingRinnovo as RinnovoRow | null)?.id || "").trim();

  if (existingRinnovoId) {
    const { data, error } = await supabase
      .from("rinnovi_servizi")
      .update(rinnovoPayload)
      .eq("id", existingRinnovoId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Errore aggiornamento rinnovo SIM" },
        { status: 500 }
      );
    }
    rinnovo = data;
  } else {
    const { data, error } = await supabase
      .from("rinnovi_servizi")
      .insert({
        ...rinnovoPayload,
        stato: "DA_AVVISARE",
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Errore creazione rinnovo SIM" },
        { status: 500 }
      );
    }
    rinnovo = data;
  }

  return NextResponse.json({
    ok: true,
    sim: updatedSim,
    rinnovo,
  });
}
