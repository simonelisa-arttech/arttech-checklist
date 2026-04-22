export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

const ALLOWED_DOCUMENT_TYPES = new Set(["GENERICO", "CLIENTE", "DRIVE", "ODA_FORNITORE"]);
const DOCUMENT_TYPE_PREFIX = "[DOC_TYPE:";

function normalizeProvider(url?: string | null) {
  const v = String(url || "").toLowerCase();
  if (v.includes("drive.google.com")) return "GOOGLE_DRIVE";
  return "GENERIC";
}

function isHttpUrl(url?: string | null) {
  const v = String(url || "").trim();
  return /^https?:\/\//i.test(v);
}

function normalizeDocumentType(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return ALLOWED_DOCUMENT_TYPES.has(normalized) ? normalized : null;
}

function stripLegacyDocumentTypePrefix(rawTitle?: string | null) {
  const trimmed = String(rawTitle || "").trim();
  if (!trimmed.startsWith(DOCUMENT_TYPE_PREFIX)) {
    return { title: trimmed, documentType: null as string | null };
  }
  const suffixIndex = trimmed.indexOf("]");
  if (suffixIndex < 0) {
    return { title: trimmed, documentType: null as string | null };
  }
  const legacyType = normalizeDocumentType(trimmed.slice(DOCUMENT_TYPE_PREFIX.length, suffixIndex));
  if (!legacyType) {
    return { title: trimmed, documentType: null as string | null };
  }
  return {
    title: trimmed.slice(suffixIndex + 1).trim() || trimmed,
    documentType: legacyType,
  };
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const { adminClient: supabaseAdmin } = auth;

  const { searchParams } = new URL(request.url);
  const entityType = String(searchParams.get("entity_type") || "").trim();
  const entityId = String(searchParams.get("entity_id") || "").trim();
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entity_type/entity_id mancanti" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select("id, source, provider, url, title, document_type, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at, visibile_al_cliente")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, rows: data || [] });
}

export async function PATCH(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const { adminClient: supabaseAdmin } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = String(body?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id mancante" }, { status: 400 });
  }

  const visibileAlCliente = body?.visibile_al_cliente === true;
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .update({ visibile_al_cliente: visibileAlCliente })
    .eq("id", id)
    .select("id, source, provider, url, title, document_type, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at, visibile_al_cliente")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function POST(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const {
    adminClient: supabaseAdmin,
    operatore: { id: operatoreId },
  } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = String(body?.source || "").trim().toUpperCase();
  const entityType = String(body?.entity_type || "").trim();
  const entityId = String(body?.entity_id || "").trim();
  const rawTitle = String(body?.title || "").trim();
  const parsedLegacy = stripLegacyDocumentTypePrefix(rawTitle);
  const title = parsedLegacy.title;
  const documentType = normalizeDocumentType(body?.document_type) || parsedLegacy.documentType;
  if (!(source === "UPLOAD" || source === "LINK")) {
    return NextResponse.json({ error: "source non valido" }, { status: 400 });
  }
  if (!entityType || !entityId || !title) {
    return NextResponse.json({ error: "entity_type/entity_id/title mancanti" }, { status: 400 });
  }

  if (source === "LINK") {
    const url = String(body?.url || "").trim();
    if (!isHttpUrl(url)) {
      return NextResponse.json({ error: "URL non valido: usa http(s)" }, { status: 400 });
    }
    const payload = {
      source,
      provider: normalizeProvider(url),
      url,
      title,
      document_type: documentType,
      storage_path: null,
      mime_type: null,
      size_bytes: null,
      entity_type: entityType,
      entity_id: entityId,
      created_by: operatoreId,
    };
    const { data, error } = await supabaseAdmin
      .from("attachments")
      .insert(payload)
      .select("id, source, provider, url, title, document_type, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data });
  }

  const storagePath = String(body?.storage_path || "").trim();
  if (!storagePath) {
    return NextResponse.json({ error: "storage_path mancante per UPLOAD" }, { status: 400 });
  }
  const payload = {
    source,
    provider: null,
    url: null,
    title,
    document_type: documentType,
    storage_path: storagePath,
    mime_type: body?.mime_type ? String(body.mime_type) : null,
    size_bytes: body?.size_bytes != null ? Number(body.size_bytes) : null,
    entity_type: entityType,
    entity_id: entityId,
    created_by: operatoreId,
  };
  const { data, error } = await supabaseAdmin
    .from("attachments")
    .insert(payload)
    .select("id, source, provider, url, title, document_type, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const { adminClient: supabaseAdmin } = auth;

  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "id mancante" }, { status: 400 });

  const { data: row, error: rowErr } = await supabaseAdmin
    .from("attachments")
    .select("id, source, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });
  if (!row?.id) return NextResponse.json({ ok: true, id });

  if (String((row as any).source || "").toUpperCase() === "UPLOAD" && (row as any).storage_path) {
    const { error: storageErr } = await supabaseAdmin.storage
      .from("checklist-documents")
      .remove([String((row as any).storage_path)]);
    if (storageErr) {
      return NextResponse.json({ error: storageErr.message }, { status: 500 });
    }
  }

  const { error } = await supabaseAdmin.from("attachments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
