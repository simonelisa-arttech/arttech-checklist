import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export const runtime = "nodejs";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  data_prevista: string | null;
  data_tassativa: string | null;
  data_installazione_reale: string | null;
  stato_progetto: string | null;
};

type TaskRow = {
  checklist_id: string | null;
  stato: string | null;
};

type SectionRow = {
  checklist_id: string | null;
  pct_complessivo: number | null;
};

function toIsoDay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function getInstallDate(row: ChecklistRow) {
  return (
    toIsoDay(row.data_installazione_reale) ||
    toIsoDay(row.data_tassativa) ||
    toIsoDay(row.data_prevista)
  );
}

function isCompletedTask(stato?: string | null) {
  const normalized = String(stato || "").trim().toUpperCase().replace(/\s+/g, "_");
  return normalized === "OK" || normalized === "NON_NECESSARIO";
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { data: checklists, error: checklistsErr } = await auth.adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, data_prevista, data_tassativa, data_installazione_reale, stato_progetto")
    .in("stato_progetto", ["IN_CORSO", "IN_LAVORAZIONE", "CONSEGNATO"]);

  if (checklistsErr) {
    return NextResponse.json({ error: checklistsErr.message }, { status: 500 });
  }

  const checklistRows = (checklists || []) as ChecklistRow[];
  const checklistIds = checklistRows.map((row) => row.id).filter(Boolean);
  if (checklistIds.length === 0) {
    return NextResponse.json([]);
  }

  const [{ data: tasks, error: tasksErr }, { data: sections, error: sectionsErr }] = await Promise.all([
    auth.adminClient
      .from("checklist_tasks")
      .select("checklist_id, stato")
      .in("checklist_id", checklistIds),
    auth.adminClient
      .from("checklist_sections_view")
      .select("checklist_id, pct_complessivo")
      .in("checklist_id", checklistIds),
  ]);

  if (tasksErr) {
    return NextResponse.json({ error: tasksErr.message }, { status: 500 });
  }
  if (sectionsErr) {
    return NextResponse.json({ error: sectionsErr.message }, { status: 500 });
  }

  const taskStats = new Map<string, { total: number; completed: number }>();
  for (const row of (tasks || []) as TaskRow[]) {
    const checklistId = String(row.checklist_id || "").trim();
    if (!checklistId) continue;
    const stats = taskStats.get(checklistId) || { total: 0, completed: 0 };
    stats.total += 1;
    if (isCompletedTask(row.stato)) stats.completed += 1;
    taskStats.set(checklistId, stats);
  }

  const pctByChecklistId = new Map<string, number>();
  for (const row of (sections || []) as SectionRow[]) {
    const checklistId = String(row.checklist_id || "").trim();
    if (!checklistId) continue;
    if (typeof row.pct_complessivo === "number" && Number.isFinite(row.pct_complessivo)) {
      pctByChecklistId.set(checklistId, row.pct_complessivo);
    }
  }

  const result = checklistRows
    .map((row) => {
      const installDate = getInstallDate(row);
      const stats = taskStats.get(row.id) || { total: 0, completed: 0 };
      const percentuale =
        pctByChecklistId.get(row.id) ??
        (stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0);
      return {
        id: row.id,
        nome_checklist: row.nome_checklist || "—",
        cliente: row.cliente || "—",
        data_installazione: installDate,
        percentuale_completamento: percentuale,
      };
    })
    .filter((row) => row.percentuale_completamento >= 100)
    .sort((a, b) => {
      const byDate = String(a.data_installazione || "").localeCompare(String(b.data_installazione || ""));
      if (byDate !== 0) return byDate;
      return `${a.cliente} ${a.nome_checklist}`.localeCompare(`${b.cliente} ${b.nome_checklist}`);
    });

  return NextResponse.json(result);
}
