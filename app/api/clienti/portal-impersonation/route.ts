export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

function normalizeClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { cliente_id?: string } | null = null;
  try {
    body = (await request.json()) as { cliente_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clienteId = String(body?.cliente_id || "").trim();
  if (!clienteId || !isUuid(clienteId)) {
    return NextResponse.json({ error: "cliente_id non valido" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const ip = normalizeClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const { error } = await auth.adminClient.from("clienti_portale_impersonation_tokens").insert({
    cliente_id: clienteId,
    operatore_id: auth.operatore.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: `/cliente?impersonation_token=${token}`,
  });
}
