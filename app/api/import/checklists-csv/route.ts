export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CsvRow = Record<string, string>;

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

function parseOptionalText(value: string | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Data non valida: ${trimmed}`);
  }
  return trimmed;
}

function splitSerials(value: string | undefined) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[\n,|]+/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function getRowValue(row: CsvRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (String(value || "").trim()) return String(value).trim();
  }
  return "";
}

async function updateClienteDriveUrlIfPresent(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  cliente: string,
  linkDriveCliente: string
) {
  const trimmedCliente = cliente.trim();
  const trimmedUrl = linkDriveCliente.trim();
  if (!trimmedCliente || !trimmedUrl) return;

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from("clienti_anagrafica")
    .select("id, drive_url")
    .eq("denominazione", trimmedCliente)
    .limit(1);
  if (existingErr) {
    const msg = String(existingErr.message || "").toLowerCase();
    if (msg.includes("drive_url") && msg.includes("does not exist")) return;
    throw new Error(existingErr.message);
  }
  const row = (existingRows || [])[0] as { id?: string; drive_url?: string | null } | undefined;
  if (!row?.id || String(row.drive_url || "").trim()) return;

  const { error: updateErr } = await supabaseAdmin
    .from("clienti_anagrafica")
    .update({ drive_url: trimmedUrl })
    .eq("id", row.id);
  if (updateErr) {
    const msg = String(updateErr.message || "").toLowerCase();
    if (msg.includes("drive_url") && msg.includes("does not exist")) return;
    throw new Error(updateErr.message);
  }
}

async function insertAssetSerials(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  checklistId: string,
  moduliLed: string[],
  elettroniche: string[]
) {
  const payload = [
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
  if (!payload.length) return;

  const { error } = await supabaseAdmin.from("asset_serials").insert(payload);
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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

  const csvText = await file.text();
  const parsed = csvRowsToObjects(parseCsvSemicolon(csvText));
  if (!parsed.length) {
    return NextResponse.json({ ok: false, error: "CSV vuoto o senza righe valide" }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;
  const errors: Array<{ row: number; nome_checklist: string | null; cliente: string | null; error: string }> = [];

  for (let index = 0; index < parsed.length; index += 1) {
    const row = parsed[index];
    const rowNumber = index + 2;
    const nomeChecklist = getRowValue(row, "nome_checklist");
    const cliente = getRowValue(row, "cliente");

    try {
      if (!nomeChecklist || !cliente) {
        throw new Error("Campi obbligatori mancanti: nome_checklist / cliente");
      }

      const duplicate = await existsActiveChecklistDuplicate(supabaseAdmin, nomeChecklist, cliente);
      if (duplicate) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          nome_checklist: nomeChecklist,
          cliente,
          error: "Esiste già un progetto attivo con questo nome per questo cliente",
        });
        continue;
      }

      const payload = {
        nome_checklist: nomeChecklist,
        cliente,
        impianto_descrizione: parseOptionalText(getRowValue(row, "descrizione_impianto")),
        stato_progetto: parseOptionalText(getRowValue(row, "stato_progetto")),
        data_prevista: parseOptionalDate(getRowValue(row, "data_installazione_prevista", "data_prevista")),
        data_tassativa: parseOptionalDate(getRowValue(row, "data_tassativa")),
        data_installazione_reale: parseOptionalDate(getRowValue(row, "data_installazione_reale")),
        garanzia_scadenza: parseOptionalDate(getRowValue(row, "garanzia_scadenza")),
        magazzino_importazione: parseOptionalText(getRowValue(row, "codice_magazzino")),
      };

      const { data: insertedChecklist, error: insertErr } = await supabaseAdmin
        .from("checklists")
        .insert(payload)
        .select("id")
        .single();
      if (insertErr || !insertedChecklist?.id) {
        throw new Error(insertErr?.message || "Errore insert checklist");
      }
      inserted += 1;

      const postInsertWarnings: string[] = [];
      try {
        await insertAssetSerials(
          supabaseAdmin,
          insertedChecklist.id as string,
          splitSerials(getRowValue(row, "seriali_moduli_led")),
          splitSerials(getRowValue(row, "seriali_elettroniche"))
        );
      } catch (err: any) {
        postInsertWarnings.push(`Checklist creata ma seriali non importati: ${String(err?.message || err)}`);
      }

      try {
        await updateClienteDriveUrlIfPresent(
          supabaseAdmin,
          cliente,
          getRowValue(row, "link_drive_cliente")
        );
      } catch (err: any) {
        postInsertWarnings.push(
          `Checklist creata ma link Drive cliente non aggiornato: ${String(err?.message || err)}`
        );
      }

      if (postInsertWarnings.length > 0) {
        errors.push({
          row: rowNumber,
          nome_checklist: nomeChecklist,
          cliente,
          error: postInsertWarnings.join(" | "),
        });
      }
    } catch (err: any) {
      errors.push({
        row: rowNumber,
        nome_checklist: nomeChecklist || null,
        cliente: cliente || null,
        error: String(err?.message || "Errore import riga"),
      });
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    errors,
  });
}
