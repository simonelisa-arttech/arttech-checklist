export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type DbOp = "select" | "insert" | "update" | "delete" | "upsert";

type DbRequest = {
  table?: string;
  op?: DbOp;
  select?: string;
  filter?: Record<string, string | number | boolean | null>;
  filterIn?: Record<string, Array<string | number | boolean | null>>;
  order?: Array<{ col: string; asc: boolean }>;
  limit?: number;
  payload?: Record<string, any> | Record<string, any>[];
  onConflict?: string;
};

const TABLE_RULES: Record<
  string,
  {
    ops: DbOp[];
    filterCols: string[];
    orderCols: string[];
    requiredEqAnyOf?: string[];
    allowNoFilterSelect?: boolean;
  }
> = {
  checklists: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "cliente_id", "created_by_operatore", "updated_by_operatore"],
    orderCols: ["created_at", "updated_at", "data_prevista", "data_tassativa"],
    requiredEqAnyOf: ["id", "cliente_id"],
  },
  checklist_items: {
    ops: ["select", "insert", "update", "delete", "upsert"],
    filterCols: ["id", "checklist_id"],
    orderCols: ["created_at", "updated_at"],
    requiredEqAnyOf: ["id", "checklist_id"],
  },
  checklist_tasks: {
    ops: ["select", "insert", "update", "delete", "upsert"],
    filterCols: ["id", "checklist_id", "task_template_id", "updated_by_operatore"],
    orderCols: ["created_at", "updated_at", "ordine", "sezione"],
    requiredEqAnyOf: ["id", "checklist_id"],
  },
  checklist_documents: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "uploaded_by_operatore"],
    orderCols: ["created_at", "uploaded_at"],
    requiredEqAnyOf: ["id", "checklist_id"],
  },
  licenses: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "updated_by_operatore"],
    orderCols: ["created_at", "updated_at", "scadenza"],
    requiredEqAnyOf: ["id", "checklist_id"],
  },
  tagliandi: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "cliente"],
    orderCols: ["created_at", "updated_at", "scadenza"],
    requiredEqAnyOf: ["id", "checklist_id", "cliente"],
  },
  asset_serials: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "checklist_id", "tipo", "seriale"],
    orderCols: ["created_at", "updated_at"],
    requiredEqAnyOf: ["id", "checklist_id"],
  },
  catalog_items: {
    ops: ["select", "insert", "update", "delete", "upsert"],
    filterCols: ["id", "attivo", "codice", "tipo", "categoria"],
    orderCols: ["created_at", "updated_at", "codice", "descrizione"],
    allowNoFilterSelect: true,
  },
  operatori: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "user_id", "attivo", "ruolo", "cliente_id"],
    orderCols: ["created_at", "updated_at", "nome"],
    allowNoFilterSelect: true,
  },
  attachments: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "entity_id", "entity_type", "created_by"],
    orderCols: ["created_at", "updated_at"],
    requiredEqAnyOf: ["id", "entity_id"],
  },
  saas_interventi: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: [
      "id",
      "checklist_id",
      "cliente_id",
      "cliente",
      "stato_intervento",
      "stato",
      "contratto_id",
      "incluso",
      "canale",
    ],
    orderCols: ["created_at", "updated_at", "data", "data_tassativa"],
    requiredEqAnyOf: ["id", "checklist_id", "cliente_id", "cliente"],
  },
  checklist_task_documents: {
    ops: ["select", "insert", "delete"],
    filterCols: ["id", "checklist_id", "task_id", "uploaded_by_operatore"],
    orderCols: ["created_at", "uploaded_at"],
    requiredEqAnyOf: ["id", "checklist_id", "task_id"],
  },
  clienti_anagrafica: {
    ops: ["select"],
    filterCols: ["id", "attivo", "codice_interno", "denominazione"],
    orderCols: ["created_at", "updated_at", "denominazione"],
    allowNoFilterSelect: true,
  },
  saas_contratti: {
    ops: ["select", "insert", "update", "delete"],
    filterCols: ["id", "cliente"],
    orderCols: ["created_at", "updated_at", "scadenza"],
    requiredEqAnyOf: ["id", "cliente"],
  },
  saas_piani: {
    ops: ["select"],
    filterCols: ["id", "codice"],
    orderCols: ["created_at", "updated_at", "codice", "nome"],
  },
  checklist_alert_log: {
    ops: ["select", "insert", "update"],
    filterCols: [
      "id",
      "checklist_id",
      "tipo",
      "riferimento",
      "trigger",
      "to_operatore_id",
      "intervento_id",
      "canale",
    ],
    orderCols: ["created_at"],
    allowNoFilterSelect: true,
  },
  checklist_task_templates: {
    ops: ["select"],
    filterCols: ["id", "target", "attivo", "sezione", "titolo"],
    orderCols: ["created_at", "ordine", "titolo", "sezione"],
    allowNoFilterSelect: true,
  },
  rinnovi_servizi: {
    ops: ["select", "insert", "update", "delete", "upsert"],
    filterCols: ["id", "checklist_id", "item_tipo", "cliente", "subtipo"],
    orderCols: ["created_at", "updated_at", "scadenza", "item_tipo"],
    requiredEqAnyOf: ["id", "checklist_id", "cliente"],
  },
  saas_interventi_files: {
    ops: ["select", "insert", "delete"],
    filterCols: ["id", "intervento_id", "checklist_id"],
    orderCols: ["created_at", "uploaded_at"],
    requiredEqAnyOf: ["id", "intervento_id", "checklist_id"],
  },
  alert_message_templates: {
    ops: ["select"],
    filterCols: ["id", "tipo", "trigger", "attivo"],
    orderCols: ["created_at", "updated_at", "titolo"],
    allowNoFilterSelect: true,
  },
  checklist_checks: {
    ops: ["insert"],
    filterCols: ["id", "checklist_id", "checklist_item_id"],
    orderCols: ["created_at"],
    requiredEqAnyOf: ["checklist_id"],
  },
  checklist_template_items: {
    ops: ["select"],
    filterCols: ["id", "target", "attivo"],
    orderCols: ["created_at", "sezione", "ordine", "voce"],
    allowNoFilterSelect: true,
  },
  notification_jobs: {
    ops: ["insert"],
    filterCols: ["id", "checklist_id"],
    orderCols: ["created_at"],
    requiredEqAnyOf: ["checklist_id"],
  },
  licenze: {
    ops: ["update"],
    filterCols: ["id", "checklist_id"],
    orderCols: ["updated_at"],
    requiredEqAnyOf: ["id", "checklist_id"],
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

function stripSelectColumn(selectClause: string, columnName: string) {
  const parts = selectClause
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const next = parts.filter((part) => {
    const base = part.split(":")[0]?.trim().toLowerCase() || "";
    return base !== columnName.toLowerCase();
  });
  if (next.length === 0) return "*";
  return next.join(", ");
}

function dbFailure(table: string, op: string, filter: Record<string, any>, message: string) {
  console.error("[api/db] failure", { table, op, filter, message });
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: Request) {
  try {
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
    const allowedBodyKeys = new Set(["table", "op", "select", "filter", "filterIn", "order", "limit", "payload"]);
    allowedBodyKeys.add("onConflict");
    for (const key of Object.keys(body)) {
      if (!allowedBodyKeys.has(key)) return invalid(`Unsupported field: ${key}`);
    }

    const table = String(body.table || "").trim();
    const op = String(body.op || "").trim() as DbOp;
    const rule = TABLE_RULES[table];
    if (!rule) return invalid("Table not allowed", 403);
    if (!rule.ops.includes(op)) return invalid("Operation not allowed", 403);

    const filterInRaw = isPlainObject(body.filterIn) ? body.filterIn : {};
    const filterIn: Record<string, Array<string | number | boolean | null>> = {};
    for (const [k, v] of Object.entries(filterInRaw)) {
      if (!rule.filterCols.includes(k)) return invalid(`Filter column not allowed: ${k}`, 403);
      if (!Array.isArray(v)) return invalid(`Invalid IN filter for ${k}: expected array`);
      if (v.length === 0) return invalid(`Invalid IN filter for ${k}: empty array`);
      if (v.length > 1000) return invalid(`Invalid IN filter for ${k}: too many values`);
      let normalized: Array<string | number | boolean | null>;
      try {
        normalized = v.map((item) => {
          const t = typeof item;
          if (!(item === null || t === "string" || t === "number" || t === "boolean")) {
            throw new Error(`Invalid IN filter value type for ${k}`);
          }
          if ((k === "id" || k.endsWith("_id")) && item !== null) {
            if (typeof item !== "string") {
              throw new Error(`Invalid UUID IN filter for ${k}: expected uuid string`);
            }
            const uuid = item.trim();
            if (!isUuidLike(uuid)) {
              throw new Error(`Invalid UUID IN filter for ${k}: ${uuid}`);
            }
            return uuid;
          }
          return item;
        });
      } catch (e: any) {
        return invalid(String(e?.message || `Invalid IN filter for ${k}`), 400);
      }
      filterIn[k] = normalized;
    }

    const filter = isPlainObject(body.filter) ? body.filter : {};
    for (const [k, v] of Object.entries(filter)) {
      if (!rule.filterCols.includes(k)) return invalid(`Filter column not allowed: ${k}`, 403);
      const t = typeof v;
      if (!(v === null || t === "string" || t === "number" || t === "boolean")) {
        return invalid(`Invalid filter value type for ${k}`);
      }
      if (k === "id" || k.endsWith("_id")) {
        if (v !== null) {
          if (typeof v !== "string") {
            return invalid(`Invalid UUID filter for ${k}: expected uuid string`, 400);
          }
          const normalized = v.trim();
          if (!isUuidLike(normalized)) {
            return invalid(`Invalid UUID filter for ${k}: ${normalized}`, 400);
          }
        }
      }
    }

    if (
    op === "select" &&
    Object.keys(filter).length === 0 &&
    Object.keys(filterIn).length === 0 &&
    !rule.allowNoFilterSelect
    ) {
      return invalid("Select requires eq filter for this table", 403);
    }
    if (
    op === "select" &&
    rule.requiredEqAnyOf &&
    rule.requiredEqAnyOf.length > 0 &&
    !rule.requiredEqAnyOf.some(
      (c) =>
        Object.prototype.hasOwnProperty.call(filter, c) ||
        Object.prototype.hasOwnProperty.call(filterIn, c)
    )
    ) {
      return invalid(`Missing required eq filter: one of [${rule.requiredEqAnyOf.join(", ")}]`, 403);
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

    const payload =
      isPlainObject(body.payload) || Array.isArray(body.payload) ? body.payload : null;

    if (op === "select") {
    const select = String(body.select || "*").trim();
    if (select !== "*" && !/^[a-zA-Z0-9_,\s:\(\)\.\*]+$/.test(select)) {
      return invalid("Invalid select clause");
    }
    let q: any = supabaseAdmin.from(table).select(select);
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    for (const [k, v] of Object.entries(filterIn)) q = q.in(k, v as any[]);
    for (const o of order) q = q.order(o.col, { ascending: o.asc !== false });
    if (normalizedLimit > 0) q = q.limit(normalizedLimit);
    let { data, error } = await q;
    if (error) {
      const msg = String(error.message || "").toLowerCase();

      if (
        table === "checklist_task_documents" &&
        (msg.includes("could not find the table") ||
          msg.includes("schema cache") ||
          msg.includes("relation") && msg.includes("does not exist"))
      ) {
        return NextResponse.json({ ok: true, data: [] });
      }

      if (
        table === "operatori" &&
        select !== "*" &&
        msg.includes("operatori.cliente") &&
        msg.includes("does not exist")
      ) {
        const retrySelect = stripSelectColumn(select, "cliente");
        let retryQ: any = supabaseAdmin.from(table).select(retrySelect);
        for (const [k, v] of Object.entries(filter)) retryQ = retryQ.eq(k, v);
        for (const [k, v] of Object.entries(filterIn)) retryQ = retryQ.in(k, v as any[]);
        for (const o of order) retryQ = retryQ.order(o.col, { ascending: o.asc !== false });
        if (normalizedLimit > 0) retryQ = retryQ.limit(normalizedLimit);
        const retry = await retryQ;
        data = retry.data;
        error = retry.error;
      }

      if (
        table === "rinnovi_servizi" &&
        select !== "*" &&
        msg.includes("rinnovi_servizi.riferimento") &&
        msg.includes("does not exist")
      ) {
        const retrySelect = stripSelectColumn(select, "riferimento");
        let retryQ: any = supabaseAdmin.from(table).select(retrySelect);
        for (const [k, v] of Object.entries(filter)) retryQ = retryQ.eq(k, v);
        for (const [k, v] of Object.entries(filterIn)) retryQ = retryQ.in(k, v as any[]);
        for (const o of order) retryQ = retryQ.order(o.col, { ascending: o.asc !== false });
        if (normalizedLimit > 0) retryQ = retryQ.limit(normalizedLimit);
        const retry = await retryQ;
        data = (retry.data || []).map((row: any) => ({ ...row, riferimento: null }));
        error = retry.error;
      }
    }
    if (error) return dbFailure(table, op, { ...filter, ...filterIn }, error.message);
    return NextResponse.json({ ok: true, data: data || [] });
    }

    if (op === "insert") {
    if (!payload) return invalid("Missing payload");
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select("*");
      if (error) return dbFailure(table, op, filter, error.message);
    return NextResponse.json({ ok: true, data });
    }

    if (op === "upsert") {
    if (!payload) return invalid("Missing payload");
    const onConflict = String((body as any).onConflict || "").trim();
    const options = onConflict ? { onConflict } : undefined;
    const { data, error } = await supabaseAdmin.from(table).upsert(payload as any, options as any).select("*");
      if (error) return dbFailure(table, op, filter, error.message);
    return NextResponse.json({ ok: true, data });
    }

    if (op === "update") {
    if (!payload) return invalid("Missing payload");
    if (Object.keys(filter).length === 0) return invalid("Update requires at least one eq filter");
    let q: any = supabaseAdmin.from(table).update(payload);
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
      if (error) return dbFailure(table, op, filter, error.message);
    return NextResponse.json({ ok: true, data });
    }

    if (op === "delete") {
    if (Object.keys(filter).length === 0) return invalid("Delete requires at least one eq filter");
    let q: any = supabaseAdmin.from(table).delete();
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { data, error } = await q.select("*");
      if (error) return dbFailure(table, op, filter, error.message);
    return NextResponse.json({ ok: true, data });
    }

    return invalid("Unsupported operation");
  } catch (e: any) {
    console.error("[api/db] unexpected", { message: String(e?.message || e) });
    return NextResponse.json(
      { ok: false, error: String(e?.message || "Unexpected server error") },
      { status: 500 }
    );
  }
}
