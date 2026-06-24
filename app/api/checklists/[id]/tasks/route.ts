export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";
import { materializeChecklistTasks } from "@/lib/checklist/syncChecklistTemplate";

type SelectTasksResult = { tasks?: any[]; error?: any };

async function selectChecklistTasks(
  adminClient: any,
  checklistId: string
): Promise<SelectTasksResult> {
  const res1 = await adminClient
    .from("checklist_tasks")
    .select(
      "id, sezione, ordine, titolo, stato, note, target, task_template_id, updated_at, updated_by_operatore, created_at, operatori:updated_by_operatore ( id, nome )"
    )
    .eq("checklist_id", checklistId)
    .order("ordine", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (res1.error && String(res1.error.message || "").toLowerCase().includes("target")) {
    const res2 = await adminClient
      .from("checklist_tasks")
      .select(
        "id, sezione, ordine, titolo, stato, note, task_template_id, updated_at, updated_by_operatore, created_at, operatori:updated_by_operatore ( id, nome )"
      )
      .eq("checklist_id", checklistId)
      .order("ordine", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (res2.error) return { error: res2.error };
    return { tasks: (res2.data ?? []).map((r: any) => ({ ...r, target: null })) };
  }

  if (res1.error) return { error: res1.error };
  return { tasks: res1.data ?? [] };
}

// Id dei template attivi. Ritorna null se la tabella manca o la query fallisce:
// in quel caso il self-heal "parziale" viene saltato (resta solo il caso 0 task).
async function fetchActiveTemplateIds(adminClient: any): Promise<string[] | null> {
  const res = await adminClient
    .from("checklist_task_templates")
    .select("id")
    .eq("attivo", true);
  if (res.error) return null;
  return (res.data ?? []).map((r: any) => String(r.id)).filter(Boolean);
}

// True se manca almeno un template attivo non ancora materializzato su questa checklist
// (materializzazione parziale, es. checklist con solo alcune task delle 4 sezioni).
function hasMissingActiveTemplate(
  tasks: any[],
  activeTemplateIds: string[] | null
): boolean {
  if (!activeTemplateIds || activeTemplateIds.length === 0) return false;
  const present = new Set(
    (tasks ?? [])
      .map((t) => (t?.task_template_id ? String(t.task_template_id) : ""))
      .filter(Boolean)
  );
  return activeTemplateIds.some((id) => !present.has(id));
}

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

  let result = await selectChecklistTasks(auth.adminClient, checklistId);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // Self-heal materializzazione (idempotente):
  //  - caso storico: checklist_tasks vuota (0 task)
  //  - caso esteso: materializzazione PARZIALE, mancano task per uno o più template attivi
  //    (es. checklist "Aeroporto Trapani" con 1 task su 54 → sezioni vuote).
  // materializeChecklistTasks abbina i task esistenti per task_template_id + match e crea solo i
  // mancanti: nessun duplicato, nessun uso di checklist_checks, progetti già completi non toccati.
  // Per le checklist vuote si evita la query extra sui template (short-circuit).
  let needsHeal = (result.tasks ?? []).length === 0;
  if (!needsHeal) {
    const activeTemplateIds = await fetchActiveTemplateIds(auth.adminClient);
    needsHeal = hasMissingActiveTemplate(result.tasks ?? [], activeTemplateIds);
  }

  if (needsHeal) {
    try {
      await materializeChecklistTasks(auth.adminClient, checklistId);
      const healed = await selectChecklistTasks(auth.adminClient, checklistId);
      if (!healed.error) {
        result = healed;
      }
    } catch (err) {
      // Se la materializzazione fallisce non rompiamo la pagina: restituiamo la lista corrente.
      console.error("[checklist tasks self-heal] materializzazione fallita", checklistId, err);
    }
  }

  return NextResponse.json({ ok: true, tasks: result.tasks ?? [] });
}
