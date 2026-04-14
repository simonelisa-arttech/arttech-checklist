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

  const baseSelect = [
    "id",
    "checklist_id",
    "tipo",
    "scadenza",
    "stato",
    "note",
    "intestata_a",
    "ref_univoco",
    "telefono",
    "intestatario",
    "gestore",
    "fornitore",
    "created_at",
  ];
  let selectColumns = [...baseSelect];
  let data: any[] | null = null;
  let error: any = null;

  while (selectColumns.length > 0) {
    const result = await auth.adminClient
      .from("licenses")
      .select(selectColumns.join(", "))
      .eq("checklist_id", checklistId)
      .order("created_at", { ascending: false });

    data = result.data;
    error = result.error;
    if (!error) break;

    const message = String(error.message || "").toLowerCase();
    const missingColumn = selectColumns.find(
      (column) => message.includes(column.toLowerCase()) && message.includes("does not exist")
    );
    if (!missingColumn) break;
    selectColumns = selectColumns.filter((column) => column !== missingColumn);
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).map((row) => ({
    id: row?.id ?? null,
    checklist_id: row?.checklist_id ?? null,
    tipo: row?.tipo ?? null,
    scadenza: row?.scadenza ?? null,
    stato: row?.stato ?? null,
    note: row?.note ?? null,
    intestata_a: row?.intestata_a ?? null,
    ref_univoco: row?.ref_univoco ?? null,
    telefono: row?.telefono ?? null,
    intestatario: row?.intestatario ?? null,
    gestore: row?.gestore ?? null,
    fornitore: row?.fornitore ?? null,
    created_at: row?.created_at ?? null,
  }));

  return NextResponse.json({ ok: true, licenses: rows });
}
