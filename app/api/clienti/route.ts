export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isMissingClientiDriveColumnError } from "@/lib/clientiDrive";

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

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

const CLIENTI_BASE_SELECT =
  "id,denominazione,denominazione_norm,piva,codice_fiscale,codice_sdi,pec,email,telefono,indirizzo,comune,cap,provincia,paese,codice_interno,attivo";
const CLIENTI_SELECT_WITH_DRIVE = `${CLIENTI_BASE_SELECT},drive_url`;

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

  const buildQuery = (includeDrive: boolean) => {
    let query = supabase
      .from("clienti_anagrafica")
      .select(includeDrive ? CLIENTI_SELECT_WITH_DRIVE : CLIENTI_BASE_SELECT)
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

  let { data, error } = await buildQuery(true);
  if (error && isMissingClientiDriveColumnError(error)) {
    const fallback = await buildQuery(false);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: data || [] });
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
  const payload = {
    denominazione,
    denominazione_norm: normalizeDenominazione(denominazione),
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
    drive_url: driveUrl.value,
    attivo: typeof body?.attivo === "boolean" ? body.attivo : true,
  };
  let warning: string | null = null;
  let { data, error }: { data: any; error: any } = await supabase
    .from("clienti_anagrafica")
    .insert(payload)
    .select(CLIENTI_SELECT_WITH_DRIVE)
    .single();
  if (error && isMissingClientiDriveColumnError(error)) {
    const { drive_url: _skip, ...legacyPayload } = payload;
    const fallback = await supabase
      .from("clienti_anagrafica")
      .insert(legacyPayload)
      .select(CLIENTI_BASE_SELECT)
      .single();
    data = fallback.data;
    error = fallback.error;
    if (!error && driveUrl.value) {
      warning =
        "Cliente salvato. Il link Drive non e' stato salvato: colonna non disponibile nello schema cache / ambiente non migrato.";
    }
  }

  if (error) {
    const msg = error.message || "Errore creazione cliente";
    if (error.code === "23505") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data, warning });
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
  const driveUrl = normalizeOptionalHttpUrl(body?.drive_url);
  if (driveUrl.error) {
    return NextResponse.json({ error: driveUrl.error }, { status: 400 });
  }

  const denominazione = body?.denominazione != null ? `${body.denominazione}`.trim() : "";
  const payload: Record<string, string | null | boolean> = {
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
    drive_url: driveUrl.value,
  };

  if (typeof body?.attivo === "boolean") {
    payload.attivo = body.attivo;
  }

  if (denominazione) {
    payload.denominazione = denominazione;
    payload.denominazione_norm = normalizeDenominazione(denominazione);
  }
  let warning: string | null = null;
  let { data, error }: { data: any; error: any } = await supabase
    .from("clienti_anagrafica")
    .update(payload)
    .eq("id", id)
    .select(CLIENTI_SELECT_WITH_DRIVE)
    .single();
  if (error && isMissingClientiDriveColumnError(error)) {
    const { drive_url: _skip, ...legacyPayload } = payload;
    const fallback = await supabase
      .from("clienti_anagrafica")
      .update(legacyPayload)
      .eq("id", id)
      .select(CLIENTI_BASE_SELECT)
      .single();
    data = fallback.data;
    error = fallback.error;
    if (!error && driveUrl.value) {
      warning =
        "Cliente salvato. Il link Drive non e' stato salvato: colonna non disponibile nello schema cache / ambiente non migrato.";
    }
  }

  if (error) {
    const msg = error.message || "Errore modifica cliente";
    if (error.code === "23505") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data, warning });
}
