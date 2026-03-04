export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY", auth_mode: "service_role" },
      { status: 500 }
    );
  }

  const baseSelect = `
      *,
      checklist_documents:checklist_documents (
        id,
        tipo,
        filename,
        uploaded_at
      )
    `;

  const joinSelect = `
      *,
      clienti_anagrafica:cliente_id(denominazione),
      checklist_documents:checklist_documents (
        id,
        tipo,
        filename,
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

  const [{ data: sections }, { data: licenseSummary }, { data: licenses }, { data: serials }, { data: catalogItems }] =
    await Promise.all([
      supabaseAdmin.from("checklist_sections_view").select("*"),
      supabaseAdmin.from("license_summary_view").select("*"),
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

  return NextResponse.json({
    ok: true,
    auth_mode: "service_role",
    debug: debug ? { auth_mode: "service_role" } : undefined,
    data: {
      checklists: checklists || [],
      sections: sections || [],
      licenseSummary: licenseSummary || [],
      licenses: licenses || [],
      serials: serials || [],
      catalogItems: catalogItems || [],
    },
  });
}
