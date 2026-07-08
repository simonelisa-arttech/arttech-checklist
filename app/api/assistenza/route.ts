export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * P5.5 — Lista ticket per la dashboard operatore (staff).
 * GET /api/assistenza → tutti i ticket/richieste con progetto, tempo di attesa,
 * flag oltre-SLA, ordinati per priorità DESC + attesa DESC, + indicatori aggregati.
 */

import { NextResponse } from "next/server";
import { resolveOperatoreAuth } from "@/lib/operatoreAuth";
import { PRIORITA_RANK, oreTrascorse, isOltreSla } from "@/lib/ticketSla";

export async function GET(request: Request) {
  const auth = await resolveOperatoreAuth(request);
  if (!auth.ok) return auth.response;

  const { data: rows, error } = await auth.adminClient
    .from("assistenza_tickets")
    .select(
      "id, numero, cliente_id, checklist_id, email, tier, categoria, impianto, descrizione, stato, urgenza, tipo_richiesta, priorita, assegnatario_id, created_at, presa_in_carico_at, prima_risposta_at, risolto_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tickets = (rows || []) as Record<string, any>[];

  const ckIds = Array.from(
    new Set(tickets.map((t) => String(t.checklist_id || "")).filter(Boolean))
  );
  const progettoById = new Map<string, string>();
  if (ckIds.length) {
    const { data: cks } = await auth.adminClient
      .from("checklists")
      .select("id, nome_checklist")
      .in("id", ckIds);
    for (const c of (cks || []) as any[]) {
      progettoById.set(String(c.id), String(c.nome_checklist || "").trim());
    }
  }

  const opIds = Array.from(
    new Set(tickets.map((t) => String(t.assegnatario_id || "")).filter(Boolean))
  );
  const operatoreById = new Map<string, string>();
  if (opIds.length) {
    const { data: ops } = await auth.adminClient
      .from("operatori")
      .select("id, nome")
      .in("id", opIds);
    for (const o of (ops || []) as any[]) {
      operatoreById.set(String(o.id), String(o.nome || "").trim());
    }
  }

  const enriched = tickets.map((t) => {
    const oltreSla = isOltreSla(t);
    const attesaOre = oreTrascorse(t.created_at);
    return {
      ...t,
      progetto: progettoById.get(String(t.checklist_id || "")) || t.impianto || null,
      assegnatario_nome: operatoreById.get(String(t.assegnatario_id || "")) || null,
      attesa_ore: attesaOre === null ? null : Math.round(attesaOre * 10) / 10,
      oltre_sla: oltreSla,
    };
  });

  enriched.sort((a, b) => {
    const pr =
      (PRIORITA_RANK[String(b.priorita || "bassa")] || 0) -
      (PRIORITA_RANK[String(a.priorita || "bassa")] || 0);
    if (pr !== 0) return pr;
    return (b.attesa_ore || 0) - (a.attesa_ore || 0);
  });

  const aperti = enriched.filter((t) => t.stato !== "risolto" && t.stato !== "chiuso");
  const pending = aperti.filter((t) => !t.presa_in_carico_at).length;
  const oltreSlaCount = enriched.filter((t) => t.oltre_sla).length;
  const conRisposta = enriched.filter((t) => t.prima_risposta_at && t.created_at);
  const tempoMedioOre =
    conRisposta.length > 0
      ? Math.round(
          (conRisposta.reduce(
            (s, t) => s + (oreTrascorse(t.created_at, t.prima_risposta_at) || 0),
            0
          ) /
            conRisposta.length) *
            10
        ) / 10
      : null;

  return NextResponse.json({
    ok: true,
    indicatori: {
      totale: enriched.length,
      aperti: aperti.length,
      pending,
      oltre_sla: oltreSlaCount,
      tempo_medio_prima_risposta_ore: tempoMedioOre,
    },
    tickets: enriched,
  });
}
