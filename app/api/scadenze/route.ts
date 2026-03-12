export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { buildScadenzeAgenda } from "@/lib/scadenze/buildScadenzeAgenda";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  try {
    const rows = await buildScadenzeAgenda(auth.adminClient, {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      cliente: url.searchParams.get("cliente"),
      cliente_id: url.searchParams.get("cliente_id"),
      checklist_id: url.searchParams.get("checklist_id"),
      progetto: url.searchParams.get("progetto"),
      tipo: url.searchParams.get("tipo"),
      stato: url.searchParams.get("stato"),
    });

    return NextResponse.json({
      ok: true,
      count: rows.length,
      filters: {
        from: url.searchParams.get("from") || null,
        to: url.searchParams.get("to") || null,
        cliente: url.searchParams.get("cliente") || null,
        cliente_id: url.searchParams.get("cliente_id") || null,
        checklist_id: url.searchParams.get("checklist_id") || null,
        progetto: url.searchParams.get("progetto") || null,
        tipo: url.searchParams.get("tipo") || null,
        stato: url.searchParams.get("stato") || "TUTTI",
      },
      data: rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Errore caricamento agenda scadenze" },
      { status: 500 }
    );
  }
}
