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

type InterventoBillingRow = {
  id: string;
  checklist_id: string | null;
  data: string | null;
  data_tassativa?: string | null;
  descrizione: string | null;
  ticket_no?: string | null;
  esito_fatturazione: string | null;
  note_amministrazione?: string | null;
  checklist?: {
    id: string | null;
    cliente: string | null;
    nome_checklist: string | null;
  } | null;
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
  const url = new URL(request.url);
  const type = String(url.searchParams.get("type") || "progetti").trim().toLowerCase();

  if (type === "interventi") {
    let interventiRes: any = await auth.adminClient
      .from("saas_interventi")
      .select(
        "id, checklist_id, ticket_no, data, data_tassativa, descrizione, esito_fatturazione, note_amministrazione, checklist:checklists(id, cliente, nome_checklist)"
      )
      .eq("stato_intervento", "CHIUSO")
      .eq("esito_fatturazione", "DA_FATTURARE")
      .order("data_tassativa", { ascending: true, nullsFirst: false })
      .order("data", { ascending: true, nullsFirst: false });

    if (
      interventiRes.error &&
      String(interventiRes.error.message || "").toLowerCase().includes("note_amministrazione")
    ) {
      interventiRes = await auth.adminClient
        .from("saas_interventi")
        .select(
          "id, checklist_id, ticket_no, data, data_tassativa, descrizione, esito_fatturazione, checklist:checklists(id, cliente, nome_checklist)"
        )
        .eq("stato_intervento", "CHIUSO")
        .eq("esito_fatturazione", "DA_FATTURARE")
        .order("data_tassativa", { ascending: true, nullsFirst: false })
        .order("data", { ascending: true, nullsFirst: false });
      if (!interventiRes.error) {
        interventiRes.data = ((interventiRes.data || []) as any[]).map((row) => ({
          ...row,
          note_amministrazione: null,
        }));
      }
    }

    if (
      interventiRes.error &&
      String(interventiRes.error.message || "").toLowerCase().includes("data_tassativa")
    ) {
      interventiRes = await auth.adminClient
        .from("saas_interventi")
        .select(
          "id, checklist_id, ticket_no, data, descrizione, esito_fatturazione, note_amministrazione, checklist:checklists(id, cliente, nome_checklist)"
        )
        .eq("stato_intervento", "CHIUSO")
        .eq("esito_fatturazione", "DA_FATTURARE")
        .order("data", { ascending: true, nullsFirst: false });
      if (!interventiRes.error) {
        interventiRes.data = ((interventiRes.data || []) as any[]).map((row) => ({
          ...row,
          data_tassativa: null,
        }));
      }
    }

    if (
      interventiRes.error &&
      String(interventiRes.error.message || "").toLowerCase().includes("ticket_no")
    ) {
      interventiRes = await auth.adminClient
        .from("saas_interventi")
        .select(
          "id, checklist_id, data, data_tassativa, descrizione, esito_fatturazione, note_amministrazione, checklist:checklists(id, cliente, nome_checklist)"
        )
        .eq("stato_intervento", "CHIUSO")
        .eq("esito_fatturazione", "DA_FATTURARE")
        .order("data_tassativa", { ascending: true, nullsFirst: false })
        .order("data", { ascending: true, nullsFirst: false });
      if (!interventiRes.error) {
        interventiRes.data = ((interventiRes.data || []) as any[]).map((row) => ({
          ...row,
          ticket_no: null,
        }));
      }
    }

    if (interventiRes.error) {
      return NextResponse.json({ error: interventiRes.error.message }, { status: 500 });
    }

    const result = ((interventiRes.data || []) as InterventoBillingRow[])
      .map((row) => ({
        id: row.id,
        checklist_id: row.checklist?.id || row.checklist_id || null,
        cliente: row.checklist?.cliente || "—",
        progetto_nome: row.checklist?.nome_checklist || "—",
        descrizione: row.descrizione || "—",
        data_intervento: toIsoDay(row.data_tassativa) || toIsoDay(row.data),
        esito_fatturazione: row.esito_fatturazione || "DA_FATTURARE",
        note_amministrazione: row.note_amministrazione || null,
        ticket_no: row.ticket_no || null,
      }))
      .sort((a, b) => {
        const byDate = String(a.data_intervento || "").localeCompare(String(b.data_intervento || ""));
        if (byDate !== 0) return byDate;
        return `${a.cliente} ${a.progetto_nome} ${a.descrizione}`.localeCompare(
          `${b.cliente} ${b.progetto_nome} ${b.descrizione}`
        );
      });

    return NextResponse.json(result);
  }

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

export async function PATCH(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({} as any));
  const action = String(body?.action || "").trim().toLowerCase();
  const id = String(body?.id || "").trim();

  if (action !== "mark_fatturato" || !id) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await auth.adminClient
    .from("saas_interventi")
    .update({
      esito_fatturazione: "FATTURATO",
      fatturazione_stato: "FATTURATO",
      fatturato_il: nowIso,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, fatturato_il: nowIso });
}
