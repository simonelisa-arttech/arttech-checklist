export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOperatore } from "@/lib/adminAuth";
import { calcM2FromDimensioni, parseDimensioniToWH } from "@/lib/parseDimensioni";

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

type CatalogLookup = Map<string, { codice: string; descrizione: string | null }>;

type SupportedDelimiter = ";" | "," | "\t";

type ParsedCsvCandidate = {
  delimiter: SupportedDelimiter;
  rows: string[][];
  firstRowColumns: number;
  headerCount: number;
  matchedHeaders: number;
  hasRequiredHeaders: boolean;
  originalHeaders: string[];
  normalizedHeaders: string[];
};

const SUPPORTED_DELIMITERS: SupportedDelimiter[] = [";", ",", "\t"];

const EMPTY_DATE_PLACEHOLDERS = new Set(["-", "—", "", "n.d.", "nd", "null"]);

const HEADER_ALIASES = new Map<string, string>([
  ["nome progetto", "nome_progetto"],
  ["nomeprogetto", "nome_progetto"],
  ["rif progetto", "nome_progetto"],
  ["rif_progetto", "nome_progetto"],
  ["rif. progetto", "nome_progetto"],
  ["codice progetto", "codice_progetto"],
  ["codiceprogetto", "codice_progetto"],
  ["referente cliente", "referente_cliente"],
  ["contatto referente", "contatto_referente"],
  ["link drive magazzino", "link_drive_magazzino"],
  ["seriali elettroniche controllo", "seriali_elettroniche_controllo"],
  ["seriali moduli led", "seriali_moduli_led"],
  ["descrizione impianto", "descrizione_impianto"],
  ["quantita impianti", "quantita_impianti"],
  ["tipo impianto", "tipo_impianto"],
  ["data installazione reale", "data_installazione_reale"],
  ["piano saas", "piano_saas"],
  ["servizio saas aggiuntivo", "servizio_saas_aggiuntivo"],
  ["saas scadenza", "saas_scadenza"],
  ["garanzia scadenza", "garanzia_scadenza"],
  ["tipo struttura", "tipo_struttura"],
  ["saas note", "saas_note"],
  ["accessori ricambi", "accessori_ricambi"],
  ["stato progetto", "stato_progetto"],
  ["nome checklist", "nome_checklist"],
  ["email cliente", "email_cliente"],
]);

const EXPECTED_IMPORT_HEADERS = new Set(
  [
    "cliente",
    "nome_progetto",
    "codice_progetto",
    "tipo",
    "stato",
    "indirizzo",
    "referente_cliente",
    "contatto_referente",
    "data_prevista",
    "data_tassativa",
    "codice_magazzino",
    "link_drive_magazzino",
    "seriali_elettroniche_controllo",
    "seriali_elettroniche",
    "seriali_moduli_led",
    "descrizione_impianto",
    "passo",
    "quantita_impianti",
    "dimensioni",
    "tipo_impianto",
    "data_installazione_reale",
    "piano_saas",
    "servizio_saas_aggiuntivo",
    "saas_scadenza",
    "garanzia_scadenza",
    "tipo_struttura",
    "saas_note",
    "licenze",
    "accessori_ricambi",
    "proforma",
    "stato_progetto",
    "nome_checklist",
    "email",
    "email_cliente",
    "note",
  ].map((value) => normalizeHeader(value))
);

const REQUIRED_IMPORT_HEADERS = ["cliente", "nome_progetto"].map((value) => normalizeHeader(value));

function normalizeHeader(value: string) {
  const cleaned = String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060\u00A0]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "_")
    .replace(/[().:]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliasKey = cleaned.replace(/_/g, " ");
  return HEADER_ALIASES.get(aliasKey) || cleaned;
}

function normalizeCell(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? "" : trimmed;
}

function normalizeDecimalInput(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { value: "", changed: false };
  const normalized = trimmed.replace(/,/g, ".");
  return { value: normalized, changed: normalized !== trimmed };
}

function normalizeProformaInput(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { value: "", changed: false };
  const normalized = trimmed.replace(/_/g, "/");
  return { value: normalized, changed: normalized !== trimmed };
}

function formatDimensionNumber(value: number) {
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");
}

function normalizeDimensioniInput(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return { value: "", m2: null as number | null, changed: false };
  }

  const preNormalized = trimmed
    .replace(/_/g, ".")
    .replace(/,/g, ".")
    .replace(/[×*]/g, "x")
    .replace(/\s+/g, " ")
    .trim();

  const wh = parseDimensioniToWH(preNormalized);
  const normalized = wh
    ? `${formatDimensionNumber(wh.larghezza)}x${formatDimensionNumber(wh.altezza)}`
    : preNormalized.replace(/\s*x\s*/gi, "x");

  return {
    value: normalized,
    m2: calcM2FromDimensioni(normalized, 1),
    changed: normalized !== trimmed,
  };
}

function parseDelimitedRows(input: string, delimiter: SupportedDelimiter) {
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

    if (!inQuotes && ch === delimiter) {
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

function getFirstNonEmptyLine(input: string) {
  const lines = input.split(/\r?\n/);
  return lines.find((line) => String(line || "").trim() !== "") || "";
}

function scoreParsedCandidate(rows: string[][], delimiter: SupportedDelimiter): ParsedCsvCandidate {
  const headerRow = rows[0] || [];
  const normalizedHeaders = headerRow
    .map((value) => normalizeHeader(value))
    .filter(Boolean);
  const firstRowColumns = headerRow.filter((value, index) => {
    if (index === 0) return true;
    return normalizeCell(value) !== "";
  }).length;
  const headerCount = normalizedHeaders.length;
  const matchedHeaders = normalizedHeaders.filter((header) => EXPECTED_IMPORT_HEADERS.has(header)).length;
  const hasRequiredHeaders = REQUIRED_IMPORT_HEADERS.every((header) => normalizedHeaders.includes(header));
  return {
    delimiter,
    rows,
    firstRowColumns,
    headerCount,
    matchedHeaders,
    hasRequiredHeaders,
    originalHeaders: headerRow.map((value) => String(value || "")),
    normalizedHeaders,
  };
}

function detectCsvDelimiter(input: string) {
  const firstLine = getFirstNonEmptyLine(input);
  if (!firstLine) {
    throw new Error("Impossibile rilevare separatore CSV/TSV");
  }

  const candidates = SUPPORTED_DELIMITERS.map((delimiter) =>
    scoreParsedCandidate(parseDelimitedRows(input, delimiter), delimiter)
  );
  const firstLineColumns = new Map<SupportedDelimiter, number>(
    SUPPORTED_DELIMITERS.map((delimiter) => [delimiter, (parseDelimitedRows(firstLine, delimiter)[0] || []).length])
  );
  const bestColumnCount = Math.max(...SUPPORTED_DELIMITERS.map((delimiter) => firstLineColumns.get(delimiter) || 0));

  if (bestColumnCount < 2) {
    throw new Error("Impossibile rilevare separatore CSV/TSV");
  }

  const widest = candidates.filter(
    (candidate) => (firstLineColumns.get(candidate.delimiter) || 0) === bestColumnCount
  );

  const valid = widest.filter((candidate) => candidate.hasRequiredHeaders);

  if (valid.length === 1) {
    return valid[0];
  }

  if (valid.length > 1) {
    const bestScore = Math.max(...valid.map((candidate) => candidate.matchedHeaders));
    const best = valid.filter((candidate) => candidate.matchedHeaders === bestScore);
    if (best.length === 1) {
      return best[0];
    }

    const bestHeaderCount = Math.max(...best.map((candidate) => candidate.headerCount));
    const narrowed = best.filter((candidate) => candidate.headerCount === bestHeaderCount);
    if (narrowed.length === 1) {
      return narrowed[0];
    }

    throw new Error(
      `delimitatore ambiguo: trovati più formati possibili (${narrowed
        .map((candidate) => formatDelimiterLabel(candidate.delimiter))
        .join(", ")})`
    );
  }

  const fallbackScore = Math.max(...widest.map((candidate) => candidate.matchedHeaders));
  const fallback = widest.filter((candidate) => candidate.matchedHeaders === fallbackScore);
  if (fallback.length === 1 && fallback[0].matchedHeaders > 0) {
    return fallback[0];
  }

  throw new Error("Impossibile rilevare separatore CSV/TSV");
}

function formatDelimiterLabel(delimiter: SupportedDelimiter) {
  if (delimiter === "\t") return "tab";
  if (delimiter === ";") return ";";
  return ",";
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

function normalizeOptionalDateInput(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase();
  return EMPTY_DATE_PLACEHOLDERS.has(normalized) ? "" : trimmed;
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = normalizeOptionalDateInput(value);
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`data non valida: ${trimmed}`);
  }
  return trimmed;
}

function parseOptionalPositiveInteger(value: string | undefined, fieldLabel: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} non valido: ${trimmed}`);
  }
  return parsed;
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

function normalizeCatalogCode(value: string) {
  return String(value || "").trim().toUpperCase();
}

function splitMultiValue(value: string | undefined) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[\n,|]+/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function splitSerials(value: string | undefined) {
  return splitMultiValue(value);
}

function isValidEmail(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  return trimmed.includes("@");
}

function mergeNoteSections(...values: Array<string | null | undefined>) {
  const out = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return out.length > 0 ? out.join("\n") : null;
}

function isColumnMissingError(error: any, column: string) {
  const msg = `${error?.message || ""}`.toLowerCase();
  const details = `${error?.details || ""}`.toLowerCase();
  const hint = `${error?.hint || ""}`.toLowerCase();
  const code = `${error?.code || ""}`.toLowerCase();
  const needle = column.toLowerCase();
  return (
    code === "pgrst204" ||
    msg.includes(`'${needle}'`) ||
    msg.includes(`"${needle}"`) ||
    msg.includes(`${needle} does not exist`) ||
    details.includes(needle) ||
    hint.includes(needle)
  );
}

function stripUnsupportedChecklistColumns(
  payload: Record<string, any>,
  error: any,
  strippedColumns: Set<string>
) {
  const optionalColumns = Object.keys(payload).filter((key) => payload[key] !== undefined);
  const matched = optionalColumns.find((column) => isColumnMissingError(error, column));
  if (!matched) return false;
  delete payload[matched];
  strippedColumns.add(matched);
  return true;
}

async function insertChecklistWithFallback(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  payload: Record<string, any>
) {
  const workingPayload = { ...payload };
  const strippedColumns = new Set<string>();

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("checklists")
      .insert(workingPayload)
      .select("id")
      .single();
    if (!error) {
      return {
        id: String(data?.id || ""),
        strippedColumns,
      };
    }
    if (!stripUnsupportedChecklistColumns(workingPayload, error, strippedColumns)) {
      throw error;
    }
  }
}

async function updateChecklistWithFallback(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  payload: Record<string, any>
) {
  const workingPayload = { ...payload };
  const strippedColumns = new Set<string>();

  for (;;) {
    const { error } = await supabaseAdmin
      .from("checklists")
      .update(workingPayload)
      .eq("id", checklistId);
    if (!error) {
      return { strippedColumns };
    }
    if (!stripUnsupportedChecklistColumns(workingPayload, error, strippedColumns)) {
      throw error;
    }
  }
}

async function loadCatalogLookup(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabaseAdmin
    .from("catalog_items")
    .select("codice, descrizione, attivo")
    .eq("attivo", true);
  if (error) throw error;

  const lookup: CatalogLookup = new Map();
  for (const row of (data || []) as Array<{ codice?: string | null; descrizione?: string | null }>) {
    const code = normalizeCatalogCode(String(row?.codice || ""));
    if (!code) continue;
    lookup.set(code, {
      codice: String(row?.codice || "").trim(),
      descrizione: row?.descrizione ? String(row.descrizione).trim() : null,
    });
  }
  return lookup;
}

function collectCatalogWarnings(
  warnings: ImportWarning[],
  rowNumber: number,
  catalogLookup: CatalogLookup,
  input: Array<{ field: string; values: string[] }>
) {
  for (const entry of input) {
    for (const rawValue of entry.values) {
      const normalized = normalizeCatalogCode(rawValue);
      if (!normalized) continue;
      if (catalogLookup.has(normalized)) continue;
      warnings.push({
        row: rowNumber,
        reason: `${entry.field}: codice catalogo non trovato "${rawValue}"`,
      });
    }
  }
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

async function findChecklistByProjectTag(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  projectTag: string
) {
  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("id, nome_checklist, cliente, stato_progetto, proforma")
    .ilike("nome_checklist", `%${projectTag}%`)
    .limit(25);
  if (error) throw error;
  const rows = (data || []) as Array<{
    id: string;
    nome_checklist: string | null;
    cliente: string | null;
    stato_progetto: string | null;
    proforma: string | null;
  }>;
  return (rows.find((row) => normalizeCatalogCode(String(row.nome_checklist || "")) === projectTag) ??
    null) as
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
  nomeChecklist: string
) {
  const { data, error } = await supabaseAdmin
    .from("checklists")
    .select("id, nome_checklist")
    .ilike("nome_checklist", `%${nomeChecklist}%`)
    .or("stato_progetto.is.null,stato_progetto.neq.CHIUSO")
    .limit(25);
  if (error) throw error;
  return ((data || []) as Array<{ nome_checklist?: string | null }>).some(
    (row) => normalizeCatalogCode(String(row.nome_checklist || "")) === nomeChecklist
  );
}

async function insertAssetSerialsCompatible(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  moduliLed: string[],
  elettroniche: string[]
) {
  const wanted = [
    ...elettroniche.map((seriale) => ({
      checklist_id: checklistId,
      tipo: "CONTROLLO",
      seriale,
      note: null,
      device_code: null,
      device_descrizione: null,
    })),
    ...moduliLed.map((seriale) => ({
      checklist_id: checklistId,
      tipo: "MODULO_LED",
      seriale,
      note: null,
      device_code: null,
      device_descrizione: null,
    })),
  ];
  if (!wanted.length) return;

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from("asset_serials")
    .select("tipo, seriale")
    .eq("checklist_id", checklistId);
  if (existingErr) throw existingErr;

  const existing = new Set(
    ((existingRows || []) as Array<{ tipo?: string | null; seriale?: string | null }>).map(
      (row) => `${String(row?.tipo || "").trim().toUpperCase()}::${String(row?.seriale || "").trim().toUpperCase()}`
    )
  );

  const payload = wanted.filter((row) => {
    const key = `${String(row.tipo).trim().toUpperCase()}::${String(row.seriale).trim().toUpperCase()}`;
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  if (!payload.length) return;

  const { error } = await supabaseAdmin.from("asset_serials").insert(payload);
  if (error) throw error;
}

async function insertLicensesCompatible(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  licenses: string[]
) {
  if (!licenses.length) return;

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from("licenses")
    .select("tipo")
    .eq("checklist_id", checklistId);
  if (existingErr) throw existingErr;

  const existing = new Set(
    ((existingRows || []) as Array<{ tipo?: string | null }>).map((row) =>
      normalizeCatalogCode(String(row?.tipo || ""))
    )
  );

  const payload = licenses
    .map((tipo) => tipo.trim())
    .filter(Boolean)
    .filter((tipo) => {
      const key = normalizeCatalogCode(tipo);
      if (!key || existing.has(key)) return false;
      existing.add(key);
      return true;
    })
    .map((tipo) => ({
      checklist_id: checklistId,
      tipo,
      scadenza: null,
      stato: "attiva",
      note: "Import CSV progetti",
    }));

  if (!payload.length) return;

  const { error } = await supabaseAdmin.from("licenses").insert(payload);
  if (error) throw error;
}

async function insertChecklistItemsCompatible(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  items: string[],
  catalogLookup: CatalogLookup
) {
  if (!items.length) return;

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from("checklist_items")
    .select("codice, descrizione")
    .eq("checklist_id", checklistId);
  if (existingErr) throw existingErr;

  const existing = new Set(
    ((existingRows || []) as Array<{ codice?: string | null; descrizione?: string | null }>).map((row) => {
      const code = normalizeCatalogCode(String(row?.codice || ""));
      const description = normalizeTextKey(String(row?.descrizione || ""));
      return `${code}::${description}`;
    })
  );

  const payload: Array<{
    checklist_id: string;
    codice: string | null;
    descrizione: string | null;
    quantita: number;
    note: string | null;
  }> = [];

  for (const rawItem of items) {
    const normalized = normalizeCatalogCode(rawItem);
    const catalogItem = normalized ? catalogLookup.get(normalized) : null;
    const codice = catalogItem?.codice || null;
    const descrizione = catalogItem?.descrizione || rawItem.trim() || null;
    const dedupeKey = `${normalizeCatalogCode(codice || "")}::${normalizeTextKey(descrizione || "")}`;
    if (!descrizione || existing.has(dedupeKey)) continue;
    existing.add(dedupeKey);
    payload.push({
      checklist_id: checklistId,
      codice,
      descrizione,
      quantita: 1,
      note: "Import CSV accessori_ricambi",
    });
  }

  if (!payload.length) return;

  const { error } = await supabaseAdmin.from("checklist_items").insert(payload);
  if (error) throw error;
}

export async function POST(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = auth.adminClient as ReturnType<typeof getSupabaseAdmin>;
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
  let detectedDelimiter: ParsedCsvCandidate;
  try {
    detectedDelimiter = detectCsvDelimiter(csvText);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(error?.message || error || "Impossibile rilevare il delimitatore CSV"),
      },
      { status: 400 }
    );
  }

  console.info("[import-progetti-csv][headers]", {
    delimiter: formatDelimiterLabel(detectedDelimiter.delimiter),
    original_headers: detectedDelimiter.originalHeaders,
    normalized_headers: detectedDelimiter.normalizedHeaders,
  });

  const parsed = csvRowsToObjects(detectedDelimiter.rows);
  if (!parsed.length) {
    return NextResponse.json({ ok: false, error: "CSV vuoto o senza righe valide" }, { status: 400 });
  }

  const catalogLookup = await loadCatalogLookup(supabaseAdmin);
  const seenProjectTags = new Set<string>();

  let inserted = 0;
  let skipped = 0;
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  for (let index = 0; index < parsed.length; index += 1) {
    const row = parsed[index];
    const rowNumber = index + 2;

    try {
      const autoFixFields = new Set<string>();
      const nomeProgettoCsv = getRowValue(row, "nome_progetto");
      const clienteInput = getRowValue(row, "cliente");
      const codiceProgetto = getRowValue(row, "codice_progetto", "nome_checklist");
      const csvProformaRaw = getRowValue(row, "proforma");
      const csvProformaNormalized = normalizeProformaInput(csvProformaRaw);
      if (csvProformaNormalized.changed) autoFixFields.add("proforma");
      const csvProforma = csvProformaNormalized.value;
      const projectTag = normalizeCatalogCode(nomeProgettoCsv);
      const tipo = parseOptionalUpper(getRowValue(row, "tipo"));
      const stato = parseOptionalUpper(getRowValue(row, "stato", "stato_progetto"));
      const dataPrevista = parseOptionalDate(getRowValue(row, "data_prevista"));
      const dataTassativa = parseOptionalDate(getRowValue(row, "data_tassativa"));
      const dataInstallazioneReale = parseOptionalDate(getRowValue(row, "data_installazione_reale"));
      const saasScadenza = parseOptionalDate(getRowValue(row, "saas_scadenza"));
      const garanziaScadenza = parseOptionalDate(getRowValue(row, "garanzia_scadenza"));
      const emailCliente = parseOptionalText(getRowValue(row, "email", "email_cliente"));
      const indirizzo = parseOptionalText(getRowValue(row, "indirizzo"));
      const referenteCliente = parseOptionalText(getRowValue(row, "referente_cliente"));
      const contattoReferente = parseOptionalText(getRowValue(row, "contatto_referente"));
      const codiceMagazzino = parseOptionalText(getRowValue(row, "codice_magazzino"));
      const linkDriveMagazzino = parseOptionalText(getRowValue(row, "link_drive_magazzino"));
      const descrizioneImpianto = parseOptionalText(getRowValue(row, "descrizione_impianto"));
      const passo = parseOptionalText(getRowValue(row, "passo"));
      const quantitaImpiantiRaw = normalizeDecimalInput(getRowValue(row, "quantita_impianti"));
      if (quantitaImpiantiRaw.changed) autoFixFields.add("quantita_impianti");
      const quantitaImpianti = parseOptionalPositiveInteger(
        quantitaImpiantiRaw.value,
        "quantita_impianti"
      );
      const dimensioniNormalized = normalizeDimensioniInput(getRowValue(row, "dimensioni"));
      if (dimensioniNormalized.changed) autoFixFields.add("dimensioni");
      const dimensioni = parseOptionalText(dimensioniNormalized.value);
      const m2Calcolati = dimensioniNormalized.m2;
      const tipoImpianto = parseOptionalUpper(getRowValue(row, "tipo_impianto"));
      const pianoSaas = parseOptionalText(getRowValue(row, "piano_saas"));
      const serviziSaas = splitMultiValue(getRowValue(row, "servizio_saas_aggiuntivo"));
      const tipoStruttura = parseOptionalText(getRowValue(row, "tipo_struttura"));
      const saasNoteInput = parseOptionalText(getRowValue(row, "saas_note"));
      const licenze = splitMultiValue(getRowValue(row, "licenze"));
      const accessoriRicambi = splitMultiValue(getRowValue(row, "accessori_ricambi"));
      const serialiControllo = splitSerials(getRowValue(row, "seriali_elettroniche_controllo", "seriali_elettroniche"));
      const serialiModuliLed = splitSerials(getRowValue(row, "seriali_moduli_led"));
      const legacyNote = parseOptionalText(getRowValue(row, "note"));

      if (!projectTag || !clienteInput) {
        throw new Error("campi obbligatori mancanti: nome_progetto / cliente");
      }

      if (emailCliente && !isValidEmail(emailCliente)) {
        throw new Error(`email non valida: ${emailCliente}`);
      }

      if (projectTag) {
        if (seenProjectTags.has(projectTag)) {
          throw new Error(`nome_progetto duplicato nel CSV: ${projectTag}`);
        }
        seenProjectTags.add(projectTag);
      }

      collectCatalogWarnings(warnings, rowNumber, catalogLookup, [
        { field: "piano_saas", values: pianoSaas ? [pianoSaas] : [] },
        { field: "servizio_saas_aggiuntivo", values: serviziSaas },
        { field: "tipo_struttura", values: tipoStruttura ? [tipoStruttura] : [] },
        { field: "licenze", values: licenze },
        { field: "accessori_ricambi", values: accessoriRicambi },
      ]);

      if (serviziSaas.length > 1) {
        warnings.push({
          row: rowNumber,
          reason: "servizio_saas_aggiuntivo contiene più valori: il primo va in saas_tipo, gli altri restano in saas_note",
        });
      }
      for (const field of autoFixFields) {
        warnings.push({
          row: rowNumber,
          reason: `formato corretto automaticamente: ${field}`,
        });
      }

      const clienteRow = await ensureClienteAnagraficaRow(supabaseAdmin, clienteInput);
      const cliente = clienteRow?.denominazione || clienteInput.trim();

      const similarWarning = await findSimilarProjectWarning(supabaseAdmin, cliente, projectTag);
      if (similarWarning) {
        warnings.push({ row: rowNumber, reason: similarWarning });
      }

      const payloadNote = mergeNoteSections(
        legacyNote,
        codiceProgetto ? `Codice progetto CSV: ${codiceProgetto}` : null,
        referenteCliente || contattoReferente
          ? `Referente cliente: ${[referenteCliente, contattoReferente].filter(Boolean).join(" | ")}`
          : null,
        serviziSaas.length > 1 ? `Servizi SaaS aggiuntivi extra: ${serviziSaas.slice(1).join(", ")}` : null
      );

      const payload: Record<string, any> = {
        nome_checklist: projectTag,
        cliente,
        cliente_id: clienteRow?.id || null,
        proforma: csvProforma ? csvProforma.trim() : null,
        noleggio_vendita: tipo,
        stato_progetto: stato,
        data_prevista: dataPrevista,
        data_tassativa: dataTassativa,
        data_installazione_reale: dataInstallazioneReale,
        magazzino_importazione: codiceMagazzino,
        magazzino_drive_url: linkDriveMagazzino,
        impianto_indirizzo: indirizzo,
        impianto_descrizione: descrizioneImpianto,
        passo,
        impianto_quantita: quantitaImpianti,
        dimensioni,
        m2_calcolati: m2Calcolati,
        m2_inclusi: m2Calcolati,
        tipo_impianto: tipoImpianto,
        saas_piano: pianoSaas,
        saas_tipo: serviziSaas[0] || null,
        saas_scadenza: saasScadenza,
        saas_note: mergeNoteSections(
          saasNoteInput,
          serviziSaas.length > 1 ? `Extra servizi: ${serviziSaas.slice(1).join(", ")}` : null
        ),
        garanzia_scadenza: garanziaScadenza,
        tipo_struttura: tipoStruttura,
        note: payloadNote,
      };

      let checklistId = "";
      let checklistStrippedColumns = new Set<string>();

      if (projectTag) {
        const existingByCode = await findChecklistByProjectTag(supabaseAdmin, projectTag);
        console.info("[import-progetti-csv][dedupe]", {
          row: rowNumber,
          csv_tag: projectTag,
          db_match: existingByCode?.nome_checklist || null,
          checklist_id: existingByCode?.id || null,
        });
        if (existingByCode?.id) {
          if (onConflict === "update") {
            checklistId = existingByCode.id;
            if (!dryRun) {
              const result = await updateChecklistWithFallback(supabaseAdmin, existingByCode.id, payload);
              checklistStrippedColumns = result.strippedColumns;
            }
            warnings.push({
              row: rowNumber,
              reason: `nome_progetto già esistente: aggiornato progetto ${existingByCode.nome_checklist || existingByCode.id}`,
            });
          } else {
            skipped += 1;
            warnings.push({
              row: rowNumber,
              reason: `nome_progetto già esistente: ${projectTag}`,
            });
            continue;
          }
        }
      }

      if (!checklistId) {
        const duplicate = await existsActiveChecklistDuplicate(supabaseAdmin, payload.nome_checklist);
        if (duplicate) {
          skipped += 1;
          warnings.push({
            row: rowNumber,
            reason: `nome_progetto già esistente: ${payload.nome_checklist}`,
          });
          continue;
        }

        if (dryRun) {
          inserted += 1;
          continue;
        }

        const result = await insertChecklistWithFallback(supabaseAdmin, payload);
        checklistId = result.id;
        checklistStrippedColumns = result.strippedColumns;
        inserted += 1;
      }

      for (const strippedColumn of checklistStrippedColumns) {
        warnings.push({
          row: rowNumber,
          reason: `colonna checklist non disponibile nello schema corrente: ${strippedColumn}`,
        });
      }

      if (dryRun) {
        continue;
      }

      const postImportWarnings: string[] = [];

      try {
        await insertAssetSerialsCompatible(
          supabaseAdmin,
          checklistId,
          serialiModuliLed,
          serialiControllo
        );
      } catch (err: any) {
        postImportWarnings.push(`seriali non importati: ${String(err?.message || err)}`);
      }

      try {
        await insertLicensesCompatible(supabaseAdmin, checklistId, licenze);
      } catch (err: any) {
        postImportWarnings.push(`licenze non importate: ${String(err?.message || err)}`);
      }

      try {
        await insertChecklistItemsCompatible(
          supabaseAdmin,
          checklistId,
          accessoriRicambi,
          catalogLookup
        );
      } catch (err: any) {
        postImportWarnings.push(`accessori/ricambi non importati: ${String(err?.message || err)}`);
      }

      for (const warning of postImportWarnings) {
        warnings.push({ row: rowNumber, reason: warning });
      }
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
    delimiter: formatDelimiterLabel(detectedDelimiter.delimiter),
    inserted,
    skipped,
    errors,
    warnings,
  });
}
