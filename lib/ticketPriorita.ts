/**
 * P5.2 — Priorità automatica del ticket in base al piano attivo del progetto.
 *
 * Mappatura (direttiva CEO, MAIN 16:51):
 *   CARE ULTRA        → alta
 *   CARE PLUS         → media
 *   Garanzia          → standard
 *   Nessuna/PREVENTIVO→ bassa
 *   ART TECH EVENT    → alta durante la finestra evento (≤7gg), media fuori
 *
 * `tier` arriva come stringa (ProgettoTier: GARANZIA|PLUS|ULTRA|EVENT|NESSUNA,
 * oppure SupportTier legacy: standard|plus|ultra|events|expired). Match case-insensitive.
 */

export type PrioritaTicket = "alta" | "media" | "standard" | "bassa";

export function prioritaDaTier(
  tier: string | null | undefined,
  tipoRichiesta?: string | null,
  opts?: { eventInWindow?: boolean }
): PrioritaTicket {
  // Fuori copertura / preventivo → bassa, a prescindere dal tier.
  if (String(tipoRichiesta || "").toLowerCase() === "preventivo") return "bassa";

  const t = String(tier || "").toUpperCase();
  if (t.includes("ULTRA")) return "alta";
  if (t.includes("EVENT")) {
    // Finestra evento non nota → trattiamo come alta (evento time-critical); media solo se
    // esplicitamente fuori finestra.
    return opts?.eventInWindow === false ? "media" : "alta";
  }
  if (t.includes("PLUS")) return "media";
  if (t.includes("GARANZIA") || t.includes("STANDARD")) return "standard";
  // NESSUNA / expired / sconosciuto → bassa
  return "bassa";
}
