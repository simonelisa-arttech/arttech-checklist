export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SaasFilter = "EVENTS" | "ULTRA" | "PREMIUM" | "PLUS";
type ProjectStatus = "IN_CORSO" | "CONSEGNATO" | "RIENTRATO" | "SOSPESO" | "CHIUSO";

function normalizeProjectStatus(value?: string | null): ProjectStatus | null {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (raw === "IN_CORSO") return "IN_CORSO";
  if (raw === "CONSEGNATO") return "CONSEGNATO";
  if (raw === "RIENTRATO") return "RIENTRATO";
  if (raw === "SOSPESO") return "SOSPESO";
  if (raw === "CHIUSO") return "CHIUSO";
  return null;
}

function matchesSaasFilter(row: any, filter: SaasFilter) {
  const piano = String(row?.saas_piano || "")
    .trim()
    .toUpperCase();
  const tipo = String(row?.saas_tipo || "")
    .trim()
    .toUpperCase();
  const combined = `${piano} ${tipo}`;
  if (filter === "EVENTS") {
    return (
      combined.includes("SAAS-EVT") ||
      combined.includes("EVENT") ||
      combined.includes("ART TECH EVENT")
    );
  }
  if (filter === "ULTRA") return combined.includes("SAAS-UL");
  if (filter === "PREMIUM") return combined.includes("SAAS-PR");
  if (filter === "PLUS") return combined.includes("SAAS-PL");
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";
  const q = url.searchParams.get("q")?.trim() || "";
  const statuses = (url.searchParams.get("stati") || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean) as ProjectStatus[];
  const saasFilters = (url.searchParams.get("saas") || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean) as SaasFilter[];

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY", auth_mode: "service_role" },
      { status: 500 }
    );
  }

  const checklistFields = `
      id, cliente, cliente_id, nome_checklist, proforma, magazzino_importazione,
      created_by_operatore, updated_by_operatore,
      tipo_saas, saas_piano, saas_scadenza, saas_stato, saas_tipo, saas_note,
      m2_calcolati, m2_inclusi, m2_allocati,
      data_prevista, data_tassativa, tipo_impianto, impianto_indirizzo, impianto_codice, impianto_descrizione,
      dimensioni, impianto_quantita, numero_facce, passo, note, tipo_struttura,
      noleggio_vendita, fine_noleggio, mercato, modello, stato_progetto, data_installazione_reale,
      garanzia_stato, garanzia_scadenza, created_at, updated_at
    `;

  const baseSelect = `
      ${checklistFields},
      checklist_documents:checklist_documents (
        id,
        tipo,
        filename,
        storage_path,
        uploaded_at
      )
    `;

  const joinSelect = `
      ${checklistFields},
      clienti_anagrafica:cliente_id(denominazione),
      checklist_documents:checklist_documents (
        id,
        tipo,
        filename,
        storage_path,
        uploaded_at
      )
    `;

  let checklists: any[] | null = null;
  let checklistsErr: any = null;
  const joinRes = await supabaseAdmin
    .from("checklists")
    .select(joinSelect)
    .order("created_at", { ascending: false });
  if (joinRes.error) {
    const legacyRes = await supabaseAdmin
      .from("checklists")
      .select(baseSelect)
      .order("created_at", { ascending: false });
    checklists = legacyRes.data as any[] | null;
    checklistsErr = legacyRes.error;
  } else {
    checklists = joinRes.data as any[] | null;
  }

  if (checklistsErr) {
    return NextResponse.json(
      { error: checklistsErr.message, auth_mode: "service_role" },
      { status: 500 }
    );
  }

  let filteredChecklists = checklists || [];
  if (statuses.length > 0) {
    filteredChecklists = filteredChecklists.filter((c: any) => {
      const status = normalizeProjectStatus(c?.stato_progetto);
      return !!status && statuses.includes(status);
    });
  }
  if (saasFilters.length > 0) {
    filteredChecklists = filteredChecklists.filter((c: any) =>
      saasFilters.every((f) => matchesSaasFilter(c, f))
    );
  }
  if (q) {
    const needle = q.toLowerCase();
    filteredChecklists = filteredChecklists.filter((c: any) => {
      const hay = [
        c?.nome_checklist,
        c?.cliente,
        c?.impianto_codice,
        c?.impianto_descrizione,
        c?.passo,
        c?.tipo_impianto,
        c?.impianto_indirizzo,
        c?.dimensioni,
        c?.proforma,
        c?.magazzino_importazione,
        c?.saas_piano,
        c?.saas_scadenza,
        c?.saas_note,
        c?.stato_progetto,
        c?.created_at,
        c?.updated_at,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  const checklistIds = new Set(filteredChecklists.map((c: any) => String(c?.id || "")).filter(Boolean));

  const [{ data: sections }, { data: licenseSummary }, { data: licenses }, { data: serials }, { data: catalogItems }] =
    await Promise.all([
      supabaseAdmin
        .from("checklist_sections_view")
        .select("checklist_id, documenti, sezione_1, sezione_2, sezione_3, stato_complessivo, pct_complessivo"),
      supabaseAdmin
        .from("license_summary_view")
        .select("checklist_id, licenze_attive, licenze_prossima_scadenza, licenze_dettaglio"),
      supabaseAdmin
        .from("licenses")
        .select("id, checklist_id, tipo, scadenza, note, ref_univoco, telefono, intestatario, gestore, fornitore"),
      supabaseAdmin.from("asset_serials").select("checklist_id, seriale"),
      supabaseAdmin
        .from("catalog_items")
        .select("id, codice, descrizione, tipo, categoria, attivo")
        .eq("attivo", true)
        .order("descrizione", { ascending: true }),
    ]);

  const filterByChecklist = (rows: any[] | null | undefined) =>
    (rows || []).filter((r) => checklistIds.has(String(r?.checklist_id || "")));

  return NextResponse.json({
    ok: true,
    auth_mode: "service_role",
    debug: debug
      ? {
          auth_mode: "service_role",
          result_count: filteredChecklists.length,
        }
      : undefined,
    data: {
      checklists: filteredChecklists,
      sections: filterByChecklist(sections),
      licenseSummary: filterByChecklist(licenseSummary),
      licenses: filterByChecklist(licenses),
      serials: filterByChecklist(serials),
      catalogItems: catalogItems || [],
    },
  });
}
