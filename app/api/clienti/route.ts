export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmailSecondarieInput } from "@/lib/clientiEmail";
import { isMissingClientiDriveColumnError } from "@/lib/clientiDrive";

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

type ClienteMutationPayload = {
  denominazione?: string | null;
  denominazione_norm?: string | null;
  piva?: string | null;
  codice_fiscale?: string | null;
  codice_sdi?: string | null;
  pec?: string | null;
  email?: string | null;
  email_secondarie?: string | null;
  telefono?: string | null;
  indirizzo?: string | null;
  comune?: string | null;
  cap?: string | null;
  provincia?: string | null;
  paese?: string | null;
  codice_interno?: string | null;
  drive_url?: string | null;
  scadenze_delivery_mode?: "AUTO_CLIENTE" | "MANUALE_INTERNO";
  attivo?: boolean;
};

function getClientIp(request: Request) {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRateLimit(ip: string, limit = 120, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) return true;
  if (origin && host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  if (!origin && referer && host && referer.includes(host)) return true;
  if (!origin && host) return true;
  return false;
}

function assertAuth(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  if (!isAllowedOrigin(request)) return false;
  const ip = getClientIp(request);
  return allowRateLimit(ip);
}

function getSupabaseClient() {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}

function normalizeDenominazione(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

function normalizeOptionalHttpUrl(value: unknown) {
  const raw = `${value || ""}`.trim();
  if (!raw) return { value: null as string | null, error: null as string | null };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { value: null, error: "Il link Drive cliente deve essere un URL http/https valido" };
    }
    return { value: parsed.toString(), error: null };
  } catch {
    return { value: null, error: "Il link Drive cliente deve essere un URL http/https valido" };
  }
}

const DEFAULT_SCADENZE_DELIVERY_MODE = "AUTO_CLIENTE";

function normalizeScadenzeDeliveryMode(
  value: unknown
): "AUTO_CLIENTE" | "MANUALE_INTERNO" {
  const raw = String(value || "").trim().toUpperCase();
  return raw === "MANUALE_INTERNO" ? "MANUALE_INTERNO" : "AUTO_CLIENTE";
}

function isMissingClientiScadenzeDeliveryModeColumnError(error: any) {
  return String(error?.message || "")
    .toLowerCase()
    .includes("scadenze_delivery_mode");
}

function isMissingClientiEmailSecondarieColumnError(error: any) {
  return String(error?.message || "")
    .toLowerCase()
    .includes("email_secondarie");
}

function isOptionalClientiColumnSelectError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("column") || msg.includes("schema cache");
}

function stripClientiOptionalColumns(selectClause: string, error: any) {
  const msg = String(error?.message || "").toLowerCase();
  const shouldStripAll =
    isOptionalClientiColumnSelectError(error) &&
    !msg.includes("drive_url") &&
    !msg.includes("email_secondarie") &&
    !msg.includes("scadenze_delivery_mode");

  let nextSelect = selectClause;
  let missingDriveUrl = false;
  let missingEmailSecondarie = false;
  let missingScadenzeDeliveryMode = false;

  if ((shouldStripAll || isMissingClientiDriveColumnError(error)) && nextSelect.includes("drive_url")) {
    nextSelect = stripSelectColumn(nextSelect, "drive_url");
    missingDriveUrl = true;
  }
  if (
    (shouldStripAll || isMissingClientiEmailSecondarieColumnError(error)) &&
    nextSelect.includes("email_secondarie")
  ) {
    nextSelect = stripSelectColumn(nextSelect, "email_secondarie");
    missingEmailSecondarie = true;
  }
  if (
    (shouldStripAll || isMissingClientiScadenzeDeliveryModeColumnError(error)) &&
    nextSelect.includes("scadenze_delivery_mode")
  ) {
    nextSelect = stripSelectColumn(nextSelect, "scadenze_delivery_mode");
    missingScadenzeDeliveryMode = true;
  }

  return {
    nextSelect,
    missingDriveUrl,
    missingEmailSecondarie,
    missingScadenzeDeliveryMode,
  };
}

function stripSelectColumn(selectClause: string, columnName: string) {
  return selectClause
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== columnName)
    .join(",");
}

const CLIENTI_BASE_SELECT =
  "id,denominazione,denominazione_norm,piva,codice_fiscale,codice_sdi,pec,email,telefono,indirizzo,comune,cap,provincia,paese,codice_interno,attivo";
const CLIENTI_SELECT_WITH_OPTIONALS = `${CLIENTI_BASE_SELECT},email_secondarie,drive_url,scadenze_delivery_mode`;

function normalizeClienteRow(row: any, options?: { missingScadenzeDeliveryMode?: boolean }) {
  return {
    ...(row || {}),
    email_secondarie: row?.email_secondarie || null,
    drive_url: row?.drive_url || null,
    scadenze_delivery_mode: options?.missingScadenzeDeliveryMode
      ? null
      : normalizeScadenzeDeliveryMode(
          row?.scadenze_delivery_mode || DEFAULT_SCADENZE_DELIVERY_MODE
        ),
  };
}

async function enrichClientiOptionalFields(supabase: any, rows: any[]) {
  const ids = Array.from(
    new Set(
      (rows || [])
        .map((row: any) => String(row?.id || "").trim())
        .filter(Boolean)
    )
  );
  if (ids.length === 0) return rows || [];

  let selectClause = "id,email_secondarie,drive_url,scadenze_delivery_mode";
  let data: any[] | null = null;
  let error: any = null;
  let missingScadenzeDeliveryMode = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase.from("clienti_anagrafica").select(selectClause).in("id", ids);
    data = result.data;
    error = result.error;
    if (!error) break;

    const fallback = stripClientiOptionalColumns(selectClause, error);
    let nextSelect = fallback.nextSelect;
    missingScadenzeDeliveryMode =
      missingScadenzeDeliveryMode || fallback.missingScadenzeDeliveryMode;
    if (nextSelect === selectClause) break;
    selectClause = nextSelect || "id";
  }

  if (error) {
    if (
      isMissingClientiDriveColumnError(error) ||
      isMissingClientiEmailSecondarieColumnError(error) ||
      isMissingClientiScadenzeDeliveryModeColumnError(error)
    ) {
      return (rows || []).map((row: any) =>
        normalizeClienteRow(row, { missingScadenzeDeliveryMode })
      );
    }
    throw error;
  }

  const byId = new Map(
    (data || []).map((row: any) => [
      String(row?.id || "").trim(),
      normalizeClienteRow(row, { missingScadenzeDeliveryMode }),
    ])
  );

  return (rows || []).map((row: any) => ({
    ...normalizeClienteRow(row, { missingScadenzeDeliveryMode }),
    ...(byId.get(String(row?.id || "").trim()) || {}),
  }));
}

export async function GET(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limitParam = Number(url.searchParams.get("limit") || 50);
  const offsetParam = Number(url.searchParams.get("offset") || 0);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;
  const qNorm = normalizeDenominazione(q);
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  const buildQuery = (selectClause: string) => {
    let query = supabase
      .from("clienti_anagrafica")
      .select(selectClause)
      .order("denominazione", { ascending: true })
      .range(offset, offset + limit - 1);

    if (!includeInactive) {
      query = query.eq("attivo", true);
    }

    if (qNorm) {
      const like = `%${qNorm}%`;
      query = query.or(
        [
          `denominazione.ilike.%${q}%`,
          `denominazione_norm.ilike.${like}`,
          `codice_interno.ilike.%${q}%`,
          `piva.ilike.%${q}%`,
          `codice_fiscale.ilike.%${q}%`,
        ].join(",")
      );
    }

    return query;
  };

  let selectClause = CLIENTI_SELECT_WITH_OPTIONALS;
  let missingScadenzeDeliveryMode = false;
  let missingEmailSecondarie = false;
  let missingDriveUrl = false;
  let data: any[] | null = null;
  let error: any = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await buildQuery(selectClause);
    data = result.data;
    error = result.error;
    if (!error) break;

    if (!isOptionalClientiColumnSelectError(error)) {
      break;
    }

    const fallback = stripClientiOptionalColumns(selectClause, error);
    const nextSelect = fallback.nextSelect;
    missingScadenzeDeliveryMode =
      missingScadenzeDeliveryMode || fallback.missingScadenzeDeliveryMode;
    missingEmailSecondarie = missingEmailSecondarie || fallback.missingEmailSecondarie;
    missingDriveUrl = missingDriveUrl || fallback.missingDriveUrl;
    if (nextSelect === selectClause) break;
    selectClause = nextSelect || CLIENTI_BASE_SELECT;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = ((data || []) as any[]).map((row) =>
    normalizeClienteRow(
      {
        ...row,
        email_secondarie: missingEmailSecondarie ? null : row?.email_secondarie ?? null,
        drive_url: missingDriveUrl ? null : row?.drive_url ?? null,
        scadenze_delivery_mode: missingScadenzeDeliveryMode ? null : row?.scadenze_delivery_mode ?? null,
      },
      { missingScadenzeDeliveryMode }
    )
  );

  return NextResponse.json({ ok: true, data: normalized });
}

export async function POST(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = await request.json();
  const denominazione = `${body?.denominazione || ""}`.trim();
  if (!denominazione) {
    return NextResponse.json({ error: "Denominazione obbligatoria" }, { status: 400 });
  }
  const driveUrl = normalizeOptionalHttpUrl(body?.drive_url);
  if (driveUrl.error) {
    return NextResponse.json({ error: driveUrl.error }, { status: 400 });
  }
  const secondaryEmails = normalizeEmailSecondarieInput(body?.email_secondarie);
  if (secondaryEmails.error) {
    return NextResponse.json({ error: secondaryEmails.error }, { status: 400 });
  }
  const payload: ClienteMutationPayload = {
    denominazione,
    denominazione_norm: normalizeDenominazione(denominazione),
    piva: `${body?.piva || ""}`.trim() || null,
    codice_fiscale: `${body?.codice_fiscale || ""}`.trim() || null,
    codice_sdi: `${body?.codice_sdi || ""}`.trim() || null,
    pec: `${body?.pec || ""}`.trim() || null,
    email: `${body?.email || ""}`.trim() || null,
    email_secondarie: secondaryEmails.value,
    telefono: `${body?.telefono || ""}`.trim() || null,
    indirizzo: `${body?.indirizzo || ""}`.trim() || null,
    comune: `${body?.comune || ""}`.trim() || null,
    cap: `${body?.cap || ""}`.trim() || null,
    provincia: `${body?.provincia || ""}`.trim() || null,
    paese: `${body?.paese || ""}`.trim() || null,
    codice_interno: `${body?.codice_interno || ""}`.trim() || null,
    drive_url: driveUrl.value,
    scadenze_delivery_mode: normalizeScadenzeDeliveryMode(body?.scadenze_delivery_mode),
    attivo: typeof body?.attivo === "boolean" ? body.attivo : true,
  };
  let warningParts: string[] = [];
  let mutationPayload: ClienteMutationPayload = { ...payload };
  let selectClause = CLIENTI_SELECT_WITH_OPTIONALS;
  let data: any = null;
  let error: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase
      .from("clienti_anagrafica")
      .insert(mutationPayload)
      .select(selectClause)
      .single();
    data = result.data;
    error = result.error;
    if (!error) break;

    let changed = false;
    const stripAllOptionals = isOptionalClientiColumnSelectError(error);
    if ((stripAllOptionals || isMissingClientiDriveColumnError(error)) && "drive_url" in mutationPayload) {
      const { drive_url: _skip, ...legacyPayload } = mutationPayload;
      mutationPayload = legacyPayload;
      selectClause = stripSelectColumn(selectClause, "drive_url") || CLIENTI_BASE_SELECT;
      warningParts.push(
        "Il link Drive non e' stato salvato: colonna non disponibile nello schema cache / ambiente non migrato."
      );
      changed = true;
    }
    if (
      (stripAllOptionals || isMissingClientiEmailSecondarieColumnError(error)) &&
      "email_secondarie" in mutationPayload
    ) {
      const { email_secondarie: _skip, ...legacyPayload } = mutationPayload;
      mutationPayload = legacyPayload;
      selectClause = stripSelectColumn(selectClause, "email_secondarie") || CLIENTI_BASE_SELECT;
      warningParts.push(
        "Le email secondarie non sono state salvate: colonna non disponibile nello schema cache / ambiente non migrato."
      );
      changed = true;
    }
    if (
      (stripAllOptionals || isMissingClientiScadenzeDeliveryModeColumnError(error)) &&
      "scadenze_delivery_mode" in mutationPayload
    ) {
      console.warn("[api/clienti][POST] scadenze_delivery_mode column missing, retrying without field");
      const { scadenze_delivery_mode: _skip, ...legacyPayload } = mutationPayload;
      mutationPayload = legacyPayload;
      selectClause =
        stripSelectColumn(selectClause, "scadenze_delivery_mode") || CLIENTI_BASE_SELECT;
      warningParts.push(
        "La preferenza invio scadenze non e' stata salvata: colonna non disponibile nello schema cache / ambiente non migrato."
      );
      changed = true;
    }
    if (!changed) break;
  }

  if (error) {
    const msg = error.message || "Errore creazione cliente";
    if (error.code === "23505") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    data: normalizeClienteRow(data),
    warning: warningParts.length > 0 ? warningParts.join(" ") : null,
  });
}

export async function PATCH(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = await request.json();
  const id = `${body?.id || ""}`.trim();
  if (!id) {
    return NextResponse.json({ error: "Id mancante" }, { status: 400 });
  }
  const hasDriveUrl = Object.prototype.hasOwnProperty.call(body || {}, "drive_url");
  const driveUrl = hasDriveUrl
    ? normalizeOptionalHttpUrl(body?.drive_url)
    : { value: null as string | null, error: null as string | null };
  if (driveUrl.error) {
    return NextResponse.json({ error: driveUrl.error }, { status: 400 });
  }
  const hasSecondaryEmails = Object.prototype.hasOwnProperty.call(body || {}, "email_secondarie");
  const secondaryEmails = hasSecondaryEmails
    ? normalizeEmailSecondarieInput(body?.email_secondarie)
    : { value: null as string | null, error: null as string | null };
  if (secondaryEmails.error) {
    return NextResponse.json({ error: secondaryEmails.error }, { status: 400 });
  }

  const denominazione = body?.denominazione != null ? `${body.denominazione}`.trim() : "";
  const payload: ClienteMutationPayload = {
    piva: `${body?.piva || ""}`.trim() || null,
    codice_fiscale: `${body?.codice_fiscale || ""}`.trim() || null,
    codice_sdi: `${body?.codice_sdi || ""}`.trim() || null,
    pec: `${body?.pec || ""}`.trim() || null,
    email: `${body?.email || ""}`.trim() || null,
    telefono: `${body?.telefono || ""}`.trim() || null,
    indirizzo: `${body?.indirizzo || ""}`.trim() || null,
    comune: `${body?.comune || ""}`.trim() || null,
    cap: `${body?.cap || ""}`.trim() || null,
    provincia: `${body?.provincia || ""}`.trim() || null,
    paese: `${body?.paese || ""}`.trim() || null,
    codice_interno: `${body?.codice_interno || ""}`.trim() || null,
  };
  if (hasDriveUrl) {
    payload.drive_url = driveUrl.value;
  }
  if (hasSecondaryEmails) {
    payload.email_secondarie = secondaryEmails.value;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, "scadenze_delivery_mode")) {
    payload.scadenze_delivery_mode = normalizeScadenzeDeliveryMode(body?.scadenze_delivery_mode);
  }

  if (typeof body?.attivo === "boolean") {
    payload.attivo = body.attivo;
  }

  if (denominazione) {
    payload.denominazione = denominazione;
    payload.denominazione_norm = normalizeDenominazione(denominazione);
  }
  let warningParts: string[] = [];
  let mutationPayload: ClienteMutationPayload = { ...payload };
  let selectClause = CLIENTI_SELECT_WITH_OPTIONALS;
  let data: any = null;
  let error: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase
      .from("clienti_anagrafica")
      .update(mutationPayload)
      .eq("id", id)
      .select(selectClause)
      .single();
    data = result.data;
    error = result.error;
    if (!error) break;

    let changed = false;
    const stripAllOptionals = isOptionalClientiColumnSelectError(error);
    if ((stripAllOptionals || isMissingClientiDriveColumnError(error)) && "drive_url" in mutationPayload) {
      const { drive_url: _skip, ...legacyPayload } = mutationPayload;
      mutationPayload = legacyPayload;
      selectClause = stripSelectColumn(selectClause, "drive_url") || CLIENTI_BASE_SELECT;
      warningParts.push(
        "Il link Drive non e' stato salvato: colonna non disponibile nello schema cache / ambiente non migrato."
      );
      changed = true;
    }
    if (
      (stripAllOptionals || isMissingClientiEmailSecondarieColumnError(error)) &&
      "email_secondarie" in mutationPayload
    ) {
      const { email_secondarie: _skip, ...legacyPayload } = mutationPayload;
      mutationPayload = legacyPayload;
      selectClause = stripSelectColumn(selectClause, "email_secondarie") || CLIENTI_BASE_SELECT;
      warningParts.push(
        "Le email secondarie non sono state salvate: colonna non disponibile nello schema cache / ambiente non migrato."
      );
      changed = true;
    }
    if (
      (stripAllOptionals || isMissingClientiScadenzeDeliveryModeColumnError(error)) &&
      "scadenze_delivery_mode" in mutationPayload
    ) {
      console.warn("[api/clienti][PATCH] scadenze_delivery_mode column missing, retrying without field");
      const { scadenze_delivery_mode: _skip, ...legacyPayload } = mutationPayload;
      mutationPayload = legacyPayload;
      selectClause =
        stripSelectColumn(selectClause, "scadenze_delivery_mode") || CLIENTI_BASE_SELECT;
      warningParts.push(
        "La preferenza invio scadenze non e' stata salvata: colonna non disponibile nello schema cache / ambiente non migrato."
      );
      changed = true;
    }
    if (!changed) break;
  }

  if (error) {
    const msg = error.message || "Errore modifica cliente";
    if (error.code === "23505") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    data: normalizeClienteRow(data),
    warning: warningParts.length > 0 ? warningParts.join(" ") : null,
  });
}

export async function DELETE(request: Request) {
  if (!assertAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const id = `${body?.id || ""}`.trim();
  if (!id) {
    return NextResponse.json({ error: "Id mancante" }, { status: 400 });
  }

  const { error } = await supabase.from("clienti_anagrafica").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message || "Errore eliminazione cliente" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
