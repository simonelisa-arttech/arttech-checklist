"use client";

type DbOp = "select" | "insert" | "update" | "delete" | "upsert";

type DbPayload = {
  table: string;
  op: DbOp;
  select?: string;
  filter?: Record<string, string | number | boolean | null>;
  order?: Array<{ col: string; asc: boolean }>;
  limit?: number;
  payload?: any;
  onConflict?: string;
};

type DbResponse<T> = { data: T | null; error: { message: string } | null };

function likeToRegex(pattern: string) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = escaped.replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${regex}$`, "i");
}

async function callDb<T>(payload: DbPayload): Promise<DbResponse<T>> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || json?.ok === false) {
      return { data: null, error: { message: String(json?.error || "DB broker error") } };
    }
    return { data: (json?.data ?? null) as T, error: null };
  } catch (e: any) {
    return { data: null, error: { message: String(e?.message || "DB broker request failed") } };
  }
}

class DbFromBuilder {
  private table: string;
  private op: DbOp = "select";
  private selectClause = "*";
  private payload: any = null;
  private onConflict: string | undefined;
  private eqFilters: Record<string, string | number | boolean | null> = {};
  private inFilters: Array<{ col: string; values: Array<string | number | boolean | null> }> = [];
  private ilikeFilters: Array<{ col: string; pattern: string }> = [];
  private neqFilters: Array<{ col: string; value: string | number | boolean | null }> = [];
  private isFilters: Array<{ col: string; value: any }> = [];
  private gteFilters: Array<{ col: string; value: string | number }> = [];
  private lteFilters: Array<{ col: string; value: string | number }> = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private maxRows = 0;
  private expectSingle = false;
  private maybeSingleMode = false;
  private requestCount = false;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  select(select = "*", options?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.op = "select";
    }
    this.selectClause = select;
    this.requestCount = Boolean(options?.count);
    this.headOnly = Boolean(options?.head);
    return this;
  }

  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: any, options?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.onConflict = options?.onConflict;
    return this;
  }

  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(col: string, value: string | number | boolean | null) {
    this.eqFilters[col] = value;
    return this;
  }

  in(col: string, values: Array<string | number | boolean | null>) {
    this.inFilters.push({ col, values: values || [] });
    return this;
  }

  ilike(col: string, pattern: string) {
    if (!pattern.includes("%") && !pattern.includes("_")) {
      this.eqFilters[col] = pattern;
    }
    this.ilikeFilters.push({ col, pattern });
    return this;
  }

  neq(col: string, value: string | number | boolean | null) {
    this.neqFilters.push({ col, value });
    return this;
  }

  not(col: string, operator: string, value: any) {
    const op = String(operator || "").toLowerCase();
    if (op === "is") {
      this.neqFilters.push({ col, value });
    }
    return this;
  }

  is(col: string, value: any) {
    this.isFilters.push({ col, value });
    if (value === null) {
      this.eqFilters[col] = null;
    }
    return this;
  }

  gte(col: string, value: string | number) {
    this.gteFilters.push({ col, value });
    return this;
  }

  lte(col: string, value: string | number) {
    this.lteFilters.push({ col, value });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orders.push({ col, asc: options?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.maxRows = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    return this;
  }

  single() {
    this.expectSingle = true;
    this.maybeSingleMode = false;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    this.maybeSingleMode = true;
    return this;
  }

  private uniqueRows(rows: any[]) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const row of rows) {
      const key = row?.id ? `id:${row.id}` : JSON.stringify(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  }

  private applyClientFilters(rows: any[]) {
    let out = rows.slice();
    for (const f of this.ilikeFilters) {
      const re = likeToRegex(f.pattern);
      out = out.filter((r) => re.test(String((r as any)?.[f.col] ?? "")));
    }
    for (const f of this.neqFilters) {
      out = out.filter((r) => (r as any)?.[f.col] !== f.value);
    }
    for (const f of this.gteFilters) {
      out = out.filter((r) => String((r as any)?.[f.col] ?? "") >= String(f.value));
    }
    for (const f of this.lteFilters) {
      out = out.filter((r) => String((r as any)?.[f.col] ?? "") <= String(f.value));
    }
    for (const f of this.isFilters) {
      out = out.filter((r) => (r as any)?.[f.col] === f.value);
    }
    if (this.orders.length > 0) {
      out.sort((a, b) => {
        for (const o of this.orders) {
          const av = (a as any)?.[o.col];
          const bv = (b as any)?.[o.col];
          const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
          if (cmp !== 0) return o.asc ? cmp : -cmp;
        }
        return 0;
      });
    }
    if (this.maxRows > 0) out = out.slice(0, this.maxRows);
    return out;
  }

  private async runSelect() {
    const inFilter = this.inFilters[0];
    if (!inFilter) {
      const res = await callDb<any[]>({
        table: this.table,
        op: "select",
        select: this.selectClause,
        filter: this.eqFilters,
        order: this.orders,
        limit: this.maxRows || undefined,
      });
      if (res.error) return res;
      const rows = this.applyClientFilters(this.uniqueRows((res.data || []) as any[]));
      return { data: rows, error: null, count: rows.length };
    }

    const rows: any[] = [];
    for (const value of inFilter.values) {
      const res = await callDb<any[]>({
        table: this.table,
        op: "select",
        select: this.selectClause,
        filter: { ...this.eqFilters, [inFilter.col]: value },
        order: this.orders,
      });
      if (res.error) return res;
      rows.push(...(res.data || []));
    }
    const merged = this.applyClientFilters(this.uniqueRows(rows));
    return { data: merged, error: null, count: merged.length };
  }

  private async runWrite() {
    if (this.op === "insert" || this.op === "upsert") {
      return callDb<any[]>({
        table: this.table,
        op: this.op,
        payload: this.payload,
        onConflict: this.onConflict,
      });
    }

    const inFilter = this.inFilters[0];
    if (!inFilter) {
      return callDb<any[]>({
        table: this.table,
        op: this.op,
        payload: this.payload,
        filter: this.eqFilters,
      });
    }

    const merged: any[] = [];
    for (const value of inFilter.values) {
      const res = await callDb<any[]>({
        table: this.table,
        op: this.op,
        payload: this.payload,
        filter: { ...this.eqFilters, [inFilter.col]: value },
      });
      if (res.error) return res;
      merged.push(...(res.data || []));
    }
    return { data: merged, error: null } as DbResponse<any[]>;
  }

  private async execute() {
    const result: any =
      this.op === "select" ? await this.runSelect() : await this.runWrite();
    if (result.error) return { data: null, error: result.error };
    const data = (result.data ?? []) as any[];

    if (!this.expectSingle) {
      if (this.op === "select" && this.headOnly) {
        return { data: null, error: null, count: result.count ?? data.length };
      }
      if (this.op === "select" && this.requestCount) {
        return { data: result.data, error: null, count: result.count ?? data.length };
      }
      return { data: result.data, error: null };
    }
    if (data.length === 0) {
      if (this.maybeSingleMode) return { data: null, error: null };
      return { data: null, error: { message: "No rows returned" } };
    }
    if (data.length > 1 && !this.maybeSingleMode) {
      return { data: null, error: { message: "Multiple rows returned" } };
    }
    return { data: data[0] ?? null, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

export function dbFrom(table: string) {
  return new DbFromBuilder(table);
}

export async function db<T = any>(payload: DbPayload): Promise<DbResponse<T>> {
  return callDb<T>(payload);
}
