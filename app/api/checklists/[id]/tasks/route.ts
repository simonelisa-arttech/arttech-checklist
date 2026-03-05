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
  const params = await Promise.resolve(context.params);
  const checklistId = String(params?.id || "").trim();
  if (!checklistId) {
    return NextResponse.json({ error: "Checklist id mancante" }, { status: 400 });
  }

  const isAuthed = await assertAuthenticated(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const res1 = await supabaseAdmin
    .from("checklist_tasks")
    .select(
      "id, sezione, ordine, titolo, stato, note, target, task_template_id, updated_at, updated_by_operatore, created_at, operatori:updated_by_operatore ( id, nome )"
    )
    .eq("checklist_id", checklistId)
    .order("ordine", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (res1.error && String(res1.error.message || "").toLowerCase().includes("target")) {
    const res2 = await supabaseAdmin
      .from("checklist_tasks")
      .select(
        "id, sezione, ordine, titolo, stato, note, task_template_id, updated_at, updated_by_operatore, created_at, operatori:updated_by_operatore ( id, nome )"
      )
      .eq("checklist_id", checklistId)
      .order("ordine", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (res2.error) {
      return NextResponse.json({ error: res2.error.message }, { status: 500 });
    }

    const tasks = (res2.data ?? []).map((r: any) => ({ ...r, target: null }));
    return NextResponse.json({ ok: true, tasks });
  }

  if (res1.error) {
    return NextResponse.json({ error: res1.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tasks: res1.data ?? [] });
}
