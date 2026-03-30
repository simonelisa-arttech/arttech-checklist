export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const params = await context.params;
  const checklistId = String(params?.id || "").trim();
  if (!checklistId) {
    return NextResponse.json({ error: "Id checklist mancante" }, { status: 400 });
  }

  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.adminClient
    .from("checklists")
    .select("*, created_by_name, updated_by_name, created_by_operatore, updated_by_operatore")
    .eq("id", checklistId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Checklist non trovata", auth_mode: "service_role" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    auth_mode: "service_role",
    ...(debug ? { debug: { auth_mode: "service_role" } } : {}),
    data,
  });
}
