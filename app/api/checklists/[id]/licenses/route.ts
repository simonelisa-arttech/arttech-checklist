export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const checklistId = String(params?.id || "").trim();
  if (!checklistId) {
    return NextResponse.json({ error: "Checklist id mancante" }, { status: 400 });
  }

  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.adminClient
    .from("licenses")
    .select(
      "id, checklist_id, tipo, scadenza, stato, note, intestata_a, ref_univoco, telefono, intestatario, gestore, fornitore, created_at"
    )
    .eq("checklist_id", checklistId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, licenses: data || [] });
}
