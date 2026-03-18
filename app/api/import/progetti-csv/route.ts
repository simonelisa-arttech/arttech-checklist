export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CsvRow = Record<string, string>;

type ImportError = {
  row: number;
  reason: string;
};

type ImportWarning = {
  row: number;
  reason: string;
};

type ProjectImportMode = "skip" | "update";

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

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function normalizeCell(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? "" : trimmed;
}

function parseCsvSemicolon(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ";") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function csvRowsToObjects(rows: string[][]): CsvRow[] {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => normalizeHeader(value));
  const out: CsvRow[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const source = rows[i];
    const isEmpty = source.every((value) => normalizeCell(value) === "");
    if (isEmpty) continue;

    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      if (!key) continue;
      row[key] = normalizeCell(source[j] || "");
    }
    out.push(row);
  }

  return out;
}

function getRowValue(row: CsvRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (String(value || "").trim()) return String(value).trim();
  }
  return "";
}

function parseOptionalText(value: string | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function parseOptionalUpper(value: string | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`data non valida: ${trimmed}`);
  }
  return trimmed;
}

function parseBooleanLike(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeTextKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

function isValidEmail(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  return trimmed.includes("@");
}

async function ensureClienteAnagraficaRow(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  cliente: string
) {
  const denominazione = String(cliente || "").trim();
  if (!denominazione) return null;
  const denominazioneNorm = normalizeTextKey(denominazione);

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from("clienti_anagrafica")
    .select("id, denominazione")
    .eq("denominazione_norm", denominazioneNorm)
    .limit(1);
  if (existingErr) throw existingErr;

  const existing = (existingRows || [])[0] as { id?: string | null; denominazione?: string | null } | undefined;
  if (existing?.id) {
    return {
      id: String(existing.id),
      denominazione: String(existing.denominazione || denominazione).trim() || denominazione,
    };
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("clienti_anagrafica")
    .insert({
      denominazione,
      denominazione_norm: denominazioneNorm,
      attivo: true,
      email: null,
    } as any)
    .select("id, denominazione")
    .single();
  if (insertErr) throw insertErr;

  return {
    id: String(inserted?.id || "").trim(),
    denominazione: String(inserted?.denominazione || denominazione).trim() || denominazione,
  };
}

async function findChecklistByCodiceProgetto(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  codiceProgetto: string
) {
  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("id, nome_checklist, cliente, stato_progetto, proforma")
    .eq("proforma", codiceProgetto)
    .limit(1);
  if (error) throw error;
  return ((data || [])[0] ?? null) as
    | {
        id: string;
        nome_checklist: string | null;
        cliente: string | null;
        stato_progetto: string | null;
        proforma: string | null;
      }
    | null;
}

async function findSimilarProjectWarning(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  cliente: string,
  nomeProgetto: string
) {
  const normalizedNome = normalizeTextKey(nomeProgetto);
  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("id, nome_checklist")
    .eq("cliente", cliente)
    .limit(200);
  if (error) throw error;

  const similar = (data || []).find((row: any) => {
    const existing = normalizeTextKey(String(row?.nome_checklist || ""));
    if (!existing) return false;
    return existing === normalizedNome || existing.includes(normalizedNome) || normalizedNome.includes(existing);
  });
  if (!similar) return null;
  return `nome simile già presente per il cliente: ${String(similar.nome_checklist || "").trim() || "progetto esistente"}`;
}

async function existsActiveChecklistDuplicate(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  nomeChecklist: string,
  cliente: string
) {
  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("id")
    .eq("nome_checklist", nomeChecklist)
    .eq("cliente", cliente)
    .or("stato_progetto.is.null,stato_progetto.neq.CHIUSO")
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function POST(request: Request) {
  if (!(await assertAuthenticated(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const dryRun = parseBooleanLike(form.get("dry_run"));
  const modeRaw = String(form.get("on_conflict") || "")
    .trim()
    .toLowerCase();
  const onConflict: ProjectImportMode = modeRaw === "update" ? "update" : "skip";

  const csvText = await file.text();
  const parsed = csvRowsToObjects(parseCsvSemicolon(csvText));
  if (!parsed.length) {
    return NextResponse.json({ ok: false, error: "CSV vuoto o senza righe valide" }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  for (let index = 0; index < parsed.length; index += 1) {
    const row = parsed[index];
    const rowNumber = index + 2;

    try {
      const nomeProgetto = getRowValue(row, "nome_progetto", "nome_checklist");
      const clienteInput = getRowValue(row, "cliente");
      const codiceProgetto = getRowValue(row, "codice_progetto", "proforma");
      const tipo = parseOptionalUpper(getRowValue(row, "tipo"));
      const stato = parseOptionalUpper(getRowValue(row, "stato", "stato_progetto"));
      const dataPrevista = parseOptionalDate(getRowValue(row, "data_prevista"));
      const dataTassativa = parseOptionalDate(getRowValue(row, "data_tassativa"));
      const note = parseOptionalText(getRowValue(row, "note"));
      const emailCliente = parseOptionalText(getRowValue(row, "email", "email_cliente"));

      if (!nomeProgetto || !clienteInput) {
        throw new Error("campi obbligatori mancanti: nome_progetto / cliente");
      }

      if (emailCliente && !isValidEmail(emailCliente)) {
        throw new Error(`email non valida: ${emailCliente}`);
      }

      const clienteRow = await ensureClienteAnagraficaRow(supabaseAdmin, clienteInput);
      const cliente = clienteRow?.denominazione || clienteInput.trim();

      const similarWarning = await findSimilarProjectWarning(supabaseAdmin, cliente, nomeProgetto);
      if (similarWarning) {
        warnings.push({ row: rowNumber, reason: similarWarning });
      }

      const payload = {
        nome_checklist: nomeProgetto.trim(),
        cliente,
        cliente_id: clienteRow?.id || null,
        proforma: codiceProgetto ? codiceProgetto.trim() : null,
        noleggio_vendita: tipo,
        stato_progetto: stato,
        data_prevista: dataPrevista,
        data_tassativa: dataTassativa,
        note,
      };

      if (codiceProgetto) {
        const existingByCode = await findChecklistByCodiceProgetto(supabaseAdmin, codiceProgetto.trim());
        if (existingByCode?.id) {
          if (onConflict === "update") {
            if (!dryRun) {
              const { error } = await supabaseAdmin
                .from("checklists")
                .update(payload)
                .eq("id", existingByCode.id);
              if (error) throw error;
            }
            warnings.push({
              row: rowNumber,
              reason: `codice_progetto già esistente: aggiornato progetto ${existingByCode.nome_checklist || existingByCode.id}`,
            });
          } else {
            skipped += 1;
            warnings.push({
              row: rowNumber,
              reason: `codice_progetto già esistente: ${codiceProgetto.trim()}`,
            });
          }
          continue;
        }
      }

      const duplicate = await existsActiveChecklistDuplicate(supabaseAdmin, payload.nome_checklist, cliente);
      if (duplicate) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          reason: "esiste già un progetto attivo con questo nome per questo cliente",
        });
        continue;
      }

      if (dryRun) {
        inserted += 1;
        continue;
      }

      const { error } = await supabaseAdmin.from("checklists").insert(payload);
      if (error) throw error;
      inserted += 1;
    } catch (err: any) {
      errors.push({
        row: rowNumber,
        reason: String(err?.message || err || "errore import"),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    on_conflict: onConflict,
    inserted,
    skipped,
    errors,
    warnings,
  });
}
