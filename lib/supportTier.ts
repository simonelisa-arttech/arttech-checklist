import type { SupabaseClient } from "@supabase/supabase-js";
import { isLifecycleAttivo, isMissingLifecycleStatusColumnError } from "@/lib/lifecycleStatus";

/**
 * Logica condivisa di determinazione del tier assistenza.
 * Stessa convenzione dell'endpoint pubblico /api/public/customer-lookup:
 *   1. saas_contratti cliente-wide attivi (PLUS/PREMIUM/ULTRA/EVENTS)
 *   2. rinnovi_servizi SAAS/RINNOVO attivi sui progetti
 *   3. saas_piano/saas_tipo della checklist con saas_scadenza attiva
 *   4. GARANZIA attiva → standard
 *   5. altrimenti → expired
 *
 * Gerarchia pacchetti (da "Pacchetti SAAS Art Tech", Drive ufficiale):
 *   PLUS (base) < PREMIUM (SLA 4/8/12/24/36h) < ULTRA (top level, priorità assoluta)
 *   EVENTS = pacchetto dedicato eventi/noleggi ≤ 7gg, intervento on site entro 1h.
 */
export type SupportTier = "expired" | "standard" | "plus" | "premium" | "ultra" | "events";

export type SupportTierInfo = {
  tier: SupportTier;
  saas_active: boolean;
  saas_expiry: string | null;
  saas_type: string | null;
  ore_residue: number | null;
  whatsapp: string | null;
  referente_tecnico: string | null;
  impianti: Array<{
    nome: string;
    seriale: string | null;
    garanzia: string | null;
    stato: "ok" | "warn" | "exp";
    checklist_id: string | null;
    progetto_nome: string | null;
  }>;
};

function tierFromChecklistSaas(saas_piano?: string | null, saas_tipo?: string | null): SupportTier | null {
  const combined = `${String(saas_piano || "")} ${String(saas_tipo || "")}`.toUpperCase();
  if (combined.includes("EVENT")) return "events";
  if (combined.includes("SAAS-UL") || combined.includes("ULTRA")) return "ultra";
  if (combined.includes("SAAS-PR") || combined.includes("PREMI")) return "premium";
  if (combined.includes("SAAS-PL") || combined.includes("PLUS")) return "plus";
  if (combined.trim().length > 0) return "plus";
  return null;
}

function tierFromContratto(piano_codice?: string | null): SupportTier | null {
  const p = String(piano_codice || "").toUpperCase();
  if (p.includes("EVENT")) return "events";
  if (p.includes("ULTRA") || p.includes("UL")) return "ultra";
  if (p.includes("PREMI") || p.includes("PR")) return "premium";
  if (p.includes("PLUS") || p.includes("PL")) return "plus";
  if (p.length > 0) return "plus";
  return null;
}

const TIER_LABEL: Record<Exclude<SupportTier, "expired" | "standard">, string> = {
  plus: "Contratto Plus",
  premium: "Contratto Premium",
  ultra: "Contratto Ultra",
  events: "Pacchetto Events",
};

/** Tier con canale di contatto diretto (WhatsApp/telefono dedicato). */
function hasDirectContact(tier: SupportTier): boolean {
  return tier === "premium" || tier === "ultra" || tier === "events";
}

export function isDateActive(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(23, 59, 59, 0);
  return d.getTime() >= Date.now();
}

function impiantoGaranziaStato(garanzia_scadenza?: string | null): "ok" | "warn" | "exp" {
  if (!garanzia_scadenza) return "exp";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(garanzia_scadenza));
  if (!m) return "exp";
  const exp = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  exp.setHours(23, 59, 59, 0);
  if (exp.getTime() < Date.now()) return "exp";
  const warn = new Date();
  warn.setDate(warn.getDate() + 60);
  warn.setHours(23, 59, 59, 0);
  if (exp <= warn) return "warn";
  return "ok";
}

async function loadRinnoviForChecklistIds(db: SupabaseClient, checklistIds: string[]) {
  if (!checklistIds.length) return [] as Record<string, any>[];
  const withLifecycle = await db
    .from("rinnovi_servizi")
    .select("id, checklist_id, item_tipo, subtipo, scadenza, lifecycle_status")
    .in("checklist_id", checklistIds)
    .order("scadenza", { ascending: false });
  if (!withLifecycle.error) return ((withLifecycle.data || []) as Record<string, any>[]).filter((row) => isLifecycleAttivo(row.lifecycle_status));
  if (!isMissingLifecycleStatusColumnError(withLifecycle.error)) {
    throw withLifecycle.error;
  }
  const fallback = await db
    .from("rinnovi_servizi")
    .select("id, checklist_id, item_tipo, subtipo, scadenza")
    .in("checklist_id", checklistIds)
    .order("scadenza", { ascending: false });
  if (fallback.error) throw fallback.error;
  return (fallback.data || []) as Record<string, any>[];
}

async function loadRinnoviForChecklistId(db: SupabaseClient, checklistId: string) {
  const rows = await loadRinnoviForChecklistIds(db, checklistId ? [checklistId] : []);
  return rows.filter((row) => String(row.checklist_id || "") === checklistId);
}

export async function computeSupportTierForCliente(
  db: SupabaseClient,
  clienteId: string
): Promise<SupportTierInfo> {
  const empty: SupportTierInfo = {
    tier: "expired",
    saas_active: false,
    saas_expiry: null,
    saas_type: null,
    ore_residue: null,
    whatsapp: null,
    referente_tecnico: null,
    impianti: [],
  };
  if (!clienteId) return empty;

  const { data: checklistRows } = await db
    .from("checklists")
    .select(
      "id, cliente, nome_checklist, impianto_codice, impianto_descrizione, " +
        "garanzia_scadenza, saas_piano, saas_scadenza, saas_tipo"
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  const checklists = (checklistRows || []) as any[];
  const checklistIds = checklists.map((r) => String(r.id || "")).filter(Boolean);

  const [rinnoviRows, contrattiRes, impiantiRes] = await Promise.all([
    loadRinnoviForChecklistIds(db, checklistIds),
    db
      .from("saas_contratti")
      .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati")
      .eq("cliente", clienteId)
      .order("scadenza", { ascending: false }),
    checklistIds.length
      ? db
          .from("checklist_impianti")
          .select("id, checklist_id, impianto_codice, impianto_descrizione, dimensioni, passo, tipo_impianto")
          .in("checklist_id", checklistIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as any[] } as any),
  ]);
  const rinnovi = rinnoviRows;
  const contratti = contrattiRes.data;
  const impiantiRows = impiantiRes.data;

  let tier: SupportTier = "expired";
  let saasExpiry: string | null = null;
  let saasLabel: string | null = null;
  let oreResidue: number | null = null;

  // 1. contratti cliente-wide
  const activeContratto = ((contratti || []) as any[]).find((c) => isDateActive(c.scadenza));
  if (activeContratto) {
    const t = tierFromContratto(activeContratto.piano_codice);
    if (t && t !== "expired" && t !== "standard") {
      tier = t;
      saasExpiry = activeContratto.scadenza ?? null;
      saasLabel = TIER_LABEL[t];
      if (typeof activeContratto.interventi_annui === "number" && !activeContratto.illimitati) {
        oreResidue = activeContratto.interventi_annui;
      }
    }
  }

  const primary = checklists[0] || {};

  // 2. rinnovi SAAS attivi
  if (tier === "expired") {
    const activeSaas = ((rinnovi || []) as any[]).filter((r) => {
      const tipo = String(r.item_tipo || "").toUpperCase();
      return (tipo === "SAAS" || tipo === "RINNOVO") && isDateActive(r.scadenza);
    });
    if (activeSaas.length) {
      const hasUltra = activeSaas.some((r: any) => String(r.subtipo || "").toUpperCase() === "ULTRA");
      const tf = tierFromChecklistSaas(primary.saas_piano, primary.saas_tipo);
      if (hasUltra || tf === "ultra") {
        tier = "ultra";
        saasLabel = TIER_LABEL.ultra;
      } else if (tf === "events") {
        tier = "events";
        saasLabel = TIER_LABEL.events;
      } else if (tf === "premium") {
        tier = "premium";
        saasLabel = TIER_LABEL.premium;
      } else if (tf === "plus") {
        tier = "plus";
        saasLabel = TIER_LABEL.plus;
      } else {
        tier = "plus";
        saasLabel = "SaaS Attivo";
      }
      saasExpiry = activeSaas[0]?.scadenza ?? null;
    }
  }

  // 3. saas su checklist
  if (tier === "expired") {
    const t = tierFromChecklistSaas(primary.saas_piano, primary.saas_tipo);
    if (t && t !== "expired" && t !== "standard" && isDateActive(primary.saas_scadenza)) {
      tier = t;
      saasExpiry = primary.saas_scadenza ?? null;
      saasLabel = TIER_LABEL[t];
    }
  }

  // 4. garanzia → standard
  if (tier === "expired") {
    const activeGaranzia = ((rinnovi || []) as any[]).find(
      (r) => String(r.item_tipo || "").toUpperCase() === "GARANZIA" && isDateActive(r.scadenza)
    );
    const anyChecklistGaranzia = checklists.find((c) => isDateActive(c.garanzia_scadenza));
    if (activeGaranzia || anyChecklistGaranzia) {
      tier = "standard";
      saasLabel = "Garanzia Standard";
      saasExpiry = activeGaranzia?.scadenza ?? anyChecklistGaranzia?.garanzia_scadenza ?? null;
    }
  }

  // impianti
  const checklistById = new Map(checklists.map((c) => [String(c.id), c]));
  const impianti: SupportTierInfo["impianti"] = [];
  if ((impiantiRows as any[])?.length) {
    for (const imp of impiantiRows as any[]) {
      const parent = checklistById.get(String(imp.checklist_id || "")) || {};
      const gScad = parent.garanzia_scadenza ?? null;
      const nome =
        [imp.impianto_descrizione, imp.tipo_impianto, imp.dimensioni].filter(Boolean).join(" — ") ||
        "Impianto LED";
      impianti.push({
        nome,
        seriale: String(imp.impianto_codice || "").trim() || null,
        garanzia: gScad,
        stato: impiantoGaranziaStato(gScad),
        checklist_id: String(imp.checklist_id || "") || null,
        progetto_nome: String(parent.nome_checklist || parent.cliente || "").trim() || null,
      });
    }
  } else {
    for (const c of checklists) {
      const gScad = c.garanzia_scadenza ?? null;
      const nome =
        [c.impianto_descrizione, c.nome_checklist].filter(Boolean).join(" — ") || "Impianto LED";
      impianti.push({
        nome,
        seriale: String(c.impianto_codice || "").trim() || null,
        garanzia: gScad,
        stato: impiantoGaranziaStato(gScad),
        checklist_id: String(c.id || "") || null,
        progetto_nome: String(c.nome_checklist || "").trim() || null,
      });
    }
  }

  return {
    tier,
    saas_active: tier !== "expired",
    saas_expiry: saasExpiry,
    saas_type: saasLabel,
    ore_residue: oreResidue,
    whatsapp: hasDirectContact(tier) ? process.env.SUPPORT_PREMIUM_WHATSAPP || null : null,
    referente_tecnico: hasDirectContact(tier) ? process.env.SUPPORT_PREMIUM_REFERENTE || null : null,
    impianti,
  };
}

// =====================================================================================
// STEP 1 (ADDITIVO) — Determinazione del tier PER PROGETTO.
// Non modifica computeSupportTierForCliente né i consumatori esistenti.
// Modello ufficiale: Cliente → Progetto → Piano → Impianto.
// Tier prodotti: GARANZIA | PLUS | ULTRA | EVENT | NESSUNA (MAI "PREMIUM": CARE PREMIUM è legacy).
// Precedenza (decisione approvata): progetto-specifico (rinnovi_servizi/checklists) →
//   saas_contratti cliente-wide (fallback) → garanzia → nessuna.
// =====================================================================================

export type SupportTierProgettoTier = "GARANZIA" | "PLUS" | "ULTRA" | "EVENT" | "NESSUNA";

export type SupportTierSource =
  | "saas_contratti"
  | "rinnovi_servizi"
  | "checklists.saas"
  | "garanzia"
  | "none";

export type LegacyWarning = {
  code: "CARE_PREMIUM_DA_RIALLINEARE";
  message: string;
  progettoId: string;
  rawCode?: string;
};

export type PremiumClientInfo = {
  attivo: boolean;
  origine:
    | "contratto"
    | "incluso_ultra"
    | "incluso_event"
    | "incluso_noleggio"
    | "incluso_garanzia"
    | null;
  referente: string | null;
  whatsapp: string | null;
};

export type SlaInfo = { presaInCaricoOre: number | null; onsiteOre: number | null } | null;

export type InterventiInfo = {
  inclusiAnno: number | null;
  illimitati: boolean;
  usati: number | null;
  residui: number | null;
} | null;

export type ImpiantoTier = {
  id: string | null;
  nome: string;
  seriale: string | null;
  garanzia: string | null;
  stato: "ok" | "warn" | "exp";
  classificazione: "CRITICO" | "STRATEGICO" | "STANDARD" | null;
};

export type SupportTierProgetto = {
  progettoId: string;
  clienteId: string | null;
  contrattoId: string | null;
  tier: SupportTierProgettoTier;
  source: SupportTierSource;
  premiumClient: PremiumClientInfo;
  garanziaAttiva: boolean;
  supportoAttivo: boolean;
  supportoScaduto: boolean;
  scadenzaPiano: string | null;
  scadenzaGaranzia: string | null;
  sla: SlaInfo;
  interventi: InterventiInfo;
  impianti: ImpiantoTier[];
  legacy: { legacyNonValido: boolean; warnings: LegacyWarning[] };
};

export type SupportTierAggregatoCliente = {
  clienteId: string;
  progetti: SupportTierProgetto[];
  bestTier: SupportTierProgettoTier;
  premiumClientAttivo: boolean;
  haLegacyDaRiallineare: boolean;
};

type SupportRow = Record<string, any>;

export type ProgettoPreload = {
  checklist: SupportRow;
  rinnovi: SupportRow[];
  contratti: SupportRow[];
  impianti: SupportRow[];
};

const PROGETTO_TIER_RANK: Record<SupportTierProgettoTier, number> = {
  EVENT: 5,
  ULTRA: 4,
  PLUS: 3,
  GARANZIA: 2,
  NESSUNA: 1,
};

/** Mappa un codice piano al livello ufficiale. SAAS-PR* = legacy (mai un piano valido). */
function mappaCodiceProgetto(
  code?: string | null
): "PLUS" | "ULTRA" | "EVENT" | "LEGACY_PR" | null {
  const c = String(code || "").toUpperCase();
  if (!c.trim()) return null;
  if (c.includes("EVENT") || c.includes("SAAS-EVT")) return "EVENT";
  if (c.includes("SAAS-UL") || c.includes("ULTRA")) return "ULTRA";
  if (c.includes("SAAS-PR") || c.includes("PREMI")) return "LEGACY_PR";
  if (c.includes("SAAS-PL") || c.includes("PLUS")) return "PLUS";
  return "PLUS"; // SAAS attivo di livello non riconosciuto → almeno PLUS
}

/**
 * Determina il tier di copertura di un singolo progetto (= checklist_id).
 * Additiva: non altera computeSupportTierForCliente. Non produce mai CARE PREMIUM.
 */
export async function computeSupportTierForProgetto(
  db: SupabaseClient,
  progettoId: string,
  opts?: { preload?: ProgettoPreload }
): Promise<SupportTierProgetto> {
  const warnings: LegacyWarning[] = [];
  let legacyNonValido = false;
  const addLegacy = (rawCode?: string | null) => {
    legacyNonValido = true;
    warnings.push({
      code: "CARE_PREMIUM_DA_RIALLINEARE",
      message: "CARE PREMIUM legacy (codice SAAS-PR): da riallineare manualmente, mai usato come piano.",
      progettoId,
      rawCode: rawCode ? String(rawCode) : undefined,
    });
  };

  const base: SupportTierProgetto = {
    progettoId,
    clienteId: null,
    contrattoId: null,
    tier: "NESSUNA",
    source: "none",
    premiumClient: { attivo: false, origine: null, referente: null, whatsapp: null },
    garanziaAttiva: false,
    supportoAttivo: false,
    supportoScaduto: false,
    scadenzaPiano: null,
    scadenzaGaranzia: null,
    sla: null,
    interventi: null,
    impianti: [],
    legacy: { legacyNonValido: false, warnings: [] },
  };
  if (!progettoId) return base;

  let ck: SupportRow | null = opts?.preload?.checklist ?? null;
  let rinnovi: SupportRow[] = opts?.preload?.rinnovi ?? [];
  let contratti: SupportRow[] = opts?.preload?.contratti ?? [];
  let impianti: SupportRow[] = opts?.preload?.impianti ?? [];

  if (!opts?.preload) {
    const { data: ckRow } = await db
      .from("checklists")
      .select(
        "id, cliente, cliente_id, nome_checklist, impianto_codice, impianto_descrizione, " +
          "garanzia_scadenza, saas_piano, saas_scadenza, saas_tipo, noleggio_vendita"
      )
      .eq("id", progettoId)
      .maybeSingle();
    ck = (ckRow as SupportRow) || null;
    if (!ck) return base;
    const clienteIdLocal = String(ck.cliente_id || "");
    const [rs, ctr, imp] = await Promise.all([
      loadRinnoviForChecklistId(db, progettoId),
      clienteIdLocal
        ? db
            .from("saas_contratti")
            .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati")
            .eq("cliente", clienteIdLocal)
            .order("scadenza", { ascending: false })
        : Promise.resolve({ data: [] as SupportRow[] } as any),
      db
        .from("checklist_impianti")
        .select("id, checklist_id, impianto_codice, impianto_descrizione, dimensioni, passo, tipo_impianto")
        .eq("checklist_id", progettoId)
        .order("position", { ascending: true }),
    ]);
    rinnovi = (rs as SupportRow[]) || [];
    contratti = (ctr.data as SupportRow[]) || [];
    impianti = (imp.data as SupportRow[]) || [];
  }

  if (!ck) return base;
  const clienteId = String(ck.cliente_id || "") || null;

  let tier: SupportTierProgettoTier = "NESSUNA";
  let source: SupportTierSource = "none";
  let scadenzaPiano: string | null = null;
  let contrattoId: string | null = null;
  let interventi: InterventiInfo = null;

  const ckMap = mappaCodiceProgetto((ck.saas_piano as string) ?? (ck.saas_tipo as string));
  if (ckMap === "LEGACY_PR") addLegacy((ck.saas_piano as string) ?? (ck.saas_tipo as string));

  // (1) progetto-specifico: rinnovi_servizi SAAS attivo
  const activeSaasRinnovi = rinnovi.filter((r) => {
    const t = String(r.item_tipo || "").toUpperCase();
    return (t === "SAAS" || t === "RINNOVO") && isDateActive(r.scadenza as string);
  });
  if (tier === "NESSUNA" && activeSaasRinnovi.length) {
    const hasUltra = activeSaasRinnovi.some((r) => String(r.subtipo || "").toUpperCase() === "ULTRA");
    const lvl = hasUltra ? "ULTRA" : ckMap;
    if (lvl === "ULTRA" || lvl === "EVENT" || lvl === "PLUS") {
      tier = lvl;
      source = "rinnovi_servizi";
    } else if (lvl === "LEGACY_PR") {
      // warning già emesso; SAAS-PR non assegna un piano
    } else {
      tier = "PLUS"; // SAAS attivo di livello ignoto → almeno PLUS
      source = "rinnovi_servizi";
    }
    if (tier !== "NESSUNA") scadenzaPiano = (activeSaasRinnovi[0]?.scadenza as string) ?? null;
  }

  // (2) progetto-specifico: checklists.saas_piano attivo
  if (tier === "NESSUNA" && isDateActive(ck.saas_scadenza as string)) {
    if (ckMap === "ULTRA" || ckMap === "EVENT" || ckMap === "PLUS") {
      tier = ckMap;
      source = "checklists.saas";
      scadenzaPiano = (ck.saas_scadenza as string) ?? null;
    }
  }

  // (3) fallback cliente-wide: saas_contratti attivo
  const activeContratto = contratti.find((c) => isDateActive(c.scadenza as string));
  if (tier === "NESSUNA" && activeContratto) {
    const m = mappaCodiceProgetto(activeContratto.piano_codice as string);
    if (m === "LEGACY_PR") addLegacy(activeContratto.piano_codice as string);
    if (m === "ULTRA" || m === "EVENT" || m === "PLUS") {
      tier = m;
      source = "saas_contratti";
      contrattoId = String(activeContratto.id || "") || null;
      scadenzaPiano = (activeContratto.scadenza as string) ?? null;
    }
  }

  // interventi inclusi dal contratto cliente-wide attivo (best-effort)
  if (activeContratto && (tier === "PLUS" || tier === "ULTRA" || tier === "EVENT")) {
    interventi = {
      inclusiAnno:
        typeof activeContratto.interventi_annui === "number"
          ? (activeContratto.interventi_annui as number)
          : null,
      illimitati: !!activeContratto.illimitati,
      usati: null,
      residui: null,
    };
    if (!contrattoId) contrattoId = String(activeContratto.id || "") || null;
  }

  // (4) garanzia
  const garanziaRinnovo = rinnovi.find(
    (r) => String(r.item_tipo || "").toUpperCase() === "GARANZIA" && isDateActive(r.scadenza as string)
  );
  const scadenzaGaranzia =
    (garanziaRinnovo?.scadenza as string) ??
    (isDateActive(ck.garanzia_scadenza as string) ? (ck.garanzia_scadenza as string) : null) ??
    null;
  const garanziaAttiva = !!scadenzaGaranzia;
  if (tier === "NESSUNA" && garanziaAttiva) {
    tier = "GARANZIA";
    source = "garanzia";
  }

  // (5) PREMIUM CLIENT (derivato; mai un tier). Flag DB letti in modo difensivo (potrebbero non esistere).
  const noleggio = String(ck.noleggio_vendita || "").toUpperCase() === "NOLEGGIO";
  const flagContratto = activeContratto?.premium_client === true;
  const flagGaranzia = activeContratto?.premium_client_incluso_garanzia === true;
  let premiumOrigine: PremiumClientInfo["origine"] = null;
  if (flagContratto) premiumOrigine = "contratto";
  else if (tier === "ULTRA") premiumOrigine = "incluso_ultra";
  else if (tier === "EVENT") premiumOrigine = "incluso_event";
  else if (noleggio) premiumOrigine = "incluso_noleggio";
  else if (tier === "GARANZIA" && flagGaranzia) premiumOrigine = "incluso_garanzia";
  const premiumAttivo = premiumOrigine !== null;
  const premiumClient: PremiumClientInfo = {
    attivo: premiumAttivo,
    origine: premiumOrigine,
    referente: premiumAttivo ? process.env.SUPPORT_PREMIUM_REFERENTE || null : null,
    whatsapp: premiumAttivo ? process.env.SUPPORT_PREMIUM_WHATSAPP || null : null,
  };

  // (6) SLA (default null finché non esiste config_livelli_assistenza)
  const sla: SlaInfo =
    tier === "PLUS" || tier === "ULTRA" || tier === "EVENT"
      ? { presaInCaricoOre: null, onsiteOre: null }
      : null;

  // (7) impianti del progetto (ereditano la copertura)
  const gScad = (ck.garanzia_scadenza as string) ?? null;
  const impiantiTier: ImpiantoTier[] = [];
  if (impianti.length) {
    for (const imp of impianti) {
      const nome =
        [imp.impianto_descrizione, imp.tipo_impianto, imp.dimensioni].filter(Boolean).join(" — ") ||
        "Impianto LED";
      impiantiTier.push({
        id: String(imp.id || "") || null,
        nome,
        seriale: String(imp.impianto_codice || "").trim() || null,
        garanzia: gScad,
        stato: impiantoGaranziaStato(gScad),
        classificazione: (imp.classificazione as ImpiantoTier["classificazione"]) ?? null,
      });
    }
  } else {
    const nome =
      [ck.impianto_descrizione, ck.nome_checklist].filter(Boolean).join(" — ") || "Impianto LED";
    impiantiTier.push({
      id: null,
      nome,
      seriale: String(ck.impianto_codice || "").trim() || null,
      garanzia: gScad,
      stato: impiantoGaranziaStato(gScad),
      classificazione: null,
    });
  }

  const supportoAttivo = tier === "PLUS" || tier === "ULTRA" || tier === "EVENT";
  const hadSaasSignal =
    contratti.length > 0 ||
    rinnovi.some((r) => ["SAAS", "RINNOVO"].includes(String(r.item_tipo || "").toUpperCase())) ||
    !!ck.saas_piano;
  const supportoScaduto = !supportoAttivo && hadSaasSignal;

  return {
    progettoId,
    clienteId,
    contrattoId,
    tier,
    source,
    premiumClient,
    garanziaAttiva,
    supportoAttivo,
    supportoScaduto,
    scadenzaPiano,
    scadenzaGaranzia,
    sla,
    interventi,
    impianti: impiantiTier,
    legacy: { legacyNonValido, warnings },
  };
}

/**
 * Aggregatore cliente: mappa computeSupportTierForProgetto su tutti i progetti del cliente.
 * bestTier (decisione approvata): EVENT → ULTRA → PLUS → GARANZIA → NESSUNA.
 */
export async function computeSupportForCliente(
  db: SupabaseClient,
  clienteId: string
): Promise<SupportTierAggregatoCliente> {
  const empty: SupportTierAggregatoCliente = {
    clienteId,
    progetti: [],
    bestTier: "NESSUNA",
    premiumClientAttivo: false,
    haLegacyDaRiallineare: false,
  };
  if (!clienteId) return empty;

  const { data: ckRows } = await db
    .from("checklists")
    .select(
      "id, cliente, cliente_id, nome_checklist, impianto_codice, impianto_descrizione, " +
        "garanzia_scadenza, saas_piano, saas_scadenza, saas_tipo, noleggio_vendita"
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  const checklists = (ckRows as SupportRow[]) || [];
  if (!checklists.length) return empty;
  const ids = checklists.map((c) => String(c.id || "")).filter(Boolean);

  const [rs, ctr, imp] = await Promise.all([
    loadRinnoviForChecklistIds(db, ids),
    db
      .from("saas_contratti")
      .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati")
      .eq("cliente", clienteId)
      .order("scadenza", { ascending: false }),
    db
      .from("checklist_impianti")
      .select("id, checklist_id, impianto_codice, impianto_descrizione, dimensioni, passo, tipo_impianto")
      .in("checklist_id", ids)
      .order("position", { ascending: true }),
  ]);
  const rinnoviAll = (rs as SupportRow[]) || [];
  const contrattiAll = (ctr.data as SupportRow[]) || [];
  const impiantiAll = (imp.data as SupportRow[]) || [];

  const progetti: SupportTierProgetto[] = [];
  for (const ck of checklists) {
    const pid = String(ck.id || "");
    const preload: ProgettoPreload = {
      checklist: ck,
      rinnovi: rinnoviAll.filter((r) => String(r.checklist_id || "") === pid),
      contratti: contrattiAll,
      impianti: impiantiAll.filter((i) => String(i.checklist_id || "") === pid),
    };
    progetti.push(await computeSupportTierForProgetto(db, pid, { preload }));
  }

  let bestTier: SupportTierProgettoTier = "NESSUNA";
  for (const p of progetti) {
    if (PROGETTO_TIER_RANK[p.tier] > PROGETTO_TIER_RANK[bestTier]) bestTier = p.tier;
  }

  return {
    clienteId,
    progetti,
    bestTier,
    premiumClientAttivo: progetti.some((p) => p.premiumClient.attivo),
    haLegacyDaRiallineare: progetti.some((p) => p.legacy.legacyNonValido),
  };
}
