// P4.4 — Client HubSpot per la sincronizzazione ticket/contatti da ATSystem.
// Usa HUBSPOT_PRIVATE_APP_TOKEN (private app token o service key) come Bearer.
// NON-BLOCCANTE e sicuro: se il token manca, tutte le funzioni fanno no-op
// (fallback = flusso email-to-ticket esistente, nessuna regressione).

const BASE = "https://api.hubapi.com";
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN || "";
// Pipeline "Assistenza" reale = id "0"; sovrascrivibile via env.
const PIPELINE_ID = process.env.HUBSPOT_TICKET_PIPELINE_ID || "0";

export function hubspotEnabled(): boolean {
  return TOKEN.length > 0;
}

type HsResult = { ok: boolean; status: number; data: any };

async function hs(path: string, init?: RequestInit): Promise<HsResult> {
  if (!TOKEN) return { ok: false, status: 0, data: null };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ── Mappature ATSystem → HubSpot ──────────────────────────────────────────────
const URGENZA_TO_PRIORITY: Record<string, string> = { bassa: "LOW", media: "MEDIUM", alta: "HIGH" };
const STATO_TO_STAGE: Record<string, string> = {
  aperto: "1", // Nuovo
  in_lavorazione: "3", // In attesa di Help Desk
  in_attesa: "2", // In attesa risposta cliente
  chiuso: "4", // Chiuso
};
function categoriaToHs(categoria: string, tipoRichiesta: string): string {
  if (tipoRichiesta === "preventivo") return "BILLING_ISSUE";
  if (categoria === "other") return "GENERAL_INQUIRY";
  return "PRODUCT_ISSUE";
}

// ── Contatto ──────────────────────────────────────────────────────────────────
export async function upsertContact(email: string, phone?: string | null): Promise<string | null> {
  if (!hubspotEnabled() || !email) return null;
  const search = await hs(`/crm/v3/objects/contacts/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    }),
  });
  const existing = search.data?.results?.[0];
  if (existing?.id) {
    if (phone) {
      await hs(`/crm/v3/objects/contacts/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { phone } }),
      });
    }
    return String(existing.id);
  }
  const created = await hs(`/crm/v3/objects/contacts`, {
    method: "POST",
    body: JSON.stringify({ properties: { email, ...(phone ? { phone } : {}) } }),
  });
  return created.data?.id ? String(created.data.id) : null;
}

// ── Ticket ──────────────────────────────────────────────────────────────────
export type TicketSync = {
  atsystemId: string;
  subject: string;
  content: string;
  urgenza?: string | null;
  categoria?: string | null;
  tier?: string | null;
  tipoRichiesta?: string | null;
  impianto?: string | null;
  ricambio?: string | null;
  accessoSicurezza?: string | null;
  stato?: string | null;
  email?: string | null;
  telefono?: string | null;
};

export async function upsertTicket(t: TicketSync): Promise<string | null> {
  if (!hubspotEnabled()) return null;

  const contactId = t.email ? await upsertContact(t.email, t.telefono) : null;

  // Proprietà standard (esistono sempre in HubSpot)
  const core: Record<string, string> = {
    subject: t.subject,
    content: t.content,
    hs_pipeline: PIPELINE_ID,
    hs_pipeline_stage: STATO_TO_STAGE[String(t.stato || "aperto")] || "1",
    hs_ticket_priority: URGENZA_TO_PRIORITY[String(t.urgenza || "media")] || "MEDIUM",
    hs_ticket_category: categoriaToHs(String(t.categoria || "other"), String(t.tipoRichiesta || "assistenza")),
  };
  // Proprietà custom ATSystem (create dallo script di bootstrap)
  const full: Record<string, string> = {
    ...core,
    atsystem_ticket_id: t.atsystemId,
    atsystem_tier: String(t.tier || ""),
    atsystem_categoria: String(t.categoria || ""),
    atsystem_tipo_richiesta: String(t.tipoRichiesta || ""),
    atsystem_urgenza: String(t.urgenza || ""),
    atsystem_impianto: String(t.impianto || ""),
    atsystem_ricambio: String(t.ricambio || ""),
    atsystem_accesso_sicurezza: String(t.accessoSicurezza || ""),
  };

  const assoc = contactId
    ? { associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 16 }] }] }
    : {};

  // Idempotenza: cerca per atsystem_ticket_id (se la proprietà non esiste, la search fallisce → si crea).
  const search = await hs(`/crm/v3/objects/tickets/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "atsystem_ticket_id", operator: "EQ", value: t.atsystemId }] }],
      properties: ["hs_object_id"],
      limit: 1,
    }),
  });
  const existingId = search.data?.results?.[0]?.id ? String(search.data.results[0].id) : null;

  if (existingId) {
    let r = await hs(`/crm/v3/objects/tickets/${existingId}`, { method: "PATCH", body: JSON.stringify({ properties: full }) });
    if (!r.ok) r = await hs(`/crm/v3/objects/tickets/${existingId}`, { method: "PATCH", body: JSON.stringify({ properties: core }) });
    return existingId;
  }
  // Create: prova con proprietà complete; se fallisce (proprietà custom assenti) → fallback alle sole core.
  let r = await hs(`/crm/v3/objects/tickets`, { method: "POST", body: JSON.stringify({ properties: full, ...assoc }) });
  if (!r.ok) r = await hs(`/crm/v3/objects/tickets`, { method: "POST", body: JSON.stringify({ properties: core, ...assoc }) });
  return r.data?.id ? String(r.data.id) : null;
}
