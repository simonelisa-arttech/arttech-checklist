/**
 * P5.5 — SLA prima risposta per priorità (soglie da calibrare, ore).
 * Usato dalla dashboard operatore per evidenziare i ticket "oltre SLA".
 */
import type { PrioritaTicket } from "@/lib/ticketPriorita";

export const PRIORITA_RANK: Record<string, number> = {
  alta: 4,
  media: 3,
  standard: 2,
  bassa: 1,
};

// Soglia di PRIMA RISPOSTA in ore (calendario, da calibrare con SLA contrattuali).
export const SLA_PRIMA_RISPOSTA_ORE: Record<PrioritaTicket, number> = {
  alta: 4,
  media: 8,
  standard: 24,
  bassa: 24,
};

export function slaPrimaRispostaOre(priorita?: string | null): number {
  const p = String(priorita || "bassa").toLowerCase() as PrioritaTicket;
  return SLA_PRIMA_RISPOSTA_ORE[p] ?? 24;
}

/** Ore trascorse tra due istanti ISO (o da created a ora). */
export function oreTrascorse(fromIso?: string | null, toIso?: string | null): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, (to - from) / 3_600_000);
}

/**
 * Un ticket è "oltre SLA" se non ha ancora avuto la prima risposta e il tempo
 * trascorso dall'apertura supera la soglia della sua priorità. Ticket chiusi/risolti
 * o già con prima risposta non sono in violazione.
 */
export function isOltreSla(input: {
  stato?: string | null;
  priorita?: string | null;
  created_at?: string | null;
  prima_risposta_at?: string | null;
}): boolean {
  if (input.prima_risposta_at) return false;
  const stato = String(input.stato || "").toLowerCase();
  if (stato === "risolto" || stato === "chiuso") return false;
  const att = oreTrascorse(input.created_at);
  if (att === null) return false;
  return att > slaPrimaRispostaOre(input.priorita);
}
