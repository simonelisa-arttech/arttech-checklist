export const runtime = "nodejs";

/**
 * GET /api/public/customer-lookup?code=XXX
 *
 * Endpoint pubblico usato dal portale di supporto maxischermo.biz.
 * Identifica il tier di assistenza del cliente a partire da:
 *   - numero conferma d'ordine / proforma (es. "143/2026")
 *   - matricola / codice impianto su checklists o checklist_impianti
 *   - Partita IVA cliente (es. "09240270018") → clienti_anagrafica.piva
 *
 * Source of truth AT SYSTEM usate (sola lettura, nessuna duplicazione):
 *   - clienti_anagrafica     → anagrafica cliente (piva, denominazione)
 *   - checklists             → progetti / proforma / impianto_codice / saas_piano / garanzia_scadenza
 *   - checklist_impianti     → impianti per progetto (codice, descrizione)
 *   - rinnovi_servizi        → SAAS / GARANZIA attivi per checklist
 *   - saas_contratti         → contratti ULTRA/PREMIUM cliente-wide
 *
 * Auth: header X-Support-Key deve corrispondere a env SUPPORT_PORTAL_API_KEY.
 *       Se la variabile non è settata, l'endpoint è aperto (solo per sviluppo locale).
 * Rate limit: 30 req/min per IP.
 * CORS: restretto a ALLOWED_ORIGINS + www.maxischermo.biz.
 */

import { NextResponse } from "next/server";
import { isLifecycleAttivo, isMissingLifecycleStatusColumnError } from "@/lib/lifecycleStatus";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// ── Rate limit ───────────────────────────────────────────────────────────────
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
const PORTAL_ORIGINS = [
  "https://www.maxischermo.biz",
  "https://maxischermo.biz",
  "http://localhost:8000", // test locale portale
  "http://127.0.0.1:8000", // test locale portale
];

function getAllowedOrigins(): string[] {
  const env = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...PORTAL_ORIGINS, ...env];
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // curl / server-side: sempre ok
  return getAllowedOrigins().includes(origin);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowed = getAllowedOrigins().includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Support-Key, Content-Type",
    "Cache-Control": "no-store",
  };
}

// ── Tier ─────────────────────────────────────────────────────────────────────
// `premium` resta solo per compatibilità UI legacy / clienti storici:
// non deve mai degradare un ULTRA a PLUS.
export type SupportTier = "expired" | "standard" | "plus" | "premium" | "ultra" | "events";

const TIER_LABEL: Record<Exclude<SupportTier, "expired" | "standard">, string> = {
  plus: "Contratto Plus",
  premium: "Contratto Premium",
  ultra: "Contratto Ultra",
  events: "Pacchetto Events",
};

/**
 * Legge saas_piano + saas_tipo dalla checklist (campo libero impostato in AT System)
 * e mappa al tier.
 */
function tierFromChecklistSaas(saas_piano?: string | null, saas_tipo?: string | null): SupportTier | null {
  const combined = `${String(saas_piano || "")} ${String(saas_tipo || "")}`.toUpperCase();
  if (combined.includes("EVENT")) return "events";
  if (combined.includes("SAAS-UL") || combined.includes("ULTRA")) return "ultra";
  if (combined.includes("SAAS-PR") || combined.includes("PREMI")) return "premium";
  if (combined.includes("SAAS-PL") || combined.includes("PLUS")) return "plus";
  if (combined.trim().length > 0) return "plus";
  return null;
}

/**
 * Legge piano_codice da saas_contratti (contratto cliente-wide).
 */
function tierFromContratto(piano_codice?: string | null): SupportTier | null {
  const p = String(piano_codice || "").toUpperCase();
  if (p.includes("EVENT")) return "events";
  if (p.includes("ULTRA") || p.includes("UL")) return "ultra";
  if (p.includes("PREMI") || p.includes("PR")) return "premium";
  if (p.includes("PLUS") || p.includes("PL")) return "plus";
  if (p.length > 0) return "plus";
  return null;
}

function hasDirectContact(tier: SupportTier): boolean {
  return tier === "premium" || tier === "ultra" || tier === "events";
}

function isDateActive(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(23, 59, 59, 0); // scadenza = ultimo momento del giorno
  return d.getTime() >= Date.now();
}

function impiantoGarantiaStato(garanzia_scadenza?: string | null): "ok" | "warn" | "exp" {
  if (!garanzia_scadenza) return "exp";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(garanzia_scadenza));
  if (!m) return "exp";
  const exp = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  exp.setHours(23, 59, 59, 0);
  const now = Date.now();
  if (exp.getTime() < now) return "exp";
  const warn = new Date();
  warn.setDate(warn.getDate() + 60);
  warn.setHours(23, 59, 59, 0);
  if (exp <= warn) return "warn";
  return "ok";
}

// ── Handlers ─────────────────────────────────────────────────────────────────
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const cors = corsHeaders(request);

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin non consentito" }, { status: 403, headers: cors });
  }

  const apiKey = process.env.SUPPORT_PORTAL_API_KEY;
  if (apiKey) {
    const provided = String(request.headers.get("X-Support-Key") || "").trim();
    if (provided !== apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }
  }

  if (!checkRateLimit(getClientIp(request))) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra un minuto." },
      { status: 429, headers: cors }
    );
  }

  const rawCode = String(new URL(request.url).searchParams.get("code") || "").trim();
  if (!rawCode || rawCode.length < 3) {
    return NextResponse.json({ found: false, error: "Codice mancante o troppo corto" }, { status: 400, headers: cors });
  }

  const db = getSupabaseAdmin();

  // ── Chiavi selezionate dalle checklists ──────────────────────────────────
  const CHECKLIST_SELECT =
    "id, cliente, cliente_id, proforma, impianto_codice, impianto_descrizione, " +
    "garanzia_scadenza, garanzia_stato, saas_piano, saas_scadenza, saas_stato, saas_tipo, " +
    "nome_checklist, stato_progetto";

  let checklistRows: any[] | null = null;
  let matchedVia = "";

  // 1. per proforma (numero d'ordine / conferma)
  // Cerca in più varianti per coprire formati diversi nel DB:
  //   "143/2026"  →  esatto, oppure "%143/2026%", oppure "%143-2026%" (trattino)
  if (!checklistRows) {
    const proformaVariants = [
      rawCode,                              // esatto: "143/2026"
      `%${rawCode}%`,                       // contiene: "%143/2026%"
      `%${rawCode.replace(/\//g, "-")}%`,  // slash→trattino: "%143-2026%"
      `%${rawCode.replace(/-/g, "/")}%`,   // trattino→slash: "%143/2026%"
    ].filter((v, i, a) => a.indexOf(v) === i); // dedup

    for (const variant of proformaVariants) {
      const { data } = await db
        .from("checklists")
        .select(CHECKLIST_SELECT)
        .ilike("proforma", variant)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data?.length) { checklistRows = data; matchedVia = "proforma"; break; }
    }
  }

  // 2. per impianto_codice direttamente sulla checklist
  if (!checklistRows) {
    const { data } = await db
      .from("checklists")
      .select(CHECKLIST_SELECT)
      .ilike("impianto_codice", rawCode)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data?.length) { checklistRows = data; matchedVia = "impianto_codice"; }
  }

  // 3. per impianto_codice su checklist_impianti (singolo impianto nel progetto)
  if (!checklistRows) {
    const { data: impRows } = await db
      .from("checklist_impianti")
      .select("checklist_id")
      .ilike("impianto_codice", rawCode)
      .limit(10);
    if (impRows?.length) {
      const ids = [...new Set((impRows as any[]).map((r) => String(r.checklist_id || "")).filter(Boolean))];
      const { data } = await db
        .from("checklists")
        .select(CHECKLIST_SELECT)
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (data?.length) { checklistRows = data; matchedVia = "impianto_seriale"; }
    }
  }

  // 4. per Partita IVA → clienti_anagrafica → checklists
  if (!checklistRows) {
    const pivaClean = rawCode.replace(/\s/g, "");
    const { data: clienteRows } = await db
      .from("clienti_anagrafica")
      .select("id, denominazione, piva")
      .ilike("piva", pivaClean)
      .limit(3);
    if (clienteRows?.length) {
      const clienteIds = (clienteRows as any[]).map((r) => String(r.id || "")).filter(Boolean);
      const { data } = await db
        .from("checklists")
        .select(CHECKLIST_SELECT)
        .in("cliente_id", clienteIds)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data?.length) { checklistRows = data; matchedVia = "piva"; }
    }
  }

  if (!checklistRows?.length) {
    return NextResponse.json({ found: false }, { status: 200, headers: cors });
  }

  const checklists = (checklistRows || []) as any[];
  const primary = checklists[0] as any;
  const customerName = String(primary.cliente || "").trim();
  const clienteId = String(primary.cliente_id || "").trim();
  const checklistIds = checklists.map((r: any) => String(r.id || "")).filter(Boolean);

  // ── rinnovi_servizi ──────────────────────────────────────────────────────
  let rinnovi: any[] = [];
  const rinnoviWithLifecycle = await db
    .from("rinnovi_servizi")
    .select("id, checklist_id, item_tipo, subtipo, scadenza, lifecycle_status")
    .in("checklist_id", checklistIds)
    .order("scadenza", { ascending: false });
  if (!rinnoviWithLifecycle.error) {
    rinnovi = ((rinnoviWithLifecycle.data || []) as any[]).filter((row) =>
      isLifecycleAttivo(row?.lifecycle_status)
    );
  } else if (isMissingLifecycleStatusColumnError(rinnoviWithLifecycle.error)) {
    const fallback = await db
      .from("rinnovi_servizi")
      .select("id, checklist_id, item_tipo, subtipo, scadenza")
      .in("checklist_id", checklistIds)
      .order("scadenza", { ascending: false });
    if (fallback.data?.length) rinnovi = fallback.data as any[];
  }

  // ── saas_contratti cliente-wide ──────────────────────────────────────────
  // Nota: il campo FK su saas_contratti si chiama "cliente" (non "cliente_id")
  let contrattiRows: any[] = [];
  if (clienteId) {
    const { data: contratti } = await db
      .from("saas_contratti")
      .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati")
      .eq("cliente", clienteId)
      .order("scadenza", { ascending: false });
    if (contratti?.length) contrattiRows = contratti as any[];
  }

  // ── Impianti ─────────────────────────────────────────────────────────────
  const { data: impiantiRows } = await db
    .from("checklist_impianti")
    .select("id, checklist_id, impianto_codice, impianto_descrizione, dimensioni, passo, tipo_impianto")
    .in("checklist_id", checklistIds)
    .order("position", { ascending: true });

  // ── Determina tier ────────────────────────────────────────────────────────
  let tier: SupportTier = "expired";
  let saasExpiry: string | null = null;
  let saasLabel: string | null = null;
  let oreResidueContratto: number | null = null;

  // Priorità 1: saas_contratti cliente-wide attivi
  const activeContratto = (contrattiRows).find((c: any) => isDateActive(c.scadenza));
  if (activeContratto) {
    const t = tierFromContratto(activeContratto.piano_codice);
    if (t && t !== "expired" && t !== "standard") {
      tier = t;
      saasExpiry = activeContratto.scadenza ?? null;
      saasLabel = TIER_LABEL[t];
      if (typeof activeContratto.interventi_annui === "number" && !activeContratto.illimitati) {
        oreResidueContratto = activeContratto.interventi_annui;
      }
    }
  }

  // Priorità 2: rinnovi_servizi SAAS attivi sul progetto
  if (tier === "expired") {
    const activeSaas = ((rinnovi || []) as any[]).filter((r) => {
      const tipo = String(r.item_tipo || "").toUpperCase();
      return (tipo === "SAAS" || tipo === "RINNOVO") && isDateActive(r.scadenza);
    });
    if (activeSaas.length) {
      const hasUltra = activeSaas.some((r: any) => String(r.subtipo || "").toUpperCase() === "ULTRA");
      const tierFromFields = tierFromChecklistSaas(primary.saas_piano, primary.saas_tipo);
      if (hasUltra || tierFromFields === "ultra") {
        tier = "ultra";
        saasLabel = TIER_LABEL.ultra;
      } else if (tierFromFields === "events") {
        tier = "events";
        saasLabel = TIER_LABEL.events;
      } else if (tierFromFields === "premium") {
        tier = "premium";
        saasLabel = TIER_LABEL.premium;
      } else if (tierFromFields === "plus") {
        tier = "plus";
        saasLabel = TIER_LABEL.plus;
      } else {
        tier = "plus";
        saasLabel = "SaaS Attivo";
      }
      saasExpiry = activeSaas[0]?.scadenza ?? null;
    }
  }

  // Priorità 3: saas_piano/saas_tipo direttamente sulla checklist
  if (tier === "expired") {
    const t = tierFromChecklistSaas(primary.saas_piano, primary.saas_tipo);
    if (t && t !== "expired" && t !== "standard" && isDateActive(primary.saas_scadenza)) {
      tier = t;
      saasExpiry = primary.saas_scadenza ?? null;
      saasLabel = TIER_LABEL[t];
    }
  }

  // Priorità 4: GARANZIA attiva → standard
  if (tier === "expired") {
    const activeGaranzia = ((rinnovi || []) as any[]).find((r) => {
      return String(r.item_tipo || "").toUpperCase() === "GARANZIA" && isDateActive(r.scadenza);
    });
    const anyChecklistGaranzia = checklists.find((c) => isDateActive(c.garanzia_scadenza));
    if (activeGaranzia || anyChecklistGaranzia) {
      tier = "standard";
      saasLabel = "Garanzia Standard";
      saasExpiry = activeGaranzia?.scadenza ?? anyChecklistGaranzia?.garanzia_scadenza ?? null;
    }
  }

  // ── Lista impianti ────────────────────────────────────────────────────────
  const checklistById = new Map(checklists.map((c) => [String(c.id), c]));
  type ImpiantoOut = { nome: string; seriale: string | null; garanzia: string | null; stato: "ok" | "warn" | "exp" };
  const impianti: ImpiantoOut[] = [];

  if ((impiantiRows as any[])?.length) {
    for (const imp of impiantiRows as any[]) {
      const parent = checklistById.get(String(imp.checklist_id || "")) || {};
      const gScad = parent.garanzia_scadenza ?? null;
      const nome = [imp.impianto_descrizione, imp.tipo_impianto, imp.dimensioni]
        .filter(Boolean).join(" — ") || "Impianto LED";
      impianti.push({
        nome,
        seriale: String(imp.impianto_codice || "").trim() || null,
        garanzia: gScad,
        stato: impiantoGarantiaStato(gScad),
      });
    }
  } else {
    const gScad = primary.garanzia_scadenza ?? null;
    const nome = [primary.impianto_descrizione, primary.nome_checklist]
      .filter(Boolean).join(" — ") || "Impianto LED";
    impianti.push({
      nome,
      seriale: String(primary.impianto_codice || "").trim() || null,
      garanzia: gScad,
      stato: impiantoGarantiaStato(gScad),
    });
  }

  // ── Contatti premium da env ───────────────────────────────────────────────
  const whatsapp = hasDirectContact(tier)
    ? (process.env.SUPPORT_PREMIUM_WHATSAPP || null)
    : null;
  const referenteTecnico = hasDirectContact(tier)
    ? (process.env.SUPPORT_PREMIUM_REFERENTE || null)
    : null;

  return NextResponse.json(
    {
      found: true,
      customer_name: customerName,
      tier,
      saas_active: tier !== "expired",
      saas_expiry: saasExpiry,
      saas_type: saasLabel,
      ore_residue: oreResidueContratto,
      matched_via: matchedVia,
      whatsapp,
      referente_tecnico: referenteTecnico,
      impianti,
    },
    { status: 200, headers: cors }
  );
}
