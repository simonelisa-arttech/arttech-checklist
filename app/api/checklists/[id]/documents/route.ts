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

  const res1 = await auth.adminClient
    .from("checklist_documents")
    .select("*")
    .eq("checklist_id", checklistId)
    .order("created_at", { ascending: false });

  if (res1.error && String(res1.error.message || "").toLowerCase().includes("created_at")) {
    const res2 = await auth.adminClient
      .from("checklist_documents")
      .select("*")
      .eq("checklist_id", checklistId)
      .order("uploaded_at", { ascending: false });
    if (res2.error) {
      return NextResponse.json({ error: res2.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, documents: res2.data || [] });
  }

  if (res1.error) {
    return NextResponse.json({ error: res1.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, documents: res1.data || [] });
}
