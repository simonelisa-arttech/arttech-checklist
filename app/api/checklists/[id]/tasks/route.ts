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
    .from("checklist_tasks")
    .select(
      "id, sezione, ordine, titolo, stato, note, target, task_template_id, updated_at, updated_by_operatore, created_at, operatori:updated_by_operatore ( id, nome )"
    )
    .eq("checklist_id", checklistId)
    .order("ordine", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (res1.error && String(res1.error.message || "").toLowerCase().includes("target")) {
    const res2 = await auth.adminClient
      .from("checklist_tasks")
      .select(
        "id, sezione, ordine, titolo, stato, note, task_template_id, updated_at, updated_by_operatore, created_at, operatori:updated_by_operatore ( id, nome )"
      )
      .eq("checklist_id", checklistId)
      .order("ordine", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (res2.error) {
      return NextResponse.json({ error: res2.error.message }, { status: 500 });
    }

    const tasks = (res2.data ?? []).map((r: any) => ({ ...r, target: null }));
    return NextResponse.json({ ok: true, tasks });
  }

  if (res1.error) {
    return NextResponse.json({ error: res1.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tasks: res1.data ?? [] });
}
