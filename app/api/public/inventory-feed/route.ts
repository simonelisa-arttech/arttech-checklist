export const runtime = "nodejs";

/**
 * GET /api/public/inventory-feed
 *
 * Feed pubblico degli impianti Art Tech destinati all'inventory (STEP 3).
 * Source of truth: ATSystem — tabella `checklist_impianti` (Supabase `aaiuyaiwdrecyqjgnjxp`).
 * Consumato in PULL/reconcile dalla Web Platform (AT Channel) e dai consumer mappa (Network/adledmarket).
 *
 * Contratto e regole: SPAZI PUBBLICITARI AT/_SYNC_ArtTech_ATSystem_Inventory.md (§STEP 3, D1-D10 chiuse).
 *
 * Espone SOLO impianti con `inventory_enabled = true` (publish flag = gate). Include qualsiasi
 * `inventory_status` (draft/coming_soon/live): la visibilità nelle mappe la decide la Web Platform.
 *
 * NON espone: documenti privati, dati cliente, ticket assistenza, proforma, PO, dati finanziari.
 * Idempotente: ogni chiamata restituisce lo stato completo corrente.
 * Auth: header `X-Feed-Key` deve corrispondere a env `INVENTORY_FEED_API_KEY` (se non settata → aperto, per dev).
 * availability_type/note/from/to (D10): colonne presenti su `checklist_impianti`
 *       (migration `add_impianto_availability_fields` applicata 02/07).
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Codici struttura ATSystem → etichetta umana per il feed
const STRUTTURA_LABELS: Record<string, string> = {
  "STR-PS": "Sport Perimeter",
  "STR-TTM": "Totem",
  "STR-TRUSS": "Truss",
  "STR-STRCT": "Struttura",
  "STR-MONO": "Monopalo",
  "STR-WALL": "Parete",
};

const COVER_BUCKET = "impianti-cover";

function strutturaLabel(code: string | null): string | null {
  const c = String(code || "").trim();
  if (!c) return null;
  return STRUTTURA_LABELS[c.toUpperCase()] || c;
}

function publicCoverUrl(supabaseUrl: string, storagePath: string | null): string | null {
  const path = String(storagePath || "").trim();
  if (!path) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${COVER_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export async function GET(request: Request) {
  // Auth leggera opzionale (feed pubblico ma protetto se la key è configurata)
  const feedKey = process.env.INVENTORY_FEED_API_KEY;
  if (feedKey) {
    const provided = request.headers.get("x-feed-key") || "";
    if (provided !== feedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  // 1) Impianti pubblicabili (publish flag = gate)
  const { data: impiantiData, error: impiantiErr } = await supabaseAdmin
    .from("checklist_impianti")
    .select(
      "id, checklist_id, screen_code, nome_impianto, impianto_indirizzo, lat, lng, dimensioni, passo, tipo_struttura, tipo_impianto, audience, inventory_status, inventory_synced_at, availability_type, availability_note, availability_from, availability_to"
    )
    .eq("inventory_enabled", true);

  if (impiantiErr) {
    return NextResponse.json({ error: impiantiErr.message }, { status: 500 });
  }

  const impianti = (impiantiData ?? []) as any[];
  const impiantoIds = impianti.map((r) => String(r.id)).filter(Boolean);

  // 2) Cover primaria per impianto (bucket pubblico impianti-cover)
  const coverByImpianto = new Map<string, string>();
  if (impiantoIds.length > 0) {
    const { data: coverData, error: coverErr } = await supabaseAdmin
      .from("attachments")
      .select("entity_id, storage_path, created_at")
      .eq("entity_type", "IMPIANTO_COVER")
      .in("entity_id", impiantoIds)
      .order("created_at", { ascending: true });
    if (!coverErr) {
      for (const row of (coverData ?? []) as any[]) {
        const eid = String(row?.entity_id || "");
        const sp = String(row?.storage_path || "").trim();
        if (eid && sp && !coverByImpianto.has(eid)) coverByImpianto.set(eid, sp);
      }
    }
    // Se attachments/cover non disponibili: preview_image_url resta null (non blocca il feed).
  }

  const items = impianti.map((r) => {
    const id = String(r.id);
    return {
      atsystem_impianto_id: id,
      checklist_id: r.checklist_id ? String(r.checklist_id) : null,
      screen_code: r.screen_code || null,
      nome: r.nome_impianto || null,
      indirizzo: r.impianto_indirizzo || null,
      lat: typeof r.lat === "number" ? r.lat : null,
      lng: typeof r.lng === "number" ? r.lng : null,
      dimensioni: r.dimensioni || null,
      pitch: r.passo || null,
      tipo_struttura: strutturaLabel(r.tipo_struttura),
      indoor_outdoor: r.tipo_impianto || null,
      audience: r.audience || null,
      inventory_status: r.inventory_status || "draft",
      // availability_* (D10) — colonne presenti su checklist_impianti
      availability_type: r.availability_type || null,
      availability_note: r.availability_note || null,
      availability_from: r.availability_from || null,
      availability_to: r.availability_to || null,
      preview_image_url: publicCoverUrl(supabaseUrl, coverByImpianto.get(id) || null),
      inventory_synced_at: r.inventory_synced_at || null,
      source: "atsystem",
    };
  });

  return NextResponse.json(
    {
      version: "1.0",
      generated_at: new Date().toISOString(),
      count: items.length,
      items,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "X-Feed-Key, Content-Type",
    },
  });
}
