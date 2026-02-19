export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAccessToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearerToken) return bearerToken;

  const cookieToken = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sb-access-token="))
    ?.split("=")
    .slice(1)
    .join("=");

  return cookieToken || "";
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 });
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAnon.auth.getUser(accessToken);
  if (userErr || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: opByUserId, error: byUserErr } = await supabaseAdmin
    .from("operatori")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (byUserErr) {
    return NextResponse.json({ error: byUserErr.message }, { status: 500 });
  }
  if (opByUserId?.id) {
    return NextResponse.json({ ok: true, operatore_id: opByUserId.id });
  }

  const userEmail = (user.email || "").trim();
  if (!userEmail) {
    return NextResponse.json({ error: "Operatore non associato" }, { status: 404 });
  }

  const { data: opByEmail, error: byEmailErr } = await supabaseAdmin
    .from("operatori")
    .select("id, user_id")
    .eq("email", userEmail)
    .maybeSingle();
  if (byEmailErr) {
    return NextResponse.json({ error: byEmailErr.message }, { status: 500 });
  }
  if (!opByEmail?.id) {
    return NextResponse.json({ error: "Operatore non associato" }, { status: 404 });
  }

  if (opByEmail.user_id !== user.id) {
    const { error: updErr } = await supabaseAdmin
      .from("operatori")
      .update({ user_id: user.id })
      .eq("id", opByEmail.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, operatore_id: opByEmail.id });
}
