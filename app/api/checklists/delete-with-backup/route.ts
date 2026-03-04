export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getAccessTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  const raw = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="));
  if (!raw) return "";
  return raw.split("=").slice(1).join("=");
}

async function assertAuthenticated(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return false;
  const accessToken = getAccessTokenFromCookieHeader(request.headers.get("cookie"));
  if (!accessToken) return false;

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabaseAnon.auth.getUser(accessToken);
  return !error && !!user;
}

export async function POST(request: Request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";

  const isAuthed = await assertAuthenticated(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY", auth_mode: "service_role" },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const checklistId = String(body?.checklist_id || "").trim();
  if (!checklistId) {
    return NextResponse.json({ error: "checklist_id mancante" }, { status: 400 });
  }

  const { data: checklist, error: checklistErr } = await supabaseAdmin
    .from("checklists")
    .select("*")
    .eq("id", checklistId)
    .single();
  if (checklistErr || !checklist) {
    return NextResponse.json(
      { error: checklistErr?.message || "Checklist non trovata", auth_mode: "service_role" },
      { status: 500 }
    );
  }

  const deletedAt = new Date().toISOString();
  const { error: backupErr } = await supabaseAdmin.from("checklists_backup").insert({
    checklist_id: checklistId,
    deleted_at: deletedAt,
    data: checklist,
  });
  if (backupErr) {
    return NextResponse.json(
      { error: backupErr.message, auth_mode: "service_role" },
      { status: 500 }
    );
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("checklists")
    .delete()
    .eq("id", checklistId);
  if (deleteErr) {
    return NextResponse.json(
      { error: deleteErr.message, auth_mode: "service_role" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    checklist_id: checklistId,
    auth_mode: "service_role",
    ...(debug ? { debug: { auth_mode: "service_role" } } : {}),
  });
}
