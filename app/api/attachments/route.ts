export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAccessTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  const raw = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="));
  if (!raw) return "";
  return raw.split("=").slice(1).join("=");
}

function normalizeProvider(url?: string | null) {
  const v = String(url || "").toLowerCase();
  if (v.includes("drive.google.com")) return "GOOGLE_DRIVE";
  return "GENERIC";
}

function isHttpUrl(url?: string | null) {
  const v = String(url || "").trim();
  return /^https?:\/\//i.test(v);
}

async function getAuthContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 }) };
  }

  const accessToken = getAccessTokenFromCookieHeader(request.headers.get("cookie"));
  if (!accessToken) {
    return { error: NextResponse.json({ error: "No auth cookie" }, { status: 401 }) };
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: operatore, error: opErr } = await supabaseAdmin
    .from("operatori")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (opErr) {
    return { error: NextResponse.json({ error: opErr.message }, { status: 500 }) };
  }

  return { supabaseAdmin, operatoreId: (operatore as any)?.id || null };
}

export async function GET(request: Request) {
  const auth = await getAuthContext(request);
  if ("error" in auth) return auth.error;
  const { supabaseAdmin } = auth;

  const { searchParams } = new URL(request.url);
  const entityType = String(searchParams.get("entity_type") || "").trim();
  const entityId = String(searchParams.get("entity_id") || "").trim();
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entity_type/entity_id mancanti" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("attachments")
    .select("id, source, provider, url, title, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, rows: data || [] });
}

export async function POST(request: Request) {
  const auth = await getAuthContext(request);
  if ("error" in auth) return auth.error;
  const { supabaseAdmin, operatoreId } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = String(body?.source || "").trim().toUpperCase();
  const entityType = String(body?.entity_type || "").trim();
  const entityId = String(body?.entity_id || "").trim();
  const title = String(body?.title || "").trim();
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
      .select("id, source, provider, url, title, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at")
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
    .select("id, source, provider, url, title, storage_path, mime_type, size_bytes, entity_type, entity_id, created_by, created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(request: Request) {
  const auth = await getAuthContext(request);
  if ("error" in auth) return auth.error;
  const { supabaseAdmin } = auth;

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
