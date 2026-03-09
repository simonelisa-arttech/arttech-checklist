export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RowRef = { row_kind: "INSTALLAZIONE" | "INTERVENTO"; row_ref_id: string };
type OperativiInput = {
  personale_previsto?: string | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
};
const CUTOFF = "2026-01-01";

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

function toIsoDay(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function isOnOrAfterCutoff(value?: string | null) {
  const day = toIsoDay(value);
  return !!day && day >= CUTOFF;
}

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toOperativiPayload(input: OperativiInput) {
  return {
    personale_previsto: cleanText(input?.personale_previsto),
    mezzi: cleanText(input?.mezzi),
    descrizione_attivita: cleanText(input?.descrizione_attivita),
    indirizzo: cleanText(input?.indirizzo),
    orario: cleanText(input?.orario),
    referente_cliente_nome: cleanText(input?.referente_cliente_nome),
    referente_cliente_contatto: cleanText(input?.referente_cliente_contatto),
    commerciale_art_tech_nome: cleanText(input?.commerciale_art_tech_nome),
    commerciale_art_tech_contatto: cleanText(input?.commerciale_art_tech_contatto),
  };
}

function mapMetaRow(row: any) {
  return {
    fatto: Boolean(row?.fatto),
    hidden: Boolean(row?.hidden),
    updated_at: row?.updated_at || null,
    updated_by_operatore: row?.updated_by_operatore || null,
    updated_by_nome: row?.operatore?.nome || null,
    personale_previsto: row?.personale_previsto || null,
    mezzi: row?.mezzi || null,
    descrizione_attivita: row?.descrizione_attivita || null,
    indirizzo: row?.indirizzo || null,
    orario: row?.orario || null,
    referente_cliente_nome: row?.referente_cliente_nome || null,
    referente_cliente_contatto: row?.referente_cliente_contatto || null,
    commerciale_art_tech_nome: row?.commerciale_art_tech_nome || null,
    commerciale_art_tech_contatto: row?.commerciale_art_tech_contatto || null,
  };
}

async function getAuthContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
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

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return { error: NextResponse.json({ error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 }) };
  }

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
  const debug = new URL(request.url).searchParams.get("debug") === "1";
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

  if (action === "load_events") {
    const CUTOFF_DATE = "2026-01-01";

    const { data: checklists, error: cErr } = await supabaseAdmin
      .from("checklists")
      .select("id, cliente, nome_checklist, proforma, data_prevista, data_tassativa, stato_progetto, noleggio_vendita, tipo_impianto")
      .eq("stato_progetto", "IN_CORSO")
      .order("created_at", { ascending: false });
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    let interventi: any[] | null = null;
    let iErr: any = null;
    {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, ticket_no, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .eq("stato_intervento", "APERTO")
        .or(`data_tassativa.gte.${CUTOFF_DATE},and(data_tassativa.is.null,data.gte.${CUTOFF_DATE})`)
        .order("data", { ascending: true });
      interventi = res.data as any[] | null;
      iErr = res.error;
    }
    if (iErr && String(iErr.message || "").toLowerCase().includes("data_tassativa")) {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, ticket_no, data, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .eq("stato_intervento", "APERTO")
        .gte("data", CUTOFF_DATE)
        .order("data", { ascending: true });
      interventi = (res.data as any[] | null)?.map((r) => ({ ...r, data_tassativa: null })) ?? [];
      iErr = res.error;
    }
    if (iErr && String(iErr.message || "").toLowerCase().includes("ticket_no")) {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .eq("stato_intervento", "APERTO")
        .or(`data_tassativa.gte.${CUTOFF_DATE},and(data_tassativa.is.null,data.gte.${CUTOFF_DATE})`)
        .order("data", { ascending: true });
      interventi = (res.data as any[] | null)?.map((r) => ({ ...r, ticket_no: null, data_tassativa: r.data_tassativa ?? null })) ?? [];
      iErr = res.error;
    }
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    const checklistById = new Map<string, any>();
    const inCorsoChecklistIds = new Set<string>();
    for (const c of checklists || []) {
      const id = String((c as any).id || "");
      if (!id) continue;
      checklistById.set(id, c as any);
      if (String((c as any).stato_progetto || "").toUpperCase() === "IN_CORSO") {
        inCorsoChecklistIds.add(id);
      }
    }

    const timeline: any[] = [];
    const toIsoDay = (value?: string | null) => (value ? String(value).slice(0, 10) : "");

    for (const c of checklists || []) {
      const cc = c as any;
      if (String(cc.stato_progetto || "").toUpperCase() !== "IN_CORSO") continue;
      const date = toIsoDay(cc.data_tassativa) || toIsoDay(cc.data_prevista);
      if (!date || date < CUTOFF_DATE) continue;
      timeline.push({
        kind: "INSTALLAZIONE",
        id: `install:${cc.id}`,
        row_ref_id: cc.id,
        data_prevista: toIsoDay(cc.data_prevista) || date,
        data_tassativa: toIsoDay(cc.data_tassativa) || date,
        cliente: String(cc.cliente || "—"),
        checklist_id: cc.id,
        progetto: String(cc.nome_checklist || cc.id),
        proforma: cc.proforma ?? null,
        tipologia: String(cc.noleggio_vendita || "INSTALLAZIONE").toUpperCase(),
        descrizione: [cc.tipo_impianto || "", cc.noleggio_vendita || ""].filter(Boolean).join(" · ") || "Installazione pianificata",
        stato: "PIANIFICATA",
        fatto: false,
      });
    }

    for (const i of interventi || []) {
      const ii = i as any;
      const statoIntervento = String(ii.stato_intervento || ii.fatturazione_stato || "APERTO").toUpperCase();
      if (statoIntervento !== "APERTO") continue;
      const date = toIsoDay(ii.data_tassativa) || toIsoDay(ii.data);
      if (!date || date < CUTOFF_DATE) continue;
      if (ii.checklist_id && !inCorsoChecklistIds.has(String(ii.checklist_id))) continue;
      const c = ii.checklist_id ? checklistById.get(String(ii.checklist_id)) : null;
      const prevista = toIsoDay(ii.data) || toIsoDay(ii.data_tassativa) || date;
      const tassativa = toIsoDay(ii.data_tassativa) || toIsoDay(ii.data) || date;
      timeline.push({
        kind: "INTERVENTO",
        id: `intervento:${ii.id}`,
        row_ref_id: ii.id,
        data_prevista: prevista,
        data_tassativa: tassativa,
        cliente: String(ii.cliente || c?.cliente || "—"),
        checklist_id: ii.checklist_id,
        ticket_no: ii.ticket_no ?? null,
        proforma: ii.proforma ?? c?.proforma ?? null,
        progetto: String(c?.nome_checklist || ii.checklist_id || "—"),
        tipologia: String(ii.tipo || "INTERVENTO").toUpperCase(),
        descrizione: String(ii.descrizione || "Intervento"),
        stato: statoIntervento,
        fatto: false,
      });
    }

    timeline.sort((a, b) => (a.data_tassativa || a.data_prevista).localeCompare(b.data_tassativa || b.data_prevista));
    return NextResponse.json({
      ok: true,
      events: timeline,
      auth_mode: "service_role",
      ...(debug ? { debug: { auth_mode: "service_role" } } : {}),
    });
  }

  if (action === "load") {
    const inputRows = Array.isArray(body?.rows) ? (body.rows as RowRef[]) : [];
    let normalizedRows = inputRows
      .map((r) => ({
        row_kind: String(r?.row_kind || "").toUpperCase(),
        row_ref_id: String(r?.row_ref_id || "").trim(),
      }))
      .filter((r) => (r.row_kind === "INSTALLAZIONE" || r.row_kind === "INTERVENTO") && r.row_ref_id);

    if (normalizedRows.length === 0) {
      return NextResponse.json({ ok: true, meta: {}, comments: {} });
    }

    const installazioneIds = Array.from(
      new Set(normalizedRows.filter((r) => r.row_kind === "INSTALLAZIONE").map((r) => r.row_ref_id))
    );
    const interventoIds = Array.from(
      new Set(normalizedRows.filter((r) => r.row_kind === "INTERVENTO").map((r) => r.row_ref_id))
    );

    const allowedInstallazioni = new Set<string>();
    if (installazioneIds.length > 0) {
      const { data: checklistRows, error: checklistErr } = await supabaseAdmin
        .from("checklists")
        .select("id, stato_progetto")
        .in("id", installazioneIds as any);
      if (checklistErr) {
        return NextResponse.json({ error: checklistErr.message }, { status: 500 });
      }
      for (const row of checklistRows || []) {
        if (String((row as any).stato_progetto || "").toUpperCase() === "IN_CORSO") {
          allowedInstallazioni.add(String((row as any).id));
        }
      }
    }

    const allowedInterventi = new Set<string>();
    if (interventoIds.length > 0) {
      let interventiRows: any[] | null = null;
      let interventiErr: any = null;
      {
        const res = await supabaseAdmin
          .from("saas_interventi")
          .select("id, stato_intervento, data, data_tassativa")
          .in("id", interventoIds as any);
        interventiRows = res.data as any[] | null;
        interventiErr = res.error;
      }
      if (interventiErr && String(interventiErr.message || "").toLowerCase().includes("data_tassativa")) {
        const res = await supabaseAdmin
          .from("saas_interventi")
          .select("id, stato_intervento, data")
          .in("id", interventoIds as any);
        interventiRows = (res.data as any[] | null)?.map((r) => ({ ...r, data_tassativa: null })) ?? [];
        interventiErr = res.error;
      }
      if (interventiErr) {
        return NextResponse.json({ error: interventiErr.message }, { status: 500 });
      }
      for (const row of interventiRows || []) {
        const stato = String((row as any).stato_intervento || "").toUpperCase();
        const dataEvento = toIsoDay((row as any).data_tassativa) || toIsoDay((row as any).data);
        if (stato === "APERTO" && isOnOrAfterCutoff(dataEvento)) {
          allowedInterventi.add(String((row as any).id));
        }
      }
    }

    normalizedRows = normalizedRows.filter((r) => {
      if (r.row_kind === "INSTALLAZIONE") return allowedInstallazioni.has(r.row_ref_id);
      if (r.row_kind === "INTERVENTO") return allowedInterventi.has(r.row_ref_id);
      return false;
    });

    if (normalizedRows.length === 0) {
      return NextResponse.json({ ok: true, meta: {}, comments: {} });
    }

    const rowIds = Array.from(new Set(normalizedRows.map((r) => r.row_ref_id)));
    const rowKinds = Array.from(new Set(normalizedRows.map((r) => r.row_kind)));
    const wanted = new Set(normalizedRows.map((r) => rowKey(r.row_kind, r.row_ref_id)));

    let metaRows: any[] | null = null;
    let metaErr: any = null;
    {
      const res = await supabaseAdmin
        .from("cronoprogramma_meta")
        .select("*, operatore:updated_by_operatore(nome)")
        .in("row_ref_id", rowIds)
        .in("row_kind", rowKinds as any);
      metaRows = res.data as any[] | null;
      metaErr = res.error;
    }
    if (metaErr && String(metaErr.message || "").toLowerCase().includes("hidden")) {
      const res = await supabaseAdmin
        .from("cronoprogramma_meta")
        .select("row_kind, row_ref_id, fatto, updated_at, updated_by_operatore, operatore:updated_by_operatore(nome)")
        .in("row_ref_id", rowIds)
        .in("row_kind", rowKinds as any);
      metaRows = (res.data as any[] | null)?.map((r) => ({ ...r, hidden: false })) ?? [];
      metaErr = res.error;
    }

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
      metaByKey[key] = mapMetaRow(row as any);
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
      .select("*, operatore:updated_by_operatore(nome)")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: mapMetaRow(data as any),
    });
  }

  if (action === "set_hidden") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const hidden = Boolean(body?.hidden);
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const payload = {
      row_kind: rowKind,
      row_ref_id: rowRefId,
      hidden,
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    const { data, error } = await supabaseAdmin
      .from("cronoprogramma_meta")
      .upsert(payload, { onConflict: "row_kind,row_ref_id" })
      .select("*, operatore:updated_by_operatore(nome)")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: mapMetaRow(data as any),
    });
  }

  if (action === "set_operativi") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const payload = {
      row_kind: rowKind,
      row_ref_id: rowRefId,
      ...toOperativiPayload(body || {}),
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    const { data, error } = await supabaseAdmin
      .from("cronoprogramma_meta")
      .upsert(payload, { onConflict: "row_kind,row_ref_id" })
      .select("*, operatore:updated_by_operatore(nome)")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      meta: mapMetaRow(data as any),
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
