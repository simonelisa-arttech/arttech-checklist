export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccessTokenFromRequest } from "@/lib/serverAuthToken";

type OperatoreMeRow = {
  id: string;
  user_id: string | null;
  nome: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  can_access_impostazioni: boolean | null;
  personale_id: string | null;
  email?: string | null;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function pickBestOperatoreCandidate(
  rows: OperatoreMeRow[],
  userId: string,
  userEmail: string
) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  const ranked = [...rows].sort((a, b) => {
    const score = (row: OperatoreMeRow) => {
      let total = 0;
      if (row.attivo !== false) total += 1000;
      if (normalizeEmail(row.email) === normalizedUserEmail) total += 500;
      if (String(row.user_id || "") === userId) total += 250;
      if (row.personale_id) total += 50;
      if (row.can_access_impostazioni === true) total += 25;
      return total;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "it", { sensitivity: "base" });
  });
  return ranked[0] || null;
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 });
  }

  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "No auth cookie" }, { status: 401 });
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: operatoriByUserId, error: opErr } = await supabaseAdmin
    .from("operatori")
    .select("id, user_id, nome, ruolo, attivo, can_access_impostazioni, personale_id, email")
    .eq("user_id", user.id);

  if (opErr) {
    return NextResponse.json({ error: opErr.message }, { status: 500 });
  }

  const userEmail = String(user.email || "")
    .trim()
    .toLowerCase();
  let operatoriByEmail: OperatoreMeRow[] = [];
  if (userEmail) {
    const { data: byEmailRows, error: byEmailErr } = await supabaseAdmin
      .from("operatori")
      .select("id, user_id, nome, ruolo, attivo, can_access_impostazioni, personale_id, email")
      .ilike("email", userEmail);

    if (byEmailErr) {
      return NextResponse.json({ error: byEmailErr.message }, { status: 500 });
    }
    operatoriByEmail = (byEmailRows || []) as OperatoreMeRow[];
  }

  const candidates = [...((operatoriByUserId || []) as OperatoreMeRow[]), ...operatoriByEmail].reduce<
    OperatoreMeRow[]
  >((acc, row) => {
    if (!row?.id || acc.some((item) => item.id === row.id)) return acc;
    acc.push(row);
    return acc;
  }, []);

  const operatore = pickBestOperatoreCandidate(candidates, user.id, userEmail);
  if (!operatore?.id) {
    return NextResponse.json({ error: "Operatore non associato" }, { status: 404 });
  }

  const { error: updErr } = await supabaseAdmin
    .from("operatori")
    .update({ user_id: user.id })
    .eq("id", operatore.id);
  if (updErr && String(operatore.user_id || "") !== user.id) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    operatore: {
      ...operatore,
      user_id: user.id,
    },
  });
}
