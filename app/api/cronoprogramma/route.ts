export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RowRef = { row_kind: "INSTALLAZIONE" | "INTERVENTO"; row_ref_id: string };

function getAccessTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  const raw = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="));
  if (!raw) return "";
  return raw.split("=").slice(1).join("=");
}

function rowKey(rowKind: string, rowRefId: string) {
  return `${rowKind}:${rowRefId}`;
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

  const { data: operatoreByUser, error: opUserErr } = await supabaseAdmin
    .from("operatori")
    .select("id, nome, user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (opUserErr) {
    return { error: NextResponse.json({ error: opUserErr.message }, { status: 500 }) };
  }

  let operatore = operatoreByUser as any;
  if (!operatore?.id) {
    const userEmail = String(user.email || "").trim().toLowerCase();
    if (userEmail) {
      const { data: opByEmail, error: opEmailErr } = await supabaseAdmin
        .from("operatori")
        .select("id, nome, user_id, email")
        .ilike("email", userEmail)
        .limit(1)
        .maybeSingle();
      if (opEmailErr) {
        return { error: NextResponse.json({ error: opEmailErr.message }, { status: 500 }) };
      }
      if (opByEmail?.id) {
        operatore = opByEmail;
        if (!opByEmail.user_id || opByEmail.user_id !== user.id) {
          await supabaseAdmin.from("operatori").update({ user_id: user.id }).eq("id", opByEmail.id);
        }
      }
    }
  }

  if (!operatore?.id) {
    return { error: NextResponse.json({ error: "Operatore non associato" }, { status: 403 }) };
  }

  return { supabaseAdmin, operatore };
}

export async function POST(request: Request) {
  const auth = await getAuthContext(request);
  if ("error" in auth) return auth.error;

  const { supabaseAdmin, operatore } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "load") {
    const inputRows = Array.isArray(body?.rows) ? (body.rows as RowRef[]) : [];
    const normalizedRows = inputRows
      .map((r) => ({
        row_kind: String(r?.row_kind || "").toUpperCase(),
        row_ref_id: String(r?.row_ref_id || "").trim(),
      }))
      .filter((r) => (r.row_kind === "INSTALLAZIONE" || r.row_kind === "INTERVENTO") && r.row_ref_id);

    if (normalizedRows.length === 0) {
      return NextResponse.json({ ok: true, meta: {}, comments: {} });
    }

    const rowIds = Array.from(new Set(normalizedRows.map((r) => r.row_ref_id)));
    const rowKinds = Array.from(new Set(normalizedRows.map((r) => r.row_kind)));
    const wanted = new Set(normalizedRows.map((r) => rowKey(r.row_kind, r.row_ref_id)));

    const { data: metaRows, error: metaErr } = await supabaseAdmin
      .from("cronoprogramma_meta")
      .select("row_kind, row_ref_id, fatto, updated_at, updated_by_operatore, operatore:updated_by_operatore(nome)")
      .in("row_ref_id", rowIds)
      .in("row_kind", rowKinds as any);

    if (metaErr && !String(metaErr.message || "").toLowerCase().includes("cronoprogramma_meta")) {
      return NextResponse.json({ error: metaErr.message }, { status: 500 });
    }

    const { data: commentRows, error: commErr } = await supabaseAdmin
      .from("cronoprogramma_comments")
      .select("id, row_kind, row_ref_id, commento, created_at, created_by_operatore, operatore:created_by_operatore(nome)")
      .in("row_ref_id", rowIds)
      .in("row_kind", rowKinds as any)
      .order("created_at", { ascending: false });

    if (commErr && !String(commErr.message || "").toLowerCase().includes("cronoprogramma_comments")) {
      return NextResponse.json({ error: commErr.message }, { status: 500 });
    }

    const metaByKey: Record<string, any> = {};
    for (const row of metaRows || []) {
      const key = rowKey(String((row as any).row_kind), String((row as any).row_ref_id));
      if (!wanted.has(key)) continue;
      metaByKey[key] = {
        fatto: Boolean((row as any).fatto),
        updated_at: (row as any).updated_at || null,
        updated_by_operatore: (row as any).updated_by_operatore || null,
        updated_by_nome: (row as any).operatore?.nome || null,
      };
    }

    const commentsByKey: Record<string, any[]> = {};
    for (const row of commentRows || []) {
      const key = rowKey(String((row as any).row_kind), String((row as any).row_ref_id));
      if (!wanted.has(key)) continue;
      if (!commentsByKey[key]) commentsByKey[key] = [];
      commentsByKey[key].push({
        id: (row as any).id,
        commento: (row as any).commento || "",
        created_at: (row as any).created_at || null,
        created_by_operatore: (row as any).created_by_operatore || null,
        created_by_nome: (row as any).operatore?.nome || null,
      });
    }

    return NextResponse.json({
      ok: true,
      meta: metaByKey,
      comments: commentsByKey,
    });
  }

  if (action === "set_fatto") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const fatto = Boolean(body?.fatto);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const payload = {
      row_kind: rowKind,
      row_ref_id: rowRefId,
      fatto,
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    const { data, error } = await supabaseAdmin
      .from("cronoprogramma_meta")
      .upsert(payload, { onConflict: "row_kind,row_ref_id" })
      .select("row_kind, row_ref_id, fatto, updated_at, updated_by_operatore, operatore:updated_by_operatore(nome)")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: {
        fatto: Boolean((data as any)?.fatto),
        updated_at: (data as any)?.updated_at || null,
        updated_by_operatore: (data as any)?.updated_by_operatore || null,
        updated_by_nome: (data as any)?.operatore?.nome || null,
      },
    });
  }

  if (action === "add_comment") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const commento = String(body?.commento || "").trim();
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }
    if (!commento) {
      return NextResponse.json({ error: "Commento vuoto" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("cronoprogramma_comments")
      .insert({
        row_kind: rowKind,
        row_ref_id: rowRefId,
        commento,
        created_by_operatore: operatore.id,
      })
      .select("id, row_kind, row_ref_id, commento, created_at, created_by_operatore, operatore:created_by_operatore(nome)")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      comment: {
        id: (data as any)?.id,
        commento: (data as any)?.commento || "",
        created_at: (data as any)?.created_at || null,
        created_by_operatore: (data as any)?.created_by_operatore || null,
        created_by_nome: (data as any)?.operatore?.nome || null,
      },
    });
  }

  if (action === "delete_comment") {
    const commentId = String(body?.comment_id || "").trim();
    if (!commentId) {
      return NextResponse.json({ error: "comment_id mancante" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("cronoprogramma_comments").delete().eq("id", commentId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comment_id: commentId });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
