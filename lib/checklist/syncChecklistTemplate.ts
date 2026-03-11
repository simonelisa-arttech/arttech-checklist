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
  stato: string | null;
  note: string | null;
  updated_at: string | null;
};

type SyncResult = {
  created: number;
  updated: number;
  linkedLegacy: number;
  preservedInactive: number;
  reconciled: number;
  cleanedDuplicates: number;
};

type TaskOperationalStats = {
  attachments: number;
  documents: number;
  comments: number;
  hasMeta: boolean;
  jobs: number;
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
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const LEGACY_TITLE_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: "elettronica di controllo",
    aliases: ["elettronica di controllo", "elettronica di controllo: schemi dati ed elettrici"],
  },
  {
    canonical: "preparazione / riserva disponibilita / ordine merce",
    aliases: ["preparazione / riserva disponibilita / ordine merce"],
  },
];

function canonicalizeTaskTitle(input: unknown) {
  const normalized = normalizeTemplateTitle(input);
  for (const alias of LEGACY_TITLE_ALIASES) {
    if (alias.aliases.includes(normalized)) return alias.canonical;
  }
  return normalized;
}

function isRecoverableMissingRelationError(error: any, relation: string) {
  const msg = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return msg.includes(relation.toLowerCase()) || details.includes(relation.toLowerCase());
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
      .select("id, checklist_id, task_template_id, titolo, sezione, ordine, target, stato, note, updated_at")
      .in("checklist_id", chunk);
    if (error && isMissingColumn(error, "target")) {
      const retry = await supabase
        .from("checklist_tasks")
        .select("id, checklist_id, task_template_id, titolo, sezione, ordine, stato, note, updated_at")
        .in("checklist_id", chunk);
      data = (retry.data || []).map((row: any) => ({ ...row, target: null }));
      error = retry.error;
    }
    if (error && isMissingColumn(error, "task_template_id")) {
      const retry = await supabase
        .from("checklist_tasks")
        .select("id, checklist_id, titolo, sezione, ordine, target, stato, note, updated_at")
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
            stato: row.stato ?? null,
            note: row.note ?? null,
            updated_at: row.updated_at ?? null,
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

async function fetchTaskOperationalStats(supabase: any, taskIds: string[]) {
  const stats = new Map<string, TaskOperationalStats>();
  const ensure = (taskId: string) => {
    const existing = stats.get(taskId);
    if (existing) return existing;
    const next = { attachments: 0, documents: 0, comments: 0, hasMeta: false, jobs: 0 };
    stats.set(taskId, next);
    return next;
  };

  for (const taskId of taskIds) ensure(taskId);
  if (!taskIds.length) return stats;

  const chunkSize = 250;
  for (let index = 0; index < taskIds.length; index += chunkSize) {
    const chunk = taskIds.slice(index, index + chunkSize);

    const { data: attachments, error: attachmentsErr } = await supabase
      .from("attachments")
      .select("entity_id")
      .eq("entity_type", "CHECKLIST_TASK")
      .in("entity_id", chunk);
    if (!attachmentsErr) {
      for (const row of attachments || []) {
        const taskId = String((row as any)?.entity_id || "");
        if (!taskId) continue;
        ensure(taskId).attachments += 1;
      }
    } else if (!isRecoverableMissingRelationError(attachmentsErr, "attachments")) {
      throw attachmentsErr;
    }

    const { data: documents, error: documentsErr } = await supabase
      .from("checklist_task_documents")
      .select("task_id")
      .in("task_id", chunk);
    if (!documentsErr) {
      for (const row of documents || []) {
        const taskId = String((row as any)?.task_id || "");
        if (!taskId) continue;
        ensure(taskId).documents += 1;
      }
    } else if (!isRecoverableMissingRelationError(documentsErr, "checklist_task_documents")) {
      throw documentsErr;
    }

    const { data: comments, error: commentsErr } = await supabase
      .from("cronoprogramma_comments")
      .select("row_ref_id")
      .eq("row_kind", "CHECKLIST_TASK")
      .in("row_ref_id", chunk);
    if (!commentsErr) {
      for (const row of comments || []) {
        const taskId = String((row as any)?.row_ref_id || "");
        if (!taskId) continue;
        ensure(taskId).comments += 1;
      }
    } else if (!isRecoverableMissingRelationError(commentsErr, "cronoprogramma_comments")) {
      throw commentsErr;
    }

    const { data: metaRows, error: metaErr } = await supabase
      .from("cronoprogramma_meta")
      .select("row_ref_id")
      .eq("row_kind", "CHECKLIST_TASK")
      .in("row_ref_id", chunk);
    if (!metaErr) {
      for (const row of metaRows || []) {
        const taskId = String((row as any)?.row_ref_id || "");
        if (!taskId) continue;
        ensure(taskId).hasMeta = true;
      }
    } else if (!isRecoverableMissingRelationError(metaErr, "cronoprogramma_meta")) {
      throw metaErr;
    }

    const { data: jobs, error: jobsErr } = await supabase
      .from("notification_jobs")
      .select("task_id")
      .in("task_id", chunk);
    if (!jobsErr) {
      for (const row of jobs || []) {
        const taskId = String((row as any)?.task_id || "");
        if (!taskId) continue;
        ensure(taskId).jobs += 1;
      }
    } else if (!isRecoverableMissingRelationError(jobsErr, "notification_jobs")) {
      throw jobsErr;
    }
  }

  return stats;
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

function isLegacyTemplateMatch(task: ChecklistTaskRow, template: TemplateTaskRow) {
  const templateSezione = mapChecklistTaskSezioneToInt(template.sezione);
  const templateOrdine = template.ordine == null ? null : Number(template.ordine);
  const taskCanonicalTitle = canonicalizeTaskTitle(task.titolo);
  const templateCanonicalTitle = canonicalizeTaskTitle(template.titolo);
  if (taskCanonicalTitle && taskCanonicalTitle === templateCanonicalTitle) return true;

  if (task.task_template_id) return false;
  const exactLegacy =
    canonicalizeTaskTitle(task.titolo) === canonicalizeTaskTitle(template.titolo) &&
    Number(task.sezione ?? 0) === templateSezione &&
    (task.ordine == null ? null : Number(task.ordine)) === templateOrdine;
  if (exactLegacy) return true;

  return canonicalizeTaskTitle(task.titolo) === canonicalizeTaskTitle(template.titolo);
}

function getTaskOperationalScore(task: ChecklistTaskRow, stats: TaskOperationalStats | undefined) {
  const stato = String(task.stato || "").trim().toUpperCase();
  let score = 0;
  if (stato && stato !== "DA_FARE") score += 300;
  if (stats?.hasMeta) score += 120;
  score += (stats?.attachments || 0) * 40;
  score += (stats?.documents || 0) * 40;
  score += (stats?.comments || 0) * 40;
  score += (stats?.jobs || 0) * 20;
  if (task.updated_at) score += 10;
  return score;
}

function getTaskMatchScore(
  task: ChecklistTaskRow,
  template: TemplateTaskRow,
  stats: TaskOperationalStats | undefined
) {
  const templateSezione = mapChecklistTaskSezioneToInt(template.sezione);
  const templateOrdine = template.ordine == null ? null : Number(template.ordine);
  const templateTitle = canonicalizeTaskTitle(template.titolo);
  const taskTitle = canonicalizeTaskTitle(task.titolo);
  let score = getTaskOperationalScore(task, stats);

  if (String(task.task_template_id || "") === String(template.id)) score += 500;
  if (taskTitle === templateTitle) score += 350;
  if (
    taskTitle === templateTitle &&
    Number(task.sezione ?? 0) === templateSezione &&
    (task.ordine == null ? null : Number(task.ordine)) === templateOrdine
  ) {
    score += 250;
  }
  if (Number(task.sezione ?? 0) === templateSezione) score += 40;
  if ((task.ordine == null ? null : Number(task.ordine)) === templateOrdine) score += 20;
  if (inferChecklistTaskTarget(task.titolo, task.target) === inferChecklistTaskTarget(template.titolo, template.target)) {
    score += 30;
  }
  return score;
}

function findCandidateChecklistTasks(
  tasks: ChecklistTaskRow[],
  template: TemplateTaskRow,
  assignedTaskIds: Set<string>
) {
  return tasks.filter((task) => {
    if (assignedTaskIds.has(task.id)) return false;
    if (String(task.task_template_id || "") === String(template.id)) return true;
    return isLegacyTemplateMatch(task, template);
  });
}

function chooseCanonicalChecklistTask(
  tasks: ChecklistTaskRow[],
  template: TemplateTaskRow,
  statsByTaskId: Map<string, TaskOperationalStats>
) {
  return [...tasks].sort((left, right) => {
    const scoreDiff =
      getTaskMatchScore(right, template, statsByTaskId.get(right.id)) -
      getTaskMatchScore(left, template, statsByTaskId.get(left.id));
    if (scoreDiff !== 0) return scoreDiff;
    return String(left.id).localeCompare(String(right.id));
  })[0];
}

async function mergeChecklistTaskMeta(supabase: any, keepTaskId: string, dropTaskId: string) {
  const { data, error } = await supabase
    .from("cronoprogramma_meta")
    .select("row_ref_id, fatto, hidden, updated_at, updated_by_operatore, updated_by_nome")
    .eq("row_kind", "CHECKLIST_TASK")
    .in("row_ref_id", [keepTaskId, dropTaskId]);
  if (error) {
    if (isRecoverableMissingRelationError(error, "cronoprogramma_meta")) return;
    throw error;
  }
  const rows = (data || []) as any[];
  const keepRow = rows.find((row) => String(row.row_ref_id) === keepTaskId) || null;
  const dropRow = rows.find((row) => String(row.row_ref_id) === dropTaskId) || null;
  if (!dropRow) return;

  if (!keepRow) {
    const { error: updateErr } = await supabase
      .from("cronoprogramma_meta")
      .update({ row_ref_id: keepTaskId })
      .eq("row_kind", "CHECKLIST_TASK")
      .eq("row_ref_id", dropTaskId);
    if (updateErr && !isRecoverableMissingRelationError(updateErr, "cronoprogramma_meta")) throw updateErr;
    return;
  }

  const mergedPayload: Record<string, any> = {};
  if (keepRow.fatto !== true && dropRow.fatto === true) mergedPayload.fatto = true;
  if (keepRow.hidden !== true && dropRow.hidden === true) mergedPayload.hidden = true;
  if (!keepRow.updated_at && dropRow.updated_at) {
    mergedPayload.updated_at = dropRow.updated_at;
    mergedPayload.updated_by_operatore = dropRow.updated_by_operatore ?? null;
    mergedPayload.updated_by_nome = dropRow.updated_by_nome ?? null;
  }

  if (Object.keys(mergedPayload).length > 0) {
    const { error: mergeErr } = await supabase
      .from("cronoprogramma_meta")
      .update(mergedPayload)
      .eq("row_kind", "CHECKLIST_TASK")
      .eq("row_ref_id", keepTaskId);
    if (mergeErr && !isRecoverableMissingRelationError(mergeErr, "cronoprogramma_meta")) throw mergeErr;
  }

  const { error: deleteErr } = await supabase
    .from("cronoprogramma_meta")
    .delete()
    .eq("row_kind", "CHECKLIST_TASK")
    .eq("row_ref_id", dropTaskId);
  if (deleteErr && !isRecoverableMissingRelationError(deleteErr, "cronoprogramma_meta")) throw deleteErr;
}

async function mergeChecklistTaskData(supabase: any, keepTaskId: string, dropTaskId: string) {
  const { data: pairRows, error: pairErr } = await supabase
    .from("checklist_tasks")
    .select("id, stato, note, updated_at")
    .in("id", [keepTaskId, dropTaskId]);
  if (pairErr) throw pairErr;
  const keepRow = (pairRows || []).find((row: any) => String(row.id) === keepTaskId) as any;
  const dropRow = (pairRows || []).find((row: any) => String(row.id) === dropTaskId) as any;

  if (keepRow && dropRow) {
    const keepStato = String(keepRow.stato || "").trim().toUpperCase();
    const dropStato = String(dropRow.stato || "").trim().toUpperCase();
    const mergedNote = [String(keepRow.note || "").trim(), String(dropRow.note || "").trim()]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join("\n\n");

    const updatePayload: Record<string, any> = {};
    if (keepStato === "DA_FARE" && dropStato && dropStato !== "DA_FARE") {
      updatePayload.stato = dropRow.stato;
    }
    if (mergedNote && mergedNote !== String(keepRow.note || "").trim()) {
      updatePayload.note = mergedNote;
    }
    if (Object.keys(updatePayload).length > 0) {
      const { error: taskMergeErr } = await supabase
        .from("checklist_tasks")
        .update(updatePayload)
        .eq("id", keepTaskId);
      if (taskMergeErr) throw taskMergeErr;
    }
  }

  const moveConfigs = [
    { table: "attachments", match: { entity_type: "CHECKLIST_TASK", entity_id: dropTaskId }, update: { entity_id: keepTaskId } },
    { table: "checklist_task_documents", match: { task_id: dropTaskId }, update: { task_id: keepTaskId } },
    { table: "cronoprogramma_comments", match: { row_kind: "CHECKLIST_TASK", row_ref_id: dropTaskId }, update: { row_ref_id: keepTaskId } },
  ];

  for (const config of moveConfigs) {
    let query = supabase.from(config.table).update(config.update);
    for (const [key, value] of Object.entries(config.match)) {
      query = query.eq(key, value as any);
    }
    const { error } = await query;
    if (error && !isRecoverableMissingRelationError(error, config.table)) throw error;
  }

  await mergeChecklistTaskMeta(supabase, keepTaskId, dropTaskId);

  const { error: jobsErr } = await supabase
    .from("notification_jobs")
    .update({ task_id: keepTaskId })
    .eq("task_id", dropTaskId);
  if (jobsErr) {
    if (String((jobsErr as any)?.code || "") === "23505") {
      const { error: deleteJobsErr } = await supabase
        .from("notification_jobs")
        .delete()
        .eq("task_id", dropTaskId);
      if (deleteJobsErr && !isRecoverableMissingRelationError(deleteJobsErr, "notification_jobs")) {
        throw deleteJobsErr;
      }
    } else if (!isRecoverableMissingRelationError(jobsErr, "notification_jobs")) {
      throw jobsErr;
    }
  }

  const { error: deleteTaskErr } = await supabase.from("checklist_tasks").delete().eq("id", dropTaskId);
  if (deleteTaskErr) throw deleteTaskErr;
}

async function syncTemplatesToChecklistIds(
  supabase: any,
  checklistIds: string[],
  templates: TemplateTaskRow[]
) {
  const existingTasks = await fetchChecklistTaskRows(supabase, checklistIds);
  const statsByTaskId = await fetchTaskOperationalStats(
    supabase,
    existingTasks.map((task) => task.id)
  );
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
    reconciled: 0,
    cleanedDuplicates: 0,
  };
  const inserts: Record<string, any>[] = [];

  for (const checklistId of checklistIds) {
    const checklistTasks = tasksByChecklistId.get(checklistId) || [];
    const assignedTaskIds = new Set<string>();
    for (const template of templates) {
      const candidates = findCandidateChecklistTasks(checklistTasks, template, assignedTaskIds);
      const existing =
        candidates.length > 0
          ? chooseCanonicalChecklistTask(candidates, template, statsByTaskId)
          : null;
      if (!template.attivo) {
        if (existing) {
          result.preservedInactive += 1;
          assignedTaskIds.add(existing.id);
        }
        continue;
      }

      if (existing) {
        assignedTaskIds.add(existing.id);
        if (needsStructuralUpdate(existing, template)) {
          await updateChecklistTaskStructural(supabase, existing.id, buildTemplatePayload(template));
          result.updated += 1;
        }
        if (!existing.task_template_id) {
          result.linkedLegacy += 1;
          result.reconciled += 1;
        }
        existing.task_template_id = template.id;
        existing.sezione = mapChecklistTaskSezioneToInt(template.sezione);
        existing.ordine = template.ordine == null ? null : Number(template.ordine);
        existing.titolo = template.titolo?.trim() || null;
        existing.target = inferChecklistTaskTarget(template.titolo, template.target);

        for (const duplicate of candidates) {
          if (duplicate.id === existing.id) continue;
          await mergeChecklistTaskData(supabase, existing.id, duplicate.id);
          const idx = checklistTasks.findIndex((task) => task.id === duplicate.id);
          if (idx >= 0) checklistTasks.splice(idx, 1);
          statsByTaskId.delete(duplicate.id);
          result.cleanedDuplicates += 1;
        }
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
        stato: "DA_FARE",
        note: null,
        updated_at: null,
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
    return {
      created: 0,
      updated: 0,
      linkedLegacy: 0,
      preservedInactive: 0,
      reconciled: 0,
      cleanedDuplicates: 0,
    };
  }
  const templates = await fetchTemplateRows(supabase, { activeOnly: true });
  return syncTemplatesToChecklistIds(supabase, [normalizedChecklistId], templates);
}

export async function syncChecklistTemplate(supabase: any, templateId: string) {
  const normalizedTemplateId = String(templateId || "").trim();
  if (!normalizedTemplateId) {
    return {
      created: 0,
      updated: 0,
      linkedLegacy: 0,
      preservedInactive: 0,
      reconciled: 0,
      cleanedDuplicates: 0,
    };
  }
  const templates = await fetchTemplateRows(supabase, {
    templateIds: [normalizedTemplateId],
    activeOnly: false,
  });
  if (!templates.length) {
    return {
      created: 0,
      updated: 0,
      linkedLegacy: 0,
      preservedInactive: 0,
      reconciled: 0,
      cleanedDuplicates: 0,
    };
  }
  const checklistIds = await fetchAllChecklistIds(supabase);
  return syncTemplatesToChecklistIds(supabase, checklistIds, templates);
}

export async function syncAllChecklistTemplates(supabase: any) {
  const templates = await fetchTemplateRows(supabase, { activeOnly: false });
  const checklistIds = await fetchAllChecklistIds(supabase);
  const total: SyncResult = {
    created: 0,
    updated: 0,
    linkedLegacy: 0,
    preservedInactive: 0,
    reconciled: 0,
    cleanedDuplicates: 0,
  };
  const chunkSize = 100;
  for (let index = 0; index < checklistIds.length; index += chunkSize) {
    const chunk = checklistIds.slice(index, index + chunkSize);
    const partial = await syncTemplatesToChecklistIds(supabase, chunk, templates);
    total.created += partial.created;
    total.updated += partial.updated;
    total.linkedLegacy += partial.linkedLegacy;
    total.preservedInactive += partial.preservedInactive;
    total.reconciled += partial.reconciled;
    total.cleanedDuplicates += partial.cleanedDuplicates;
  }
  return total;
}
