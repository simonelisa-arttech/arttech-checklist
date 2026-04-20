export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getEffectiveProjectStatus, type RawProjectStatus } from "@/lib/projectStatus";

type SaasFilter = "EVENTS" | "ULTRA" | "PREMIUM" | "PLUS";
type ProjectStatus = RawProjectStatus;

function normalizeProjectStatus(value?: string | null): ProjectStatus | null {
  return getEffectiveProjectStatus({ stato_progetto: value });
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

  const checklistFieldsBase = `
      id, cliente, cliente_id, nome_checklist, proforma, po, magazzino_importazione,
      created_by_operatore, updated_by_operatore,
      tipo_saas, saas_piano, saas_scadenza, saas_stato, saas_tipo, saas_note,
      m2_calcolati, m2_inclusi, m2_allocati,
      data_prevista, data_tassativa, tipo_impianto, impianto_indirizzo, impianto_codice, impianto_descrizione,
      dimensioni, impianto_quantita, numero_facce, passo, note, tipo_struttura,
      noleggio_vendita, fine_noleggio, mercato, modello, stato_progetto, data_installazione_reale,
      garanzia_stato, garanzia_scadenza, created_at, updated_at
    `;
  let checklistFields = `
      ${checklistFieldsBase},
      data_disinstallazione
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
  let missingDataDisinstallazione = false;

  const loadChecklists = async (withJoin: boolean) => {
    const selectClause = withJoin
      ? `
      ${checklistFields},
      clienti_anagrafica:cliente_id(denominazione),
      checklist_documents:checklist_documents (
        id,
        tipo,
        filename,
        storage_path,
        uploaded_at
      )
    `
      : `
      ${checklistFields},
      checklist_documents:checklist_documents (
        id,
        tipo,
        filename,
        storage_path,
        uploaded_at
      )
    `;
    return supabaseAdmin.from("checklists").select(selectClause).order("created_at", { ascending: false });
  };

  let joinRes = await loadChecklists(true);
  if (joinRes.error && String(joinRes.error.message || "").toLowerCase().includes("data_disinstallazione")) {
    missingDataDisinstallazione = true;
    checklistFields = checklistFieldsBase;
    joinRes = await loadChecklists(true);
  }

  if (joinRes.error) {
    let legacyRes = await loadChecklists(false);
    if (legacyRes.error && String(legacyRes.error.message || "").toLowerCase().includes("data_disinstallazione")) {
      missingDataDisinstallazione = true;
      checklistFields = checklistFieldsBase;
      legacyRes = await loadChecklists(false);
    }
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
  if (missingDataDisinstallazione) {
    filteredChecklists = filteredChecklists.map((row: any) => ({ ...row, data_disinstallazione: null }));
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
        c?.po,
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

  const filteredSections = filterByChecklist(sections);
  const pctByChecklistId = new Map<string, number | null>();
  for (const row of filteredSections) {
    pctByChecklistId.set(String(row?.checklist_id || ""), row?.pct_complessivo ?? null);
  }

  filteredChecklists = filteredChecklists.map((row: any) => ({
    ...row,
    stato_progetto:
      getEffectiveProjectStatus({
        stato_progetto: row?.stato_progetto,
        pct_complessivo: pctByChecklistId.get(String(row?.id || "")) ?? null,
        noleggio_vendita: row?.noleggio_vendita,
        data_prevista: row?.data_prevista,
        fine_noleggio: row?.fine_noleggio,
        data_disinstallazione: row?.data_disinstallazione,
      }) || row?.stato_progetto || null,
  }));

  if (statuses.length > 0) {
    filteredChecklists = filteredChecklists.filter((c: any) => {
      const status = normalizeProjectStatus(c?.stato_progetto);
      return !!status && statuses.includes(status);
    });
  }

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
      sections: filteredSections,
      licenseSummary: filterByChecklist(licenseSummary),
      licenses: filterByChecklist(licenses),
      serials: filterByChecklist(serials),
      catalogItems: catalogItems || [],
    },
  });
}
