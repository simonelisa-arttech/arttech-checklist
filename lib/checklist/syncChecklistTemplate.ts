type TemplateTaskRow = {
  id: string;
  sezione: string | number | null;
  ordine: number | null;
  titolo: string | null;
  target: string | null;
  attivo: boolean;
};

type ChecklistTaskRow = {
  id: string;
  checklist_id: string;
  task_template_id: string | null;
  titolo: string | null;
  sezione: number | null;
  ordine: number | null;
  target: string | null;
};

type SyncResult = {
  created: number;
  updated: number;
  linkedLegacy: number;
  preservedInactive: number;
};

function isMissingColumn(error: any, column: string) {
  return String(error?.message || "").toLowerCase().includes(column.toLowerCase());
}

export function normalizeChecklistTaskTarget(input: unknown) {
  const raw = String(input || "").trim().toUpperCase();
  if (!raw || raw === "ALTRO") return "GENERICA";
  if (raw === "TECNICO SW" || raw === "TECNICO-SW") return "TECNICO_SW";
  return raw;
}

export function inferChecklistTaskTarget(titolo?: string | null, target?: string | null) {
  const normalizedTarget = normalizeChecklistTaskTarget(target);
  if (normalizedTarget && normalizedTarget !== "GENERICA") return normalizedTarget;
  const titoloNorm = String(titolo || "").trim().toUpperCase();
  if (titoloNorm.includes("ELETTRONICA DI CONTROLLO: SCHEMI DATI ED ELETTRICI")) {
    return "TECNICO_SW";
  }
  if (
    titoloNorm.includes("PREPARAZIONE / RISERVA DISPONIBILIT") ||
    titoloNorm.includes("ORDINE MERCE")
  ) {
    return "MAGAZZINO";
  }
  return "GENERICA";
}

export function mapChecklistTaskSezioneToInt(raw: string | number | null | undefined) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (value.includes("DOCUMENTI")) return 0;
  if (value.includes("SEZIONE_1") || value.includes("SEZIONE1") || value.includes("SEZIONE_01")) {
    return 1;
  }
  if (value.includes("SEZIONE_2") || value.includes("SEZIONE2") || value.includes("SEZIONE_02")) {
    return 2;
  }
  if (value.includes("SEZIONE_3") || value.includes("SEZIONE3") || value.includes("SEZIONE_03")) {
    return 3;
  }
  if (value.includes("_1")) return 1;
  if (value.includes("_2")) return 2;
  if (value.includes("_3")) return 3;
  return 0;
}

function normalizeTemplateTitle(input: unknown) {
  return String(input || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function fetchAllChecklistIds(supabase: any) {
  const ids: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("checklists")
      .select("id")
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = (data || []) as Array<{ id: string | null }>;
    ids.push(...rows.map((row) => String(row.id || "")).filter(Boolean));
    if (rows.length < pageSize) break;
  }
  return ids;
}

async function fetchTemplateRows(
  supabase: any,
  options: { templateIds?: string[]; activeOnly?: boolean }
) {
  let query = supabase
    .from("checklist_task_templates")
    .select("id, sezione, ordine, titolo, target, attivo")
    .order("sezione", { ascending: true })
    .order("ordine", { ascending: true });

  if (options.templateIds?.length) {
    query = query.in("id", options.templateIds);
  }
  if (options.activeOnly) {
    query = query.eq("attivo", true);
  }

  let { data, error } = await query;
  if (error && isMissingColumn(error, "target")) {
    let fallback = supabase
      .from("checklist_task_templates")
      .select("id, sezione, ordine, titolo, attivo")
      .order("sezione", { ascending: true })
      .order("ordine", { ascending: true });
    if (options.templateIds?.length) fallback = fallback.in("id", options.templateIds);
    if (options.activeOnly) fallback = fallback.eq("attivo", true);
    const retry = await fallback;
    data = (retry.data || []).map((row: any) => ({ ...row, target: null }));
    error = retry.error;
  }
  if (error) throw error;

  return ((data || []) as any[]).map(
    (row) =>
      ({
        id: String(row.id),
        sezione: row.sezione ?? null,
        ordine: row.ordine == null ? null : Number(row.ordine),
        titolo: row.titolo ?? null,
        target: row.target ?? null,
        attivo: row.attivo !== false,
      }) satisfies TemplateTaskRow
  );
}

async function fetchChecklistTaskRows(supabase: any, checklistIds: string[]) {
  if (!checklistIds.length) return [] as ChecklistTaskRow[];
  const rows: ChecklistTaskRow[] = [];
  const chunkSize = 200;
  for (let index = 0; index < checklistIds.length; index += chunkSize) {
    const chunk = checklistIds.slice(index, index + chunkSize);
    let { data, error } = await supabase
      .from("checklist_tasks")
      .select("id, checklist_id, task_template_id, titolo, sezione, ordine, target")
      .in("checklist_id", chunk);
    if (error && isMissingColumn(error, "target")) {
      const retry = await supabase
        .from("checklist_tasks")
        .select("id, checklist_id, task_template_id, titolo, sezione, ordine")
        .in("checklist_id", chunk);
      data = (retry.data || []).map((row: any) => ({ ...row, target: null }));
      error = retry.error;
    }
    if (error && isMissingColumn(error, "task_template_id")) {
      const retry = await supabase
        .from("checklist_tasks")
        .select("id, checklist_id, titolo, sezione, ordine, target")
        .in("checklist_id", chunk);
      data = (retry.data || []).map((row: any) => ({ ...row, task_template_id: null }));
      error = retry.error;
    }
    if (error) throw error;
    rows.push(
      ...((data || []) as any[]).map(
        (row) =>
          ({
            id: String(row.id),
            checklist_id: String(row.checklist_id),
            task_template_id: row.task_template_id ? String(row.task_template_id) : null,
            titolo: row.titolo ?? null,
            sezione: row.sezione == null ? null : Number(row.sezione),
            ordine: row.ordine == null ? null : Number(row.ordine),
            target: row.target ?? null,
          }) satisfies ChecklistTaskRow
      )
    );
  }
  return rows;
}

async function updateChecklistTaskStructural(
  supabase: any,
  taskId: string,
  payload: Record<string, any>
) {
  let { error } = await supabase.from("checklist_tasks").update(payload).eq("id", taskId);
  if (error && isMissingColumn(error, "target")) {
    const { target: _ignore, ...fallbackPayload } = payload;
    ({ error } = await supabase.from("checklist_tasks").update(fallbackPayload).eq("id", taskId));
  }
  if (error && isMissingColumn(error, "task_template_id")) {
    const { task_template_id: _ignore, ...fallbackPayload } = payload;
    ({ error } = await supabase.from("checklist_tasks").update(fallbackPayload).eq("id", taskId));
  }
  if (error) throw error;
}

async function insertChecklistTasks(supabase: any, rows: Record<string, any>[]) {
  if (!rows.length) return;
  let { error } = await supabase.from("checklist_tasks").insert(rows);
  if (error && isMissingColumn(error, "target")) {
    const fallbackRows = rows.map(({ target: _ignore, ...row }) => row);
    ({ error } = await supabase.from("checklist_tasks").insert(fallbackRows));
  }
  if (error && isMissingColumn(error, "task_template_id")) {
    const fallbackRows = rows.map(({ task_template_id: _ignore, ...row }) => row);
    ({ error } = await supabase.from("checklist_tasks").insert(fallbackRows));
  }
  if (error) throw error;
}

function buildTemplatePayload(template: TemplateTaskRow) {
  return {
    task_template_id: template.id,
    sezione: mapChecklistTaskSezioneToInt(template.sezione),
    ordine: template.ordine == null ? null : Number(template.ordine),
    titolo: template.titolo?.trim() || null,
    target: inferChecklistTaskTarget(template.titolo, template.target),
  };
}

function needsStructuralUpdate(task: ChecklistTaskRow, template: TemplateTaskRow) {
  const next = buildTemplatePayload(template);
  return (
    String(task.task_template_id || "") !== String(template.id) ||
    Number(task.sezione ?? 0) !== Number(next.sezione) ||
    (task.ordine == null ? null : Number(task.ordine)) !== next.ordine ||
    (task.titolo?.trim() || null) !== next.titolo ||
    inferChecklistTaskTarget(task.titolo, task.target) !== next.target
  );
}

function findMatchingChecklistTask(tasks: ChecklistTaskRow[], template: TemplateTaskRow) {
  const byTemplateId =
    tasks.find((task) => String(task.task_template_id || "") === String(template.id)) || null;
  if (byTemplateId) return byTemplateId;

  const legacyTitle = normalizeTemplateTitle(template.titolo);
  const legacySezione = mapChecklistTaskSezioneToInt(template.sezione);
  const legacyOrdine = template.ordine == null ? null : Number(template.ordine);
  return (
    tasks.find((task) => {
      if (task.task_template_id) return false;
      return (
        normalizeTemplateTitle(task.titolo) === legacyTitle &&
        Number(task.sezione ?? 0) === legacySezione &&
        (task.ordine == null ? null : Number(task.ordine)) === legacyOrdine
      );
    }) || null
  );
}

async function syncTemplatesToChecklistIds(
  supabase: any,
  checklistIds: string[],
  templates: TemplateTaskRow[]
) {
  const existingTasks = await fetchChecklistTaskRows(supabase, checklistIds);
  const tasksByChecklistId = new Map<string, ChecklistTaskRow[]>();
  for (const row of existingTasks) {
    const bucket = tasksByChecklistId.get(row.checklist_id) || [];
    bucket.push(row);
    tasksByChecklistId.set(row.checklist_id, bucket);
  }

  const result: SyncResult = {
    created: 0,
    updated: 0,
    linkedLegacy: 0,
    preservedInactive: 0,
  };
  const inserts: Record<string, any>[] = [];

  for (const checklistId of checklistIds) {
    const checklistTasks = tasksByChecklistId.get(checklistId) || [];
    for (const template of templates) {
      const existing = findMatchingChecklistTask(checklistTasks, template);
      if (!template.attivo) {
        if (existing) result.preservedInactive += 1;
        continue;
      }

      if (existing) {
        if (needsStructuralUpdate(existing, template)) {
          await updateChecklistTaskStructural(supabase, existing.id, buildTemplatePayload(template));
          result.updated += 1;
        }
        if (!existing.task_template_id) result.linkedLegacy += 1;
        existing.task_template_id = template.id;
        existing.sezione = mapChecklistTaskSezioneToInt(template.sezione);
        existing.ordine = template.ordine == null ? null : Number(template.ordine);
        existing.titolo = template.titolo?.trim() || null;
        existing.target = inferChecklistTaskTarget(template.titolo, template.target);
        continue;
      }

      inserts.push({
        checklist_id: checklistId,
        ...buildTemplatePayload(template),
        stato: "DA_FARE",
      });
      checklistTasks.push({
        id: `pending:${checklistId}:${template.id}`,
        checklist_id: checklistId,
        ...buildTemplatePayload(template),
      });
      result.created += 1;
    }
  }

  const chunkSize = 500;
  for (let index = 0; index < inserts.length; index += chunkSize) {
    await insertChecklistTasks(supabase, inserts.slice(index, index + chunkSize));
  }

  return result;
}

export async function materializeChecklistTasks(supabase: any, checklistId: string) {
  const normalizedChecklistId = String(checklistId || "").trim();
  if (!normalizedChecklistId) {
    return { created: 0, updated: 0, linkedLegacy: 0, preservedInactive: 0 };
  }
  const templates = await fetchTemplateRows(supabase, { activeOnly: true });
  return syncTemplatesToChecklistIds(supabase, [normalizedChecklistId], templates);
}

export async function syncChecklistTemplate(supabase: any, templateId: string) {
  const normalizedTemplateId = String(templateId || "").trim();
  if (!normalizedTemplateId) {
    return { created: 0, updated: 0, linkedLegacy: 0, preservedInactive: 0 };
  }
  const templates = await fetchTemplateRows(supabase, {
    templateIds: [normalizedTemplateId],
    activeOnly: false,
  });
  if (!templates.length) {
    return { created: 0, updated: 0, linkedLegacy: 0, preservedInactive: 0 };
  }
  const checklistIds = await fetchAllChecklistIds(supabase);
  return syncTemplatesToChecklistIds(supabase, checklistIds, templates);
}

export async function syncAllChecklistTemplates(supabase: any) {
  const templates = await fetchTemplateRows(supabase, { activeOnly: false });
  const checklistIds = await fetchAllChecklistIds(supabase);
  return syncTemplatesToChecklistIds(supabase, checklistIds, templates);
}
