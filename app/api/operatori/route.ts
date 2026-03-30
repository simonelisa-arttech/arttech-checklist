export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

type OperatorePayload = {
  id?: string;
  nome: string | null;
  ruolo: string | null;
  email: string | null;
  attivo: boolean;
  alert_enabled: boolean;
  riceve_notifiche?: boolean;
  can_access_impostazioni?: boolean;
  alert_tasks: {
    task_template_ids: string[];
    all_task_status_change: boolean;
    on_checklist_open?: boolean;
    allow_manual?: boolean;
    allow_automatic?: boolean;
    allow_scheduled?: boolean;
  };
};

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const supabase = auth.adminClient;

  let { data, error } = await supabase
    .from("operatori")
    .select("id, user_id, nome, ruolo, email, attivo, alert_enabled, riceve_notifiche, can_access_impostazioni, alert_tasks")
    .order("ruolo", { ascending: true })
    .order("nome", { ascending: true });
  if (error && String(error.message || "").toLowerCase().includes("riceve_notifiche")) {
    const fallback = await supabase
      .from("operatori")
      .select("id, user_id, nome, ruolo, email, attivo, alert_enabled, alert_tasks")
      .order("ruolo", { ascending: true })
      .order("nome", { ascending: true });
    data = (fallback.data || []).map((r: any) => ({ ...r, riceve_notifiche: r.alert_enabled !== false }));
    error = fallback.error as any;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const supabase = auth.adminClient;

  let body: OperatorePayload;
  try {
    body = (await request.json()) as OperatorePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload: any = {
    ...body,
    riceve_notifiche: body.riceve_notifiche !== false,
    can_access_impostazioni: body.can_access_impostazioni === true,
  };
  let { data, error } = await supabase
    .from("operatori")
    .insert(payload)
    .select("id")
    .single();
  if (error && String(error.message || "").toLowerCase().includes("riceve_notifiche")) {
    delete payload.riceve_notifiche;
    const fallback = await supabase.from("operatori").insert(payload).select("id").single();
    data = fallback.data;
    error = fallback.error as any;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}

export async function PATCH(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const supabase = auth.adminClient;

  let body: OperatorePayload;
  try {
    body = (await request.json()) as OperatorePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const payload: any = { ...body };
  if (payload.riceve_notifiche === undefined) payload.riceve_notifiche = true;
  if (payload.can_access_impostazioni === undefined) payload.can_access_impostazioni = false;
  let { error } = await supabase.from("operatori").update(payload).eq("id", body.id);
  if (error && String(error.message || "").toLowerCase().includes("riceve_notifiche")) {
    delete payload.riceve_notifiche;
    const fallback = await supabase.from("operatori").update(payload).eq("id", body.id);
    error = fallback.error as any;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const supabase = auth.adminClient;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("operatori").delete().eq("id", id);
  if (!error) {
    return NextResponse.json({ ok: true, mode: "deleted" });
  }

  const isFkViolation =
    String((error as any)?.code || "") === "23503" ||
    String(error.message || "").toLowerCase().includes("violates foreign key");
  if (!isFkViolation) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: deactivateErr } = await supabase
    .from("operatori")
    .update({ attivo: false })
    .eq("id", id);
  if (deactivateErr) {
    return NextResponse.json({ error: deactivateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: "deactivated",
    message: "Operatore referenziato da checklist: disattivato invece di eliminato.",
  });
}
