export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

type ClientePortaleAuthRow = {
  cliente_id: string;
  email: string;
  attivo: boolean;
};

async function resolveClienteAuth(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false as const, response: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }) };
  }

  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient
    .from("clienti_portale_auth")
    .select("cliente_id, email, attivo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!data) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Cliente non associato" }, { status: 401 }),
    };
  }

  return {
    ok: true as const,
    adminClient,
    cliente: data as ClientePortaleAuthRow,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await resolveClienteAuth(request);
  if (!auth.ok) return auth.response;
  if (auth.cliente.attivo === false) {
    return NextResponse.json({ error: "Cliente inattivo" }, { status: 403 });
  }

  const params = await context.params;
  const documentId = String(params?.id || "").trim();
  if (!documentId) {
    return NextResponse.json({ error: "Documento mancante" }, { status: 400 });
  }

  const { data: checklists, error: checklistsErr } = await auth.adminClient
    .from("checklists")
    .select("id")
    .eq("cliente_id", auth.cliente.cliente_id);
  if (checklistsErr) {
    return NextResponse.json({ error: checklistsErr.message }, { status: 500 });
  }

  const checklistIds = (checklists || []).map((row: any) => String(row.id || "")).filter(Boolean);
  if (checklistIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: checklistDocument, error: checklistDocumentErr } = await auth.adminClient
    .from("checklist_documents")
    .select("id, checklist_id, storage_path, visibile_al_cliente")
    .eq("id", documentId)
    .maybeSingle();
  if (checklistDocumentErr) {
    return NextResponse.json({ error: checklistDocumentErr.message }, { status: 500 });
  }

  if (checklistDocument?.id) {
    const checklistId = String((checklistDocument as any).checklist_id || "");
    const visible = (checklistDocument as any).visibile_al_cliente === true;
    const storagePath = String((checklistDocument as any).storage_path || "").trim();
    if (!visible || !checklistIds.includes(checklistId) || !storagePath) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await auth.adminClient.storage
      .from("checklist-documents")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "Errore generazione download" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, url: data.signedUrl });
  }

  const [
    interventiRes,
    checklistTasksRes,
    attachmentRes,
  ] = await Promise.all([
    auth.adminClient.from("interventi").select("id, checklist_id").in("checklist_id", checklistIds),
    auth.adminClient.from("checklist_tasks").select("id, checklist_id").in("checklist_id", checklistIds),
    auth.adminClient
      .from("attachments")
      .select("id, source, url, storage_path, entity_type, entity_id, visibile_al_cliente")
      .eq("id", documentId)
      .maybeSingle(),
  ]);

  if (interventiRes.error) {
    return NextResponse.json({ error: interventiRes.error.message }, { status: 500 });
  }
  if (checklistTasksRes.error) {
    return NextResponse.json({ error: checklistTasksRes.error.message }, { status: 500 });
  }
  if (attachmentRes.error) {
    return NextResponse.json({ error: attachmentRes.error.message }, { status: 500 });
  }

  const attachment = attachmentRes.data as
    | {
        id: string;
        source: string | null;
        url: string | null;
        storage_path: string | null;
        entity_type: string | null;
        entity_id: string | null;
        visibile_al_cliente: boolean | null;
      }
    | null;

  if (!attachment?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const interventiById = new Map(
    (interventiRes.data || []).map((row: any) => [String(row.id || ""), String(row.checklist_id || "")])
  );
  const tasksById = new Map(
    (checklistTasksRes.data || []).map((row: any) => [String(row.id || ""), String(row.checklist_id || "")])
  );

  const entityType = String(attachment.entity_type || "").trim().toUpperCase();
  const entityId = String(attachment.entity_id || "").trim();
  const checklistId =
    entityType === "CHECKLIST"
      ? entityId
      : entityType === "INTERVENTO"
        ? interventiById.get(entityId) || ""
        : entityType === "CHECKLIST_TASK"
          ? tasksById.get(entityId) || ""
          : "";

  if (attachment.visibile_al_cliente !== true || !checklistIds.includes(checklistId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (String(attachment.source || "").trim().toUpperCase() === "LINK") {
    const url = String(attachment.url || "").trim();
    if (!url) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, url });
  }

  const storagePath = String(attachment.storage_path || "").trim();
  if (!storagePath) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await auth.adminClient.storage
    .from("checklist-documents")
    .createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Errore generazione download" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: data.signedUrl });
}
