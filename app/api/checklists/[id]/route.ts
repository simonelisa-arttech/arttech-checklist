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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const params = await Promise.resolve(context.params);
  const checklistId = String(params?.id || "").trim();
  if (!checklistId) {
    return NextResponse.json({ error: "Id checklist mancante" }, { status: 400 });
  }

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

  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("*, created_by_name, updated_by_name, created_by_operatore, updated_by_operatore")
    .eq("id", checklistId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Checklist non trovata", auth_mode: "service_role" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    auth_mode: "service_role",
    ...(debug ? { debug: { auth_mode: "service_role" } } : {}),
    data,
  });
}
