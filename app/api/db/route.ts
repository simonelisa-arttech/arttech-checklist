export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type DbOp = "select" | "insert" | "update" | "delete";

type DbRequest = {
  table?: string;
  op?: DbOp;
  select?: string;
  filter?: Record<string, string | number | boolean | null>;
  order?: Array<{ col: string; asc: boolean }>;
  limit?: number;
  payload?: Record<string, any>;
};

const TABLE_RULES: Record<
  string,
  {
    ops: DbOp[];
    filterCols: string[];
    orderCols: string[];
  }
> = {
  checklists: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "cliente_id", "created_by_operatore", "updated_by_operatore"],
    orderCols: ["created_at", "updated_at", "data_prevista", "data_tassativa"],
  },
  checklist_items: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id"],
    orderCols: ["created_at", "updated_at"],
  },
  checklist_tasks: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "task_template_id", "updated_by_operatore"],
    orderCols: ["created_at", "updated_at", "ordine", "sezione"],
  },
  checklist_documents: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "uploaded_by_operatore"],
    orderCols: ["created_at", "uploaded_at"],
  },
  licenses: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "updated_by_operatore"],
    orderCols: ["created_at", "updated_at", "scadenza"],
  },
  tagliandi: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "cliente"],
    orderCols: ["created_at", "updated_at", "scadenza"],
  },
  asset_serials: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "tipo", "seriale"],
    orderCols: ["created_at", "updated_at"],
  },
  catalog_items: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "attivo", "codice", "tipo", "categoria"],
    orderCols: ["created_at", "updated_at", "codice", "descrizione"],
  },
  operatori: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "user_id", "attivo", "ruolo", "cliente_id"],
    orderCols: ["created_at", "updated_at", "nome"],
  },
  clienti_anagrafica: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "attivo", "codice_interno"],
    orderCols: ["created_at", "updated_at", "denominazione"],
  },
  attachments: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "entity_id", "entity_type", "created_by"],
    orderCols: ["created_at", "updated_at"],
  },
};

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

function invalid(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function POST(request: Request) {
  const isAuthed = await assertAuthenticated(request);
  if (!isAuthed) return invalid("Unauthorized", 401);

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return invalid("Missing SUPABASE_SERVICE_ROLE_KEY", 500);
  }

  let body: DbRequest;
  try {
    body = (await request.json()) as DbRequest;
  } catch {
    return invalid("Invalid JSON body");
  }

  if (!isPlainObject(body)) return invalid("Invalid body");
  const allowedBodyKeys = new Set(["table", "op", "select", "filter", "order", "limit", "payload"]);
  for (const key of Object.keys(body)) {
    if (!allowedBodyKeys.has(key)) return invalid(`Unsupported field: ${key}`);
  }

  const table = String(body.table || "").trim();
  const op = String(body.op || "").trim() as DbOp;
  const rule = TABLE_RULES[table];
  if (!rule) return invalid("Table not allowed", 403);
  if (!rule.ops.includes(op)) return invalid("Operation not allowed", 403);

  const filter = isPlainObject(body.filter) ? body.filter : {};
  for (const [k, v] of Object.entries(filter)) {
    if (!rule.filterCols.includes(k)) return invalid(`Filter column not allowed: ${k}`, 403);
    const t = typeof v;
    if (!(v === null || t === "string" || t === "number" || t === "boolean")) {
      return invalid(`Invalid filter value type for ${k}`);
    }
  }

  const order = Array.isArray(body.order) ? body.order : [];
  for (const item of order) {
    if (!item || typeof item !== "object") return invalid("Invalid order clause");
    if (!rule.orderCols.includes(String(item.col || ""))) {
      return invalid(`Order column not allowed: ${String(item.col || "")}`, 403);
    }
  }

  const limit = Number(body.limit ?? 0);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 0;

  const payload = isPlainObject(body.payload) ? body.payload : null;

  if (op === "select") {
    const select = String(body.select || "*").trim();
    if (select !== "*" && !/^[a-zA-Z0-9_,\s]+$/.test(select)) {
      return invalid("Invalid select clause");
    }
    let q: any = supabaseAdmin.from(table).select(select);
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    for (const o of order) q = q.order(o.col, { ascending: o.asc !== false });
    if (normalizedLimit > 0) q = q.limit(normalizedLimit);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data: data || [] });
  }

  if (op === "insert") {
    if (!payload) return invalid("Missing payload");
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select("*");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  if (op === "update") {
    if (!payload) return invalid("Missing payload");
    if (Object.keys(filter).length === 0) return invalid("Update requires at least one eq filter");
    let q: any = supabaseAdmin.from(table).update(payload);
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  if (op === "delete") {
    if (Object.keys(filter).length === 0) return invalid("Delete requires at least one eq filter");
    let q: any = supabaseAdmin.from(table).delete();
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  }

  return invalid("Unsupported operation");
}
