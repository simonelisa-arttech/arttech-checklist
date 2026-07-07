#!/usr/bin/env node
// P4.4 — Bootstrap delle 8 proprietà ticket custom "atsystem_*" su HubSpot.
// Idempotente: crea solo le proprietà mancanti. NON stampa il token.
//
// USO (dal terminale, il token resta nella TUA shell — non incollarlo in chat):
//   HUBSPOT_TOKEN=xxxxxxxx node scripts/hubspot-bootstrap-properties.mjs
// (accetta anche HUBSPOT_PRIVATE_APP_TOKEN). Richiede scope crm.schemas.tickets read+write.

const TOKEN = process.env.HUBSPOT_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN || "";
if (!TOKEN) {
  console.error("ERRORE: imposta HUBSPOT_TOKEN. Es: HUBSPOT_TOKEN=xxx node scripts/hubspot-bootstrap-properties.mjs");
  process.exit(1);
}
const BASE = "https://api.hubapi.com";
const GROUP = "ticketinformation";

// Tutte string/text: robusto e senza vincoli di enum (i valori arrivano già normalizzati da ATSystem).
const PROPS = [
  ["atsystem_ticket_id", "ATSystem Ticket ID"],
  ["atsystem_tier", "ATSystem Tier copertura"],
  ["atsystem_categoria", "ATSystem Categoria"],
  ["atsystem_tipo_richiesta", "ATSystem Tipo richiesta"],
  ["atsystem_urgenza", "ATSystem Urgenza"],
  ["atsystem_impianto", "ATSystem Impianto"],
  ["atsystem_ricambio", "ATSystem Ricambio"],
  ["atsystem_accesso_sicurezza", "ATSystem Accesso & sicurezza"],
];

async function hs(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  let created = 0, existing = 0, failed = 0;
  for (const [name, label] of PROPS) {
    const check = await hs(`/crm/v3/properties/tickets/${name}`);
    if (check.ok) { console.log(`= già presente: ${name}`); existing++; continue; }
    const r = await hs(`/crm/v3/properties/tickets`, {
      method: "POST",
      body: JSON.stringify({ name, label, type: "string", fieldType: "text", groupName: GROUP }),
    });
    if (r.ok) { console.log(`+ creata: ${name}`); created++; }
    else { console.error(`! errore su ${name} (HTTP ${r.status}): ${r.data?.message || r.data}`); failed++; }
  }
  console.log(`\nRisultato: create ${created}, già presenti ${existing}, errori ${failed}.`);
  if (failed > 0) process.exit(2);
}
main().catch((e) => { console.error(e); process.exit(1); });
