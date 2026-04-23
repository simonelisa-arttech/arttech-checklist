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
  can_access_backoffice?: boolean;
  can_access_operator_app?: boolean;
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
    .select(
      "id, user_id, nome, ruolo, email, attivo, alert_enabled, riceve_notifiche, can_access_impostazioni, can_access_backoffice, can_access_operator_app, alert_tasks"
    )
    .order("ruolo", { ascending: true })
    .order("nome", { ascending: true });
  if (error && String(error.message || "").toLowerCase().includes("riceve_notifiche")) {
    const fallback = await supabase
      .from("operatori")
      .select(
        "id, user_id, nome, ruolo, email, attivo, alert_enabled, can_access_impostazioni, can_access_backoffice, can_access_operator_app, alert_tasks"
      )
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
    can_access_backoffice: body.can_access_backoffice === true,
    can_access_operator_app: body.can_access_operator_app !== false,
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const isMinimalPersonaleLinkUpdate =
    Object.prototype.hasOwnProperty.call(body, "personale_id") &&
    !Object.prototype.hasOwnProperty.call(body, "alert_tasks") &&
    !Object.prototype.hasOwnProperty.call(body, "nome") &&
    !Object.prototype.hasOwnProperty.call(body, "ruolo") &&
    !Object.prototype.hasOwnProperty.call(body, "email");

  if (isMinimalPersonaleLinkUpdate) {
    const targetOperatorId = String(body.id || "").trim();
    if (!targetOperatorId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (auth.operatore.id !== targetOperatorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const personaleId = String(body.personale_id || "").trim();
    if (!personaleId) {
      return NextResponse.json({ error: "Missing personale_id" }, { status: 400 });
    }

    const { data: personaleRow, error: personaleErr } = await supabase
      .from("personale")
      .select("id,attivo")
      .eq("id", personaleId)
      .eq("attivo", true)
      .maybeSingle();
    if (personaleErr) {
      return NextResponse.json({ error: personaleErr.message }, { status: 500 });
    }
    if (!personaleRow?.id) {
      return NextResponse.json({ error: "Personale non trovato o non attivo" }, { status: 400 });
    }

    const { data: existingLink, error: existingErr } = await supabase
      .from("operatori")
      .select("id,nome")
      .eq("personale_id", personaleId)
      .neq("id", targetOperatorId)
      .limit(1)
      .maybeSingle();
    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    if (existingLink?.id) {
      return NextResponse.json(
        { error: "Questo personale risulta già collegato a un altro operatore" },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("operatori")
      .update({ personale_id: personaleId })
      .eq("id", targetOperatorId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, personale_id: personaleId });
  }

  const payload: any = { ...body };
  if (payload.riceve_notifiche === undefined) payload.riceve_notifiche = true;
  if (payload.can_access_impostazioni === undefined) payload.can_access_impostazioni = false;
  if (payload.can_access_backoffice === undefined) payload.can_access_backoffice = false;
  if (payload.can_access_operator_app === undefined) payload.can_access_operator_app = true;
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
