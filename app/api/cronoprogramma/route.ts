export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import {
  normalizeOperativiDate,
  normalizeOperativiDuration,
} from "@/lib/operativiSchedule";

type RowKind = "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO" | "CHECKLIST_TASK";
type RowRef = { row_kind: RowKind; row_ref_id: string };
type OperativiInput = {
  data_inizio?: string | null;
  durata_giorni?: string | number | null;
  durata_prevista_minuti?: string | number | null;
  modalita_attivita?: string | null;
  personale_previsto?: string | null;
  personale_ids?: string[] | null;
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

function rowKey(rowKind: string, rowRefId: string) {
  return `${rowKind}:${rowRefId}`;
}

function isValidRowKind(value: string): value is RowKind {
  return (
    value === "INSTALLAZIONE" ||
    value === "DISINSTALLAZIONE" ||
    value === "INTERVENTO" ||
    value === "CHECKLIST_TASK"
  );
}

function toIsoDay(value?: string | null) {
  return normalizeOperativiDate(value);
}

function isOnOrAfterCutoff(value?: string | null) {
  const day = toIsoDay(value);
  return !!day && day >= CUTOFF;
}

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function cleanModalitaAttivita(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "ONSITE" || normalized === "REMOTO" ? normalized : null;
}

function cleanNonNegativeInteger(value: unknown) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function getEffectiveNormalizedStatus(value?: string | null) {
  return normalizeUpper(getEffectiveProjectStatus({ stato_progetto: value }));
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanUuidArray(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => isUuidLike(value))
    )
  );
}

function toOperativiPayload(input: OperativiInput) {
  return {
    data_inizio: normalizeOperativiDate(input?.data_inizio) || null,
    ...(input?.durata_giorni !== undefined
      ? { durata_giorni: normalizeOperativiDuration(input?.durata_giorni) }
      : {}),
    ...(input?.durata_prevista_minuti !== undefined
      ? { durata_prevista_minuti: cleanNonNegativeInteger(input?.durata_prevista_minuti) }
      : {}),
    modalita_attivita: cleanModalitaAttivita(input?.modalita_attivita),
    personale_previsto: cleanText(input?.personale_previsto),
    personale_ids: cleanUuidArray(input?.personale_ids),
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
    data_inizio: row?.data_inizio || null,
    durata_giorni:
      Number.isFinite(Number(row?.durata_giorni)) && Number(row?.durata_giorni) > 0
        ? Number(row?.durata_giorni)
        : null,
    durata_prevista_minuti:
      Number.isFinite(Number(row?.durata_prevista_minuti)) && Number(row?.durata_prevista_minuti) >= 0
        ? Number(row?.durata_prevista_minuti)
        : null,
    modalita_attivita: row?.modalita_attivita || null,
    personale_previsto: row?.personale_previsto || null,
    personale_ids: Array.isArray(row?.personale_ids)
      ? row.personale_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [],
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

async function loadOperatorePersonaleId(supabaseAdmin: any, operatoreId: string) {
  const { data, error } = await supabaseAdmin
    .from("operatori")
    .select("personale_id")
    .eq("id", operatoreId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.personale_id ? String(data.personale_id) : null;
}

export async function POST(request: Request) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const { adminClient: supabaseAdmin, operatore } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "load_events") {
    const CUTOFF_DATE = "2026-01-01";

    let checklists: any[] | null = null;
    let cErr: any = null;
    {
      const res = await supabaseAdmin
        .from("checklists")
        .select(
          "id, cliente, nome_checklist, proforma, data_prevista, data_tassativa, data_disinstallazione, stato_progetto, noleggio_vendita, tipo_impianto"
        )
        .order("created_at", { ascending: false });
      checklists = res.data as any[] | null;
      cErr = res.error;
    }
    if (cErr && String(cErr.message || "").toLowerCase().includes("data_disinstallazione")) {
      const res = await supabaseAdmin
        .from("checklists")
        .select("id, cliente, nome_checklist, proforma, data_prevista, data_tassativa, stato_progetto, noleggio_vendita, tipo_impianto")
        .order("created_at", { ascending: false });
      checklists = (res.data as any[] | null)?.map((row) => ({ ...row, data_disinstallazione: null })) ?? [];
      cErr = res.error;
    }
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    let interventi: any[] | null = null;
    let iErr: any = null;
    {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, ticket_no, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .order("data", { ascending: true });
      interventi = res.data as any[] | null;
      iErr = res.error;
    }
    if (iErr && String(iErr.message || "").toLowerCase().includes("data_tassativa")) {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, ticket_no, data, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
        .order("data", { ascending: true });
      interventi = (res.data as any[] | null)?.map((r) => ({ ...r, data_tassativa: null })) ?? [];
      iErr = res.error;
    }
    if (iErr && String(iErr.message || "").toLowerCase().includes("ticket_no")) {
      const res = await supabaseAdmin
        .from("saas_interventi")
        .select("id, cliente, checklist_id, data, data_tassativa, descrizione, tipo, proforma, stato_intervento, fatturazione_stato")
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
      if (["IN_CORSO", "IN_LAVORAZIONE"].includes(getEffectiveNormalizedStatus((c as any).stato_progetto))) {
        inCorsoChecklistIds.add(id);
      }
    }

    const timeline: any[] = [];

    for (const c of checklists || []) {
      const cc = c as any;
      const statoProgetto = getEffectiveNormalizedStatus(cc.stato_progetto);
      const isNoleggio = normalizeUpper(cc.noleggio_vendita) === "NOLEGGIO";

      if (["IN_CORSO", "IN_LAVORAZIONE"].includes(statoProgetto)) {
        const date = toIsoDay(cc.data_tassativa) || toIsoDay(cc.data_prevista);
        if (date && date >= CUTOFF_DATE) {
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
            tipologia: normalizeUpper(cc.noleggio_vendita || "INSTALLAZIONE"),
            descrizione:
              [cc.tipo_impianto || "", cc.noleggio_vendita || ""].filter(Boolean).join(" · ") ||
              "Installazione pianificata",
            stato: "PIANIFICATA",
            fatto: false,
          });
        }
      }

      if (isNoleggio && ["IN_CORSO", "IN_LAVORAZIONE", "CONSEGNATO"].includes(statoProgetto)) {
        const disinstallDate = toIsoDay(cc.data_disinstallazione);
        if (disinstallDate && disinstallDate >= CUTOFF_DATE) {
          timeline.push({
            kind: "DISINSTALLAZIONE",
            id: `disinstall:${cc.id}`,
            row_ref_id: cc.id,
            data_prevista: disinstallDate,
            data_tassativa: disinstallDate,
            cliente: String(cc.cliente || "—"),
            checklist_id: cc.id,
            progetto: String(cc.nome_checklist || cc.id),
            proforma: cc.proforma ?? null,
            tipologia: "NOLEGGIO",
            descrizione:
              [cc.tipo_impianto || "", "SMONTAGGIO NOLEGGIO"].filter(Boolean).join(" · ") ||
              "Smontaggio noleggio pianificato",
            stato: "PIANIFICATA",
            fatto: false,
          });
        }
      }
    }

    for (const i of interventi || []) {
      const ii = i as any;
      const statoIntervento = String(ii.stato_intervento || "APERTO").trim().toUpperCase();
      if (statoIntervento !== "APERTO") continue;
      const date = toIsoDay(ii.data_tassativa) || toIsoDay(ii.data);
      if (!date || date < CUTOFF_DATE) continue;
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
      .filter((r) => isValidRowKind(r.row_kind) && r.row_ref_id);

    if (normalizedRows.length === 0) {
      return NextResponse.json({ ok: true, meta: {}, comments: {} });
    }

    const installazioneIds = Array.from(
      new Set(
        normalizedRows
          .filter((r) => r.row_kind === "INSTALLAZIONE" || r.row_kind === "DISINSTALLAZIONE")
          .map((r) => r.row_ref_id)
      )
    );
    const interventoIds = Array.from(
      new Set(normalizedRows.filter((r) => r.row_kind === "INTERVENTO").map((r) => r.row_ref_id))
    );

    const allowedInstallazioni = new Set<string>();
    if (installazioneIds.length > 0) {
      const { data: checklistRows, error: checklistErr } = await supabaseAdmin
        .from("checklists")
        .select("id")
        .in("id", installazioneIds as any);
      if (checklistErr) {
        return NextResponse.json({ error: checklistErr.message }, { status: 500 });
      }
      for (const row of checklistRows || []) {
        allowedInstallazioni.add(String((row as any).id));
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
        allowedInterventi.add(String((row as any).id));
      }
    }

    normalizedRows = normalizedRows.filter((r) => {
      if (r.row_kind === "INSTALLAZIONE" || r.row_kind === "DISINSTALLAZIONE") {
        return allowedInstallazioni.has(r.row_ref_id);
      }
      if (r.row_kind === "INTERVENTO") return allowedInterventi.has(r.row_ref_id);
      if (r.row_kind === "CHECKLIST_TASK") return true;
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
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const payload = {
      row_kind: rowKind,
      row_ref_id: rowRefId,
      fatto,
      updated_at: new Date().toISOString(),
      updated_by_operatore: operatore.id,
    };

    let { data, error } = await supabaseAdmin
      .from("cronoprogramma_meta")
      .upsert(payload, { onConflict: "row_kind,row_ref_id" })
      .select("*, operatore:updated_by_operatore(nome)")
      .maybeSingle();

    if (error && String(error.message || "").toLowerCase().includes("personale_ids")) {
      const { personale_ids: _skip, ...payloadLegacy } = payload as Record<string, unknown>;
      const retry = await supabaseAdmin
        .from("cronoprogramma_meta")
        .upsert(payloadLegacy, { onConflict: "row_kind,row_ref_id" })
        .select("*, operatore:updated_by_operatore(nome)")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

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
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
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
    if (!(rowKind === "INSTALLAZIONE" || rowKind === "DISINSTALLAZIONE" || rowKind === "INTERVENTO") || !rowRefId) {
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

  if (action === "start_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const { data: existingOpen, error: existingErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_CORSO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    if (existingOpen?.id) {
      return NextResponse.json({ error: "Timbratura già in corso per questa attività" }, { status: 409 });
    }

    let personaleId: string | null = null;
    try {
      personaleId = await loadOperatorePersonaleId(supabaseAdmin, operatore.id);
    } catch (err: any) {
      return NextResponse.json({ error: String(err?.message || "Errore caricamento personale operatore") }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin.from("cronoprogramma_timbrature").insert({
      row_kind: rowKind,
      row_ref_id: rowRefId,
      operatore_id: operatore.id,
      personale_id: personaleId,
      started_at: nowIso,
      stato: "IN_CORSO",
      updated_at: nowIso,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "pause_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const { data: openTimbratura, error: openErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_CORSO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }
    if (!openTimbratura?.id) {
      return NextResponse.json({ error: "Nessuna attività in corso da mettere in pausa" }, { status: 404 });
    }

    const { data: openInterval, error: intervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .select("id, started_at")
      .eq("timbratura_id", openTimbratura.id)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intervalErr) {
      return NextResponse.json({ error: intervalErr.message }, { status: 500 });
    }
    if (!openInterval?.id) {
      return NextResponse.json({ error: "Nessun intervallo attivo da mettere in pausa" }, { status: 404 });
    }

    const now = new Date();
    const startedAt = new Date(String(openInterval.started_at || ""));
    const durationMinutes = Number.isFinite(startedAt.getTime())
      ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000))
      : 0;

    const { error: closeIntervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .update({
        ended_at: now.toISOString(),
        durata_minuti: durationMinutes,
      })
      .eq("id", openInterval.id);

    if (closeIntervalErr) {
      return NextResponse.json({ error: closeIntervalErr.message }, { status: 500 });
    }

    const { error: pauseErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .update({
        stato: "IN_PAUSA",
        updated_at: now.toISOString(),
      })
      .eq("id", openTimbratura.id);

    if (pauseErr) {
      return NextResponse.json({ error: pauseErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "resume_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const { data: pausedTimbratura, error: pausedErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_PAUSA")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pausedErr) {
      return NextResponse.json({ error: pausedErr.message }, { status: 500 });
    }
    if (!pausedTimbratura?.id) {
      return NextResponse.json({ error: "Nessuna attività in pausa da riprendere" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const { error: createIntervalErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature_intervalli")
      .insert({
        timbratura_id: pausedTimbratura.id,
        started_at: nowIso,
      });

    if (createIntervalErr) {
      return NextResponse.json({ error: createIntervalErr.message }, { status: 500 });
    }

    const { error: resumeErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .update({
        stato: "IN_CORSO",
        updated_at: nowIso,
      })
      .eq("id", pausedTimbratura.id);

    if (resumeErr) {
      return NextResponse.json({ error: resumeErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "stop_timbratura") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    if (!isValidRowKind(rowKind) || !isUuidLike(rowRefId)) {
      return NextResponse.json({ error: "row_kind/row_ref_id non validi" }, { status: 400 });
    }

    const { data: openTimbratura, error: openErr } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .select("id, started_at")
      .eq("row_kind", rowKind)
      .eq("row_ref_id", rowRefId)
      .eq("operatore_id", operatore.id)
      .eq("stato", "IN_CORSO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }
    if (!openTimbratura?.id) {
      return NextResponse.json({ error: "Nessuna timbratura aperta per questa attività" }, { status: 404 });
    }

    const now = new Date();
    const startedAt = new Date(String(openTimbratura.started_at || ""));
    const durationMinutes = Number.isFinite(startedAt.getTime())
      ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000))
      : 0;

    const { error } = await supabaseAdmin
      .from("cronoprogramma_timbrature")
      .update({
        ended_at: now.toISOString(),
        stato: "COMPLETATA",
        durata_effettiva_minuti: durationMinutes,
        updated_at: now.toISOString(),
      })
      .eq("id", openTimbratura.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, durata_effettiva_minuti: durationMinutes });
  }

  if (action === "add_comment") {
    const rowKind = String(body?.row_kind || "").trim().toUpperCase();
    const rowRefId = String(body?.row_ref_id || "").trim();
    const commento = String(body?.commento || "").trim();
    if (!isValidRowKind(rowKind) || !rowRefId) {
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
