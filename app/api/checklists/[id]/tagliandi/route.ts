export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function parseCookieHeader(cookieHeader: string | null) {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(key, value);
  }
  return map;
}

function tryDecodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseJsonToken(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const direct = row["access_token"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return "";
}

function extractAccessTokenFromAuthCookieValue(rawValue: string) {
  const decoded = tryDecodeCookieValue(rawValue);
  if (!decoded) return "";

  try {
    const parsed = JSON.parse(decoded);
    const tok = parseJsonToken(parsed);
    if (tok) return tok;
  } catch {
    // not json
  }

  if (decoded.startsWith("base64-")) {
    try {
      const b64 = decoded.slice("base64-".length);
      const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      const tok = parseJsonToken(parsed);
      if (tok) return tok;
    } catch {
      // ignore
    }
  }

  return "";
}

function getAccessTokenFromCookieHeader(cookieHeader: string | null) {
  const cookies = parseCookieHeader(cookieHeader);

  const direct = cookies.get("sb-access-token");
  if (direct) return tryDecodeCookieValue(direct);

  const authCookieNames = Array.from(cookies.keys()).filter((k) =>
    /^sb-[a-z0-9]+-auth-token$/i.test(k)
  );
  for (const name of authCookieNames) {
    const raw = cookies.get(name) || "";
    const tok = extractAccessTokenFromAuthCookieValue(raw);
    if (tok) return tok;
  }

  const chunked = new Map<string, Array<{ idx: number; value: string }>>();
  for (const [name, value] of cookies.entries()) {
    const match = /^((?:sb-[a-z0-9]+-auth-token))\.(\d+)$/i.exec(name);
    if (!match) continue;
    const base = match[1];
    const idx = Number(match[2]);
    const parts = chunked.get(base) || [];
    parts.push({ idx, value });
    chunked.set(base, parts);
  }
  for (const parts of chunked.values()) {
    const joined = parts
      .sort((a, b) => a.idx - b.idx)
      .map((part) => part.value)
      .join("");
    const tok = extractAccessTokenFromAuthCookieValue(joined);
    if (tok) return tok;
  }

  return "";
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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const checklistId = String(params?.id || "").trim();
  if (!checklistId) {
    return NextResponse.json({ error: "Checklist id mancante" }, { status: 400 });
  }

  const isAuthed = await assertAuthenticated(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("tagliandi")
    .select("id, checklist_id, scadenza, stato, modalita, note, created_at")
    .eq("checklist_id", checklistId)
    .order("scadenza", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tagliandi: data || [] });
}
