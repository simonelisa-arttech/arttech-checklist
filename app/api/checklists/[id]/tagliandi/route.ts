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
    .from("tagliandi")
    .select("id, checklist_id, scadenza, stato, modalita, note, created_at")
    .eq("checklist_id", checklistId)
    .order("scadenza", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tagliandi: data || [] });
}
