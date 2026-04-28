export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveClientePortalAuth } from "@/lib/clientePortalAuth";

type ChecklistDocumentRow = {
  id: string;
  checklist_id: string | null;
  tipo: string | null;
  filename: string | null;
  storage_path: string | null;
  uploaded_at: string | null;
};

type AttachmentRow = {
  id: string;
  source: string | null;
  provider: string | null;
  url: string | null;
  title: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
};

export async function GET(request: Request) {
  const auth = await resolveClientePortalAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  const { data: checklists, error: checklistsErr } = await auth.adminClient
    .from("checklists")
    .select("id, nome_checklist")
    .eq("cliente_id", auth.cliente.cliente_id);

  if (checklistsErr) {
    return NextResponse.json({ error: checklistsErr.message }, { status: 500 });
  }

  const checklistRows = checklists || [];
  const checklistIds = checklistRows.map((row) => String(row.id || "")).filter(Boolean);
  const checklistNameById = new Map(
    checklistRows.map((row) => [String(row.id || ""), String(row.nome_checklist || "").trim() || null])
  );

  if (checklistIds.length === 0) {
    return NextResponse.json({
      ok: true,
      cliente: auth.cliente,
      documenti: [],
    });
  }

  const [
    checklistDocumentsRes,
    checklistAttachmentsRes,
    interventiRes,
    checklistTasksRes,
  ] = await Promise.all([
    auth.adminClient
      .from("checklist_documents")
      .select("id, checklist_id, tipo, filename, storage_path, uploaded_at")
      .in("checklist_id", checklistIds)
      .eq("visibile_al_cliente", true)
      .order("uploaded_at", { ascending: false }),
    auth.adminClient
      .from("attachments")
      .select("id, source, provider, url, title, storage_path, mime_type, size_bytes, entity_type, entity_id, created_at")
      .eq("entity_type", "CHECKLIST")
      .in("entity_id", checklistIds)
      .eq("visibile_al_cliente", true)
      .order("created_at", { ascending: false }),
    auth.adminClient
      .from("interventi")
      .select("id, checklist_id")
      .in("checklist_id", checklistIds),
    auth.adminClient
      .from("checklist_tasks")
      .select("id, checklist_id")
      .in("checklist_id", checklistIds),
  ]);

  if (checklistDocumentsRes.error) {
    return NextResponse.json({ error: checklistDocumentsRes.error.message }, { status: 500 });
  }
  if (checklistAttachmentsRes.error) {
    return NextResponse.json({ error: checklistAttachmentsRes.error.message }, { status: 500 });
  }
  if (interventiRes.error) {
    return NextResponse.json({ error: interventiRes.error.message }, { status: 500 });
  }
  if (checklistTasksRes.error) {
    return NextResponse.json({ error: checklistTasksRes.error.message }, { status: 500 });
  }

  const interventiById = new Map(
    (interventiRes.data || []).map((row: any) => [String(row.id || ""), String(row.checklist_id || "")])
  );
  const taskChecklistById = new Map(
    (checklistTasksRes.data || []).map((row: any) => [String(row.id || ""), String(row.checklist_id || "")])
  );

  const extraAttachmentEntityIds = [
    ...(interventiRes.data || []).map((row: any) => String(row.id || "")).filter(Boolean),
    ...(checklistTasksRes.data || []).map((row: any) => String(row.id || "")).filter(Boolean),
  ];

  const extraAttachmentsByType: AttachmentRow[] = [];
  if (extraAttachmentEntityIds.length > 0) {
    const [interventoAttachmentsRes, taskAttachmentsRes] = await Promise.all([
      auth.adminClient
        .from("attachments")
        .select("id, source, provider, url, title, storage_path, mime_type, size_bytes, entity_type, entity_id, created_at")
        .eq("entity_type", "INTERVENTO")
        .in("entity_id", (interventiRes.data || []).map((row: any) => String(row.id || "")).filter(Boolean))
        .eq("visibile_al_cliente", true)
        .order("created_at", { ascending: false }),
      auth.adminClient
        .from("attachments")
        .select("id, source, provider, url, title, storage_path, mime_type, size_bytes, entity_type, entity_id, created_at")
        .eq("entity_type", "CHECKLIST_TASK")
        .in("entity_id", (checklistTasksRes.data || []).map((row: any) => String(row.id || "")).filter(Boolean))
        .eq("visibile_al_cliente", true)
        .order("created_at", { ascending: false }),
    ]);

    if (interventoAttachmentsRes.error) {
      return NextResponse.json({ error: interventoAttachmentsRes.error.message }, { status: 500 });
    }
    if (taskAttachmentsRes.error) {
      return NextResponse.json({ error: taskAttachmentsRes.error.message }, { status: 500 });
    }

    extraAttachmentsByType.push(
      ...((interventoAttachmentsRes.data || []) as AttachmentRow[]),
      ...((taskAttachmentsRes.data || []) as AttachmentRow[])
    );
  }

  const attachmentRows: AttachmentRow[] = [
    ...((checklistAttachmentsRes.data || []) as AttachmentRow[]),
    ...extraAttachmentsByType,
  ];

  const documents = [
    ...((checklistDocumentsRes.data || []) as ChecklistDocumentRow[]).map((row) => ({
      id: row.id,
      checklist_id: row.checklist_id,
      progetto_nome: checklistNameById.get(String(row.checklist_id || "")) || null,
      label: row.filename || row.tipo || "Documento",
      source_type: "checklist_document",
      tipo: row.tipo,
      data: row.uploaded_at,
      filename: row.filename,
      storage_path: row.storage_path,
      url: null,
      mime_type: null,
      size_bytes: null,
      entity_type: "CHECKLIST",
      entity_id: row.checklist_id,
    })),
    ...attachmentRows.map((row) => {
      const entityType = String(row.entity_type || "").trim().toUpperCase();
      const entityId = String(row.entity_id || "").trim();
      const checklistId =
        entityType === "CHECKLIST"
          ? entityId
          : entityType === "INTERVENTO"
            ? interventiById.get(entityId) || null
            : entityType === "CHECKLIST_TASK"
              ? taskChecklistById.get(entityId) || null
              : null;

      return {
        id: row.id,
        checklist_id: checklistId,
        progetto_nome: checklistNameById.get(String(checklistId || "")) || null,
        label: row.title || row.storage_path || "Allegato",
        source_type: "attachment",
        tipo: row.source,
        data: row.created_at,
        filename: null,
        storage_path: row.storage_path,
        url: row.url,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
      };
    }),
  ].filter((row) => checklistIds.includes(String(row.checklist_id || "")));

  documents.sort((a, b) => {
    const aTime = a.data ? new Date(a.data).getTime() : 0;
    const bTime = b.data ? new Date(b.data).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({
    ok: true,
    cliente: {
      cliente_id: auth.cliente.cliente_id,
      email: auth.cliente.email,
      attivo: auth.cliente.attivo,
    },
    documenti: documents,
  });
}
