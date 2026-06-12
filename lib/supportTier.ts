import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Logica condivisa di determinazione del tier assistenza.
 * Stessa convenzione dell'endpoint pubblico /api/public/customer-lookup:
 *   1. saas_contratti cliente-wide attivi (PREMIUM/ULTRA/PLUS)
 *   2. rinnovi_servizi SAAS/RINNOVO attivi sui progetti
 *   3. saas_piano/saas_tipo della checklist con saas_scadenza attiva
 *   4. GARANZIA attiva → standard
 *   5. altrimenti → expired
 */
export type SupportTier = "expired" | "standard" | "plus" | "premium";

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
  if (combined.includes("SAAS-PR")) return "premium";
  if (combined.includes("SAAS-UL") || combined.includes("SAAS-PL")) return "plus";
  if (combined.trim().length > 0) return "plus";
  return null;
}

function tierFromContratto(piano_codice?: string | null): SupportTier | null {
  const p = String(piano_codice || "").toUpperCase();
  if (p.includes("PREMI")) return "premium";
  if (p.includes("ULTRA") || p.includes("UL")) return "plus";
  if (p.includes("PLUS") || p.includes("PL")) return "plus";
  if (p.length > 0) return "plus";
  return null;
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

  const [{ data: rinnovi }, { data: contratti }, { data: impiantiRows }] = await Promise.all([
    checklistIds.length
      ? db
          .from("rinnovi_servizi")
          .select("id, checklist_id, item_tipo, subtipo, scadenza")
          .in("checklist_id", checklistIds)
          .order("scadenza", { ascending: false })
      : Promise.resolve({ data: [] as any[] } as any),
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

  let tier: SupportTier = "expired";
  let saasExpiry: string | null = null;
  let saasLabel: string | null = null;
  let oreResidue: number | null = null;

  // 1. contratti cliente-wide
  const activeContratto = ((contratti || []) as any[]).find((c) => isDateActive(c.scadenza));
  if (activeContratto) {
    const t = tierFromContratto(activeContratto.piano_codice);
    if (t) {
      tier = t;
      saasExpiry = activeContratto.scadenza ?? null;
      saasLabel = tier === "premium" ? "Contratto Premium" : "Contratto Ultra";
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
      if (tf === "premium") {
        tier = "premium";
        saasLabel = "Contratto Premium";
      } else if (hasUltra || tf === "plus") {
        tier = "plus";
        saasLabel = "Contratto Plus/Ultra";
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
    if (t && isDateActive(primary.saas_scadenza)) {
      tier = t;
      saasExpiry = primary.saas_scadenza ?? null;
      saasLabel = t === "premium" ? "Contratto Premium" : "Contratto Plus/Ultra";
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
    whatsapp: tier === "premium" ? process.env.SUPPORT_PREMIUM_WHATSAPP || null : null,
    referente_tecnico: tier === "premium" ? process.env.SUPPORT_PREMIUM_REFERENTE || null : null,
    impianti,
  };
}
